/**
 * useFredBuffettData
 *
 * Fetches a Buffett-Indicator proxy live from FRED:
 *   - WILL5000INDFC  →  Wilshire 5000 Full Cap Index (quarterly, end-of-period)
 *                       NOTE: This is an *index value* (e.g. ~57 000 in 2024),
 *                       not market cap in dollars. FRED does not expose a
 *                       total-market-cap series with open CORS access.
 *   - GDP            →  US GDP in billions of chained 2017 dollars (quarterly)
 *
 * ratio = (WILL5000INDFC / GDP) × 100
 *   — The absolute percentage is NOT the standard "market cap / GDP" ratio
 *     (which typically peaks near 200 %). Historically (1971) the index value
 *     is ~1 091 while GDP is ~$1 086 B, so our ratio starts near 100 %
 *     rather than the actual ~55 %.  The shape of the series is correct;
 *     only the absolute level is offset.
 *   — Because the OLS trend AND the σ bands are fitted to THIS same series,
 *     the std_devs deviation metric is internally consistent and the
 *     overvaluation / undervaluation SIGNAL is meaningful even if the
 *     absolute ratio_pct number differs from other sources.
 *
 * Falls back to the bundled buffett_indicator_data.json if FRED is unreachable.
 */

import { useState, useEffect } from 'react';

const WILL5000_URL =
  'https://fred.stlouisfed.org/graph/fredgraph.csv?id=WILL5000INDFC&freq=q&agg_method=eop';
const GDP_URL =
  'https://fred.stlouisfed.org/graph/fredgraph.csv?id=GDP';

// Parse a FRED CSV (two-column: DATE,VALUE)
const parseFredCsv = (text) => {
  const lines = text.trim().split('\n');
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].trim().split(',');
    if (parts.length < 2) continue;
    const dateStr = parts[0].trim();
    const rawVal = parts[1].trim();
    if (rawVal === '.' || rawVal === '') continue; // FRED uses '.' for missing
    const value = parseFloat(rawVal);
    if (!isNaN(value)) result.push({ date: dateStr, value });
  }
  return result;
};

// Convert a YYYY-MM-DD date string to a "YYYY-Qq" quarter key
const toQuarterKey = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00Z');
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `${d.getUTCFullYear()}-Q${q}`;
};

// Log-linear OLS: fits log(y) = a + b*i on equally-spaced indices i = 0…n-1
// Returns { a, b, stdDev } where stdDev is the residual std dev in log space
const logLinearOLS = (values) => {
  const n = values.length;
  const logY = values.map(v => Math.log(v));
  const indices = values.map((_, i) => i);

  const sumX = (n * (n - 1)) / 2;          // 0+1+…+(n-1)
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  const sumY = logY.reduce((a, b) => a + b, 0);
  const sumXY = indices.reduce((s, x, i) => s + x * logY[i], 0);

  const denom = n * sumX2 - sumX * sumX;
  const b = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const a = (sumY - b * sumX) / n;

  const residuals = logY.map((y, i) => y - (a + b * i));
  const variance = residuals.reduce((s, r) => s + r * r, 0) / n;
  const stdDev = Math.sqrt(variance);

  return { a, b, stdDev };
};

const getValuationLabel = (stdDevs) => {
  if (stdDevs > 2)  return 'STRONGLY OVERVALUED';
  if (stdDevs > 1)  return 'OVERVALUED';
  if (stdDevs > -1) return 'FAIR VALUE';
  if (stdDevs > -2) return 'UNDERVALUED';
  return 'STRONGLY UNDERVALUED';
};

const fetchFredCsv = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`FRED fetch failed: ${res.status}`);
    return await res.text();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
};

const buildBuffettData = (wilshireRaw, gdpRaw) => {
  // Build a quarterly GDP map: "YYYY-Qq" → GDP value
  const gdpMap = new Map();
  for (const { date, value } of gdpRaw) {
    gdpMap.set(toQuarterKey(date), value);
  }

  // Align Wilshire quarterly values to GDP quarters
  const aligned = [];
  for (const { date, value: wil } of wilshireRaw) {
    const qKey = toQuarterKey(date);
    const gdp = gdpMap.get(qKey);
    if (gdp && gdp > 0 && wil > 0) {
      aligned.push({ date, qKey, wil, gdp, ratio_pct: (wil / gdp) * 100 });
    }
  }

  if (aligned.length < 10) return null;

  // Fit log-linear trend across the full history
  const ratios = aligned.map(d => d.ratio_pct);
  const { a, b, stdDev } = logLinearOLS(ratios);

  const chartData = aligned.map((d, i) => {
    const logTrend = a + b * i;
    return {
      date: d.date,
      ratio_pct:     parseFloat(d.ratio_pct.toFixed(2)),
      trend_pct:     parseFloat(Math.exp(logTrend).toFixed(2)),
      band_plus1:    parseFloat(Math.exp(logTrend + stdDev).toFixed(2)),
      band_plus2:    parseFloat(Math.exp(logTrend + 2 * stdDev).toFixed(2)),
      band_minus1:   parseFloat(Math.exp(logTrend - stdDev).toFixed(2)),
      band_minus2:   parseFloat(Math.exp(logTrend - 2 * stdDev).toFixed(2)),
    };
  });

  const last = chartData[chartData.length - 1];
  const lastAligned = aligned[aligned.length - 1];
  const lastLogRatio = Math.log(last.ratio_pct);
  const lastLogTrend = Math.log(last.trend_pct);
  const std_devs = stdDev > 0 ? (lastLogRatio - lastLogTrend) / stdDev : 0;

  return {
    source: 'FRED — WILL5000INDFC / GDP (Live)',
    source_urls: [WILL5000_URL, GDP_URL],
    last_updated: new Date().toISOString(),
    current: {
      ratio_pct:           parseFloat(last.ratio_pct.toFixed(1)),
      trend_pct:           parseFloat(last.trend_pct.toFixed(1)),
      deviation_pct:       parseFloat((last.ratio_pct - last.trend_pct).toFixed(1)),
      std_devs:            parseFloat(std_devs.toFixed(2)),
      valuation:           getValuationLabel(std_devs),
      market_cap_billions: 0,  // Wilshire is an index, not directly in $
      gdp_billions:        Math.round(lastAligned.gdp),
    },
    data: chartData,
  };
};

/**
 * Returns { biData, biStatus }
 * biStatus: 'loading' | 'live' | 'fallback' | 'error'
 */
export const useFredBuffettData = () => {
  const [biData, setBiData] = useState(null);
  const [biStatus, setBiStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Try FRED live
      try {
        const [wilText, gdpText] = await Promise.all([
          fetchFredCsv(WILL5000_URL),
          fetchFredCsv(GDP_URL),
        ]);
        const wilshireRaw = parseFredCsv(wilText);
        const gdpRaw      = parseFredCsv(gdpText);
        const built = buildBuffettData(wilshireRaw, gdpRaw);
        if (built && !cancelled) {
          setBiData(built);
          setBiStatus('live');
          return;
        }
      } catch {
        // FRED unavailable — fall through to static JSON
      }

      // Fall back to bundled JSON
      if (cancelled) return;
      try {
        const res = await fetch('./buffett_indicator_data.json');
        if (!res.ok) throw new Error('JSON load failed');
        const json = await res.json();
        if (!cancelled) {
          setBiData(json);
          setBiStatus('fallback');
        }
      } catch {
        if (!cancelled) setBiStatus('error');
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  return { biData, biStatus };
};
