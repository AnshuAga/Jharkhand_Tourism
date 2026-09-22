import { authService } from '../services/authService.js';

export const authController = {
  async register(req, res) {
    try {
      const { name, email, phone, password, confirmPassword, role, ...extra } = req.body;
      const result = await authService.register({
        name,
        email,
        phone,
        password,
        confirmPassword,
        role,
        additionalData: extra
      });
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async verifyEmailOTP(req, res) {
    try {
      const { email, otp, type = 'registration' } = req.body;
      const result = await authService.verifyEmailOTP({ email, otp, type });
      res.json(result);
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async resendOTP(req, res) {
    try {
      const { email, type = 'registration' } = req.body;
      const result = await authService.resendOTP({ email, type });
      res.json(result);
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async requestLoginOTP(req, res) {
    try {
      const { email } = req.body;
      const result = await authService.requestLoginOTP({ email });
      res.json(result);
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async login(req, res) {
    try {
      const { email, password, role } = req.body;
      const result = await authService.login({ email, password, role });
      res.json(result);
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      const result = await authService.forgotPassword({ email });
      res.json(result);
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async resetPassword(req, res) {
    try {
      const { email, otp, newPassword } = req.body;
      const result = await authService.resetPassword({ email, otp, newPassword });
      res.json(result);
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async getMe(req, res) {
    try {
      const profile = await authService.getUserProfile(req.user.id);
      if (!profile) {
        return res.status(404).json({ success: false, message: 'User account not found.' });
      }
      res.json({ success: true, user: profile });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async updateProfile(req, res) {
    try {
      const profile = await authService.updateProfile(req.user.id, req.body);
      res.json({ success: true, message: 'Profile updated successfully.', user: profile });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
      res.json(result);
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
};
