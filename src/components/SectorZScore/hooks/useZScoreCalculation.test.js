import { describe, it, expect } from 'vitest';

// Extract the helper functions for testing
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

describe('calculateReturns', () => {
  it('should calculate returns correctly', () => {
    const prices = [
      { date: new Date('2024-01-01'), price: 100 },
      { date: new Date('2024-01-08'), price: 110 },
      { date: new Date('2024-01-15'), price: 105 }
    ];

    const returns = calculateReturns(prices, 1);

    expect(returns).toHaveLength(2);
    expect(returns[0].return).toBeCloseTo(10, 1); // 10% return
    expect(returns[1].return).toBeCloseTo(-4.545, 1); // -4.545% return
  });

  it('should return empty array if insufficient data', () => {
    const prices = [
      { date: new Date('2024-01-01'), price: 100 }
    ];

    const returns = calculateReturns(prices, 4);
    expect(returns).toEqual([]);
  });

  it('should skip periods with zero past price', () => {
    const prices = [
      { date: new Date('2024-01-01'), price: 0 },
      { date: new Date('2024-01-08'), price: 110 }
    ];

    const returns = calculateReturns(prices, 1);
    expect(returns).toHaveLength(0);
  });

  it('should handle negative prices', () => {
    const prices = [
      { date: new Date('2024-01-01'), price: 100 },
      { date: new Date('2024-01-08'), price: -50 }
    ];

    const returns = calculateReturns(prices, 1);
    expect(returns).toHaveLength(1);
    expect(returns[0].return).toBeCloseTo(-150, 1);
  });

  it('should handle null or undefined prices array', () => {
    expect(calculateReturns(null, 1)).toEqual([]);
    expect(calculateReturns(undefined, 1)).toEqual([]);
  });

  it('should calculate returns over multiple periods', () => {
    const prices = [
      { date: new Date('2024-01-01'), price: 100 },
      { date: new Date('2024-01-08'), price: 105 },
      { date: new Date('2024-01-15'), price: 110 },
      { date: new Date('2024-01-22'), price: 115 }
    ];

    const returns = calculateReturns(prices, 2);
    expect(returns).toHaveLength(2);
    expect(returns[0].return).toBeCloseTo(10, 1); // 110/100 - 1
    expect(returns[1].return).toBeCloseTo(9.524, 1); // 115/105 - 1
  });

  it('should handle all equal prices (zero return)', () => {
    const prices = [
      { date: new Date('2024-01-01'), price: 100 },
      { date: new Date('2024-01-08'), price: 100 },
      { date: new Date('2024-01-15'), price: 100 }
    ];

    const returns = calculateReturns(prices, 1);
    expect(returns).toHaveLength(2);
    expect(returns[0].return).toBe(0);
    expect(returns[1].return).toBe(0);
  });
});

describe('alignDates', () => {
  it('should align dates with exact matches', () => {
    const sectorReturns = [
      { date: new Date('2024-01-01'), return: 5 },
      { date: new Date('2024-01-08'), return: 3 }
    ];

    const benchmarkReturns = [
      { date: new Date('2024-01-01'), return: 2 },
      { date: new Date('2024-01-08'), return: 1 }
    ];

    const aligned = alignDates(sectorReturns, benchmarkReturns);

    expect(aligned).toHaveLength(2);
    expect(aligned[0].relativeReturn).toBe(3); // 5 - 2
    expect(aligned[1].relativeReturn).toBe(2); // 3 - 1
  });

  it('should align dates within 7-day window', () => {
    const sectorReturns = [
      { date: new Date('2024-01-01'), return: 5 }
    ];

    const benchmarkReturns = [
      { date: new Date('2024-01-05'), return: 2 } // 4 days apart
    ];

    const aligned = alignDates(sectorReturns, benchmarkReturns);

    expect(aligned).toHaveLength(1);
    expect(aligned[0].relativeReturn).toBe(3);
  });

  it('should not align dates outside 7-day window', () => {
    const sectorReturns = [
      { date: new Date('2024-01-01'), return: 5 }
    ];

    const benchmarkReturns = [
      { date: new Date('2024-01-15'), return: 2 } // 14 days apart
    ];

    const aligned = alignDates(sectorReturns, benchmarkReturns);

    expect(aligned).toHaveLength(0);
  });

  it('should handle empty inputs', () => {
    expect(alignDates([], [])).toEqual([]);
    expect(alignDates([{ date: new Date(), return: 5 }], [])).toEqual([]);
    expect(alignDates([], [{ date: new Date(), return: 5 }])).toEqual([]);
  });

  it('should handle partial alignment', () => {
    const sectorReturns = [
      { date: new Date('2024-01-01'), return: 5 },
      { date: new Date('2024-01-08'), return: 3 },
      { date: new Date('2024-01-15'), return: 4 }
    ];

    const benchmarkReturns = [
      { date: new Date('2024-01-01'), return: 2 },
      { date: new Date('2024-01-15'), return: 1 }
    ];

    const aligned = alignDates(sectorReturns, benchmarkReturns);

    // 2024-01-08 is within 7 days of 2024-01-01, so it also gets aligned
    expect(aligned).toHaveLength(3);
    expect(aligned[0].date).toEqual(new Date('2024-01-01'));
    expect(aligned[2].date).toEqual(new Date('2024-01-15'));
  });

  it('should preserve all return data in alignment', () => {
    const sectorReturns = [
      { date: new Date('2024-01-01'), return: 5.5 }
    ];

    const benchmarkReturns = [
      { date: new Date('2024-01-01'), return: 2.3 }
    ];

    const aligned = alignDates(sectorReturns, benchmarkReturns);

    expect(aligned[0]).toMatchObject({
      sectorReturn: 5.5,
      benchmarkReturn: 2.3,
      relativeReturn: 3.2
    });
  });

  it('should handle dates at exact 7-day boundary', () => {
    const sectorDate = new Date('2024-01-01');
    const benchmarkDate = new Date('2024-01-08'); // Exactly 7 days

    const sectorReturns = [{ date: sectorDate, return: 5 }];
    const benchmarkReturns = [{ date: benchmarkDate, return: 2 }];

    const aligned = alignDates(sectorReturns, benchmarkReturns);

    expect(aligned).toHaveLength(1);
  });
});

describe('calculateZScores', () => {
  it('should calculate z-scores correctly', () => {
    const alignedData = [
      { date: new Date('2024-01-01'), relativeReturn: 0, sectorReturn: 5, benchmarkReturn: 5 },
      { date: new Date('2024-01-08'), relativeReturn: 1, sectorReturn: 6, benchmarkReturn: 5 },
      { date: new Date('2024-01-15'), relativeReturn: -1, sectorReturn: 4, benchmarkReturn: 5 },
      { date: new Date('2024-01-22'), relativeReturn: 2, sectorReturn: 7, benchmarkReturn: 5 }
    ];

    const zScores = calculateZScores(alignedData, 2);

    expect(zScores).toHaveLength(2);
    expect(zScores[0].date).toEqual(new Date('2024-01-15'));
    expect(zScores[1].date).toEqual(new Date('2024-01-22'));
  });

  it('should return empty array if insufficient data', () => {
    const alignedData = [
      { date: new Date('2024-01-01'), relativeReturn: 0, sectorReturn: 5, benchmarkReturn: 5 }
    ];

    const zScores = calculateZScores(alignedData, 5);
    expect(zScores).toEqual([]);
  });

  it('should handle zero standard deviation', () => {
    const alignedData = [
      { date: new Date('2024-01-01'), relativeReturn: 5, sectorReturn: 10, benchmarkReturn: 5 },
      { date: new Date('2024-01-08'), relativeReturn: 5, sectorReturn: 10, benchmarkReturn: 5 },
      { date: new Date('2024-01-15'), relativeReturn: 5, sectorReturn: 10, benchmarkReturn: 5 }
    ];

    const zScores = calculateZScores(alignedData, 2);

    expect(zScores).toHaveLength(1);
    expect(zScores[0].zScore).toBe(0); // stdDev is 0, so z-score should be 0
  });

  it('should clamp z-scores to -6 to +6', () => {
    // Create data with small variance and one extreme outlier
    const alignedData = [];
    // First create a window of 10 points with small variance (around 1)
    for (let i = 0; i < 10; i++) {
      alignedData.push({
        date: new Date(2024, 0, i + 1),
        relativeReturn: 1 + Math.random() * 0.1, // Values around 1
        sectorReturn: 5,
        benchmarkReturn: 5
      });
    }
    // Add one extreme outlier
    alignedData.push({
      date: new Date(2024, 0, 11),
      relativeReturn: 100, // Very extreme compared to ~1
      sectorReturn: 105,
      benchmarkReturn: 5
    });

    const zScores = calculateZScores(alignedData, 10);

    // With a window mean around 1, stddev ~0.03, and current value 100,
    // the z-score would be huge (>1000), so it should be clamped to +6
    expect(zScores[0].zScore).toBe(6);
  });

  it('should clamp negative z-scores to -6', () => {
    // Create data with small variance and one extreme negative outlier
    const alignedData = [];
    // First create a window of 10 points with small variance (around 1)
    for (let i = 0; i < 10; i++) {
      alignedData.push({
        date: new Date(2024, 0, i + 1),
        relativeReturn: 1 + Math.random() * 0.1, // Values around 1
        sectorReturn: 5,
        benchmarkReturn: 5
      });
    }
    // Add one extreme negative outlier
    alignedData.push({
      date: new Date(2024, 0, 11),
      relativeReturn: -100, // Very extreme compared to ~1
      sectorReturn: -95,
      benchmarkReturn: 5
    });

    const zScores = calculateZScores(alignedData, 10);

    // With a window mean around 1, stddev ~0.03, and current value -100,
    // the z-score would be huge negative (< -1000), so it should be clamped to -6
    expect(zScores[0].zScore).toBe(-6);
  });

  it('should include all return data in results', () => {
    const alignedData = [
      { date: new Date('2024-01-01'), relativeReturn: 1, sectorReturn: 6, benchmarkReturn: 5 },
      { date: new Date('2024-01-08'), relativeReturn: 2, sectorReturn: 7, benchmarkReturn: 5 },
      { date: new Date('2024-01-15'), relativeReturn: 3, sectorReturn: 8, benchmarkReturn: 5 }
    ];

    const zScores = calculateZScores(alignedData, 2);

    expect(zScores[0]).toMatchObject({
      relativeReturn: 3,
      sectorReturn: 8,
      benchmarkReturn: 5
    });
  });

  it('should handle varying window sizes', () => {
    const alignedData = Array.from({ length: 100 }, (_, i) => ({
      date: new Date(2024, 0, i + 1),
      relativeReturn: Math.sin(i / 10),
      sectorReturn: 5 + Math.sin(i / 10),
      benchmarkReturn: 5
    }));

    const zScores10 = calculateZScores(alignedData, 10);
    const zScores50 = calculateZScores(alignedData, 50);

    expect(zScores10.length).toBe(90); // 100 - 10
    expect(zScores50.length).toBe(50); // 100 - 50
  });

  it('should calculate correct mean and variance', () => {
    // Test with known values
    const alignedData = [
      { date: new Date('2024-01-01'), relativeReturn: 2, sectorReturn: 7, benchmarkReturn: 5 },
      { date: new Date('2024-01-08'), relativeReturn: 4, sectorReturn: 9, benchmarkReturn: 5 },
      { date: new Date('2024-01-15'), relativeReturn: 6, sectorReturn: 11, benchmarkReturn: 5 }
    ];

    const zScores = calculateZScores(alignedData, 2);

    // Window [2, 4], current = 6
    // Mean = 3, Variance = 1, StdDev = 1
    // Z-score = (6 - 3) / 1 = 3
    expect(zScores[0].zScore).toBeCloseTo(3, 1);
  });
});

describe('aggregateToMonthly', () => {
  it('should aggregate daily z-scores to monthly', () => {
    const zScores = [
      { date: new Date('2024-01-05'), zScore: 1.5 },
      { date: new Date('2024-01-15'), zScore: 2.0 },
      { date: new Date('2024-01-25'), zScore: 1.8 },
      { date: new Date('2024-02-05'), zScore: -1.0 }
    ];

    const monthly = aggregateToMonthly(zScores);

    expect(monthly).toHaveLength(2);
    expect(monthly[0].zScore).toBe(1.8); // Last entry for Jan
    expect(monthly[1].zScore).toBe(-1.0); // Last entry for Feb
  });

  it('should return empty array for empty input', () => {
    const monthly = aggregateToMonthly([]);
    expect(monthly).toEqual([]);
  });

  it('should handle single entry', () => {
    const zScores = [
      { date: new Date('2024-01-15'), zScore: 2.5 }
    ];

    const monthly = aggregateToMonthly(zScores);

    expect(monthly).toHaveLength(1);
    expect(monthly[0].zScore).toBe(2.5);
  });

  it('should sort results chronologically', () => {
    const zScores = [
      { date: new Date('2024-03-15'), zScore: 3.0 },
      { date: new Date('2024-01-15'), zScore: 1.0 },
      { date: new Date('2024-02-15'), zScore: 2.0 }
    ];

    const monthly = aggregateToMonthly(zScores);

    expect(monthly).toHaveLength(3);
    expect(monthly[0].date).toEqual(new Date('2024-01-15'));
    expect(monthly[1].date).toEqual(new Date('2024-02-15'));
    expect(monthly[2].date).toEqual(new Date('2024-03-15'));
  });

  it('should preserve all data fields', () => {
    const zScores = [
      {
        date: new Date('2024-01-15'),
        zScore: 1.5,
        relativeReturn: 2.0,
        sectorReturn: 7.0,
        benchmarkReturn: 5.0
      }
    ];

    const monthly = aggregateToMonthly(zScores);

    expect(monthly[0]).toMatchObject({
      zScore: 1.5,
      relativeReturn: 2.0,
      sectorReturn: 7.0,
      benchmarkReturn: 5.0
    });
  });

  it('should handle year boundaries correctly', () => {
    const zScores = [
      { date: new Date('2023-12-15'), zScore: 1.0 },
      { date: new Date('2024-01-15'), zScore: 2.0 }
    ];

    const monthly = aggregateToMonthly(zScores);

    expect(monthly).toHaveLength(2);
    expect(monthly[0].date.getFullYear()).toBe(2023);
    expect(monthly[1].date.getFullYear()).toBe(2024);
  });

  it('should keep only the last entry per month', () => {
    const zScores = [
      { date: new Date('2024-01-05'), zScore: 1.0, value: 'first' },
      { date: new Date('2024-01-15'), zScore: 2.0, value: 'middle' },
      { date: new Date('2024-01-25'), zScore: 3.0, value: 'last' }
    ];

    const monthly = aggregateToMonthly(zScores);

    expect(monthly).toHaveLength(1);
    expect(monthly[0].zScore).toBe(3.0);
    expect(monthly[0].value).toBe('last');
  });

  it('should handle months with leading zeros correctly', () => {
    const zScores = [
      { date: new Date('2024-01-15'), zScore: 1.0 },
      { date: new Date('2024-09-15'), zScore: 2.0 }
    ];

    const monthly = aggregateToMonthly(zScores);

    expect(monthly).toHaveLength(2);
  });
});
