import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart } from 'recharts';
import { SectorZScore } from './components/SectorZScore';
import { FundamentalAnalysis } from './components/FundamentalAnalysis';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  FETCH_TIMEOUT_MS,
  MOBILE_BREAKPOINT_PX,
  FINRA_CSV_URL,
  MARGIN_DATA_PATH,
  AAII_DATA_PATH,
  CHART_DATA_POINTS_DIVISOR,
  DATA_SOURCES,
  GROWTH_THRESHOLD,
  GROWTH_THRESHOLD_NEG
} from './constants/app';

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

const fetchWithTimeout = (url, timeoutMs = FETCH_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const promise = fetch(url, { signal: controller.signal })
    .finally(() => clearTimeout(timer));
  return { promise, controller };
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
  const [dataSource, setDataSource] = useState(DATA_SOURCES.MARGIN);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT_PX);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT_PX);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let marginController;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      const loadMarginLive = async () => {
        const { promise, controller } = fetchWithTimeout(FINRA_CSV_URL);
        marginController = controller;

        let res;
        try {
          res = await promise;
        } catch (err) {
          if (err.name === 'AbortError') throw new Error('FINRA margin request timed out');
          throw err;
        }

        if (!res.ok) throw new Error('Failed to reach FINRA margin CSV');
        const text = await res.text();
        const parsed = parseFinraMarginCsv(text);
        if (!parsed.length) throw new Error('No margin data parsed from FINRA');
        if (!cancelled) {
          setRawData(parsed);
          setMetadata({
            lastUpdated: parsed[parsed.length - 1]?.date,
            source: 'FINRA Margin Statistics (live)',
            sourceUrl: 'https://www.finra.org/rules-guidance/key-topics/margin-accounts/margin-statistics'
          });
        }
      };

      const loadMarginFallback = async () => {
        const res = await fetch(MARGIN_DATA_PATH);
        if (!res.ok) throw new Error('Failed to load local margin data');
        const json = await res.json();
        if (!json.data?.length) throw new Error('No margin data in local file');
        if (!cancelled) {
          setRawData(json.data);
          setMetadata({
            lastUpdated: json.last_updated,
            source: json.source + ' (cached)',
            sourceUrl: json.source_url
          });
        }
      };

      const loadAaiiData = async () => {
        const res = await fetch(AAII_DATA_PATH);
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
          loadMarginLive().catch(async (liveErr) => {
            await loadMarginFallback().catch((fallbackErr) => {
              throw liveErr;
            });
          }),
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
      marginController?.abort();
    };
  }, []);

  // Manual refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);

    try {
      const res = await fetchWithTimeout(FINRA_CSV_URL).promise;
      if (!res.ok) throw new Error('Failed to reach FINRA margin CSV');
      const text = await res.text();
      const parsed = parseFinraMarginCsv(text);
      if (!parsed.length) throw new Error('No margin data parsed from FINRA');

      setRawData(parsed);
      setMetadata({
        lastUpdated: parsed[parsed.length - 1]?.date,
        source: 'FINRA Margin Statistics (live)',
        sourceUrl: 'https://www.finra.org/rules-guidance/key-topics/margin-accounts/margin-statistics'
      });
    } catch (err) {
      setError(err.message || 'Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="app-background" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px', maxWidth: '500px' }}>
          <div style={{ fontSize: '48px', marginBottom: '24px' }} className="pulse-animation">📊</div>
          <div style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px' }}>
            Loading Market Data
          </div>
          <div style={{ color: 'var(--text-tertiary)', fontSize: '15px' }}>
            Fetching live FINRA margin statistics...
          </div>
          <div className="shimmer" style={{ height: '4px', borderRadius: '999px', marginTop: '24px', overflow: 'hidden' }}></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-background" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px', maxWidth: '500px', border: '1px solid rgba(255, 107, 107, 0.3)' }}>
          <div style={{ fontSize: '48px', marginBottom: '24px' }}>⚠️</div>
          <div style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px' }}>
            Couldn't Load Data
          </div>
          <div style={{ color: 'var(--text-tertiary)', fontSize: '15px', marginBottom: '8px' }}>
            {error}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '16px' }}>
            Please refresh the page or try again later
          </div>
        </div>
      </div>
    );
  }

  if (!rawData.length) {
    return (
      <div className="app-background" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px', maxWidth: '500px' }}>
          <div style={{ fontSize: '48px', marginBottom: '24px' }}>📭</div>
          <div style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px' }}>
            No Data Available
          </div>
          <div style={{ color: 'var(--text-tertiary)', fontSize: '15px' }}>
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

  const chartInterval = Math.floor((filteredData.length || 1) / CHART_DATA_POINTS_DIVISOR);

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
      if (point.yoy_growth >= GROWTH_THRESHOLD) {
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
      if (point.yoy_growth <= GROWTH_THRESHOLD_NEG) {
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
      if (latestPoint.yoy_growth >= GROWTH_THRESHOLD && currentAbovePeriod) {
        currentStatus = 'above30';
        currentDuration = currentAbovePeriod.count;
      } else if (latestPoint.yoy_growth <= GROWTH_THRESHOLD_NEG && currentBelowPeriod) {
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

  // Memoize expensive calculation to prevent unnecessary re-renders
  const thresholdStats = useMemo(() => calculateThresholdStats(data), [data]);

  return (
    <div className="app-background" style={{ padding: isMobile ? '16px' : '24px 32px', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div className="glass-card animate-in" style={{ padding: isMobile ? '24px 20px' : '32px 40px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: isMobile ? '28px' : '36px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.02em' }}>
                {dataSource === 'margin' ? '📈 Margin Debt Tracker' : dataSource === 'aaii' ? '📊 Asset Allocation Survey' : dataSource === 'sectors' ? '🎯 Sector Z-Score Dashboard' : '📊 Fundamental Analysis'}
              </h1>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '15px', lineHeight: '1.5' }}>
                {dataSource === 'margin' ? 'Real-time securities margin account debit balances ($ billions)' : dataSource === 'aaii' ? 'Individual investor asset allocation trends (%)' : dataSource === 'sectors' ? 'Relative sector performance analysis vs benchmark' : 'Comprehensive stock fundamental analysis powered by Alpha Vantage'}
              </p>
            </div>
            {((dataSource === 'margin' && metadata) || (dataSource === 'aaii' && aaiiMetadata)) && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', alignSelf: isMobile ? 'flex-start' : 'center', flexWrap: 'wrap' }}>
                <div className="badge badge-info">
                  <span>📅</span>
                  <span>Updated: {formatLastUpdated(dataSource === 'margin' ? metadata?.lastUpdated : aaiiMetadata?.lastUpdated)}</span>
                </div>
                {dataSource === 'margin' && (
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="btn-primary"
                    style={{
                      padding: '8px 16px',
                      fontSize: '13px',
                      background: refreshing ? 'var(--glass-bg)' : 'var(--gradient-blue)',
                      border: refreshing ? '1px solid var(--glass-border)' : 'none',
                      opacity: refreshing ? 0.6 : 1,
                      cursor: refreshing ? 'not-allowed' : 'pointer'
                    }}
                    aria-label="Refresh margin data"
                  >
                    {refreshing ? '🔄 Refreshing...' : '🔄 Refresh'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Data Source Tabs */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {[
            { key: 'margin', label: 'FINRA Margin Debt', icon: '📊', gradient: 'var(--gradient-coral)' },
            { key: 'aaii', label: 'AAII Allocation', icon: '💼', gradient: 'var(--gradient-blue)' },
            { key: 'sectors', label: 'Sector Z-Score', icon: '🎯', gradient: 'var(--gradient-purple)' },
            { key: 'fundamentals', label: 'Fundamental Analysis', icon: '💹', gradient: 'var(--gradient-emerald)' }
          ].map(({ key, label, icon, gradient }) => (
            <button
              key={key}
              onClick={() => setDataSource(key)}
              className="btn-primary"
              style={{
                background: dataSource === key ? gradient : 'var(--glass-bg)',
                backdropFilter: 'blur(8px)',
                border: dataSource === key ? 'none' : '1px solid var(--glass-border)',
                position: 'relative',
                zIndex: 1
              }}
            >
              <span style={{ marginRight: '6px' }}>{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* Time Range Buttons */}
        {dataSource !== 'sectors' && dataSource !== 'fundamentals' && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
            {['2y', '5y', '10y', 'all'].map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className="btn-primary"
                style={{
                  padding: '8px 20px',
                  fontSize: '13px',
                  background: timeRange === range ? 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)' : 'var(--glass-bg)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid var(--glass-border)'
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
            <div className="responsive-grid" style={{ marginBottom: '24px' }}>
              <div className="stat-card animate-in" style={{ color: 'var(--accent-coral)' }}>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '13px', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Current ({currentDebt.date})
                </div>
                <div style={{ fontSize: isMobile ? '28px' : '32px', fontWeight: '700', color: 'var(--accent-coral)' }}>
                  ${currentDebt.margin_debt_bn.toFixed(0)}B
                </div>
              </div>
              <div className="stat-card animate-in" style={{ color: currentDebt.yoy_growth > 0 ? 'var(--accent-coral)' : 'var(--accent-emerald)', animationDelay: '0.1s' }}>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '13px', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  YoY Growth
                </div>
                <div style={{ fontSize: isMobile ? '28px' : '32px', fontWeight: '700' }}>
                  {currentDebt.yoy_growth > 0 ? '+' : ''}{currentDebt.yoy_growth?.toFixed(1) || 'N/A'}%
                </div>
              </div>
              <div className="stat-card animate-in" style={{ color: 'var(--accent-amber)', animationDelay: '0.2s' }}>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '13px', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  vs 2021 Peak
                </div>
                <div style={{ fontSize: isMobile ? '28px' : '32px', fontWeight: '700', color: 'var(--accent-amber)' }}>
                  {currentDebt.margin_debt >= peak2021.margin_debt ? '+' : ''}{((currentDebt.margin_debt / peak2021.margin_debt - 1) * 100).toFixed(0)}%
                </div>
              </div>
              <div className="stat-card animate-in" style={{ color: 'var(--accent-purple)', animationDelay: '0.3s' }}>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '13px', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  vs 2000 Peak
                </div>
                <div style={{ fontSize: isMobile ? '28px' : '32px', fontWeight: '700', color: 'var(--accent-purple)' }}>
                  +{((currentDebt.margin_debt / peak2000.margin_debt - 1) * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            {/* Margin Debt Chart */}
            <div className="glass-card" style={{ padding: isMobile ? '20px' : '32px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '24px' }}>
                📈 Margin Debt Over Time
              </h2>
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="marginGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff6b6b" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#ff6b6b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                  <XAxis
                    dataKey="date"
                    stroke="var(--text-muted)"
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    tickFormatter={formatDate}
                    interval={chartInterval}
                  />
                  <YAxis
                    stroke="var(--text-muted)"
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    tickFormatter={(v) => `$${v}B`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="margin_debt_bn"
                    stroke="#ff6b6b"
                    strokeWidth={3}
                    fill="url(#marginGradient)"
                    name="Margin Debt"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* YoY Growth Chart */}
            <div className="glass-card" style={{ padding: isMobile ? '20px' : '32px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '24px' }}>
                📊 Year-over-Year Growth Rate
              </h2>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={filteredData.filter(d => d.yoy_growth !== null)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                  <XAxis
                    dataKey="date"
                    stroke="var(--text-muted)"
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    tickFormatter={formatDate}
                    interval={chartInterval}
                  />
                  <YAxis
                    stroke="var(--text-muted)"
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="var(--text-muted)" strokeWidth={2} />
                  <ReferenceLine y={30} stroke="var(--accent-coral)" strokeDasharray="5 5" strokeOpacity={0.6} />
                  <ReferenceLine y={-30} stroke="var(--accent-emerald)" strokeDasharray="5 5" strokeOpacity={0.6} />
                  <Line
                    type="monotone"
                    dataKey="yoy_growth"
                    stroke="var(--accent-amber)"
                    strokeWidth={3}
                    dot={false}
                    name="YoY Growth"
                  />
                </ComposedChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: '24px', marginTop: '16px', fontSize: '13px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <div className="badge badge-warning"><span>🔴</span> +30% Euphoria Zone</div>
                <div className="badge badge-success"><span>🟢</span> -30% Capitulation Zone</div>
              </div>
            </div>

            {/* Historical Pattern Insight */}
            <div className="glass-card" style={{ padding: isMobile ? '20px' : '24px', marginBottom: '24px', borderLeft: '4px solid var(--accent-amber)' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '32px' }}>💡</div>
                <div style={{ flex: 1 }}>
                  <strong style={{ color: 'var(--accent-amber)', fontSize: '15px' }}>Historical Pattern:</strong>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px', lineHeight: '1.6' }}>
                    Sustained 30%+ YoY margin debt growth has preceded every major market correction.
                    2000 peak (+80% YoY) → dot-com crash. 2007 peak (+62% YoY) → financial crisis.
                    2021 peak (+71% YoY) → 2022 bear market.
                  </p>
                </div>
              </div>
            </div>

            {/* Threshold Statistics */}
            <div className="glass-card" style={{ padding: isMobile ? '20px' : '32px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '24px' }}>
                📉 Threshold Duration Statistics
              </h2>

              {/* Current Status */}
              <div className={thresholdStats.current.status !== 'neutral' ? 'glass-card' : ''} style={{
                marginBottom: '24px',
                padding: '20px',
                background: thresholdStats.current.status === 'above30' ? 'rgba(255, 107, 107, 0.08)' :
                            thresholdStats.current.status === 'belowNeg30' ? 'rgba(81, 207, 102, 0.08)' :
                            'var(--background-secondary)',
                border: thresholdStats.current.status === 'above30' ? '2px solid rgba(255, 107, 107, 0.3)' :
                        thresholdStats.current.status === 'belowNeg30' ? '2px solid rgba(81, 207, 102, 0.3)' :
                        '1px solid var(--glass-border)'
              }}>
                <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Current Status
                </div>
                {thresholdStats.current.status === 'above30' ? (
                  <div className="badge badge-warning" style={{ fontSize: '16px', padding: '12px 20px' }}>
                    <span>🔴</span>
                    <div>
                      <div style={{ fontWeight: '700' }}>Above +30% Threshold</div>
                      <div style={{ fontSize: '13px', marginTop: '4px', opacity: 0.9 }}>
                        Duration: {formatDuration(thresholdStats.current.duration)} | YoY: {thresholdStats.current.yoyGrowth?.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ) : thresholdStats.current.status === 'belowNeg30' ? (
                  <div className="badge badge-success" style={{ fontSize: '16px', padding: '12px 20px' }}>
                    <span>🟢</span>
                    <div>
                      <div style={{ fontWeight: '700' }}>Below -30% Threshold</div>
                      <div style={{ fontSize: '13px', marginTop: '4px', opacity: 0.9 }}>
                        Duration: {formatDuration(thresholdStats.current.duration)} | YoY: {thresholdStats.current.yoyGrowth?.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '15px' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>Neutral Zone</span>
                    <div style={{ fontSize: '13px', marginTop: '4px' }}>
                      Current YoY Growth: {thresholdStats.current.yoyGrowth?.toFixed(1)}% (between -30% and +30%)
                    </div>
                  </div>
                )}
              </div>

              {/* Historical Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '20px' }}>
                {/* Above Threshold */}
                <div className="glass-card" style={{ padding: '20px', borderLeft: '3px solid var(--accent-coral)' }}>
                  <div className="badge badge-warning" style={{ marginBottom: '16px' }}>
                    <span>🔴</span> Above +30% (Euphoria)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Average Duration</div>
                      <div style={{ color: 'var(--text-primary)', fontSize: '24px', fontWeight: '700' }}>
                        {formatDuration(thresholdStats.above30.avgMonths)}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Occurrences</div>
                      <div style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '600' }}>
                        {thresholdStats.above30.occurrences}
                      </div>
                    </div>
                    {thresholdStats.above30.periods.length > 0 && (
                      <div style={{ paddingTop: '12px', borderTop: '1px solid var(--glass-border)' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '6px' }}>Period durations (months):</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                          {thresholdStats.above30.periods.join(', ')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Below Threshold */}
                <div className="glass-card" style={{ padding: '20px', borderLeft: '3px solid var(--accent-emerald)' }}>
                  <div className="badge badge-success" style={{ marginBottom: '16px' }}>
                    <span>🟢</span> Below -30% (Capitulation)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Average Duration</div>
                      <div style={{ color: 'var(--text-primary)', fontSize: '24px', fontWeight: '700' }}>
                        {formatDuration(thresholdStats.belowNeg30.avgMonths)}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Occurrences</div>
                      <div style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '600' }}>
                        {thresholdStats.belowNeg30.occurrences}
                      </div>
                    </div>
                    {thresholdStats.belowNeg30.periods.length > 0 && (
                      <div style={{ paddingTop: '12px', borderTop: '1px solid var(--glass-border)' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '6px' }}>Period durations (months):</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                          {thresholdStats.belowNeg30.periods.join(', ')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center' }}>
                Statistics calculated from all available historical data. Each period represents consecutive months where YoY growth remained above/below the threshold.
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
              const aaiiChartInterval = Math.floor((aaiiFilteredData.length || 1) / CHART_DATA_POINTS_DIVISOR);

              const avgStocks = aaiiData.reduce((sum, d) => sum + (d.stocks || 0), 0) / aaiiData.length;
              const avgBonds = aaiiData.reduce((sum, d) => sum + (d.bonds || 0), 0) / aaiiData.length;
              const avgCash = aaiiData.reduce((sum, d) => sum + (d.cash || 0), 0) / aaiiData.length;

              return (
                <>
                  {/* Current Allocation */}
                  <div className="responsive-grid" style={{ marginBottom: '24px' }}>
                    <div className="stat-card animate-in" style={{ color: 'var(--accent-blue)' }}>
                      <div style={{ color: 'var(--text-tertiary)', fontSize: '13px', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Stocks ({currentAllocation?.date})
                      </div>
                      <div style={{ fontSize: isMobile ? '28px' : '32px', fontWeight: '700' }}>
                        {currentAllocation?.stocks?.toFixed(1) || 'N/A'}%
                      </div>
                    </div>
                    <div className="stat-card animate-in" style={{ color: 'var(--accent-amber)', animationDelay: '0.1s' }}>
                      <div style={{ color: 'var(--text-tertiary)', fontSize: '13px', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Bonds
                      </div>
                      <div style={{ fontSize: isMobile ? '28px' : '32px', fontWeight: '700' }}>
                        {currentAllocation?.bonds?.toFixed(1) || 'N/A'}%
                      </div>
                    </div>
                    <div className="stat-card animate-in" style={{ color: 'var(--accent-emerald)', animationDelay: '0.2s' }}>
                      <div style={{ color: 'var(--text-tertiary)', fontSize: '13px', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Cash
                      </div>
                      <div style={{ fontSize: isMobile ? '28px' : '32px', fontWeight: '700' }}>
                        {currentAllocation?.cash?.toFixed(1) || 'N/A'}%
                      </div>
                    </div>
                  </div>

                  {/* Historical Averages */}
                  <div className="glass-card" style={{ padding: isMobile ? '20px' : '32px', marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px' }}>
                      📊 Historical Average (Since 1987)
                    </h3>
                    <div className="responsive-grid">
                      <div className="glass-card" style={{ padding: '16px', borderLeft: '3px solid var(--accent-blue)' }}>
                        <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Avg Stocks</div>
                        <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--accent-blue)' }}>{avgStocks.toFixed(1)}%</div>
                      </div>
                      <div className="glass-card" style={{ padding: '16px', borderLeft: '3px solid var(--accent-amber)' }}>
                        <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Avg Bonds</div>
                        <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--accent-amber)' }}>{avgBonds.toFixed(1)}%</div>
                      </div>
                      <div className="glass-card" style={{ padding: '16px', borderLeft: '3px solid var(--accent-emerald)' }}>
                        <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Avg Cash</div>
                        <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--accent-emerald)' }}>{avgCash.toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>

                  {/* Allocation Chart */}
                  <div className="glass-card" style={{ padding: isMobile ? '20px' : '32px', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '24px' }}>
                      📈 Asset Allocation Over Time
                    </h2>
                    <ResponsiveContainer width="100%" height={380}>
                      <ComposedChart data={aaiiFilteredData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="stocksGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="bondsGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ffd43b" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#ffd43b" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#51cf66" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#51cf66" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                        <XAxis
                          dataKey="date"
                          stroke="var(--text-muted)"
                          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                          tickFormatter={formatDate}
                          interval={aaiiChartInterval}
                        />
                        <YAxis
                          stroke="var(--text-muted)"
                          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                          tickFormatter={(v) => `${v}%`}
                          domain={[0, 100]}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="stocks"
                          stroke="#60a5fa"
                          strokeWidth={2}
                          fill="url(#stocksGradient)"
                          name="Stocks"
                        />
                        <Area
                          type="monotone"
                          dataKey="bonds"
                          stroke="#ffd43b"
                          strokeWidth={2}
                          fill="url(#bondsGradient)"
                          name="Bonds"
                        />
                        <Area
                          type="monotone"
                          dataKey="cash"
                          stroke="#51cf66"
                          strokeWidth={2}
                          fill="url(#cashGradient)"
                          name="Cash"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', gap: '24px', marginTop: '16px', fontSize: '13px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      <div className="badge" style={{ background: 'rgba(96, 165, 250, 0.15)', color: 'var(--accent-blue)', border: '1px solid rgba(96, 165, 250, 0.3)' }}>
                        <span>●</span> Stocks
                      </div>
                      <div className="badge" style={{ background: 'rgba(255, 212, 59, 0.15)', color: 'var(--accent-amber)', border: '1px solid rgba(255, 212, 59, 0.3)' }}>
                        <span>●</span> Bonds
                      </div>
                      <div className="badge badge-success">
                        <span>●</span> Cash
                      </div>
                    </div>
                  </div>

                  {/* About AAII */}
                  <div className="glass-card" style={{ padding: isMobile ? '20px' : '24px', borderLeft: '4px solid var(--accent-blue)' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                      <div style={{ fontSize: '32px' }}>💡</div>
                      <div style={{ flex: 1 }}>
                        <strong style={{ color: 'var(--accent-blue)', fontSize: '15px' }}>About AAII Asset Allocation:</strong>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px', lineHeight: '1.6' }}>
                          The AAII Asset Allocation Survey tracks how individual investors allocate their portfolios among stocks, bonds, and cash.
                          Extreme allocations to stocks often signal euphoria, while high cash levels may indicate fear or caution in the markets.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </>
        )}

        {dataSource === 'aaii' && aaiiRawData.length === 0 && (
          <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
            <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
              No AAII Data Available
            </div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: '15px' }}>
              Please provide the AAII allocation data to display charts.
            </div>
          </div>
        )}

        {/* SECTORS DATA SOURCE */}
        {dataSource === 'sectors' && (
          <SectorZScore isMobile={isMobile} />
        )}

        {/* FUNDAMENTALS DATA SOURCE */}
        {dataSource === 'fundamentals' && (
          <FundamentalAnalysis isMobile={isMobile} />
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
          <p>Built with ❤️ for financial data enthusiasts</p>
          <p style={{ marginTop: '8px' }}>
            {((dataSource === 'margin' && metadata) || (dataSource === 'aaii' && aaiiMetadata)) && (
              <a
                href={dataSource === 'margin' ? metadata?.sourceUrl : aaiiMetadata?.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent-cyan)', textDecoration: 'none', transition: 'color var(--transition-fast)' }}
                onMouseEnter={(e) => e.target.style.color = 'var(--accent-blue)'}
                onMouseLeave={(e) => e.target.style.color = 'var(--accent-cyan)'}
              >
                Data Source: {dataSource === 'margin' ? metadata?.source : aaiiMetadata?.source}
              </a>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
