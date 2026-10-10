import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { paymentController } from '../controllers/paymentController.js';

const router = Router();
router.post('/bundle-order', authenticate, requireRole('tourist'), paymentController.createBundleOrder);
router.post('/order', authenticate, requireRole('tourist'), paymentController.createOrder);
router.post('/verify', authenticate, requireRole('tourist'), paymentController.verifyPayment);
export default router;
