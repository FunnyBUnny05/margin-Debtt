// Alpha Vantage API Configuration
export const ALPHA_VANTAGE_API_KEY = 'BMXVEAN3LEOUMTU3';
export const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query';

// Scoring Thresholds
export const VALUATION_THRESHOLDS = {
  PE_RATIO: { good: 15, bad: 30 },
  PEG_RATIO: { good: 1, bad: 2 },
  PB_RATIO: { good: 1.5, bad: 5 },
  PS_RATIO: { good: 2, bad: 10 }
};

export const PROFITABILITY_THRESHOLDS = {
  PROFIT_MARGIN: { good: 20, bad: 5 },
  OPERATING_MARGIN: { good: 20, bad: 5 },
  ROE: { good: 20, bad: 8 },
  ROA: { good: 10, bad: 3 }
};

export const HEALTH_THRESHOLDS = {
  CURRENT_RATIO: { good: 2, bad: 1 },
  QUICK_RATIO: { good: 1.5, bad: 0.5 },
  DEBT_TO_EQUITY: { good: 0.5, bad: 2 }
};

export const GROWTH_THRESHOLDS = {
  REVENUE_GROWTH: { good: 15, bad: 0 },
  EPS_GROWTH: { good: 20, bad: 0 }
};

// Score Color Thresholds
export const SCORE_COLORS = {
  EXCELLENT: { min: 70, color: 'var(--accent-emerald)' },
  GOOD: { min: 40, color: 'var(--accent-blue)' },
  POOR: { min: 0, color: 'var(--accent-coral)' }
};

// Rating Thresholds
export const RATING_THRESHOLDS = [
  { min: 75, label: 'STRONG BUY' },
  { min: 65, label: 'BUY' },
  { min: 45, label: 'HOLD' },
  { min: 35, label: 'SELL' },
  { min: 0, label: 'STRONG SELL' }
];

// Score Weights
export const SCORE_WEIGHTS = {
  VALUATION: 0.25,
  PROFITABILITY: 0.30,
  HEALTH: 0.25,
  GROWTH: 0.20
};

// Status Indicator Thresholds
export const STATUS_THRESHOLDS = {
  PE_RATIO: { good: 20, caution: 30 },
  PEG_RATIO: { good: 1.5, caution: 2 },
  PB_RATIO: { good: 3, caution: 5 },
  PS_RATIO: { good: 3, caution: 7 },
  PROFIT_MARGIN: { good: 15, caution: 5 },
  OPERATING_MARGIN: { good: 15, caution: 5 },
  ROE: { good: 15, caution: 8 },
  ROA: { good: 8, caution: 3 },
  CURRENT_RATIO: { good: 2, caution: 1 },
  QUICK_RATIO: { good: 1.5, caution: 0.5 },
  DEBT_TO_EQUITY: { good: 0.5, caution: 1.5 },
  REVENUE_GROWTH: { good: 15, caution: 5 },
  EPS_GROWTH: { good: 20, caution: 10 },
  DIVIDEND_YIELD: { good: 2, caution: 0 }
};
