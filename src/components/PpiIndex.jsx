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
    <div className="glass-card" style={{ padding: '40px 24px', textAlign: 'center', marginTop: '20px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--bb-yellow)', letterSpacing: '2px' }} className="pulse-animation">LOADING PPI...</div>
    </div>
  );
  if (error) return (
    <div className="glass-card" style={{ padding: '40px 24px', textAlign: 'center', marginTop: '20px', borderTop: '3px solid var(--bb-red)' }}>
      <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--bb-red)', fontSize: '14px', letterSpacing: '1px', fontWeight: '700' }}>ERROR: {error}</div>
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
      <div className="mobile-scroll" style={{ display: 'flex', gap: '16px', marginBottom: '20px', padding: isMobile ? '0 8px' : '0', overflowX: 'auto', WebkitOverflowScrolling: 'touch', alignItems: 'center' }}>
        {/* Series toggle */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {[{ k: 'unadj', l: 'NSA' }, { k: 'adj', l: 'SA' }].map(({ k, l }) => (
            <button
              key={k}
              onClick={() => setSeries(k)}
              className={`bb-tab ${series === k ? 'active' : ''}`}
              style={{ padding: '6px 12px', fontSize: '12px', flexShrink: 0 }}
            >
              {l}
            </button>
          ))}
        </div>
        <div style={{ width: '1px', height: '24px', background: 'var(--bb-border-light)' }} />
        {/* Time range */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {['2y', '5y', '10y', 'all'].map(r => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`bb-tab ${timeRange === r ? 'active' : ''}`}
              style={{ padding: '6px 12px', fontSize: '12px', flexShrink: 0 }}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="responsive-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-card" style={{ borderTop: `3px solid ${momColor(latestMom)}` }}>
          <div style={{ fontFamily: 'var(--font-ui)', color: 'var(--bb-gray-2)', fontSize: '11px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            MOM CHANGE ({latest?.date})
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '28px' : '32px', fontWeight: '700', color: momColor(latestMom) }}>
            {latestMom != null ? `${latestMom > 0 ? '+' : ''}${latestMom.toFixed(2)}%` : 'N/A'}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--bb-gray-3)', marginTop: '8px' }}>{seriesLabel}</div>
        </div>

        <div className="stat-card" style={{ borderTop: `3px solid ${yoyColor(latestYoy)}` }}>
          <div style={{ fontFamily: 'var(--font-ui)', color: 'var(--bb-gray-2)', fontSize: '11px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            YOY CHANGE
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '28px' : '32px', fontWeight: '700', color: yoyColor(latestYoy) }}>
            {latestYoy != null ? `${latestYoy > 0 ? '+' : ''}${latestYoy.toFixed(2)}%` : 'N/A'}
          </div>
        </div>

        <div className="stat-card" style={{ borderTop: '3px solid var(--bb-yellow)' }}>
          <div style={{ fontFamily: 'var(--font-ui)', color: 'var(--bb-gray-2)', fontSize: '11px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            INDEX LEVEL
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '28px' : '32px', fontWeight: '700', color: 'var(--bb-yellow)' }}>
            {latest?.index?.toFixed(1)}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--bb-gray-3)', marginTop: '8px' }}>Base: Nov 2009 = 100</div>
        </div>

        <div className="stat-card" style={{ borderTop: '3px solid var(--bb-gray-2)' }}>
          <div style={{ fontFamily: 'var(--font-ui)', color: 'var(--bb-gray-2)', fontSize: '11px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            YOY RANGE (ALL-TIME)
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '16px' : '20px', fontWeight: '700', color: 'var(--bb-gray-1)' }}>
            {minYoy.toFixed(1)}% – {maxYoy.toFixed(1)}%
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--bb-gray-3)', marginTop: '8px' }}>AVG: {avgYoy}%</div>
        </div>
      </div>

      {/* MoM Bar Chart */}
      <div className="glass-card animate-in" style={{ padding: '0', marginBottom: '20px', animationDelay: '100ms' }}>
        <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>PPI FINAL DEMAND — MONTH-OVER-MONTH % CHANGE</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
        <div style={{ padding: isMobile ? '16px 8px' : '24px 16px' }}>
          <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
            <ComposedChart data={filtered} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(245, 158, 11, 0.05)' }} />
              <ReferenceLine y={0} stroke="var(--bb-gray-3)" strokeWidth={1} />
              <ReferenceLine y={0.5}  stroke="var(--bb-red)" strokeDasharray="4 4" strokeOpacity={0.6}
                label={{ value: '+0.5%', fill: 'var(--bb-red)', fontSize: 9 }} />
              <ReferenceLine y={-0.5} stroke="var(--bb-green)" strokeDasharray="4 4" strokeOpacity={0.6}
                label={{ value: '-0.5%', fill: 'var(--bb-green)', fontSize: 9 }} />
              {ppiMomType === 'bar' ? (
                <Bar
                  dataKey="mom"
                  name="MoM %"
                  radius={[4, 4, 0, 0]}
                  fill="var(--bb-yellow)"
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
                  stroke="var(--bb-yellow)"
                  strokeWidth={2}
                  dot={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: '8px', marginTop: '20px', flexWrap: 'wrap', fontFamily: 'var(--font-mono)', fontSize: '10px', justifyContent: 'center' }}>
            <div className="badge" style={{ color: 'var(--bb-red)', borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.1)' }}>HOT (&gt;+0.5%)</div>
            <div className="badge" style={{ color: 'var(--bb-yellow)', borderColor: 'rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.1)' }}>WARM (0–+0.5%)</div>
            <div className="badge" style={{ color: 'var(--bb-green)', borderColor: 'rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.1)' }}>COOLING (&lt;0%)</div>
          </div>
        </div>
      </div>

      {/* YoY Line Chart */}
      <div className="glass-card animate-in" style={{ padding: '0', marginBottom: '20px', animationDelay: '200ms' }}>
        <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>PPI FINAL DEMAND — YEAR-OVER-YEAR % CHANGE</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
        <div style={{ padding: isMobile ? '16px 8px' : '24px 16px' }}>
          <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
            <ComposedChart data={filtered.filter(d => d.yoy !== null)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="ppiYoyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--bb-yellow)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--bb-yellow)" stopOpacity={0} />
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
                tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(245, 158, 11, 0.05)' }} />
              <ReferenceLine y={0}  stroke="var(--bb-gray-3)" strokeWidth={1} />
              <ReferenceLine y={2}  stroke="var(--bb-yellow)" strokeDasharray="4 4" strokeOpacity={0.7}
                label={{ value: 'Fed target ~2%', fill: 'var(--bb-yellow)', fontSize: 9 }} />
              <ReferenceLine y={4}  stroke="var(--bb-red)" strokeDasharray="4 4" strokeOpacity={0.6}
                label={{ value: '+4%', fill: 'var(--bb-red)', fontSize: 9 }} />
              {ppiYoyType === 'line' ? (
                <Line
                  type="monotone" dataKey="yoy" stroke="var(--bb-yellow)" strokeWidth={3}
                  dot={false} name="YoY %"
                />
              ) : (
                <Bar dataKey="yoy" fill="var(--bb-yellow)" radius={[4, 4, 0, 0]} name="YoY %" />
              )}
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: '8px', marginTop: '20px', flexWrap: 'wrap', fontFamily: 'var(--font-mono)', fontSize: '10px', justifyContent: 'center' }}>
            <div className="badge" style={{ color: 'var(--bb-red)', borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.1)' }}>DANGER (&gt;4%)</div>
            <div className="badge" style={{ color: 'var(--bb-yellow)', borderColor: 'rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.1)' }}>FED TARGET (~2%)</div>
            <div className="badge" style={{ color: 'var(--bb-green)', borderColor: 'rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.1)' }}>DEFLATIONARY (&lt;0%)</div>
          </div>
        </div>
      </div>

      {/* Index Level Chart */}
      <div className="glass-card animate-in" style={{ padding: '0', marginBottom: '20px', animationDelay: '300ms' }}>
        <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>PPI FINAL DEMAND — INDEX LEVEL (BASE: NOV 2009 = 100)</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
        <div style={{ padding: isMobile ? '16px 8px' : '24px 16px' }}>
          <ResponsiveContainer width="100%" height={isMobile ? 180 : 240}>
            <ComposedChart data={filtered} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="ppiIndexGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--bb-yellow)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--bb-yellow)" stopOpacity={0} />
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
                tickFormatter={v => v.toFixed(0)}
                domain={['auto', 'auto']}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(245, 158, 11, 0.05)' }} />
              {ppiIndexType === 'line' ? (
                <Line
                  type="monotone" dataKey="index" stroke="var(--bb-yellow)" strokeWidth={2}
                  dot={false} name="Index" fill="url(#ppiIndexGrad)"
                />
              ) : (
                <Bar dataKey="index" fill="var(--bb-yellow)" radius={[4, 4, 0, 0]} name="Index" />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* About */}
      <div className="glass-card animate-in" style={{ padding: '16px 20px', borderLeft: '3px solid var(--bb-yellow)', animationDelay: '400ms' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-ui)', fontWeight: '700', color: 'var(--bb-yellow)', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>
            ABOUT PPI FINAL DEMAND
          </div>
          <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--bb-gray-1)', fontSize: '13px', lineHeight: '1.6', margin: 0 }}>
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
