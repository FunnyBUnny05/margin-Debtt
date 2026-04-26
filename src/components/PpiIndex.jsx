import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Area
} from 'recharts';
import { ExportCsvButton } from './ExportCsvButton';

const ChartToggle = ({ type, setType }) => (
  <div style={{ display: 'flex', background: '#0B0F19', border: '1px solid #1F2937', overflow: 'hidden' }}>
    <button
      onClick={() => setType('line')}
      style={{
        background: type === 'line' ? '#4B5563' : 'transparent',
        color: type === 'line' ? '#F9FAFB' : '#6B7280',
        border: 'none', padding: '2px 8px', fontSize: '9px', fontFamily: 'var(--font-mono)', cursor: 'pointer', fontWeight: '700'
      }}
    >
      LINE
    </button>
    <button
      onClick={() => setType('bar')}
      style={{
        background: type === 'bar' ? '#4B5563' : 'transparent',
        color: type === 'bar' ? '#F9FAFB' : '#6B7280',
        border: 'none', padding: '2px 8px', fontSize: '9px', fontFamily: 'var(--font-mono)', cursor: 'pointer', fontWeight: '700'
      }}
    >
      BAR
    </button>
  </div>
);

const formatDate = (d) => {
  if (!d) return '';
  const [y, m] = d.split('-');
  return `${m}/${y.slice(2)}`;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip glass-card" style={{ padding: '12px 16px' }}>
      <p style={{ color: 'var(--text-primary)', margin: 0, fontWeight: 600, marginBottom: 8, fontSize: 14 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: '4px 0 0', fontSize: 13, fontWeight: 500 }}>
          {p.name}:{' '}
          {p.name === 'Index' ? p.value?.toFixed(3)
            : typeof p.value === 'number' ? `${p.value > 0 ? '+' : ''}${p.value?.toFixed(3)}%`
            : p.value}
        </p>
      ))}
    </div>
  );
};

// Colour a bar or value: red = inflationary, green = deflationary
const momColor = (v) => {
  if (v === null || v === undefined) return '#6B7280';
  if (v > 0.5) return '#EF4444';   // hot
  if (v > 0)   return '#F59E0B';   // warm
  if (v < 0)   return '#10B981';   // cool
  return '#6B7280';
};

const yoyColor = (v) => {
  if (v === null || v === undefined) return '#6B7280';
  if (v > 4)  return '#EF4444';
  if (v > 2)  return '#F59E0B';
  if (v < 0)  return '#10B981';
  return '#38BDF8';
};

export function PpiIndex({ isMobile }) {
  const [rawData, setRawData]     = useState({ unadj: [], adj: [] });
  const [metadata, setMetadata]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [timeRange, setTimeRange] = useState('5y');
  const [series, setSeries]       = useState('unadj'); // 'unadj' | 'adj'

  const [ppiMomType, setPpiMomType] = useState('bar');
  const [ppiYoyType, setPpiYoyType] = useState('line');
  const [ppiIndexType, setPpiIndexType] = useState('line');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const r = await fetch('./ppi_data.json');
        if (!r.ok) throw new Error('Failed to load PPI data');
        const json = await r.json();
        const unadj = json.series?.WPUFD4?.data    || [];
        const adj   = json.series?.WPUFD49104?.data || [];
        if (!unadj.length) throw new Error('No PPI data in file');
        if (!cancelled) {
          setRawData({ unadj, adj });
          setMetadata({ lastUpdated: json.last_updated, source: json.source, sourceUrl: json.source_url });
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) return (
    <div className="glass-card" style={{ padding: '40px', textAlign: 'center', marginTop: '1px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#F59E0B', letterSpacing: 2 }} className="pulse-animation">LOADING PPI...</div>
    </div>
  );
  if (error) return (
    <div className="glass-card" style={{ padding: '32px', textAlign: 'center', marginTop: '1px', borderLeft: '3px solid #EF4444' }}>
      <div style={{ fontFamily: 'var(--font-mono)', color: '#EF4444', fontSize: 13 }}>ERROR: {error}</div>
    </div>
  );

  const activeData = series === 'unadj' ? rawData.unadj : rawData.adj;

  // Filter by time range
  const filtered = timeRange === 'all' ? activeData
    : timeRange === '10y' ? activeData.slice(-120)
    : timeRange === '5y'  ? activeData.slice(-60)
    : activeData.slice(-24); // 2y

  const latest   = activeData[activeData.length - 1];
  const prev     = activeData[activeData.length - 2];
  const yearAgo  = activeData[activeData.length - 13];

  const latestMom = latest?.mom;
  const latestYoy = latest?.yoy;

  // Historical stats from full data
  const yoyValues = activeData.filter(d => d.yoy !== null).map(d => d.yoy);
  const maxYoy    = Math.max(...yoyValues);
  const minYoy    = Math.min(...yoyValues);
  const avgYoy    = (yoyValues.reduce((a, b) => a + b, 0) / yoyValues.length).toFixed(2);

  const chartInterval = Math.floor((filtered.length || 1) / 8);
  const seriesLabel   = series === 'unadj' ? 'Not Seasonally Adjusted' : 'Seasonally Adjusted';

  return (
    <>
      {/* Series toggle + time range – inline */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #1F2937', background: '#0B0F19', overflowX: 'auto' }}>
        {/* Series toggle */}
        {[{ k: 'unadj', l: 'NSA' }, { k: 'adj', l: 'SA' }].map(({ k, l }) => (
          <button key={k} onClick={() => setSeries(k)} style={{
            padding: isMobile ? '10px 18px' : '7px 14px',
            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.5px',
            background: series === k ? '#2D1E00' : 'transparent',
            color: series === k ? '#F59E0B' : '#6B7280',
            border: 'none', borderRight: '1px solid #1F2937',
            borderBottom: series === k ? '2px solid #F59E0B' : '2px solid transparent',
            cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            minHeight: isMobile ? 44 : 'auto',
          }}>
            {l}
          </button>
        ))}
        <div style={{ width: 1, background: '#374151', margin: '4px 0' }} />
        {/* Time range */}
        {['2y', '5y', '10y', 'all'].map(r => (
          <button key={r} onClick={() => setTimeRange(r)} style={{
            padding: isMobile ? '10px 18px' : '7px 14px',
            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.5px',
            background: timeRange === r ? '#2D1E00' : 'transparent',
            color: timeRange === r ? '#F59E0B' : '#6B7280',
            border: 'none', borderRight: '1px solid #111827',
            borderBottom: timeRange === r ? '2px solid #F59E0B' : '2px solid transparent',
            cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            minHeight: isMobile ? 44 : 'auto',
          }}>
            {r.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Key Metrics */}
      <div className="responsive-grid" style={{ marginTop: '1px', marginBottom: '1px', gap: '1px', background: '#111827' }}>
        <div className="stat-card" style={{ borderLeft: `3px solid ${momColor(latestMom)}`, padding: '12px 16px' }}>
          <div style={{ fontFamily: 'var(--font-ui)', color: '#FCD34D', fontSize: 10, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            MOM CHANGE ({latest?.date})
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? 24 : 28, fontWeight: 700, color: momColor(latestMom) }}>
            {latestMom != null ? `${latestMom > 0 ? '+' : ''}${latestMom.toFixed(2)}%` : 'N/A'}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#6B7280', marginTop: 4 }}>{seriesLabel}</div>
        </div>

        <div className="stat-card" style={{ borderLeft: `3px solid ${yoyColor(latestYoy)}`, padding: '12px 16px' }}>
          <div style={{ fontFamily: 'var(--font-ui)', color: '#FCD34D', fontSize: 10, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            YOY CHANGE
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? 24 : 28, fontWeight: 700, color: yoyColor(latestYoy) }}>
            {latestYoy != null ? `${latestYoy > 0 ? '+' : ''}${latestYoy.toFixed(2)}%` : 'N/A'}
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '3px solid #FCD34D', padding: '12px 16px' }}>
          <div style={{ fontFamily: 'var(--font-ui)', color: '#FCD34D', fontSize: 10, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            INDEX LEVEL
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? 24 : 28, fontWeight: 700, color: '#FCD34D' }}>
            {latest?.index?.toFixed(1)}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#6B7280', marginTop: 4 }}>Base: Nov 2009 = 100</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '3px solid #9CA3AF', padding: '12px 16px' }}>
          <div style={{ fontFamily: 'var(--font-ui)', color: '#FCD34D', fontSize: 10, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            YOY RANGE (ALL-TIME)
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? 14 : 18, fontWeight: 700, color: '#9CA3AF' }}>
            {minYoy.toFixed(1)}% – {maxYoy.toFixed(1)}%
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#6B7280', marginTop: 4 }}>AVG: {avgYoy}%</div>
        </div>
      </div>

      {/* MoM Bar Chart */}
      <div className="glass-card" style={{ padding: 0, marginTop: '1px', marginBottom: '1px' }}>
        <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>PPI FINAL DEMAND — MONTH-OVER-MONTH % CHANGE</span>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <ExportCsvButton
              data={filtered}
              filename={`ppi_mom_${series}`}
              columns={[
                { key: 'date',  label: 'Date' },
                { key: 'mom',   label: 'MoM Change (%)' },
                { key: 'index', label: 'Index Level' },
              ]}
            />
            <ChartToggle type={ppiMomType} setType={setPpiMomType} />
          </div>
        </div>
        <div style={{ padding: isMobile ? '12px' : '16px' }}>
          <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
            <ComposedChart data={filtered} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="1 3" stroke="#111827" />
              <XAxis
                dataKey="date"
                stroke="#374151"
                tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                tickFormatter={formatDate}
                interval={chartInterval}
              />
              <YAxis
                stroke="#374151"
                tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#4B5563" strokeWidth={1} />
              <ReferenceLine y={0.5}  stroke="#EF4444" strokeDasharray="4 4" strokeOpacity={0.6}
                label={{ value: '+0.5%', fill: '#EF4444', fontSize: 9 }} />
              <ReferenceLine y={-0.5} stroke="#10B981" strokeDasharray="4 4" strokeOpacity={0.6}
                label={{ value: '-0.5%', fill: '#10B981', fontSize: 9 }} />
              {ppiMomType === 'bar' ? (
                <Bar
                  dataKey="mom"
                  name="MoM %"
                  radius={[2, 2, 0, 0]}
                  fill="#F59E0B"
                  label={false}
                  cell={filtered.map((entry, i) => (
                    { fill: momColor(entry.mom) }
                  ))}
                />
              ) : (
                <Line
                  type="monotone"
                  dataKey="mom"
                  name="MoM %"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  dot={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', fontFamily: 'JetBrains Mono', fontSize: 10 }}>
            <div className="badge badge-warning" style={{ background: '#450A0A', color: '#EF4444', border: '1px solid #EF4444' }}>HOT (&gt;+0.5%)</div>
            <div className="badge" style={{ background: '#2D1E00', color: '#F59E0B', border: '1px solid #F59E0B' }}>WARM (0–+0.5%)</div>
            <div className="badge badge-success">COOLING (&lt;0%)</div>
          </div>
        </div>
      </div>

      {/* YoY Line Chart */}
      <div className="glass-card" style={{ padding: 0, marginTop: '1px', marginBottom: '1px' }}>
        <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>PPI FINAL DEMAND — YEAR-OVER-YEAR % CHANGE</span>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <ExportCsvButton
              data={filtered.filter(d => d.yoy !== null)}
              filename={`ppi_yoy_${series}`}
              columns={[
                { key: 'date', label: 'Date' },
                { key: 'yoy',  label: 'YoY Change (%)' },
                { key: 'index', label: 'Index Level' },
              ]}
            />
            <ChartToggle type={ppiYoyType} setType={setPpiYoyType} />
          </div>
        </div>
        <div style={{ padding: isMobile ? '12px' : '16px' }}>
          <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
            <ComposedChart data={filtered.filter(d => d.yoy !== null)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="ppiYoyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#F59E0B" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="1 3" stroke="#111827" />
              <XAxis
                dataKey="date"
                stroke="#374151"
                tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                tickFormatter={formatDate}
                interval={chartInterval}
              />
              <YAxis
                stroke="#374151"
                tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0}  stroke="#4B5563" strokeWidth={1} />
              <ReferenceLine y={2}  stroke="#F59E0B" strokeDasharray="4 4" strokeOpacity={0.7}
                label={{ value: 'Fed target ~2%', fill: '#F59E0B', fontSize: 9 }} />
              <ReferenceLine y={4}  stroke="#EF4444" strokeDasharray="4 4" strokeOpacity={0.6}
                label={{ value: '+4%', fill: '#EF4444', fontSize: 9 }} />
              {ppiYoyType === 'line' ? (
                <Line
                  type="monotone" dataKey="yoy" stroke="#F59E0B" strokeWidth={2.5}
                  dot={false} name="YoY %"
                />
              ) : (
                <Bar dataKey="yoy" fill="#F59E0B" name="YoY %" />
              )}
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', fontFamily: 'JetBrains Mono', fontSize: 10 }}>
            <div className="badge" style={{ background: '#450A0A', color: '#EF4444', border: '1px solid #EF4444' }}>DANGER (&gt;4%)</div>
            <div className="badge" style={{ background: '#2D1E00', color: '#F59E0B', border: '1px solid #F59E0B' }}>FED TARGET (~2%)</div>
            <div className="badge badge-success">DEFLATIONARY (&lt;0%)</div>
          </div>
        </div>
      </div>

      {/* Index Level Chart */}
      <div className="glass-card" style={{ padding: 0, marginTop: '1px', marginBottom: '1px' }}>
        <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>PPI FINAL DEMAND — INDEX LEVEL (BASE: NOV 2009 = 100)</span>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <ExportCsvButton
              data={filtered}
              filename={`ppi_index_level_${series}`}
              columns={[
                { key: 'date',  label: 'Date' },
                { key: 'index', label: 'PPI Index Level (Base Nov-2009=100)' },
                { key: 'mom',   label: 'MoM Change (%)' },
                { key: 'yoy',   label: 'YoY Change (%)' },
              ]}
            />
            <ChartToggle type={ppiIndexType} setType={setPpiIndexType} />
          </div>
        </div>
        <div style={{ padding: isMobile ? '12px' : '16px' }}>
          <ResponsiveContainer width="100%" height={isMobile ? 180 : 240}>
            <ComposedChart data={filtered} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="ppiIndexGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#FCD34D" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#FCD34D" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="1 3" stroke="#111827" />
              <XAxis
                dataKey="date"
                stroke="#374151"
                tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                tickFormatter={formatDate}
                interval={chartInterval}
              />
              <YAxis
                stroke="#374151"
                tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                tickFormatter={v => v.toFixed(0)}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              {ppiIndexType === 'line' ? (
                <Line
                  type="monotone" dataKey="index" stroke="#FCD34D" strokeWidth={2}
                  dot={false} name="Index" fill="url(#ppiIndexGrad)"
                />
              ) : (
                <Bar dataKey="index" fill="#FCD34D" name="Index" />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* About */}
      <div className="glass-card" style={{ padding: 0, marginTop: '1px', borderLeft: '3px solid #F59E0B' }}>
        <div style={{ padding: isMobile ? '12px 14px' : '12px 16px' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, color: '#F59E0B', fontSize: 10, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 6 }}>
            ABOUT PPI FINAL DEMAND
          </div>
          <p style={{ fontFamily: 'var(--font-mono)', color: '#D1D5DB', fontSize: 12, lineHeight: '1.6', margin: 0 }}>
            The Producer Price Index (PPI) Final Demand measures average changes in prices received by domestic
            producers for their output sold for final demand — consumption, investment, government and exports.
            Published monthly by the Bureau of Labor Statistics, PPI is a leading indicator of consumer inflation (CPI),
            as upstream price pressures typically flow through to end consumers within 1–3 months.
            A sustained PPI above +2% YoY signals pipeline inflation building.
          </p>
        </div>
      </div>
    </>
  );
}
