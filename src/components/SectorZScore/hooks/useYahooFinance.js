import { useState, useEffect, useCallback } from 'react';
import { getCached, setCache } from '../utils/cache';

const CORS_PROXIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
];

const fetchWithTimeout = async (url, timeoutMs = 15000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return response;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
};

// Convert cached data back to proper Date objects
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

const fetchYahooData = async (symbol) => {
  // Check cache first
  const cacheKey = `yahoo_${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return hydratePrices(cached);
  }

  const endDate = Math.floor(Date.now() / 1000);
  const startDate = endDate - (25 * 365 * 24 * 60 * 60); // 25 years
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${startDate}&period2=${endDate}&interval=1wk`;

  // Try each proxy until one works
  for (const proxyFn of CORS_PROXIES) {
    try {
      const proxyUrl = proxyFn(url);
      const response = await fetchWithTimeout(proxyUrl, 12000);

      if (!response.ok) continue;

      const data = await response.json();
      const prices = parseYahooData(data);

      if (prices && prices.length > 0) {
        setCache(cacheKey, prices);
        return prices;
      }
    } catch (err) {
      // Try next proxy
      continue;
    }
  }

  // Fallback to Stooq
  return fetchStooqData(symbol);
};

const fetchStooqData = async (symbol) => {
  const cacheKey = `stooq_${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return hydratePrices(cached);
  }

  const stooqSymbol = symbol.toLowerCase() + '.us';
  const url = `https://stooq.com/q/d/l/?s=${stooqSymbol}&i=w`;

  for (const proxyFn of CORS_PROXIES) {
    try {
      const proxyUrl = proxyFn(url);
      const response = await fetchWithTimeout(proxyUrl, 12000);

      if (!response.ok) continue;

      const text = await response.text();
      const lines = text.trim().split('\n');

      if (lines.length < 2) continue;

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

      if (prices.length > 0) {
        prices.sort((a, b) => a.date - b.date);
        setCache(cacheKey, prices);
        return prices;
      }
    } catch (err) {
      continue;
    }
  }

  throw new Error(`Failed to fetch data for ${symbol}`);
};

export const useYahooFinance = (symbols, benchmark) => {
  const [data, setData] = useState({});
  const [benchmarkData, setBenchmarkData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const allSymbols = [...symbols.map(s => s.symbol), benchmark];
    setProgress({ current: 0, total: allSymbols.length });

    const results = {};
    let benchmarkResult = null;
    let fetchedCount = 0;

    // Fetch benchmark first
    try {
      benchmarkResult = await fetchYahooData(benchmark);
      fetchedCount++;
      setProgress({ current: fetchedCount, total: allSymbols.length });
    } catch (err) {
      setError(`Failed to fetch benchmark ${benchmark}: ${err.message}`);
      setLoading(false);
      return;
    }

    // Fetch sectors in batches to avoid overwhelming proxies
    const batchSize = 4;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(
        batch.map(async (sector) => {
          const prices = await fetchYahooData(sector.symbol);
          return { symbol: sector.symbol, prices };
        })
      );

      for (const result of batchResults) {
        fetchedCount++;
        setProgress({ current: fetchedCount, total: allSymbols.length });

        if (result.status === 'fulfilled') {
          results[result.value.symbol] = result.value.prices;
        }
      }
    }

    setData(results);
    setBenchmarkData(benchmarkResult);
    setLoading(false);
  }, [symbols, benchmark]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  return { data, benchmarkData, loading, error, progress, refetch: fetchAllData };
};

export default useYahooFinance;
