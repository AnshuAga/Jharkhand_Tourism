import test from 'node:test';
import assert from 'node:assert/strict';
import { adminController } from '../src/controllers/adminController.js';
import { db } from '../src/database/db.js';

test('admin publication moderation does not create an authenticity label', () => {
  const existing = {
    id: 'review-test',
    target_type: 'provider',
    review_status: 'pending_review',
    publication_status: 'pending',
    verified_sentiment: null,
    verified_fake_label: null,
    annotation_status: 'unreviewed'
  };
  const updated = { ...existing, review_status: 'rejected', publication_status: 'hidden' };
  const originalFindById = db.reviews.findById;
  const originalUpdate = db.reviews.updateReviewIntelligence;
  try {
    db.reviews.findById = () => existing;
    db.reviews.updateReviewIntelligence = (id, fields) => {
      assert.equal(id, 'review-test');
      assert.equal(fields.review_status, 'rejected');
      assert.equal(fields.publication_status, 'hidden');
      assert.equal(fields.verified_fake_label, null);
      return updated;
    };
    let response;
    const res = {
      status(code) {
        response = { status: code };
        return this;
      },
      json(body) {
        response = { ...(response || {}), body };
        return this;
      }
    };

    adminController.moderateReview(
      { params: { id: 'review-test' }, body: { status: 'rejected' } },
      res
    );

    assert.equal(response.status, undefined);
    assert.equal(response.body.success, true);
    assert.equal(response.body.review.verified_fake_label, null);
  } finally {
    db.reviews.findById = originalFindById;
    db.reviews.updateReviewIntelligence = originalUpdate;
  }
});

test('correcting a confirmed fake to genuine clears the confirmed-fake state', () => {
  const existing = {
    id: 'review-test',
    target_type: 'provider',
    review_status: 'rejected',
    publication_status: 'hidden',
    verified_sentiment: null,
    verified_fake_label: 'fake',
    annotation_status: 'verified'
  };
  const updated = { ...existing, review_status: 'pending_review', publication_status: 'pending', verified_fake_label: 'genuine' };
  const originalFindById = db.reviews.findById;
  const originalUpdate = db.reviews.updateReviewIntelligence;
  const originalHistory = db.reviews.addAnnotationHistory;
  try {
    db.reviews.findById = () => existing;
    db.reviews.updateReviewIntelligence = (id, fields) => {
      assert.equal(fields.review_status, 'pending_review');
      assert.equal(fields.publication_status, 'pending');
      assert.equal(fields.verified_fake_label, 'genuine');
      return updated;
    };
    db.reviews.addAnnotationHistory = () => {};
    let response;
    const res = {
      status(code) { response = { status: code }; return this; },
      json(body) { response = { ...(response || {}), body }; return this; }
    };
    adminController.annotateReview(
      { params: { id: 'review-test' }, user: { id: 'admin-1' }, body: { verifiedFakeLabel: 'genuine' } },
      res
    );
    assert.equal(response.body.success, true);
    assert.equal(response.body.review.review_status, 'pending_review');
  } finally {
    db.reviews.findById = originalFindById;
    db.reviews.updateReviewIntelligence = originalUpdate;
    db.reviews.addAnnotationHistory = originalHistory;
  }
});
