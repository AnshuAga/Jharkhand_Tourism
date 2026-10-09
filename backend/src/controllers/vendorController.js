import { db } from '../database/db.js';
import { blockchainService } from '../services/blockchainService.js';
import { v4 as uuidv4 } from 'uuid';

export const vendorController = {
  getDashboard(req, res) {
    try {
      const vendorId = req.user.id;
      const user = db.users.findById(vendorId);
      const profile = db.providerProfiles.findByUserId(vendorId);
      const cert = db.certificates.findByProviderId(vendorId);
      const myBookings = db.bookings.findByProviderId(vendorId);
      const myProducts = db.products.findByVendorId(vendorId);
      const myServices = db.services.findByProviderId(vendorId);
      const myReviews = db.reviews.listByTarget('provider', vendorId);
      const notifications = db.notifications.findByUserId(vendorId);
      const verificationRequests = db.verificationRequests.findByProviderId(vendorId);
      const certificateIsValid = cert?.status === 'valid';
      const profileStatus = profile?.verification_status || 'pending';
      const kycStatus = certificateIsValid && profileStatus === 'approved'
        ? 'approved'
        : profileStatus === 'rejected'
          ? 'rejected'
          : 'pending';

      const totalEarned = myBookings
        .filter(b => b.escrow_status === 'released')
        .reduce((sum, b) => sum + (b.total_amount || 0), 0);

      const pendingEscrow = myBookings
        .filter(b => b.escrow_status === 'locked')
        .reduce((sum, b) => sum + (b.total_amount || 0), 0);

      const avgRating = myReviews.length
        ? Math.round((myReviews.reduce((sum, r) => sum + r.rating, 0) / myReviews.length) * 10) / 10
        : 0;

      res.json({
        success: true,
        vendor: {
          id: vendorId,
          name: user?.name,
          email: user?.email,
          phone: user?.phone || '',
          profileImage: user?.profile_image || '',
          role: user?.role,
          providerType: profile?.provider_type || user?.role,
          businessName: profile?.business_name || user?.name,
          district: profile?.district || 'Ranchi',
          address: profile?.address || '',
          state: profile?.state || 'Jharkhand',
          serviceArea: profile?.service_area || 'Statewide',
          specialization: profile?.specialization || 'Tourism Services',
          languages: profile?.languages || [],
          licenseNumber: profile?.license_number || '',
          dailyRate: profile?.daily_rate || 0,
          governmentId: profile?.government_id || '',
          governmentIdType: profile?.government_id_type || '',
          kycStatus,
          verified: kycStatus === 'approved',
          rejectionReason: profile?.rejection_reason
        },
        certificate: cert,
        stats: {
          totalBookings: myBookings.length,
          activeEscrowBookings: myBookings.filter(b => b.escrow_status === 'locked').length,
          pendingEscrowFunds: pendingEscrow,
          totalEarned,
          averageRating: avgRating,
          reviewCount: myReviews.length,
          productsCount: myProducts.length,
          servicesCount: myServices.length
        },
        bookings: myBookings,
        products: myProducts,
        services: myServices,
        reviews: myReviews,
        notifications,
        verificationRequests
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  submitKYC(req, res) {
    try {
      const vendorId = req.user.id;
      const { businessName, category, district, licenseNumber, documents = [], licenseType = 'Aadhar Card' } = req.body;

      if (!businessName || !district) {
        return res.status(400).json({ success: false, message: 'Business name and district are required.' });
      }

      const currentProfile = db.providerProfiles.findByUserId(vendorId);
      const existingCertificate = db.certificates.findByProviderId(vendorId);
      if (existingCertificate?.status === 'valid') {
        if (currentProfile?.verification_status !== 'approved') {
          db.providerProfiles.updateStatus(vendorId, 'approved');
        }
        return res.json({
          success: true,
          message: 'Your KYC is already approved. No new approval request was created.',
          alreadyApproved: true,
          certificate: existingCertificate
        });
      }

      // Upsert provider profile
      const providerType = req.user.role === 'guide' ? 'guide' : 'vendor';
      const allowedCategories = providerType === 'guide' ? ['guide'] : ['homestay', 'package', 'restaurant'];
      if (category && !allowedCategories.includes(String(category).toLowerCase())) {
        return res.status(400).json({ success: false, message: `Invalid category for ${providerType}.` });
      }
      db.providerProfiles.upsert({
        user_id: vendorId,
        provider_type: providerType,
        business_name: businessName,
        license_number: licenseNumber || '',
        district: district,
        address: currentProfile?.address || '',
        state: currentProfile?.state || 'Jharkhand',
        service_area: 'Statewide',
        languages: currentProfile?.languages || [],
        specialization: category || 'Tourism Service',
        government_id: documents.find((document) => /government|aadhar|aadhaar|identity|id/i.test(document.type || ''))?.fileName || currentProfile?.government_id || '',
        government_id_type: documents.find((document) => /government|aadhar|aadhaar|identity|id/i.test(document.type || ''))?.type || currentProfile?.government_id_type || licenseType,
        daily_rate: 0,
        verification_status: 'pending',
        rejection_reason: null,
        payout_details: currentProfile?.payout_details || {}
      });

      // Submit verification request
      const vReq = db.verificationRequests.create({
        id: `vreq-${uuidv4().slice(0, 8)}`,
        provider_id: vendorId,
        status: 'pending',
        documents: documents.length > 0 ? documents : [
          { type: licenseType, fileName: licenseNumber ? `${licenseType}-${licenseNumber}` : `${licenseType.replaceAll(' ', '-')}-Document.pdf`, uploadedAt: new Date().toISOString() }
        ],
        admin_notes: null
      });

      res.json({
        success: true,
        message: 'KYC documents submitted successfully. Verification status is now Pending Admin Review.',
        verificationRequest: vReq
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  updateProfile(req, res) {
    try {
      const vendorId = req.user.id;
      const { governmentDocument, ...profileData } = req.body;
      const updated = db.providerProfiles.upsert({ user_id: vendorId, ...profileData });
      if (governmentDocument?.dataUrl) {
        const existingRequest = db.verificationRequests.findByProviderId(vendorId)[0];
        const existingDocuments = existingRequest?.documents || [];
        const document = {
          ...governmentDocument,
          type: governmentDocument.type || 'Government ID',
          uploadedAt: governmentDocument.uploadedAt || new Date().toISOString()
        };
        db.verificationRequests.updateLatestDocuments(vendorId, [
          ...existingDocuments.filter((item) => !/government|aadhar|aadhaar|identity|id/i.test(item.type || '')),
          document
        ]);
      }
      res.json({ success: true, message: 'Provider profile updated.', profile: updated });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  addService(req, res) {
    try {
      const providerId = req.user.id;
      const { title, description, category, price, district, durationDays, image, amenities, availability = {} } = req.body;

      if (!title || !price || !category) {
        return res.status(400).json({ success: false, message: 'Title, category, and price are required.' });
      }
      const allowedCategories = req.user.role === 'guide' ? ['guide'] : ['homestay', 'package', 'restaurant'];
      if (!allowedCategories.includes(String(category).toLowerCase())) {
        return res.status(400).json({ success: false, message: `This account can only create ${allowedCategories.join(', ')} services.` });
      }

      const newService = db.services.create({
        id: `srv-${uuidv4().slice(0, 8)}`,
        provider_id: providerId,
        title: title.trim(),
        description: description || 'Local tourism experience.',
        category: category.trim(),
        price: Number(price),
        district: district || 'Ranchi',
        duration_days: Number(durationDays) || 1,
        image: image || 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=1000&q=80',
        amenities: amenities || [],
        availability: {
          ...availability,
          roomTypes: Array.isArray(availability.roomTypes) ? availability.roomTypes : [],
          roomType: availability.roomType || null,
          availableRooms: availability.availableRooms === undefined ? null : Math.max(0, Number(availability.availableRooms) || 0)
        },
        is_active: 0,
        approval_status: 'pending'
      });

      res.status(201).json({ success: true, message: 'Service package submitted for admin review.', service: newService });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  confirmServiceCompletion(req, res) {
    try {
      const { bookingId } = req.body;
      if (!bookingId) {
        return res.status(400).json({ success: false, message: 'bookingId is required.' });
      }

      const booking = db.bookings.findById(bookingId);
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Booking not found.' });
      }

      if (booking.provider_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Not authorized to settle this booking.' });
      }

      const confirmedBy = `${req.user.name} (${req.user.role.toUpperCase()})`;
      const result = blockchainService.releaseEscrow(bookingId, confirmedBy);

      // Notify tourist
      db.notifications.create({
        id: `notif-${Date.now()}`,
        user_id: booking.user_id,
        role: 'tourist',
        title: 'Tour Completed & Escrow Settled',
        message: `Your booking #${bookingId} has been confirmed completed. Thank you for traveling with Jharkhand Tourism! Please leave a review.`,
        type: 'success'
      });

      res.json({
        success: true,
        message: 'Service completion confirmed. Escrow payout released to provider.',
        ...result
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
};
