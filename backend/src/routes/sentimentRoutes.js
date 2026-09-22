import { Router } from 'express';
import { sentimentController } from '../controllers/sentimentController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/analyze', sentimentController.analyze);
router.post('/review', sentimentController.submitReview); // guest or logged-in
router.get('/reviews', sentimentController.getReviews);
router.get('/analytics', sentimentController.getAnalytics);

export default router;
