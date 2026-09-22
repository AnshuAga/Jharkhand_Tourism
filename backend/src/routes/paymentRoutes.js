import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { paymentController } from '../controllers/paymentController.js';

const router = Router();
router.post('/order', authenticate, paymentController.createOrder);
router.post('/verify', authenticate, paymentController.verifyPayment);
export default router;
