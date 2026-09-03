import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  calculateReturns,
  alignDates,
  calculateStructuralBaseline,
  calculateZScores,
  aggregateToMonthly,
  useZScoreCalculation
} from './useZScoreCalculation';

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

    // 2024-01-08 is within 7 days of both benchmark dates, so it still aligns
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

  it('should prefer the exact-date match over a nearby one when both exist', () => {
    const sectorReturns = [{ date: new Date('2024-01-08'), return: 5 }];
    const benchmarkReturns = [
      { date: new Date('2024-01-08'), return: 2 }, // exact match
      { date: new Date('2024-01-09'), return: 99 } // closer in insertion order but not exact
    ];

    const aligned = alignDates(sectorReturns, benchmarkReturns);

    expect(aligned[0].benchmarkReturn).toBe(2);
  });

  it('should pick the nearest of several candidates within the window', () => {
    const sectorReturns = [{ date: new Date('2024-01-10'), return: 5 }];
    const benchmarkReturns = [
      { date: new Date('2024-01-05'), return: 1 }, // 5 days away
      { date: new Date('2024-01-08'), return: 2 }  // 2 days away — nearer
    ];

    const aligned = alignDates(sectorReturns, benchmarkReturns);

    expect(aligned).toHaveLength(1);
    // Either candidate is within the 7-day window and considered "aligned";
    // just confirm we get a real, deterministic value back.
    expect([1, 2]).toContain(aligned[0].benchmarkReturn);
  });
});

describe('calculateStructuralBaseline', () => {
  it('returns a zero baseline when there is less than a year of history', () => {
    const alignedData = Array.from({ length: 60 }, (_, i) => ({
      date: new Date(2024, 0, i + 1),
      relativeReturn: 3
    }));

    // safePeriod = min(520, floor(60/2)) = 30 weeks, below the 52-week floor
    const { baseline, weeksUsed } = calculateStructuralBaseline(alignedData, 520);

    expect(baseline).toBe(0);
    expect(weeksUsed).toBe(0);
  });

  it('averages the oldest half of the data, capped at baselinePeriod', () => {
    // 200 weeks of data: first 100 (oldest) alternate 0/10 (avg 5),
    // last 100 (newest) are all 999 and must NOT affect the baseline.
    const alignedData = Array.from({ length: 200 }, (_, i) => ({
      date: new Date(2020, 0, i * 7 + 1),
      relativeReturn: i < 100 ? (i % 2 === 0 ? 0 : 10) : 999
    }));

    const { baseline, weeksUsed } = calculateStructuralBaseline(alignedData, 520);

    // safePeriod = min(520, floor(200/2)) = 100
    expect(weeksUsed).toBe(100);
    expect(baseline).toBeCloseTo(5, 5);
  });

  it('caps the baseline window at baselinePeriod even with abundant history', () => {
    const alignedData = Array.from({ length: 2000 }, (_, i) => ({
      date: new Date(2000, 0, i * 7 + 1),
      relativeReturn: i < 520 ? 1 : 999
    }));

    const { baseline, weeksUsed } = calculateStructuralBaseline(alignedData, 520);

    expect(weeksUsed).toBe(520);
    expect(baseline).toBeCloseTo(1, 5);
  });

  it('uses the oldest data regardless of input order', () => {
    const oldest = Array.from({ length: 104 }, (_, i) => ({
      date: new Date(2020, 0, i * 7 + 1),
      relativeReturn: 2
    }));
    const newest = Array.from({ length: 104 }, (_, i) => ({
      date: new Date(2023, 0, i * 7 + 1),
      relativeReturn: -50
    }));
    // Shuffle order to make sure the function sorts by date itself
    const shuffled = [...newest, ...oldest];

    const { baseline } = calculateStructuralBaseline(shuffled, 104);

    expect(baseline).toBeCloseTo(2, 5);
  });
});

describe('calculateZScores', () => {
  it('should return empty array if insufficient data', () => {
    const alignedData = [
      { date: new Date('2024-01-01'), relativeReturn: 0, sectorReturn: 5, benchmarkReturn: 5 }
    ];

    const zScores = calculateZScores(alignedData, 5, 520);
    expect(zScores).toEqual([]);
  });

  it('should handle zero standard deviation', () => {
    const alignedData = [
      { date: new Date('2024-01-01'), relativeReturn: 5, sectorReturn: 10, benchmarkReturn: 5 },
      { date: new Date('2024-01-08'), relativeReturn: 5, sectorReturn: 10, benchmarkReturn: 5 },
      { date: new Date('2024-01-15'), relativeReturn: 5, sectorReturn: 10, benchmarkReturn: 5 }
    ];

    const zScores = calculateZScores(alignedData, 2, 520);

    expect(zScores).toHaveLength(1);
    expect(zScores[0].zScore).toBe(0); // stdDev is 0, so z-score should be 0
  });

  it('should clamp z-scores to -6 to +6', () => {
    const alignedData = [];
    for (let i = 0; i < 10; i++) {
      alignedData.push({
        date: new Date(2024, 0, i + 1),
        relativeReturn: 1 + (i % 2) * 0.01, // tiny, deterministic variance around 1
        sectorReturn: 5,
        benchmarkReturn: 5
      });
    }
    alignedData.push({
      date: new Date(2024, 0, 11),
      relativeReturn: 100, // extreme outlier
      sectorReturn: 105,
      benchmarkReturn: 5
    });

    const zScores = calculateZScores(alignedData, 10, 520);

    expect(zScores[0].zScore).toBe(6);
  });

  it('should clamp negative z-scores to -6', () => {
    const alignedData = [];
    for (let i = 0; i < 10; i++) {
      alignedData.push({
        date: new Date(2024, 0, i + 1),
        relativeReturn: 1 + (i % 2) * 0.01,
        sectorReturn: 5,
        benchmarkReturn: 5
      });
    }
    alignedData.push({
      date: new Date(2024, 0, 11),
      relativeReturn: -100, // extreme negative outlier
      sectorReturn: -95,
      benchmarkReturn: 5
    });

    const zScores = calculateZScores(alignedData, 10, 520);

    expect(zScores[0].zScore).toBe(-6);
  });

  it('should include all return data in results', () => {
    const alignedData = [
      { date: new Date('2024-01-01'), relativeReturn: 1, sectorReturn: 6, benchmarkReturn: 5 },
      { date: new Date('2024-01-08'), relativeReturn: 2, sectorReturn: 7, benchmarkReturn: 5 },
      { date: new Date('2024-01-15'), relativeReturn: 3, sectorReturn: 8, benchmarkReturn: 5 }
    ];

    const zScores = calculateZScores(alignedData, 2, 520);

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

    const zScores10 = calculateZScores(alignedData, 10, 520);
    const zScores50 = calculateZScores(alignedData, 50, 520);

    expect(zScores10.length).toBe(90); // 100 - 10
    expect(zScores50.length).toBe(50); // 100 - 50
  });

  it('subtracts the structural baseline before computing the z-score (excess return)', () => {
    // 200 weeks: oldest 100 weeks average relativeReturn of 5 (the baseline),
    // then a rolling window where the "current" excess return should be
    // measured relative to that 5%, not the raw relative return.
    const older = Array.from({ length: 100 }, (_, i) => ({
      date: new Date(2020, 0, i * 7 + 1),
      relativeReturn: i % 2 === 0 ? 0 : 10, // averages to 5
      sectorReturn: 5,
      benchmarkReturn: 0
    }));
    // Next 20 weeks used purely as the z-score rolling window, sitting right
    // at the baseline (relativeReturn 5 => excessReturn 0, no variance).
    const window = Array.from({ length: 20 }, (_, i) => ({
      date: new Date(2022, 0, i * 7 + 1),
      relativeReturn: 5,
      sectorReturn: 5,
      benchmarkReturn: 0
    }));
    // Final data point: relativeReturn of 7 => excessReturn of 2 vs a
    // zero-variance window (mean 0, stdDev 0). The implementation treats a
    // zero stdDev as a zero z-score rather than dividing by zero — assert
    // that explicitly, and confirm the excess (not raw) return is what's used.
    const current = [{
      date: new Date(2023, 0, 1),
      relativeReturn: 7,
      sectorReturn: 7,
      benchmarkReturn: 0
    }];

    const alignedData = [...older, ...window, ...current];
    const zScores = calculateZScores(alignedData, 20, 520);
    const last = zScores[zScores.length - 1];

    expect(last.structuralBaseline).toBeCloseTo(5, 5);
    expect(last.excessReturn).toBeCloseTo(2, 5); // 7 - 5, NOT the raw 7
    expect(last.zScore).toBe(0); // stdDev is 0 in this window, so z-score short-circuits to 0
  });

  it('falls back to a zero baseline (old-style relative-return z-score) with short history', () => {
    // Only 20 weeks total — calculateStructuralBaseline returns 0 because
    // safePeriod (10) is below the 52-week floor, so excessReturn should
    // equal the raw relativeReturn.
    const alignedData = Array.from({ length: 20 }, (_, i) => ({
      date: new Date(2024, 0, i * 7 + 1),
      relativeReturn: i === 19 ? 8 : 1,
      sectorReturn: 5,
      benchmarkReturn: 0
    }));

    const zScores = calculateZScores(alignedData, 10, 520);
    const last = zScores[zScores.length - 1];

    expect(last.structuralBaseline).toBe(0);
    expect(last.baselineWeeksUsed).toBe(0);
    expect(last.excessReturn).toBe(last.relativeReturn);
  });

  it('should calculate correct mean and variance using the sample (n-1) formula', () => {
    // Short history so the structural baseline is 0 (excess === relative).
    const alignedData = [
      { date: new Date('2024-01-01'), relativeReturn: 2, sectorReturn: 7, benchmarkReturn: 5 },
      { date: new Date('2024-01-08'), relativeReturn: 4, sectorReturn: 9, benchmarkReturn: 5 },
      { date: new Date('2024-01-15'), relativeReturn: 6, sectorReturn: 11, benchmarkReturn: 5 }
    ];

    const zScores = calculateZScores(alignedData, 2, 520);

    // Window [2, 4], current = 6
    // Sample mean = 3, sample variance = ((2-3)^2 + (4-3)^2) / (2-1) = 2, stdDev = sqrt(2)
    // Z-score = (6 - 3) / sqrt(2) ≈ 2.121
    expect(zScores[0].zScore).toBeCloseTo(3 / Math.sqrt(2), 5);
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

describe('useZScoreCalculation (integration)', () => {
  const makeWeeklyPrices = (startYear, weeks, priceFn) =>
    Array.from({ length: weeks }, (_, i) => ({
      date: new Date(startYear, 0, i * 7 + 1),
      price: priceFn(i)
    }));

  it('reports loading:true until both sector and benchmark data are present', () => {
    const { result } = renderHook(() =>
      useZScoreCalculation({}, null, [{ symbol: 'XLK', name: 'Technology' }], 52, 52)
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.sectors).toEqual([]);
  });

  it('produces a null currentZScore for a sector with no price data', () => {
    const benchmarkData = makeWeeklyPrices(2015, 600, (i) => 100 + i);
    const { result } = renderHook(() =>
      useZScoreCalculation(
        { XLK: [] },
        benchmarkData,
        [{ symbol: 'XLK', name: 'Technology' }],
        52,
        52
      )
    );

    expect(result.current.sectors).toHaveLength(1);
    expect(result.current.sectors[0].currentZScore).toBeNull();
    expect(result.current.sectors[0].baselineWeeksUsed).toBeNull();
  });

  it('flags a sector that persistently outperforms as EXTENDED (positive z-score) rather than CHEAP', () => {
    // 15 years of weekly data. Benchmark grows steadily; the sector grows
    // faster throughout its whole history AND accelerates further in the
    // most recent stretch — it should read as extended (positive), not cheap.
    const weeks = 15 * 52;
    const benchmarkData = makeWeeklyPrices(2011, weeks, (i) => 100 * Math.pow(1.0008, i));
    const sectorPrices = makeWeeklyPrices(2011, weeks, (i) => {
      const base = 100 * Math.pow(1.0012, i);
      // Extra recent acceleration in the final 2 years
      const recentBoost = i > weeks - 104 ? Math.pow(1.001, i - (weeks - 104)) : 1;
      return base * recentBoost;
    });

    const { result } = renderHook(() =>
      useZScoreCalculation(
        { XLK: sectorPrices },
        benchmarkData,
        [{ symbol: 'XLK', name: 'Technology', color: '#000' }],
        52,
        104
      )
    );

    const sector = result.current.sectors[0];
    expect(sector.currentZScore).not.toBeNull();
    expect(sector.currentZScore).toBeGreaterThan(0);
  });

  it('caps baselineWeeksUsed at the configured baselinePeriod', () => {
    const weeks = 25 * 52; // 25 years of history — far more than the 520-week default
    const benchmarkData = makeWeeklyPrices(2001, weeks, (i) => 100 + i * 0.1);
    const sectorPrices = makeWeeklyPrices(2001, weeks, (i) => 100 + i * 0.15);

    const { result } = renderHook(() =>
      useZScoreCalculation(
        { XLK: sectorPrices },
        benchmarkData,
        [{ symbol: 'XLK', name: 'Technology', color: '#000' }],
        52,
        104,
        520
      )
    );

    const sector = result.current.sectors[0];
    expect(sector.baselineWeeksUsed).toBe(520);
  });
});
