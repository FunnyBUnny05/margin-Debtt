/**
 * CreditMortgage/data.js
 * ─────────────────────
 * Imports real extracted NY Fed HHD + SCE microdata.
 * All data sourced directly from:
 *   • NY Fed Household Debt & Credit Report Q4 2025 (HHD)
 *   • NY Fed Survey of Consumer Expectations — Credit Access Microdata (SCE)
 *
 * creditData.json contains:
 *   debtBalance        92 quarters (Q1 2003 – Q4 2025), trillions by category
 *   delinquency90      92 quarters, % 90+ DPD by category
 *   transitionMortgage 92 quarters, current→30 and current→90 transition %
 *   transitionConsumer 92 quarters, 30dpd→current and 30dpd→90+ transition %
 *   sceQuarterly       34 quarters (Q4 2013 – Q1 2025), aggregated credit access
 */

import RAW from './creditData.json';

export const DEBT_BALANCE        = RAW.debtBalance;
export const DELINQUENCY90       = RAW.delinquency90;
export const TRANSITION_MORTGAGE = RAW.transitionMortgage;
export const TRANSITION_CONSUMER = RAW.transitionConsumer;
export const SCE_QUARTERLY       = RAW.sceQuarterly;

// ── Convenience: latest quarter snapshots ────────────────────────────────────
export const LATEST_DEBT       = DEBT_BALANCE[DEBT_BALANCE.length - 1];           // Q4 2025
export const LATEST_DQ         = DELINQUENCY90[DELINQUENCY90.length - 1];         // Q4 2025
export const LATEST_TRANS_MORT = TRANSITION_MORTGAGE[TRANSITION_MORTGAGE.length - 1]; // Q4 2025
export const LATEST_TRANS_CONS = TRANSITION_CONSUMER[TRANSITION_CONSUMER.length - 1]; // Q4 2025
export const LATEST_SCE        = SCE_QUARTERLY[SCE_QUARTERLY.length - 1];         // Q1 2025

// ── Sentinel Inputs — derived from real data ──────────────────────────────────
export const SENTINEL_INPUTS = {
  // Best available: from HHD all-debt 90+ DQ (Q4 2025)
  delinquency90:  LATEST_DQ.all,                    // 3.1216%
  // From SCE Q1 2025 — credit card rejection rate (most recent)
  rejectionRate:  LATEST_SCE.rejectedCC,            // 22.48%
  // SCE discouraged borrowers rate (% who didn't apply fearing rejection)
  fragility:      LATEST_SCE.discouragedAny,        // 9.31%
  // CC application rate as proxy for credit utilization pressure
  utilizationProxy: LATEST_SCE.appRateAny,          // 37.09%
};

// ── Normalization Ranges — empirically derived from historical data ────────────
export const NORM_RANGES = {
  rejectionRate: { min: 0,  max: 40  },  // SCE CC rejection: 10-35% historically
  delinquency90: { min: 0,  max: 8   },  // HHD all-DQ: peaked ~7% in 2010
  fragility:     { min: 0,  max: 20  },  // SCE discouraged: 0-20% range
  utilization:   { min: 25, max: 45  },  // SCE appRateAny: typical 25-45%
};

// ── Debt Breakdown — Q4 2025 (from HHD) ──────────────────────────────────────
export const DEBT_BREAKDOWN = {
  asOf: 'Q4 2025',
  totalTrillion: LATEST_DEBT.total,
  categories: [
    {
      label: 'Mortgage',
      trillion: LATEST_DEBT.mortgage,
      color: '#58A6FF',
      delinquency90: LATEST_DQ.mortgage,
      alert: null,
    },
    {
      label: 'Auto Loans',
      trillion: LATEST_DEBT.auto,
      color: '#79C0FF',
      delinquency90: LATEST_DQ.auto,
      alert: null,
    },
    {
      label: 'Student Loans',
      trillion: LATEST_DEBT.student,
      color: '#F85149',
      delinquency90: LATEST_DQ.student,
      alert: {
        label: 'SERIOUS DELINQUENCY ELEVATED',
        description: `${LATEST_DQ.student.toFixed(2)}% of student loan balances are 90+ days delinquent — among the highest rates of any category. Transition into serious delinquency (Q4 2025: ${LATEST_TRANS_CONS.to90.toFixed(1)}%) has risen sharply since post-pandemic repayment restart.`,
      },
    },
    {
      label: 'Credit Cards',
      trillion: LATEST_DEBT.creditCard,
      color: '#D29922',
      delinquency90: LATEST_DQ.cc,
      alert: {
        label: 'CC DELINQUENCY AT CYCLE HIGH',
        description: `${LATEST_DQ.cc.toFixed(2)}% of credit card balances are 90+ DPD. SCE data shows ${LATEST_SCE.rejectedCC.toFixed(1)}% rejection rate with ${LATEST_SCE.discouragedAny.toFixed(1)}% of households self-censoring applications.`,
      },
    },
    {
      label: 'HELOC',
      trillion: LATEST_DEBT.heloc,
      color: '#F0883E',
      delinquency90: LATEST_DQ.heloc,
      alert: {
        label: 'EQUITY TAPPING SIGNAL',
        description: 'Rising HELOC balances indicate households liquidating home equity to fund everyday expenses — a late-cycle cash-flow stress indicator.',
      },
    },
    {
      label: 'Other',
      trillion: LATEST_DEBT.other,
      color: '#6E7681',
      delinquency90: LATEST_DQ.other,
      alert: null,
    },
  ],
};

// ── Data Schema (for documentation) ─────────────────────────────────────────
export const DATA_SCHEMA = {
  source: 'NY Fed HHD Report Q4 2025 + SCE Credit Access Microdata',
  hhd_quarters: 92,
  sce_quarters: 34,
  range: 'Q1 2003 – Q4 2025 (HHD), Q4 2013 – Q1 2025 (SCE)',
};
