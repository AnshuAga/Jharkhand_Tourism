import { Router } from 'express';
import { itineraryController } from '../controllers/itineraryController.js';

const router = Router();

router.post('/plan', itineraryController.plan);

export default router;
