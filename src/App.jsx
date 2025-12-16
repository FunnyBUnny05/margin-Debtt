import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';

const formatDate = (date) => {
  if (!date) return '';
  const [year, month] = date.split('-');
  return `${month}/${year.slice(2)}`;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const formatValue = (p) => {
      if (p.name === 'YoY Growth') return `${p.value?.toFixed(1)}%`;
      if (p.dataKey === 'close') return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(p.value ?? 0);
      return `$${p.value?.toFixed(0)}B`;
    };

    return (
      <div style={{ background: '#1a1a2e', border: '1px solid #444', padding: '10px', borderRadius: '4px' }}>
        <p style={{ color: '#fff', margin: 0, fontWeight: 'bold' }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color, margin: '4px 0 0 0' }}>
            {p.name}: {formatValue(p)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const normalizeMonthKey = (dateStr) => {
  const parsed = new Date(dateStr);
  if (!Number.isNaN(parsed)) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
  }

  const parts = dateStr.split(/[-/]/);
  if (parts.length >= 2) {
    const [p1, p2] = parts;
    if (p1.length === 4) return `${p1}-${p2.padStart(2, '0')}`;
    if (p2.length === 4) return `${p2}-${p1.padStart(2, '0')}`;
  }

  return dateStr;
};

const parseFinraMarginCsv = (text) => {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const dateIdx = headers.findIndex((h) => h.includes('date'));
  const debtIdx = headers.findIndex((h) => h.includes('debit'));
  if (dateIdx === -1 || debtIdx === -1) return [];

  const rows = lines
    .slice(1)
    .map((line) => line.split(',').map((cell) => cell.trim()))
    .filter((parts) => parts.length > Math.max(dateIdx, debtIdx));

  const parsed = rows
    .map((parts) => ({
      date: normalizeMonthKey(parts[dateIdx]),
      margin_debt: Number(parts[debtIdx].replace(/,/g, '')),
    }))
    .filter((d) => d.date && !Number.isNaN(d.margin_debt))
    .sort((a, b) => a.date.localeCompare(b.date));

  return parsed.map((entry, idx) => {
    const yearBack = idx >= 12 ? parsed[idx - 12].margin_debt : null;
    const yoy_growth = yearBack ? ((entry.margin_debt / yearBack - 1) * 100) : null;
    return { ...entry, yoy_growth: yoy_growth !== null ? Number(yoy_growth.toFixed(1)) : null };
  });
};

const parseStooqCsv = (text) => {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const rows = lines
    .slice(1)
    .map((line) => line.split(',').map((cell) => cell.trim()))
    .filter((parts) => parts.length >= 5)
    .map((parts) => ({ date: parts[0], close: Number(parts[4]) }))
    .filter((d) => !Number.isNaN(d.close));

  const monthly = new Map();
  rows.forEach((row) => {
    const key = normalizeMonthKey(row.date);
    const existing = monthly.get(key);
    if (!existing || new Date(row.date) > new Date(existing.original)) {
      monthly.set(key, { date: key, close: row.close, original: row.date });
    }
  });

  return Array.from(monthly.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ date, close }) => ({ date, close }));
};

const fetchWithTimeout = (url, timeoutMs = 12000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const promise = fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
  return { promise, controller };
};

export default function App() {
  const [rawData, setRawData] = useState([]);
  const [sp500Data, setSp500Data] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [spMeta, setSpMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [spError, setSpError] = useState(null);
  const [timeRange, setTimeRange] = useState('all');
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 640);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let marginController;
    let spController;

    const load = async () => {
      setLoading(true);
      setError(null);
      setSpError(null);

      try {
        const { promise: marginPromise, controller: marginAbort } = fetchWithTimeout(
          'https://www.finra.org/sites/default/files/Industry_Margin_Statistics.csv',
        );
        marginController = marginAbort;
        const marginRes = await marginPromise;
        if (!marginRes.ok) throw new Error('Unable to load FINRA margin data');
        const marginText = await marginRes.text();
        const parsedMargin = parseFinraMarginCsv(marginText);
        if (!parsedMargin.length) throw new Error('No margin data parsed from FINRA feed');

        if (!cancelled) {
          setRawData(parsedMargin);
          setMetadata({
            lastUpdated: parsedMargin[parsedMargin.length - 1]?.date,
            source: 'FINRA Margin Statistics (live)',
            sourceUrl: 'https://www.finra.org/rules-guidance/key-topics/margin-accounts/margin-statistics',
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Failed to fetch FINRA margin data');
          setLoading(false);
        }
        return;
      }

      try {
        const { promise: spPromise, controller: spAbort } = fetchWithTimeout('https://stooq.pl/q/d/l/?s=spx&i=d');
        spController = spAbort;
        const spRes = await spPromise;
        if (!spRes.ok) throw new Error('Unable to load S&P 500 data');
        const spText = await spRes.text();
        const parsedSp = parseStooqCsv(spText);
        if (!parsedSp.length) throw new Error('No S&P 500 data parsed');

        if (!cancelled) {
          setSp500Data(parsedSp);
          setSpMeta({
            lastUpdated: parsedSp[parsedSp.length - 1]?.date,
            source: 'Stooq (^spx) daily (live)',
            sourceUrl: 'https://stooq.pl/',
          });
        }
      } catch (err) {
        if (!cancelled) {
          setSpError(err?.message || 'Failed to fetch S&P 500 data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
      marginController?.abort();
      spController?.abort();
    };
  }, []);

  if (loading) {
    return (
      <div style={{ background: '#0d0d1a', color: '#e0e0e0', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>Loading live data...</div>
          <div style={{ color: '#888' }}>Fetching FINRA margin stats and S&P 500 prices</div>
        </div>
      </div>
    );
  }

  if (error || !rawData.length) {
    return (
      <div style={{ background: '#0d0d1a', color: '#ef4444', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>Error Loading Data</div>
          <div>{error || 'Unable to load margin data'}</div>
        </div>
      </div>
    );
  }

  const data = rawData.map((d) => ({ ...d, margin_debt_bn: d.margin_debt / 1000 }));
  const filteredMargin = timeRange === 'all'
    ? data
    : timeRange === '10y'
      ? data.slice(-120)
      : timeRange === '5y'
        ? data.slice(-60)
        : data.slice(-24);

  const filteredSp = (() => {
    if (!sp500Data.length) return [];
    if (timeRange === 'all') return sp500Data;
    if (timeRange === '10y') return sp500Data.slice(-120);
    if (timeRange === '5y') return sp500Data.slice(-60);
    return sp500Data.slice(-24);
  })();

  const spInterval = Math.max(1, Math.floor((filteredSp.length || 1) / 8));
  const currentDebt = data[data.length - 1];
  const peak2021 = data.find((d) => d.date === '2021-10') || data[data.length - 1];
  const peak2000 = data.find((d) => d.date === '2000-03') || data[0];

  const formatLastUpdated = (iso) => {
    if (!iso) return 'N/A';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div style={{ background: '#0d0d1a', color: '#e0e0e0', padding: isMobile ? '16px' : '20px', minHeight: '100vh', fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: isMobile ? '720px' : '1200px', width: '100%', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'center' : 'flex-start', marginBottom: '8px', gap: isMobile ? '12px' : '0', flexDirection: isMobile ? 'column' : 'row', textAlign: isMobile ? 'center' : 'left' }}>
          <div style={{ width: '100%' }}>
            <h1 style={{ fontSize: '24px', marginBottom: '8px', color: '#fff' }}>FINRA Margin Debt Tracker</h1>
            <p style={{ color: '#888', marginBottom: '4px' }}>Securities margin account debit balances ($ billions)</p>
          </div>
          {metadata && (
            <div style={{ textAlign: isMobile ? 'center' : 'right', fontSize: '12px', color: '#666', width: '100%' }}>
              <div>Last updated: {formatLastUpdated(metadata.lastUpdated)}</div>
              <a href={metadata.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
                Source: {metadata.source}
              </a>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-start' }}>
          {['2y', '5y', '10y', 'all'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              style={{
                padding: '6px 16px',
                background: timeRange === range ? '#3b82f6' : '#1a1a2e',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {range.toUpperCase()}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px', textAlign: isMobile ? 'center' : 'left' }}>
          <div style={{ background: '#1a1a2e', padding: '16px', borderRadius: '8px' }}>
            <div style={{ color: '#888', fontSize: '12px' }}>Current ({currentDebt.date})</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>${currentDebt.margin_debt_bn.toFixed(0)}B</div>
          </div>
          <div style={{ background: '#1a1a2e', padding: '16px', borderRadius: '8px' }}>
            <div style={{ color: '#888', fontSize: '12px' }}>YoY Growth</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: currentDebt.yoy_growth > 0 ? '#ef4444' : '#22c55e' }}>
              {currentDebt.yoy_growth > 0 ? '+' : ''}{currentDebt.yoy_growth?.toFixed(1) || 'N/A'}%
            </div>
          </div>
          <div style={{ background: '#1a1a2e', padding: '16px', borderRadius: '8px' }}>
            <div style={{ color: '#888', fontSize: '12px' }}>vs 2021 Peak</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>
              {currentDebt.margin_debt >= peak2021.margin_debt ? '+' : ''}{((currentDebt.margin_debt / peak2021.margin_debt - 1) * 100).toFixed(0)}%
            </div>
          </div>
          <div style={{ background: '#1a1a2e', padding: '16px', borderRadius: '8px' }}>
            <div style={{ color: '#888', fontSize: '12px' }}>vs 2000 Peak</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#a855f7' }}>
              +{((currentDebt.margin_debt / peak2000.margin_debt - 1) * 100).toFixed(0)}%
            </div>
          </div>
        </div>

        <div style={{ background: '#1a1a2e', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '16px', marginBottom: '8px', color: '#fff' }}>S&P 500 Index (live)</h2>
          {spMeta && (
            <div style={{ color: '#666', fontSize: '12px', marginBottom: '8px' }}>
              <span>Source: <a href={spMeta.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>{spMeta.source}</a></span>
            </div>
          )}
          {spError && (
            <div style={{ background: '#3b1f1f', color: '#fca5a5', padding: '8px 10px', borderRadius: '6px', marginBottom: '10px', border: '1px solid #7f1d1d' }}>
              Unable to load live S&P 500 data right now ({spError}). The chart will populate automatically once the feed responds again.
            </div>
          )}
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={filteredSp} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="spGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="date"
                stroke="#666"
                tick={{ fill: '#888', fontSize: 11 }}
                tickFormatter={formatDate}
                interval={spInterval}
              />
              <YAxis
                stroke="#666"
                tick={{ fill: '#888', fontSize: 11 }}
                tickFormatter={(v) => `${v}`}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="close"
                stroke="#22d3ee"
                fill="url(#spGradient)"
                name="S&P 500"
              />
              <Line
                type="monotone"
                dataKey="close"
                stroke="#22d3ee"
                strokeWidth={2}
                dot={false}
                name="S&P 500"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: '#1a1a2e', borderRadius: '8px', padding: '20px' }}>
          <h2 style={{ fontSize: '16px', marginBottom: '16px', color: '#fff' }}>Year-over-Year Growth Rate</h2>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={filteredMargin.filter((d) => d.yoy_growth !== null)} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="date"
                stroke="#666"
                tick={{ fill: '#888', fontSize: 11 }}
                tickFormatter={formatDate}
                interval={Math.floor(filteredMargin.length / 8)}
              />
              <YAxis
                stroke="#666"
                tick={{ fill: '#888', fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#666" strokeWidth={2} />
              <ReferenceLine y={30} stroke="#ef4444" strokeDasharray="5 5" strokeOpacity={0.5} />
              <ReferenceLine y={-30} stroke="#22c55e" strokeDasharray="5 5" strokeOpacity={0.5} />
              <Line
                type="monotone"
                dataKey="yoy_growth"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                name="YoY Growth"
              />
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: '24px', marginTop: '12px', fontSize: '12px', color: '#888', flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-start', textAlign: isMobile ? 'center' : 'left' }}>
            <span>🔴 +30% threshold (euphoria zone)</span>
            <span>🟢 -30% threshold (capitulation zone)</span>
          </div>
        </div>

        <div style={{ marginTop: '20px', padding: '16px', background: '#1a1a2e', borderRadius: '8px', fontSize: '13px', color: '#888', textAlign: isMobile ? 'center' : 'left' }}>
          <strong style={{ color: '#f59e0b' }}>Historical pattern:</strong> Sustained 30%+ YoY margin debt growth has preceded every major market correction.
          2000 peak (+80% YoY) → dot-com crash. 2007 peak (+62% YoY) → financial crisis. 2021 peak (+71% YoY) → 2022 bear market. Live margin debt from FINRA; S&P 500 from Stooq, refreshed on each load.
        </div>
      </div>
    </div>
  );
}
