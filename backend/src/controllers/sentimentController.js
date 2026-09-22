import { sentimentService } from '../services/sentimentService.js';
import { db } from '../database/db.js';

export const sentimentController = {
  analyze(req, res) {
    try {
      const { text, rating } = req.body;
      const analysis = sentimentService.analyzeText(text, rating);
      res.json({ success: true, ...analysis });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  submitReview(req, res) {
    try {
      const { bookingId, destinationId, destinationName, providerId, rating, reviewText } = req.body;
      if (!reviewText) {
        return res.status(400).json({ success: false, message: 'Review text is required.' });
      }

      const userId = req.user?.id || 'usr-tourist-anon';
      const userName = req.user?.name || 'Explorer';

      const result = sentimentService.submitReview({
        bookingId,
        destinationId,
        destinationName,
        providerId,
        userId,
        userName,
        rating: Number(rating) || 5,
        reviewText
      });

      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  getReviews(req, res) {
    try {
      const { destinationId, providerId } = req.query;
      let reviews = [];
      if (destinationId) {
        reviews = db.reviews.listByTarget('destination', destinationId);
      } else if (providerId) {
        reviews = db.reviews.listByTarget('provider', providerId);
      } else {
        reviews = db.reviews.listAll(50);
      }
      res.json({ success: true, count: reviews.length, reviews });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  getAnalytics(req, res) {
    try {
      const analytics = sentimentService.getSentimentAnalytics();
      res.json({ success: true, ...analytics });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};
