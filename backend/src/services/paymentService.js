import Razorpay from 'razorpay';
import crypto from 'crypto';

let razorpayClient;

function getClient() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    const error = new Error('Razorpay is not configured on the server.');
    error.status = 503;
    throw error;
  }
  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }
  return razorpayClient;
}

export const paymentService = {
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
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    const received = Buffer.from(String(signature));
    const expectedBuffer = Buffer.from(expected);
    return received.length === expectedBuffer.length && crypto.timingSafeEqual(expectedBuffer, received);
  }
};
