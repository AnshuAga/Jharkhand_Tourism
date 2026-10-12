import { db } from '../database/db.js';
import { blockchainService } from '../services/blockchainService.js';
import { sentimentService } from '../services/sentimentService.js';
import { v4 as uuidv4 } from 'uuid';

export const adminController = {
  getReviews(req, res) {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 250);
      const reviews = db.reviews.listAll(limit);
      res.json({ success: true, count: reviews.length, reviews });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
  getReviewIntelligence(req, res) {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 250);
      const status = req.query.status ? String(req.query.status) : undefined;
      const risk = req.query.risk ? String(req.query.risk) : undefined;
      if (status && !['published', 'pending_review', 'rejected'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid review status filter.' });
      }
      if (risk && !['low', 'medium', 'high'].includes(risk)) {
        return res.status(400).json({ success: false, message: 'Invalid risk filter.' });
      }
      const stats = db.reviews.intelligenceStats();
      const reviews = db.reviews.listAll(limit, { status, risk });
      const allFlaggedReviews = db.reviews.listAll(10000);
      res.json({
        success: true,
        stats: {
          totalSubmitted: Number(stats.total || 0),
          published: Number(stats.published || 0),
          pendingReview: Number(stats.pending || 0),
          confirmedFake: Number(stats.rejected || 0),
          suspicious: Number(stats.suspicious || 0),
          duplicateOrPatternFlags: allFlaggedReviews.filter((review) => (review.suspicion_reasons || []).some((reason) => !reason.startsWith('Rating-text mismatch'))).length,
          verifiedSentimentLabels: Number(stats.verified_sentiment || 0),
          verifiedFakeLabels: Number(stats.verified_fake || 0),
          awaitingAnnotation: Number(stats.awaiting_annotation || 0),
          trainingEligible: Number(stats.training_eligible || 0)
        },
        model: {
          currentVersion: 'lexicon-v1',
          detectorVersion: 'rules-v1',
          trainingDatasetSize: Number(stats.training_eligible || 0),
          lastTrainingDate: null,
          evaluation: 'Not enough verified data for retraining.'
        },
        publicationPolicy: sentimentService.getPublicationPolicy(),
        reviews
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
  moderateReview(req, res) {
    try {
      const { status } = req.body || {};
      if (!['published', 'pending_review', 'rejected'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid review status.' });
      }
      const existing = db.reviews.findById(req.params.id);
      if (!existing) return res.status(404).json({ success: false, message: 'Review not found.' });
      const review = db.reviews.updateReviewIntelligence(req.params.id, {
        review_status: status,
        publication_status: status === 'published' ? 'published' : status === 'rejected' ? 'hidden' : 'pending',
        verified_sentiment: existing?.verified_sentiment || null,
        verified_fake_label: existing?.verified_fake_label || null,
        annotation_status: existing?.annotation_status || 'unreviewed',
        annotated_by: existing?.annotated_by || null,
        verified_sentiment_by: existing?.verified_sentiment_by || null,
        verified_sentiment_at: existing?.verified_sentiment_at || null,
        verified_fake_by: existing?.verified_fake_by || null,
        verified_fake_at: existing?.verified_fake_at || null
      });
      if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });
      if (review.target_type === 'destination') sentimentService.refreshDestinationRating(review.target_id);
      return res.json({ success: true, review });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  },
  reanalyzeReview(req, res) {
    try {
      const result = sentimentService.reanalyzeReview(req.params.id);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(error.message === 'Review not found.' ? 404 : 400).json({ success: false, message: error.message });
    }
  },
  annotateReview(req, res) {
    try {
      const { verifiedSentiment, verifiedFakeLabel, note = '' } = req.body || {};
      if (verifiedSentiment !== undefined && !['Positive', 'Neutral', 'Negative', 'Mixed'].includes(verifiedSentiment)) {
        return res.status(400).json({ success: false, message: 'Invalid verified sentiment label.' });
      }
      if (verifiedFakeLabel !== undefined && !['genuine', 'fake'].includes(verifiedFakeLabel)) {
        return res.status(400).json({ success: false, message: 'Invalid verified fake-review label.' });
      }
      const existing = db.reviews.findById(req.params.id);
      if (!existing) return res.status(404).json({ success: false, message: 'Review not found.' });
      const now = new Date().toISOString();
      const sentimentVerification = verifiedSentiment !== undefined;
      const authenticityVerification = verifiedFakeLabel !== undefined;
      const authenticityDecision = verifiedFakeLabel === 'fake'
        ? { review_status: 'rejected', publication_status: 'hidden' }
        : verifiedFakeLabel === 'genuine' && existing.review_status === 'rejected'
          ? { review_status: 'pending_review', publication_status: 'pending' }
          : {};
      const review = db.reviews.updateReviewIntelligence(req.params.id, {
        review_status: authenticityDecision.review_status || existing.review_status || 'published',
        publication_status: authenticityDecision.publication_status || existing.publication_status || 'published',
        verified_sentiment: verifiedSentiment ?? existing.verified_sentiment ?? null,
        verified_fake_label: verifiedFakeLabel ?? existing.verified_fake_label ?? null,
        annotation_status: 'verified',
        annotated_by: req.user.id,
        verified_sentiment_by: sentimentVerification ? req.user.id : (existing.verified_sentiment_by || null),
        verified_sentiment_at: sentimentVerification ? now : (existing.verified_sentiment_at || null),
        verified_fake_by: authenticityVerification ? req.user.id : (existing.verified_fake_by || null),
        verified_fake_at: authenticityVerification ? now : (existing.verified_fake_at || null)
      });
      db.reviews.addAnnotationHistory({
        id: `annotation-${uuidv4().slice(0, 8)}`,
        review_id: req.params.id,
        admin_id: req.user.id,
        verified_sentiment: review.verified_sentiment,
        verified_fake_label: review.verified_fake_label,
        note: String(note).slice(0, 1000)
      });
      return res.json({ success: true, review });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  },
  exportTrainingReviews(req, res) {
    try {
      const seenTexts = new Set();
      const records = db.reviews.listTrainingEligible(10000).filter((review) => {
        const normalized = String(review.review_text || '').toLowerCase().replace(/\s+/g, ' ').trim();
        if (seenTexts.has(normalized)) return false;
        seenTexts.add(normalized);
        return true;
      }).map((review) => ({
        text: review.review_text,
        sentiment: review.verified_sentiment,
        fake_label: review.verified_fake_label,
        source: 'verified_tourist_review',
        model_version: review.model_version
      }));
      res.json({
        success: true,
        format: 'jsonl',
        count: records.length,
        message: records.length ? undefined : 'Not enough verified data for retraining.',
        records
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
  updateReviewPublication(req, res) {
    try {
      const { publicationStatus } = req.body || {};
      if (!['pending', 'published', 'hidden'].includes(publicationStatus)) {
        return res.status(400).json({ success: false, message: 'A valid publication status is required.' });
      }
      const review = db.reviews.updatePublicationStatus(req.params.id, publicationStatus);
      if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });
      if (review.target_type === 'destination') {
        sentimentService.refreshDestinationRating(review.target_id);
      }
      return res.json({ success: true, review });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  },
  deleteReview(req, res) {
    try {
      const review = db.reviews.findById(req.params.id);
      if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });

      db.reviews.delete(req.params.id);
      if (review.target_type === 'destination') {
        sentimentService.refreshDestinationRating(review.target_id);
      }
      return res.json({ success: true, deletedReviewId: req.params.id });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  },
  createService(req, res) {
    try {
      const { title, description, category, price, district, durationDays, image, amenities, availability, isActive = true } = req.body;
      if (!title || !description || !['package', 'guide', 'homestay', 'restaurant'].includes(category) || Number(price) < 0 || !district) {
        return res.status(400).json({ success: false, message: 'Title, description, category, non-negative price, and district are required.' });
      }
      const service = db.services.create({
        id: `service-${uuidv4().slice(0, 8)}`,
        provider_id: req.user.id,
        title: String(title).trim(),
        description: String(description).trim(),
        category,
        price: Number(price),
        district: String(district).trim(),
        duration_days: Math.max(1, Number(durationDays) || 1),
        image: image || null,
        amenities: Array.isArray(amenities) ? amenities : [],
        availability: availability && typeof availability === 'object'
          ? { ...availability, roomTypes: Array.isArray(availability.roomTypes) ? availability.roomTypes : [] }
          : {},
        is_active: isActive ? 1 : 0,
        approval_status: 'approved'
      });
      res.status(201).json({ success: true, service });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
  getServices(req, res) {
    try {
      const services = db.services.listAll({ status: req.query.status || undefined });
      res.json({ success: true, services });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
  reviewService(req, res) {
    try {
      const { status, reason = '' } = req.body;
      if (!['approved', 'rejected', 'changes_requested'].includes(status)) {
        return res.status(400).json({ success: false, message: 'A valid approval decision is required.' });
      }
      const service = db.services.review(req.params.id, status, reason, req.user.id);
      if (!service) return res.status(404).json({ success: false, message: 'Package not found.' });
      db.notifications.create({
        id: `notif-${Date.now()}`,
        user_id: service.provider_id,
        role: 'vendor',
        title: `Tour package ${status}`,
        message: reason || `Your package "${service.title}" was ${status}.`,
        type: status === 'approved' ? 'success' : 'warning'
      });
      res.json({ success: true, service });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },
  /**
   * Analytics KPIs strictly computed from live database records
   */
  getAnalytics(req, res) {
    try {
      const totalTourists = db.users.count({ role: 'tourist' });
      const totalGuides = db.users.count({ role: 'guide' });
      const totalVendors = db.users.count({ role: 'vendor' });
      const verifiedProviders = db.certificates.countValid();
      const totalDestinations = db.destinations.count();
      const totalProducts = db.products.count();

      const bookingStats = db.bookings.stats();
      const sentimentAnalytics = sentimentService.getSentimentAnalytics();
      const destinations = db.destinations.list({ onlyActive: false });
      const recentTransactions = db.blockchainTransactions.listRecent(8);
      const recentBookings = db.bookings.listAll(8);

      // Real destination heatmap based on actual reviews
      const heatmap = destinations.map(d => {
        const dReviews = db.reviews.listByTarget('destination', d.id);
        const avgScore = dReviews.length
          ? Math.round((dReviews.reduce((sum, r) => sum + r.rating, 0) / dReviews.length) * 10) / 10
          : d.rating;

        return {
          id: d.id,
          name: d.name,
          district: d.district,
          visitorScore: Math.round(d.review_count * 10 + (d.crowd_level === 'High' ? 100 : 50)),
          avgRating: avgScore,
          sentiment: avgScore >= 4.5 ? 'Very Positive' : avgScore >= 4.0 ? 'Positive' : 'Needs Attention',
          crowdLevel: d.crowd_level,
          lat: d.lat,
          lng: d.lng
        };
      });

      res.json({
        success: true,
        kpis: {
          totalTourists,
          totalGuides,
          totalVendors,
          verifiedProviders,
          totalDestinations,
          totalProducts,
          totalPlatformBookings: bookingStats.totalBookings || 0,
          grossMarketplaceVolume: bookingStats.grossRevenue || 0,
          escrowFundsProtected: bookingStats.escrowLocked || 0,
          completedBookings: bookingStats.completedBookings || 0,
          cancelledBookings: bookingStats.cancelledBookings || 0
        },
        heatmap,
        sentiment: sentimentAnalytics,
        recentLedgerTransactions: recentTransactions,
        recentBookings
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  getEnquiries(req, res) {
    try {
      const enquiries = db.enquiries.list(Math.min(Number(req.query.limit) || 100, 200));
      res.json({ success: true, count: enquiries.length, enquiries });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  /**
   * User Management: list, search, filter
   */
  getUsers(req, res) {
    try {
      const { role, search, limit = 50, offset = 0 } = req.query;
      const users = db.users.list({ role, search, limit: Number(limit), offset: Number(offset) });
      const total = db.users.count({ role });
      res.json({ success: true, count: users.length, total, users });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  toggleUserStatus(req, res) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      const updated = db.users.toggleActive(id, isActive);
      res.json({ success: true, message: `User status set to ${isActive ? 'Active' : 'Deactivated'}.`, user: updated });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  /**
   * Provider Verification: list pending, approve, reject, revoke
   */
  getVerifications(req, res) {
    try {
      const pending = db.verificationRequests.listPending();
      const providers = db.providerProfiles.list({ limit: 50 }).map((provider) => {
        const request = pending.find((item) => item.provider_id === provider.user_id) ||
          db.verificationRequests.findByProviderId(provider.user_id)[0] || null;
        const certificate = db.certificates.findByProviderId(provider.user_id);
        return {
          ...provider,
          certificate_id: provider.certificate_id || certificate?.certificate_id || null,
          blockchain_tx_hash: provider.blockchain_tx_hash || certificate?.blockchain_tx_hash || null,
          block_number: provider.block_number || certificate?.block_number || null,
          government_id: provider.government_id || request?.documents?.find((document) => /government|aadhar|aadhaar|identity|id/i.test(document.type || ''))?.fileName || null,
          government_id_type: provider.government_id_type || request?.documents?.find((document) => /government|aadhar|aadhaar|identity|id/i.test(document.type || ''))?.type || null,
          verification_request: request
        };
      });
      const certificates = db.certificates.listValid().map((certificate) => ({
        ...certificate,
        certificate_id: certificate.certificate_id || certificate.id || null,
        provider_id: certificate.provider_id || null,
        blockchain_tx_hash: certificate.blockchain_tx_hash || certificate.tx_hash || null
      }));
      res.json({ success: true, pendingCount: pending.length, pending, providers, certificates });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async approveKYC(req, res) {
    try {
      const { providerId, name, category, district, requestId, notes } = req.body;
      if (!providerId || !name) {
        return res.status(400).json({ success: false, message: 'providerId and name are required.' });
      }

      if (requestId) {
        // Mark the request approved only after the on-chain transaction confirms.
      }

      const result = await blockchainService.issueCertificate({
        providerId,
        name,
        category: category || 'Tourist Guide',
        district: district || 'Ranchi',
        issuer: 'Jharkhand Tourism Development Corporation'
      });
      if (requestId) {
        db.verificationRequests.updateStatus(requestId, 'approved', notes || 'Approved by Admin', req.user.id);
      }

      res.status(201).json({
        success: true,
        message: 'Provider KYC approved. Digital Certificate minted with cryptographic proof.',
        ...result
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  rejectKYC(req, res) {
    try {
      const { providerId, requestId, reason = 'Document verification failed.' } = req.body;
      if (!providerId) {
        return res.status(400).json({ success: false, message: 'providerId is required.' });
      }

      if (requestId) {
        db.verificationRequests.updateStatus(requestId, 'rejected', reason, req.user.id);
      }
      db.providerProfiles.updateStatus(providerId, 'rejected', reason);

      db.notifications.create({
        id: `notif-${Date.now()}`,
        user_id: providerId,
        role: 'vendor',
        title: 'KYC Application Update',
        message: `Your verification request was rejected. Reason: ${reason}. Please update your details and resubmit.`,
        type: 'warning'
      });

      res.json({ success: true, message: 'Provider KYC marked as rejected.' });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async revokeKYC(req, res) {
    try {
      const result = await blockchainService.revokeCertificate(req.params.providerId);
      db.providerProfiles.updateStatus(req.params.providerId, 'revoked');
      res.json({ success: true, message: 'Provider certificate revoked on Polygon Amoy.', ...result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  /**
   * Bookings Management
   */
  getBookings(req, res) {
    try {
      const bookings = db.bookings.listAll(100);
      res.json({ success: true, count: bookings.length, bookings });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  /**
   * Payments Management
   */
  getPayments(req, res) {
    try {
      const payments = db.payments.listAll(100);
      const ledger = db.blockchainTransactions.listRecent(50);
      res.json({ success: true, count: payments.length, payments, ledger });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};
