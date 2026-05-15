import React, { useState, useEffect } from 'react';
import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Area, ComposedChart, Bar, Cell
} from 'recharts';
import { SectorZScore } from './components/SectorZScore';
import { BuffettIndicator } from './components/BuffettIndicator';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CORS_PROXIES } from './components/SectorZScore/utils/corsProxies';
import { SofrRate } from './components/SofrRate';
import { PpiIndex } from './components/PpiIndex';
import { ExportCsvButton } from './components/ExportCsvButton';
import { ChartToggle } from './components/ChartToggle';
import { formatDate } from './utils/formatDate';

const FINRA_CSV_URL = 'https://www.finra.org/sites/default/files/2021-03/margin-statistics.csv';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const formatValue = (p) => {
    if (p.name === 'YoY Growth') return `${p.value?.toFixed(1)}%`;
    if (p.dataKey === 'margin_debt_bn') return `$${p.value?.toFixed(0)}B`;
    return p.value;
  };
  return (
    <div className="custom-tooltip glass-card" style={{ padding: '12px 16px' }}>
      <p style={{ color: 'var(--bb-white)', margin: 0, fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: '4px 0 0 0', fontSize: '13px', fontWeight: '500' }}>
          {p.name}: {formatValue(p)}
        </p>
      ))}
    </div>
  );
};

const AaiiTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip glass-card" style={{ padding: '12px 16px' }}>
      <p style={{ color: 'var(--bb-white)', margin: 0, fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: '4px 0 0 0', fontSize: '13px', fontWeight: '500' }}>
          {p.name}: {typeof p.value === 'number' ? `${p.value > 0 ? '+' : ''}${p.value.toFixed(1)}%` : p.value}
        </p>
      ))}
    </div>
  );
};

const normalizeMonthKey = (dateStr) => {
  const parsed = new Date(dateStr);
  if (!isNaN(parsed)) {
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
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const dateIdx = headers.findIndex(h => h.includes('date'));
  const debtIdx = headers.findIndex(h => h.includes('debit'));
  if (dateIdx === -1 || debtIdx === -1) return [];
  const rows = lines.slice(1)
    .map(line => line.split(',').map(cell => cell.trim()))
    .filter(parts => parts.length > Math.max(dateIdx, debtIdx));
  const parsed = rows.map(parts => ({
    date: normalizeMonthKey(parts[dateIdx]),
    margin_debt: Number(parts[debtIdx].replace(/,/g, ''))
  }))
    .filter(d => d.date && !Number.isNaN(d.margin_debt))
    .sort((a, b) => a.date.localeCompare(b.date));
  return parsed.map((entry, idx) => {
    const yearBack = idx >= 12 ? parsed[idx - 12].margin_debt : null;
    const yoy_growth = yearBack ? ((entry.margin_debt / yearBack - 1) * 100) : null;
    return { ...entry, yoy_growth: yoy_growth !== null ? Number(yoy_growth.toFixed(1)) : null };
  });
};

const TABS = [
  { key: 'margin',  label: 'FINRA MARGIN DEBT',  short: 'MARGIN'  },
  { key: 'aaii',    label: 'AAII ALLOCATION',     short: 'AAII'    },
  { key: 'sectors', label: 'SECTOR Z-SCORE',      short: 'SECTORS' },
  { key: 'buffett', label: 'BUFFETT INDICATOR',   short: 'BUFFETT' },
  { key: 'sofr',    label: 'SOFR RATE',           short: 'SOFR'    },
  { key: 'ppi',     label: 'PPI INDEX',           short: 'PPI'     },
];

const TAB_SUBTITLE = {
  margin:  'Securities margin account debit balances (USD billions)',
  aaii:    'Individual investor asset allocation trends (%)',
  sectors: 'Relative sector performance analysis vs benchmark',
  buffett: 'Berkshire Hathaway annual cash & T-bill holdings',
  sofr:    'Daily overnight repo rate collateralized by U.S. Treasury securities — NY Fed',
  ppi:     'Monthly price changes received by domestic producers — BLS',
};

export default function App() {
  const [rawData, setRawData] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [aaiiRawData, setAaiiRawData] = useState([]);
  const [aaiiMetadata, setAaiiMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('all');
  const [activeTab, setActiveTab] = useState('margin');
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 640);

  const [marginMainType, setMarginMainType] = useState('line');
  const [marginYoyType, setMarginYoyType] = useState('line');
  const [aaiiAllocType, setAaiiAllocType] = useState('line');
  const [aaiiSpreadType, setAaiiSpreadType] = useState('bar');

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setLoading(true);
      setError(null);

      const loadMarginData = async () => {
        const urlsToTry = [FINRA_CSV_URL, ...CORS_PROXIES.map(fn => fn(FINRA_CSV_URL))];
        for (const url of urlsToTry) {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 10000);
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timer);
            if (!res.ok) continue;
            const text = await res.text();
            const parsed = parseFinraMarginCsv(text);
            if (parsed.length > 10) {
              if (!cancelled) {
                setRawData(parsed);
                setMetadata({
                  lastUpdated: new Date().toISOString(),
                  source: 'FINRA Margin Statistics (Live)',
                  sourceUrl: 'https://www.finra.org/investors/learn-to-invest/advanced-investing/margin-statistics',
                });
              }
              return;
            }
          } catch { /* try next */ }
        }
        const res = await fetch('./margin_data.json');
        if (!res.ok) throw new Error('Failed to load margin data');
        const json = await res.json();
        if (!json.data?.length) throw new Error('No margin data in local file');
        if (!cancelled) {
          setRawData(json.data);
          setMetadata({ lastUpdated: json.last_updated, source: json.source, sourceUrl: json.source_url });
        }
      };

      const loadAaiiData = async () => {
        const res = await fetch('./aaii_allocation_data.json');
        if (!res.ok) throw new Error('Failed to load AAII allocation data');
        const json = await res.json();
        if (!json.data?.length) throw new Error('No AAII data in local file');
        if (!cancelled) {
          setAaiiRawData(json.data);
          setAaiiMetadata({ lastUpdated: json.last_updated, source: json.source, sourceUrl: json.source_url });
        }
      };

      try {
        await Promise.all([loadMarginData(), loadAaiiData().catch(() => {})]);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Unable to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, []);

  // ── Margin debt helpers ────────────────────────────────────
  const data = rawData.map(d => ({ ...d, margin_debt_bn: d.margin_debt / 1000 }));
  const filteredData = timeRange === 'all' ? data
    : timeRange === '10y' ? data.slice(-120)
    : timeRange === '5y'  ? data.slice(-60)
    : data.slice(-24);
  const chartInterval = Math.floor((filteredData.length || 1) / 8);
  const currentDebt = data[data.length - 1];
  const peak2021 = data.find(d => d.date === '2021-10') || data[data.length - 1];
  const peak2000 = data.find(d => d.date === '2000-03') || data[0];

  const formatLastUpdated = (iso) => {
    if (!iso) return 'N/A';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDuration = (months) => {
    if (months === 0) return 'N/A';
    const whole = Math.floor(months);
    const days  = Math.round((months - whole) * 30);
    if (whole === 0) return `${days}d`;
    if (days === 0) return `${whole}mo`;
    return `${whole}mo ${days}d`;
  };

  const calculateThresholdStats = (d) => {
    const above = [], below = [];
    let curAbove = null, curBelow = null;
    d.forEach((pt, idx) => {
      if (pt.yoy_growth == null || !isFinite(pt.yoy_growth)) return;
      if (pt.yoy_growth >= 30) {
        curAbove = curAbove ? { ...curAbove, count: curAbove.count + 1 } : { start: idx, count: 1 };
      } else {
        if (curAbove) { above.push(curAbove.count); curAbove = null; }
      }
      if (pt.yoy_growth <= -30) {
        curBelow = curBelow ? { ...curBelow, count: curBelow.count + 1 } : { start: idx, count: 1 };
      } else {
        if (curBelow) { below.push(curBelow.count); curBelow = null; }
      }
    });
    const latest = d[d.length - 1];
    let status = 'neutral', duration = 0;
    if (latest?.yoy_growth >= 30 && curAbove) { status = 'above30'; duration = curAbove.count; }
    else if (latest?.yoy_growth <= -30 && curBelow) { status = 'belowNeg30'; duration = curBelow.count; }
    const completedAbove = status === 'above30' ? above : [...above, ...(curAbove ? [curAbove.count] : [])];
    const completedBelow = status === 'belowNeg30' ? below : [...below, ...(curBelow ? [curBelow.count] : [])];
    return {
      above30:     { avgMonths: completedAbove.length ? completedAbove.reduce((a, b) => a + b, 0) / completedAbove.length : 0, occurrences: completedAbove.length, periods: completedAbove },
      belowNeg30:  { avgMonths: completedBelow.length ? completedBelow.reduce((a, b) => a + b, 0) / completedBelow.length : 0, occurrences: completedBelow.length, periods: completedBelow },
      current:     { status, duration, yoyGrowth: latest?.yoy_growth },
    };
  };

  const thresholdStats = data.length ? calculateThresholdStats(data) : null;

  // ── Loading / Error states ─────────────────────────────────
  if (loading) {
    return (
      <div className="app-background" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="glass-card" style={{ textAlign: 'center', padding: '32px 40px', maxWidth: '500px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--bb-orange)', marginBottom: '16px', letterSpacing: '2px' }} className="pulse-animation">
            LOADING...
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '16px', fontWeight: '700', color: 'var(--bb-white)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Loading Market Data
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--bb-gray-2)', fontSize: '12px' }}>
            Loading FINRA margin statistics...
          </div>
          <div style={{ height: '2px', background: 'var(--bb-border)', marginTop: '20px', overflow: 'hidden' }}>
            <div className="pulse-animation" style={{ height: '100%', width: '60%', background: 'var(--bb-orange)' }} />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-background" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="glass-card" style={{ textAlign: 'center', padding: '32px 40px', maxWidth: '500px', borderLeft: '3px solid var(--bb-red)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--bb-red)', marginBottom: '16px', letterSpacing: '2px', fontWeight: '700' }}>ERROR</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '16px', fontWeight: '700', color: 'var(--bb-white)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Couldn't Load Data
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--bb-gray-2)', fontSize: '12px' }}>{error}</div>
          <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--bb-gray-3)', fontSize: '11px', marginTop: '12px' }}>
            Please refresh the page or try again later
          </div>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="app-background" style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

        {/* ── Bloomberg Topbar ── */}
        <div style={{ background: '#F59E0B', padding: '0', display: 'flex', alignItems: 'stretch' }}>
          <div className="bb-topbar-brand" style={{ padding: '8px 16px', borderRight: '1px solid #D97706', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--font-ui)', fontWeight: '900', fontSize: '16px', color: '#000', letterSpacing: '1px' }}>BLOOMBERG</span>
            <span style={{ fontFamily: 'var(--font-ui)', fontWeight: '400', fontSize: '16px', color: '#000', marginLeft: '6px', opacity: 0.7 }}>FINANCIAL</span>
          </div>
          <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#000', opacity: 0.8, letterSpacing: '0.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {TABS.find(t => t.key === activeTab)?.label || 'MARKET DATA'}
            </span>
          </div>
          {(activeTab === 'margin' && metadata) || (activeTab === 'aaii' && aaiiMetadata) ? (
            <div className="bb-topbar-date" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', borderLeft: '1px solid #D97706', flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#000', opacity: 0.8 }}>
                UPD: {formatLastUpdated(activeTab === 'margin' ? metadata?.lastUpdated : aaiiMetadata?.lastUpdated)}
              </span>
            </div>
          ) : null}
        </div>

        {/* ── Subtitle bar ── */}
        <div style={{ background: '#111827', borderBottom: '1px solid #1F2937', padding: '6px 16px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#6B7280' }}>
            {TAB_SUBTITLE[activeTab]}
          </span>
        </div>

        {/* ── Tab Navigation ── */}
        <div className="mobile-scroll" style={{ display: 'flex', gap: '0', borderBottom: '1px solid #1F2937', background: '#0B0F19', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {TABS.map(({ key, label, short }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                padding: '10px 18px',
                fontFamily: 'var(--font-ui)',
                fontWeight: '700',
                fontSize: '11px',
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
                border: 'none',
                borderRight: '1px solid #1F2937',
                borderBottom: activeTab === key ? '2px solid #F59E0B' : '2px solid transparent',
                cursor: 'pointer',
                background: activeTab === key ? '#111827' : 'transparent',
                color: activeTab === key ? '#F59E0B' : '#6B7280',
                transition: 'all 0.1s ease',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {isMobile ? short : label}
            </button>
          ))}
        </div>

        {/* ── Time Range (Margin / AAII only) ── */}
        {(activeTab === 'margin' || activeTab === 'aaii') && (
          <div className="mobile-scroll" style={{ display: 'flex', borderBottom: '1px solid #1F2937', background: '#0B0F19', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {['2y', '5y', '10y', 'all'].map(range => (
              <button
                key={range}
                className={`period-btn ${timeRange === range ? 'active' : ''}`}
                onClick={() => setTimeRange(range)}
                style={{ minHeight: isMobile ? '44px' : 'auto' }}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {/* ── Margin Debt ── */}
        {activeTab === 'margin' && data.length > 0 && currentDebt && (
          <>
            <div className="responsive-grid" style={{ marginTop: '1px' }}>
              <div className="stat-card" style={{ borderLeft: '3px solid #F59E0B' }}>
                <div style={{ fontFamily: 'var(--font-ui)', color: '#FCD34D', fontSize: '10px', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  CURRENT ({currentDebt.date})
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '24px' : '28px', fontWeight: '700', color: '#F59E0B' }}>
                  ${currentDebt.margin_debt_bn.toFixed(0)}B
                </div>
              </div>
              <div className="stat-card" style={{ borderLeft: `3px solid ${currentDebt.yoy_growth > 0 ? '#EF4444' : '#10B981'}` }}>
                <div style={{ fontFamily: 'var(--font-ui)', color: '#FCD34D', fontSize: '10px', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  YOY GROWTH
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '24px' : '28px', fontWeight: '700', color: currentDebt.yoy_growth > 0 ? '#EF4444' : '#10B981' }}>
                  {currentDebt.yoy_growth != null ? `${currentDebt.yoy_growth > 0 ? '+' : ''}${currentDebt.yoy_growth.toFixed(1)}%` : 'N/A'}
                </div>
              </div>
              <div className="stat-card" style={{ borderLeft: '3px solid #FCD34D' }}>
                <div style={{ fontFamily: 'var(--font-ui)', color: '#FCD34D', fontSize: '10px', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  VS 2021 PEAK
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '24px' : '28px', fontWeight: '700', color: '#FCD34D' }}>
                  {currentDebt.margin_debt >= peak2021.margin_debt ? '+' : ''}{((currentDebt.margin_debt / peak2021.margin_debt - 1) * 100).toFixed(0)}%
                </div>
              </div>
              <div className="stat-card" style={{ borderLeft: '3px solid #38BDF8' }}>
                <div style={{ fontFamily: 'var(--font-ui)', color: '#FCD34D', fontSize: '10px', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  VS 2000 PEAK
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '24px' : '28px', fontWeight: '700', color: '#38BDF8' }}>
                  {currentDebt.margin_debt >= peak2000.margin_debt ? '+' : ''}{((currentDebt.margin_debt / peak2000.margin_debt - 1) * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            {/* Margin Debt Chart */}
            <div className="glass-card" style={{ marginBottom: '1px', marginTop: '1px' }}>
              <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>MARGIN DEBT OVER TIME</span>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <ExportCsvButton
                    data={filteredData.map(d => ({ date: d.date, margin_debt_millions: d.margin_debt, margin_debt_billions: d.margin_debt_bn?.toFixed(2) }))}
                    filename="margin_debt"
                    columns={[
                      { key: 'date', label: 'Date' },
                      { key: 'margin_debt_millions', label: 'Margin Debt (Millions USD)' },
                      { key: 'margin_debt_billions', label: 'Margin Debt (Billions USD)' },
                    ]}
                  />
                  <ChartToggle type={marginMainType} setType={setMarginMainType} />
                </div>
              </div>
              <div style={{ padding: isMobile ? '12px' : '16px' }}>
                <ResponsiveContainer width="100%" height={isMobile ? 220 : 320}>
                  <ComposedChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="marginGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="1 3" stroke="#111827" />
                    <XAxis dataKey="date" stroke="#374151" tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'JetBrains Mono' }} tickFormatter={formatDate} interval={chartInterval} />
                    <YAxis stroke="#374151" tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'JetBrains Mono' }} tickFormatter={v => `$${v}B`} />
                    <Tooltip content={<CustomTooltip />} />
                    {marginMainType === 'line' ? (
                      <Area type="monotone" dataKey="margin_debt_bn" stroke="#F59E0B" strokeWidth={2} fill="url(#marginGradient)" name="Margin Debt" />
                    ) : (
                      <Bar dataKey="margin_debt_bn" fill="#F59E0B" name="Margin Debt" />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* YoY Growth Chart */}
            <div className="glass-card" style={{ marginBottom: '1px', marginTop: '1px' }}>
              <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>YEAR-OVER-YEAR GROWTH RATE</span>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <ExportCsvButton
                    data={filteredData.filter(d => d.yoy_growth !== null).map(d => ({ date: d.date, yoy_growth_pct: d.yoy_growth }))}
                    filename="margin_debt_yoy"
                    columns={[
                      { key: 'date', label: 'Date' },
                      { key: 'yoy_growth_pct', label: 'YoY Growth (%)' },
                    ]}
                  />
                  <ChartToggle type={marginYoyType} setType={setMarginYoyType} />
                </div>
              </div>
              <div style={{ padding: isMobile ? '12px' : '16px' }}>
                <ResponsiveContainer width="100%" height={isMobile ? 200 : 260}>
                  <ComposedChart data={filteredData.filter(d => d.yoy_growth !== null)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="1 3" stroke="#111827" />
                    <XAxis dataKey="date" stroke="#374151" tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'JetBrains Mono' }} tickFormatter={formatDate} interval={chartInterval} />
                    <YAxis stroke="#374151" tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'JetBrains Mono' }} tickFormatter={v => `${v}%`} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke="#4B5563" strokeWidth={1} />
                    <ReferenceLine y={30}  stroke="#EF4444" strokeDasharray="4 4" strokeOpacity={0.8} label={{ value: '+30%', fill: '#EF4444', fontSize: 9 }} />
                    <ReferenceLine y={-30} stroke="#10B981" strokeDasharray="4 4" strokeOpacity={0.8} label={{ value: '-30%', fill: '#10B981', fontSize: 9 }} />
                    {marginYoyType === 'line' ? (
                      <Line type="monotone" dataKey="yoy_growth" stroke="#FCD34D" strokeWidth={2} dot={false} name="YoY Growth" />
                    ) : (
                      <Bar dataKey="yoy_growth" fill="#FCD34D" name="YoY Growth" />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '10px', flexWrap: 'wrap', fontFamily: 'JetBrains Mono' }}>
                  <div className="badge badge-warning">+30% EUPHORIA ZONE</div>
                  <div className="badge badge-success">-30% CAPITULATION ZONE</div>
                </div>
              </div>
            </div>

            {/* Historical Pattern */}
            <div className="glass-card" style={{ marginBottom: '1px', marginTop: '1px', borderLeft: '3px solid #FCD34D' }}>
              <div style={{ padding: isMobile ? '12px 14px' : '12px 16px' }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontWeight: '700', color: '#FCD34D', fontSize: '10px', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '6px' }}>HISTORICAL PATTERN</div>
                <p style={{ fontFamily: 'var(--font-mono)', color: '#D1D5DB', fontSize: '12px', lineHeight: '1.6' }}>
                  Sustained 30%+ YoY margin debt growth has preceded every major market correction.
                  2000 peak (+80% YoY) → dot-com crash. 2007 peak (+62% YoY) → financial crisis.
                  2021 peak (+71% YoY) → 2022 bear market.
                </p>
              </div>
            </div>

            {/* Threshold Statistics */}
            {thresholdStats && (
              <div className="glass-card" style={{ marginTop: '1px' }}>
                <div className="bb-panel-header">THRESHOLD DURATION STATISTICS</div>
                <div style={{ padding: isMobile ? '12px' : '16px' }}>
                  {/* Current Status */}
                  <div style={{
                    marginBottom: '12px', padding: '10px 14px',
                    background: thresholdStats.current.status === 'above30' ? '#450A0A' : thresholdStats.current.status === 'belowNeg30' ? '#064E3B' : '#0B0F19',
                    border: `1px solid ${thresholdStats.current.status === 'above30' ? '#EF4444' : thresholdStats.current.status === 'belowNeg30' ? '#10B981' : '#1F2937'}`
                  }}>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: '700', marginBottom: '8px', color: '#FCD34D', textTransform: 'uppercase', letterSpacing: '0.8px' }}>CURRENT STATUS</div>
                    {thresholdStats.current.status === 'above30' ? (
                      <div className="badge badge-warning">
                        ABOVE +30% THRESHOLD
                        <span style={{ marginLeft: '8px', color: '#9CA3AF' }}>DUR: {formatDuration(thresholdStats.current.duration)} | YOY: {thresholdStats.current.yoyGrowth?.toFixed(1)}%</span>
                      </div>
                    ) : thresholdStats.current.status === 'belowNeg30' ? (
                      <div className="badge badge-success">
                        BELOW -30% THRESHOLD
                        <span style={{ marginLeft: '8px', color: '#9CA3AF' }}>DUR: {formatDuration(thresholdStats.current.duration)} | YOY: {thresholdStats.current.yoyGrowth?.toFixed(1)}%</span>
                      </div>
                    ) : (
                      <div style={{ fontFamily: 'var(--font-mono)', color: '#9CA3AF', fontSize: '12px' }}>
                        <span style={{ color: '#D1D5DB', fontWeight: '700' }}>NEUTRAL ZONE</span>
                        <span style={{ marginLeft: '12px' }}>YOY: {thresholdStats.current.yoyGrowth?.toFixed(1)}% (between -30% and +30%)</span>
                      </div>
                    )}
                  </div>

                  {/* Stats Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '1px', background: '#111827' }}>
                    <div className="glass-card" style={{ padding: '12px 14px', borderLeft: '3px solid #EF4444' }}>
                      <div className="badge badge-warning" style={{ marginBottom: '10px' }}>ABOVE +30% (EUPHORIA)</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div>
                          <div style={{ fontFamily: 'var(--font-ui)', color: '#FCD34D', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>AVG DURATION</div>
                          <div style={{ fontFamily: 'var(--font-mono)', color: '#F9FAFB', fontSize: '18px', fontWeight: '700' }}>{formatDuration(thresholdStats.above30.avgMonths)}</div>
                        </div>
                        <div>
                          <div style={{ fontFamily: 'var(--font-ui)', color: '#FCD34D', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>OCCURRENCES</div>
                          <div style={{ fontFamily: 'var(--font-mono)', color: '#F9FAFB', fontSize: '16px', fontWeight: '600' }}>{thresholdStats.above30.occurrences}</div>
                        </div>
                        {thresholdStats.above30.periods.length > 0 && (
                          <div style={{ paddingTop: '8px', borderTop: '1px solid #1F2937' }}>
                            <div style={{ fontFamily: 'var(--font-ui)', color: '#6B7280', fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px' }}>PERIOD DURATIONS (MO):</div>
                            <div style={{ fontFamily: 'var(--font-mono)', color: '#9CA3AF', fontSize: '11px' }}>{thresholdStats.above30.periods.join(', ')}</div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="glass-card" style={{ padding: '12px 14px', borderLeft: '3px solid #10B981' }}>
                      <div className="badge badge-success" style={{ marginBottom: '10px' }}>BELOW -30% (CAPITULATION)</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div>
                          <div style={{ fontFamily: 'var(--font-ui)', color: '#FCD34D', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>AVG DURATION</div>
                          <div style={{ fontFamily: 'var(--font-mono)', color: '#F9FAFB', fontSize: '18px', fontWeight: '700' }}>{formatDuration(thresholdStats.belowNeg30.avgMonths)}</div>
                        </div>
                        <div>
                          <div style={{ fontFamily: 'var(--font-ui)', color: '#FCD34D', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>OCCURRENCES</div>
                          <div style={{ fontFamily: 'var(--font-mono)', color: '#F9FAFB', fontSize: '16px', fontWeight: '600' }}>{thresholdStats.belowNeg30.occurrences}</div>
                        </div>
                        {thresholdStats.belowNeg30.periods.length > 0 && (
                          <div style={{ paddingTop: '8px', borderTop: '1px solid #1F2937' }}>
                            <div style={{ fontFamily: 'var(--font-ui)', color: '#6B7280', fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px' }}>PERIOD DURATIONS (MO):</div>
                            <div style={{ fontFamily: 'var(--font-mono)', color: '#9CA3AF', fontSize: '11px' }}>{thresholdStats.belowNeg30.periods.join(', ')}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: '8px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#4B5563', textAlign: 'center' }}>
                    Statistics calculated from all available historical data.
                  </div>
                </div>
              </div>
            )}

            <div style={{ padding: '8px 0', fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#4B5563' }}>
              Source: <a href={metadata?.sourceUrl || 'https://www.finra.org/investors/learn-to-invest/advanced-investing/margin-statistics'} target="_blank" rel="noopener noreferrer" style={{ color: '#6B7280', textDecoration: 'underline' }}>FINRA Margin Statistics</a>
            </div>
          </>
        )}

        {activeTab === 'margin' && !data.length && (
          <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '14px', color: '#6B7280', letterSpacing: '2px' }}>
            NO DATA AVAILABLE
          </div>
        )}

        {/* ── AAII ── */}
        {activeTab === 'aaii' && aaiiRawData.length > 0 && (() => {
          const aaiiData = aaiiRawData;
          const aaiiFiltered = timeRange === 'all' ? aaiiData : timeRange === '10y' ? aaiiData.slice(-120) : timeRange === '5y' ? aaiiData.slice(-60) : aaiiData.slice(-24);
          const cur = aaiiData[aaiiData.length - 1];
          const ci = Math.floor((aaiiFiltered.length || 1) / 8);
          return (
            <>
              <div className="responsive-grid" style={{ marginTop: '1px' }}>
                <div className="stat-card" style={{ borderLeft: '3px solid #F59E0B' }}>
                  <div style={{ fontFamily: 'var(--font-ui)', color: '#FCD34D', fontSize: '10px', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>STOCKS ({cur?.date})</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '24px' : '28px', fontWeight: '700', color: '#F59E0B' }}>{cur?.stocks?.toFixed(1) || '—'}%</div>
                </div>
                <div className="stat-card" style={{ borderLeft: '3px solid #38BDF8' }}>
                  <div style={{ fontFamily: 'var(--font-ui)', color: '#FCD34D', fontSize: '10px', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>BONDS</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '24px' : '28px', fontWeight: '700', color: '#38BDF8' }}>{cur?.bonds?.toFixed(1) || '—'}%</div>
                </div>
                <div className="stat-card" style={{ borderLeft: '3px solid #10B981' }}>
                  <div style={{ fontFamily: 'var(--font-ui)', color: '#FCD34D', fontSize: '10px', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>CASH</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '24px' : '28px', fontWeight: '700', color: '#10B981' }}>{cur?.cash?.toFixed(1) || '—'}%</div>
                </div>
              </div>

              <div className="glass-card" style={{ marginBottom: '1px', marginTop: '1px' }}>
                <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>ASSET ALLOCATION OVER TIME</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <ExportCsvButton data={aaiiFiltered} filename="aaii_allocation" columns={[{ key: 'date', label: 'Date' }, { key: 'stocks', label: 'Stocks (%)' }, { key: 'bonds', label: 'Bonds (%)' }, { key: 'cash', label: 'Cash (%)' }]} />
                    <ChartToggle type={aaiiAllocType} setType={setAaiiAllocType} />
                  </div>
                </div>
                <div style={{ padding: isMobile ? '12px' : '16px' }}>
                  <ResponsiveContainer width="100%" height={isMobile ? 240 : 320}>
                    <ComposedChart data={aaiiFiltered} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="1 3" stroke="#111827" />
                      <XAxis dataKey="date" stroke="#374151" tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'JetBrains Mono' }} tickFormatter={formatDate} interval={ci} />
                      <YAxis stroke="#374151" tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'JetBrains Mono' }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                      <Tooltip content={<AaiiTooltip />} />
                      {aaiiAllocType === 'line' ? (
                        <>
                          <Area type="monotone" dataKey="stocks" stroke="#F59E0B" strokeWidth={2} fill="rgba(245,158,11,0.1)" name="Stocks" />
                          <Area type="monotone" dataKey="bonds"  stroke="#38BDF8" strokeWidth={2} fill="rgba(56,189,248,0.08)" name="Bonds" />
                          <Area type="monotone" dataKey="cash"   stroke="#10B981" strokeWidth={2} fill="rgba(16,185,129,0.08)" name="Cash" />
                        </>
                      ) : (
                        <>
                          <Bar dataKey="stocks" fill="#F59E0B" name="Stocks" stackId="a" />
                          <Bar dataKey="bonds"  fill="#38BDF8" name="Bonds"  stackId="a" />
                          <Bar dataKey="cash"   fill="#10B981" name="Cash"   stackId="a" />
                        </>
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass-card" style={{ marginBottom: '1px', marginTop: '1px' }}>
                <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>STOCK–CASH SPREAD</span>
                  <ChartToggle type={aaiiSpreadType} setType={setAaiiSpreadType} />
                </div>
                <div style={{ padding: isMobile ? '12px' : '16px' }}>
                  <ResponsiveContainer width="100%" height={isMobile ? 200 : 240}>
                    <ComposedChart data={aaiiFiltered.map(d => ({ ...d, spread: (d.stocks || 0) - (d.cash || 0) }))} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="1 3" stroke="#111827" />
                      <XAxis dataKey="date" stroke="#374151" tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'JetBrains Mono' }} tickFormatter={formatDate} interval={ci} />
                      <YAxis stroke="#374151" tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'JetBrains Mono' }} tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`} />
                      <Tooltip content={<AaiiTooltip />} />
                      <ReferenceLine y={0}  stroke="#4B5563" />
                      <ReferenceLine y={40} stroke="#EF4444" strokeDasharray="3 3" label={{ value: '+40%', fill: '#EF4444', fontSize: 9 }} />
                      <ReferenceLine y={10} stroke="#10B981" strokeDasharray="3 3" label={{ value: '+10%', fill: '#10B981', fontSize: 9 }} />
                      {aaiiSpreadType === 'line' ? (
                        <Line type="monotone" dataKey="spread" stroke="#F59E0B" strokeWidth={2} dot={false} name="Spread" />
                      ) : (
                        <Bar dataKey="spread" name="Spread">
                          {aaiiFiltered.map((entry, i) => (
                            <Cell key={i} fill={((entry.stocks || 0) - (entry.cash || 0)) > 40 ? '#EF4444' : ((entry.stocks || 0) - (entry.cash || 0)) < 10 ? '#10B981' : '#F59E0B'} />
                          ))}
                        </Bar>
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={{ padding: '8px 0', fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#4B5563' }}>
                Source: <a href={aaiiMetadata?.sourceUrl || 'https://www.aaii.com/'} target="_blank" rel="noopener noreferrer" style={{ color: '#6B7280', textDecoration: 'underline' }}>AAII Asset Allocation Survey</a>
              </div>
            </>
          );
        })()}

        {activeTab === 'aaii' && aaiiRawData.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '14px', color: '#6B7280', letterSpacing: '2px' }}>
            NO AAII DATA AVAILABLE
          </div>
        )}

        {/* ── Other tab components ── */}
        {activeTab === 'sectors' && (
          <ErrorBoundary>
            <SectorZScore isMobile={isMobile} />
          </ErrorBoundary>
        )}
        {activeTab === 'buffett' && (
          <ErrorBoundary>
            <BuffettIndicator isMobile={isMobile} />
          </ErrorBoundary>
        )}
        {activeTab === 'sofr' && (
          <ErrorBoundary>
            <SofrRate isMobile={isMobile} />
          </ErrorBoundary>
        )}
        {activeTab === 'ppi' && (
          <ErrorBoundary>
            <PpiIndex isMobile={isMobile} />
          </ErrorBoundary>
        )}

      </div>
    </div>
  );
}
