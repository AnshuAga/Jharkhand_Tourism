import { Router } from 'express';
import { sentimentController } from '../controllers/sentimentController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/analyze', sentimentController.analyze);
// Reviews are tied to the submitting user by a database foreign key.
// Require the same authenticated tourist session used by the review form.
router.post('/review', authenticate, sentimentController.submitReview);
router.get('/reviews', sentimentController.getReviews);
router.get('/analytics', sentimentController.getAnalytics);
router.get('/synthetic-dataset', sentimentController.getSyntheticDataset);
router.put('/reviews/:id', authenticate, sentimentController.updateReview);
router.delete('/reviews/:id', authenticate, sentimentController.deleteReview);

export default router;
