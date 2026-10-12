import { aiPlannerService } from '../services/aiPlannerService.js';
import { searchTrainOptions } from '../services/transportService.js';

export const itineraryController = {
  async plan(req, res) {
    try {
      const preferences = req.body || {};
      const plan = await aiPlannerService.generateItinerary(preferences);
      res.json(plan);
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
  async trainSearch(req, res) {
    try {
      const result = await searchTrainOptions(req.query);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(error.status || 500).json({ success: false, message: error.message });
    }
  }
};
