import { Router } from 'express';
import { arvrController } from '../controllers/arvrController.js';

const router = Router();

router.get('/experiences', arvrController.getExperiences);

export default router;
