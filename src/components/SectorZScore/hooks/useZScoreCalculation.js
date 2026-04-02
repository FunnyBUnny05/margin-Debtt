import { useMemo } from 'react';

const calculateReturns = (prices, periodWeeks) => {
  if (!prices || prices.length < periodWeeks) return [];

  const returns = [];
  for (let i = periodWeeks; i < prices.length; i++) {
    const currentPrice = prices[i].price;
    const pastPrice = prices[i - periodWeeks].price;
    if (pastPrice > 0) {
      returns.push({
        date: prices[i].date,
        return: (currentPrice / pastPrice - 1) * 100
      });
    }
  }
  return returns;
};

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const alignDates = (sectorReturns, benchmarkReturns) => {
  // Primary lookup: date-string → return value
  const benchmarkMap = new Map();
  // Secondary lookup: timestamp (ms) → return value, for the ±7-day window search
  const benchmarkTsList = [];

  for (const br of benchmarkReturns) {
    const dateKey = br.date.toISOString().split('T')[0];
    benchmarkMap.set(dateKey, br.return);
    benchmarkTsList.push({ ts: br.date.getTime(), ret: br.return });
  }
  // Keep sorted so we can binary-search for nearby dates
  benchmarkTsList.sort((a, b) => a.ts - b.ts);

  // Binary search: find index of the entry closest to targetTs
  const findNearby = (targetTs) => {
    let lo = 0, hi = benchmarkTsList.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (benchmarkTsList[mid].ts < targetTs) lo = mid + 1;
      else hi = mid;
    }
    // Check lo and its neighbour
    for (const idx of [lo - 1, lo, lo + 1]) {
      if (idx >= 0 && idx < benchmarkTsList.length) {
        if (Math.abs(benchmarkTsList[idx].ts - targetTs) <= ONE_WEEK_MS) {
          return benchmarkTsList[idx].ret;
        }
      }
    }
    return undefined;
  };

  const aligned = [];
  for (const sr of sectorReturns) {
    const dateKey = sr.date.toISOString().split('T')[0];

    // Try exact date match first (O(1))
    let benchmarkReturn = benchmarkMap.get(dateKey);

    if (benchmarkReturn === undefined) {
      // Fall back to binary-search for nearby date (O(log n) instead of O(n))
      benchmarkReturn = findNearby(sr.date.getTime());
    }

    if (benchmarkReturn !== undefined) {
      aligned.push({
        date: sr.date,
        sectorReturn: sr.return,
        benchmarkReturn,
        relativeReturn: sr.return - benchmarkReturn
      });
    }
  }

  return aligned;
};

/**
 * Calculate structural baseline - the long-term average relative return
 * This represents the sector's "normal" performance vs benchmark
 *
 * Example: If Technology historically returns -0.5% vs SPY over 10 years,
 * that's the structural baseline. Current performance is compared to this baseline.
 */
const calculateStructuralBaseline = (alignedData, baselinePeriod) => {
  // Sort ascending by date to guarantee we use the OLDEST data for baseline
  const sorted = [...alignedData].sort((a, b) => a.date - b.date);

  // Cap baseline at half the available data to avoid self-referential overlap
  const safePeriod = Math.min(baselinePeriod, Math.floor(sorted.length / 2));

  if (safePeriod < 52) {
    // Less than 1 year of baseline data — not meaningful, treat as no structural bias
    return 0;
  }

  const baselineWindow = sorted.slice(0, safePeriod);
  const relativeReturns = baselineWindow.map(d => d.relativeReturn);

  const sum = relativeReturns.reduce((a, b) => a + b, 0);
  const baseline = sum / relativeReturns.length;

  return baseline;
};

/**
 * Calculate Z-scores using excess returns (adjusted for structural baseline)
 *
 * Old Method (FLAWED):
 *   Z-Score = (Current Relative Return - Rolling Mean) / StdDev
 *   Problem: Doesn't account for sector's structural relationship with benchmark
 *
 * New Method (IMPROVED):
 *   1. Calculate Structural Baseline = 10-year average relative return
 *   2. Calculate Excess Return = Current Relative Return - Structural Baseline
 *   3. Z-Score = (Current Excess Return - Rolling Mean of Excess) / StdDev
 *
 * Example:
 *   Sector baseline: -0.5% (typically underperforms SPY by 0.5%)
 *   Current relative return: -1.5% vs SPY
 *   Excess return: -1.5% - (-0.5%) = -1.0%
 *   If this -1.0% excess is 2 std devs below mean → Z-Score = -2.0 (CHEAP)
 */
const calculateZScores = (alignedData, windowWeeks, baselinePeriod) => {
  // Sort ascending by date to ensure window loops are in chronological order
  const sortedData = [...alignedData].sort((a, b) => a.date - b.date);
  if (sortedData.length < windowWeeks) return [];

  // Calculate the structural baseline for this sector
  const structuralBaseline = calculateStructuralBaseline(sortedData, baselinePeriod);

  // Add excess returns to each data point
  const dataWithExcess = sortedData.map(d => ({
    ...d,
    excessReturn: d.relativeReturn - structuralBaseline
  }));

  const zScores = [];

  for (let i = windowWeeks; i < dataWithExcess.length; i++) {
    const window = dataWithExcess.slice(i - windowWeeks, i);
    const excessReturns = window.map(d => d.excessReturn);

    // Calculate mean and stdDev of EXCESS returns (not relative returns)
    const mean = excessReturns.reduce((a, b) => a + b, 0) / excessReturns.length;
    const variance = excessReturns.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (excessReturns.length - 1);
    const stdDev = Math.sqrt(variance);

    const currentExcessReturn = dataWithExcess[i].excessReturn;
    const currentRelReturn = dataWithExcess[i].relativeReturn;

    // Calculate Z-Score based on excess returns
    let zScore = stdDev > 0 ? (currentExcessReturn - mean) / stdDev : 0;

    // Clamp z-score to -6 to +6
    zScore = Math.max(-6, Math.min(6, zScore));

    zScores.push({
      date: dataWithExcess[i].date,
      zScore,
      relativeReturn: currentRelReturn,
      excessReturn: currentExcessReturn,
      structuralBaseline,
      sectorReturn: dataWithExcess[i].sectorReturn,
      benchmarkReturn: dataWithExcess[i].benchmarkReturn
    });
  }

  return zScores;
};

const aggregateToMonthly = (zScores) => {
  if (zScores.length === 0) return [];

  const monthlyMap = new Map();

  for (const entry of zScores) {
    const monthKey = `${entry.date.getFullYear()}-${String(entry.date.getMonth() + 1).padStart(2, '0')}`;
    // Keep the last entry for each month
    monthlyMap.set(monthKey, entry);
  }

  return Array.from(monthlyMap.values()).sort((a, b) => a.date - b.date);
};

export const useZScoreCalculation = (sectorData, benchmarkData, sectors, returnPeriod, zWindow, baselinePeriod = 520) => {
  return useMemo(() => {
    if (!benchmarkData || Object.keys(sectorData).length === 0) {
      return { sectors: [], dates: [], loading: true };
    }

    const benchmarkReturns = calculateReturns(benchmarkData, returnPeriod);

    const processedSectors = sectors.map(sector => {
      const prices = sectorData[sector.symbol];
      if (!prices || prices.length === 0) {
        return {
          ...sector,
          zScores: [],
          currentZScore: null,
          avgZScore: null,
          structuralBaseline: null,
          excessReturn: null
        };
      }

      const sectorReturns = calculateReturns(prices, returnPeriod);
      const alignedData = alignDates(sectorReturns, benchmarkReturns);
      const zScores = calculateZScores(alignedData, zWindow, baselinePeriod);
      const monthlyZScores = aggregateToMonthly(zScores);

      const currentData = monthlyZScores.length > 0
        ? monthlyZScores[monthlyZScores.length - 1]
        : null;

      const currentZScore = currentData ? currentData.zScore : null;
      const structuralBaseline = currentData ? currentData.structuralBaseline : null;
      const excessReturn = currentData ? currentData.excessReturn : null;
      const relativeReturn = currentData ? currentData.relativeReturn : null;

      const avgZScore = monthlyZScores.length > 0
        ? monthlyZScores.reduce((sum, d) => sum + d.zScore, 0) / monthlyZScores.length
        : null;

      return {
        ...sector,
        zScores: monthlyZScores,
        currentZScore,
        avgZScore,
        structuralBaseline,
        excessReturn,
        relativeReturn,
        prices,
        dataPoints: alignedData.length
      };
    });

    // Get all unique dates
    const allDates = new Set();
    for (const sector of processedSectors) {
      for (const entry of sector.zScores) {
        allDates.add(entry.date.toISOString().split('T')[0]);
      }
    }

    const sortedDates = Array.from(allDates).sort();

    return {
      sectors: processedSectors,
      dates: sortedDates,
      loading: false
    };
  }, [sectorData, benchmarkData, sectors, returnPeriod, zWindow, baselinePeriod]);
};

export default useZScoreCalculation;
