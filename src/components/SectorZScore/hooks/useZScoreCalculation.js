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

// Binary search helper to find nearest date within tolerance
const findNearestDate = (sortedDates, targetTimestamp, tolerance) => {
  let left = 0;
  let right = sortedDates.length - 1;
  let nearest = null;
  let minDiff = Infinity;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midTimestamp = sortedDates[mid].timestamp;
    const diff = Math.abs(targetTimestamp - midTimestamp);

    if (diff < minDiff) {
      minDiff = diff;
      nearest = sortedDates[mid];
    }

    if (midTimestamp < targetTimestamp) {
      left = mid + 1;
    } else if (midTimestamp > targetTimestamp) {
      right = mid - 1;
    } else {
      break; // Exact match found
    }
  }

  return minDiff <= tolerance ? nearest : null;
};

const alignDates = (sectorReturns, benchmarkReturns) => {
  // Create both a map and sorted array for efficient lookups
  const benchmarkMap = new Map();
  const benchmarkDates = [];

  for (const br of benchmarkReturns) {
    const dateKey = br.date.toISOString().split('T')[0];
    const timestamp = br.date.getTime();
    benchmarkMap.set(dateKey, br.return);
    benchmarkDates.push({ timestamp, dateKey, return: br.return });
  }

  // Sort by timestamp for binary search
  benchmarkDates.sort((a, b) => a.timestamp - b.timestamp);

  const aligned = [];
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  for (const sr of sectorReturns) {
    const dateKey = sr.date.toISOString().split('T')[0];

    // Try exact match first (O(1))
    let benchmarkReturn = benchmarkMap.get(dateKey);

    // If no exact match, use binary search to find nearest date (O(log n))
    if (benchmarkReturn === undefined) {
      const sectorTimestamp = sr.date.getTime();
      const nearest = findNearestDate(benchmarkDates, sectorTimestamp, SEVEN_DAYS_MS);
      if (nearest) {
        benchmarkReturn = nearest.return;
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

const calculateZScores = (alignedData, windowWeeks) => {
  if (alignedData.length < windowWeeks) return [];

  const zScores = [];

  // Initialize the first window
  let sum = 0;
  let sumSq = 0;

  for (let i = 0; i < windowWeeks; i++) {
    const val = alignedData[i].relativeReturn;
    sum += val;
    sumSq += val * val;
  }

  // Calculate Z-scores using sliding window
  for (let i = windowWeeks; i < alignedData.length; i++) {
    // Calculate mean and standard deviation for current window
    const mean = sum / windowWeeks;
    const variance = (sumSq / windowWeeks) - (mean * mean);
    const stdDev = Math.sqrt(Math.max(0, variance)); // Ensure non-negative

    const currentRelReturn = alignedData[i].relativeReturn;
    let zScore = stdDev > 0 ? (currentRelReturn - mean) / stdDev : 0;

    // Clamp z-score to -6 to +6
    zScore = Math.max(-6, Math.min(6, zScore));

    zScores.push({
      date: alignedData[i].date,
      zScore,
      relativeReturn: currentRelReturn,
      sectorReturn: alignedData[i].sectorReturn,
      benchmarkReturn: alignedData[i].benchmarkReturn
    });

    // Update sliding window: remove oldest, add current
    const oldVal = alignedData[i - windowWeeks].relativeReturn;
    const newVal = currentRelReturn;

    sum = sum - oldVal + newVal;
    sumSq = sumSq - (oldVal * oldVal) + (newVal * newVal);
  }

  return zScores;
};

const aggregateToMonthly = (zScores) => {
  if (zScores.length === 0) return [];

  const monthlyMap = new Map();

  for (const entry of zScores) {
    // Use numeric key: year * 12 + month (faster than string concatenation)
    const monthKey = entry.date.getFullYear() * 12 + entry.date.getMonth();
    // Keep the last entry for each month
    monthlyMap.set(monthKey, entry);
  }

  // Input is already sorted, so Map values maintain insertion order
  // No need to sort again since we iterate in chronological order
  return Array.from(monthlyMap.values());
};

export const useZScoreCalculation = (sectorData, benchmarkData, sectors, returnPeriod, zWindow) => {
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
          avgZScore: null
        };
      }

      const sectorReturns = calculateReturns(prices, returnPeriod);
      const alignedData = alignDates(sectorReturns, benchmarkReturns);
      const zScores = calculateZScores(alignedData, zWindow);
      const monthlyZScores = aggregateToMonthly(zScores);

      const currentZScore = monthlyZScores.length > 0
        ? monthlyZScores[monthlyZScores.length - 1].zScore
        : null;

      const avgZScore = monthlyZScores.length > 0
        ? monthlyZScores.reduce((sum, d) => sum + d.zScore, 0) / monthlyZScores.length
        : null;

      return {
        ...sector,
        zScores: monthlyZScores,
        currentZScore,
        avgZScore,
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
  }, [sectorData, benchmarkData, sectors, returnPeriod, zWindow]);
};

export default useZScoreCalculation;
