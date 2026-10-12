import { sentimentService } from '../services/sentimentService.js';
import { db } from '../database/db.js';

export const sentimentController = {
  analyze(req, res) {
    try {
      const { text, rating } = req.body;
      if (typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ success: false, message: 'Review text is required.' });
      }
      if (text.length > 5000) {
        return res.status(400).json({ success: false, message: 'Review text must be 5000 characters or fewer.' });
      }
      const analysis = sentimentService.analyzeText(text, rating);
      res.json({ success: true, ...analysis });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  submitReview(req, res) {
    try {
      const { bookingId, destinationId, destinationName, providerId, productId, productName, serviceId, serviceName, rating, reviewText } = req.body;
      if (typeof reviewText !== 'string' || !reviewText.trim()) {
        return res.status(400).json({ success: false, message: 'Review text is required.' });
      }
      if (reviewText.length > 5000) {
        return res.status(400).json({ success: false, message: 'Review text must be 5000 characters or fewer.' });
      }
      const numRating = Number(rating);
      if (!Number.isFinite(numRating) || numRating < 1 || numRating > 5) {
        return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5.' });
      }
      if (destinationId && !db.destinations.findById(destinationId)) {
        return res.status(400).json({ success: false, message: 'Selected destination was not found.' });
      }
      if (productId && !db.products.findById(productId)) {
        return res.status(400).json({ success: false, message: 'Selected product was not found.' });
      }
      if (serviceId && !db.services.findById(serviceId)) {
        return res.status(400).json({ success: false, message: 'Selected package or service was not found.' });
      }
      if (productId) {
        const booking = bookingId ? db.bookings.findById(bookingId) : null;
        if (!bookingId || !booking || booking.user_id !== req.user.id || booking.item_type !== 'product' || booking.item_id !== productId) {
          return res.status(403).json({ success: false, message: 'A matching product order owned by your account is required.' });
        }
        if (booking.status !== 'completed') {
          return res.status(400).json({ success: false, message: 'Product reviews are available after the order is completed.' });
        }
        if (db.reviews.findByBookingId(bookingId)) {
          return res.status(409).json({ success: false, message: 'This product order already has a review.' });
        }
      }
      if (serviceId) {
        const booking = bookingId ? db.bookings.findById(bookingId) : null;
        if (!booking || booking.user_id !== req.user.id || booking.item_id !== serviceId ||
          !['package', 'guide', 'homestay', 'restaurant', 'transport'].includes(booking.item_type)) {
          return res.status(403).json({ success: false, message: 'A matching completed service booking owned by your account is required.' });
        }
        if (booking.status !== 'completed') {
          return res.status(400).json({ success: false, message: 'Service reviews are available after the booking is completed.' });
        }
        if (db.reviews.findByBookingId(bookingId)) {
          return res.status(409).json({ success: false, message: 'This booking already has a review.' });
        }
      }
      if (!destinationId && !providerId && !productId && !serviceId) {
        return res.status(400).json({ success: false, message: 'A destination, product, or provider is required.' });
      }
      if (bookingId && !db.bookings.findById(bookingId)) {
        return res.status(400).json({ success: false, message: 'Booking was not found.' });
      }

      const userId = req.user.id;
      const userName = req.user.name;

      const result = sentimentService.submitReview({
        bookingId,
        destinationId,
        destinationName,
        providerId,
        productId,
        productName,
        serviceId,
        serviceName,
        userId,
        userName,
        rating: numRating,
        reviewText: reviewText.trim()
      });

      res.status(201).json(result);
    } catch (error) {
      const status = error.message.startsWith('Duplicate review submission') ? 409 : 500;
      res.status(status).json({ success: false, message: error.message });
    }
  },

  getReviews(req, res) {
    try {
      const targetType = String(req.query.targetType || 'destination').trim();
      const targetId = String(req.query.targetId || req.query.destinationId || '').trim();
      if (!['destination', 'product', 'service'].includes(targetType) || !targetId ||
        (targetType === 'destination' ? !db.destinations.findById(targetId) :
          targetType === 'product' ? !db.products.findById(targetId) : !db.services.findById(targetId))) {
        return res.status(400).json({ success: false, message: `A valid ${targetType} ID is required.` });
      }
      const sort = String(req.query.sort || 'newest');
      if (!['newest', 'oldest', 'highest', 'lowest'].includes(sort)) {
        return res.status(400).json({ success: false, message: 'Invalid review sort.' });
      }
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 5);
      const rating = req.query.rating === undefined || req.query.rating === '' ? undefined : Number(req.query.rating);
      if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50 ||
        (rating !== undefined && (!Number.isInteger(rating) || rating < 1 || rating > 5))) {
        return res.status(400).json({ success: false, message: 'Invalid review pagination or rating filter.' });
      }
      const result = db.reviews.listPublic({ targetType, targetId, sort, rating, page, limit });
      const publishedReviews = db.reviews.listByTarget(targetType, targetId, { publishedOnly: true })
        .filter((review) => review.verified_fake_label !== 'fake');
      const averageRating = publishedReviews.length
        ? Math.round((publishedReviews.reduce((sum, review) => sum + Number(review.rating), 0) / publishedReviews.length) * 10) / 10
        : 0;
      return res.json({
        success: true,
        targetType,
        targetId,
        reviews: result.reviews,
        pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
        summary: {
          totalReviews: publishedReviews.length,
          averageRating,
          ratingDistribution: Object.fromEntries([1, 2, 3, 4, 5].map((value) => [
            value,
            publishedReviews.filter((review) => Number(review.rating) === value).length
          ]))
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  getAnalytics(req, res) {
    try {
      const analytics = sentimentService.getSentimentAnalytics(req.query.destinationId);
      res.json({ success: true, ...analytics });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  getSyntheticDataset(req, res) {
    try {
      const { sampleId } = req.query;
      res.json({
        success: true,
        dataset: sentimentService.getSyntheticDatasetMetadata(),
        samples: sentimentService.getSyntheticDatasetSamples(sampleId)
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
  ,
  updateReview(req, res) {
    try {
      res.json(sentimentService.updateReview(req.params.id, { userId: req.user.id, ...req.body }));
    } catch (error) {
      res.status(error.message === 'Review not found.' ? 404 : 400).json({ success: false, message: error.message });
    }
  },

  deleteReview(req, res) {
    try {
      res.json(sentimentService.deleteReview(req.params.id, req.user.id));
    } catch (error) {
      res.status(error.message === 'Review not found.' ? 404 : 403).json({ success: false, message: error.message });
    }
  }
};
