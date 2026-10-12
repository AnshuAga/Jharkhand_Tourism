import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after, before } from 'node:test';
import jwt from 'jsonwebtoken';

const databasePath = path.join(os.tmpdir(), `jharkhand-payment-${process.pid}.db`);
process.env.SQLITE_DB_PATH = databasePath;
process.env.RAZORPAY_KEY_ID = 'rzp_test_12345678901234';
process.env.RAZORPAY_KEY_SECRET = 'isolated-test-secret';

const { db, sqlite } = await import('../src/database/db.js');
const { paymentService } = await import('../src/services/paymentService.js');
const paymentRoutes = (await import('../src/routes/paymentRoutes.js')).default;
const { JWT_SECRET } = await import('../src/config/constants.js');

let server;
let baseUrl;
let orderSequence = 0;
let failOrderCreation = false;
const originalCreateOrder = paymentService.createOrder;

function tokenFor(userId) {
  return jwt.sign({ id: userId }, JWT_SECRET);
}

async function request(pathname, body, userId, headers = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenFor(userId)}`,
      ...headers
    },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

function validBundle(key = `request-${Date.now()}`) {
  return {
    items: [{ serviceId: 'payment-hotel' }],
    travelers: 2,
    days: 3,
    rooms: 1,
    checkInDate: '2099-10-12',
    checkOutDate: '2099-10-14',
    key
  };
}

function signature(orderId, paymentId = 'pay_test_123') {
  return crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

before(async () => {
  sqlite.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, is_email_verified)
    VALUES
      ('payment-tourist', 'Payment Tourist', 'payment-tourist@test.invalid', 'test', 'tourist', 1),
      ('payment-other', 'Other Tourist', 'payment-other@test.invalid', 'test', 'tourist', 1),
      ('payment-guide', 'Payment Guide', 'payment-guide@test.invalid', 'test', 'guide', 1)
  `).run();
  sqlite.prepare(`
    INSERT INTO provider_profiles (user_id, provider_type, business_name, district, verification_status)
    VALUES ('payment-guide', 'homestay', 'Payment Stay', 'Ranchi', 'approved')
  `).run();
  sqlite.prepare(`
    INSERT INTO services
      (id, provider_id, title, description, category, price, district, availability, is_active, approval_status)
    VALUES
      ('payment-hotel', 'payment-guide', 'Payment Test Hotel', 'Isolated test hotel', 'homestay', 1000, 'Ranchi', ?, 1, 'approved')
  `).run(JSON.stringify({ availableRooms: 1 }));

  paymentService.createOrder = async ({ amount, receipt }) => {
    if (failOrderCreation) throw new Error('mock gateway unavailable');
    orderSequence += 1;
    return { id: `order_test_${orderSequence}`, amount: Math.round(amount * 100), currency: 'INR', receipt };
  };

  const app = express();
  app.use(express.json());
  app.use('/api/payments', paymentRoutes);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test('creates a pending booking and payment without marking it paid', async () => {
  const result = await request('/api/payments/bundle-order', validBundle('create-pending'), 'payment-tourist', {
    'X-Idempotency-Key': 'create-pending'
  });
  assert.equal(result.status, 201);
  assert.equal(result.body.booking.status, 'payment_pending');
  assert.equal(result.body.payment.status, 'pending');
  assert.notEqual(result.body.booking.status, 'confirmed');
});

test('rejects invalid booking input before creating a gateway order', async () => {
  const beforeOrders = orderSequence;
  const result = await request('/api/payments/bundle-order', {
    ...validBundle('invalid-booking'),
    items: []
  }, 'payment-tourist', { 'X-Idempotency-Key': 'invalid-booking' });
  assert.equal(result.status, 400);
  assert.equal(orderSequence, beforeOrders);
});

test('does not create local booking records when gateway order creation fails', async () => {
  failOrderCreation = true;
  const beforeBookings = db.bookings.listAll(100).length;
  const beforePayments = db.payments.listAll(100).length;
  const result = await request('/api/payments/bundle-order', validBundle('gateway-failure'), 'payment-tourist', {
    'X-Idempotency-Key': 'gateway-failure'
  });
  failOrderCreation = false;
  assert.equal(result.status, 500);
  assert.equal(db.bookings.listAll(100).length, beforeBookings);
  assert.equal(db.payments.listAll(100).length, beforePayments);
});

test('rejects missing payment fields without changing payment status', async () => {
  const result = await request('/api/payments/verify', {
    razorpay_order_id: 'order_missing_fields'
  }, 'payment-tourist');
  assert.equal(result.status, 404);
});

test('requires authentication and rejects non-tourist booking attempts', async () => {
  const unauthenticated = await fetch(`${baseUrl}/api/payments/bundle-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validBundle('unauthenticated'))
  });
  assert.equal(unauthenticated.status, 401);

  const guide = await request('/api/payments/bundle-order', validBundle('guide-attempt'), 'payment-guide', {
    'X-Idempotency-Key': 'guide-attempt'
  });
  assert.equal(guide.status, 403);
});

test('same idempotency key returns the same booking and payment over HTTP', async () => {
  const first = await request('/api/payments/bundle-order', validBundle('same-request'), 'payment-tourist', {
    'X-Idempotency-Key': 'same-request'
  });
  const second = await request('/api/payments/bundle-order', validBundle('same-request'), 'payment-tourist', {
    'X-Idempotency-Key': 'same-request'
  });
  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal(second.body.idempotent, true);
  assert.equal(second.body.booking.id, first.body.booking.id);
  assert.equal(db.payments.listAll(100).filter((payment) => payment.booking_id === first.body.booking.id).length, 1);
});

test('invalid signature fails payment and leaves booking unconfirmed', async () => {
  const created = await request('/api/payments/bundle-order', validBundle('invalid-signature'), 'payment-tourist', {
    'X-Idempotency-Key': 'invalid-signature'
  });
  const result = await request('/api/payments/verify', {
    razorpay_order_id: created.body.order.id,
    razorpay_payment_id: 'pay_invalid',
    razorpay_signature: 'tampered'
  }, 'payment-tourist');
  assert.equal(result.status, 400);
  assert.equal(db.payments.findByBookingId(created.body.booking.id).status, 'failed');
  assert.equal(db.bookings.findById(created.body.booking.id).status, 'payment_pending');
});

test('valid signature confirms payment only after inventory reservation succeeds', async () => {
  const created = await request('/api/payments/bundle-order', validBundle('valid-payment'), 'payment-tourist', {
    'X-Idempotency-Key': 'valid-payment'
  });
  const result = await request('/api/payments/verify', {
    razorpay_order_id: created.body.order.id,
    razorpay_payment_id: 'pay_valid',
    razorpay_signature: signature(created.body.order.id, 'pay_valid')
  }, 'payment-tourist');
  assert.equal(result.status, 200);
  assert.equal(result.body.booking.status, 'confirmed');
  assert.equal(result.body.payment.status, 'successful');
});

test('repeated payment verification is idempotent after successful confirmation', async () => {
  sqlite.prepare('UPDATE services SET availability = ? WHERE id = ?')
    .run(JSON.stringify({ availableRooms: 1 }), 'payment-hotel');
  const created = await request('/api/payments/bundle-order', validBundle('repeat-verification'), 'payment-tourist', {
    'X-Idempotency-Key': 'repeat-verification'
  });
  const payload = {
    razorpay_order_id: created.body.order.id,
    razorpay_payment_id: 'pay_repeat',
    razorpay_signature: signature(created.body.order.id, 'pay_repeat')
  };
  const first = await request('/api/payments/verify', payload, 'payment-tourist');
  const second = await request('/api/payments/verify', payload, 'payment-tourist');
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(second.body.payment.status, 'successful');
  assert.equal(db.payments.listAll(100).filter((payment) => payment.gateway_payment_id === 'pay_repeat').length, 1);
});

test('inventory exhaustion during confirmation does not confirm booking or payment', async () => {
  sqlite.prepare('UPDATE services SET availability = ? WHERE id = ?')
    .run(JSON.stringify({ availableRooms: 1 }), 'payment-hotel');
  const created = await request('/api/payments/bundle-order', validBundle('inventory-race'), 'payment-tourist', {
    'X-Idempotency-Key': 'inventory-race'
  });
  sqlite.prepare('UPDATE services SET availability = ? WHERE id = ?')
    .run(JSON.stringify({ availableRooms: 0 }), 'payment-hotel');
  const result = await request('/api/payments/verify', {
    razorpay_order_id: created.body.order.id,
    razorpay_payment_id: 'pay_inventory',
    razorpay_signature: signature(created.body.order.id, 'pay_inventory')
  }, 'payment-tourist');
  assert.equal(result.status, 409);
  assert.equal(db.payments.findByBookingId(created.body.booking.id).status, 'pending');
  assert.equal(db.bookings.findById(created.body.booking.id).status, 'payment_pending');
  sqlite.prepare('UPDATE services SET availability = ? WHERE id = ?')
    .run(JSON.stringify({ availableRooms: 1 }), 'payment-hotel');
});

test('payment verification cannot be performed by another tourist', async () => {
  const created = await request('/api/payments/bundle-order', validBundle('owner-check'), 'payment-tourist', {
    'X-Idempotency-Key': 'owner-check'
  });
  const result = await request('/api/payments/verify', {
    razorpay_order_id: created.body.order.id,
    razorpay_payment_id: 'pay_other',
    razorpay_signature: signature(created.body.order.id, 'pay_other')
  }, 'payment-other');
  assert.equal(result.status, 404);
  assert.equal(db.payments.findByBookingId(created.body.booking.id).status, 'pending');
});

after(async () => {
  paymentService.createOrder = originalCreateOrder;
  await new Promise((resolve) => server.close(resolve));
  sqlite.close();
  for (const suffix of ['', '-shm', '-wal']) {
    const file = `${databasePath}${suffix}`;
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
});
