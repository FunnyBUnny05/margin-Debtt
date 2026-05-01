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
import { PpiDashboard } from './components/PpiDashboard';
import { ExportCsvButton } from './components/ExportCsvButton';
import { FearGreedIndex } from './components/FearGreedIndex';
import { SourceLink } from './components/SourceLink';
import { ChartToggle } from './components/ChartToggle';
import { formatDate } from './utils/formatDate';
import { ChartTooltip } from './components/ChartTooltip';
import { LoadingScreen } from './components/LoadingScreen';

const FINRA_CSV_URL = 'https://www.finra.org/sites/default/files/2021-03/margin-statistics.csv';

const marginFormatValue = (p) => {
  if (p.name === 'YoY Growth') return `${p.value?.toFixed(1)}%`;
  if (p.dataKey === 'margin_debt_bn') return `$${p.value?.toFixed(0)}B`;
  return p.value;
};
const CustomTooltip = (props) => <ChartTooltip {...props} formatValue={marginFormatValue} />;

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
  { key: 'margin',     label: 'Margin Debt' },
  { key: 'aaii',       label: 'AAII Survey' },
  { key: 'sectors',    label: 'Sector Z-Score' },
  { key: 'buffett',    label: 'Buffett Ind.' },
  { key: 'sofr',       label: 'SOFR Rate' },
  { key: 'ppi',        label: 'PPI Index' },
  { key: 'fear_greed', label: 'Fear & Greed' },
];

export default function App() {
  const [rawData, setRawData] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [aaiiRawData, setAaiiRawData] = useState([]);
  const [aaiiMetadata, setAaiiMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('all');
  const [activeTab, setActiveTab] = useState('ppi');
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 640);
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);

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
        const urlsToTry = [
          FINRA_CSV_URL,
          ...CORS_PROXIES.map(fn => fn(FINRA_CSV_URL))
        ];
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
          } catch { /* continue */ }
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

  // ── Margin debt helpers ───────────────────────────────────
  const data = rawData.map(d => ({ ...d, margin_debt_bn: d.margin_debt / 1000 }));
  const filteredData = timeRange === 'all' ? data
    : timeRange === '10y' ? data.slice(-120)
    : timeRange === '5y'  ? data.slice(-60)
    : data.slice(-24);
  const chartInterval = Math.floor((filteredData.length || 1) / 8);
  const currentDebt  = data[data.length - 1];
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
      above30: { avgMonths: completedAbove.length ? completedAbove.reduce((a, b) => a + b, 0) / completedAbove.length : 0, occurrences: completedAbove.length, periods: completedAbove },
      belowNeg30: { avgMonths: completedBelow.length ? completedBelow.reduce((a, b) => a + b, 0) / completedBelow.length : 0, occurrences: completedBelow.length, periods: completedBelow },
      current: { status, duration, yoyGrowth: latest?.yoy_growth },
    };
  };

  const thresholdStats = data.length ? calculateThresholdStats(data) : null;

  // ── Tabs that use the sidebar+chart layout ────────────────
  const isSidebarTab = activeTab === 'ppi';

  // ── Render ────────────────────────────────────────────────
  return (
    <>
      {showLoadingScreen && (
        <LoadingScreen onComplete={() => setShowLoadingScreen(false)} />
      )}

      <div className="app-background" style={{ visibility: showLoadingScreen ? 'hidden' : 'visible' }}>

        {/* ── Masthead ── */}
        <header className="masthead">
          <div className="masthead-logo">
            <span className="masthead-logo-mark">Sentinel</span>
            <span className="masthead-logo-sub">US Economy</span>
          </div>

          <nav className="masthead-nav">
            {TABS.map(tab => (
              <button
                key={tab.key}
                className={`nav-item ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="masthead-right">
            <div className="live-pill">
              <div className="live-dot" />
              LIVE
            </div>
          </div>
        </header>

        {/* ── Body ── */}
        <div className="body-layout">

          {/* PPI tab — new sidebar + seismic chart layout */}
          {activeTab === 'ppi' && <PpiDashboard />}

          {/* All other tabs — scrollable content panel */}
          {activeTab !== 'ppi' && (
            <div className="content-panel">

              {/* ── Time-range strip (margin / aaii only) ── */}
              {(activeTab === 'margin' || activeTab === 'aaii') && (
                <div style={{ display: 'flex', gap: '2px', marginBottom: '16px', borderBottom: '1px solid var(--rule)', paddingBottom: '12px' }}>
                  {['2y', '5y', '10y', 'all'].map(r => (
                    <button
                      key={r}
                      className={`period-btn ${timeRange === r ? 'active' : ''}`}
                      onClick={() => setTimeRange(r)}
                    >
                      {r.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Margin Debt ── */}
              {activeTab === 'margin' && !loading && !error && data.length > 0 && currentDebt && (
                <>
                  <div className="responsive-grid" style={{ marginBottom: '16px' }}>
                    <div className="stat-card">
                      <div className="stat-block-label">Current ({currentDebt.date})</div>
                      <div className="stat-block-value neutral">${currentDebt.margin_debt_bn.toFixed(0)}B</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-block-label">YoY Growth</div>
                      <div className={`stat-block-value ${currentDebt.yoy_growth > 0 ? 'neg' : 'pos'}`}>
                        {currentDebt.yoy_growth != null ? `${currentDebt.yoy_growth > 0 ? '+' : ''}${currentDebt.yoy_growth.toFixed(1)}%` : 'N/A'}
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-block-label">vs 2021 Peak</div>
                      <div className="stat-block-value accent">
                        {currentDebt.margin_debt >= peak2021.margin_debt ? '+' : ''}{((currentDebt.margin_debt / peak2021.margin_debt - 1) * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-block-label">vs 2000 Peak</div>
                      <div className="stat-block-value neutral">
                        {currentDebt.margin_debt >= peak2000.margin_debt ? '+' : ''}{((currentDebt.margin_debt / peak2000.margin_debt - 1) * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>

                  <div className="glass-card animate-in" style={{ marginBottom: '16px' }}>
                    <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Margin Debt Over Time</span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                    <div className="chart-wrap">
                      <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
                        <ComposedChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="marginGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="1 3" stroke="var(--rule)" vertical={false} />
                          <XAxis dataKey="date" stroke="var(--text-dim)" tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickFormatter={formatDate} interval={chartInterval} axisLine={false} tickLine={false} />
                          <YAxis stroke="var(--text-dim)" tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickFormatter={v => `$${v}B`} axisLine={false} tickLine={false} />
                          <Tooltip content={<CustomTooltip />} />
                          {marginMainType === 'line' ? (
                            <Area type="monotone" dataKey="margin_debt_bn" stroke="var(--accent)" strokeWidth={2} fill="url(#marginGradient)" name="Margin Debt" />
                          ) : (
                            <Bar dataKey="margin_debt_bn" fill="var(--accent)" name="Margin Debt" />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="glass-card animate-in" style={{ marginBottom: '16px', animationDelay: '100ms' }}>
                    <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Year-over-Year Growth Rate</span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                    <div className="chart-wrap">
                      <ResponsiveContainer width="100%" height={isMobile ? 200 : 260}>
                        <ComposedChart data={filteredData.filter(d => d.yoy_growth !== null)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="1 3" stroke="var(--rule)" vertical={false} />
                          <XAxis dataKey="date" stroke="var(--text-dim)" tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickFormatter={formatDate} interval={chartInterval} axisLine={false} tickLine={false} />
                          <YAxis stroke="var(--text-dim)" tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickFormatter={v => `${v}%`} />
                          <Tooltip content={<CustomTooltip />} />
                          <ReferenceLine y={0} stroke="var(--rule-strong)" strokeWidth={1} />
                          <ReferenceLine y={30}  stroke="var(--neg)"  strokeDasharray="4 4" strokeOpacity={0.8} label={{ value: '+30%', fill: 'var(--neg)',  fontSize: 9 }} />
                          <ReferenceLine y={-30} stroke="var(--pos)" strokeDasharray="4 4" strokeOpacity={0.8} label={{ value: '-30%', fill: 'var(--pos)', fontSize: 9 }} />
                          {marginYoyType === 'line' ? (
                            <Line type="monotone" dataKey="yoy_growth" stroke="var(--accent)" strokeWidth={2} dot={false} name="YoY Growth" />
                          ) : (
                            <Bar dataKey="yoy_growth" fill="var(--accent)" name="YoY Growth" />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '12px', fontFamily: 'var(--font-mono)', fontSize: '9px' }}>
                        <div className="badge badge-warning">+30% Euphoria Zone</div>
                        <div className="badge badge-success">-30% Capitulation Zone</div>
                      </div>
                    </div>
                  </div>

                  {thresholdStats && (
                    <div className="glass-card animate-in" style={{ marginBottom: '16px', animationDelay: '200ms' }}>
                      <div className="bb-panel-header">Threshold Duration Statistics</div>
                      <div style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '12px' }}>
                          <div className="glass-card" style={{ padding: '14px 18px', borderTop: '2px solid var(--neg)' }}>
                            <div className="stat-block-label" style={{ marginBottom: '8px' }}>Above +30% (Euphoria)</div>
                            <div className="stat-block-value neutral sm">{formatDuration(thresholdStats.above30.avgMonths)} avg</div>
                            <div className="stat-block-sub">{thresholdStats.above30.occurrences} occurrences</div>
                          </div>
                          <div className="glass-card" style={{ padding: '14px 18px', borderTop: '2px solid var(--pos)' }}>
                            <div className="stat-block-label" style={{ marginBottom: '8px' }}>Below -30% (Capitulation)</div>
                            <div className="stat-block-value neutral sm">{formatDuration(thresholdStats.belowNeg30.avgMonths)} avg</div>
                            <div className="stat-block-sub">{thresholdStats.belowNeg30.occurrences} occurrences</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <SourceLink
                    href={metadata?.sourceUrl || 'https://www.finra.org/investors/learn-to-invest/advanced-investing/margin-statistics'}
                    label="FINRA Margin Statistics"
                  />
                </>
              )}

              {activeTab === 'margin' && loading && (
                <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.2em', color: 'var(--text-dim)' }}>
                  LOADING MARGIN DATA...
                </div>
              )}

              {activeTab === 'margin' && error && (
                <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.2em', color: 'var(--neg)' }}>
                  ERROR: {error}
                </div>
              )}

              {/* ── AAII ── */}
              {activeTab === 'aaii' && aaiiRawData.length > 0 && (() => {
                const aaiiData = aaiiRawData;
                const aaiiFiltered = timeRange === 'all' ? aaiiData : timeRange === '10y' ? aaiiData.slice(-120) : timeRange === '5y' ? aaiiData.slice(-60) : aaiiData.slice(-24);
                const cur = aaiiData[aaiiData.length - 1];
                const ci = Math.floor((aaiiFiltered.length || 1) / 8);
                const avgStocks = aaiiData.reduce((s, d) => s + (d.stocks || 0), 0) / aaiiData.length;
                const avgBonds  = aaiiData.reduce((s, d) => s + (d.bonds  || 0), 0) / aaiiData.length;
                const avgCash   = aaiiData.reduce((s, d) => s + (d.cash   || 0), 0) / aaiiData.length;
                return (
                  <>
                    <div className="responsive-grid" style={{ marginBottom: '16px' }}>
                      <div className="stat-card">
                        <div className="stat-block-label">Stocks ({cur?.date})</div>
                        <div className="stat-block-value accent">{cur?.stocks?.toFixed(1) || '—'}%</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-block-label">Bonds</div>
                        <div className="stat-block-value neutral">{cur?.bonds?.toFixed(1) || '—'}%</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-block-label">Cash</div>
                        <div className="stat-block-value pos">{cur?.cash?.toFixed(1) || '—'}%</div>
                      </div>
                    </div>

                    <div className="glass-card animate-in" style={{ marginBottom: '16px' }}>
                      <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Asset Allocation Over Time</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <ExportCsvButton data={aaiiFiltered} filename="aaii_allocation" columns={[{ key: 'date', label: 'Date' }, { key: 'stocks', label: 'Stocks (%)' }, { key: 'bonds', label: 'Bonds (%)' }, { key: 'cash', label: 'Cash (%)' }]} />
                          <ChartToggle type={aaiiAllocType} setType={setAaiiAllocType} />
                        </div>
                      </div>
                      <div className="chart-wrap">
                        <ResponsiveContainer width="100%" height={isMobile ? 240 : 320}>
                          <ComposedChart data={aaiiFiltered} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="1 3" stroke="var(--rule)" vertical={false} />
                            <XAxis dataKey="date" stroke="var(--text-dim)" tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickFormatter={formatDate} interval={ci} axisLine={false} tickLine={false} />
                            <YAxis stroke="var(--text-dim)" tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickFormatter={v => `${v}%`} domain={[0, 100]} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            {aaiiAllocType === 'line' ? (
                              <>
                                <Area type="monotone" dataKey="stocks" stroke="var(--accent)"  strokeWidth={2} fill="var(--accent-dim)"  name="Stocks" />
                                <Area type="monotone" dataKey="bonds"  stroke="var(--text-mid)" strokeWidth={2} fill="rgba(138,128,112,0.1)" name="Bonds"  />
                                <Area type="monotone" dataKey="cash"   stroke="var(--pos)"     strokeWidth={2} fill="oklch(74% 0.16 148 / 0.08)" name="Cash" />
                              </>
                            ) : (
                              <>
                                <Bar dataKey="stocks" fill="var(--accent)"  name="Stocks" stackId="a" />
                                <Bar dataKey="bonds"  fill="var(--text-mid)" name="Bonds"  stackId="a" />
                                <Bar dataKey="cash"   fill="var(--pos)"     name="Cash"   stackId="a" />
                              </>
                            )}
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="glass-card animate-in" style={{ marginBottom: '16px', animationDelay: '100ms' }}>
                      <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Stock–Cash Spread</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <ChartToggle type={aaiiSpreadType} setType={setAaiiSpreadType} />
                        </div>
                      </div>
                      <div className="chart-wrap">
                        <ResponsiveContainer width="100%" height={isMobile ? 200 : 240}>
                          <ComposedChart data={aaiiFiltered.map(d => ({ ...d, spread: (d.stocks || 0) - (d.cash || 0) }))} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="1 3" stroke="var(--rule)" vertical={false} />
                            <XAxis dataKey="date" stroke="var(--text-dim)" tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickFormatter={formatDate} interval={ci} axisLine={false} tickLine={false} />
                            <YAxis stroke="var(--text-dim)" tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <ReferenceLine y={0}  stroke="var(--rule-strong)" />
                            <ReferenceLine y={40} stroke="var(--neg)"  strokeDasharray="3 3" label={{ value: '+40%', fill: 'var(--neg)',  fontSize: 9 }} />
                            <ReferenceLine y={10} stroke="var(--pos)" strokeDasharray="3 3" label={{ value: '+10%', fill: 'var(--pos)', fontSize: 9 }} />
                            {aaiiSpreadType === 'line' ? (
                              <Line type="monotone" dataKey="spread" stroke="var(--accent)" strokeWidth={2} dot={false} name="Spread" />
                            ) : (
                              <Bar dataKey="spread" name="Spread">
                                {aaiiFiltered.map((entry, i) => (
                                  <Cell key={i} fill={((entry.stocks || 0) - (entry.cash || 0)) > 40 ? 'var(--neg)' : ((entry.stocks || 0) - (entry.cash || 0)) < 10 ? 'var(--pos)' : 'var(--accent)'} />
                                ))}
                              </Bar>
                            )}
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <SourceLink href={aaiiMetadata?.sourceUrl || 'https://www.aaii.com/'} label="AAII Asset Allocation Survey" />
                  </>
                );
              })()}

              {activeTab === 'aaii' && aaiiRawData.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.2em', color: 'var(--text-dim)' }}>
                  NO AAII DATA AVAILABLE
                </div>
              )}

              {/* ── Other tabs using their own components ── */}
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
              {activeTab === 'fear_greed' && (
                <ErrorBoundary>
                  <FearGreedIndex isMobile={isMobile} />
                </ErrorBoundary>
              )}

            </div>
          )}
        </div>
      </div>
    </>
  );
}
