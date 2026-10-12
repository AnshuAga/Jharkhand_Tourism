import { Router } from 'express';
import { recommendationController } from '../controllers/recommendationController.js';
import { authenticate, optionalAuthenticate, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', optionalAuthenticate, recommendationController.get);
router.get('/analytics', authenticate, requireRole('admin'), recommendationController.analytics);
router.post('/interactions', authenticate, recommendationController.interact);

export default router;
