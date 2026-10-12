import { Router } from 'express';
import { adminController } from '../controllers/adminController.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// Protected admin routes
router.use(authenticate);
router.use(requireRole('admin'));

// Analytics
router.get('/analytics', adminController.getAnalytics);
router.get('/enquiries', adminController.getEnquiries);
router.post('/services', adminController.createService);
router.get('/services', adminController.getServices);
router.put('/services/:id/review', adminController.reviewService);

// User Management
router.get('/users', adminController.getUsers);
router.put('/users/:id/status', adminController.toggleUserStatus);

// Provider KYC Verification
router.get('/verifications', adminController.getVerifications);
router.post('/kyc/approve', adminController.approveKYC);
router.post('/kyc/reject', adminController.rejectKYC);
router.post('/guides/:providerId/revoke', adminController.revokeKYC);

// Bookings & Payments Oversight
router.get('/bookings', adminController.getBookings);
router.get('/payments', adminController.getPayments);
router.get('/reviews', adminController.getReviews);
router.get('/reviews/intelligence', adminController.getReviewIntelligence);
router.get('/reviews/training-export', adminController.exportTrainingReviews);
router.put('/reviews/:id/moderation', adminController.moderateReview);
router.post('/reviews/:id/detection', adminController.reanalyzeReview);
router.put('/reviews/:id/annotation', adminController.annotateReview);
router.put('/reviews/:id/publication', adminController.updateReviewPublication);
router.delete('/reviews/:id', adminController.deleteReview);

export default router;
