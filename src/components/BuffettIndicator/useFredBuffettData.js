/**
 * useFredBuffettData
 *
 * Loads the Buffett Indicator dataset.  Strategy (in order):
 *   1. Static JSON  (./buffett_indicator_data.json) — pre-built by CI, always works,
 *      includes Berkshire cash hoard data, updated weekly.
 *   2. FRED live    — tries to fetch WILL5000INDFC + GDP if JSON is > 95 days old.
 *
 * The JSON now embeds berkshire_cash so the browser never needs a separate
 * Yahoo Finance call, which was the main reliability bottleneck.
 *
 * Returns { biData, biStatus }
 *   biStatus: 'loading' | 'live' | 'fallback' | 'error'
 */

import { useState, useEffect } from 'react';

const WILL5000_URL =
  'https://fred.stlouisfed.org/graph/fredgraph.csv?id=WILL5000INDFC&freq=q&agg_method=eop';
const GDP_URL =
  'https://fred.stlouisfed.org/graph/fredgraph.csv?id=GDP';

const parseFredCsv = (text) => {
  const lines = text.trim().split('\n');
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const [dateStr, rawVal] = lines[i].trim().split(',');
    if (!rawVal || rawVal === '.') continue;
    const value = parseFloat(rawVal);
    if (!isNaN(value)) result.push({ date: dateStr.trim(), value });
  }
  return result;
};

const toQuarterKey = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00Z');
  return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
};

const logLinearOLS = (values) => {
  const n = values.length;
  const logY = values.map(v => Math.log(v));
  const sumX  = (n * (n - 1)) / 2;
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  const sumY  = logY.reduce((a, b) => a + b, 0);
  const sumXY = logY.reduce((s, y, i) => s + i * y, 0);
  const denom = n * sumX2 - sumX * sumX;
  const b = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const a = (sumY - b * sumX) / n;
  const residuals = logY.map((y, i) => y - (a + b * i));
  const stdDev = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / n);
  return { a, b, stdDev };
};

const getValuationLabel = (sd) => {
  if (sd > 2)  return 'STRONGLY OVERVALUED';
  if (sd > 1)  return 'OVERVALUED';
  if (sd > -1) return 'FAIR VALUE';
  if (sd > -2) return 'UNDERVALUED';
  return 'STRONGLY UNDERVALUED';
};

const daysSince = (isoString) => {
  if (!isoString) return Infinity;
  return (Date.now() - new Date(isoString).getTime()) / 86_400_000;
};

const fetchFredCsv = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`FRED ${res.status}`);
    return await res.text();
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
};

const buildFromFred = (wilshireRaw, gdpRaw) => {
  const gdpMap = new Map();
  for (const { date, value } of gdpRaw) gdpMap.set(toQuarterKey(date), value);

  const aligned = [];
  for (const { date, value: wil } of wilshireRaw) {
    const gdp = gdpMap.get(toQuarterKey(date));
    if (gdp && gdp > 0 && wil > 0) {
      aligned.push({ date, ratio_pct: (wil / gdp) * 100 });
    }
  }
  if (aligned.length < 10) return null;

  const ratios = aligned.map(d => d.ratio_pct);
  const { a, b, stdDev } = logLinearOLS(ratios);

  const data = aligned.map((d, i) => {
    const lt = a + b * i;
    return {
      date:        d.date,
      ratio_pct:   parseFloat(d.ratio_pct.toFixed(2)),
      trend_pct:   parseFloat(Math.exp(lt).toFixed(2)),
      band_plus1:  parseFloat(Math.exp(lt + stdDev).toFixed(2)),
      band_plus2:  parseFloat(Math.exp(lt + 2 * stdDev).toFixed(2)),
      band_minus1: parseFloat(Math.exp(lt - stdDev).toFixed(2)),
      band_minus2: parseFloat(Math.exp(lt - 2 * stdDev).toFixed(2)),
    };
  });

  const last = data[data.length - 1];
  const logR = Math.log(last.ratio_pct);
  const logT = Math.log(last.trend_pct);
  const std_devs = stdDev > 0 ? (logR - logT) / stdDev : 0;

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
      market_cap_billions: 0,
      gdp_billions:        0,
    },
    data,
    // berkshire_cash is not available from FRED — caller uses static JSON value
    berkshire_cash: null,
  };
};

export const useFredBuffettData = () => {
  const [biData, setBiData]   = useState(null);
  const [biStatus, setBiStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // ── Step 1: Always load static JSON first (fast, reliable) ─────────────
      let staticData = null;
      try {
        const res = await fetch('./buffett_indicator_data.json');
        if (res.ok) {
          staticData = await res.json();
          if (!cancelled) {
            setBiData(staticData);
            setBiStatus('fallback'); // will upgrade to 'live' if FRED succeeds
          }
        }
      } catch { /* static fetch failed — continue to FRED */ }

      if (cancelled) return;

      // ── Step 2: Attempt FRED live refresh only if static data is old ────────
      const staticAgeDays = daysSince(staticData?.last_updated);
      if (staticAgeDays < 95) {
        // Static JSON is fresh enough; mark as live (CI updates it weekly)
        if (!cancelled && staticData) {
          setBiStatus('live');
        }
        return;
      }

      // Static data is stale — try FRED
      try {
        const [wilText, gdpText] = await Promise.all([
          fetchFredCsv(WILL5000_URL),
          fetchFredCsv(GDP_URL),
        ]);
        const built = buildFromFred(parseFredCsv(wilText), parseFredCsv(gdpText));
        if (built && !cancelled) {
          // Preserve berkshire_cash from static JSON (not available from FRED live)
          built.berkshire_cash = staticData?.berkshire_cash ?? null;
          setBiData(built);
          setBiStatus('live');
        }
      } catch {
        // FRED unavailable — static JSON is already shown
        if (!cancelled && staticData) setBiStatus('fallback');
        else if (!cancelled) setBiStatus('error');
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  return { biData, biStatus };
};
