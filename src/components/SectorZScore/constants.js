export const SECTOR_ETFS = [
  { symbol: 'MOO', name: 'Agriculture', color: '#22c55e' },
  { symbol: 'XLE', name: 'Energy', color: '#3b82f6' },
  { symbol: 'XLF', name: 'Finance', color: '#a855f7' },
  { symbol: 'XLV', name: 'Healthcare', color: '#06b6d4' },
  { symbol: 'XLK', name: 'Information Technology', color: '#6366f1' },
  { symbol: 'XLRE', name: 'Real Estate', color: '#f43f5e' },
  { symbol: 'XLU', name: 'Utilities', color: '#fbbf24' }
];

export const BENCHMARKS = [
  { symbol: 'SPY', name: 'S&P 500' },
  { symbol: 'QQQ', name: 'NASDAQ 100' },
  { symbol: 'IWM', name: 'Russell 2000' },
  { symbol: 'DIA', name: 'Dow Jones' }
];

export const RETURN_PERIODS = [
  { value: 52, label: '1Y', years: 1 },
  { value: 156, label: '3Y', years: 3 },
  { value: 260, label: '5Y', years: 5 },
  { value: 520, label: '10Y', years: 10 }
];

export const Z_WINDOWS = [
  { value: 52, label: '1Y', years: 1 },
  { value: 104, label: '2Y', years: 2 },
  { value: 156, label: '3Y', years: 3 },
  { value: 260, label: '5Y', years: 5 }
];

export const SIGNAL_THRESHOLDS = {
  CYCLICAL_LOW: -2,
  CHEAP: -1,
  EXTENDED: 2
};

// Structural baseline period for calculating long-term average relative returns
// This represents the sector's "normal" performance vs benchmark
export const BASELINE_PERIODS = [
  { value: 260, label: '5Y', years: 5 },
  { value: 520, label: '10Y', years: 10 },
  { value: 780, label: '15Y', years: 15 },
  { value: 1040, label: '20Y', years: 20 }
];

export const DEFAULT_BASELINE_PERIOD = 520; // 10 years

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
