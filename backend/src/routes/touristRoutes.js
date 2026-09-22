import { Router } from 'express';
import { touristController } from '../controllers/touristController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

// Protected tourist routes
router.use(authenticate);

router.get('/dashboard', touristController.getDashboard);
router.put('/preferences', touristController.updatePreferences);
router.post('/favourites', touristController.toggleFavourite);
router.get('/favourites', touristController.getFavourites);

export default router;
