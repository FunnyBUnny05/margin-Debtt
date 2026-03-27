import { useState, useEffect, useCallback } from 'react';
import { getCached, setCache } from '../utils/cache';
import { CORS_PROXIES } from '../utils/corsProxies';

// ─── Alpha Vantage (primary — direct CORS, no proxy needed) ──────────────────
const AV_KEY = import.meta.env.VITE_ALPHA_VANTAGE_KEY;
const AV_BASE = 'https://www.alphavantage.co/query';
// Free tier: 5 req/min, 25 req/day
const AV_BATCH_SIZE = 5;
const AV_BATCH_DELAY_MS = 65_000; // wait >60s between batches

// ─── Shared helpers ───────────────────────────────────────────────────────────
const fetchWithTimeout = async (url, timeoutMs = 20000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
};

const hydratePrices = (prices) => {
  if (!prices || !Array.isArray(prices)) return null;
  return prices.map(p => ({ date: new Date(p.date), price: p.price }));
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Alpha Vantage ────────────────────────────────────────────────────────────
const parseAlphaVantageData = (data) => {
  // Detect rate-limit / info messages
  if (data['Note'] || data['Information']) return null;

  const timeSeries = data['Weekly Adjusted Time Series'];
  if (!timeSeries) return null;

  const prices = Object.entries(timeSeries)
    .map(([dateStr, vals]) => ({
      date: new Date(dateStr),
      price: parseFloat(vals['5. adjusted close'])
    }))
    .filter(p => !isNaN(p.price))
    .sort((a, b) => a.date - b.date);

  return prices.length > 0 ? prices : null;
};

const fetchAlphaVantage = async (symbol) => {
  if (!AV_KEY) throw new Error('No AV key');

  const cacheKey = `av_${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return { prices: hydratePrices(cached), fromCache: true };

  const url = `${AV_BASE}?function=TIME_SERIES_WEEKLY_ADJUSTED&symbol=${symbol}&outputsize=full&apikey=${AV_KEY}`;
  const res = await fetchWithTimeout(url, 20000);
  if (!res.ok) throw new Error(`AV HTTP ${res.status}`);

  const data = await res.json();
  const prices = parseAlphaVantageData(data);

  if (!prices) throw new Error('AV rate limited or no data');

  setCache(cacheKey, prices);
  return { prices, fromCache: false };
};

// ─── Yahoo Finance fallback (via CORS proxies) ────────────────────────────────
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
      prices.push({ date: new Date(timestamps[i] * 1000), price: adjClose[i] });
    }
  }
  return prices.length > 0 ? prices : null;
};

const fetchYahooData = async (symbol) => {
  const cacheKey = `yahoo_${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return hydratePrices(cached);

  const endDate = Math.floor(Date.now() / 1000);
  const startDate = endDate - (25 * 365 * 24 * 60 * 60);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${startDate}&period2=${endDate}&interval=1wk`;

  for (const proxyFn of CORS_PROXIES) {
    try {
      const res = await fetchWithTimeout(proxyFn(url), 12000);
      if (!res.ok) continue;
      const data = await res.json();
      const prices = parseYahooData(data);
      if (prices) {
        setCache(cacheKey, prices);
        return prices;
      }
    } catch {
      continue;
    }
  }
  return fetchStooqData(symbol);
};

// ─── Stooq last-resort fallback ───────────────────────────────────────────────
const fetchStooqData = async (symbol) => {
  const cacheKey = `stooq_${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return hydratePrices(cached);

  const url = `https://stooq.com/q/d/l/?s=${symbol.toLowerCase()}.us&i=w`;

  for (const proxyFn of CORS_PROXIES) {
    try {
      const res = await fetchWithTimeout(proxyFn(url), 12000);
      if (!res.ok) continue;
      const text = await res.text();
      const lines = text.trim().split('\n');
      if (lines.length < 2) continue;

      const prices = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length >= 5) {
          const close = parseFloat(parts[4]);
          if (!isNaN(close)) prices.push({ date: new Date(parts[0]), price: close });
        }
      }
      if (prices.length > 0) {
        prices.sort((a, b) => a.date - b.date);
        setCache(cacheKey, prices);
        return prices;
      }
    } catch {
      continue;
    }
  }
  throw new Error(`Failed to fetch data for ${symbol}`);
};

// ─── Unified fetch: AV → Yahoo → Stooq ───────────────────────────────────────
const fetchSymbol = async (symbol) => {
  try {
    const { prices } = await fetchAlphaVantage(symbol);
    return prices;
  } catch {
    // AV failed (no key, rate limited, network) — fall back
    return fetchYahooData(symbol);
  }
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useYahooFinance = (symbols, benchmark) => {
  const [data, setData] = useState({});
  const [benchmarkData, setBenchmarkData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const allSymbols = [benchmark, ...symbols.map(s => s.symbol)];
    setProgress({ current: 0, total: allSymbols.length });

    // Split into: those already cached (skip delay) vs those needing a live AV call
    // We still try AV for both, but cache hits return instantly.
    // For uncached symbols we must respect AV's 5 req/min limit.

    let fetchedCount = 0;

    // Helper: fetch one symbol and update progress
    const fetchOne = async (symbol) => {
      const prices = await fetchSymbol(symbol);
      fetchedCount++;
      setProgress({ current: fetchedCount, total: allSymbols.length });
      return prices;
    };

    // Benchmark first
    let benchmarkResult;
    try {
      benchmarkResult = await fetchOne(benchmark);
    } catch (err) {
      setError(`Failed to fetch benchmark ${benchmark}: ${err.message}`);
      setLoading(false);
      return;
    }

    // Sectors: check which are already cached in AV/yahoo/stooq
    // Fetch in batches of AV_BATCH_SIZE; insert delay only when we have uncached
    // symbols (cache hits don't consume an AV call so no delay is needed).
    const results = {};

    // First pass: resolve all cache hits instantly
    const uncached = [];
    for (const sector of symbols) {
      const avCached  = getCached(`av_${sector.symbol}`);
      const yahCached = getCached(`yahoo_${sector.symbol}`);
      const stqCached = getCached(`stooq_${sector.symbol}`);
      if (avCached || yahCached || stqCached) {
        try {
          results[sector.symbol] = await fetchOne(sector.symbol);
        } catch { /* skip */ }
      } else {
        uncached.push(sector);
      }
    }

    // Second pass: fetch uncached in batches of 5 (AV rate limit)
    for (let i = 0; i < uncached.length; i += AV_BATCH_SIZE) {
      if (i > 0) {
        // Wait between batches to respect 5 req/min AV limit
        await sleep(AV_BATCH_DELAY_MS);
      }
      const batch = uncached.slice(i, i + AV_BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(sector => fetchOne(sector.symbol).then(prices => ({ symbol: sector.symbol, prices })))
      );
      for (const result of batchResults) {
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
