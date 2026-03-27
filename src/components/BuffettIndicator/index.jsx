import React, { useMemo, useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
  ComposedChart, Line, Area,
} from 'recharts';
import { CORS_PROXIES } from '../SectorZScore/utils/corsProxies';
import { useFredBuffettData } from './useFredBuffettData';

// Historical baseline: 1995–2020 (hardcoded from official Berkshire annual reports)
// 1995–1999: cash & cash equivalents (T-bill tracking not separately disclosed pre-2000)
// 2000–2020: cash + short-term U.S. Treasury bill investments
const HISTORICAL_DATA = [
  { year: 1995, cash: 2.7 },
  { year: 1996, cash: 1.3 },
  { year: 1997, cash: 1.1 },
  { year: 1998, cash: 13.6 }, // Spike from Gen Re acquisition (Dec 1998)
  { year: 1999, cash: 3.8 },
  { year: 2000, cash: 3.4 },
  { year: 2001, cash: 4.5 },
  { year: 2002, cash: 10.3 },
  { year: 2003, cash: 24.4 },
  { year: 2004, cash: 43.0 },
  { year: 2005, cash: 44.7 },
  { year: 2006, cash: 43.7 },
  { year: 2007, cash: 44.3 },
  { year: 2008, cash: 25.5 },
  { year: 2009, cash: 66.3 },
  { year: 2010, cash: 38.2 },
  { year: 2011, cash: 68.5 },
  { year: 2012, cash: 83.7 },
  { year: 2013, cash: 77.0 },
  { year: 2014, cash: 90.7 },
  { year: 2015, cash: 97.7 },
  { year: 2016, cash: 86.4 },
  { year: 2017, cash: 116.0 },
  { year: 2018, cash: 111.9 },
  { year: 2019, cash: 128.0 },
  { year: 2020, cash: 138.3 },
];

// Fallback for recent years if Yahoo Finance fetch fails
const RECENT_DATA_FALLBACK = [
  { year: 2021, cash: 146.7 },
  { year: 2022, cash: 128.6 },
  { year: 2023, cash: 167.6 },
  { year: 2024, cash: 334.2 },
];

const YF_URL = 'https://query1.finance.yahoo.com/v10/finance/quoteSummary/BRK-B?modules=balanceSheetHistory';

const fetchBerkshireBalanceSheet = async () => {
  for (const proxyFn of CORS_PROXIES) {
    try {
      const res = await fetch(proxyFn(YF_URL), { signal: AbortSignal.timeout(12000) });
      if (!res.ok) continue;
      const json = await res.json();
      const statements = json?.quoteSummary?.result?.[0]?.balanceSheetHistory?.balanceSheetStatements;
      if (!statements?.length) continue;

      const parsed = statements
        .map(s => {
          const endDateStr = s.endDate?.fmt;
          const cashRaw = s.cashAndShortTermInvestments?.raw ?? s.cash?.raw;
          if (!endDateStr || cashRaw == null) return null;
          const year = parseInt(endDateStr.slice(0, 4), 10);
          const cash = parseFloat((cashRaw / 1e9).toFixed(1));
          return { year, cash };
        })
        .filter(Boolean)
        .sort((a, b) => a.year - b.year);

      if (parsed.length > 0) return parsed;
    } catch {
      // try next proxy
    }
  }
  return null;
};

const enrichWithYoY = (data) =>
  data.map((d, i) => {
    if (i === 0) return { ...d, yoy: null };
    const prev = data[i - 1].cash;
    return { ...d, yoy: parseFloat((((d.cash - prev) / prev) * 100).toFixed(1)) };
  });

const TIME_RANGE_OPTIONS = [
  { label: '10Y', value: '10y' },
  { label: '15Y', value: '15y' },
  { label: '20Y', value: '20y' },
  { label: '25Y', value: '25y' },
  { label: 'ALL', value: 'all' },
];

const CashTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#0B0F19',
      border: '1px solid #1F2937',
      borderRadius: '0',
      padding: '8px 12px',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '11px',
      color: '#D1D5DB',
    }}>
      <div style={{ fontWeight: '700', color: '#F59E0B', marginBottom: '4px' }}>{label}</div>
      <div style={{ color: '#FCD34D' }}>
        CASH &amp; T-BILLS: <strong>${payload[0].value?.toFixed(1)}B</strong>
      </div>
    </div>
  );
};

const YoyTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  if (val === null || val === undefined) return null;
  return (
    <div style={{
      background: '#0B0F19',
      border: '1px solid #1F2937',
      borderRadius: '0',
      padding: '8px 12px',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '11px',
      color: '#D1D5DB',
    }}>
      <div style={{ fontWeight: '700', color: '#F59E0B', marginBottom: '4px' }}>{label}</div>
      <div style={{ color: val >= 0 ? '#10B981' : '#EF4444' }}>
        YOY GROWTH: <strong>{val >= 0 ? '+' : ''}{val}%</strong>
      </div>
    </div>
  );
};

// Tooltip for Buffett Indicator chart
const BuffettTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const ratio = payload.find(p => p.dataKey === 'ratio_pct');
  const trend = payload.find(p => p.dataKey === 'trend_pct');
  const p2 = payload.find(p => p.dataKey === 'band_plus2');
  const m2 = payload.find(p => p.dataKey === 'band_minus2');
  return (
    <div style={{
      background: '#0B0F19', border: '1px solid #1F2937',
      padding: '8px 12px', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px',
    }}>
      <div style={{ color: '#F59E0B', fontWeight: '700', marginBottom: '4px' }}>
        {label ? new Date(label).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : ''}
      </div>
      {ratio && <div style={{ color: '#F59E0B' }}>RATIO: <strong>{ratio.value?.toFixed(1)}%</strong></div>}
      {trend && <div style={{ color: '#6B7280' }}>TREND: {trend.value?.toFixed(1)}%</div>}
      {p2 && m2 && <div style={{ color: '#4B5563' }}>BAND: {m2.value?.toFixed(0)}% — {p2.value?.toFixed(0)}%</div>}
    </div>
  );
};

export const BuffettIndicator = ({ isMobile }) => {
  const [timeRange, setTimeRange] = useState('all');
  const [liveData, setLiveData] = useState(null);
  const [fetchStatus, setFetchStatus] = useState('loading'); // 'loading' | 'live' | 'fallback'

  // Buffett Indicator (Market Cap / GDP) — live from FRED, fallback to JSON
  const { biData, biStatus: rawBiStatus } = useFredBuffettData();
  // Normalise status: hook returns 'live'|'fallback'|'error'|'loading'
  // The rest of the component expects 'loaded' | 'loading' | 'error'
  const biStatus = rawBiStatus === 'live' || rawBiStatus === 'fallback' ? 'loaded' : rawBiStatus;

  useEffect(() => {
    let cancelled = false;
    fetchBerkshireBalanceSheet().then(result => {
      if (cancelled) return;
      if (result) {
        setLiveData(result);
        setFetchStatus('live');
      } else {
        setFetchStatus('fallback');
      }
    });
    return () => { cancelled = true; };
  }, []);

  const ENRICHED = useMemo(() => {
    // Merge historical baseline with recent live/fallback data
    const recentRows = liveData ?? RECENT_DATA_FALLBACK;
    const cutoffYear = HISTORICAL_DATA[HISTORICAL_DATA.length - 1].year;
    const newRows = recentRows.filter(d => d.year > cutoffYear);
    return enrichWithYoY([...HISTORICAL_DATA, ...newRows]);
  }, [liveData]);

  const filtered = useMemo(() => {
    const latestYear = ENRICHED[ENRICHED.length - 1]?.year ?? new Date().getFullYear();
    const cutoffs = { '10y': 10, '15y': 15, '20y': 20, '25y': 25 };
    if (timeRange === 'all') return ENRICHED;
    return ENRICHED.filter(d => d.year >= latestYear - cutoffs[timeRange]);
  }, [timeRange, ENRICHED]);

  const latest = ENRICHED[ENRICHED.length - 1];
  const prev = ENRICHED[ENRICHED.length - 2];

  // Memoize derived stats so they don't recompute every render
  const { allTimeHigh, athYear, avgCash, spanYears } = useMemo(() => {
    let high = -Infinity;
    let highYear = null;
    let sum = 0;
    for (const d of ENRICHED) {
      sum += d.cash;
      if (d.cash > high) { high = d.cash; highYear = d.year; }
    }
    return {
      allTimeHigh: high,
      athYear: highYear,
      avgCash: (sum / ENRICHED.length).toFixed(1),
      spanYears: `${ENRICHED[0].year}–${ENRICHED[ENRICHED.length - 1]?.year}`,
    };
  }, [ENRICHED]);

  const statCards = [
    {
      label: `${latest?.year} CASH HOARD`,
      value: `$${latest?.cash.toFixed(1)}B`,
      sub: 'CASH + T-BILLS',
      color: '#F59E0B',
      border: '#F59E0B',
    },
    {
      label: 'YOY CHANGE',
      value: `${latest?.yoy >= 0 ? '+' : ''}${latest?.yoy}%`,
      sub: `VS $${prev?.cash.toFixed(1)}B IN ${prev?.year}`,
      color: latest?.yoy >= 0 ? '#10B981' : '#EF4444',
      border: latest?.yoy >= 0 ? '#10B981' : '#EF4444',
    },
    {
      label: 'ALL-TIME HIGH',
      value: `$${allTimeHigh.toFixed(1)}B`,
      sub: String(athYear),
      color: '#FCD34D',
      border: '#FCD34D',
    },
    {
      label: `${ENRICHED.length}-YEAR AVG`,
      value: `$${avgCash}B`,
      sub: spanYears,
      color: '#38BDF8',
      border: '#38BDF8',
    },
  ];

  // Buffett Indicator chart data — optionally filter to last N years
  const biChartData = useMemo(() => {
    if (!biData?.data?.length) return [];
    if (timeRange === 'all') return biData.data;
    const cutoffs = { '10y': 10, '15y': 15, '20y': 20, '25y': 25 };
    const years = cutoffs[timeRange] ?? 99;
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - years);
    return biData.data.filter(d => new Date(d.date) >= cutoffDate);
  }, [biData, timeRange]);

  const biCurrent = biData?.current;
  const valuationColor = biCurrent
    ? biCurrent.std_devs > 2 ? '#FF2222'
    : biCurrent.std_devs > 1 ? '#F59E0B'
    : biCurrent.std_devs > -1 ? '#FCD34D'
    : '#00CC00'
    : '#888888';

  return (
    <div>
      {/* ── BUFFETT INDICATOR (Market Cap / GDP) ── */}
      <div className="glass-card" style={{ padding: '0', marginBottom: '1px' }}>
        <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>
            BUFFETT INDICATOR —{' '}
            {rawBiStatus === 'live' ? 'WILSHIRE IDX / GDP' : 'MARKET CAP / GDP'}
          </span>
          {rawBiStatus === 'live' && (
            <span style={{ fontSize: '9px', color: '#10B981', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.5px' }}>● LIVE / FRED</span>
          )}
          {rawBiStatus === 'fallback' && (
            <span style={{ fontSize: '9px', color: '#F59E0B', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.5px' }}>● STATIC / CACHED</span>
          )}
        </div>
        <div style={{ padding: isMobile ? '12px' : '14px' }}>

          {biStatus === 'error' && (
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#6B7280', padding: '24px 0', textAlign: 'center' }}>
              DATA UNAVAILABLE — FRED AND LOCAL FALLBACK BOTH FAILED
            </div>
          )}

          {biStatus === 'loading' && (
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#4B5563', padding: '24px 0', textAlign: 'center' }}>
              LOADING...
            </div>
          )}

          {biStatus === 'loaded' && biCurrent && (
            <>
              {/* BI Stat Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
                gap: '1px',
                marginBottom: '1px',
                background: '#111827',
              }}>
                <div className="stat-card" style={{ borderLeft: '3px solid #F59E0B', padding: '12px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: '#FCD34D', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
                    CURRENT RATIO
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: isMobile ? '20px' : '24px', fontWeight: '700', color: '#F59E0B', lineHeight: 1 }}>
                    {biCurrent.ratio_pct.toFixed(1)}%
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#6B7280', marginTop: '4px' }}>
                    {rawBiStatus === 'live' ? 'WILSHIRE IDX / GDP' : 'MKT CAP / GDP'}
                  </div>
                </div>
                <div className="stat-card" style={{ borderLeft: `3px solid ${valuationColor}`, padding: '12px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: '#FCD34D', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
                    VS TREND
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: isMobile ? '20px' : '24px', fontWeight: '700', color: valuationColor, lineHeight: 1 }}>
                    {biCurrent.deviation_pct >= 0 ? '+' : ''}{biCurrent.deviation_pct.toFixed(1)}%
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#6B7280', marginTop: '4px' }}>
                    TREND: {biCurrent.trend_pct.toFixed(1)}%
                  </div>
                </div>
                <div className="stat-card" style={{ borderLeft: `3px solid ${valuationColor}`, padding: '12px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: '#FCD34D', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
                    STD DEVS
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: isMobile ? '20px' : '24px', fontWeight: '700', color: valuationColor, lineHeight: 1 }}>
                    {biCurrent.std_devs >= 0 ? '+' : ''}{biCurrent.std_devs.toFixed(2)}σ
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#6B7280', marginTop: '4px' }}>
                    FROM LOG TREND
                  </div>
                </div>
                <div className="stat-card" style={{ borderLeft: `3px solid ${valuationColor}`, padding: '12px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: '#FCD34D', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
                    VALUATION
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: isMobile ? '13px' : '15px', fontWeight: '700', color: valuationColor, lineHeight: 1.2 }}>
                    {biCurrent.valuation}
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#6B7280', marginTop: '4px' }}>
                    {biCurrent.gdp_billions > 0 ? `GDP $${biCurrent.gdp_billions.toLocaleString()}B` : 'WILSHIRE IDX / GDP'}
                  </div>
                </div>
              </div>

              {/* BI Chart */}
              <div style={{ marginTop: '12px' }}>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '20px', height: '2px', background: '#F59E0B', display: 'inline-block' }} /> RATIO
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '20px', height: '1px', background: '#6B7280', display: 'inline-block', borderTop: '1px dashed #6B7280' }} /> TREND
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#FF2222', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '20px', height: '1px', background: '#FF2222', display: 'inline-block', borderTop: '1px dashed #FF2222' }} /> +2σ
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#00CC00', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '20px', height: '1px', background: '#00CC00', display: 'inline-block', borderTop: '1px dashed #00CC00' }} /> -2σ
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
                  <ComposedChart data={biChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="1 4" stroke="#111827" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={d => new Date(d).getFullYear()}
                      interval={isMobile ? 'preserveStartEnd' : Math.floor(biChartData.length / 8)}
                    />
                    <YAxis
                      tickFormatter={v => `${v.toFixed(0)}%`}
                      tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                      axisLine={false}
                      tickLine={false}
                      width={52}
                    />
                    <Tooltip content={<BuffettTooltip />} cursor={{ stroke: '#1F2937', strokeWidth: 1 }} />
                    {/* +2σ band fill (outer) */}
                    <Area dataKey="band_plus2" stroke="none" fill="#1A0500" fillOpacity={1} dot={false} legendType="none" />
                    {/* -2σ band fill (resets to zero — use with stackId trick not needed; just layer) */}
                    <Area dataKey="band_minus2" stroke="none" fill="#0B0F19" fillOpacity={1} dot={false} legendType="none" />
                    {/* +1σ band */}
                    <Line dataKey="band_plus1" stroke="#FF4400" strokeWidth={1} strokeDasharray="3 3" dot={false} legendType="none" />
                    {/* +2σ band */}
                    <Line dataKey="band_plus2" stroke="#FF2222" strokeWidth={1} strokeDasharray="3 3" dot={false} legendType="none" />
                    {/* -1σ band */}
                    <Line dataKey="band_minus1" stroke="#009900" strokeWidth={1} strokeDasharray="3 3" dot={false} legendType="none" />
                    {/* -2σ band */}
                    <Line dataKey="band_minus2" stroke="#00CC00" strokeWidth={1} strokeDasharray="3 3" dot={false} legendType="none" />
                    {/* Trend */}
                    <Line dataKey="trend_pct" stroke="#4B5563" strokeWidth={1} strokeDasharray="6 3" dot={false} legendType="none" />
                    {/* Actual ratio — drawn last so it sits on top */}
                    <Line dataKey="ratio_pct" stroke="#F59E0B" strokeWidth={2} dot={false} legendType="none" />
                    <ReferenceLine y={100} stroke="#374151" strokeWidth={1} strokeDasharray="2 4" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* BI Note */}
              <div style={{ marginTop: '10px', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#4B5563', lineHeight: '1.7', borderTop: '1px solid #111827', paddingTop: '8px' }}>
                <span style={{ color: '#6B7280', fontWeight: '700' }}>FORMULA:</span> Total US Market Cap (Wilshire 5000 Full Cap) ÷ Nominal GDP × 100.
                Bands show ±1σ and ±2σ from a log-linear trend fit over the full history.
                {' '}<span style={{ color: '#4B5563' }}>SOURCES: FRED WILL5000INDFC, GDP — updated weekly.</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── BERKSHIRE CASH HOARD ── */}
      <div className="bb-panel-header" style={{ marginTop: '1px' }}>BERKSHIRE HATHAWAY — CASH &amp; T-BILL HOLDINGS</div>

      {/* Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
        gap: '1px',
        marginBottom: '1px',
        marginTop: '1px',
        background: '#111827',
      }}>
        {statCards.map(({ label, value, sub, color, border }) => (
          <div key={label} className="stat-card" style={{ borderLeft: `3px solid ${border}`, padding: '12px 16px' }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: '#FCD34D', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
              {label}
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: isMobile ? '20px' : '24px', fontWeight: '700', color, lineHeight: 1 }}>
              {value}
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#6B7280', marginTop: '4px' }}>
              {sub}
            </div>
          </div>
        ))}
      </div>

      {/* Time Range Selector */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '0', flexWrap: 'wrap', alignItems: 'stretch', borderBottom: '1px solid #1F2937', background: '#0B0F19' }}>
        {TIME_RANGE_OPTIONS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setTimeRange(value)}
            style={{
              padding: '7px 16px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '11px',
              fontWeight: '700',
              background: timeRange === value ? '#78350F' : 'transparent',
              color: timeRange === value ? '#F59E0B' : '#6B7280',
              border: 'none',
              borderRight: '1px solid #111827',
              borderBottom: timeRange === value ? '2px solid #F59E0B' : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', padding: '7px 12px', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#4B5563', display: 'flex', alignItems: 'center' }}>
          {fetchStatus === 'loading' && 'FETCHING LIVE DATA...'}
          {fetchStatus === 'live' && 'LIVE: YAHOO FINANCE'}
          {fetchStatus === 'fallback' && 'CACHED DATA'}
        </div>
      </div>

      {/* Charts */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: '1px',
        marginBottom: '1px',
        marginTop: '1px',
        background: '#111827',
      }}>
        {/* Chart 1: Absolute Cash */}
        <div className="glass-card" style={{ padding: '0' }}>
          <div className="bb-panel-header">CASH &amp; T-BILL HOLDINGS</div>
          <div style={{ padding: isMobile ? '12px' : '14px' }}>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#6B7280', marginBottom: '12px' }}>
            Annual cash + short-term U.S. Treasury holdings (USD billions)
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={filtered} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="1 4" stroke="#111827" vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                axisLine={false}
                tickLine={false}
                interval={isMobile ? 4 : 2}
              />
              <YAxis
                tickFormatter={v => `$${v}B`}
                tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip content={<CashTooltip />} cursor={{ fill: 'rgba(255,102,0,0.06)' }} />
              <Bar dataKey="cash" radius={[0, 0, 0, 0]} name="Cash & T-Bills">
                {filtered.map((entry) => (
                  <Cell
                    key={entry.year}
                    fill={entry.cash >= 200 ? '#F59E0B' : entry.cash >= 100 ? '#D97706' : entry.cash >= 50 ? '#8A3800' : '#4A2000'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: YoY Growth */}
        <div className="glass-card" style={{ padding: '0' }}>
          <div className="bb-panel-header">YEAR-OVER-YEAR GROWTH</div>
          <div style={{ padding: isMobile ? '12px' : '14px' }}>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#6B7280', marginBottom: '12px' }}>
            Annual change in cash holdings (%)
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={filtered.filter(d => d.yoy !== null)}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              barCategoryGap="25%"
            >
              <CartesianGrid strokeDasharray="1 4" stroke="#111827" vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                axisLine={false}
                tickLine={false}
                interval={isMobile ? 4 : 2}
              />
              <YAxis
                tickFormatter={v => `${v}%`}
                tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip content={<YoyTooltip />} cursor={{ fill: 'rgba(255,102,0,0.06)' }} />
              <ReferenceLine y={0} stroke="#374151" strokeWidth={1} />
              <Bar dataKey="yoy" radius={[0, 0, 0, 0]} name="YoY Growth">
                {filtered.filter(d => d.yoy !== null).map((entry) => (
                  <Cell
                    key={entry.year}
                    fill={entry.yoy >= 0 ? '#10B981' : '#EF4444'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Note */}
      <div className="glass-card" style={{ padding: '10px 14px', borderLeft: '3px solid #1F2937', marginTop: '1px' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#4B5563', lineHeight: '1.7' }}>
          <span style={{ color: '#6B7280', fontWeight: '700' }}>DATA NOTES:</span> Cash holdings represent Berkshire Hathaway's combined cash &amp; cash equivalents plus short-term U.S. Treasury bill investments as reported in annual filings.
          1995–1999 figures reflect cash &amp; equivalents only. The 1998 spike ($13.6B) reflects the General Re acquisition.
          Recent years auto-fetched from Yahoo Finance (BRK-B); falls back to last known figures if unavailable.
          Sources: Berkshire Hathaway annual reports, Yahoo Finance.
        </div>
      </div>
    </div>
  );
};
