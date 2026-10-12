import { Router } from 'express';
import { itineraryController } from '../controllers/itineraryController.js';
import { itineraryDraftController } from '../controllers/itineraryDraftController.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/plan', authenticate, requireRole('tourist'), itineraryController.plan);
router.get('/trains', authenticate, requireRole('tourist'), itineraryController.trainSearch);
router.get('/drafts', authenticate, requireRole('tourist'), itineraryDraftController.list);
router.post('/drafts', authenticate, requireRole('tourist'), itineraryDraftController.create);
router.put('/drafts/:id', authenticate, requireRole('tourist'), itineraryDraftController.update);
router.delete('/drafts/:id', authenticate, requireRole('tourist'), itineraryDraftController.remove);

export default router;
