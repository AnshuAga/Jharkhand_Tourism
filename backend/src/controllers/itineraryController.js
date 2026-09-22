import { aiPlannerService } from '../services/aiPlannerService.js';

export const itineraryController = {
  async plan(req, res) {
    try {
      const preferences = req.body || {};
      const plan = await aiPlannerService.generateItinerary(preferences);
      res.json(plan);
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};
