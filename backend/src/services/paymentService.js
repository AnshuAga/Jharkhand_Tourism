import Razorpay from 'razorpay';
import crypto from 'crypto';

let razorpayClient;
let configuredKey;

function getClient() {
  const keyId = String(process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || '').trim();
  if (!keyId || !keySecret) {
    const error = new Error('Razorpay test credentials are not configured on the server.');
    error.status = 503;
    throw error;
  }
  if (!/^rzp_test_[A-Za-z0-9]{14}$/.test(keyId)) {
    const error = new Error('The Razorpay test key ID is invalid. Generate a fresh rzp_test_ key pair in Razorpay Test Mode.');
    error.status = 503;
    throw error;
  }
  if (!razorpayClient || configuredKey !== `${keyId}:${keySecret}`) {
    razorpayClient = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });
    configuredKey = `${keyId}:${keySecret}`;
  }
  return razorpayClient;
}

export const paymentService = {
  getPublicKeyId() {
    getClient();
    return configuredKey.split(':', 1)[0];
  },

  createOrder({ amount, receipt, notes = {} }) {
    return getClient().orders.create({
      amount: Math.round(Number(amount) * 100),
      currency: 'INR',
      receipt: String(receipt).slice(0, 40),
      notes
    });
  },

  verifySignature(orderId, paymentId, signature) {
    if (!orderId || !paymentId || !signature || !process.env.RAZORPAY_KEY_SECRET) return false;
    const expected = crypto.createHmac('sha256', String(process.env.RAZORPAY_KEY_SECRET).trim())
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    const received = Buffer.from(String(signature));
    const expectedBuffer = Buffer.from(expected);
    return received.length === expectedBuffer.length && crypto.timingSafeEqual(expectedBuffer, received);
  }
};
