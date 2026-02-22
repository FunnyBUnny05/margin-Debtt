import React, { useMemo, useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';

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

const CORS_PROXIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
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
      background: 'rgba(15,17,27,0.95)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '10px',
      padding: '12px 16px',
      fontSize: '13px',
      color: 'var(--text-primary)',
    }}>
      <div style={{ fontWeight: '600', marginBottom: '6px' }}>{label}</div>
      <div style={{ color: '#fbbf24' }}>
        Cash &amp; T-Bills: <strong>${payload[0].value?.toFixed(1)}B</strong>
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
      background: 'rgba(15,17,27,0.95)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '10px',
      padding: '12px 16px',
      fontSize: '13px',
      color: 'var(--text-primary)',
    }}>
      <div style={{ fontWeight: '600', marginBottom: '6px' }}>{label}</div>
      <div style={{ color: val >= 0 ? '#51cf66' : '#ff6b6b' }}>
        YoY Growth: <strong>{val >= 0 ? '+' : ''}{val}%</strong>
      </div>
    </div>
  );
};

export const BuffettIndicator = ({ isMobile }) => {
  const [timeRange, setTimeRange] = useState('all');
  const [liveData, setLiveData] = useState(null);
  const [fetchStatus, setFetchStatus] = useState('loading'); // 'loading' | 'live' | 'fallback'

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
  const allTimeHigh = Math.max(...ENRICHED.map(d => d.cash));
  const athYear = ENRICHED.find(d => d.cash === allTimeHigh)?.year;
  const avgCash = (ENRICHED.reduce((s, d) => s + d.cash, 0) / ENRICHED.length).toFixed(1);
  const spanYears = `${ENRICHED[0].year}–${latest?.year}`;

  const statCards = [
    {
      label: `${latest?.year} Cash Hoard`,
      value: `$${latest?.cash.toFixed(1)}B`,
      sub: 'Cash + T-Bills',
      color: '#fbbf24',
    },
    {
      label: 'YoY Change',
      value: `${latest?.yoy >= 0 ? '+' : ''}${latest?.yoy}%`,
      sub: `vs $${prev?.cash.toFixed(1)}B in ${prev?.year}`,
      color: latest?.yoy >= 0 ? '#51cf66' : '#ff6b6b',
    },
    {
      label: 'All-Time High',
      value: `$${allTimeHigh.toFixed(1)}B`,
      sub: String(athYear),
      color: '#a78bfa',
    },
    {
      label: `${ENRICHED.length}-Year Average`,
      value: `$${avgCash}B`,
      sub: spanYears,
      color: '#60a5fa',
    },
  ];

  return (
    <div>
      {/* Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '24px',
      }}>
        {statCards.map(({ label, value, sub, color }) => (
          <div key={label} className="stat-card animate-in">
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
              {label}
            </div>
            <div style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: '700', color, lineHeight: 1 }}>
              {value}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '6px' }}>
              {sub}
            </div>
          </div>
        ))}
      </div>

      {/* Time Range Selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        {TIME_RANGE_OPTIONS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setTimeRange(value)}
            className="btn-primary"
            style={{
              padding: '8px 20px',
              background: timeRange === value ? 'var(--gradient-amber, linear-gradient(135deg,#f59e0b,#d97706))' : 'var(--glass-bg)',
              border: timeRange === value ? 'none' : '1px solid var(--glass-border)',
              fontSize: '13px',
              fontWeight: timeRange === value ? '600' : '400',
            }}
          >
            {label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>
          {fetchStatus === 'loading' && '⏳ Fetching latest data…'}
          {fetchStatus === 'live' && '🟢 Live data (Yahoo Finance)'}
          {fetchStatus === 'fallback' && '📋 Cached data'}
        </div>
      </div>

      {/* Charts */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: '20px',
        marginBottom: '24px',
      }}>
        {/* Chart 1: Absolute Cash */}
        <div className="glass-card animate-in" style={{ padding: isMobile ? '20px 16px' : '28px 32px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>
            💰 Cash &amp; T-Bill Holdings
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Annual cash + short-term U.S. Treasury holdings (USD billions)
          </p>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={filtered} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval={isMobile ? 4 : 2}
              />
              <YAxis
                tickFormatter={v => `$${v}B`}
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip content={<CashTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="cash" radius={[3, 3, 0, 0]} name="Cash & T-Bills">
                {filtered.map((entry) => (
                  <Cell
                    key={entry.year}
                    fill={entry.cash >= 200 ? '#f59e0b' : entry.cash >= 100 ? '#fbbf24' : entry.cash >= 50 ? '#fcd34d' : '#fde68a'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2: YoY Growth */}
        <div className="glass-card animate-in" style={{ padding: isMobile ? '20px 16px' : '28px 32px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>
            📈 Year-over-Year Growth
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Annual change in cash holdings (%)
          </p>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={filtered.filter(d => d.yoy !== null)}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              barCategoryGap="25%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval={isMobile ? 4 : 2}
              />
              <YAxis
                tickFormatter={v => `${v}%`}
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip content={<YoyTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
              <Bar dataKey="yoy" radius={[3, 3, 0, 0]} name="YoY Growth">
                {filtered.filter(d => d.yoy !== null).map((entry) => (
                  <Cell
                    key={entry.year}
                    fill={entry.yoy >= 0 ? '#51cf66' : '#ff6b6b'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Note */}
      <div className="glass-card animate-in" style={{ padding: '16px 24px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.7' }}>
        <strong style={{ color: 'var(--text-tertiary)' }}>Data notes:</strong> Cash holdings represent Berkshire Hathaway's combined cash &amp; cash equivalents plus short-term U.S. Treasury bill investments as reported in annual filings.
        1995–1999 figures reflect cash &amp; equivalents only (T-bill holdings were minimal and not separately disclosed).
        The 1998 spike ($13.6B) reflects the General Re acquisition in December 1998.
        Recent years auto-fetched from Yahoo Finance (BRK-B balance sheet); falls back to last known figures if unavailable.
        Sources: Berkshire Hathaway annual reports, Yahoo Finance.
      </div>
    </div>
  );
};
