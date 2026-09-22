import { Router } from 'express';
import { blockchainController } from '../controllers/blockchainController.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// Public verification
router.post('/verify', blockchainController.verify);
router.get('/verify/:id', blockchainController.verify);
router.get('/certificates', blockchainController.getAllCertificates);
router.get('/ledger', authenticate, blockchainController.getLedger);

// Escrow settlement & refunds
router.post('/escrow/release', authenticate, blockchainController.releaseEscrow);
router.post('/escrow/refund', authenticate, blockchainController.refundEscrow);

// Admin-only certificate issuance
router.post('/issue', authenticate, requireRole('admin'), blockchainController.issueCertificate);

export default router;
