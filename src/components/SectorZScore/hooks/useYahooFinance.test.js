import { describe, it, expect } from 'vitest';

import { hydratePrices, parseYahooData, parseSnapshot, pickFresher } from './useYahooFinance';

describe('hydratePrices', () => {
  it('should convert date strings to Date objects', () => {
    const prices = [
      { date: '2024-01-01T00:00:00.000Z', price: 100 },
      { date: '2024-01-08T00:00:00.000Z', price: 105 }
    ];

    const hydrated = hydratePrices(prices);

    expect(hydrated).toHaveLength(2);
    expect(hydrated[0].date).toBeInstanceOf(Date);
    expect(hydrated[0].price).toBe(100);
    expect(hydrated[1].date).toBeInstanceOf(Date);
    expect(hydrated[1].price).toBe(105);
  });

  it('should return null for null input', () => {
    expect(hydratePrices(null)).toBeNull();
  });

  it('should return null for undefined input', () => {
    expect(hydratePrices(undefined)).toBeNull();
  });

  it('should return null for non-array input', () => {
    expect(hydratePrices('not an array')).toBeNull();
    expect(hydratePrices({})).toBeNull();
    expect(hydratePrices(123)).toBeNull();
  });

  it('should handle empty array', () => {
    const hydrated = hydratePrices([]);
    expect(hydrated).toEqual([]);
  });

  it('should preserve price values exactly', () => {
    const prices = [
      { date: '2024-01-01', price: 123.456 },
      { date: '2024-01-02', price: 0 },
      { date: '2024-01-03', price: -50 }
    ];

    const hydrated = hydratePrices(prices);

    expect(hydrated[0].price).toBe(123.456);
    expect(hydrated[1].price).toBe(0);
    expect(hydrated[2].price).toBe(-50);
  });

  it('should handle ISO date strings', () => {
    const prices = [
      { date: '2024-01-15T14:30:00.000Z', price: 100 }
    ];

    const hydrated = hydratePrices(prices);

    expect(hydrated[0].date.getFullYear()).toBe(2024);
    expect(hydrated[0].date.getMonth()).toBe(0); // January
    expect(hydrated[0].date.getDate()).toBe(15);
  });

  it('should handle timestamps', () => {
    const prices = [
      { date: 1704067200000, price: 100 } // 2024-01-01
    ];

    const hydrated = hydratePrices(prices);

    expect(hydrated[0].date).toBeInstanceOf(Date);
    expect(hydrated[0].date.getFullYear()).toBe(2024);
  });
});

describe('parseYahooData', () => {
  it('should parse valid Yahoo Finance response', () => {
    const yahooResponse = {
      chart: {
        result: [{
          timestamp: [1609459200, 1610064000, 1610668800], // Unix timestamps
          indicators: {
            quote: [{
              close: [100, 105, 110]
            }],
            adjclose: [{
              adjclose: [99, 104, 109]
            }]
          }
        }]
      }
    };

    const prices = parseYahooData(yahooResponse);

    expect(prices).toHaveLength(3);
    expect(prices[0].price).toBe(99); // Uses adjclose
    expect(prices[1].price).toBe(104);
    expect(prices[2].price).toBe(109);
    expect(prices[0].date).toBeInstanceOf(Date);
  });

  it('should fallback to close prices when adjclose is missing', () => {
    const yahooResponse = {
      chart: {
        result: [{
          timestamp: [1609459200, 1610064000],
          indicators: {
            quote: [{
              close: [100, 105]
            }]
          }
        }]
      }
    };

    const prices = parseYahooData(yahooResponse);

    expect(prices).toHaveLength(2);
    expect(prices[0].price).toBe(100);
    expect(prices[1].price).toBe(105);
  });

  it('should return null for invalid structure', () => {
    expect(parseYahooData(null)).toBeNull();
    expect(parseYahooData({})).toBeNull();
    expect(parseYahooData({ chart: {} })).toBeNull();
    expect(parseYahooData({ chart: { result: [] } })).toBeNull();
  });

  it('should return null when timestamps are missing', () => {
    const yahooResponse = {
      chart: {
        result: [{
          indicators: {
            adjclose: [{
              adjclose: [100, 105]
            }]
          }
        }]
      }
    };

    const prices = parseYahooData(yahooResponse);
    expect(prices).toBeNull();
  });

  it('should return null when price data is missing', () => {
    const yahooResponse = {
      chart: {
        result: [{
          timestamp: [1609459200, 1610064000]
        }]
      }
    };

    const prices = parseYahooData(yahooResponse);
    expect(prices).toBeNull();
  });

  it('should skip null price values', () => {
    const yahooResponse = {
      chart: {
        result: [{
          timestamp: [1609459200, 1610064000, 1610668800, 1611273600],
          indicators: {
            adjclose: [{
              adjclose: [100, null, undefined, 110]
            }]
          }
        }]
      }
    };

    const prices = parseYahooData(yahooResponse);

    expect(prices).toHaveLength(2);
    expect(prices[0].price).toBe(100);
    expect(prices[1].price).toBe(110);
  });

  it('should handle empty arrays', () => {
    const yahooResponse = {
      chart: {
        result: [{
          timestamp: [],
          indicators: {
            adjclose: [{
              adjclose: []
            }]
          }
        }]
      }
    };

    const prices = parseYahooData(yahooResponse);

    // Production treats an empty series as "no data" so callers fall through to the next source
    expect(prices).toBeNull();
  });

  it('should convert Unix timestamps to JavaScript Date objects', () => {
    const yahooResponse = {
      chart: {
        result: [{
          timestamp: [1704067200], // 2024-01-01 00:00:00 UTC
          indicators: {
            adjclose: [{
              adjclose: [100]
            }]
          }
        }]
      }
    };

    const prices = parseYahooData(yahooResponse);

    expect(prices[0].date).toBeInstanceOf(Date);
    expect(prices[0].date.getTime()).toBe(1704067200000);
  });

  it('should handle mismatched array lengths gracefully', () => {
    const yahooResponse = {
      chart: {
        result: [{
          timestamp: [1609459200, 1610064000, 1610668800],
          indicators: {
            adjclose: [{
              adjclose: [100, 105] // One less than timestamps
            }]
          }
        }]
      }
    };

    const prices = parseYahooData(yahooResponse);

    expect(prices).toHaveLength(2);
  });

  it('should handle zero prices', () => {
    const yahooResponse = {
      chart: {
        result: [{
          timestamp: [1609459200],
          indicators: {
            adjclose: [{
              adjclose: [0]
            }]
          }
        }]
      }
    };

    const prices = parseYahooData(yahooResponse);

    expect(prices).toHaveLength(1);
    expect(prices[0].price).toBe(0);
  });

  it('should handle negative prices', () => {
    const yahooResponse = {
      chart: {
        result: [{
          timestamp: [1609459200],
          indicators: {
            adjclose: [{
              adjclose: [-50]
            }]
          }
        }]
      }
    };

    const prices = parseYahooData(yahooResponse);

    expect(prices).toHaveLength(1);
    expect(prices[0].price).toBe(-50);
  });

  it('should handle very large datasets', () => {
    const timestamps = Array.from({ length: 1000 }, (_, i) => 1609459200 + i * 86400);
    const adjclose = Array.from({ length: 1000 }, (_, i) => 100 + i);

    const yahooResponse = {
      chart: {
        result: [{
          timestamp: timestamps,
          indicators: {
            adjclose: [{
              adjclose: adjclose
            }]
          }
        }]
      }
    };

    const prices = parseYahooData(yahooResponse);

    expect(prices).toHaveLength(1000);
    expect(prices[0].price).toBe(100);
    expect(prices[999].price).toBe(1099);
  });

  it('should handle decimal prices with precision', () => {
    const yahooResponse = {
      chart: {
        result: [{
          timestamp: [1609459200],
          indicators: {
            adjclose: [{
              adjclose: [123.456789]
            }]
          }
        }]
      }
    };

    const prices = parseYahooData(yahooResponse);

    expect(prices[0].price).toBe(123.456789);
  });
});

describe('parseSnapshot', () => {
  it('parses symbols into Date/price arrays', () => {
    const out = parseSnapshot({
      symbols: { SPY: { dates: ['2024-01-01', '2024-01-08'], prices: [470.1, 475.2] } },
    });
    expect(out.SPY).toHaveLength(2);
    expect(out.SPY[0].date.toISOString().slice(0, 10)).toBe('2024-01-01');
    expect(out.SPY[1].price).toBe(475.2);
  });

  it('skips non-numeric prices and malformed series', () => {
    const out = parseSnapshot({
      symbols: {
        SPY: { dates: ['2024-01-01', '2024-01-08'], prices: [null, 475.2] },
        BAD: { dates: ['2024-01-01'], prices: [1, 2] },
        EMPTY: { dates: [], prices: [] },
      },
    });
    expect(out.SPY).toHaveLength(1);
    expect(out.BAD).toBeUndefined();
    expect(out.EMPTY).toBeUndefined();
  });

  it('returns {} for garbage input', () => {
    expect(parseSnapshot(null)).toEqual({});
    expect(parseSnapshot({})).toEqual({});
    expect(parseSnapshot({ symbols: 'nope' })).toEqual({});
  });
});

describe('pickFresher', () => {
  const series = (n, endDay) =>
    Array.from({ length: n }, (_, i) => ({ date: new Date(Date.UTC(2024, 0, endDay - (n - 1 - i) * 7)), price: i }));

  it('prefers live data when it is newer and complete', () => {
    const snap = series(100, 1);
    const live = series(100, 8);
    expect(pickFresher(snap, live)).toBe(live);
  });

  it('keeps the snapshot when live data is truncated', () => {
    const snap = series(100, 1);
    const live = series(20, 8);
    expect(pickFresher(snap, live)).toBe(snap);
  });

  it('keeps the snapshot when live data is older', () => {
    const snap = series(100, 8);
    const live = series(100, 1);
    expect(pickFresher(snap, live)).toBe(snap);
  });

  it('falls back to whichever side exists', () => {
    const s = series(10, 1);
    expect(pickFresher(undefined, s)).toBe(s);
    expect(pickFresher(s, null)).toBe(s);
  });
});
