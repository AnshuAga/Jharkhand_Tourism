import { db, sqlite } from '../database/db.js';

export const RECOMMENDATION_WEIGHTS = Object.freeze({
  interest: 0.30,
  sentiment: 0.25,
  rating: 0.20,
  budget: 0.15,
  duration: 0.10
});

const MAX_RESULTS = 12;
export const MIN_TOP_RATED_REVIEWS = 2;
export const REVIEW_SMOOTHING = 3;

function toArray(value) {
  if (Array.isArray(value)) return value.map(String).map(item => item.toLowerCase().trim()).filter(Boolean);
  if (typeof value === 'string') {
    try { return toArray(JSON.parse(value)); } catch { return value.split(',').map(item => item.toLowerCase().trim()).filter(Boolean); }
  }
  return [];
}

function normalizePreferences(input = {}) {
  const budget = Number(input.budget);
  const duration = Number(input.travelDuration ?? input.travel_duration);
  const interests = toArray(input.interests);
  const categories = toArray(input.categories ?? input.preferredCategories ?? input.preferred_categories);
  const groupType = String(input.groupType ?? input.group_type ?? '').toLowerCase().trim();
  const travelers = Math.max(1, Number(input.travelers ?? input.groupSize ?? input.group_size) || 1);
  const startDate = String(input.startDate ?? input.start_date ?? input.tripDate ?? '').slice(0, 10);
  const endDate = String(input.endDate ?? input.end_date ?? '').slice(0, 10);
  const destination = String(input.destination ?? input.district ?? '').trim().toLowerCase();
  const accommodation = toArray(input.accommodation ?? input.accommodationPreferences ?? input.accommodation_preferences);
  const accessibility = toArray(input.accessibility ?? input.accessibilityRequirements ?? input.accessibility_requirements);

  return {
    budget: Number.isFinite(budget) && budget > 0 ? budget : null,
    duration: Number.isFinite(duration) && duration > 0 ? Math.min(Math.round(duration), 60) : null,
    interests,
    categories,
    groupType,
    startLocation: String(input.startingLocation ?? input.starting_location ?? '').trim(),
    travelers,
    startDate: startDate || null,
    endDate: endDate || null,
    destination: destination || null,
    accommodation,
    accessibility
  };
}

function textFor(item) {
  return [
    item.name,
    item.title,
    item.category,
    item.district,
    item.description,
    ...toArray(item.interests),
    ...toArray(item.amenities)
  ].filter(Boolean).join(' ').toLowerCase();
}

function normalizeInterest(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[&/]+/g, ' and ')
    .replace(/\b(waterfall|falls?)\b/g, 'waterfalls')
    .replace(/\s+/g, ' ');
}

function interestTerms(value) {
  const normalized = normalizeInterest(value);
  const aliases = {
    nature: ['nature', 'natural', 'forest', 'eco', 'wildlife'],
    waterfalls: ['waterfalls', 'waterfall', 'falls'],
    spiritual: ['spiritual', 'religious', 'temple', 'pilgrimage'],
    heritage: ['heritage', 'history', 'historical', 'culture']
  };
  return aliases[normalized] || [normalized];
}

function eligibleRatingBaseline() {
  return sqlite.prepare(`
    SELECT COUNT(*) AS count, AVG(rating) AS average
    FROM reviews
    WHERE target_type = 'destination'
      AND publication_status = 'published'
      AND review_status = 'published'
      AND COALESCE(verified_fake_label, '') != 'fake'
      AND rating >= 1 AND rating <= 5
  `).get();
}

function attributeScore(item) {
  const attributes = [
    item.category,
    item.district,
    item.description,
    ...toArray(item.interests),
    ...toArray(item.activities),
    ...toArray(item.attractions)
  ];
  return Math.min(1, attributes.filter(Boolean).length / 6);
}

function reviewSummary(targetType, targetId, baseline = {}) {
  const reviews = db.reviews.listByTarget(targetType, targetId, { publishedOnly: true });
  const eligibleReviews = reviews.filter(review => review.verified_fake_label !== 'fake');
  if (!eligibleReviews.length) return null;
  const ratedReviews = eligibleReviews.filter(review =>
    Number.isFinite(Number(review.rating)) && Number(review.rating) >= 1 && Number(review.rating) <= 5
  );

  const sentimentCounts = { Positive: 0, Neutral: 0, Negative: 0, Mixed: 0 };
  const aspectSums = {};
  const aspectSentimentCounts = {};
  eligibleReviews.forEach((review) => {
    const label = review.verified_sentiment || review.sentiment;
    sentimentCounts[label] = (sentimentCounts[label] || 0) + 1;
    Object.entries(review.aspects || {}).forEach(([aspect, value]) => {
      const label = typeof value === 'string'
        ? value
        : typeof value === 'number'
          ? value >= 3.5 ? 'Positive' : value <= 2.5 ? 'Negative' : 'Neutral'
          : null;
      if (Number.isFinite(Number(value))) aspectSums[aspect] = (aspectSums[aspect] || 0) + Number(value);
      if (label) {
        aspectSentimentCounts[aspect] ||= { Positive: 0, Negative: 0, Neutral: 0 };
        aspectSentimentCounts[aspect][label] = (aspectSentimentCounts[aspect][label] || 0) + 1;
      }
    });
  });

  const averageCompound = eligibleReviews.reduce((sum, review) => sum + Number(review.compound_score || 0), 0) / eligibleReviews.length;
  const averageRating = ratedReviews.length
    ? ratedReviews.reduce((sum, review) => sum + Number(review.rating), 0) / ratedReviews.length
    : null;
  const analyzedReviews = eligibleReviews.filter(review =>
    review.sentiment && Number.isFinite(Number(review.compound_score))
  );
  const aspectScores = Object.fromEntries(
    Object.entries(aspectSums).map(([aspect, total]) => [aspect, Math.round((total / eligibleReviews.length) * 10) / 10])
  );

  const reliability = Math.min(1, eligibleReviews.length / 3);
  const adjustedRating = ratedReviews.length && Number.isFinite(Number(baseline.average))
    ? ((ratedReviews.length / (ratedReviews.length + REVIEW_SMOOTHING)) * averageRating)
      + ((REVIEW_SMOOTHING / (ratedReviews.length + REVIEW_SMOOTHING)) * Number(baseline.average))
    : null;
  const positive = sentimentCounts.Positive + (sentimentCounts.Mixed * 0.5);
  const negative = sentimentCounts.Negative + (sentimentCounts.Mixed * 0.5);
  return {
    reviewCount: eligibleReviews.length,
    averageRating: averageRating === null ? null : Math.round(averageRating * 10) / 10,
    adjustedRating: adjustedRating === null ? null : Math.round(adjustedRating * 100) / 100,
    ratingCount: ratedReviews.length,
    analyzedReviewCount: analyzedReviews.length,
    reviewConfidence: Math.min(1, eligibleReviews.length / (eligibleReviews.length + 3)),
    label: positive > negative && averageCompound >= 0.15 ? 'Positive' : negative > positive && averageCompound <= -0.15 ? 'Negative' : 'Mixed',
    averageCompound: Math.round(averageCompound * 100) / 100,
    sentimentCounts,
    aspectScores,
    aspectSentimentCounts,
    reliability
  };
}

function itemScore(item, type, preferences, baseline) {
  const attributeFields = [
    ['category', item.category],
    ['district', item.district],
    ['description', item.description],
    ['interests', toArray(item.interests).join(' ')],
    ['activities', toArray(item.activities).join(' ')],
    ['attractions', toArray(item.attractions).join(' ')]
  ].filter(([, value]) => value).map(([source, value]) => [source, normalizeInterest(value)]);
  const fields = attributeFields.map(([, value]) => value);
  const matchingInterests = preferences.interests.filter(interest =>
    interestTerms(interest).some(term => fields.some(field => field.split(/\s+/).includes(term) || field.includes(term)))
  );
  const matchingCategories = preferences.categories.filter(category =>
    interestTerms(category).some(term => fields.some(field => field.includes(term)))
  );
  const interestMatches = [...new Set([...matchingInterests, ...matchingCategories])];
  const matchedInterestEvidence = interestMatches.map((interest) => ({
    interest,
    attributes: attributeFields
      .filter(([, field]) => interestTerms(interest).some(term => field.split(/\s+/).includes(term) || field.includes(term)))
      .map(([source]) => source)
  }));
  const interestScore = preferences.interests.length || preferences.categories.length
    ? Math.min(1, interestMatches.length / Math.max(1, preferences.interests.length + preferences.categories.length))
    : attributeScore(item);

  const reviews = reviewSummary(type, item.id, baseline);
  const ratingValue = reviews?.averageRating ?? null;
  // Ratings used here are derived only from published reviews in the reviews table.
  const reviewCount = reviews?.reviewCount || 0;
  const ratingScore = Number.isFinite(reviews?.adjustedRating) && reviewCount > 0
    ? Math.max(0, Math.min(1, reviews.adjustedRating / 5))
    : null;
  const sentimentScore = reviews
    ? 0.5 + (((reviews.averageCompound + 1) / 2) - 0.5) * reviews.reliability
    : null;

  const price = Number(type === 'destination' ? item.avg_cost : item.price);
  const budgetScore = preferences.budget && Number.isFinite(price) && price >= 0
    ? Math.max(0, Math.min(1, price <= preferences.budget ? 1 : preferences.budget / price))
    : null;

  const itemDuration = Number(item.duration_days);
  const durationScore = preferences.duration && Number.isFinite(itemDuration) && itemDuration > 0
    ? Math.max(0, Math.min(1, itemDuration <= preferences.duration ? 1 : preferences.duration / itemDuration))
    : null;

  const components = { interest: interestScore, sentiment: sentimentScore, rating: ratingScore, budget: budgetScore, duration: durationScore };
  const available = Object.entries(components).filter(([, value]) => value !== null);
  const weightTotal = available.reduce((sum, [key]) => sum + RECOMMENDATION_WEIGHTS[key], 0);
  const configuredWeightTotal = Object.values(RECOMMENDATION_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  const score = weightTotal > 0
    ? available.reduce((sum, [key, value]) => sum + (value * RECOMMENDATION_WEIGHTS[key]), 0) / weightTotal
    : 0;

  const reasons = [];
  if (matchingInterests.length) {
    const evidenceAttributes = [...new Set(matchedInterestEvidence.flatMap(({ attributes }) => attributes))];
    reasons.push(`Matches ${matchingInterests.slice(0, 2).join(' and ')} interest${matchingInterests.length > 1 ? 's' : ''} through ${evidenceAttributes.join(', ')}`);
  }
  if (budgetScore !== null) reasons.push(budgetScore >= 0.8 ? 'Fits your budget' : 'May require extra budget');
  if (reviews && reviews.reviewCount >= MIN_TOP_RATED_REVIEWS) reasons.push(`Supported by ${reviews.reviewCount} eligible visitor ratings`);
  if (reviews && ratingValue < 3.5) reasons.push(`Current visitor rating reduces ranking; evidence is limited to ${reviews.reviewCount} review${reviews.reviewCount === 1 ? '' : 's'}`);
  if (!reasons.length) reasons.push('Recommended from destination attributes');
  if (durationScore !== null) reasons.push(durationScore >= 0.8 ? 'Fits your trip duration' : 'Longer than your selected duration');
  if (!reasons.length) reasons.push('Available item from the Jharkhand tourism catalogue');

  return {
    score: Math.round(score * 100),
    finalRecommendationScore: Math.round(score * 100),
    scoreBasis: 'available evidence with missing factors excluded and remaining weights renormalized',
    evidenceCoverage: {
      availableWeight: Math.round(weightTotal * 100) / 100,
      configuredWeight: Math.round(configuredWeightTotal * 100) / 100,
      percentage: Math.round((weightTotal / configuredWeightTotal) * 100),
      label: weightTotal === configuredWeightTotal ? 'Complete configured evidence' : 'Partial configured evidence'
    },
    rankingExplanation: reasons.length
      ? `${reasons.join('. ')}. Final score is based on ${Math.round((weightTotal / configuredWeightTotal) * 100)}% of configured factor weight because unavailable factors are excluded.`
      : `Final score is based on ${Math.round((weightTotal / configuredWeightTotal) * 100)}% of configured factor weight because unavailable factors are excluded.`,
    factorBreakdown: Object.fromEntries(Object.entries(components).map(([key, value]) => [key, {
      value: value === null ? null : Math.round(value * 100) / 100,
      weight: RECOMMENDATION_WEIGHTS[key],
      available: value !== null,
      contribution: value === null ? 0 : Math.round((value * RECOMMENDATION_WEIGHTS[key] / weightTotal) * 10000) / 10000,
      status: value === null ? 'unavailable and excluded from normalized score' : 'included'
    }])),
    availableFactors: available.map(([key]) => key),
    normalizedWeightTotal: Math.round(weightTotal * 100) / 100,
    matchingInterests: interestMatches,
    matchedInterestEvidence,
    interestMatchScore: Math.round(interestScore * 100),
    matchExplanation: matchingInterests.length
      ? reasons[0]
      : 'Recommended based on destination attributes',
    rating: ratingValue,
    ratingLabel: Number.isFinite(ratingValue) && reviewCount > 0 ? `${ratingValue.toFixed(1)}/5` : null,
    reviewCount,
    ratingCount: reviews?.ratingCount || 0,
    analyzedReviewCount: reviews?.analyzedReviewCount || 0,
    reviewConfidence: reviews?.reviewConfidence || 0,
    adjustedRating: reviews?.adjustedRating ?? null,
    reviewEvidence: reviewCount === 0 ? 'No eligible visitor reviews' : reviewCount < MIN_TOP_RATED_REVIEWS ? 'Very limited' : 'Established',
    sentiment: reviews,
    estimatedCost: Number.isFinite(price) ? price : null,
    reasons,
    dataLimitations: [
      ratingScore === null && 'No eligible visitor ratings',
      budgetScore === null && 'Verified price data is unavailable',
      durationScore === null && 'Duration data is unavailable'
    ].filter(Boolean)
  };
}

function mapRecommendation(item, type, preferences, baseline) {
  const scored = itemScore(item, type, preferences, baseline);
  return {
    id: item.id,
    type,
    name: item.name || item.title,
    title: item.title || item.name,
    category: item.category,
    district: item.district,
    image: item.image || null,
    description: item.description,
    bestSeason: item.best_season || null,
    activities: toArray(item.activities),
    attractions: toArray(item.attractions),
    interests: toArray(item.interests),
    itinerary: item.availability?.itinerary || [],
    destinations: item.availability?.destinations || [],
    inclusions: item.availability?.inclusions || item.amenities || [],
    exclusions: item.availability?.exclusions || [],
    cancellationPolicy: item.availability?.cancellationPolicy || null,
    bookingConditions: item.availability?.bookingConditions || item.availability?.bookingNotice || null,
    roomTypes: item.availability?.roomTypes || [],
    provider: item.provider_name ? {
      id: item.provider_id,
      name: item.provider_name,
      businessName: item.business_name || null,
      languages: toArray(item.provider_languages),
      services: item.provider_specialization || null,
      location: item.provider_address || item.district
    } : null,
    availability: {
      verified: item.availabilityVerified ?? false,
      status: item.availabilityStatus || 'confirmation-required'
    },
    available: item.availabilityStatus !== 'unavailable',
    ...scored
  };
}

export const recommendationService = {
  getRecommendations(input = {}) {
    const preferences = normalizePreferences(input);
    const baseline = eligibleRatingBaseline();
    const requestedType = String(input.type || 'all').toLowerCase();
    const limit = Math.min(Math.max(Number(input.limit) || 6, 1), MAX_RESULTS);
    const destinationItems = requestedType === 'all' || requestedType === 'destinations'
      ? db.destinations.list({ onlyActive: true }) : [];
    const productItems = requestedType === 'all' || requestedType === 'products'
      ? db.products.list({ onlyApproved: true, limit: 100 }).filter(item => Number(item.stock) > 0) : [];
    let serviceItems = requestedType === 'all' || ['services', 'hotels', 'packages'].includes(requestedType)
      ? db.services.list({
        category: requestedType === 'hotels' ? 'homestay' : requestedType === 'packages' ? 'package' : undefined,
        district: preferences.destination || undefined,
        startDate: preferences.startDate,
        endDate: preferences.endDate,
        travelers: preferences.travelers,
        onlyBookable: true
      }) : [];
    if (preferences.budget) {
      serviceItems = serviceItems.filter((item) => Number(item.price) <= preferences.budget);
    }
    if (preferences.accommodation.length) {
      serviceItems = serviceItems.filter((item) =>
        item.category !== 'homestay' || preferences.accommodation.some((term) =>
          textFor(item).includes(term)
        )
      );
    }
    if (preferences.accessibility.length) {
      serviceItems = serviceItems.filter((item) =>
        preferences.accessibility.every((requirement) => textFor(item).includes(requirement))
      );
    }

    const all = [
      ...destinationItems.map(item => mapRecommendation(item, 'destination', preferences, baseline)),
      ...productItems.map(item => mapRecommendation(item, 'product', preferences)),
      ...serviceItems.map(item => mapRecommendation(item, 'service', preferences))
    ].sort((left, right) => right.score - left.score || String(left.name).localeCompare(String(right.name)));

    return {
      success: true,
      source: 'live-catalogue',
      preferences,
      weights: RECOMMENDATION_WEIGHTS,
      count: Math.min(all.length, limit),
      catalogue: {
        activeDestinations: destinationItems.length,
        availableProducts: productItems.length,
        availableServices: serviceItems.length,
        genuineReviews: sqlite.prepare(`
          SELECT COUNT(*) AS count FROM reviews
          WHERE target_type = 'destination'
            AND publication_status = 'published'
            AND review_status = 'published'
            AND COALESCE(verified_fake_label, '') != 'fake'
        `).get().count
      },

      recommendations: all.slice(0, limit),
      topRated: all
        .filter(item => item.type === 'destination' && item.reviewCount >= MIN_TOP_RATED_REVIEWS && item.rating !== null)
        .slice(0, limit),
      limitations: [
        'Distance and travel-time data is not available in the current catalogue, so it is not included in ranking.',
        `Top Rated by Visitors requires at least ${MIN_TOP_RATED_REVIEWS} eligible published ratings; other destinations use catalogue attributes.`
      ]
    };
  },

  getAnalytics() {
    const destinations = db.destinations.list({ onlyActive: true });
    const scored = destinations.map(item => mapRecommendation(item, 'destination', normalizePreferences(), eligibleRatingBaseline()));
    const withRatings = scored.filter(item => item.ratingCount > 0);
    const withoutReviews = scored.filter(item => item.reviewCount === 0);
    const withSentiment = scored.filter(item => item.analyzedReviewCount > 0);
    const concerning = scored.filter(item =>
      item.reviewCount >= MIN_TOP_RATED_REVIEWS && item.rating !== null && item.rating < 3
    );

    return {
      success: true,
      role: 'admin',
      catalogue: {
        destinationCount: scored.length,
        destinationsWithEligibleRatings: withRatings.length,
        destinationsWithoutReviewHistory: withoutReviews.length,
        destinationsWithAnalyzedSentiment: withSentiment.length
      },
      concerningDestinations: concerning.map(({ id, name, rating, reviewCount, sentiment }) => ({
        id, name, rating, reviewCount, sentiment: sentiment?.label || null
      })),
      insufficientEvidence: scored
        .filter(item => item.reviewCount > 0 && item.reviewCount < MIN_TOP_RATED_REVIEWS)
        .map(({ id, name, reviewCount }) => ({ id, name, reviewCount })),
      ranking: {
        weights: RECOMMENDATION_WEIGHTS,
        minimumTopRatedReviews: MIN_TOP_RATED_REVIEWS,
        factors: [
          'Interest and category match',
          'Review sentiment adjusted by review volume',
          'Rating adjusted by review confidence',
          'Budget fit when supplied',
          'Trip duration fit when supplied'
        ]
      },
      destinations: scored
    };
  },

  recordInteraction({ userId, recommendationId, recommendationType, action }) {
    const allowedActions = ['impression', 'view', 'save', 'book', 'dismiss'];
    if (!allowedActions.includes(action)) throw new Error('Unsupported recommendation interaction.');
    sqlite.prepare(`
      INSERT INTO recommendation_interactions (id, user_id, recommendation_id, recommendation_type, action, created_at)
      VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(userId, recommendationId, recommendationType, action);
  }
};
