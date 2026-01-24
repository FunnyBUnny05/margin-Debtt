// Alpha Vantage API Configuration
// API key is loaded from environment variable for security
export const ALPHA_VANTAGE_API_KEY = import.meta.env.VITE_ALPHA_VANTAGE_API_KEY || '';
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

// Sector-Specific Thresholds
export const SECTOR_THRESHOLDS = {
  'Technology': {
    PE_RATIO: { good: 20, bad: 40 },
    PEG_RATIO: { good: 1.5, bad: 3 },
    PB_RATIO: { good: 3, bad: 8 },
    PS_RATIO: { good: 5, bad: 15 },
    PROFIT_MARGIN: { good: 20, bad: 10 },
    OPERATING_MARGIN: { good: 25, bad: 10 },
    ROE: { good: 20, bad: 10 },
    ROA: { good: 12, bad: 5 },
    CURRENT_RATIO: { good: 2, bad: 1 },
    QUICK_RATIO: { good: 1.5, bad: 0.8 },
    DEBT_TO_EQUITY: { good: 0.3, bad: 1 },
    REVENUE_GROWTH: { good: 20, bad: 5 },
    EPS_GROWTH: { good: 25, bad: 5 }
  },
  'Financial Services': {
    PE_RATIO: { good: 12, bad: 20 },
    PEG_RATIO: { good: 1, bad: 2 },
    PB_RATIO: { good: 1, bad: 2 },
    PS_RATIO: { good: 3, bad: 8 },
    PROFIT_MARGIN: { good: 25, bad: 15 },
    OPERATING_MARGIN: { good: 30, bad: 15 },
    ROE: { good: 12, bad: 6 },
    ROA: { good: 1.5, bad: 0.5 },
    CURRENT_RATIO: { good: 1.2, bad: 0.8 },
    QUICK_RATIO: { good: 0.5, bad: 0.2 },
    DEBT_TO_EQUITY: { good: 1.5, bad: 4 },
    REVENUE_GROWTH: { good: 10, bad: 0 },
    EPS_GROWTH: { good: 12, bad: 0 }
  },
  'Consumer Cyclical': {
    PE_RATIO: { good: 18, bad: 35 },
    PEG_RATIO: { good: 1.2, bad: 2.5 },
    PB_RATIO: { good: 2, bad: 6 },
    PS_RATIO: { good: 1.5, bad: 4 },
    PROFIT_MARGIN: { good: 10, bad: 3 },
    OPERATING_MARGIN: { good: 12, bad: 4 },
    ROE: { good: 18, bad: 8 },
    ROA: { good: 8, bad: 3 },
    CURRENT_RATIO: { good: 2.5, bad: 1.2 },
    QUICK_RATIO: { good: 1, bad: 0.5 },
    DEBT_TO_EQUITY: { good: 0.5, bad: 2 },
    REVENUE_GROWTH: { good: 12, bad: 2 },
    EPS_GROWTH: { good: 15, bad: 3 }
  },
  'Consumer Defensive': {
    PE_RATIO: { good: 18, bad: 30 },
    PEG_RATIO: { good: 1.5, bad: 2.5 },
    PB_RATIO: { good: 3, bad: 7 },
    PS_RATIO: { good: 1, bad: 3 },
    PROFIT_MARGIN: { good: 12, bad: 5 },
    OPERATING_MARGIN: { good: 15, bad: 6 },
    ROE: { good: 20, bad: 10 },
    ROA: { good: 10, bad: 4 },
    CURRENT_RATIO: { good: 1.8, bad: 1 },
    QUICK_RATIO: { good: 1, bad: 0.5 },
    DEBT_TO_EQUITY: { good: 0.5, bad: 1.5 },
    REVENUE_GROWTH: { good: 8, bad: 0 },
    EPS_GROWTH: { good: 10, bad: 2 }
  },
  'Healthcare': {
    PE_RATIO: { good: 18, bad: 35 },
    PEG_RATIO: { good: 1.3, bad: 2.5 },
    PB_RATIO: { good: 3, bad: 7 },
    PS_RATIO: { good: 4, bad: 10 },
    PROFIT_MARGIN: { good: 18, bad: 8 },
    OPERATING_MARGIN: { good: 20, bad: 8 },
    ROE: { good: 18, bad: 8 },
    ROA: { good: 10, bad: 4 },
    CURRENT_RATIO: { good: 2.5, bad: 1.2 },
    QUICK_RATIO: { good: 1.8, bad: 0.8 },
    DEBT_TO_EQUITY: { good: 0.4, bad: 1.2 },
    REVENUE_GROWTH: { good: 15, bad: 3 },
    EPS_GROWTH: { good: 18, bad: 5 }
  },
  'Utilities': {
    PE_RATIO: { good: 15, bad: 25 },
    PEG_RATIO: { good: 2, bad: 4 },
    PB_RATIO: { good: 1.5, bad: 3 },
    PS_RATIO: { good: 2, bad: 5 },
    PROFIT_MARGIN: { good: 15, bad: 8 },
    OPERATING_MARGIN: { good: 20, bad: 10 },
    ROE: { good: 12, bad: 6 },
    ROA: { good: 4, bad: 2 },
    CURRENT_RATIO: { good: 1, bad: 0.6 },
    QUICK_RATIO: { good: 0.8, bad: 0.4 },
    DEBT_TO_EQUITY: { good: 1.5, bad: 3 },
    REVENUE_GROWTH: { good: 5, bad: 0 },
    EPS_GROWTH: { good: 8, bad: 0 }
  },
  'Energy': {
    PE_RATIO: { good: 12, bad: 25 },
    PEG_RATIO: { good: 1, bad: 2 },
    PB_RATIO: { good: 1.5, bad: 4 },
    PS_RATIO: { good: 1.5, bad: 4 },
    PROFIT_MARGIN: { good: 15, bad: 5 },
    OPERATING_MARGIN: { good: 18, bad: 6 },
    ROE: { good: 15, bad: 6 },
    ROA: { good: 8, bad: 3 },
    CURRENT_RATIO: { good: 1.5, bad: 0.8 },
    QUICK_RATIO: { good: 1, bad: 0.5 },
    DEBT_TO_EQUITY: { good: 0.8, bad: 2 },
    REVENUE_GROWTH: { good: 12, bad: 0 },
    EPS_GROWTH: { good: 15, bad: 0 }
  },
  'Industrials': {
    PE_RATIO: { good: 16, bad: 28 },
    PEG_RATIO: { good: 1.2, bad: 2.2 },
    PB_RATIO: { good: 2, bad: 5 },
    PS_RATIO: { good: 1.5, bad: 4 },
    PROFIT_MARGIN: { good: 12, bad: 5 },
    OPERATING_MARGIN: { good: 15, bad: 6 },
    ROE: { good: 16, bad: 8 },
    ROA: { good: 8, bad: 3 },
    CURRENT_RATIO: { good: 2, bad: 1 },
    QUICK_RATIO: { good: 1.2, bad: 0.6 },
    DEBT_TO_EQUITY: { good: 0.6, bad: 1.8 },
    REVENUE_GROWTH: { good: 10, bad: 2 },
    EPS_GROWTH: { good: 12, bad: 3 }
  },
  'Communication Services': {
    PE_RATIO: { good: 18, bad: 32 },
    PEG_RATIO: { good: 1.5, bad: 2.8 },
    PB_RATIO: { good: 2.5, bad: 6 },
    PS_RATIO: { good: 3, bad: 8 },
    PROFIT_MARGIN: { good: 20, bad: 8 },
    OPERATING_MARGIN: { good: 22, bad: 10 },
    ROE: { good: 18, bad: 8 },
    ROA: { good: 10, bad: 4 },
    CURRENT_RATIO: { good: 1.5, bad: 0.8 },
    QUICK_RATIO: { good: 1.2, bad: 0.6 },
    DEBT_TO_EQUITY: { good: 0.5, bad: 1.5 },
    REVENUE_GROWTH: { good: 15, bad: 3 },
    EPS_GROWTH: { good: 18, bad: 5 }
  },
  'Real Estate': {
    PE_RATIO: { good: 20, bad: 35 },
    PEG_RATIO: { good: 1.5, bad: 3 },
    PB_RATIO: { good: 1, bad: 2 },
    PS_RATIO: { good: 8, bad: 20 },
    PROFIT_MARGIN: { good: 25, bad: 10 },
    OPERATING_MARGIN: { good: 30, bad: 15 },
    ROE: { good: 10, bad: 4 },
    ROA: { good: 5, bad: 2 },
    CURRENT_RATIO: { good: 2, bad: 1 },
    QUICK_RATIO: { good: 1.5, bad: 0.8 },
    DEBT_TO_EQUITY: { good: 1, bad: 2.5 },
    REVENUE_GROWTH: { good: 8, bad: 0 },
    EPS_GROWTH: { good: 10, bad: 0 }
  },
  'Basic Materials': {
    PE_RATIO: { good: 14, bad: 25 },
    PEG_RATIO: { good: 1, bad: 2 },
    PB_RATIO: { good: 1.5, bad: 4 },
    PS_RATIO: { good: 1.5, bad: 4 },
    PROFIT_MARGIN: { good: 12, bad: 4 },
    OPERATING_MARGIN: { good: 15, bad: 6 },
    ROE: { good: 15, bad: 6 },
    ROA: { good: 8, bad: 3 },
    CURRENT_RATIO: { good: 2, bad: 1 },
    QUICK_RATIO: { good: 1, bad: 0.5 },
    DEBT_TO_EQUITY: { good: 0.5, bad: 1.5 },
    REVENUE_GROWTH: { good: 10, bad: 0 },
    EPS_GROWTH: { good: 12, bad: 0 }
  }
};

// Default thresholds for unknown sectors
export const DEFAULT_SECTOR = 'Technology';

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
