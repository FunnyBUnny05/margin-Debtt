/**
 * CreditMortgage/utils.js
 * ────────────────────────
 * Pure utility functions for data transformation, scoring, and ingestion.
 */

import { NORM_RANGES } from './data';

// ─── Normalization ────────────────────────────────────────────────────────────
/**
 * Normalize a raw value to a 0–100 scale given domain [min, max].
 * Values outside the domain are clamped.
 */
export function normalize(value, min, max) {
  if (max === min) return 0;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

// ─── Sentinel Score ───────────────────────────────────────────────────────────
/**
 * Compute the Systemic Risk Score (0–100).
 *
 * Weights:
 *   Rejection Rate    40%   higher rejection → more stress
 *   Delinquency 90+   30%   higher delinquency → more stress
 *   Financial Fragility 20% higher fragility → more stress
 *   Credit Utilization  10% higher utilization → more stress
 *
 * @param {object} inputs  { rejectionRate, delinquency90, fragility, utilization }
 * @param {object} ranges  NORM_RANGES — optional override
 * @returns {object} { score, components, label, color }
 */
export function calcSentinelScore(inputs, ranges = NORM_RANGES) {
  const nRej   = normalize(inputs.rejectionRate, ranges.rejectionRate.min, ranges.rejectionRate.max);
  const nDelinq = normalize(inputs.delinquency90, ranges.delinquency90.min, ranges.delinquency90.max);
  const nFrag  = normalize(inputs.fragility,     ranges.fragility.min,     ranges.fragility.max);
  const nUtil  = normalize(inputs.utilization,   ranges.utilization.min,   ranges.utilization.max);

  const score = (nRej * 0.40) + (nDelinq * 0.30) + (nFrag * 0.20) + (nUtil * 0.10);
  const rounded = Math.round(score * 10) / 10;

  let label, color;
  if (score < 25) {
    label = 'STABLE';
    color = '#238636';
  } else if (score < 50) {
    label = 'CAUTION';
    color = '#D29922';
  } else if (score < 75) {
    label = 'STRESS';
    color = '#F85149';
  } else {
    label = 'CRITICAL';
    color = '#FF0000';
  }

  return {
    score: rounded,
    label,
    color,
    components: {
      rejectionNorm:   Math.round(nRej * 10) / 10,
      delinquencyNorm: Math.round(nDelinq * 10) / 10,
      fragilityNorm:   Math.round(nFrag * 10) / 10,
      utilizationNorm: Math.round(nUtil * 10) / 10,
    },
  };
}

// ─── Lead-Lag Shift ───────────────────────────────────────────────────────────
/**
 * Shift a field in a quarterly array forward by N quarters.
 * The leading data (early quarters) are dropped; trailing entries get null.
 *
 * Usage: shift rejectionRate +2 quarters forward so the chart plots it
 * ahead of where delinquencies are expected to emerge.
 *
 * @param {Array}  data       QUARTERLY_DATA array
 * @param {string} field      field name to shift
 * @param {number} quarters   number of quarters to shift forward (positive = earlier data moves right)
 * @returns {Array} new array with shifted field added as `${field}Shifted`
 */
export function shiftForward(data, field, quarters) {
  const key = `${field}Shifted`;
  return data.map((row, i) => {
    const sourceIdx = i - quarters;
    return {
      ...row,
      [key]: sourceIdx >= 0 ? data[sourceIdx][field] : null,
    };
  });
}

// ─── Normalization of full dataset ───────────────────────────────────────────
/**
 * Returns a new array with normalized versions of key fields (0-100 scale).
 * Appends fields: rejNorm, delinqNorm, fragilityNorm, utilizationNorm,
 *                 rejShiftedNorm (rejection shifted +2Q, normalized)
 */
export function buildChartData(rawData, ranges = NORM_RANGES) {
  const withShift = shiftForward(rawData, 'rejectionRate', 2);
  return withShift.map(row => ({
    ...row,
    rejNorm:         normalize(row.rejectionRate, ranges.rejectionRate.min, ranges.rejectionRate.max),
    delinqNorm:      normalize(row.delinquency90, ranges.delinquency90.min, ranges.delinquency90.max),
    fragilityNorm:   normalize(row.fragility,     ranges.fragility.min,     ranges.fragility.max),
    utilizationNorm: normalize(row.utilization,   ranges.utilization.min,   ranges.utilization.max),
    rejShiftedNorm:  row.rejectionRateShifted != null
                       ? normalize(row.rejectionRateShifted, ranges.rejectionRate.min, ranges.rejectionRate.max)
                       : null,
  }));
}

// ─── CSV Ingestion ────────────────────────────────────────────────────────────
/**
 * Parse a CSV string into an array matching QUARTERLY_DATA shape.
 * Expected headers (case-insensitive): quarter, rejectionRate, delinquency90, fragility, utilization
 */
export function loadFromCSV(csvText) {
  const lines = csvText.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error('CSV must have at least a header row and one data row.');

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

  const findCol = (candidates) => {
    for (const c of candidates) {
      const idx = headers.findIndex(h => h.includes(c));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const qIdx    = findCol(['quarter', 'period', 'date']);
  const rejIdx  = findCol(['rejection', 'reject']);
  const delinqIdx = findCol(['delinq', 'default', '90']);
  const fragIdx = findCol(['fragility', 'frag', '2000', 'emergency']);
  const utilIdx = findCol(['utilization', 'util']);

  if (qIdx === -1) throw new Error('Could not find quarter/period column in CSV.');

  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim());
    const _num = (idx) => (idx !== -1 && cols[idx] != null) ? parseFloat(cols[idx]) : undefined;
    return {
      quarter:       cols[qIdx] || '',
      rejectionRate: _num(rejIdx) ?? 0,
      delinquency90: _num(delinqIdx) ?? 0,
      fragility:     _num(fragIdx) ?? 0,
      utilization:   _num(utilIdx) ?? 0,
    };
  }).filter(r => r.quarter);
}

// ─── JSON Ingestion ───────────────────────────────────────────────────────────
/**
 * Extract quarterly array from a JSON object.
 * Accepts { data: [...] } or a raw array.
 */
export function loadFromJSON(json) {
  const array = Array.isArray(json) ? json : (json.data ?? json.quarterly ?? null);
  if (!Array.isArray(array)) throw new Error('JSON must contain a top-level array or a "data" array.');
  if (array.length === 0) throw new Error('JSON array is empty.');
  if (!array[0].quarter) throw new Error('Each row must have a "quarter" field.');
  return array;
}
