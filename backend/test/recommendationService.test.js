import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after, before } from 'node:test';

const databasePath = path.join(os.tmpdir(), `jharkhand-recommendations-${process.pid}.db`);
process.env.SQLITE_DB_PATH = databasePath;

const { db, sqlite } = await import('../src/database/db.js');
const { recommendationService } = await import('../src/services/recommendationService.js');
const { recommendationController } = await import('../src/controllers/recommendationController.js');
const { touristController } = await import('../src/controllers/touristController.js');

const destinations = [
  ['wildlife', 'Wildlife Reserve', 'Latehar', 'Wildlife & Safari', ['wildlife', 'nature'], ['Safari'], 4600],
  ['waterfall', 'Waterfall Valley', 'Ranchi', 'Waterfalls & Nature', ['waterfalls', 'nature'], ['Trekking'], 2400],
  ['spiritual', 'Heritage Shrine', 'Deoghar', 'Spiritual & Heritage', ['spiritual', 'heritage'], ['Pilgrimage'], 1800],
  ['plain', 'Plain View', 'Gumla', 'Nature & Rural Tourism', ['nature'], [], 1500]
];

function seedDestination([id, name, district, category, interests, activities, cost]) {
  sqlite.prepare(`
    INSERT INTO destinations (
      id, slug, name, title, district, category, lat, lng, avg_cost,
      best_season, image, description, attractions, activities, interests, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, 23, 85, ?, 'October to March', 'test.jpg',
      'A catalogue destination used for recommendation tests.', '[]', ?, ?, 1)
  `).run(id, id, name, `${name} title`, district, category, cost, JSON.stringify(activities), JSON.stringify(interests));
}

function addReview(destinationId, rating, compoundScore, sentiment = compoundScore > 0 ? 'Positive' : 'Negative') {
  const id = `review-${destinationId}-${Math.random().toString(36).slice(2)}`;
  db.reviews.create({
    id,
    booking_id: null,
    user_id: 'test-user',
    user_name: 'Test User',
    target_type: 'destination',
    target_id: destinationId,
    rating,
    review_text: `${sentiment} visitor feedback`,
    sentiment,
    compound_score: compoundScore,
    emotion: 'Neutral',
    aspects: {},
    is_flagged: 0,
    publication_status: 'published',
    review_status: 'published',
    verified_fake_label: null,
    verified_sentiment: null,
    suspicion_score: 0,
    suspicion_reasons: [],
    risk_category: 'low'
  });
  return id;
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

before(() => {
  sqlite.prepare(`
    INSERT INTO users (id, name, email, password_hash, role)
    VALUES ('test-user', 'Test User', 'recommendation-test@example.com', 'hash', 'tourist')
  `).run();
  destinations.forEach(seedDestination);
});

after(() => {
  sqlite.close();
  for (const suffix of ['', '-shm', '-wal']) {
    const file = `${databasePath}${suffix}`;
    if (fs.existsSync(file)) fs.rmSync(file);
  }
});

test('personalization changes ranking for wildlife, waterfalls, and spiritual interests', () => {
  const wildlife = recommendationService.getRecommendations({ type: 'destinations', interests: ['wildlife'] });
  const waterfalls = recommendationService.getRecommendations({ type: 'destinations', interests: ['waterfalls'] });
  const spiritual = recommendationService.getRecommendations({ type: 'destinations', interests: ['spiritual', 'heritage'] });

  assert.equal(wildlife.recommendations[0].id, 'wildlife');
  assert.equal(waterfalls.recommendations[0].id, 'waterfall');
  assert.equal(spiritual.recommendations[0].id, 'spiritual');
  assert.match(wildlife.recommendations[0].reasons[0], /Matches wildlife/);
  assert.match(spiritual.recommendations[0].reasons[0], /Matches spiritual and heritage/);
});

test('missing interests use attribute-based cold-start ranking without errors', () => {
  const result = recommendationService.getRecommendations({ type: 'destinations' });
  assert.equal(result.success, true);
  assert.ok(result.recommendations.length > 0);
  assert.equal(result.recommendations[0].factorBreakdown.interest.weight, 0.3);
  assert.match(result.recommendations[0].reasons[0], /destination attributes/i);
});

test('unrated destinations expose partial evidence coverage instead of implying complete evidence', () => {
  const item = recommendationService.getRecommendations({
    type: 'destinations',
    interests: ['nature']
  }).recommendations.find(destination => destination.id === 'plain');

  assert.equal(item.rating, null);
  assert.equal(item.reviewCount, 0);
  assert.equal(item.factorBreakdown.sentiment.available, false);
  assert.equal(item.factorBreakdown.rating.available, false);
  assert.equal(item.evidenceCoverage.percentage, 30);
  assert.equal(item.finalRecommendationScore, item.score);
  assert.match(item.rankingExplanation, /30% of configured factor weight/);
});

test('review evidence is confidence-adjusted and remains separate from ratings', () => {
  addReview('wildlife', 1, -1);
  const oneReview = recommendationService.getRecommendations({ type: 'destinations', interests: ['nature'] })
    .recommendations.find(item => item.id === 'wildlife');
  assert.equal(oneReview.reviewCount, 1);
  assert.equal(oneReview.rating, 1);
  assert.equal(oneReview.sentiment.label, 'Negative');
  assert.ok(oneReview.reviewConfidence < 0.5);
  assert.notEqual(oneReview.score, oneReview.rating);

  addReview('wildlife', 1, -1);
  addReview('wildlife', 1, -1);
  const repeatedNegative = recommendationService.getRecommendations({ type: 'destinations', interests: ['nature'] })
    .recommendations.find(item => item.id === 'wildlife');
  assert.equal(repeatedNegative.reviewCount, 3);
  assert.equal(repeatedNegative.sentiment.label, 'Negative');
  assert.ok(repeatedNegative.reviewConfidence > oneReview.reviewConfidence);
  assert.ok(repeatedNegative.factorBreakdown.sentiment.value < 0.5);
});

test('positive and mixed sentiment are calculated from eligible published reviews', () => {
  addReview('waterfall', 5, 1, 'Positive');
  addReview('waterfall', 4, 0.8, 'Positive');
  addReview('spiritual', 2, -0.8, 'Negative');
  addReview('spiritual', 5, 0.8, 'Positive');
  const result = recommendationService.getRecommendations({ type: 'destinations' });
  const waterfall = result.recommendations.find(item => item.id === 'waterfall');
  const spiritual = result.recommendations.find(item => item.id === 'spiritual');
  assert.equal(waterfall.sentiment.label, 'Positive');
  assert.equal(waterfall.rating, 4.5);
  assert.equal(spiritual.sentiment.label, 'Mixed');
  assert.equal(spiritual.rating, 3.5);
});

test('saved tourist interests are used when the request does not provide interests', () => {
  db.touristProfiles.upsert({
    user_id: 'test-user',
    budget: 25000,
    travel_duration: 3,
    interests: ['waterfalls'],
    starting_location: 'Ranchi',
    group_size: 2,
    group_type: 'couple',
    nationality: 'Indian',
    state: null,
    date_of_birth: null,
    bio: null
  });
  const response = responseRecorder();
  recommendationController.get({ user: { id: 'test-user', role: 'tourist' }, query: { type: 'destinations' } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.preferences.interests[0], 'waterfalls');
  assert.equal(response.body.recommendations[0].id, 'waterfall');
});

test('updating preferences preserves saved interests when interests are omitted and accepts an empty selection', () => {
  db.touristProfiles.upsert({
    user_id: 'test-user',
    budget: 25000,
    travel_duration: 3,
    interests: ['photography'],
    starting_location: 'Ranchi',
    group_size: 2,
    group_type: 'couple',
    bio: ''
  });

  let response = responseRecorder();
  touristController.updatePreferences({
    user: { id: 'test-user' },
    body: { budget: 18000 }
  }, response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.preferences.interests, ['photography']);

  response = responseRecorder();
  touristController.updatePreferences({
    user: { id: 'test-user' },
    body: { interests: [] }
  }, response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.preferences.interests, []);
});

test('fake, unpublished, and rejected reviews do not enter aggregates', () => {
  addReview('plain', 1, -1);
  const reviewId = sqlite.prepare("SELECT id FROM reviews WHERE target_id = 'plain' ORDER BY created_at DESC LIMIT 1").get().id;
  sqlite.prepare("UPDATE reviews SET review_status = 'rejected' WHERE id = ?").run(reviewId);
  const result = recommendationService.getRecommendations({ type: 'destinations' });
  const plain = result.recommendations.find(item => item.id === 'plain');
  assert.equal(plain.reviewCount, 0);
  assert.equal(plain.rating, null);
  assert.equal(plain.sentiment, null);

  sqlite.prepare("UPDATE reviews SET review_status = 'published', publication_status = 'published', verified_fake_label = 'fake' WHERE id = ?").run(reviewId);
  const fakeResult = recommendationService.getRecommendations({ type: 'destinations' });
  const fakePlain = fakeResult.recommendations.find(item => item.id === 'plain');
  assert.equal(fakePlain.reviewCount, 0);
});

test('backend role policy separates tourist recommendations and admin analytics', () => {
  const adminResponse = responseRecorder();
  recommendationController.get({ user: { role: 'admin' }, query: {} }, adminResponse);
  assert.equal(adminResponse.statusCode, 403);

  const touristResponse = responseRecorder();
  recommendationController.get({ user: { id: 'test-user', role: 'tourist' }, query: { interests: 'wildlife' } }, touristResponse);
  assert.equal(touristResponse.statusCode, 200);
  assert.equal(touristResponse.body.success, true);

  for (const role of ['guide', 'vendor']) {
    const roleResponse = responseRecorder();
    recommendationController.get({ user: { role }, query: {} }, roleResponse);
    assert.equal(roleResponse.statusCode, 403);
  }

  const guestResponse = responseRecorder();
  recommendationController.get({ query: {} }, guestResponse);
  assert.equal(guestResponse.statusCode, 200);

  const analyticsResponse = responseRecorder();
  recommendationController.analytics({}, analyticsResponse);
  assert.equal(analyticsResponse.statusCode, 200);
  assert.equal(analyticsResponse.body.role, 'admin');
});

test('verified sentiment changes the aggregate without changing the stored rating', () => {
  addReview('plain', 4, 0.8, 'Negative');
  const reviewId = sqlite.prepare("SELECT id FROM reviews WHERE target_id = 'plain' AND verified_fake_label IS NULL ORDER BY created_at DESC LIMIT 1").get().id;
  sqlite.prepare("UPDATE reviews SET verified_sentiment = 'Positive' WHERE id = ?").run(reviewId);
  const result = recommendationService.getRecommendations({ type: 'destinations' });
  const plain = result.recommendations.find(item => item.id === 'plain');
  assert.equal(plain.rating, 4);
  assert.equal(plain.reviewCount, 1);
  assert.equal(plain.sentiment.label, 'Positive');
});

test('publishing and unpublishing a review changes the next recommendation calculation', () => {
  const reviewId = addReview('plain', 5, 1, 'Positive');
  let result = recommendationService.getRecommendations({ type: 'destinations' });
  assert.ok(result.recommendations.find(item => item.id === 'plain').reviewCount > 0);

  sqlite.prepare("UPDATE reviews SET publication_status = 'hidden' WHERE id = ?").run(reviewId);
  result = recommendationService.getRecommendations({ type: 'destinations' });
  const plain = result.recommendations.find(item => item.id === 'plain');
  assert.equal(plain.reviewCount, 1);
});
