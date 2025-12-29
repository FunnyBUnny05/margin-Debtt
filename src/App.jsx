import React, { useState, useEffect } from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart } from 'recharts';

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

const fetchWithTimeout = (url, timeoutMs = 12000) => {
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
  const [dataSource, setDataSource] = useState('margin');
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 640);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 640);
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
        const { promise, controller } = fetchWithTimeout('https://www.finra.org/sites/default/files/Industry_Margin_Statistics.csv');
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
        const res = await fetch('./margin_data.json');
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

  if (loading) {
    return (
      <div style={{ background: '#0d0d1a', color: '#e0e0e0', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>Loading live data...</div>
          <div style={{ color: '#888' }}>Fetching FINRA margin statistics</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: '#0d0d1a', color: '#ef4444', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>Error Loading Data</div>
          <div>{error}</div>
        </div>
      </div>
    );
  }

  if (!rawData.length) {
    return (
      <div style={{ background: '#0d0d1a', color: '#ef4444', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>Unable to load margin data</div>
          <div>No FINRA data available right now.</div>
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
    <div style={{ background: '#0d0d1a', color: '#e0e0e0', padding: isMobile ? '16px' : '20px', minHeight: '100vh', fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: isMobile ? '720px' : '1200px', width: '100%', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'center' : 'flex-start', marginBottom: '8px', gap: isMobile ? '12px' : '0', flexDirection: isMobile ? 'column' : 'row', textAlign: isMobile ? 'center' : 'left' }}>
          <div style={{ width: '100%' }}>
            <h1 style={{ fontSize: '24px', marginBottom: '8px', color: '#fff' }}>
              {dataSource === 'margin' ? 'FINRA Margin Debt Tracker' : 'AAII Asset Allocation Survey'}
            </h1>
            <p style={{ color: '#888', marginBottom: '4px' }}>
              {dataSource === 'margin' ? 'Securities margin account debit balances ($ billions)' : 'Individual investor asset allocation (%)'}
            </p>
          </div>
          {((dataSource === 'margin' && metadata) || (dataSource === 'aaii' && aaiiMetadata)) && (
            <div style={{ textAlign: isMobile ? 'center' : 'right', fontSize: '12px', color: '#666', width: '100%' }}>
              <div>Last updated: {formatLastUpdated(dataSource === 'margin' ? metadata?.lastUpdated : aaiiMetadata?.lastUpdated)}</div>
              <a href={dataSource === 'margin' ? metadata?.sourceUrl : aaiiMetadata?.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
                Source: {dataSource === 'margin' ? metadata?.source : aaiiMetadata?.source}
              </a>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-start' }}>
          <button
            onClick={() => setDataSource('margin')}
            style={{
              padding: '8px 20px',
              background: dataSource === 'margin' ? '#ef4444' : '#1a1a2e',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            FINRA Margin Debt
          </button>
          <button
            onClick={() => setDataSource('aaii')}
            style={{
              padding: '8px 20px',
              background: dataSource === 'aaii' ? '#3b82f6' : '#1a1a2e',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            AAII Allocation
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-start' }}>
          {['2y', '5y', '10y', 'all'].map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              style={{
                padding: '6px 16px',
                background: timeRange === range ? '#3b82f6' : '#1a1a2e',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
            {range.toUpperCase()}
          </button>
          ))}
        </div>

        {dataSource === 'margin' && (
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
        )}

        {dataSource === 'margin' && (
          <div style={{ background: '#1a1a2e', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '16px', marginBottom: '16px', color: '#fff' }}>Margin Debt Over Time</h2>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={filteredData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="marginGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="date"
                stroke="#666"
                tick={{ fill: '#888', fontSize: 11 }}
                tickFormatter={formatDate}
                interval={chartInterval}
              />
              <YAxis
                stroke="#666"
                tick={{ fill: '#888', fontSize: 11 }}
                tickFormatter={(v) => `$${v}B`}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="margin_debt_bn"
                stroke="#ef4444"
                fill="url(#marginGradient)"
                name="Margin Debt"
              />
              <Line
                type="monotone"
                dataKey="margin_debt_bn"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                name="Margin Debt"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        )}

        {dataSource === 'margin' && (
          <div style={{ background: '#1a1a2e', borderRadius: '8px', padding: '20px' }}>
            <h2 style={{ fontSize: '16px', marginBottom: '16px', color: '#fff' }}>Year-over-Year Growth Rate</h2>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={filteredData.filter(d => d.yoy_growth !== null)} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="date"
                stroke="#666"
                tick={{ fill: '#888', fontSize: 11 }}
                tickFormatter={formatDate}
                interval={chartInterval}
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
        )}

        {dataSource === 'margin' && (
          <div style={{ marginTop: '20px', padding: '16px', background: '#1a1a2e', borderRadius: '8px', fontSize: '13px', color: '#888', textAlign: isMobile ? 'center' : 'left' }}>
            <strong style={{ color: '#f59e0b' }}>Historical pattern:</strong> Sustained 30%+ YoY margin debt growth has preceded every major market correction.
            2000 peak (+80% YoY) → dot-com crash. 2007 peak (+62% YoY) → financial crisis. 2021 peak (+71% YoY) → 2022 bear market.
          </div>
        )}

        {dataSource === 'margin' && (
          <div style={{ marginTop: '20px', background: '#1a1a2e', borderRadius: '8px', padding: '20px' }}>
            <h2 style={{ fontSize: '16px', marginBottom: '16px', color: '#fff' }}>Threshold Duration Statistics</h2>

          <div style={{ marginBottom: '20px', padding: '16px', background: thresholdStats.current.status === 'above30' ? '#ef44441a' : thresholdStats.current.status === 'belowNeg30' ? '#22c55e1a' : '#0d0d1a', borderRadius: '8px', border: thresholdStats.current.status === 'above30' ? '2px solid #ef4444' : thresholdStats.current.status === 'belowNeg30' ? '2px solid #22c55e' : '1px solid #333' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#fff' }}>Current Status</div>
            {thresholdStats.current.status === 'above30' ? (
              <div>
                <div style={{ color: '#ef4444', fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' }}>
                  🔴 Above +30% Threshold
                </div>
                <div style={{ color: '#aaa', fontSize: '14px' }}>
                  Duration: <span style={{ color: '#fff', fontWeight: 'bold' }}>{formatDuration(thresholdStats.current.duration)}</span>
                </div>
                <div style={{ color: '#888', fontSize: '12px', marginTop: '4px' }}>
                  Current YoY Growth: {thresholdStats.current.yoyGrowth?.toFixed(1)}%
                </div>
              </div>
            ) : thresholdStats.current.status === 'belowNeg30' ? (
              <div>
                <div style={{ color: '#22c55e', fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' }}>
                  🟢 Below -30% Threshold
                </div>
                <div style={{ color: '#aaa', fontSize: '14px' }}>
                  Duration: <span style={{ color: '#fff', fontWeight: 'bold' }}>{formatDuration(thresholdStats.current.duration)}</span>
                </div>
                <div style={{ color: '#888', fontSize: '12px', marginTop: '4px' }}>
                  Current YoY Growth: {thresholdStats.current.yoyGrowth?.toFixed(1)}%
                </div>
              </div>
            ) : (
              <div>
                <div style={{ color: '#888', fontSize: '16px' }}>No - Currently in neutral zone</div>
                <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
                  Current YoY Growth: {thresholdStats.current.yoyGrowth?.toFixed(1)}% (between -30% and +30%)
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '16px' }}>
            <div style={{ background: '#0d0d1a', padding: '16px', borderRadius: '8px', border: '1px solid #ef444433' }}>
              <div style={{ color: '#ef4444', fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>🔴 Above +30% Threshold (Euphoria)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#888', fontSize: '13px' }}>Average duration:</span>
                  <span style={{ color: '#fff', fontSize: '18px', fontWeight: 'bold' }}>
                    {formatDuration(thresholdStats.above30.avgMonths)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#888', fontSize: '13px' }}>Number of occurrences:</span>
                  <span style={{ color: '#fff', fontSize: '16px' }}>{thresholdStats.above30.occurrences}</span>
                </div>
                {thresholdStats.above30.periods.length > 0 && (
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #333' }}>
                    <div style={{ color: '#888', fontSize: '12px', marginBottom: '4px' }}>Duration of each period (months):</div>
                    <div style={{ color: '#aaa', fontSize: '12px' }}>
                      {thresholdStats.above30.periods.join(', ')}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ background: '#0d0d1a', padding: '16px', borderRadius: '8px', border: '1px solid #22c55e33' }}>
              <div style={{ color: '#22c55e', fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>🟢 Below -30% Threshold (Capitulation)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#888', fontSize: '13px' }}>Average duration:</span>
                  <span style={{ color: '#fff', fontSize: '18px', fontWeight: 'bold' }}>
                    {formatDuration(thresholdStats.belowNeg30.avgMonths)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#888', fontSize: '13px' }}>Number of occurrences:</span>
                  <span style={{ color: '#fff', fontSize: '16px' }}>{thresholdStats.belowNeg30.occurrences}</span>
                </div>
                {thresholdStats.belowNeg30.periods.length > 0 && (
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #333' }}>
                    <div style={{ color: '#888', fontSize: '12px', marginBottom: '4px' }}>Duration of each period (months):</div>
                    <div style={{ color: '#aaa', fontSize: '12px' }}>
                      {thresholdStats.belowNeg30.periods.join(', ')}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div style={{ marginTop: '12px', fontSize: '12px', color: '#666', fontStyle: 'italic', textAlign: isMobile ? 'center' : 'left' }}>
            Statistics calculated from all available historical data. Each period represents consecutive months where YoY growth remained above/below the threshold.
          </div>
        </div>
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

              // Calculate historical averages
              const avgStocks = aaiiData.reduce((sum, d) => sum + (d.stocks || 0), 0) / aaiiData.length;
              const avgBonds = aaiiData.reduce((sum, d) => sum + (d.bonds || 0), 0) / aaiiData.length;
              const avgCash = aaiiData.reduce((sum, d) => sum + (d.cash || 0), 0) / aaiiData.length;

              // Calculate min and max values
              const minStocks = Math.min(...aaiiData.map(d => d.stocks || Infinity));
              const maxStocks = Math.max(...aaiiData.map(d => d.stocks || -Infinity));
              const minBonds = Math.min(...aaiiData.map(d => d.bonds || Infinity));
              const maxBonds = Math.max(...aaiiData.map(d => d.bonds || -Infinity));
              const minCash = Math.min(...aaiiData.map(d => d.cash || Infinity));
              const maxCash = Math.max(...aaiiData.map(d => d.cash || -Infinity));

              return (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px', textAlign: isMobile ? 'center' : 'left' }}>
                    <div style={{ background: '#1a1a2e', padding: '16px', borderRadius: '8px' }}>
                      <div style={{ color: '#888', fontSize: '12px' }}>Stocks Allocation ({currentAllocation?.date})</div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>{currentAllocation?.stocks?.toFixed(1) || 'N/A'}%</div>
                    </div>
                    <div style={{ background: '#1a1a2e', padding: '16px', borderRadius: '8px' }}>
                      <div style={{ color: '#888', fontSize: '12px' }}>Bonds Allocation</div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>{currentAllocation?.bonds?.toFixed(1) || 'N/A'}%</div>
                    </div>
                    <div style={{ background: '#1a1a2e', padding: '16px', borderRadius: '8px' }}>
                      <div style={{ color: '#888', fontSize: '12px' }}>Cash Allocation</div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e' }}>{currentAllocation?.cash?.toFixed(1) || 'N/A'}%</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '14px', color: '#888', marginBottom: '12px', textAlign: isMobile ? 'center' : 'left' }}>Historical Average (Since 1987)</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, 1fr)', gap: '16px', textAlign: isMobile ? 'center' : 'left' }}>
                      <div style={{ background: '#0d0d1a', padding: '16px', borderRadius: '8px', border: '1px solid #3b82f633' }}>
                        <div style={{ color: '#888', fontSize: '12px' }}>Avg Stocks</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#3b82f6' }}>{avgStocks.toFixed(1)}%</div>
                      </div>
                      <div style={{ background: '#0d0d1a', padding: '16px', borderRadius: '8px', border: '1px solid #f59e0b33' }}>
                        <div style={{ color: '#888', fontSize: '12px' }}>Avg Bonds</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f59e0b' }}>{avgBonds.toFixed(1)}%</div>
                      </div>
                      <div style={{ background: '#0d0d1a', padding: '16px', borderRadius: '8px', border: '1px solid #22c55e33' }}>
                        <div style={{ color: '#888', fontSize: '12px' }}>Avg Cash</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#22c55e' }}>{avgCash.toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '14px', color: '#888', marginBottom: '12px', textAlign: isMobile ? 'center' : 'left' }}>Historical Extremes</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '16px' }}>
                      <div>
                        <h4 style={{ fontSize: '12px', color: '#666', marginBottom: '8px', textAlign: isMobile ? 'center' : 'left' }}>Lowest Allocations</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
                          <div style={{ background: '#0d0d1a', padding: '12px', borderRadius: '8px', border: '1px solid #3b82f622' }}>
                            <div style={{ color: '#888', fontSize: '11px' }}>Stocks</div>
                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#3b82f6' }}>{minStocks.toFixed(1)}%</div>
                          </div>
                          <div style={{ background: '#0d0d1a', padding: '12px', borderRadius: '8px', border: '1px solid #f59e0b22' }}>
                            <div style={{ color: '#888', fontSize: '11px' }}>Bonds</div>
                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f59e0b' }}>{minBonds.toFixed(1)}%</div>
                          </div>
                          <div style={{ background: '#0d0d1a', padding: '12px', borderRadius: '8px', border: '1px solid #22c55e22' }}>
                            <div style={{ color: '#888', fontSize: '11px' }}>Cash</div>
                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#22c55e' }}>{minCash.toFixed(1)}%</div>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 style={{ fontSize: '12px', color: '#666', marginBottom: '8px', textAlign: isMobile ? 'center' : 'left' }}>Highest Allocations</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
                          <div style={{ background: '#0d0d1a', padding: '12px', borderRadius: '8px', border: '1px solid #3b82f622' }}>
                            <div style={{ color: '#888', fontSize: '11px' }}>Stocks</div>
                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#3b82f6' }}>{maxStocks.toFixed(1)}%</div>
                          </div>
                          <div style={{ background: '#0d0d1a', padding: '12px', borderRadius: '8px', border: '1px solid #f59e0b22' }}>
                            <div style={{ color: '#888', fontSize: '11px' }}>Bonds</div>
                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f59e0b' }}>{maxBonds.toFixed(1)}%</div>
                          </div>
                          <div style={{ background: '#0d0d1a', padding: '12px', borderRadius: '8px', border: '1px solid #22c55e22' }}>
                            <div style={{ color: '#888', fontSize: '11px' }}>Cash</div>
                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#22c55e' }}>{maxCash.toFixed(1)}%</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ background: '#1a1a2e', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '16px', marginBottom: '16px', color: '#fff' }}>Asset Allocation Over Time</h2>
                    <ResponsiveContainer width="100%" height={350}>
                      <ComposedChart data={aaiiFilteredData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="stocksGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="bondsGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis
                          dataKey="date"
                          stroke="#666"
                          tick={{ fill: '#888', fontSize: 11 }}
                          tickFormatter={formatDate}
                          interval={aaiiChartInterval}
                        />
                        <YAxis
                          stroke="#666"
                          tick={{ fill: '#888', fontSize: 11 }}
                          tickFormatter={(v) => `${v}%`}
                          domain={[0, 100]}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="stocks"
                          stroke="#3b82f6"
                          fill="url(#stocksGradient)"
                          name="Stocks"
                        />
                        <Area
                          type="monotone"
                          dataKey="bonds"
                          stroke="#f59e0b"
                          fill="url(#bondsGradient)"
                          name="Bonds"
                        />
                        <Area
                          type="monotone"
                          dataKey="cash"
                          stroke="#22c55e"
                          fill="url(#cashGradient)"
                          name="Cash"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', gap: '24px', marginTop: '12px', fontSize: '12px', color: '#888', flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-start', textAlign: isMobile ? 'center' : 'left' }}>
                      <span style={{ color: '#3b82f6' }}>● Stocks</span>
                      <span style={{ color: '#f59e0b' }}>● Bonds</span>
                      <span style={{ color: '#22c55e' }}>● Cash</span>
                    </div>
                  </div>

                  <div style={{ marginTop: '20px', padding: '16px', background: '#1a1a2e', borderRadius: '8px', fontSize: '13px', color: '#888', textAlign: isMobile ? 'center' : 'left' }}>
                    <strong style={{ color: '#3b82f6' }}>About AAII Asset Allocation:</strong> The AAII Asset Allocation Survey tracks how individual investors allocate their portfolios among stocks, bonds, and cash.
                    Extreme allocations to stocks often signal euphoria, while high cash levels may indicate fear or caution in the markets.
                  </div>
                </>
              );
            })()}
          </>
        )}

        {dataSource === 'aaii' && aaiiRawData.length === 0 && (
          <div style={{ marginTop: '20px', padding: '40px', background: '#1a1a2e', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '18px', color: '#888', marginBottom: '12px' }}>No AAII Data Available</div>
            <div style={{ fontSize: '14px', color: '#666' }}>Please provide the AAII allocation data to display charts.</div>
          </div>
        )}
      </div>
    </div>
  );
}
