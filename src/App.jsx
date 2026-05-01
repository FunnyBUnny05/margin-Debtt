import React, { useState, useEffect } from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart, Bar, Cell } from 'recharts';
import { SectorZScore } from './components/SectorZScore';
import { BuffettIndicator } from './components/BuffettIndicator';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CORS_PROXIES } from './components/SectorZScore/utils/corsProxies';
import { SofrRate } from './components/SofrRate';
import { PpiIndex } from './components/PpiIndex';
import { ExportCsvButton } from './components/ExportCsvButton';
import { FearGreedIndex } from './components/FearGreedIndex';
import { SourceLink } from './components/SourceLink';

const FINRA_CSV_URL = 'https://www.finra.org/sites/default/files/2021-03/margin-statistics.csv';

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

const ChartToggle = ({ type, setType }) => (
    <div style={{ display: 'flex', background: 'var(--bb-black)', border: '1px solid var(--bb-border)', overflow: 'hidden', borderRadius: '2px' }}>
      <button
        onClick={() => setType('line')}
        style={{
          background: type === 'line' ? 'var(--bb-border-light)' : 'transparent',
          color: type === 'line' ? 'var(--bb-white)' : 'var(--bb-gray-2)',
          border: 'none', padding: '4px 10px', fontSize: '10px', fontFamily: 'var(--font-mono)', cursor: 'pointer', fontWeight: '700'
        }}
      >
        LINE
      </button>
      <button
        onClick={() => setType('bar')}
        style={{
          background: type === 'bar' ? 'var(--bb-border-light)' : 'transparent',
          color: type === 'bar' ? 'var(--bb-white)' : 'var(--bb-gray-2)',
          border: 'none', padding: '4px 10px', fontSize: '10px', fontFamily: 'var(--font-mono)', cursor: 'pointer', fontWeight: '700'
        }}
      >
        BAR
      </button>
    </div>
);

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
          } catch {
          }
        }

        const res = await fetch('./margin_data.json');
        if (!res.ok) throw new Error('Failed to load margin data');
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
      if (point.yoy_growth == null || !isFinite(point.yoy_growth)) return;

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
        <div className="bb-panel" style={{ margin: isMobile ? '8px' : '16px 0', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div className="bb-topbar-brand" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '0%', background: 'var(--bb-royal)' }}></div>
            <span style={{ fontFamily: 'var(--font-ui)', fontWeight: '800', fontSize: '18px', color: 'var(--bb-navy)', letterSpacing: '1.5px' }}>STOCK</span>
            <span style={{ fontFamily: 'var(--font-ui)', fontWeight: '300', fontSize: '18px', color: 'var(--bb-royal)', letterSpacing: '1px' }}>SENTINEL</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontWeight: '600', fontSize: '12px', color: 'var(--bb-gray-2)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                {dataSource === 'margin' ? 'FINRA Margin Debt Tracker' : dataSource === 'aaii' ? 'AAII Asset Allocation Survey' : dataSource === 'sectors' ? 'Sector Z-Score Dashboard' : dataSource === 'sofr' ? 'Secured Overnight Financing Rate' : dataSource === 'ppi' ? 'Producer Price Index' : dataSource === 'fear_greed' ? 'Fear & Greed Index' : 'Buffett Indicator'}
              </span>
              {((dataSource === 'margin' && metadata) || (dataSource === 'aaii' && aaiiMetadata)) && (
                <span className="bb-topbar-date" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--bb-gray-3)' }}>
                  UPDATED: {formatLastUpdated(dataSource === 'margin' ? metadata?.lastUpdated : aaiiMetadata?.lastUpdated)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mobile-scroll" style={{ display: 'flex', gap: '8px', marginBottom: '20px', padding: isMobile ? '0 8px' : '0', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {[
            { key: 'margin',  label: isMobile ? 'MARGIN'  : 'MARGIN DEBT' },
            { key: 'aaii',    label: isMobile ? 'AAII'    : 'AAII SURVEY' },
            { key: 'sectors', label: isMobile ? 'SECTORS' : 'SECTOR Z-SCORE' },
            { key: 'buffett', label: isMobile ? 'BUFFETT' : 'BUFFETT IND' },
            { key: 'sofr',    label: isMobile ? 'SOFR'    : 'SOFR RATE' },
            { key: 'ppi',     label: isMobile ? 'PPI'     : 'PPI INDEX' },
            { key: 'fear_greed', label: isMobile ? 'F&G' : 'FEAR & GREED' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setDataSource(key)}
              className={`bb-tab ${dataSource === key ? 'active' : ''}`}
              style={{ flexShrink: 0 }}
            >
              {label}
            </button>
          ))}
        </div>

        {dataSource !== 'sectors' && dataSource !== 'buffett' && dataSource !== 'sofr' && dataSource !== 'ppi' && dataSource !== 'fear_greed' && (
          <div className="mobile-scroll" style={{ display: 'flex', gap: '8px', marginBottom: '20px', padding: isMobile ? '0 8px' : '0', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {['2y', '5y', '10y', 'all'].map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`bb-tab ${timeRange === range ? 'active' : ''}`}
                style={{ padding: '6px 16px', fontSize: '12px', flexShrink: 0 }}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {dataSource === 'margin' && (
          <>
            <div className="responsive-grid" style={{ marginBottom: '16px', marginTop: '8px' }}>
              <div className="stat-card" style={{ borderTop: '3px solid var(--bb-royal)' }}>
                <div style={{ fontFamily: 'var(--font-ui)', color: 'var(--bb-gray-2)', fontSize: '11px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  CURRENT ({currentDebt.date})
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '28px' : '32px', fontWeight: '600', color: 'var(--bb-white)' }}>
                  ${currentDebt.margin_debt_bn.toFixed(0)}B
                </div>
              </div>
              <div className="stat-card" style={{ borderTop: `3px solid ${currentDebt.yoy_growth > 0 ? 'var(--bb-red)' : 'var(--bb-green)'}` }}>
                <div style={{ fontFamily: 'var(--font-ui)', color: currentDebt.yoy_growth > 0 ? 'var(--bb-red)' : 'var(--bb-green)', fontSize: '11px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  YOY GROWTH
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '28px' : '32px', fontWeight: '600', color: 'var(--bb-white)' }}>
                  {currentDebt.yoy_growth != null ? `${currentDebt.yoy_growth > 0 ? '+' : ''}${currentDebt.yoy_growth.toFixed(1)}%` : 'N/A'}
                </div>
              </div>
              <div className="stat-card" style={{ borderTop: '3px solid var(--bb-yellow)' }}>
                <div style={{ fontFamily: 'var(--font-ui)', color: 'var(--bb-yellow)', fontSize: '11px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  VS 2021 PEAK
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '28px' : '32px', fontWeight: '600', color: 'var(--bb-white)' }}>
                  {currentDebt.margin_debt >= peak2021.margin_debt ? '+' : ''}{((currentDebt.margin_debt / peak2021.margin_debt - 1) * 100).toFixed(0)}%
                </div>
              </div>
              <div className="stat-card" style={{ borderTop: '3px solid var(--bb-purple)' }}>
                <div style={{ fontFamily: 'var(--font-ui)', color: 'var(--bb-purple)', fontSize: '11px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  VS 2000 PEAK
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '28px' : '32px', fontWeight: '600', color: 'var(--bb-white)' }}>
                  {currentDebt.margin_debt >= peak2000.margin_debt ? '+' : ''}{((currentDebt.margin_debt / peak2000.margin_debt - 1) * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            <div className="glass-card animate-in" style={{ padding: '0', marginBottom: '20px' }}>
              <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>MARGIN DEBT OVER TIME</span>
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
              <div style={{ padding: isMobile ? '16px 8px' : '24px 16px' }}>
              <ResponsiveContainer width="100%" height={isMobile ? 220 : 320}>
                <ComposedChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="marginGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--bb-royal)" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="var(--bb-royal)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="1 3" stroke="var(--bb-border-light)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="var(--bb-gray-3)"
                    tick={{ fill: 'var(--bb-gray-2)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                    tickFormatter={formatDate}
                    interval={chartInterval}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="var(--bb-gray-3)"
                    tick={{ fill: 'var(--bb-gray-2)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                    tickFormatter={(v) => `$${v}B`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {marginMainType === 'line' ? (
                    <Area
                      type="monotone"
                      dataKey="margin_debt_bn"
                      stroke="var(--bb-royal)"
                      strokeWidth={3}
                      fill="url(#marginGradient)"
                      name="Margin Debt"
                    />
                  ) : (
                    <Bar dataKey="margin_debt_bn" fill="var(--bb-royal)" radius={[4, 4, 0, 0]} name="Margin Debt" />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-card animate-in" style={{ padding: '0', marginBottom: '20px', animationDelay: '100ms' }}>
              <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--bb-purple)' }}>
                <span>YEAR-OVER-YEAR GROWTH RATE</span>
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
              <div style={{ padding: isMobile ? '16px 8px' : '24px 16px' }}>
              <ResponsiveContainer width="100%" height={isMobile ? 200 : 260}>
                <ComposedChart data={filteredData.filter(d => d.yoy_growth !== null)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="1 3" stroke="var(--bb-border-light)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="var(--bb-gray-3)"
                    tick={{ fill: 'var(--bb-gray-2)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                    tickFormatter={formatDate}
                    interval={chartInterval}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="var(--bb-border-light)"
                    tick={{ fill: 'var(--bb-gray-2)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="var(--bb-border)" strokeWidth={1} />
                  <ReferenceLine y={30} stroke="var(--bb-red)" strokeDasharray="4 4" strokeOpacity={0.8} label={{ value: '+30%', fill: 'var(--bb-red)', fontSize: 9 }} />
                  <ReferenceLine y={-30} stroke="var(--bb-green)" strokeDasharray="4 4" strokeOpacity={0.8} label={{ value: '-30%', fill: 'var(--bb-green)', fontSize: 9 }} />
                  {marginYoyType === 'line' ? (
                    <Line
                      type="monotone"
                      dataKey="yoy_growth"
                      stroke="var(--bb-yellow)"
                      strokeWidth={2}
                      dot={false}
                      name="YoY Growth"
                    />
                  ) : (
                    <Bar dataKey="yoy_growth" fill="var(--bb-yellow)" name="YoY Growth" />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '10px', flexWrap: 'wrap', fontFamily: 'var(--font-mono)' }}>
                <div className="badge badge-warning">+30% EUPHORIA ZONE</div>
                <div className="badge badge-success">-30% CAPITULATION ZONE</div>
              </div>
              </div>
            </div>

            <div className="glass-card animate-in" style={{ padding: '0', marginBottom: '20px', animationDelay: '200ms', borderLeft: '3px solid var(--bb-yellow)' }}>
              <div style={{ padding: isMobile ? '16px' : '20px' }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontWeight: '700', color: 'var(--bb-yellow)', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>HISTORICAL PATTERN</div>
                <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--bb-gray-1)', fontSize: '13px', lineHeight: '1.6' }}>
                  Sustained 30%+ YoY margin debt growth has preceded every major market correction.
                  2000 peak (+80% YoY) &rarr; dot-com crash. 2007 peak (+62% YoY) &rarr; financial crisis.
                  2021 peak (+71% YoY) &rarr; 2022 bear market.
                </p>
              </div>
            </div>

            <div className="glass-card animate-in" style={{ padding: '0', marginBottom: '20px', animationDelay: '300ms' }}>
              <div className="bb-panel-header">THRESHOLD DURATION STATISTICS</div>
              <div style={{ padding: isMobile ? '16px' : '24px' }}>

              <div className="glass-card" style={{
                marginBottom: '20px',
                padding: '16px 20px',
                background: thresholdStats.current.status === 'above30' ? 'rgba(251, 113, 133, 0.1)' :
                            thresholdStats.current.status === 'belowNeg30' ? 'rgba(52, 211, 153, 0.1)' :
                            'rgba(255, 255, 255, 0.02)',
                borderLeft: thresholdStats.current.status === 'above30' ? '3px solid var(--bb-red)' :
                        thresholdStats.current.status === 'belowNeg30' ? '3px solid var(--bb-green)' :
                        '3px solid var(--bb-border-light)'
              }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: '700', marginBottom: '12px', color: 'var(--bb-yellow)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  CURRENT STATUS
                </div>
                {thresholdStats.current.status === 'above30' ? (
                  <div className="badge badge-warning">
                    <span>ABOVE +30% THRESHOLD</span>
                    <span style={{ marginLeft: '8px', color: 'var(--bb-white)' }}>
                      DUR: {formatDuration(thresholdStats.current.duration)} | YOY: {thresholdStats.current.yoyGrowth?.toFixed(1)}%
                    </span>
                  </div>
                ) : thresholdStats.current.status === 'belowNeg30' ? (
                  <div className="badge badge-success">
                    <span>BELOW -30% THRESHOLD</span>
                    <span style={{ marginLeft: '8px', color: 'var(--bb-white)' }}>
                      DUR: {formatDuration(thresholdStats.current.duration)} | YOY: {thresholdStats.current.yoyGrowth?.toFixed(1)}%
                    </span>
                  </div>
                ) : (
                  <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--bb-gray-2)', fontSize: '13px' }}>
                    <span style={{ color: 'var(--bb-gray-1)', fontWeight: '700' }}>NEUTRAL ZONE</span>
                    <span style={{ marginLeft: '12px' }}>
                      YOY: {thresholdStats.current.yoyGrowth?.toFixed(1)}% (between -30% and +30%)
                    </span>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '16px' }}>
                <div className="glass-card" style={{ padding: '16px 20px', borderTop: '3px solid var(--bb-red)' }}>
                  <div className="badge badge-warning" style={{ marginBottom: '16px' }}>
                    ABOVE +30% (EUPHORIA)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-ui)', color: 'var(--bb-gray-2)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>AVG DURATION</div>
                      <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--bb-white)', fontSize: '20px', fontWeight: '700' }}>
                        {formatDuration(thresholdStats.above30.avgMonths)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontFamily: 'var(--font-ui)', color: 'var(--bb-gray-2)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>OCCURRENCES</div>
                      <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--bb-white)', fontSize: '18px', fontWeight: '600' }}>
                        {thresholdStats.above30.occurrences}
                      </div>
                    </div>
                    {thresholdStats.above30.periods.length > 0 && (
                      <div style={{ paddingTop: '12px', borderTop: '1px solid var(--bb-border)' }}>
                        <div style={{ fontFamily: 'var(--font-ui)', color: 'var(--bb-gray-3)', fontSize: '11px', textTransform: 'uppercase', marginBottom: '6px' }}>PERIOD DURATIONS (MO):</div>
                        <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--bb-gray-2)', fontSize: '12px' }}>
                          {thresholdStats.above30.periods.join(', ')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="glass-card" style={{ padding: '16px 20px', borderTop: '3px solid var(--bb-green)' }}>
                  <div className="badge badge-success" style={{ marginBottom: '16px' }}>
                    BELOW -30% (CAPITULATION)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-ui)', color: 'var(--bb-gray-2)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>AVG DURATION</div>
                      <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--bb-white)', fontSize: '20px', fontWeight: '700' }}>
                        {formatDuration(thresholdStats.belowNeg30.avgMonths)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontFamily: 'var(--font-ui)', color: 'var(--bb-gray-2)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>OCCURRENCES</div>
                      <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--bb-white)', fontSize: '18px', fontWeight: '600' }}>
                        {thresholdStats.belowNeg30.occurrences}
                      </div>
                    </div>
                    {thresholdStats.belowNeg30.periods.length > 0 && (
                      <div style={{ paddingTop: '12px', borderTop: '1px solid var(--bb-border)' }}>
                        <div style={{ fontFamily: 'var(--font-ui)', color: 'var(--bb-gray-3)', fontSize: '11px', textTransform: 'uppercase', marginBottom: '6px' }}>PERIOD DURATIONS (MO):</div>
                        <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--bb-gray-2)', fontSize: '12px' }}>
                          {thresholdStats.belowNeg30.periods.join(', ')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '16px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--bb-gray-3)', textAlign: 'center' }}>
                Statistics calculated from all available historical data. Each period = consecutive months where YoY growth remained above/below threshold.
              </div>
              </div>
            </div>

            <SourceLink
              href={metadata?.sourceUrl || 'https://www.finra.org/investors/learn-to-invest/advanced-investing/margin-statistics'}
              label="FINRA Margin Statistics"
            />
          </>
        )}

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
                  <div className="responsive-grid" style={{ marginBottom: '16px', marginTop: '8px' }}>
                    <div className="stat-card" style={{ borderTop: '3px solid var(--bb-royal)' }}>
                      <div style={{ fontFamily: 'var(--font-ui)', color: 'var(--bb-gray-2)', fontSize: '11px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        STOCKS ({currentAllocation?.date})
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '28px' : '32px', fontWeight: '600', color: 'var(--bb-white)' }}>
                        {currentAllocation?.stocks?.toFixed(1) || 'N/A'}%
                      </div>
                    </div>
                    <div className="stat-card" style={{ borderTop: '3px solid var(--bb-yellow)' }}>
                      <div style={{ fontFamily: 'var(--font-ui)', color: 'var(--bb-yellow)', fontSize: '11px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        BONDS
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '28px' : '32px', fontWeight: '600', color: 'var(--bb-white)' }}>
                        {currentAllocation?.bonds?.toFixed(1) || 'N/A'}%
                      </div>
                    </div>
                    <div className="stat-card" style={{ borderTop: '3px solid var(--bb-green)' }}>
                      <div style={{ fontFamily: 'var(--font-ui)', color: 'var(--bb-green)', fontSize: '11px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        CASH
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '28px' : '32px', fontWeight: '600', color: 'var(--bb-white)' }}>
                        {currentAllocation?.cash?.toFixed(1) || 'N/A'}%
                      </div>
                    </div>
                  </div>

                  <div className="glass-card animate-in" style={{ padding: '0', marginBottom: '20px', animationDelay: '100ms' }}>
                    <div className="bb-panel-header">HISTORICAL AVERAGE (SINCE 1987)</div>
                    <div style={{ padding: '16px 20px' }}>
                    <div className="responsive-grid" style={{ gap: '16px' }}>
                      <div className="glass-card" style={{ padding: '16px 20px', borderTop: '3px solid var(--bb-cyan)' }}>
                        <div style={{ fontFamily: 'var(--font-ui)', color: 'var(--bb-gray-2)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>AVG STOCKS</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: '700', color: 'var(--bb-white)' }}>{avgStocks.toFixed(1)}%</div>
                      </div>
                      <div className="glass-card" style={{ padding: '16px 20px', borderTop: '3px solid var(--bb-yellow)' }}>
                        <div style={{ fontFamily: 'var(--font-ui)', color: 'var(--bb-gray-2)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>AVG BONDS</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: '700', color: 'var(--bb-white)' }}>{avgBonds.toFixed(1)}%</div>
                      </div>
                      <div className="glass-card" style={{ padding: '16px 20px', borderTop: '3px solid var(--bb-green)' }}>
                        <div style={{ fontFamily: 'var(--font-ui)', color: 'var(--bb-gray-2)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>AVG CASH</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: '700', color: 'var(--bb-white)' }}>{avgCash.toFixed(1)}%</div>
                      </div>
                    </div>
                    </div>
                  </div>

                  <div className="glass-card animate-in" style={{ padding: '0', marginBottom: '20px', animationDelay: '200ms' }}>
                    <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>ASSET ALLOCATION OVER TIME</span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <ExportCsvButton
                          data={aaiiFilteredData}
                          filename="aaii_allocation"
                          columns={[
                            { key: 'date', label: 'Date' },
                            { key: 'stocks', label: 'Stocks (%)' },
                            { key: 'bonds', label: 'Bonds (%)' },
                            { key: 'cash', label: 'Cash (%)' },
                          ]}
                        />
                        <ChartToggle type={aaiiAllocType} setType={setAaiiAllocType} />
                      </div>
                    </div>
                    <div style={{ padding: isMobile ? '16px 8px' : '24px 16px' }}>
                    <ResponsiveContainer width="100%" height={isMobile ? 240 : 340}>
                      <ComposedChart data={aaiiFilteredData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="stocksGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--bb-royal)" stopOpacity={0.15}/>
                            <stop offset="95%" stopColor="var(--bb-royal)" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="bondsGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--bb-yellow)" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="var(--bb-yellow)" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--bb-green)" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="var(--bb-green)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="1 3" stroke="var(--bb-border-light)" vertical={false} />
                        <XAxis
                          dataKey="date"
                          stroke="var(--bb-gray-3)"
                          tick={{ fill: 'var(--bb-gray-2)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                          tickFormatter={formatDate}
                          interval={aaiiChartInterval}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          stroke="var(--bb-gray-3)"
                          tick={{ fill: 'var(--bb-gray-2)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                          tickFormatter={(v) => `${v}%`}
                          domain={[0, 100]}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        {aaiiAllocType === 'line' ? (
                          <>
                            <Area type="monotone" dataKey="stocks" stroke="var(--bb-royal)" strokeWidth={3} fill="url(#stocksGradient)" name="Stocks" />
                            <Area type="monotone" dataKey="bonds" stroke="var(--bb-yellow)" strokeWidth={3} fill="url(#bondsGradient)" name="Bonds" />
                            <Area type="monotone" dataKey="cash" stroke="var(--bb-green)" strokeWidth={3} fill="url(#cashGradient)" name="Cash" />
                          </>
                        ) : (
                          <>
                            <Bar dataKey="stocks" fill="var(--bb-royal)" name="Stocks" stackId="alloc" />
                            <Bar dataKey="bonds" fill="var(--bb-yellow)" name="Bonds" stackId="alloc" />
                            <Bar dataKey="cash" fill="var(--bb-green)" name="Cash" stackId="alloc" />
                          </>
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                      <div className="badge badge-info">STOCKS</div>
                      <div className="badge badge-warning">BONDS</div>
                      <div className="badge badge-success">CASH</div>
                    </div>
                    </div>
                  </div>

                  <div className="glass-card animate-in" style={{ padding: '0', marginBottom: '20px', animationDelay: '300ms' }}>
                    <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>STOCK ALLOCATION SPREAD (% STOCKS − % CASH)</span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <ExportCsvButton
                          data={aaiiFilteredData.map(d => ({ date: d.date, stocks_pct: d.stocks, cash_pct: d.cash, spread_pct: (d.stocks || 0) - (d.cash || 0) }))}
                          filename="aaii_spread"
                          columns={[
                            { key: 'date', label: 'Date' },
                            { key: 'stocks_pct', label: 'Stocks (%)' },
                            { key: 'cash_pct', label: 'Cash (%)' },
                            { key: 'spread_pct', label: 'Spread Stock-Cash (%)' },
                          ]}
                        />
                        <ChartToggle type={aaiiSpreadType} setType={setAaiiSpreadType} />
                      </div>
                    </div>
                    <div style={{ padding: isMobile ? '16px 8px' : '24px 16px' }}>
                    <ResponsiveContainer width="100%" height={isMobile ? 200 : 260}>
                      <ComposedChart
                        data={aaiiFilteredData.map(d => ({ ...d, spread: (d.stocks || 0) - (d.cash || 0) }))}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="1 3" stroke="var(--bb-border-light)" vertical={false} />
                        <XAxis
                          dataKey="date"
                          stroke="var(--bb-gray-3)"
                          tick={{ fill: 'var(--bb-gray-2)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                          tickFormatter={formatDate}
                          interval={aaiiChartInterval}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          stroke="var(--bb-gray-3)"
                          tick={{ fill: 'var(--bb-gray-2)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                          tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <ReferenceLine y={0} stroke="var(--bb-gray-4)" />
                        <ReferenceLine y={40} stroke="var(--bb-red)" strokeDasharray="3 3" label={{ value: '+40% Extreme Bull', fill: 'var(--bb-red)', fontSize: 9 }} />
                        <ReferenceLine y={10} stroke="var(--bb-green)" strokeDasharray="3 3" label={{ value: '+10% Bear Signal', fill: 'var(--bb-green)', fontSize: 9 }} />
                        {aaiiSpreadType === 'line' ? (
                          <Line type="monotone" dataKey="spread" stroke="var(--bb-purple)" strokeWidth={3} dot={false} name="Spread (Stock − Cash)" />
                        ) : (
                          <Bar dataKey="spread" name="Spread (Stock − Cash)">
                            {aaiiFilteredData.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={((entry.stocks || 0) - (entry.cash || 0)) > 40 ? 'var(--bb-red)' : ((entry.stocks || 0) - (entry.cash || 0)) < 10 ? 'var(--bb-green)' : 'var(--bb-purple)'}
                              />
                            ))}
                          </Bar>
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                      <div className="badge badge-warning" style={{ background: 'rgba(251, 113, 133, 0.1)', color: 'var(--bb-red)', borderColor: 'rgba(251, 113, 133, 0.2)' }}>EXTREME BULL (&gt;+40%)</div>
                      <div className="badge" style={{ background: 'rgba(167, 139, 250, 0.1)', color: 'var(--bb-purple)', border: '1px solid rgba(167, 139, 250, 0.2)' }}>NEUTRAL</div>
                      <div className="badge badge-success" style={{ background: 'rgba(52, 211, 153, 0.1)', color: 'var(--bb-green)', borderColor: 'rgba(52, 211, 153, 0.2)' }}>BEAR SIGNAL (&lt;+10%)</div>
                    </div>
                    </div>
                  </div>

                  <div className="glass-card animate-in" style={{ padding: '0', marginBottom: '20px', animationDelay: '400ms', borderLeft: '3px solid var(--bb-cyan)' }}>
                    <div style={{ padding: isMobile ? '16px' : '20px' }}>
                      <div style={{ fontFamily: 'var(--font-ui)', fontWeight: '700', color: 'var(--bb-cyan)', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>ABOUT AAII ASSET ALLOCATION</div>
                      <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--bb-gray-1)', fontSize: '13px', lineHeight: '1.6' }}>
                        The AAII Asset Allocation Survey tracks how individual investors allocate their portfolios among stocks, bonds, and cash.
                        Extreme allocations to stocks often signal euphoria, while high cash levels may indicate fear or caution in the markets.
                      </p>
                    </div>
                  </div>

                  <SourceLink
                    href={aaiiMetadata?.sourceUrl || 'https://www.aaii.com/'}
                    label="AAII Asset Allocation Survey"
                  />
                </>
              );
            })()}
          </>
        )}

        {dataSource === 'aaii' && aaiiRawData.length === 0 && (
          <div className="glass-card" style={{ padding: '40px 24px', textAlign: 'center', marginTop: '20px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', color: 'var(--bb-yellow)', marginBottom: '16px', letterSpacing: '2px', fontWeight: '700' }}>NO DATA</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '16px', fontWeight: '700', color: 'var(--bb-white)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              No AAII Data Available
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--bb-gray-3)', fontSize: '14px' }}>
              Please provide the AAII allocation data to display charts.
            </div>
          </div>
        )}

        {dataSource === 'sectors' && (
          <ErrorBoundary>
            <SectorZScore isMobile={isMobile} />
          </ErrorBoundary>
        )}

        {dataSource === 'buffett' && (
          <ErrorBoundary>
            <BuffettIndicator isMobile={isMobile} />
          </ErrorBoundary>
        )}

        {dataSource === 'sofr' && (
          <ErrorBoundary>
            <SofrRate isMobile={isMobile} />
          </ErrorBoundary>
        )}

        {dataSource === 'ppi' && (
          <ErrorBoundary>
            <PpiIndex isMobile={isMobile} />
          </ErrorBoundary>
        )}

        {dataSource === 'fear_greed' && (
          <ErrorBoundary>
            <FearGreedIndex isMobile={isMobile} />
          </ErrorBoundary>
        )}

        <div className="app-footer" style={{ borderTop: '1px solid var(--bb-border-light)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', background: 'var(--bb-black)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--bb-gray-3)', fontSize: '10px', letterSpacing: '0.5px' }}>
            © {new Date().getFullYear()} STOCK SENTINEL. ALL RIGHTS RESERVED.
          </span>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--bb-gray-4)', fontSize: '10px' }}>v1.0.0</span>
            <a 
              href="https://github.com/FunnyBunny05" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--bb-gray-3)', fontSize: '10px', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={(e) => e.target.style.color = 'var(--bb-yellow)'}
              onMouseLeave={(e) => e.target.style.color = 'var(--bb-gray-3)'}
            >
              GITHUB
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
