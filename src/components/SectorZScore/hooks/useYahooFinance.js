import { useState, useEffect, useCallback, useRef } from 'react';
import { getCached, setCache } from '../utils/cache';
import { CORS_PROXIES } from '../utils/corsProxies';
import { BENCHMARKS } from '../constants';

/*
 * Data loading strategy (fastest first):
 *   1. ./sector_prices.json — weekly snapshot of every sector ETF + benchmark,
 *      written by scripts/fetch_sector_prices.py in the weekly GitHub Action.
 *      One static request, so the tab renders almost instantly.
 *   2. Live Yahoo Finance via CORS proxies — only for symbols missing from the
 *      snapshot, or to top up a stale snapshot in the background. All symbols are
 *      fetched in parallel and the proxies are raced, so one slow proxy can't
 *      stall the page.
 */

export const SNAPSHOT_URL = './sector_prices.json';
// Snapshot is refreshed weekly; only bother topping it up live once it's this old
export const SNAPSHOT_STALE_MS = 4 * 24 * 60 * 60 * 1000;
const LIVE_TIMEOUT_MS = 10_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fetchWithTimeout = async (url, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

export const hydratePrices = (prices) => {
  if (!prices || !Array.isArray(prices)) return null;
  return prices.map(p => ({ date: new Date(p.date), price: p.price }));
};

export const parseYahooData = (data) => {
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

/**
 * Parse the snapshot file into { SYMBOL: [{date: Date, price}] }.
 * Format: { last_updated, symbols: { SPY: { dates: ['YYYY-MM-DD'], prices: [n] } } }
 */
export const parseSnapshot = (json) => {
  const out = {};
  const symbols = json?.symbols;
  if (!symbols || typeof symbols !== 'object') return out;
  for (const [symbol, series] of Object.entries(symbols)) {
    const { dates, prices } = series || {};
    if (!Array.isArray(dates) || !Array.isArray(prices) || dates.length !== prices.length) continue;
    const parsed = [];
    for (let i = 0; i < dates.length; i++) {
      const price = prices[i];
      if (typeof price !== 'number' || !isFinite(price)) continue;
      parsed.push({ date: new Date(`${dates[i]}T00:00:00Z`), price });
    }
    if (parsed.length > 0) out[symbol] = parsed;
  }
  return out;
};

const lastDate = (prices) => (prices?.length ? prices[prices.length - 1].date : null);
const newestDate = (dataMap) =>
  Object.values(dataMap).map(lastDate).filter(Boolean).sort((a, b) => b - a)[0] || null;

/** Prefer the live series when it is at least as recent and not truncated. */
export const pickFresher = (snapshot, live) => {
  if (!live?.length) return snapshot;
  if (!snapshot?.length) return live;
  const liveNewer = lastDate(live) >= lastDate(snapshot);
  const liveComplete = live.length >= snapshot.length * 0.9;
  return liveNewer && liveComplete ? live : snapshot;
};

// ─── Live fetch (Yahoo via CORS proxies, raced in parallel) ───────────────────
export const fetchLiveSymbol = async (symbol, { skipCache = false } = {}) => {
  const cacheKey = `yahoo_${symbol}`;
  if (!skipCache) {
    const cached = getCached(cacheKey);
    if (cached) return hydratePrices(cached);
  }

  const endDate = Math.floor(Date.now() / 1000);
  const startDate = endDate - (25 * 365 * 24 * 60 * 60);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${startDate}&period2=${endDate}&interval=1wk`;

  const tryProxy = async (proxyFn) => {
    const res = await fetchWithTimeout(proxyFn(url), LIVE_TIMEOUT_MS);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const prices = parseYahooData(await res.json());
    if (!prices) throw new Error('no data');
    return prices;
  };

  let prices;
  try {
    prices = await Promise.any(CORS_PROXIES.map(tryProxy));
  } catch {
    throw new Error(`Failed to fetch live data for ${symbol}`);
  }
  setCache(cacheKey, prices);
  return prices;
};

const loadSnapshot = async () => {
  try {
    const res = await fetchWithTimeout(SNAPSHOT_URL, 15_000);
    if (!res.ok) return null;
    const json = await res.json();
    const data = parseSnapshot(json);
    if (Object.keys(data).length === 0) return null;
    return { data, lastUpdated: json.last_updated ? new Date(json.last_updated) : null };
  } catch {
    return null;
  }
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
/**
 * Loads prices for every sector plus every benchmark once, so switching
 * benchmark is instant (no refetch).
 */
export const useYahooFinance = (symbols, benchmark) => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [meta, setMeta] = useState({ source: null, asOf: null });
  const runId = useRef(0);
  const dataRef = useRef(data);
  dataRef.current = data;

  const fetchAllData = useCallback(async ({ forceLive = false } = {}) => {
    const id = ++runId.current;
    const isCurrent = () => id === runId.current;
    const allSymbols = [...new Set([...BENCHMARKS.map(b => b.symbol), ...symbols.map(s => s.symbol)])];

    setError(null);
    setProgress({ current: 0, total: allSymbols.length });

    // 1. Snapshot
    const snapshot = forceLive ? null : await loadSnapshot();
    if (!isCurrent()) return;

    // A forced live refresh tops up whatever is already on screen
    let merged = forceLive ? { ...dataRef.current } : {};
    if (snapshot) {
      merged = { ...snapshot.data };
      setData(merged);
      setMeta({ source: 'snapshot', asOf: newestDate(merged) || snapshot.lastUpdated });
      setLoading(false);
    } else if (!forceLive) {
      setLoading(true);
    }

    // 2. Decide what needs a live fetch
    const missing = allSymbols.filter(s => !merged[s]);
    const stale = snapshot?.lastUpdated && (Date.now() - snapshot.lastUpdated.getTime() > SNAPSHOT_STALE_MS);
    const toFetch = forceLive || stale ? allSymbols : missing;
    if (toFetch.length === 0) return;

    const blocking = !snapshot && !forceLive; // nothing on screen yet
    if (!blocking) setRefreshing(true);

    let done = 0;
    const results = await Promise.allSettled(
      toFetch.map(symbol =>
        fetchLiveSymbol(symbol, { skipCache: forceLive }).finally(() => {
          done++;
          if (isCurrent()) setProgress({ current: done, total: toFetch.length });
        })
      )
    );
    if (!isCurrent()) return;

    let liveCount = 0;
    const next = { ...merged };
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        const sym = toFetch[i];
        const chosen = pickFresher(next[sym], r.value);
        if (chosen === r.value) liveCount++;
        next[sym] = chosen;
      }
    });

    if (liveCount > 0) {
      setData(next);
      setMeta({ source: liveCount < allSymbols.length ? 'mixed' : 'live', asOf: newestDate(next) });
    }

    if (Object.keys(next).length === 0) {
      setError('Could not load sector price data (snapshot missing and live sources unavailable).');
    }
    setLoading(false);
    setRefreshing(false);
  }, [symbols]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const benchmarkData = data[benchmark] || null;
  const benchmarkError = !loading && !error && Object.keys(data).length > 0 && !benchmarkData
    ? `No price data for benchmark ${benchmark}`
    : null;

  return {
    data,
    benchmarkData,
    loading,
    refreshing,
    error: error || benchmarkError,
    progress,
    meta,
    refetch: () => fetchAllData(),
    refreshLive: () => fetchAllData({ forceLive: true }),
  };
};

export default useYahooFinance;
