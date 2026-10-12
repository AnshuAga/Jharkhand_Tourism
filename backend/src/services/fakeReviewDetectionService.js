const DETECTOR_VERSION = 'rules-v1';
const MAX_RECENT_REVIEWS = 20;
const MIN_NEAR_DUPLICATE_LENGTH = 24;
const HIGH_RISK_THRESHOLD = Number(process.env.FAKE_REVIEW_HIGH_RISK_THRESHOLD) || 0.65;
const MEDIUM_RISK_THRESHOLD = Number(process.env.FAKE_REVIEW_MEDIUM_RISK_THRESHOLD) || 0.35;

function isAutomaticPublicationEnabled() {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env.REVIEWS_AUTO_PUBLISH || '').toLowerCase());
}

function getMediumRiskAction() {
  return String(process.env.REVIEWS_MEDIUM_RISK_ACTION || 'hold').toLowerCase() === 'publish'
    ? 'publish'
    : 'hold';
}

function normalizeText(text) {
  return String(text || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function tokenSet(text) {
  return new Set(normalizeText(text).split(' ').filter(Boolean));
}

function jaccardSimilarity(left, right) {
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / new Set([...a, ...b]).size;
}

function suspiciousPromotionPattern(text) {
  const normalized = normalizeText(text);
  return /(whatsapp|call now|limited offer|buy now|visit my|discount|guaranteed|www|https?|contact me)/i.test(normalized);
}

function repetitivePattern(text) {
  const tokens = normalizeText(text).split(' ').filter(Boolean);
  if (tokens.length < 6) return false;
  const counts = tokens.reduce((result, token) => {
    result[token] = (result[token] || 0) + 1;
    return result;
  }, {});
  return Object.values(counts).some((count) => count >= 4);
}

export const fakeReviewDetectionService = {
  detectorVersion: DETECTOR_VERSION,
  isAutomaticPublicationEnabled,
  getMediumRiskAction,

  /**
   * Rule-based screening only; scores rank review risk for moderation.
   * Signals: normalized exact duplicate, near duplicate, five-plus reviews
   * in 24 hours, promotional/contact-sharing language, repeated tokens, and
   * rating-text mismatch (a non-conclusive signal).
   */
  inspect({ db, userId, targetType, targetId, reviewText, rating, automaticPublicationEnabled } = {}) {
    const normalized = normalizeText(reviewText);
    const reasons = [];
    let score = 0;
    const sameUserReviews = db.reviews.listByUserTarget(userId, targetType, targetId, MAX_RECENT_REVIEWS);

    const exactDuplicate = sameUserReviews.some((review) => normalizeText(review.review_text) === normalized);
    if (exactDuplicate) {
      reasons.push('Exact duplicate text for this account and destination');
      score += 0.8;
    }

    if (normalized.length >= MIN_NEAR_DUPLICATE_LENGTH && sameUserReviews.some((review) => (
      jaccardSimilarity(review.review_text, reviewText) >= 0.9
    ))) {
      reasons.push('Near-duplicate text for this account and destination');
      score += 0.65;
    }

    const recentUserReviews = db.reviews.listByUserSince(userId, Date.now() - 24 * 60 * 60 * 1000);
    if (recentUserReviews.length >= 5) {
      reasons.push('Unusual submission frequency: five or more reviews in 24 hours');
      score += 0.35;
    }

    if (suspiciousPromotionPattern(reviewText)) {
      reasons.push('Promotional or contact-sharing pattern detected');
      score += 0.35;
    }

    if (repetitivePattern(reviewText)) {
      reasons.push('Repetitive text pattern detected');
      score += 0.25;
    }

    const sentimentBearing = /\b(good|great|excellent|beautiful|bad|terrible|dirty|unsafe|poor|worst)\b/i.test(reviewText);
    if (sentimentBearing && ((rating >= 4 && /\b(bad|terrible|dirty|unsafe|poor|worst)\b/i.test(reviewText)) ||
      (rating <= 2 && /\b(good|great|excellent|beautiful)\b/i.test(reviewText)))) {
      reasons.push('Rating-text mismatch; requires human review, not proof of fraud');
      score += 0.15;
    }

    const suspicionScore = Math.min(1, Math.round(score * 100) / 100);
    const actionableReasons = reasons.filter((reason) => !reason.startsWith('Rating-text mismatch'));
    const riskCategory = suspicionScore >= HIGH_RISK_THRESHOLD
      ? 'high'
      : suspicionScore >= MEDIUM_RISK_THRESHOLD
        ? 'medium'
        : 'low';
    const suspicious = actionableReasons.length > 0 && riskCategory !== 'low';
    const publicationEnabled = typeof automaticPublicationEnabled === 'boolean'
      ? automaticPublicationEnabled
      : isAutomaticPublicationEnabled();
    const mediumRiskAction = getMediumRiskAction();
    const canAutoPublish = publicationEnabled && (
      riskCategory === 'low' ||
      (riskCategory === 'medium' && mediumRiskAction === 'publish')
    );
    const reviewStatus = canAutoPublish
      ? 'published'
      : 'pending_review';
    return {
      detectorVersion: DETECTOR_VERSION,
      exactDuplicate,
      suspicionScore,
      suspicionReasons: reasons,
      isSuspicious: suspicious,
      riskCategory,
      analysisTimestamp: new Date().toISOString(),
      reviewStatus,
      publicationStatus: reviewStatus === 'published' ? 'published' : 'pending',
      automaticPublicationEnabled: publicationEnabled,
      mediumRiskAction
    };
  }
};
