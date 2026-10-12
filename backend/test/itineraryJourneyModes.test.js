import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

const databasePath = path.join(os.tmpdir(), `jharkhand-itinerary-${process.pid}.db`);
process.env.SQLITE_DB_PATH = databasePath;

const { db, sqlite } = await import('../src/database/db.js');
const { aiPlannerService } = await import('../src/services/aiPlannerService.js');

sqlite.prepare(`
  INSERT INTO destinations (
    id, slug, name, title, district, category, lat, lng, avg_cost,
    best_season, image, description, attractions, activities, interests, is_active
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
`).run(
  'planner-test-destination',
  'planner-test-destination',
  'Planner Test Falls',
  'Planner Test Falls',
  'Ranchi',
  'Waterfalls & Nature',
  23.4,
  85.3,
  1000,
  'October to March',
  'test.jpg',
  'Isolated planner test destination.',
  '["waterfall"]',
  '["Nature walk"]',
  '["nature"]'
);

test('supports a hometown round trip with unavailable train data stated honestly', async () => {
  const result = await aiPlannerService.generateItinerary({
    journeyMode: 'hometown_round_trip',
    hometown: 'Kolkata',
    entryStation: 'Ranchi',
    returnStation: 'Ranchi',
    startCity: 'Ranchi',
    days: 3,
    tripDate: '2099-10-12',
    places: ['Planner Test Falls'],
    interests: ['nature']
  });
  assert.equal(result.summary.journeyMode, 'hometown_round_trip');
  assert.equal(result.summary.tripEndDate, '2099-10-14');
  assert.equal(result.journey.outboundTrain.status, 'unavailable');
  assert.equal(result.journey.outboundTrain.dataClassification, 'unavailable');
  assert.equal(result.journey.returnTrain.status, 'unavailable');
});

test('supports an open-jaw one-way journey without an internal return leg', async () => {
  const result = await aiPlannerService.generateItinerary({
    journeyMode: 'open_jaw',
    hometown: 'Kolkata',
    startCity: 'Ranchi',
    entryStation: 'Ranchi',
    endLocation: 'Daltonganj',
    oneWay: true,
    days: 2,
    tripDate: '2099-11-01',
    places: ['Planner Test Falls'],
    interests: ['nature']
  });
  assert.equal(result.summary.journeyMode, 'open_jaw');
  assert.equal(result.summary.tripEndDate, '2099-11-02');
  assert.equal(result.summary.oneWay, true);
  assert.equal(result.transportPlan.returnToBase.availabilityStatus, 'not_applicable');
  assert.equal(result.transportPlan.returnToBase.estimatedCost, 0);
  assert.notEqual(result.route.at(-1), 'Daltonganj');
});

test('supports a within-Jharkhand round trip with the selected start point and inclusive dates', async () => {
  const result = await aiPlannerService.generateItinerary({
    journeyMode: 'within_jharkhand',
    startCity: 'Jamshedpur',
    days: 4,
    tripDate: '2099-10-12',
    travelers: 3,
    adults: 2,
    children: 1,
    seniors: 0,
    budget: 20000,
    places: ['Planner Test Falls'],
    interests: ['nature']
  });
  assert.equal(result.summary.origin, 'Jamshedpur');
  assert.equal(result.summary.tripStartDate, '2099-10-12');
  assert.equal(result.summary.tripEndDate, '2099-10-15');
  assert.equal(result.summary.travelers, 3);
  assert.equal(result.summary.adults + result.summary.children + result.summary.seniors, 3);
  assert.equal(result.days.length, 4);
  assert.equal(result.days[0].date, '2099-10-12');
  assert.equal(result.days.at(-1).date, `2099-10-${String(11 + result.days.length).padStart(2, '0')}`);
});

test('rejects invalid traveller totals and missing mode-specific locations', async () => {
  await assert.rejects(
    aiPlannerService.generateItinerary({
      journeyMode: 'within_jharkhand',
      startCity: 'Ranchi',
      days: 2,
      tripDate: '2099-10-12',
      travelers: 2,
      adults: 1,
      children: 0,
      seniors: 0
    }),
    /Total travellers/
  );
  await assert.rejects(
    aiPlannerService.generateItinerary({
      journeyMode: 'open_jaw',
      days: 2,
      tripDate: '2099-10-12',
      travelers: 1,
      adults: 1,
      children: 0,
      seniors: 0,
      entryStation: 'Ranchi'
    }),
    /Hometown or origin/
  );
});

test('preserves the existing planner default date for dashboard recommendations', async () => {
  const result = await aiPlannerService.generateItinerary({ days: 1, startCity: 'Ranchi' });
  assert.match(result.summary.tripStartDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(result.summary.tripEndDate, result.summary.tripStartDate);
});

after(() => {
  sqlite.close();
  for (const file of [databasePath, `${databasePath}-shm`, `${databasePath}-wal`]) {
    try { fs.unlinkSync(file); } catch { /* isolated database cleanup */ }
  }
});
