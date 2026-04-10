/**
 * CreditMortgage/data.js
 * ─────────────────────
 * Hardcoded Q1 2022 – Q4 2025 quarterly data seeded from:
 *   • NY Fed Survey of Consumer Expectations (SCE) Credit Access Survey
 *   • NY Fed Household Debt and Credit (HHD) Report
 *
 * Replace with live values via DataIngestion.jsx drop-zone.
 */

// ─── Quarterly Time-Series ───────────────────────────────────────────────────
// rejectionRate : % of credit applicants denied (SCE)
// delinquency90 : % of all debt balances 90+ days past due (HHD)
// fragility     : % of households who CANNOT find $2,000 in 30 days (SCE)
// utilization   : avg credit card utilization ratio % (FRED/NY Fed)
export const QUARTERLY_DATA = [
  { quarter: 'Q1 2022', rejectionRate: 18.7, delinquency90: 1.22, fragility: 29.8, utilization: 23.1 },
  { quarter: 'Q2 2022', rejectionRate: 21.3, delinquency90: 1.17, fragility: 30.5, utilization: 23.8 },
  { quarter: 'Q3 2022', rejectionRate: 24.6, delinquency90: 1.09, fragility: 31.2, utilization: 24.2 },
  { quarter: 'Q4 2022', rejectionRate: 27.1, delinquency90: 1.14, fragility: 32.0, utilization: 24.7 },
  { quarter: 'Q1 2023', rejectionRate: 30.4, delinquency90: 1.31, fragility: 33.1, utilization: 25.3 },
  { quarter: 'Q2 2023', rejectionRate: 33.9, delinquency90: 1.52, fragility: 34.4, utilization: 25.8 },
  { quarter: 'Q3 2023', rejectionRate: 36.7, delinquency90: 1.78, fragility: 35.7, utilization: 26.3 },
  { quarter: 'Q4 2023', rejectionRate: 40.2, delinquency90: 1.97, fragility: 36.8, utilization: 26.9 },
  { quarter: 'Q1 2024', rejectionRate: 41.8, delinquency90: 2.24, fragility: 37.4, utilization: 27.2 },
  { quarter: 'Q2 2024', rejectionRate: 43.5, delinquency90: 2.56, fragility: 37.9, utilization: 27.6 },
  { quarter: 'Q3 2024', rejectionRate: 44.7, delinquency90: 2.81, fragility: 38.1, utilization: 27.8 },
  { quarter: 'Q4 2024', rejectionRate: 45.3, delinquency90: 3.08, fragility: 38.4, utilization: 28.0 },
  { quarter: 'Q1 2025', rejectionRate: 44.9, delinquency90: 3.28, fragility: 38.6, utilization: 28.2 },
  { quarter: 'Q2 2025', rejectionRate: 43.2, delinquency90: 3.47, fragility: 38.8, utilization: 28.1 },
  { quarter: 'Q3 2025', rejectionRate: 42.1, delinquency90: 3.61, fragility: 38.5, utilization: 27.9 },
  { quarter: 'Q4 2025', rejectionRate: 41.8, delinquency90: 3.74, fragility: 38.3, utilization: 27.8 },
];

// ─── Debt Breakdown Snapshot — Q4 2025 ───────────────────────────────────────
// source: NY Fed Household Debt & Credit Report Q4 2025
export const DEBT_BREAKDOWN = {
  asOf: 'Q4 2025',
  totalTrillion: 18.8,
  categories: [
    {
      label: 'Mortgage',
      trillion: 12.61,
      color: '#58A6FF',
      delinquency90: 0.98,
      alert: null,
    },
    {
      label: 'Auto Loans',
      trillion: 1.64,
      color: '#79C0FF',
      delinquency90: 2.96,
      alert: null,
    },
    {
      label: 'Student Loans',
      trillion: 1.60,
      color: '#F85149',
      delinquency90: 16.19,
      alert: {
        label: 'LIQUIDITY SHOCK TRIGGER',
        description:
          '16.19% of student loan balances are 90+ days delinquent — the highest rate across all debt categories. Historically precedes consumer spending contraction.',
      },
    },
    {
      label: 'Credit Cards',
      trillion: 1.21,
      color: '#D29922',
      delinquency90: 11.35,
      alert: null,
    },
    {
      label: 'HELOC',
      trillion: 0.39,
      color: '#F0883E',
      delinquency90: 1.42,
      alert: {
        label: 'EQUITY TAPPING ALERT',
        description:
          'Signal of household cash-flow stress: rising HELOC balances indicate households are liquidating home equity to cover everyday expenses — a late-cycle warning sign.',
      },
    },
    {
      label: 'Other',
      trillion: 1.35,
      color: '#6E7681',
      delinquency90: 3.21,
      alert: null,
    },
  ],
};

// ─── Current Sentinel Inputs — Q4 2025 ───────────────────────────────────────
export const SENTINEL_INPUTS = {
  rejectionRate: 41.8,   // % denied
  delinquency90: 3.74,   // % of all balances 90+ DPD
  fragility: 38.3,       // % cannot find $2,000
  utilization: 27.8,     // avg CC utilization %
};

// ─── Normalization Ranges (domain knowledge — adjust as data evolves) ─────────
export const NORM_RANGES = {
  rejectionRate: { min: 0, max: 60 },    // SCE historical range
  delinquency90: { min: 0, max: 8 },     // HHD historical range
  fragility:     { min: 0, max: 100 },   // already a %
  utilization:   { min: 0, max: 50 },    // practical max for the systemic risk level
};

// ─── Data Schema (for CSV/JSON ingestion validation) ─────────────────────────
export const DATA_SCHEMA = {
  quarterly: [
    { field: 'quarter',       type: 'string',  example: 'Q4 2025',  description: 'YYYYQN label' },
    { field: 'rejectionRate', type: 'number',  example: 41.8,       description: 'Credit rejection % (SCE)' },
    { field: 'delinquency90', type: 'number',  example: 3.74,       description: '90+ day delinquency % (HHD)' },
    { field: 'fragility',     type: 'number',  example: 38.3,       description: '% cannot find $2,000 (SCE)' },
    { field: 'utilization',   type: 'number',  example: 27.8,       description: 'Credit utilization ratio % (FRED)' },
  ],
  debt: [
    { field: 'label',    type: 'string', example: 'Mortgage',  description: 'Debt category name' },
    { field: 'trillion', type: 'number', example: 12.61,        description: 'Balance in trillions USD' },
    { field: 'delinquency90', type: 'number', example: 0.98,   description: '90+ day DQ rate for this category' },
  ],
};
