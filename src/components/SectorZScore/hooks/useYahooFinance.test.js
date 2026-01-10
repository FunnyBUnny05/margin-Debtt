import { describe, it, expect } from 'vitest';

// Extract functions for testing
const hydratePrices = (prices) => {
  if (!prices || !Array.isArray(prices)) return null;
  return prices.map(p => ({
    date: new Date(p.date),
    price: p.price
  }));
};

const parseYahooData = (data) => {
  const result = data?.chart?.result?.[0];
  if (!result) return null;

  const timestamps = result.timestamp;
  const quotes = result.indicators?.quote?.[0];
  const adjClose = result.indicators?.adjclose?.[0]?.adjclose || quotes?.close;

  if (!timestamps || !adjClose) return null;

  const prices = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (adjClose[i] != null) {
      prices.push({
        date: new Date(timestamps[i] * 1000),
        price: adjClose[i]
      });
    }
  }

  return prices;
};

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

    expect(prices).toEqual([]);
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

describe('Stooq CSV parsing (simulated)', () => {
  const parseStooqCsv = (text) => {
    const lines = text.trim().split('\n');

    if (lines.length < 2) return [];

    const prices = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length >= 5) {
        const dateStr = parts[0];
        const close = parseFloat(parts[4]);
        if (!isNaN(close)) {
          prices.push({
            date: new Date(dateStr),
            price: close
          });
        }
      }
    }

    prices.sort((a, b) => a.date - b.date);
    return prices;
  };

  it('should parse valid Stooq CSV', () => {
    const csv = `Date,Open,High,Low,Close,Volume
2024-01-01,100,105,99,102,1000000
2024-01-08,102,108,101,107,1200000`;

    const prices = parseStooqCsv(csv);

    expect(prices).toHaveLength(2);
    expect(prices[0].price).toBe(102);
    expect(prices[1].price).toBe(107);
  });

  it('should return empty for CSV with less than 2 lines', () => {
    expect(parseStooqCsv('Header')).toEqual([]);
    expect(parseStooqCsv('')).toEqual([]);
  });

  it('should skip malformed rows', () => {
    const csv = `Date,Open,High,Low,Close,Volume
2024-01-01,100,105,99,102,1000000
invalid,row,data
2024-01-15,103,109,102,108,1100000`;

    const prices = parseStooqCsv(csv);

    expect(prices).toHaveLength(2);
    expect(prices[0].price).toBe(102);
    expect(prices[1].price).toBe(108);
  });

  it('should skip rows with invalid close prices', () => {
    const csv = `Date,Open,High,Low,Close,Volume
2024-01-01,100,105,99,102,1000000
2024-01-08,102,108,101,abc,1200000
2024-01-15,103,109,102,108,1100000`;

    const prices = parseStooqCsv(csv);

    expect(prices).toHaveLength(2);
  });

  it('should sort prices chronologically', () => {
    const csv = `Date,Open,High,Low,Close,Volume
2024-01-15,103,109,102,108,1100000
2024-01-01,100,105,99,102,1000000
2024-01-08,102,108,101,107,1200000`;

    const prices = parseStooqCsv(csv);

    expect(prices[0].date).toEqual(new Date('2024-01-01'));
    expect(prices[1].date).toEqual(new Date('2024-01-08'));
    expect(prices[2].date).toEqual(new Date('2024-01-15'));
  });

  it('should handle rows with extra columns', () => {
    const csv = `Date,Open,High,Low,Close,Volume,Extra
2024-01-01,100,105,99,102,1000000,ignored`;

    const prices = parseStooqCsv(csv);

    expect(prices).toHaveLength(1);
    expect(prices[0].price).toBe(102);
  });

  it('should handle decimal close prices', () => {
    const csv = `Date,Open,High,Low,Close,Volume
2024-01-01,100,105,99,102.75,1000000`;

    const prices = parseStooqCsv(csv);

    expect(prices[0].price).toBe(102.75);
  });

  it('should skip rows with insufficient columns', () => {
    const csv = `Date,Open,High,Low,Close,Volume
2024-01-01,100,105,99
2024-01-08,102,108,101,107,1200000`;

    const prices = parseStooqCsv(csv);

    expect(prices).toHaveLength(1);
    expect(prices[0].price).toBe(107);
  });
});
