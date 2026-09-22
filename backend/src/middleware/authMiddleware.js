import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/constants.js';
import { db } from '../database/db.js';

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required. Missing Bearer token.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.users.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ success: false, message: 'User session invalid. Account no longer exists.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated.' });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      is_email_verified: user.is_email_verified
    };
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired authentication token.' });
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized. User not authenticated.' });
    }

    // Role mapping: Guide can access vendor endpoints if authorized
    const userRole = req.user.role;
    const isAllowed = allowedRoles.includes(userRole) || (allowedRoles.includes('vendor') && userRole === 'guide');

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. Role '${userRole}' is not authorized. Requires: ${allowedRoles.join(', ')}`
      });
    }
    next();
  };
}
