import { arvrService } from '../services/arvrService.js';

export const arvrController = {
  getExperiences(req, res) {
    try {
      const vrTours = arvrService.getVRTours();
      const arLandmarks = arvrService.getARLandmarks();
      res.json({
        success: true,
        vrTours,
        arLandmarks
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};
