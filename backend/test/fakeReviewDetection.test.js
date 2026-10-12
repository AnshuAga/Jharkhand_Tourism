import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeReviewDetectionService } from '../src/services/fakeReviewDetectionService.js';

function mockDb({ sameUserReviews = [], recentUserReviews = [] } = {}) {
  return {
    reviews: {
      listByUserTarget: () => sameUserReviews,
      listByUserSince: () => recentUserReviews
    }
  };
}

test('does not reject a genuine negative review by sentiment alone', () => {
  const result = fakeReviewDetectionService.inspect({
    db: mockDb(),
    userId: 'user-1',
    targetType: 'destination',
    targetId: 'dest-1',
    reviewText: 'The place was bad and the roads were unsafe.',
    rating: 1
  });
  assert.equal(result.isSuspicious, false);
  assert.equal(result.reviewStatus, 'pending_review');
});

test('flags an exact duplicate for human review', () => {
  const result = fakeReviewDetectionService.inspect({
    db: mockDb({ sameUserReviews: [{ review_text: 'Amazing place!!!' }] }),
    userId: 'user-1',
    targetType: 'destination',
    targetId: 'dest-1',
    reviewText: 'Amazing place!!!',
    rating: 5
  });
  assert.equal(result.isSuspicious, true);
  assert.match(result.suspicionReasons[0], /Exact duplicate/);
  assert.equal(result.reviewStatus, 'pending_review');
  assert.equal(result.riskCategory, 'high');
  assert.match(result.analysisTimestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test('normalizes punctuation and case for exact duplicate detection', () => {
  const result = fakeReviewDetectionService.inspect({
    db: mockDb({ sameUserReviews: [{ review_text: 'Amazing place!!!' }] }),
    userId: 'user-1',
    targetType: 'destination',
    targetId: 'dest-1',
    reviewText: ' amazing PLACE ',
    rating: 5
  });
  assert.equal(result.exactDuplicate, true);
  assert.equal(result.riskCategory, 'high');
});

test('flags near-duplicate and promotional patterns without banning the account', () => {
  const result = fakeReviewDetectionService.inspect({
    db: mockDb({ sameUserReviews: [{ review_text: 'Visit this amazing place today and call now for a discount' }] }),
    userId: 'user-1',
    targetType: 'destination',
    targetId: 'dest-1',
    reviewText: 'Visit this amazing place today and call now for a discount!',
    rating: 5
  });
  assert.equal(result.isSuspicious, true);
  assert.ok(result.suspicionReasons.some((reason) => reason.includes('Promotional')));
  assert.equal(result.reviewStatus, 'pending_review');
});

test('records rating-text mismatch as a signal without treating it as proof of fraud', () => {
  const result = fakeReviewDetectionService.inspect({
    db: mockDb(),
    userId: 'user-1',
    targetType: 'destination',
    targetId: 'dest-1',
    reviewText: 'The place was bad.',
    rating: 5
  });
  assert.equal(result.isSuspicious, false);
  assert.ok(result.suspicionReasons.some((reason) => reason.includes('Rating-text mismatch')));
});

test('classifies a promotional signal as medium risk without hiding the review', () => {
  const result = fakeReviewDetectionService.inspect({
    db: mockDb(),
    userId: 'user-1',
    targetType: 'destination',
    targetId: 'dest-1',
    reviewText: 'Call now for a discount and guaranteed access.',
    rating: 5
  });
  assert.equal(result.riskCategory, 'medium');
  assert.equal(result.reviewStatus, 'pending_review');
  assert.equal(result.detectorVersion, 'rules-v1');
  assert.ok(result.analysisTimestamp);
});

test('can publish medium-risk reviews only under the configured medium-risk policy', () => {
  const previousAction = process.env.REVIEWS_MEDIUM_RISK_ACTION;
  process.env.REVIEWS_MEDIUM_RISK_ACTION = 'publish';
  try {
    const result = fakeReviewDetectionService.inspect({
      db: mockDb(),
      userId: 'user-1',
      targetType: 'destination',
      targetId: 'dest-1',
      reviewText: 'Call now for a discount and guaranteed access.',
      rating: 5,
      automaticPublicationEnabled: true
    });
    assert.equal(result.riskCategory, 'medium');
    assert.equal(result.reviewStatus, 'published');
    assert.equal(result.mediumRiskAction, 'publish');
  } finally {
    process.env.REVIEWS_MEDIUM_RISK_ACTION = previousAction;
  }
});

test('publishes a low-risk review only when automatic publication is enabled', () => {
  const result = fakeReviewDetectionService.inspect({
    db: mockDb(),
    userId: 'user-1',
    targetType: 'destination',
    targetId: 'dest-1',
    reviewText: 'The waterfall was beautiful and peaceful.',
    rating: 5,
    automaticPublicationEnabled: true
  });
  assert.equal(result.riskCategory, 'low');
  assert.equal(result.reviewStatus, 'published');
  assert.equal(result.publicationStatus, 'published');
});

test('detects normalized URL and contact-sharing promotion signals', () => {
  const result = fakeReviewDetectionService.inspect({
    db: mockDb(),
    userId: 'user-1',
    targetType: 'destination',
    targetId: 'dest-1',
    reviewText: 'Visit https://example.com or WhatsApp me for a guaranteed discount.',
    rating: 5
  });
  assert.ok(result.suspicionReasons.some((reason) => reason.includes('Promotional')));
  assert.equal(result.riskCategory, 'medium');
});

test('places multiple strong signals into pending high-risk moderation', () => {
  const result = fakeReviewDetectionService.inspect({
    db: mockDb({
      sameUserReviews: [{ review_text: 'Visit this amazing place today and call now for a discount' }],
      recentUserReviews: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]
    }),
    userId: 'user-1',
    targetType: 'destination',
    targetId: 'dest-1',
    reviewText: 'Visit this amazing place today and call now for a discount!',
    rating: 5
  });
  assert.equal(result.riskCategory, 'high');
  assert.equal(result.reviewStatus, 'pending_review');
  assert.equal(result.isSuspicious, true);
});

test('does not flag a legitimate similar review without suspicious signals', () => {
  const result = fakeReviewDetectionService.inspect({
    db: mockDb({
      sameUserReviews: [{ review_text: 'The waterfall was beautiful and peaceful.' }]
    }),
    userId: 'user-1',
    targetType: 'destination',
    targetId: 'dest-1',
    reviewText: 'The waterfall was beautiful and peaceful today.',
    rating: 5
  });
  assert.equal(result.riskCategory, 'low');
  assert.equal(result.isSuspicious, false);
});
