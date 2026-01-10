import {
  VALUATION_THRESHOLDS,
  PROFITABILITY_THRESHOLDS,
  HEALTH_THRESHOLDS,
  GROWTH_THRESHOLDS,
  SCORE_WEIGHTS,
  RATING_THRESHOLDS,
  SCORE_COLORS,
  STATUS_THRESHOLDS,
  SECTOR_THRESHOLDS,
  DEFAULT_SECTOR
} from '../constants';

/**
 * Safely converts a value to float, returning default if invalid
 */
export const safeFloat = (value, defaultValue = 0) => {
  try {
    if (value === 'None' || value === null || value === '' || value === undefined) {
      return defaultValue;
    }
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  } catch {
    return defaultValue;
  }
};

/**
 * Scores a metric based on thresholds
 * @param {number} value - The metric value
 * @param {number} goodThreshold - Threshold for good score
 * @param {number} badThreshold - Threshold for bad score
 * @param {boolean} reverse - If true, lower values are better
 * @returns {number} Score from 0-100
 */
export const scoreMetric = (value, goodThreshold, badThreshold, reverse = false) => {
  if (value === null || value === 0 || isNaN(value)) {
    return 50;
  }

  if (!reverse) {
    // Higher is better
    if (value >= goodThreshold) return 100;
    if (value <= badThreshold) return 0;
    return Math.round(((value - badThreshold) / (goodThreshold - badThreshold)) * 100);
  } else {
    // Lower is better
    if (value <= goodThreshold) return 100;
    if (value >= badThreshold) return 0;
    return Math.round(((badThreshold - value) / (badThreshold - goodThreshold)) * 100);
  }
};

/**
 * Calculates average score from array of scores
 */
const calculateAverageScore = (scores) => {
  if (!scores || scores.length === 0) return 50;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
};

/**
 * Gets sector-specific thresholds or defaults
 */
export const getSectorThresholds = (sector) => {
  return SECTOR_THRESHOLDS[sector] || SECTOR_THRESHOLDS[DEFAULT_SECTOR];
};

/**
 * Calculates valuation score based on P/E, PEG, P/B, and P/S ratios
 */
export const calculateValuationScore = (metrics, sector) => {
  const thresholds = getSectorThresholds(sector);
  const scores = [];

  if (metrics.pe_ratio > 0) {
    scores.push(scoreMetric(
      metrics.pe_ratio,
      thresholds.PE_RATIO.good,
      thresholds.PE_RATIO.bad,
      true
    ));
  }

  if (metrics.peg_ratio > 0) {
    scores.push(scoreMetric(
      metrics.peg_ratio,
      thresholds.PEG_RATIO.good,
      thresholds.PEG_RATIO.bad,
      true
    ));
  }

  if (metrics.pb_ratio > 0) {
    scores.push(scoreMetric(
      metrics.pb_ratio,
      thresholds.PB_RATIO.good,
      thresholds.PB_RATIO.bad,
      true
    ));
  }

  if (metrics.ps_ratio > 0) {
    scores.push(scoreMetric(
      metrics.ps_ratio,
      thresholds.PS_RATIO.good,
      thresholds.PS_RATIO.bad,
      true
    ));
  }

  return calculateAverageScore(scores);
};

/**
 * Calculates profitability score based on margins and returns
 */
export const calculateProfitabilityScore = (metrics, sector) => {
  const thresholds = getSectorThresholds(sector);
  const scores = [];

  if (metrics.profit_margin > 0) {
    scores.push(scoreMetric(
      metrics.profit_margin,
      thresholds.PROFIT_MARGIN.good,
      thresholds.PROFIT_MARGIN.bad,
      false
    ));
  }

  if (metrics.operating_margin > 0) {
    scores.push(scoreMetric(
      metrics.operating_margin,
      thresholds.OPERATING_MARGIN.good,
      thresholds.OPERATING_MARGIN.bad,
      false
    ));
  }

  if (metrics.roe > 0) {
    scores.push(scoreMetric(
      metrics.roe,
      thresholds.ROE.good,
      thresholds.ROE.bad,
      false
    ));
  }

  if (metrics.roa > 0) {
    scores.push(scoreMetric(
      metrics.roa,
      thresholds.ROA.good,
      thresholds.ROA.bad,
      false
    ));
  }

  return calculateAverageScore(scores);
};

/**
 * Calculates financial health score based on liquidity and leverage ratios
 */
export const calculateHealthScore = (metrics, sector) => {
  const thresholds = getSectorThresholds(sector);
  const scores = [];

  if (metrics.current_ratio > 0) {
    scores.push(scoreMetric(
      metrics.current_ratio,
      thresholds.CURRENT_RATIO.good,
      thresholds.CURRENT_RATIO.bad,
      false
    ));
  }

  if (metrics.quick_ratio > 0) {
    scores.push(scoreMetric(
      metrics.quick_ratio,
      thresholds.QUICK_RATIO.good,
      thresholds.QUICK_RATIO.bad,
      false
    ));
  }

  if (metrics.debt_to_equity >= 0) {
    scores.push(scoreMetric(
      metrics.debt_to_equity,
      thresholds.DEBT_TO_EQUITY.good,
      thresholds.DEBT_TO_EQUITY.bad,
      true
    ));
  }

  return calculateAverageScore(scores);
};

/**
 * Calculates growth score based on revenue and EPS growth
 */
export const calculateGrowthScore = (metrics, sector) => {
  const thresholds = getSectorThresholds(sector);
  const scores = [];

  if (metrics.revenue_growth !== 0) {
    scores.push(scoreMetric(
      metrics.revenue_growth,
      thresholds.REVENUE_GROWTH.good,
      thresholds.REVENUE_GROWTH.bad,
      false
    ));
  }

  if (metrics.eps_growth !== 0) {
    scores.push(scoreMetric(
      metrics.eps_growth,
      thresholds.EPS_GROWTH.good,
      thresholds.EPS_GROWTH.bad,
      false
    ));
  }

  return calculateAverageScore(scores);
};

/**
 * Calculates overall score using weighted average
 */
export const calculateOverallScore = (scores) => {
  return Math.round(
    scores.valuation * SCORE_WEIGHTS.VALUATION +
    scores.profitability * SCORE_WEIGHTS.PROFITABILITY +
    scores.health * SCORE_WEIGHTS.HEALTH +
    scores.growth * SCORE_WEIGHTS.GROWTH
  );
};

/**
 * Gets rating label based on overall score
 */
export const getRating = (overallScore) => {
  for (const threshold of RATING_THRESHOLDS) {
    if (overallScore >= threshold.min) {
      return threshold.label;
    }
  }
  return 'N/A';
};

/**
 * Gets color for a given score
 */
export const getScoreColor = (score) => {
  if (score >= SCORE_COLORS.EXCELLENT.min) return SCORE_COLORS.EXCELLENT.color;
  if (score >= SCORE_COLORS.GOOD.min) return SCORE_COLORS.GOOD.color;
  return SCORE_COLORS.POOR.color;
};

/**
 * Formats market cap into readable string
 */
export const formatMarketCap = (marketCap) => {
  try {
    const mc = parseFloat(marketCap);
    if (isNaN(mc)) return 'N/A';

    if (mc >= 1e12) return `$${(mc / 1e12).toFixed(2)}T`;
    if (mc >= 1e9) return `$${(mc / 1e9).toFixed(2)}B`;
    if (mc >= 1e6) return `$${(mc / 1e6).toFixed(2)}M`;
    return `$${mc.toLocaleString()}`;
  } catch {
    return 'N/A';
  }
};

/**
 * Determines status indicator for a metric
 */
export const getMetricStatus = (metricName, value) => {
  const thresholds = STATUS_THRESHOLDS[metricName];
  if (!thresholds || value <= 0) return 'caution';

  const isReverse = ['PE_RATIO', 'PEG_RATIO', 'PB_RATIO', 'PS_RATIO', 'DEBT_TO_EQUITY'].includes(metricName);

  if (isReverse) {
    if (value < thresholds.good) return 'good';
    if (value < thresholds.caution) return 'caution';
    return 'bad';
  } else {
    if (value > thresholds.good) return 'good';
    if (value > thresholds.caution) return 'caution';
    return 'bad';
  }
};

/**
 * Formats a metric value for display
 */
export const formatMetricValue = (value, isPercentage = false, decimals = 2) => {
  if (value === null || value === undefined || value === 0 || isNaN(value)) {
    return 'N/A';
  }

  const formatted = value.toFixed(decimals);
  return isPercentage ? `${formatted}%` : formatted;
};
