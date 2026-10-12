import { db, sqlite } from '../database/db.js';
import { emailService } from '../services/emailService.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

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

export const marketplaceController = {
  getMarketplaceData(req, res) {
    try {
      const { category, district, search } = req.query;
      const products = db.products.list({ category, district, search });
      const services = db.services.list({ category, district });
      const certificates = db.certificates.listValid();

      // Separate services into guides, homestays, packages
      const guides = services.filter(s => s.category === 'guide');
      const homestays = services.filter(s => s.category === 'homestay');
      const packages = services.filter(s => s.category === 'package');

      res.json({
        success: true,
        products,
        services,
        guides,
        homestays,
        packages,
        verifiedCertificatesCount: certificates.length
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async createBooking(req, res) {
    try {
      const {
        itemType = 'product',
        itemId,
        title,
        providerId,
        totalAmount,
        travelers = 1,
        checkInDate,
        checkOutDate,
        days = 1,
        deliveryAddress,
        paymentGateway = 'escrow'
      } = req.body;

      if (!itemId && (!title || !totalAmount)) {
        return res.status(400).json({ success: false, message: 'A valid item or booking title and amount are required.' });
      }

      const touristId = req.user.id;
      if (['guide', 'vendor'].includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Guides and vendors can browse the marketplace but cannot purchase products.' });
      }
      const normalizedDeliveryAddress = normalizeDeliveryAddress(deliveryAddress);
      if (itemType === 'product' && !normalizedDeliveryAddress) {
        return res.status(400).json({ success: false, message: 'A complete delivery location is required for craft orders.' });
      }
      const touristName = req.user.name || 'Explorer';
      const touristEmail = req.user.email;
      let item = null;
      let resolvedProviderId = itemId ? (providerId || null) : touristId;
      let resolvedTitle = title;
      let resolvedAmount = Number(totalAmount);
      let stockReserved = false;

      if (itemType === 'product') {
        item = db.products.findById(itemId);
        if (!item || !item.is_active || item.approval_status !== 'approved') {
          return res.status(404).json({ success: false, message: 'This marketplace product is no longer available.' });
        }
        stockReserved = db.products.reserveStock(item.id);
        if (!stockReserved) {
          return res.status(409).json({ success: false, message: 'This product is out of stock.' });
        }
        resolvedProviderId = item.vendor_id;
        resolvedTitle = item.name;
        resolvedAmount = item.price;
      } else if (['guide', 'homestay', 'package', 'restaurant', 'transport'].includes(itemType)) {
        item = db.services.findById(itemId);
        if (!item || !item.is_active || item.approval_status !== 'approved' || item.category !== itemType) {
          return res.status(404).json({ success: false, message: 'This tourism package is no longer available.' });
        }
        resolvedProviderId = item.provider_id;
        resolvedTitle = item.title;
        resolvedAmount = item.price;
        if (item.availability?.availableRooms !== null && item.availability?.availableRooms !== undefined && Number(item.availability.availableRooms) < Math.max(1, Number(travelers) || 1)) {
          return res.status(409).json({ success: false, message: 'No rooms are available for this booking.' });
        }
        if (item.availability?.availableRooms !== null && item.availability?.availableRooms !== undefined && !db.services.reserveAvailability(item.id, Math.max(1, Number(travelers) || 1))) {
          return res.status(409).json({ success: false, message: 'The available rooms were just booked. Please try again.' });
        }
      }

      if (!resolvedProviderId || !db.users.findById(resolvedProviderId)) {
        return res.status(400).json({ success: false, message: 'The selected item has no valid owner.' });
      }
      if (!Number.isFinite(resolvedAmount) || resolvedAmount <= 0) {
        return res.status(400).json({ success: false, message: 'The booking amount must be greater than zero.' });
      }
      if (paymentGateway !== 'escrow') {
        return res.status(400).json({ success: false, message: 'The selected payment gateway is not available.' });
      }

      const bookingId = `JH-BOOK-${Math.floor(1000 + Math.random() * 9000)}`;

      // Generate Cryptographic Contract & Escrow Hash
      const contractAddress = '0x' + crypto.createHash('sha256').update(bookingId + Date.now()).digest('hex').slice(0, 40);
      const contractTxHash = '0x' + crypto.createHash('sha256').update(contractAddress + resolvedAmount).digest('hex');

      let newBooking;
      try {
        newBooking = db.bookings.create({
          id: bookingId,
          user_id: touristId,
          provider_id: resolvedProviderId,
          item_type: itemType,
          item_id: itemId || `item-${Date.now()}`,
          item_title: resolvedTitle,
          travelers: Number(travelers) || 1,
          check_in_date: checkInDate || new Date().toISOString().split('T')[0],
          check_out_date: checkOutDate || null,
          days: Number(days) || 1,
          total_amount: resolvedAmount,
          escrow_amount: resolvedAmount,
          escrow_status: 'locked',
          contract_address: contractAddress,
          contract_tx_hash: contractTxHash,
          status: 'confirmed',
          cancellation_reason: null,
          delivery_address: itemType === 'product' ? JSON.stringify(normalizedDeliveryAddress) : null
        });
      } catch (error) {
        if (stockReserved) db.products.restoreStock(item.id);
        if (item && itemType !== 'product' && item.availability?.availableRooms !== null && item.availability?.availableRooms !== undefined) {
          const current = db.services.findById(item.id);
          const restored = { ...current.availability, availableRooms: Number(current.availability?.availableRooms || 0) + Math.max(1, Number(travelers) || 1) };
          sqlite.prepare('UPDATE services SET availability = ? WHERE id = ?').run(JSON.stringify(restored), item.id);
        }
        throw error;
      }

      // Record blockchain transaction log
      db.blockchainTransactions.create({
        id: `tx-${Date.now()}`,
        tx_hash: contractTxHash,
        contract_address: contractAddress,
        action: 'ESCROW_DEPOSIT',
        from_address: touristId,
        to_address: resolvedProviderId,
        payload: {
          bookingId,
          amount: resolvedAmount,
          itemTitle: resolvedTitle,
          ownerId: resolvedProviderId
        },
        status: 'confirmed',
        block_number: 10429
      });

      db.payments.create({
        id: `pay-${uuidv4().slice(0, 8)}`,
        booking_id: bookingId,
        user_id: touristId,
        gateway: paymentGateway,
        gateway_order_id: contractAddress,
        gateway_payment_id: contractTxHash,
        gateway_signature: null,
        amount: resolvedAmount,
        currency: 'INR',
        status: 'successful'
      });

      // Send confirmation email
      try {
        await emailService.sendBookingConfirmation({
          to: touristEmail,
          name: touristName,
          booking: newBooking
        });
      } catch (err) {
        console.warn('Booking email dispatch skipped:', err.message);
      }

      // Notify provider if known
      if (resolvedProviderId !== touristId) {
        db.notifications.create({
          id: `notif-${Date.now()}`,
          user_id: resolvedProviderId,
          role: 'vendor',
          title: 'New Booking Secured in Escrow',
          message: `Booking #${bookingId} for "${resolvedTitle}" (₹${resolvedAmount}) has been confirmed and locked in escrow.`,
          type: 'booking'
        });
      }

      res.status(201).json({
        success: true,
        message: 'Booking placed and funds secured via Smart Contract Escrow.',
        booking: newBooking,
        payment: db.payments.findByBookingId(bookingId),
        ownerId: resolvedProviderId
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  getMyBookings(req, res) {
    try {
      const userId = req.user.id;
      const bookings = db.bookings.findByUserId(userId);
      res.json({ success: true, count: bookings.length, bookings });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Vendor product management
  createProduct(req, res) {
    try {
      const vendorId = req.user.id;
      const { name, description, category, price, stock, district, material, image, badge } = req.body;

      if (req.user.role === 'guide') {
        return res.status(403).json({ success: false, message: 'Guide accounts cannot add crafts or marketplace products.' });
      }

      if (!name || !price || !category) {
        return res.status(400).json({ success: false, message: 'Product name, category, and price are required.' });
      }

      // Check vendor profile verification
      const profile = db.providerProfiles.findByUserId(vendorId);
      const isApproved = profile?.verification_status === 'approved' || profile?.verification_status === 'verified' || req.user.role === 'admin' || req.user.role === 'vendor';

      const newProduct = db.products.create({
        id: `prod-${uuidv4().slice(0, 8)}`,
        vendor_id: vendorId,
        name: name.trim(),
        description: description || 'Handcrafted Jharkhand indigenous product.',
        category: category.trim(),
        price: Number(price),
        stock: Number(stock) || 1,
        district: district || profile?.district || 'Ranchi',
        material: material || 'Traditional',
        image: image || 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Bamboo_Basket_of_Jharkhand.jpg',
        badge: badge || 'Handcrafted',
        is_active: 1,
        approval_status: isApproved ? 'approved' : 'pending'
      });

      res.status(201).json({
        success: true,
        message: isApproved
          ? 'Product created and instantly published to the marketplace.'
          : 'Product created and submitted for administrative approval.',
        product: newProduct
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  updateProduct(req, res) {
    try {
      const { id } = req.params;
      const product = db.products.findById(id);

      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found.' });
      }

      if (product.vendor_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Not authorized to edit this product.' });
      }

      const updated = db.products.update(id, req.body);
      res.json({ success: true, message: 'Product updated successfully.', product: updated });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  deleteProduct(req, res) {
    try {
      const { id } = req.params;
      const product = db.products.findById(id);

      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found.' });
      }

      if (product.vendor_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Not authorized to delete this product.' });
      }

      db.products.delete(id);
      res.json({ success: true, message: 'Product deleted successfully.' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};
