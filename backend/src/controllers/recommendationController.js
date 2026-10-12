import { recommendationService } from '../services/recommendationService.js';
import { db } from '../database/db.js';

export const recommendationController = {
  get(req, res) {
    try {
      if (req.user && ['admin', 'guide', 'vendor'].includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Tourist recommendations are not available for this role.' });
      }
      const profile = req.user?.role === 'tourist' ? db.touristProfiles.findByUserId(req.user.id) : null;
      const input = { ...profile, ...req.query };
      if (!req.query.interests && profile?.interests) input.interests = profile.interests;
      return res.json(recommendationService.getRecommendations(input));
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  analytics(req, res) {
    try {
      return res.json(recommendationService.getAnalytics());
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  interact(req, res) {
    try {
      const { recommendationId, recommendationType, action } = req.body || {};
      if (!recommendationId || !recommendationType || !action) {
        return res.status(400).json({ success: false, message: 'recommendationId, recommendationType, and action are required.' });
      }
      recommendationService.recordInteraction({
        userId: req.user.id,
        recommendationId,
        recommendationType,
        action
      });
      return res.status(201).json({ success: true });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
};
