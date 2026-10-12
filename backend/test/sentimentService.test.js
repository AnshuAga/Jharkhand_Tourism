import test from 'node:test';
import assert from 'node:assert/strict';
import { sentimentService } from '../src/services/sentimentService.js';

test('classifies negative text even when a positive rating is supplied', () => {
  const result = sentimentService.analyzeText('the place was bad', 5);
  assert.equal(result.sentiment, 'Negative');
  assert.ok(result.compoundScore < 0);
  assert.deepEqual(result.aspects, {});
});

test('classifies positive text and detects its supported aspect', () => {
  const result = sentimentService.analyzeText('The waterfall was beautiful');
  assert.equal(result.sentiment, 'Positive');
  assert.deepEqual(result.aspects, {});
});

test('classifies independent supported aspects without fabricating others', () => {
  const result = sentimentService.analyzeText('The food was excellent but the rooms were dirty');
  assert.equal(result.sentiment, 'Mixed');
  assert.equal(result.aspects.food, 'Positive');
  assert.equal(result.aspects.cleanliness, 'Negative');
  assert.deepEqual(Object.keys(result.aspects).sort(), ['cleanliness', 'food']);
});

test('detects negated cleanliness and positive food independently', () => {
  const result = sentimentService.analyzeText('The place was not good. It was not clean. However, food was awesome.', 5);
  assert.equal(result.sentiment, 'Mixed');
  assert.equal(result.aspects.cleanliness, 'Negative');
  assert.equal(result.aspects.food, 'Positive');
  assert.deepEqual(Object.keys(result.aspects).sort(), ['cleanliness', 'food']);
});

test('detects a negative cleanliness aspect', () => {
  assert.equal(sentimentService.analyzeText('The place was not clean.').aspects.cleanliness, 'Negative');
});

test('detects a positive food aspect', () => {
  assert.equal(sentimentService.analyzeText('The food was awesome.').aspects.food, 'Positive');
});

test('keeps contrast-clause aspects independent', () => {
  const result = sentimentService.analyzeText('The place was not clean, but the food was awesome.');
  assert.equal(result.aspects.cleanliness, 'Negative');
  assert.equal(result.aspects.food, 'Positive');
  assert.equal(result.sentiment, 'Mixed');
});

test('handles negated food sentiment', () => {
  assert.equal(sentimentService.analyzeText('The food was not good.').aspects.food, 'Negative');
});

test('associates food and hospitality sentiment with their own clauses', () => {
  const result = sentimentService.analyzeText('The food was good, but the service was terrible.');
  assert.equal(result.aspects.food, 'Positive');
  assert.equal(result.aspects.hospitality, 'Negative');
});

test('assigns aspect sentiment from the closest supporting sentiment word', () => {
  const result = sentimentService.analyzeText('The waterfall was beautiful, but the roads were terrible.');
  assert.equal(result.sentiment, 'Mixed');
  assert.equal(result.aspects.transport, 'Negative');
  assert.deepEqual(Object.keys(result.aspects), ['transport']);
});

test('keeps factual text neutral', () => {
  const result = sentimentService.analyzeText('The place is open today');
  assert.equal(result.sentiment, 'Neutral');
  assert.equal(result.compoundScore, 0);
  assert.deepEqual(result.aspects, {});
});

test('handles negated positive language as negative', () => {
  const result = sentimentService.analyzeText('The place was not good');
  assert.equal(result.sentiment, 'Negative');
  assert.ok(result.compoundScore < 0);
  assert.deepEqual(result.aspects, {});
});

test('exposes persisted aspect sentiment counts in analytics', () => {
  const analytics = sentimentService.getSentimentAnalytics();
  assert.ok(analytics.aspectSentimentCounts);
  if (analytics.totalReviews > 0) {
    assert.equal(analytics.aspectSentimentCounts.cleanliness?.Negative, 1);
    assert.equal(analytics.aspectSentimentCounts.food?.Positive, 1);
  }
});
