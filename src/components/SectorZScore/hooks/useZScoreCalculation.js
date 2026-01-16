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

const alignDates = (sectorReturns, benchmarkReturns) => {
  // Create a map of benchmark returns by date string
  const benchmarkMap = new Map();
  for (const br of benchmarkReturns) {
    const dateKey = br.date.toISOString().split('T')[0];
    benchmarkMap.set(dateKey, br.return);
  }

  const aligned = [];
  for (const sr of sectorReturns) {
    const dateKey = sr.date.toISOString().split('T')[0];

    // Try to find matching benchmark date (allow 7 day window)
    let benchmarkReturn = benchmarkMap.get(dateKey);

    if (benchmarkReturn === undefined) {
      // Look for nearby dates
      const sectorDate = sr.date.getTime();
      for (const [key, value] of benchmarkMap) {
        const benchDate = new Date(key).getTime();
        if (Math.abs(sectorDate - benchDate) <= 7 * 24 * 60 * 60 * 1000) {
          benchmarkReturn = value;
          break;
        }
      }
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
  if (alignedData.length < baselinePeriod) {
    // If we don't have enough data for baseline period, use all available data
    baselinePeriod = alignedData.length;
  }

  // Use the first N periods to establish the structural baseline
  const baselineWindow = alignedData.slice(0, baselinePeriod);
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
  if (alignedData.length < windowWeeks) return [];

  // Calculate the structural baseline for this sector
  const structuralBaseline = calculateStructuralBaseline(alignedData, baselinePeriod);

  // Add excess returns to each data point
  const dataWithExcess = alignedData.map(d => ({
    ...d,
    excessReturn: d.relativeReturn - structuralBaseline
  }));

  const zScores = [];

  for (let i = windowWeeks; i < dataWithExcess.length; i++) {
    const window = dataWithExcess.slice(i - windowWeeks, i);
    const excessReturns = window.map(d => d.excessReturn);

    // Calculate mean and stdDev of EXCESS returns (not relative returns)
    const mean = excessReturns.reduce((a, b) => a + b, 0) / excessReturns.length;
    const variance = excessReturns.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / excessReturns.length;
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
        prices
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
