import { Router } from 'express';
import { transportController } from '../controllers/transportController.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// Public routes
router.get('/map-config', transportController.getMapConfig);
router.get('/live', transportController.getLiveVehicles);
router.get('/nearby', transportController.getNearby);
router.get('/route', transportController.getRoute);
router.get('/alerts', transportController.getAlerts);

// Driver/Provider telemetry push (IoT devices / mobile GPS / driver ping)
router.post('/driver/telemetry', transportController.updateTelemetry);

// Admin-only broadcast
router.post('/alerts', authenticate, requireRole('admin'), transportController.createAlert);
router.delete('/alerts/:id', authenticate, requireRole('admin'), transportController.deleteAlert);

export default router;
