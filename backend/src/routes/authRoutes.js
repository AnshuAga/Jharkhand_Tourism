import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

// Rate limiter for OTP requests (max 10 requests per 15 minutes per IP)
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many verification requests. Please try again in 15 minutes.' }
});

// Rate limiter for login (max 20 attempts per 15 minutes per IP)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' }
});

router.post('/register', otpLimiter, authController.register);
router.post('/verify-email-otp', authController.verifyEmailOTP);
router.post('/resend-otp', otpLimiter, authController.resendOTP);
router.post('/request-login-otp', otpLimiter, authController.requestLoginOTP);
router.post('/login', loginLimiter, authController.login);
router.post('/forgot-password', otpLimiter, authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/me', authenticate, authController.getMe);
router.put('/profile', authenticate, authController.updateProfile);
router.put('/change-password', authenticate, authController.changePassword);

export default router;
