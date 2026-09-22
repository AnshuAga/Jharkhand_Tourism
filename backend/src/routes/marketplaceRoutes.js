import { Router } from 'express';
import { marketplaceController } from '../controllers/marketplaceController.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// Public marketplace data
router.get('/', marketplaceController.getMarketplaceData);

// Booking (Requires Authenticated Tourist / User)
router.post('/booking', authenticate, marketplaceController.createBooking);
router.get('/my-bookings', authenticate, marketplaceController.getMyBookings);

// Vendor product management
router.post('/products', authenticate, requireRole('vendor', 'guide', 'admin'), marketplaceController.createProduct);
router.put('/products/:id', authenticate, requireRole('vendor', 'guide', 'admin'), marketplaceController.updateProduct);
router.delete('/products/:id', authenticate, requireRole('vendor', 'guide', 'admin'), marketplaceController.deleteProduct);

export default router;
