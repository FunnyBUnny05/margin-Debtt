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

const calculateZScores = (alignedData, windowWeeks) => {
  if (alignedData.length < windowWeeks) return [];

  const zScores = [];

  for (let i = windowWeeks; i < alignedData.length; i++) {
    const window = alignedData.slice(i - windowWeeks, i);
    const relativeReturns = window.map(d => d.relativeReturn);

    const mean = relativeReturns.reduce((a, b) => a + b, 0) / relativeReturns.length;
    const variance = relativeReturns.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / relativeReturns.length;
    const stdDev = Math.sqrt(variance);

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
