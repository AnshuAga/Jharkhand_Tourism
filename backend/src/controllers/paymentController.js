import { v4 as uuidv4 } from 'uuid';
import { db, runTransaction, sqlite } from '../database/db.js';
import { paymentService } from '../services/paymentService.js';
import { emailService } from '../services/emailService.js';

const purchasableTypes = new Set(['product', 'guide', 'homestay', 'package', 'restaurant', 'transport', 'destination']);

function resolveItem(itemType, itemId) {
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
  if (!item || !item.is_active || item.approval_status !== 'approved' || item.category !== itemType) return null;
  return { item, title: item.title, amount: Number(item.price), providerId: item.provider_id };
}

function bookingInput(req) {
  const {
    itemType = 'product', itemId, travelers = 1, checkInDate, checkOutDate, days = 1
  } = req.body;
  if (!itemId || !purchasableTypes.has(itemType)) {
    const error = new Error('A valid marketplace item or destination is required.');
    error.status = 400;
    throw error;
  }
  const count = Math.max(1, Number(travelers) || 1);
  return { itemType, itemId, travelers: count, checkInDate, checkOutDate, days: Math.max(1, Number(days) || 1) };
}

export const paymentController = {
  async createBundleOrder(req, res) {
    try {
      if (['guide', 'vendor'].includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Guides and vendors cannot purchase marketplace items.' });
      }
      const { items = [], travelers = 1, checkInDate, checkOutDate, days = 1 } = req.body;
      const serviceIds = Array.from(new Set(items.map((item) => item.serviceId).filter(Boolean)));
      if (!serviceIds.length) return res.status(400).json({ success: false, message: 'Select at least one guide, hotel, or package.' });
      const resolvedItems = serviceIds.map((serviceId) => {
        const service = db.services.findById(serviceId);
        if (!service || !service.is_active || service.approval_status !== 'approved') {
          throw Object.assign(new Error('One of the selected services is no longer available.'), { status: 404 });
        }
        return service;
      });
      const totalAmount = resolvedItems.reduce((sum, service) => sum + Number(service.price || 0) * (service.category === 'homestay' ? Math.max(1, Number(days) || 1) : service.category === 'guide' ? Math.max(1, Number(days) || 1) : 1), 0);
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
        sqlite.prepare('INSERT INTO booking_bundle_items (booking_id, service_id, quantity) VALUES (?, ?, ?)').run(bookingId, service.id, 1);
      }
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
        bundledServices: resolvedItems.map((service) => ({ id: service.id, title: service.title, category: service.category, price: service.price }))
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
      const resolved = resolveItem(input.itemType, input.itemId);
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
        contract_tx_hash: null, status: 'payment_pending', cancellation_reason: null
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
            if (service?.availability?.availableRooms !== null && service?.availability?.availableRooms !== undefined && !db.services.reserveAvailability(bundleItem.service_id, bundleItem.quantity * booking.travelers)) {
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
