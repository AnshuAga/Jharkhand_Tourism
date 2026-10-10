import { Router } from 'express';
import { itineraryController } from '../controllers/itineraryController.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/plan', authenticate, requireRole('tourist'), itineraryController.plan);

export default router;
