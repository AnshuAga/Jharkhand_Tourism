import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after, before } from 'node:test';

const databasePath = path.join(os.tmpdir(), `jharkhand-journey-${process.pid}.db`);
process.env.SQLITE_DB_PATH = databasePath;

const { db, sqlite } = await import('../src/database/db.js');
const { touristController } = await import('../src/controllers/touristController.js');
const { sentimentController } = await import('../src/controllers/sentimentController.js');

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function booking(id, userId, status, checkOutDate) {
  return db.bookings.create({
    id,
    user_id: userId,
    provider_id: null,
    item_type: 'destination',
    item_id: 'journey-destination',
    item_title: `Journey ${id}`,
    travelers: 1,
    check_in_date: '2026-01-01',
    check_out_date: checkOutDate,
    days: 2,
    total_amount: 1000,
    escrow_amount: 1000,
    escrow_status: 'locked',
    contract_address: null,
    contract_tx_hash: null,
    status,
    cancellation_reason: null
  });
}

before(() => {
  sqlite.prepare(`
    INSERT INTO users (id, name, email, password_hash, role)
    VALUES
      ('journey-tourist-1', 'Journey Tourist 1', 'journey1@example.com', 'hash', 'tourist'),
      ('journey-tourist-2', 'Journey Tourist 2', 'journey2@example.com', 'hash', 'tourist')
  `).run();
  sqlite.prepare(`
    INSERT INTO destinations (
      id, slug, name, title, district, category, lat, lng, image, description, is_active
    ) VALUES ('journey-destination', 'journey-destination', 'Journey Destination',
      'Journey Destination', 'Ranchi', 'Nature', 23, 85, 'demo.jpg',
      'Destination for isolated journey tests.', 1)
  `).run();
  booking('past-booking', 'journey-tourist-1', 'confirmed', '2026-01-02');
  booking('future-booking', 'journey-tourist-1', 'confirmed', '2999-01-02');
  booking('pending-booking', 'journey-tourist-1', 'payment_pending', '2026-01-02');
  booking('cancelled-booking', 'journey-tourist-1', 'cancelled', '2026-01-02');
  booking('other-owner-booking', 'journey-tourist-2', 'confirmed', '2026-01-02');
});

test('completes an owned confirmed journey whose end date has passed', () => {
  const response = responseRecorder();
  touristController.completeBooking({ user: { id: 'journey-tourist-1' }, params: { bookingId: 'past-booking' } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, 'completed');
  assert.equal(db.bookings.findById('past-booking').status, 'completed');
  assert.ok(response.body.completedAt);
});

test('rejects a future confirmed journey', () => {
  const response = responseRecorder();
  touristController.completeBooking({ user: { id: 'journey-tourist-1' }, params: { bookingId: 'future-booking' } }, response);
  assert.equal(response.statusCode, 409);
  assert.equal(db.bookings.findById('future-booking').status, 'confirmed');
});

test('rejects pending and cancelled bookings', () => {
  for (const bookingId of ['pending-booking', 'cancelled-booking']) {
    const response = responseRecorder();
    touristController.completeBooking({ user: { id: 'journey-tourist-1' }, params: { bookingId } }, response);
    assert.equal(response.statusCode, 409);
    assert.notEqual(response.body.status, 'completed');
  }
});

test('prevents a tourist from completing another tourist booking', () => {
  const response = responseRecorder();
  touristController.completeBooking({ user: { id: 'journey-tourist-1' }, params: { bookingId: 'other-owner-booking' } }, response);
  assert.equal(response.statusCode, 404);
  assert.equal(db.bookings.findById('other-owner-booking').status, 'confirmed');
});

test('prevents repeated completion requests', () => {
  const response = responseRecorder();
  touristController.completeBooking({ user: { id: 'journey-tourist-1' }, params: { bookingId: 'past-booking' } }, response);
  assert.equal(response.statusCode, 409);
  assert.equal(db.bookings.findById('past-booking').status, 'completed');
});

test('dashboard counters are sourced from persisted booking status', async () => {
  const response = responseRecorder();
  await touristController.getDashboard({ user: { id: 'journey-tourist-1' } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.stats.activeTrips, 1);
  assert.equal(response.body.stats.completedTrips, 1);
});

test('completion does not create a review and the existing review workflow remains optional', () => {
  const beforeReviews = db.reviews.listAll().length;
  const response = responseRecorder();
  sentimentController.submitReview({
    user: { id: 'journey-tourist-1', name: 'Journey Tourist 1' },
    body: {
      bookingId: 'past-booking',
      destinationId: 'journey-destination',
      destinationName: 'Journey Destination',
      rating: 5,
      reviewText: 'A pleasant completed journey.'
    }
  }, response);
  assert.equal(response.statusCode, 201);
  assert.equal(db.reviews.listAll().length, beforeReviews + 1);
  assert.equal(response.body.review.booking_id, 'past-booking');
});

after(() => {
  sqlite.close();
  for (const suffix of ['', '-shm', '-wal']) {
    const file = `${databasePath}${suffix}`;
    if (fs.existsSync(file)) fs.rmSync(file);
  }
});
