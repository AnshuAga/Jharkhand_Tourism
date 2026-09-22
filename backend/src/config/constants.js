export const JWT_SECRET = process.env.JWT_SECRET || 'jharkhand_smart_tourism_jwt_super_secret_key_2026';
export const PORT = process.env.PORT || 5000;
export const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

export const USER_ROLES = {
  TOURIST: 'tourist',
  VENDOR: 'vendor', // Guide, Homestay host, Artisan
  ADMIN: 'admin'
};

export const CERTIFICATE_STATUS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  REVOKED: 'Revoked'
};

export const ESCROW_STATUS = {
  LOCKED: 'Locked in Escrow',
  RELEASED: 'Released to Provider',
  REFUNDED: 'Refunded to Tourist'
};
