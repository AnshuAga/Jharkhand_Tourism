import { db } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';
import { sentimentDatasetService } from './sentimentDatasetService.js';
import { fakeReviewDetectionService } from './fakeReviewDetectionService.js';

// Valence lexicons for fast deterministic Aspect-Based Sentiment Analysis (ABSA)
const POSITIVE_WORDS = [
  'good', 'great', 'awesome', 'amazing', 'breathtaking', 'spectacular', 'excellent',
  'clean', 'safe', 'friendly', 'polite', 'helpful', 'beautiful', 'scenic', 'delicious',
  'loved', 'enjoyed', 'peaceful', 'serene', 'authentic', 'punctual', 'recommend', 'superb',
  'splendid', 'wonderful', 'marvelous', 'divine', 'spiritual', 'refreshing', 'hospitable'
];

const NEGATIVE_WORDS = [
  'bad', 'terrible', 'horrible', 'dirty', 'filthy', 'rude', 'late', 'delayed',
  'unsafe', 'dangerous', 'crowded', 'expensive', 'rip-off', 'waste', 'disappointed',
  'frustrated', 'poor', 'traffic', 'smelly', 'cheated', 'worst', 'broken', 'careless',
  'unhelpful', 'unhygienic', 'unpleasant'
];
const NEGATION_WORDS = new Set(['not', 'no', 'never', 'hardly', 'barely']);

// Aspect lexicons
const ASPECT_KEYWORDS = {
  cleanliness: ['clean', 'dirty', 'hygiene', 'waste', 'garbage', 'trash', 'dust', 'tidy', 'spotless', 'filthy', 'unhygienic'],
  hospitality: ['guide', 'host', 'service', 'friendly', 'staff', 'polite', 'rude', 'welcome', 'behavior', 'attitude', 'helpful', 'careless'],
  transport: ['road', 'roads', 'bus', 'cab', 'driver', 'transit', 'car', 'delay', 'traffic', 'reach', 'parking', 'punctual'],
  food: ['food', 'cuisine', 'dish', 'meal', 'dhuska', 'taste', 'tea', 'breakfast', 'dinner', 'restaurant', 'sweet', 'delicious', 'stale'],
  safety: ['safe', 'safety', 'guard', 'secure', 'danger', 'lighting', 'isolated', 'family', 'security', 'police', 'unsafe']
};

export const sentimentService = {
  refreshDestinationRating(destinationId) {
    if (!destinationId) return;
    const destination = db.destinations.findById(destinationId);
    const reviews = db.reviews.listByTarget('destination', destinationId, { publishedOnly: true });
    if (destination && reviews.length) {
      const average = reviews.reduce((sum, review) => sum + Number(review.rating), 0) / reviews.length;
      db.destinations.update(destinationId, { rating: Math.round(average * 10) / 10, review_count: reviews.length });
    } else if (destination) {
      db.destinations.update(destinationId, { rating: 0, review_count: 0 });
    }
  },
  /**
   * Deterministic Aspect-Based Sentiment Analysis (ABSA) with zero randomness
   */
  analyzeText(text, userRating = 3) {
    if (!text || typeof text !== 'string') {
      const normalizedScore = (userRating - 3) / 2; // maps 1..5 to -1..1
      return {
        compoundScore: normalizedScore,
        sentiment: userRating >= 4 ? 'Positive' : userRating <= 2 ? 'Negative' : 'Neutral',
        emotion: userRating >= 4 ? 'Happy' : userRating <= 2 ? 'Disappointed' : 'Neutral',
        aspects: {}
      };
    }

    const tokens = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/);

    let posCount = 0;
    let negCount = 0;
    const isNegated = (index) => tokens.slice(Math.max(0, index - 3), index).some(token => NEGATION_WORDS.has(token));
    const polarityForToken = (token, index) => {
      const positive = POSITIVE_WORDS.includes(token);
      const negative = NEGATIVE_WORDS.includes(token);
      if (positive && isNegated(index)) return { positive: false, negative: true };
      if (negative && isNegated(index)) return { positive: true, negative: false };
      return { positive, negative };
    };

    tokens.forEach((token, index) => {
      const polarity = polarityForToken(token, index);
      if (polarity.positive) posCount++;
      if (polarity.negative) negCount++;
    });

    const total = posCount + negCount;
    // Compound score normalized between -1.0 and 1.0
    let compoundScore = total === 0
      ? (userRating - 3) / 2
      : (posCount - negCount) / Math.sqrt(posCount * posCount + negCount * negCount + 10);

    compoundScore = Math.max(-1, Math.min(1, Math.round(compoundScore * 100) / 100));

    let sentiment = 'Neutral';
    if (posCount > 0 && negCount > 0 && Math.abs(posCount - negCount) <= 1) sentiment = 'Mixed';
    // This service uses a custom lexicon model, not VADER. Text evidence takes
    // precedence over a review rating so a default 5-star form value cannot
    // turn an explicitly negative review into a positive prediction.
    else if (compoundScore >= 0.15 || (total === 0 && userRating >= 4)) sentiment = 'Positive';
    else if (compoundScore <= -0.15 || (total === 0 && userRating <= 2)) sentiment = 'Negative';

    // Emotion extraction
    let emotion = 'Neutral';
    if (compoundScore > 0.5) emotion = 'Excited';
    else if (compoundScore > 0.1) emotion = 'Happy';
    else if (compoundScore < -0.4) emotion = 'Frustrated';
    else if (compoundScore < 0) emotion = 'Disappointed';

    // Keyword-based aspect sentiment extraction. These are labels, not star
    // ratings and are independent from the review's submitted rating.
    const aspects = {};

    // Analyze each sentence/contrast clause independently. This prevents a
    // negative expression for one aspect from becoming the nearest evidence
    // for a later aspect (for example, "not clean, but food was awesome").
    const aspectClauses = text
      .toLowerCase()
      .split(/[.!?,;:]+|\b(?:however|but|although|though)\b/gi)
      .map((clause) => clause.replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean))
      .filter((clause) => clause.length > 0);

    for (const [aspect, keywords] of Object.entries(ASPECT_KEYWORDS)) {
      const matchedClause = aspectClauses.find((clause) => clause.some((token) => keywords.includes(token)));
      if (matchedClause) {
        const clauseTokens = matchedClause;
        const matchedIndexes = clauseTokens
          .map((token, index) => ({ token, index }))
          .filter(({ token }) => keywords.includes(token));
        let aspectPos = 0;
        let aspectNeg = 0;
        matchedIndexes.forEach(({ token, index }) => {
          const directPolarity = polarityForToken(token, tokens.indexOf(token));
          if (directPolarity.positive || directPolarity.negative) {
            if (directPolarity.positive) aspectPos++;
            if (directPolarity.negative) aspectNeg++;
            return;
          }
          const nearby = clauseTokens
            .map((contextToken, contextIndex) => ({ contextToken, contextIndex, distance: Math.abs(contextIndex - index) }))
            .filter(({ contextToken, distance }) =>
              distance > 0 && distance <= 3 &&
              (POSITIVE_WORDS.includes(contextToken) || NEGATIVE_WORDS.includes(contextToken))
            )
            .sort((left, right) => {
              const leftIsAfter = left.contextIndex > index;
              const rightIsAfter = right.contextIndex > index;
              if (leftIsAfter !== rightIsAfter) return leftIsAfter ? -1 : 1;
              return left.distance - right.distance;
            });
          const closest = nearby[0];
          if (closest) {
            const polarity = polarityForToken(closest.contextToken, tokens.indexOf(closest.contextToken));
            if (polarity.positive) aspectPos++;
            if (polarity.negative) aspectNeg++;
          }
        });

        if (aspectNeg > aspectPos) {
          aspects[aspect] = 'Negative';
        } else if (aspectPos > aspectNeg) {
          aspects[aspect] = 'Positive';
        } else {
          aspects[aspect] = 'Neutral';
        }
      }
    }

    return {
      compoundScore,
      sentiment,
      emotion,
      aspects
    };
  },

  /**
   * Submit new review into database and perform sentiment evaluation
   */
  submitReview({ bookingId, destinationId, destinationName, providerId, productId, productName, serviceId, serviceName, userId, userName, rating, reviewText }) {
    if (productId && !bookingId) {
      throw new Error('A completed product order is required to submit this review.');
    }
    const numRating = Number(rating) || 5;
    const analysis = this.analyzeText(reviewText, numRating);
    const detection = fakeReviewDetectionService.inspect({
      db,
      userId,
      targetType: destinationId ? 'destination' : productId ? 'product' : serviceId ? 'service' : 'provider',
      targetId: destinationId || productId || serviceId || providerId,
      reviewText,
      rating: numRating
    });
    if (detection.exactDuplicate) {
      throw new Error('Duplicate review submission detected. Your existing review was not submitted again.');
    }
    const isFlagged = detection.isSuspicious ? 1 : 0;

    const newReview = db.reviews.create({
      id: `rev-${uuidv4().slice(0, 8)}`,
      booking_id: bookingId || null,
      user_id: userId || 'usr-tourist-anonymous',
      user_name: userName || 'Explorer',
      target_type: destinationId ? 'destination' : productId ? 'product' : serviceId ? 'service' : 'provider',
      target_id: destinationId || productId || serviceId || providerId || 'netarhat',
      rating: numRating,
      review_text: reviewText,
      sentiment: analysis.sentiment,
      compound_score: analysis.compoundScore,
      emotion: analysis.emotion,
      aspects: analysis.aspects,
      is_flagged: isFlagged,
      publication_status: detection.publicationStatus,
      review_status: detection.reviewStatus,
      model_version: 'lexicon-v1',
      detector_version: detection.detectorVersion,
      suspicion_score: detection.suspicionScore,
      suspicion_reasons: detection.suspicionReasons,
      risk_category: detection.riskCategory,
      detection_analyzed_at: detection.analysisTimestamp
    });

    if (destinationId) this.refreshDestinationRating(destinationId);

    return {
      success: true,
      review: newReview,
      analysis,
      qualityAlertTriggered: false,
      fakeReviewDetection: detection
    };
  },

  /**
   * Get real sentiment analytics strictly from database reviews
   */
  getSentimentAnalytics(targetId) {
    const stats = db.reviews.stats({ targetId, publishedOnly: true });
    if (!stats) {
      return {
        hasData: false,
        message: 'No data available',
        totalReviews: 0,
        sentimentDistribution: { positivePercent: 0, neutralPercent: 0, negativePercent: 0, mixedPercent: 0, rawCounts: { Positive: 0, Neutral: 0, Negative: 0, Mixed: 0 } },
        aspectScores: {},
        aspectSentimentCounts: {},
        recentReviews: [],
        syntheticDataset: sentimentDatasetService.getMetadata()
      };
    }

    const recentReviews = targetId
      ? db.reviews.listByTarget('destination', targetId, { publishedOnly: true }).slice(0, 10)
      : db.reviews.listAll(10).filter((review) => review.publication_status === 'published' && review.review_status === 'published');

    return {
      hasData: true,
      totalReviews: stats.totalReviews,
      sentimentDistribution: stats.sentimentDistribution,
      aspectScores: stats.aspectScores,
      aspectSentimentCounts: stats.aspectSentimentCounts,
      recentReviews,
      syntheticDataset: sentimentDatasetService.getMetadata()
    };
  },

  getSyntheticDatasetMetadata() {
    return sentimentDatasetService.getMetadata();
  },

  getSyntheticDatasetSamples(sampleId) {
    return sentimentDatasetService.getSamples(sampleId);
  },

  getPublicationPolicy() {
    return {
      automaticPublicationEnabled: fakeReviewDetectionService.isAutomaticPublicationEnabled(),
      mediumRiskAction: fakeReviewDetectionService.getMediumRiskAction(),
      defaultMode: 'manual_review',
      lowRisk: 'published only when automatic publication is enabled',
      mediumRisk: 'pending_review unless REVIEWS_MEDIUM_RISK_ACTION=publish',
      highRisk: 'pending_review'
    };
  },

  refreshStoredAspectAnalysis(review) {
    const parsedAspects = typeof review.aspects === 'string'
      ? JSON.parse(review.aspects || '{}')
      : (review.aspects || {});
    const requiresRefresh = Object.values(parsedAspects).some((value) => typeof value === 'number');
    if (!requiresRefresh) return review;
    const analysis = this.analyzeText(review.review_text, review.rating);
    return db.reviews.updateAspectAnalysis(
      review.id,
      analysis.aspects,
      analysis.sentiment,
      analysis.compoundScore,
      analysis.emotion
    );
  },

  reanalyzeReview(reviewId) {
    const existing = db.reviews.findById(reviewId);
    if (!existing) throw new Error('Review not found.');
    const detection = fakeReviewDetectionService.inspect({
      db,
      userId: existing.user_id,
      targetType: existing.target_type,
      targetId: existing.target_id,
      reviewText: existing.review_text,
      rating: existing.rating
    });
    return {
      detection,
      review: db.reviews.updateReviewDetection(reviewId, detection)
    };
  },

  updateReview(reviewId, { userId, rating, reviewText }) {
    const existing = db.reviews.findById(reviewId);
    if (!existing) throw new Error('Review not found.');
    if (existing.user_id !== userId) throw new Error('You can only update your own review.');
    if (typeof reviewText !== 'string' || !reviewText.trim()) throw new Error('Review text is required.');
    const numRating = Number(rating);
    if (!Number.isFinite(numRating) || numRating < 1 || numRating > 5) throw new Error('Rating must be between 1 and 5.');
    const normalizedText = reviewText.trim();
    const analysis = this.analyzeText(normalizedText, numRating);
    const detection = fakeReviewDetectionService.inspect({
      db,
      userId,
      targetType: existing.target_type,
      targetId: existing.target_id,
      reviewText: normalizedText,
      rating: numRating
    });
    if (detection.exactDuplicate && normalizedText !== existing.review_text) {
      throw new Error('Duplicate review submission detected. Your existing review was not submitted again.');
    }
    const updated = db.reviews.update(reviewId, {
      rating: numRating,
      review_text: normalizedText,
      sentiment: analysis.sentiment,
      compound_score: analysis.compoundScore,
      emotion: analysis.emotion,
      aspects: analysis.aspects,
      is_flagged: detection.isSuspicious ? 1 : 0,
      review_status: existing.review_status,
      model_version: 'lexicon-v1',
      detector_version: detection.detectorVersion,
      suspicion_score: detection.suspicionScore,
      suspicion_reasons: detection.suspicionReasons,
      risk_category: detection.riskCategory,
      detection_analyzed_at: detection.analysisTimestamp
    });
    this.refreshDestinationRating(existing.target_type === 'destination' ? existing.target_id : null);
    return { success: true, review: updated, analysis };
  },

  deleteReview(reviewId, userId) {
    const existing = db.reviews.findById(reviewId);
    if (!existing) throw new Error('Review not found.');
    if (existing.user_id !== userId) throw new Error('You can only delete your own review.');
    db.reviews.delete(reviewId);
    this.refreshDestinationRating(existing.target_type === 'destination' ? existing.target_id : null);
    return { success: true };
  }
};
