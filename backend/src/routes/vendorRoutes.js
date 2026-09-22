import { Router } from 'express';
import { vendorController } from '../controllers/vendorController.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// Protected vendor / guide routes
router.use(authenticate);
router.use(requireRole('vendor', 'guide', 'admin'));

router.get('/dashboard', vendorController.getDashboard);
router.post('/kyc', vendorController.submitKYC);
router.put('/profile', vendorController.updateProfile);
router.post('/services', vendorController.addService);
router.post('/confirm-service', vendorController.confirmServiceCompletion);

export default router;
