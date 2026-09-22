import { db } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';

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

// Aspect lexicons
const ASPECT_KEYWORDS = {
  cleanliness: ['clean', 'dirty', 'hygiene', 'waste', 'garbage', 'trash', 'dust', 'tidy', 'spotless', 'filthy', 'unhygienic'],
  hospitality: ['guide', 'host', 'service', 'friendly', 'staff', 'polite', 'rude', 'welcome', 'behavior', 'attitude', 'helpful', 'careless'],
  transport: ['road', 'bus', 'cab', 'driver', 'transit', 'car', 'delay', 'traffic', 'reach', 'parking', 'punctual'],
  food: ['food', 'cuisine', 'dish', 'meal', 'dhuska', 'taste', 'tea', 'breakfast', 'dinner', 'restaurant', 'sweet', 'delicious', 'stale'],
  safety: ['safe', 'safety', 'guard', 'secure', 'danger', 'lighting', 'isolated', 'family', 'security', 'police', 'unsafe']
};

export const sentimentService = {
  /**
   * Deterministic Aspect-Based Sentiment Analysis (ABSA) with zero randomness
   */
  analyzeText(text, userRating = 5) {
    if (!text || typeof text !== 'string') {
      const normalizedScore = (userRating - 3) / 2; // maps 1..5 to -1..1
      return {
        compoundScore: normalizedScore,
        sentiment: userRating >= 4 ? 'Positive' : userRating <= 2 ? 'Negative' : 'Neutral',
        emotion: userRating >= 4 ? 'Happy' : userRating <= 2 ? 'Disappointed' : 'Neutral',
        aspects: { cleanliness: userRating, hospitality: userRating, transport: userRating, food: userRating, safety: userRating }
      };
    }

    const tokens = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/);

    let posCount = 0;
    let negCount = 0;

    tokens.forEach(token => {
      if (POSITIVE_WORDS.includes(token)) posCount++;
      if (NEGATIVE_WORDS.includes(token)) negCount++;
    });

    const total = posCount + negCount;
    // Compound score normalized between -1.0 and 1.0
    let compoundScore = total === 0
      ? (userRating - 3) / 2
      : (posCount - negCount) / Math.sqrt(posCount * posCount + negCount * negCount + 10);

    compoundScore = Math.max(-1, Math.min(1, Math.round(compoundScore * 100) / 100));

    let sentiment = 'Neutral';
    if (compoundScore >= 0.15 || userRating >= 4) sentiment = 'Positive';
    else if (compoundScore <= -0.15 || userRating <= 2) sentiment = 'Negative';

    // Emotion extraction
    let emotion = 'Neutral';
    if (compoundScore > 0.5) emotion = 'Excited';
    else if (compoundScore > 0.1) emotion = 'Happy';
    else if (compoundScore < -0.4) emotion = 'Frustrated';
    else if (compoundScore < 0) emotion = 'Disappointed';

    // Aspect-Based Sentiment Extraction: Base on user rating, adjust strictly by matched sentiment words
    const baseAspect = Number(userRating);
    const aspects = {
      cleanliness: baseAspect,
      hospitality: baseAspect,
      transport: baseAspect,
      food: baseAspect,
      safety: baseAspect
    };

    for (const [aspect, keywords] of Object.entries(ASPECT_KEYWORDS)) {
      const matched = keywords.filter(k => tokens.includes(k));
      if (matched.length > 0) {
        let aspectPos = matched.filter(k => POSITIVE_WORDS.includes(k)).length;
        let aspectNeg = matched.filter(k => NEGATIVE_WORDS.includes(k)).length;

        if (aspectNeg > aspectPos) {
          aspects[aspect] = Math.max(1.0, baseAspect - 1.5);
        } else if (aspectPos > aspectNeg) {
          aspects[aspect] = Math.min(5.0, baseAspect + 0.5);
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
  submitReview({ bookingId, destinationId, destinationName, providerId, userId, userName, rating, reviewText }) {
    const numRating = Number(rating) || 5;
    const analysis = this.analyzeText(reviewText, numRating);

    const isFlagged = numRating < 2.5 || analysis.sentiment === 'Negative' ? 1 : 0;

    const newReview = db.reviews.create({
      id: `rev-${uuidv4().slice(0, 8)}`,
      booking_id: bookingId || null,
      user_id: userId || 'usr-tourist-anonymous',
      user_name: userName || 'Explorer',
      target_type: destinationId ? 'destination' : 'provider',
      target_id: destinationId || providerId || 'netarhat',
      rating: numRating,
      review_text: reviewText,
      sentiment: analysis.sentiment,
      compound_score: analysis.compoundScore,
      emotion: analysis.emotion,
      aspects: analysis.aspects,
      is_flagged: isFlagged
    });

    // Update destination review stats in database if destination
    if (destinationId) {
      const dest = db.destinations.findById(destinationId);
      if (dest) {
        const destReviews = db.reviews.listByTarget('destination', destinationId);
        const newCount = destReviews.length;
        const newAvg = Math.round((destReviews.reduce((sum, r) => sum + r.rating, 0) / newCount) * 10) / 10;
        db.destinations.update(destinationId, { rating: newAvg, review_count: newCount });
      }
    }

    // Trigger quality alert for admin if negative review
    if (isFlagged) {
      db.transport.createAlert({
        id: `alert-ql-${Date.now()}`,
        type: 'Quality Flag',
        severity: 'Warning',
        title: `Low Tourist Rating Alert: ${destinationName || providerId}`,
        location: destinationName || 'Jharkhand',
        message: `A tourist submitted a low rating (${numRating}/5.0). Feedback: "${reviewText.slice(0, 120)}..."`,
        created_by: userId
      });
    }

    return {
      success: true,
      review: newReview,
      analysis,
      qualityAlertTriggered: isFlagged === 1
    };
  },

  /**
   * Get real sentiment analytics strictly from database reviews
   */
  getSentimentAnalytics() {
    const stats = db.reviews.stats();
    if (!stats) {
      return {
        hasData: false,
        message: 'No data available',
        totalReviews: 0,
        sentimentDistribution: { positivePercent: 0, neutralPercent: 0, negativePercent: 0, rawCounts: { Positive: 0, Neutral: 0, Negative: 0 } },
        aspectScores: {},
        recentReviews: []
      };
    }

    const recentReviews = db.reviews.listAll(10);

    return {
      hasData: true,
      totalReviews: stats.totalReviews,
      sentimentDistribution: stats.sentimentDistribution,
      aspectScores: stats.aspectScores,
      recentReviews
    };
  }
};
