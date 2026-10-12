import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const databasePath = path.join(os.tmpdir(), `jharkhand-recommendation-demo-${process.pid}.db`);
process.env.SQLITE_DB_PATH = databasePath;

const { db, sqlite } = await import('../src/database/db.js');
const { recommendationService } = await import('../src/services/recommendationService.js');

sqlite.prepare(`
  INSERT INTO users (id, name, email, password_hash, role)
  VALUES ('demo-user', 'Isolated Demo', 'recommendation-demo@example.com', 'hash', 'tourist')
`).run();

const destinations = [
  ['positive-many', 'Nature Falls Positive', ['nature', 'waterfalls']],
  ['low-one', 'Nature Falls Limited', ['nature', 'waterfalls']],
  ['unrated', 'Nature Falls Unrated', ['nature', 'waterfalls']],
  ['negative-many', 'Nature Falls Concern', ['nature', 'waterfalls']]
];

for (const [id, name, interests] of destinations) {
  sqlite.prepare(`
    INSERT INTO destinations (
      id, slug, name, title, district, category, lat, lng, avg_cost,
      best_season, image, description, attractions, activities, interests, is_active
    ) VALUES (?, ?, ?, ?, 'Ranchi', 'Waterfalls & Nature', 23, 85, 1500,
      'October to March', 'demo.jpg', 'Isolated evaluator fixture.',
      '["Natural waterfall landscape"]', '["Nature walk"]', ?, 1)
  `).run(id, id, name, name, JSON.stringify(interests));
}

function addReview(targetId, rating, compoundScore, sentiment) {
  db.reviews.create({
    id: `demo-${targetId}-${Math.random().toString(36).slice(2)}`,
    booking_id: null,
    user_id: 'demo-user',
    user_name: 'Isolated Demo',
    target_type: 'destination',
    target_id: targetId,
    rating,
    review_text: `${sentiment} isolated fixture`,
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
}

addReview('positive-many', 5, 0.9, 'Positive');
addReview('positive-many', 5, 0.9, 'Positive');
addReview('positive-many', 4, 0.8, 'Positive');
addReview('low-one', 2, -0.6, 'Negative');
addReview('negative-many', 1, -0.9, 'Negative');
addReview('negative-many', 1, -0.9, 'Negative');
addReview('negative-many', 2, -0.7, 'Negative');

const result = recommendationService.getRecommendations({
  type: 'destinations',
  interests: ['nature', 'waterfalls'],
  limit: 4
});

console.log(JSON.stringify(result.recommendations.map(item => ({
  name: item.name,
  score: item.score,
  rating: item.rating,
  reviewCount: item.reviewCount,
  adjustedRating: item.adjustedRating,
  factors: item.factorBreakdown,
  explanation: item.matchExplanation
})), null, 2));

sqlite.close();
for (const suffix of ['', '-shm', '-wal']) {
  const file = `${databasePath}${suffix}`;
  if (fs.existsSync(file)) fs.rmSync(file);
}
