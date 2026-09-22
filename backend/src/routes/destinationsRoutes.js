import { Router } from 'express';
import { destinationsController } from '../controllers/destinationsController.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// Public destination discovery
router.get('/', destinationsController.getAll);
router.get('/:id', destinationsController.getById);

// Admin-only destination management
router.post('/', authenticate, requireRole('admin'), destinationsController.create);
router.put('/:id', authenticate, requireRole('admin'), destinationsController.update);
router.delete('/:id', authenticate, requireRole('admin'), destinationsController.delete);

export default router;
