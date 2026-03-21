import React, { useState, useEffect } from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart } from 'recharts';
import { SectorZScore } from './components/SectorZScore';
import { BuffettIndicator } from './components/BuffettIndicator';

const formatDate = (date) => {
  if (!date) return '';
  const [year, month] = date.split('-');
  return `${month}/${year.slice(2)}`;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const formatValue = (p) => {
      if (p.name === 'YoY Growth') return `${p.value?.toFixed(1)}%`;
      if (p.dataKey === 'margin_debt_bn') return `$${p.value?.toFixed(0)}B`;
      return p.value;
    };

    return (
      <div className="custom-tooltip glass-card" style={{ padding: '12px 16px' }}>
        <p style={{ color: 'var(--text-primary)', margin: 0, fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color, margin: '4px 0 0 0', fontSize: '13px', fontWeight: '500' }}>
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
  if (!isNaN(parsed)) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
  }

  const parts = dateStr.split(/[-/]/);
  if (parts.length >= 2) {
    const [p1, p2] = parts;
    if (p1.length === 4) {
      return `${p1}-${p2.padStart(2, '0')}`;
    }
    if (p2.length === 4) {
      return `${p2}-${p1.padStart(2, '0')}`;
    }
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

export default function App() {
  const [rawData, setRawData] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [aaiiRawData, setAaiiRawData] = useState([]);
  const [aaiiMetadata, setAaiiMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('all');
  const [dataSource, setDataSource] = useState('margin');
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 640);

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
        const res = await fetch('./margin_data.json');
        if (!res.ok) throw new Error('Failed to load local margin data');
        const json = await res.json();
        if (!json.data?.length) throw new Error('No margin data in local file');
        if (!cancelled) {
          setRawData(json.data);
          setMetadata({
            lastUpdated: json.last_updated,
            source: json.source,
            sourceUrl: json.source_url
          });
        }
      };

      const loadAaiiData = async () => {
        const res = await fetch('./aaii_allocation_data.json');
        if (!res.ok) throw new Error('Failed to load AAII allocation data');
        const json = await res.json();
        if (!json.data?.length) throw new Error('No AAII data in local file');
        if (!cancelled) {
          setAaiiRawData(json.data);
          setAaiiMetadata({
            lastUpdated: json.last_updated,
            source: json.source,
            sourceUrl: json.source_url
          });
        }
      };

      try {
        await Promise.all([
          loadMarginData(),
          loadAaiiData().catch(() => {
            // AAII data is optional, don't fail if missing
          })
        ]);
      } catch (err) {
        setError(err.message || 'Unable to load data');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

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
            <div className="pulse-animation" style={{ height: '100%', width: '60%', background: 'var(--bb-orange)' }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-background" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="glass-card" style={{ textAlign: 'center', padding: '32px 40px', maxWidth: '500px', borderLeft: '3px solid var(--bb-red)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--bb-red)', marginBottom: '16px', letterSpacing: '2px', fontWeight: '700' }}>
            ERROR
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '16px', fontWeight: '700', color: 'var(--bb-white)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Couldn't Load Data
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--bb-gray-2)', fontSize: '12px', marginBottom: '8px' }}>
            {error}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--bb-gray-3)', fontSize: '11px', marginTop: '12px' }}>
            Please refresh the page or try again later
          </div>
        </div>
      </div>
    );
  }

  if (!rawData.length) {
    return (
      <div className="app-background" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="glass-card" style={{ textAlign: 'center', padding: '32px 40px', maxWidth: '500px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--bb-yellow)', marginBottom: '16px', letterSpacing: '2px', fontWeight: '700' }}>
            NO DATA
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '16px', fontWeight: '700', color: 'var(--bb-white)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            No Data Available
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--bb-gray-2)', fontSize: '12px' }}>
            FINRA margin data is currently unavailable. Please check back later.
          </div>
        </div>
      </div>
    );
  }

  const data = rawData.map(d => ({
    ...d,
    margin_debt_bn: d.margin_debt / 1000
  }));

  const filteredData = timeRange === 'all' ? data :
    timeRange === '10y' ? data.slice(-120) :
    timeRange === '5y' ? data.slice(-60) : data.slice(-24);

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
    const wholeMonths = Math.floor(months);
    const remainderMonths = months - wholeMonths;
    const days = Math.round(remainderMonths * 30);

    if (wholeMonths === 0) {
      return `${days} ${days === 1 ? 'day' : 'days'}`;
    } else if (days === 0) {
      return `${wholeMonths} ${wholeMonths === 1 ? 'month' : 'months'}`;
    } else {
      return `${wholeMonths} ${wholeMonths === 1 ? 'month' : 'months'}, ${days} ${days === 1 ? 'day' : 'days'}`;
    }
  };

  const calculateThresholdStats = (data) => {
    const aboveThirty = [];
    const belowNegThirty = [];

    let currentAbovePeriod = null;
    let currentBelowPeriod = null;

    data.forEach((point, idx) => {
      if (point.yoy_growth === null) return;

      // Track periods above +30%
      if (point.yoy_growth >= 30) {
        if (!currentAbovePeriod) {
          currentAbovePeriod = { start: idx, count: 1 };
        } else {
          currentAbovePeriod.count++;
        }
      } else {
        if (currentAbovePeriod) {
          aboveThirty.push(currentAbovePeriod.count);
          currentAbovePeriod = null;
        }
      }

      // Track periods below -30%
      if (point.yoy_growth <= -30) {
        if (!currentBelowPeriod) {
          currentBelowPeriod = { start: idx, count: 1 };
        } else {
          currentBelowPeriod.count++;
        }
      } else {
        if (currentBelowPeriod) {
          belowNegThirty.push(currentBelowPeriod.count);
          currentBelowPeriod = null;
        }
      }
    });

    // Determine current status
    const latestPoint = data[data.length - 1];
    let currentStatus = 'neutral';
    let currentDuration = 0;

    if (latestPoint && latestPoint.yoy_growth !== null) {
      if (latestPoint.yoy_growth >= 30 && currentAbovePeriod) {
        currentStatus = 'above30';
        currentDuration = currentAbovePeriod.count;
      } else if (latestPoint.yoy_growth <= -30 && currentBelowPeriod) {
        currentStatus = 'belowNeg30';
        currentDuration = currentBelowPeriod.count;
      }
    }

    // Handle completed periods (not ongoing)
    const completedAbove = currentStatus === 'above30' ? aboveThirty : [...aboveThirty];
    const completedBelow = currentStatus === 'belowNeg30' ? belowNegThirty : [...belowNegThirty];

    if (currentAbovePeriod && currentStatus !== 'above30') completedAbove.push(currentAbovePeriod.count);
    if (currentBelowPeriod && currentStatus !== 'belowNeg30') completedBelow.push(currentBelowPeriod.count);

    const avgAbove = completedAbove.length > 0
      ? completedAbove.reduce((a, b) => a + b, 0) / completedAbove.length
      : 0;
    const avgBelow = completedBelow.length > 0
      ? completedBelow.reduce((a, b) => a + b, 0) / completedBelow.length
      : 0;

    return {
      above30: {
        avgMonths: avgAbove,
        occurrences: completedAbove.length,
        periods: completedAbove
      },
      belowNeg30: {
        avgMonths: avgBelow,
        occurrences: completedBelow.length,
        periods: completedBelow
      },
      current: {
        status: currentStatus,
        duration: currentDuration,
        yoyGrowth: latestPoint?.yoy_growth
      }
    };
  };

  const thresholdStats = calculateThresholdStats(data);

  return (
    <div className="app-background" style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Bloomberg Topbar */}
        <div style={{ background: '#FF6600', padding: '0', marginBottom: '0', display: 'flex', alignItems: 'stretch' }}>
          <div style={{ padding: '8px 16px', borderRight: '1px solid #CC5200', display: 'flex', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-ui)', fontWeight: '900', fontSize: '16px', color: '#000', letterSpacing: '1px' }}>BLOOMBERG</span>
            <span style={{ fontFamily: 'var(--font-ui)', fontWeight: '400', fontSize: '16px', color: '#000', marginLeft: '6px', opacity: 0.7 }}>FINANCIAL</span>
          </div>
          <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', flex: 1 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#000', opacity: 0.8, letterSpacing: '0.5px' }}>
              {dataSource === 'margin' ? 'FINRA MARGIN DEBT TRACKER' : dataSource === 'aaii' ? 'AAII ASSET ALLOCATION SURVEY' : dataSource === 'sectors' ? 'SECTOR Z-SCORE DASHBOARD' : 'BUFFETT INDICATOR'}
            </span>
          </div>
          {((dataSource === 'margin' && metadata) || (dataSource === 'aaii' && aaiiMetadata)) && (
            <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', borderLeft: '1px solid #CC5200' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#000', opacity: 0.8 }}>
                UPD: {formatLastUpdated(dataSource === 'margin' ? metadata?.lastUpdated : aaiiMetadata?.lastUpdated)}
              </span>
            </div>
          )}
        </div>

        {/* Subtitle bar */}
        <div style={{ background: '#111111', borderBottom: '1px solid #2A2A2A', padding: '6px 16px', marginBottom: '0' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#666666' }}>
            {dataSource === 'margin' ? 'Securities margin account debit balances (USD billions)' : dataSource === 'aaii' ? 'Individual investor asset allocation trends (%)' : dataSource === 'sectors' ? 'Relative sector performance analysis vs benchmark' : "Berkshire Hathaway annual cash & T-bill holdings"}
          </span>
        </div>

        {/* Data Source Tabs */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '0', flexWrap: 'wrap', borderBottom: '1px solid #2A2A2A', background: '#0A0A0A' }}>
          {[
            { key: 'margin', label: 'FINRA MARGIN DEBT' },
            { key: 'aaii', label: 'AAII ALLOCATION' },
            { key: 'sectors', label: 'SECTOR Z-SCORE' },
            { key: 'buffett', label: 'BUFFETT INDICATOR' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setDataSource(key)}
              style={{
                padding: '10px 18px',
                fontFamily: 'var(--font-ui)',
                fontWeight: '700',
                fontSize: '11px',
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
                border: 'none',
                borderRight: '1px solid #2A2A2A',
                borderBottom: dataSource === key ? '2px solid #FF6600' : '2px solid transparent',
                cursor: 'pointer',
                background: dataSource === key ? '#1A1A1A' : 'transparent',
                color: dataSource === key ? '#FF6600' : '#666666',
                transition: 'all 0.1s ease',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Time Range Buttons */}
        {dataSource !== 'sectors' && dataSource !== 'buffett' && (
          <div style={{ display: 'flex', gap: '0', marginBottom: '0', flexWrap: 'wrap', borderBottom: '1px solid #2A2A2A', background: '#050505' }}>
            {['2y', '5y', '10y', 'all'].map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                style={{
                  padding: '7px 16px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  fontWeight: '700',
                  letterSpacing: '0.5px',
                  background: timeRange === range ? '#1A1000' : 'transparent',
                  color: timeRange === range ? '#FF6600' : '#555555',
                  border: 'none',
                  borderRight: '1px solid #1A1A1A',
                  borderBottom: timeRange === range ? '2px solid #FF6600' : '2px solid transparent',
                  cursor: 'pointer',
                }}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {/* MARGIN DATA SOURCE */}
        {dataSource === 'margin' && (
          <>
            {/* Key Metrics */}
            <div className="responsive-grid" style={{ marginBottom: '1px', marginTop: '1px', gap: '1px', background: '#1A1A1A' }}>
              <div className="stat-card" style={{ borderLeft: '3px solid #FF6600', padding: '12px 16px' }}>
                <div style={{ fontFamily: 'var(--font-ui)', color: '#FFD700', fontSize: '10px', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  CURRENT ({currentDebt.date})
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '24px' : '28px', fontWeight: '700', color: '#FF6600' }}>
                  ${currentDebt.margin_debt_bn.toFixed(0)}B
                </div>
              </div>
              <div className="stat-card" style={{ borderLeft: `3px solid ${currentDebt.yoy_growth > 0 ? '#FF3333' : '#00CC44'}`, padding: '12px 16px' }}>
                <div style={{ fontFamily: 'var(--font-ui)', color: '#FFD700', fontSize: '10px', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  YOY GROWTH
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '24px' : '28px', fontWeight: '700', color: currentDebt.yoy_growth > 0 ? '#FF3333' : '#00CC44' }}>
                  {currentDebt.yoy_growth != null ? `${currentDebt.yoy_growth > 0 ? '+' : ''}${currentDebt.yoy_growth.toFixed(1)}%` : 'N/A'}
                </div>
              </div>
              <div className="stat-card" style={{ borderLeft: '3px solid #FFD700', padding: '12px 16px' }}>
                <div style={{ fontFamily: 'var(--font-ui)', color: '#FFD700', fontSize: '10px', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  VS 2021 PEAK
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '24px' : '28px', fontWeight: '700', color: '#FFD700' }}>
                  {currentDebt.margin_debt >= peak2021.margin_debt ? '+' : ''}{((currentDebt.margin_debt / peak2021.margin_debt - 1) * 100).toFixed(0)}%
                </div>
              </div>
              <div className="stat-card" style={{ borderLeft: '3px solid #00CCCC', padding: '12px 16px' }}>
                <div style={{ fontFamily: 'var(--font-ui)', color: '#FFD700', fontSize: '10px', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  VS 2000 PEAK
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '24px' : '28px', fontWeight: '700', color: '#00CCCC' }}>
                  {currentDebt.margin_debt >= peak2000.margin_debt ? '+' : ''}{((currentDebt.margin_debt / peak2000.margin_debt - 1) * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            {/* Margin Debt Chart */}
            <div className="glass-card" style={{ padding: isMobile ? '0' : '0', marginBottom: '1px', marginTop: '1px' }}>
              <div className="bb-panel-header">MARGIN DEBT OVER TIME</div>
              <div style={{ padding: isMobile ? '12px' : '16px' }}>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="marginGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF6600" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#FF6600" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="1 3" stroke="#1A1A1A" />
                  <XAxis
                    dataKey="date"
                    stroke="#333333"
                    tick={{ fill: '#666666', fontSize: 10, fontFamily: 'Courier New' }}
                    tickFormatter={formatDate}
                    interval={chartInterval}
                  />
                  <YAxis
                    stroke="#333333"
                    tick={{ fill: '#666666', fontSize: 10, fontFamily: 'Courier New' }}
                    tickFormatter={(v) => `$${v}B`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="margin_debt_bn"
                    stroke="#FF6600"
                    strokeWidth={2}
                    fill="url(#marginGradient)"
                    name="Margin Debt"
                  />
                </ComposedChart>
              </ResponsiveContainer>
              </div>
            </div>

            {/* YoY Growth Chart */}
            <div className="glass-card" style={{ padding: '0', marginBottom: '1px', marginTop: '1px' }}>
              <div className="bb-panel-header">YEAR-OVER-YEAR GROWTH RATE</div>
              <div style={{ padding: isMobile ? '12px' : '16px' }}>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={filteredData.filter(d => d.yoy_growth !== null)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="1 3" stroke="#1A1A1A" />
                  <XAxis
                    dataKey="date"
                    stroke="#333333"
                    tick={{ fill: '#666666', fontSize: 10, fontFamily: 'Courier New' }}
                    tickFormatter={formatDate}
                    interval={chartInterval}
                  />
                  <YAxis
                    stroke="#333333"
                    tick={{ fill: '#666666', fontSize: 10, fontFamily: 'Courier New' }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#444444" strokeWidth={1} />
                  <ReferenceLine y={30} stroke="#FF3333" strokeDasharray="4 4" strokeOpacity={0.8} label={{ value: '+30%', fill: '#FF3333', fontSize: 9 }} />
                  <ReferenceLine y={-30} stroke="#00CC44" strokeDasharray="4 4" strokeOpacity={0.8} label={{ value: '-30%', fill: '#00CC44', fontSize: 9 }} />
                  <Line
                    type="monotone"
                    dataKey="yoy_growth"
                    stroke="#FFD700"
                    strokeWidth={2}
                    dot={false}
                    name="YoY Growth"
                  />
                </ComposedChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '10px', flexWrap: 'wrap', fontFamily: 'Courier New' }}>
                <div className="badge badge-warning">+30% EUPHORIA ZONE</div>
                <div className="badge badge-success">-30% CAPITULATION ZONE</div>
              </div>
              </div>
            </div>

            {/* Historical Pattern Insight */}
            <div className="glass-card" style={{ padding: '0', marginBottom: '1px', marginTop: '1px', borderLeft: '3px solid #FFD700' }}>
              <div style={{ padding: isMobile ? '12px 14px' : '12px 16px' }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontWeight: '700', color: '#FFD700', fontSize: '10px', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '6px' }}>HISTORICAL PATTERN</div>
                <p style={{ fontFamily: 'var(--font-mono)', color: '#CCCCCC', fontSize: '12px', lineHeight: '1.6' }}>
                  Sustained 30%+ YoY margin debt growth has preceded every major market correction.
                  2000 peak (+80% YoY) &rarr; dot-com crash. 2007 peak (+62% YoY) &rarr; financial crisis.
                  2021 peak (+71% YoY) &rarr; 2022 bear market.
                </p>
              </div>
            </div>

            {/* Threshold Statistics */}
            <div className="glass-card" style={{ padding: '0', marginTop: '1px' }}>
              <div className="bb-panel-header">THRESHOLD DURATION STATISTICS</div>
              <div style={{ padding: isMobile ? '12px' : '16px' }}>

              {/* Current Status */}
              <div style={{
                marginBottom: '12px',
                padding: '10px 14px',
                background: thresholdStats.current.status === 'above30' ? '#1A0000' :
                            thresholdStats.current.status === 'belowNeg30' ? '#001A00' :
                            '#0A0A0A',
                border: thresholdStats.current.status === 'above30' ? '1px solid #FF3333' :
                        thresholdStats.current.status === 'belowNeg30' ? '1px solid #00CC44' :
                        '1px solid #2A2A2A'
              }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: '700', marginBottom: '8px', color: '#FFD700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  CURRENT STATUS
                </div>
                {thresholdStats.current.status === 'above30' ? (
                  <div className="badge badge-warning">
                    <span>ABOVE +30% THRESHOLD</span>
                    <span style={{ marginLeft: '8px', color: '#999999' }}>
                      DUR: {formatDuration(thresholdStats.current.duration)} | YOY: {thresholdStats.current.yoyGrowth?.toFixed(1)}%
                    </span>
                  </div>
                ) : thresholdStats.current.status === 'belowNeg30' ? (
                  <div className="badge badge-success">
                    <span>BELOW -30% THRESHOLD</span>
                    <span style={{ marginLeft: '8px', color: '#999999' }}>
                      DUR: {formatDuration(thresholdStats.current.duration)} | YOY: {thresholdStats.current.yoyGrowth?.toFixed(1)}%
                    </span>
                  </div>
                ) : (
                  <div style={{ fontFamily: 'var(--font-mono)', color: '#999999', fontSize: '12px' }}>
                    <span style={{ color: '#CCCCCC', fontWeight: '700' }}>NEUTRAL ZONE</span>
                    <span style={{ marginLeft: '12px' }}>
                      YOY: {thresholdStats.current.yoyGrowth?.toFixed(1)}% (between -30% and +30%)
                    </span>
                  </div>
                )}
              </div>

              {/* Historical Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '1px', background: '#1A1A1A' }}>
                {/* Above Threshold */}
                <div className="glass-card" style={{ padding: '12px 14px', borderLeft: '3px solid #FF3333' }}>
                  <div className="badge badge-warning" style={{ marginBottom: '10px' }}>
                    ABOVE +30% (EUPHORIA)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-ui)', color: '#FFD700', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>AVG DURATION</div>
                      <div style={{ fontFamily: 'var(--font-mono)', color: '#FFFFFF', fontSize: '18px', fontWeight: '700' }}>
                        {formatDuration(thresholdStats.above30.avgMonths)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontFamily: 'var(--font-ui)', color: '#FFD700', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>OCCURRENCES</div>
                      <div style={{ fontFamily: 'var(--font-mono)', color: '#FFFFFF', fontSize: '16px', fontWeight: '600' }}>
                        {thresholdStats.above30.occurrences}
                      </div>
                    </div>
                    {thresholdStats.above30.periods.length > 0 && (
                      <div style={{ paddingTop: '8px', borderTop: '1px solid #2A2A2A' }}>
                        <div style={{ fontFamily: 'var(--font-ui)', color: '#666666', fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px' }}>PERIOD DURATIONS (MO):</div>
                        <div style={{ fontFamily: 'var(--font-mono)', color: '#999999', fontSize: '11px' }}>
                          {thresholdStats.above30.periods.join(', ')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Below Threshold */}
                <div className="glass-card" style={{ padding: '12px 14px', borderLeft: '3px solid #00CC44' }}>
                  <div className="badge badge-success" style={{ marginBottom: '10px' }}>
                    BELOW -30% (CAPITULATION)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-ui)', color: '#FFD700', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>AVG DURATION</div>
                      <div style={{ fontFamily: 'var(--font-mono)', color: '#FFFFFF', fontSize: '18px', fontWeight: '700' }}>
                        {formatDuration(thresholdStats.belowNeg30.avgMonths)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontFamily: 'var(--font-ui)', color: '#FFD700', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>OCCURRENCES</div>
                      <div style={{ fontFamily: 'var(--font-mono)', color: '#FFFFFF', fontSize: '16px', fontWeight: '600' }}>
                        {thresholdStats.belowNeg30.occurrences}
                      </div>
                    </div>
                    {thresholdStats.belowNeg30.periods.length > 0 && (
                      <div style={{ paddingTop: '8px', borderTop: '1px solid #2A2A2A' }}>
                        <div style={{ fontFamily: 'var(--font-ui)', color: '#666666', fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px' }}>PERIOD DURATIONS (MO):</div>
                        <div style={{ fontFamily: 'var(--font-mono)', color: '#999999', fontSize: '11px' }}>
                          {thresholdStats.belowNeg30.periods.join(', ')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '8px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#444444', textAlign: 'center' }}>
                Statistics calculated from all available historical data. Each period = consecutive months where YoY growth remained above/below threshold.
              </div>
              </div>
            </div>
          </>
        )}

        {/* AAII DATA SOURCE */}
        {dataSource === 'aaii' && aaiiRawData.length > 0 && (
          <>
            {(() => {
              const aaiiData = aaiiRawData;
              const aaiiFilteredData = timeRange === 'all' ? aaiiData :
                timeRange === '10y' ? aaiiData.slice(-120) :
                timeRange === '5y' ? aaiiData.slice(-60) : aaiiData.slice(-24);

              const currentAllocation = aaiiData[aaiiData.length - 1];
              const aaiiChartInterval = Math.floor((aaiiFilteredData.length || 1) / 8);

              const avgStocks = aaiiData.reduce((sum, d) => sum + (d.stocks || 0), 0) / aaiiData.length;
              const avgBonds = aaiiData.reduce((sum, d) => sum + (d.bonds || 0), 0) / aaiiData.length;
              const avgCash = aaiiData.reduce((sum, d) => sum + (d.cash || 0), 0) / aaiiData.length;

              return (
                <>
                  {/* Current Allocation */}
                  <div className="responsive-grid" style={{ marginBottom: '1px', marginTop: '1px', gap: '1px', background: '#1A1A1A' }}>
                    <div className="stat-card" style={{ borderLeft: '3px solid #00CCCC', padding: '12px 16px' }}>
                      <div style={{ fontFamily: 'var(--font-ui)', color: '#FFD700', fontSize: '10px', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                        STOCKS ({currentAllocation?.date})
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '24px' : '28px', fontWeight: '700', color: '#00CCCC' }}>
                        {currentAllocation?.stocks?.toFixed(1) || 'N/A'}%
                      </div>
                    </div>
                    <div className="stat-card" style={{ borderLeft: '3px solid #FFD700', padding: '12px 16px' }}>
                      <div style={{ fontFamily: 'var(--font-ui)', color: '#FFD700', fontSize: '10px', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                        BONDS
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '24px' : '28px', fontWeight: '700', color: '#FFD700' }}>
                        {currentAllocation?.bonds?.toFixed(1) || 'N/A'}%
                      </div>
                    </div>
                    <div className="stat-card" style={{ borderLeft: '3px solid #00CC44', padding: '12px 16px' }}>
                      <div style={{ fontFamily: 'var(--font-ui)', color: '#FFD700', fontSize: '10px', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                        CASH
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '24px' : '28px', fontWeight: '700', color: '#00CC44' }}>
                        {currentAllocation?.cash?.toFixed(1) || 'N/A'}%
                      </div>
                    </div>
                  </div>

                  {/* Historical Averages */}
                  <div className="glass-card" style={{ padding: '0', marginBottom: '1px', marginTop: '1px' }}>
                    <div className="bb-panel-header">HISTORICAL AVERAGE (SINCE 1987)</div>
                    <div style={{ padding: '12px 16px' }}>
                    <div className="responsive-grid" style={{ gap: '1px', background: '#1A1A1A' }}>
                      <div className="glass-card" style={{ padding: '10px 14px', borderLeft: '3px solid #00CCCC' }}>
                        <div style={{ fontFamily: 'var(--font-ui)', color: '#FFD700', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>AVG STOCKS</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: '700', color: '#00CCCC' }}>{avgStocks.toFixed(1)}%</div>
                      </div>
                      <div className="glass-card" style={{ padding: '10px 14px', borderLeft: '3px solid #FFD700' }}>
                        <div style={{ fontFamily: 'var(--font-ui)', color: '#FFD700', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>AVG BONDS</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: '700', color: '#FFD700' }}>{avgBonds.toFixed(1)}%</div>
                      </div>
                      <div className="glass-card" style={{ padding: '10px 14px', borderLeft: '3px solid #00CC44' }}>
                        <div style={{ fontFamily: 'var(--font-ui)', color: '#FFD700', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>AVG CASH</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: '700', color: '#00CC44' }}>{avgCash.toFixed(1)}%</div>
                      </div>
                    </div>
                    </div>
                  </div>

                  {/* Allocation Chart */}
                  <div className="glass-card" style={{ padding: '0', marginBottom: '1px', marginTop: '1px' }}>
                    <div className="bb-panel-header">ASSET ALLOCATION OVER TIME</div>
                    <div style={{ padding: isMobile ? '12px' : '16px' }}>
                    <ResponsiveContainer width="100%" height={340}>
                      <ComposedChart data={aaiiFilteredData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="stocksGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00CCCC" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#00CCCC" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="bondsGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#FFD700" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#FFD700" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00CC44" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#00CC44" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="1 3" stroke="#1A1A1A" />
                        <XAxis
                          dataKey="date"
                          stroke="#333333"
                          tick={{ fill: '#666666', fontSize: 10, fontFamily: 'Courier New' }}
                          tickFormatter={formatDate}
                          interval={aaiiChartInterval}
                        />
                        <YAxis
                          stroke="#333333"
                          tick={{ fill: '#666666', fontSize: 10, fontFamily: 'Courier New' }}
                          tickFormatter={(v) => `${v}%`}
                          domain={[0, 100]}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="stocks" stroke="#00CCCC" strokeWidth={2} fill="url(#stocksGradient)" name="Stocks" />
                        <Area type="monotone" dataKey="bonds" stroke="#FFD700" strokeWidth={2} fill="url(#bondsGradient)" name="Bonds" />
                        <Area type="monotone" dataKey="cash" stroke="#00CC44" strokeWidth={2} fill="url(#cashGradient)" name="Cash" />
                      </ComposedChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap', fontFamily: 'Courier New', fontSize: '10px' }}>
                      <div className="badge" style={{ background: '#001A1A', color: '#00CCCC', border: '1px solid #00CCCC' }}>STOCKS</div>
                      <div className="badge" style={{ background: '#1A1A00', color: '#FFD700', border: '1px solid #FFD700' }}>BONDS</div>
                      <div className="badge badge-success">CASH</div>
                    </div>
                    </div>
                  </div>

                  {/* About AAII */}
                  <div className="glass-card" style={{ padding: '0', marginTop: '1px', borderLeft: '3px solid #00CCCC' }}>
                    <div style={{ padding: isMobile ? '12px 14px' : '12px 16px' }}>
                      <div style={{ fontFamily: 'var(--font-ui)', fontWeight: '700', color: '#00CCCC', fontSize: '10px', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '6px' }}>ABOUT AAII ASSET ALLOCATION</div>
                      <p style={{ fontFamily: 'var(--font-mono)', color: '#CCCCCC', fontSize: '12px', lineHeight: '1.6' }}>
                        The AAII Asset Allocation Survey tracks how individual investors allocate their portfolios among stocks, bonds, and cash.
                        Extreme allocations to stocks often signal euphoria, while high cash levels may indicate fear or caution in the markets.
                      </p>
                    </div>
                  </div>
                </>
              );
            })()}
          </>
        )}

        {dataSource === 'aaii' && aaiiRawData.length === 0 && (
          <div className="glass-card" style={{ padding: '32px', textAlign: 'center', marginTop: '1px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: '#FFD700', marginBottom: '12px', letterSpacing: '2px' }}>NO DATA</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: '700', color: '#FFFFFF', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              No AAII Data Available
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', color: '#666666', fontSize: '12px' }}>
              Please provide the AAII allocation data to display charts.
            </div>
          </div>
        )}

        {/* SECTORS DATA SOURCE */}
        {dataSource === 'sectors' && (
          <SectorZScore isMobile={isMobile} />
        )}

        {/* BUFFETT INDICATOR */}
        {dataSource === 'buffett' && (
          <BuffettIndicator isMobile={isMobile} />
        )}

        {/* Footer */}
        <div style={{ borderTop: '1px solid #1A1A1A', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', color: '#333333', fontSize: '10px', letterSpacing: '0.5px' }}>
            MARKET INTELLIGENCE TERMINAL
          </span>
          {((dataSource === 'margin' && metadata) || (dataSource === 'aaii' && aaiiMetadata)) && (
            <a
              href={dataSource === 'margin' ? metadata?.sourceUrl : aaiiMetadata?.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontFamily: 'var(--font-mono)', color: '#444444', fontSize: '10px', textDecoration: 'none' }}
              onMouseEnter={(e) => e.target.style.color = '#FF6600'}
              onMouseLeave={(e) => e.target.style.color = '#444444'}
            >
              SRC: {dataSource === 'margin' ? metadata?.source : aaiiMetadata?.source}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
