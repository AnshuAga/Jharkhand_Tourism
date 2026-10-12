import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

const databasePath = path.join(os.tmpdir(), `jharkhand-planner-cost-${process.pid}.db`);
process.env.SQLITE_DB_PATH = databasePath;
const { sqlite } = await import('../src/database/db.js');
const { aiPlannerService } = await import('../src/services/aiPlannerService.js');

sqlite.prepare(`
  INSERT INTO destinations
  (id, slug, name, title, district, category, lat, lng, avg_cost, best_season, image, description, attractions, activities, interests, is_active)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
`).run('cost-destination', 'cost-destination', 'Cost Falls', 'Cost Falls', 'Ranchi', 'Nature', 23.4, 85.3, 1000, 'All year', '', 'Test destination', '[]', '[]', '["nature"]');

sqlite.prepare(`
  INSERT INTO users (id, name, email, password_hash, role)
  VALUES ('cost-provider', 'Cost Provider', 'cost-provider@test.invalid', 'test', 'vendor')
`).run();
sqlite.prepare(`
  INSERT INTO provider_profiles (user_id, provider_type, business_name, district, verification_status)
  VALUES ('cost-provider', 'vendor', 'Cost Provider', 'Ranchi', 'approved')
`).run();

sqlite.prepare(`
  INSERT INTO services (id, provider_id, title, description, category, price, district, duration_days, availability, approval_status)
  VALUES
    ('cost-hotel', 'cost-provider', 'Test Homestay', 'Test', 'homestay', 1000, 'Ranchi', 1, '{}', 'approved'),
    ('cost-guide', 'cost-provider', 'Test Guide', 'Test', 'guide', 500, 'Ranchi', 1, '{}', 'approved')
`).run();

test('uses nights and rooms instead of traveller count for accommodation', async () => {
  const result = await aiPlannerService.generateItinerary({
    journeyMode: 'within_jharkhand',
    startCity: 'Ranchi',
    days: 4,
    tripDate: '2099-10-12',
    travelers: 4,
    adults: 4,
    rooms: 2,
    hotelServiceIds: ['cost-hotel'],
    places: ['Cost Falls']
  });
  assert.equal(result.summary.costEstimate.nights, 3);
  assert.equal(result.summary.costEstimate.rooms, 2);
  assert.equal(result.summary.costEstimate.accommodation, 6000);
});

test('does not charge a return leg for a one-way journey', async () => {
  const input = {
    journeyMode: 'open_jaw',
    hometown: 'Kolkata',
    startCity: 'Ranchi',
    entryStation: 'Ranchi',
    endLocation: 'Daltonganj',
    days: 2,
    tripDate: '2099-10-12',
    travelers: 2,
    adults: 2,
    oneWay: true,
    places: ['Cost Falls']
  };
  const oneWay = await aiPlannerService.generateItinerary(input);
  const roundTrip = await aiPlannerService.generateItinerary({ ...input, oneWay: false });
  assert.equal(oneWay.summary.costEstimate.transportation + oneWay.transportPlan.returnToBase.estimatedCost, oneWay.transportPlan.estimatedCosts.total);
  assert.ok(roundTrip.summary.costEstimate.transportation > oneWay.summary.costEstimate.transportation);
});

test('marks missing prices unavailable instead of deriving them from the budget', async () => {
  sqlite.prepare('UPDATE services SET price = 0 WHERE id = ?').run('cost-hotel');
  const result = await aiPlannerService.generateItinerary({
    journeyMode: 'within_jharkhand',
    startCity: 'Ranchi',
    days: 3,
    budget: 100000,
    tripDate: '2099-10-12',
    travelers: 2,
    adults: 2,
    hotelServiceIds: ['cost-hotel'],
    places: ['Cost Falls']
  });
  assert.equal(result.summary.costEstimate.accommodation, 0);
  assert.equal(result.summary.costEstimate.statuses.accommodation, 'unavailable');
  assert.ok(result.summary.costEstimate.unavailable.includes('accommodation'));
});

after(() => {
  sqlite.close();
  for (const suffix of ['', '-shm', '-wal']) {
    const file = `${databasePath}${suffix}`;
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
});
