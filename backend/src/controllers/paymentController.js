import { v4 as uuidv4 } from 'uuid';
import { db, runTransaction, sqlite } from '../database/db.js';
import { paymentService } from '../services/paymentService.js';
import { emailService } from '../services/emailService.js';

const purchasableTypes = new Set(['product', 'guide', 'homestay', 'package', 'restaurant', 'transport', 'destination']);

function resolveItem(itemType, itemId, { startDate, endDate, travelers } = {}) {
  if (itemType === 'product') {
    const item = db.products.findById(itemId);
    if (!item || !item.is_active || item.approval_status !== 'approved') return null;
    return { item, title: item.name, amount: Number(item.price), providerId: item.vendor_id };
  }
  if (itemType === 'destination') {
    const item = db.destinations.findById(itemId);
    if (!item || !item.is_active) return null;
    return { item, title: item.title || item.name, amount: Number(item.avg_cost), providerId: null };
  }
  const item = db.services.findById(itemId);
  const provider = item ? db.providerProfiles.findByUserId(item.provider_id) : null;
  const providerIsEligible = item?.category === 'package' || provider?.verification_status === 'approved';
  const availability = item ? db.services.getAvailability(item.id, { startDate, endDate, travelers }) : null;
  if (!item || !item.is_active || item.approval_status !== 'approved' || item.category !== itemType || !providerIsEligible ||
    availability?.availabilityStatus === 'unavailable') return null;
  return { item, title: item.title, amount: Number(item.price), providerId: item.provider_id };
}

function normalizeDeliveryAddress(value) {
  if (!value || typeof value !== 'object') return null;
  const address = {
    address: String(value.address || '').trim(),
    landmark: String(value.landmark || '').trim(),
    district: String(value.district || '').trim(),
    state: String(value.state || '').trim(),
    pinCode: String(value.pinCode || '').trim()
  };
  return address.address && address.landmark && address.district && address.state && /^\d{6}$/.test(address.pinCode)
    ? address
    : null;
}

function bookingInput(req) {
  const {
    itemType = 'product', itemId, travelers = 1, checkInDate, checkOutDate, days = 1, deliveryAddress
  } = req.body;
  
  if (!itemId || !purchasableTypes.has(itemType)) {
    const error = new Error('A valid marketplace item or destination is required.');
    error.status = 400;
    throw error;
  }
  const count = Math.max(1, Number(travelers) || 1);
  const normalizedDeliveryAddress = normalizeDeliveryAddress(deliveryAddress);
  if (itemType === 'product' && !normalizedDeliveryAddress) {
    const error = new Error('A complete delivery location is required for craft orders.');
    error.status = 400;
    throw error;
  }
  return { itemType, itemId, travelers: count, checkInDate, checkOutDate, days: Math.max(1, Number(days) || 1), deliveryAddress: normalizedDeliveryAddress };
}

export const paymentController = {
  async createBundleOrder(req, res) {
    try {
      if (['guide', 'vendor'].includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Guides and vendors cannot purchase marketplace items.' });
      }
      const { items = [], travelers = 1, checkInDate, checkOutDate, days = 1, rooms = 1 } = req.body;
      const requestKey = String(req.headers['x-idempotency-key'] || '').trim();
      if (!requestKey || requestKey.length > 100) {
        return res.status(400).json({ success: false, message: 'A booking request key is required.' });
      }
      const previousRequest = db.bookings.bookingRequestKeys.find(req.user.id, requestKey);
      if (previousRequest) {
        const previousBooking = db.bookings.findById(previousRequest.booking_id);
        const previousPayment = previousBooking ? db.payments.findByBookingId(previousBooking.id) : null;
        if (previousBooking && previousPayment) {
          return res.status(200).json({
            success: true,
            idempotent: true,
            message: previousPayment.status === 'successful' ? 'This booking was already paid.' : 'This booking request is already open.',
            order: { id: previousPayment.gateway_order_id, amount: Math.round(Number(previousPayment.amount) * 100), currency: previousPayment.currency },
            keyId: paymentService.getPublicKeyId(),
            booking: previousBooking,
            payment: previousPayment
          });
        }
      }
      const serviceIds = Array.from(new Set(items.map((item) => item.serviceId).filter(Boolean)));
      if (!serviceIds.length) return res.status(400).json({ success: false, message: 'Select at least one guide, hotel, or package.' });
      const roomCount = Math.max(1, Number(rooms) || 1);
      if (!Number.isInteger(Number(days)) || Number(days) < 1) {
        return res.status(400).json({ success: false, message: 'Trip duration must be a positive whole number.' });
      }
      if (!Number.isInteger(Number(rooms)) || Number(rooms) < 1) {
        return res.status(400).json({ success: false, message: 'Room count must be a positive whole number.' });
      }
      const resolvedItems = serviceIds.map((serviceId) => {
        const service = db.services.findById(serviceId);
        const provider = service ? db.providerProfiles.findByUserId(service.provider_id) : null;
        const providerIsEligible = service?.category === 'package' || provider?.verification_status === 'approved';
        const availability = service ? db.services.getAvailability(service.id, {
          startDate: checkInDate,
          endDate: checkOutDate,
          travelers: service.category === 'homestay' ? roomCount : travelers
        }) : null;
        if (!service || !service.is_active || service.approval_status !== 'approved' || !providerIsEligible ||
          availability?.availabilityStatus === 'unavailable') {
          throw Object.assign(new Error('One of the selected services is no longer available.'), { status: 404 });
        }
        return service;
      });
      const nights = Math.max(0, Number(days) - 1);
      if (resolvedItems.some((service) => !Number.isFinite(Number(service.price)) || Number(service.price) <= 0)) {
        return res.status(400).json({ success: false, message: 'A selected service has no bookable price.' });
      }
      const totalAmount = resolvedItems.reduce((sum, service) => {
        const price = Number(service.price);
        if (service.category === 'homestay') return sum + price * nights * roomCount;
        if (service.category === 'guide') return sum + price * Math.max(1, Number(days) || 1);
        return sum + price;
      }, 0);
      if (!Number.isFinite(totalAmount) || totalAmount <= 0) return res.status(400).json({ success: false, message: 'The combined booking amount must be greater than zero.' });
      const bookingId = `JH-BUNDLE-${uuidv4().slice(0, 8).toUpperCase()}`;
      const order = await paymentService.createOrder({
        amount: totalAmount,
        receipt: bookingId,
        notes: { booking_id: bookingId, user_id: req.user.id, service_ids: serviceIds.join(',') }
      });
      const booking = db.bookings.create({
        id: bookingId, user_id: req.user.id, provider_id: resolvedItems[0].provider_id,
        item_type: 'package', item_id: resolvedItems[0].id,
        item_title: `Combined tourism booking: ${resolvedItems.map((service) => service.title).join(', ')}`,
        travelers: Math.max(1, Number(travelers) || 1),
        check_in_date: checkInDate || new Date().toISOString().split('T')[0],
        check_out_date: checkOutDate || null, days: Math.max(1, Number(days) || 1),
        total_amount: totalAmount, escrow_amount: totalAmount, escrow_status: 'locked',
        contract_address: null, contract_tx_hash: null, status: 'payment_pending', cancellation_reason: null
      });
      for (const service of resolvedItems) {
        sqlite.prepare('INSERT INTO booking_bundle_items (booking_id, service_id, quantity) VALUES (?, ?, ?)').run(bookingId, service.id, service.category === 'homestay' ? roomCount : 1);
      }
      db.bookings.bookingRequestKeys.create(req.user.id, requestKey, bookingId);
      db.payments.create({
        id: `pay-${uuidv4().slice(0, 12)}`, booking_id: bookingId, user_id: req.user.id,
        gateway: 'razorpay', gateway_order_id: order.id, gateway_payment_id: null,
        gateway_signature: null, amount: totalAmount, currency: 'INR', status: 'pending'
      });
      res.status(201).json({
        success: true,
        order: { id: order.id, amount: order.amount, currency: order.currency },
        keyId: paymentService.getPublicKeyId(),
        booking,
        payment: db.payments.findByBookingId(bookingId),
        bundledServices: resolvedItems.map((service) => ({ id: service.id, title: service.title, category: service.category, price: service.price, rooms: service.category === 'homestay' ? roomCount : undefined, nights }))
      });
    } catch (error) {
      res.status(error.status || 500).json({ success: false, message: error.message });
    }
  },

  async createOrder(req, res) {
    try {
      if (['guide', 'vendor'].includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Guides and vendors cannot purchase marketplace items.' });
      }
      const input = bookingInput(req);
      const resolved = resolveItem(input.itemType, input.itemId, input);
      if (!resolved || !Number.isFinite(resolved.amount) || resolved.amount <= 0) {
        return res.status(404).json({ success: false, message: 'This item is no longer available.' });
      }
      const amount = resolved.amount * (input.itemType === 'product' ? input.travelers : 1);
      const bookingId = `JH-BOOK-${uuidv4().slice(0, 8).toUpperCase()}`;
      const order = await paymentService.createOrder({
        amount, receipt: bookingId,
        notes: { booking_id: bookingId, user_id: req.user.id, item_id: input.itemId }
      });
      const booking = db.bookings.create({
        id: bookingId, user_id: req.user.id, provider_id: resolved.providerId,
        item_type: input.itemType, item_id: input.itemId, item_title: resolved.title,
        travelers: input.travelers, check_in_date: input.checkInDate || new Date().toISOString().split('T')[0],
        check_out_date: input.checkOutDate || null, days: input.days, total_amount: amount,
        escrow_amount: amount, escrow_status: 'locked', contract_address: null,
        contract_tx_hash: null, status: 'payment_pending', cancellation_reason: null,
        delivery_address: input.deliveryAddress ? JSON.stringify(input.deliveryAddress) : null
      });
      db.payments.create({
        id: `pay-${uuidv4().slice(0, 12)}`, booking_id: bookingId, user_id: req.user.id,
        gateway: 'razorpay', gateway_order_id: order.id, gateway_payment_id: null,
        gateway_signature: null, amount, currency: 'INR', status: 'pending'
      });
      res.status(201).json({
        success: true, order: { id: order.id, amount: order.amount, currency: order.currency },
        keyId: paymentService.getPublicKeyId(), booking, payment: db.payments.findByBookingId(bookingId)
      });
    } catch (error) {
      res.status(error.status || 500).json({ success: false, message: error.message });
    }
  },

  async verifyPayment(req, res) {
    try {
      const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
      const payment = db.payments.findByGatewayOrderId(orderId);
      if (!payment || payment.user_id !== req.user.id) {
        return res.status(404).json({ success: false, message: 'Payment order not found.' });
      }
      if (payment.status === 'successful') {
        return res.json({ success: true, message: 'Payment already verified.', booking: db.bookings.findById(payment.booking_id), payment });
      }
      if (!paymentService.verifySignature(orderId, paymentId, signature)) {
        db.payments.updateStatus(payment.id, 'failed', paymentId, signature);
        return res.status(400).json({ success: false, message: 'Invalid Razorpay payment signature.' });
      }
      const booking = db.bookings.findById(payment.booking_id);
      if (!booking || booking.user_id !== req.user.id) return res.status(404).json({ success: false, message: 'Booking not found.' });
      const updated = runTransaction(() => {
        if (booking.item_type === 'product' && !db.products.reserveStock(booking.item_id, booking.travelers)) {
          const error = new Error('This product is out of stock.');
          error.status = 409;
          throw error;
        }
        const bundleItems = sqlite.prepare('SELECT service_id, quantity FROM booking_bundle_items WHERE booking_id = ?').all(booking.id);
        if (bundleItems.length > 0) {
          for (const bundleItem of bundleItems) {
            const service = db.services.findById(bundleItem.service_id);
            if (service?.availability?.availableRooms !== null && service?.availability?.availableRooms !== undefined && !db.services.reserveAvailability(bundleItem.service_id, bundleItem.quantity)) {
              const error = new Error(`No availability remains for ${service.title}.`);
              error.status = 409;
              throw error;
            }
          }
        } else if (booking.item_type !== 'product' && ['guide', 'homestay', 'package', 'restaurant', 'transport'].includes(booking.item_type)) {
          const service = db.services.findById(booking.item_id);
          if (service?.availability?.availableRooms !== null && service?.availability?.availableRooms !== undefined && !db.services.reserveAvailability(booking.item_id, booking.travelers)) {
            const error = new Error('No rooms are available for this booking.');
            error.status = 409;
            throw error;
          }
        }
        db.payments.updateStatus(payment.id, 'successful', paymentId, signature);
        return db.bookings.updateStatus(booking.id, 'confirmed');
      });
      try {
        await emailService.sendBookingConfirmation({ to: req.user.email, name: req.user.name || 'Explorer', booking: updated });
      } catch (emailError) {
        console.warn('Booking email dispatch skipped:', emailError.message);
      }
      if (updated.provider_id) {
        db.notifications.create({
          id: `notif-${Date.now()}`, user_id: updated.provider_id, role: 'vendor',
          title: 'New Paid Booking', message: `Booking #${updated.id} for "${updated.item_title}" has been paid and confirmed.`, type: 'booking'
        });
      }
      res.json({ success: true, message: 'Payment verified and booking confirmed.', booking: updated, payment: db.payments.findById(payment.id) });
    } catch (error) {
      res.status(error.status || 500).json({ success: false, message: error.message });
    }
  }
};
