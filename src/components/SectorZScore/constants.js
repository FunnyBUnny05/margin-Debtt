export const SECTOR_ETFS = [
  { symbol: 'XLB', name: 'Materials', color: '#f97316' },
  { symbol: 'XLE', name: 'Energy', color: '#3b82f6' },
  { symbol: 'XLF', name: 'Financials', color: '#a855f7' },
  { symbol: 'XLC', name: 'Communication', color: '#ec4899' },
  { symbol: 'XLY', name: 'Consumer Disc', color: '#14b8a6' },
  { symbol: 'XLP', name: 'Consumer Staples', color: '#84cc16' },
  { symbol: 'XLV', name: 'Healthcare', color: '#06b6d4' },
  { symbol: 'XLK', name: 'Technology', color: '#6366f1' },
  { symbol: 'XLU', name: 'Utilities', color: '#fbbf24' },
  { symbol: 'XLRE', name: 'Real Estate', color: '#f43f5e' },
  { symbol: 'XLI', name: 'Industrials', color: '#8b5cf6' },
  { symbol: 'SMH', name: 'Semiconductors', color: '#22c55e' },
  { symbol: 'XHB', name: 'Homebuilders', color: '#d946ef' },
  { symbol: 'XOP', name: 'Oil & Gas E&P', color: '#0ea5e9' },
  { symbol: 'XME', name: 'Metals & Mining', color: '#78716c' },
  { symbol: 'KRE', name: 'Regional Banks', color: '#10b981' },
  { symbol: 'ITB', name: 'Home Construction', color: '#f59e0b' },
  { symbol: 'IBB', name: 'Biotech', color: '#ef4444' },
  { symbol: 'IYT', name: 'Transportation', color: '#7c3aed' }
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

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
