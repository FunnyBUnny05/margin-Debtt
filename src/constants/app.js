// Timeout and Performance Constants
export const FETCH_TIMEOUT_MS = 12000; // 12 seconds
export const CHART_INIT_DELAY_MS = 100; // Small delay for DOM readiness

// Mobile Breakpoints
export const MOBILE_BREAKPOINT_PX = 640;

// Data Fetching
export const FINRA_CSV_URL = 'https://www.finra.org/sites/default/files/Industry_Margin_Statistics.csv';
export const MARGIN_DATA_PATH = './margin_data.json';
export const AAII_DATA_PATH = './aaii_allocation_data.json';

// Chart Configuration
export const CHART_DATA_POINTS_DIVISOR = 8; // For calculating chart interval

// Data Source Keys
export const DATA_SOURCES = {
  MARGIN: 'margin',
  AAII: 'aaii',
  SECTORS: 'sectors',
  FUNDAMENTALS: 'fundamentals'
};

// Time Range Keys
export const TIME_RANGES = {
  TWO_YEAR: '2y',
  FIVE_YEAR: '5y',
  TEN_YEAR: '10y',
  ALL: 'all'
};

// Time Range Mappings (in months)
export const TIME_RANGE_MONTHS = {
  [TIME_RANGES.TWO_YEAR]: 24,
  [TIME_RANGES.FIVE_YEAR]: 60,
  [TIME_RANGES.TEN_YEAR]: 120,
  [TIME_RANGES.ALL]: Infinity
};

// Threshold Values
export const GROWTH_THRESHOLD = 30; // YoY growth threshold percentage
export const GROWTH_THRESHOLD_NEG = -30; // YoY decline threshold percentage
