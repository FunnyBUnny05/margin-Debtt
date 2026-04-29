import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Line
} from 'recharts';
import { ExportCsvButton } from './ExportCsvButton';

const ChartToggle = ({ type, setType }) => (
  <div style={{ display: 'flex', background: '#0B0F19', border: '1px solid #1F2937', overflow: 'hidden' }}>
    {['area', 'line'].map(t => (
      <button key={t} onClick={() => setType(t)} style={{
        background: type === t ? '#4B5563' : 'transparent',
        color: type === t ? '#F9FAFB' : '#6B7280',
        border: 'none', padding: '2px 8px', fontSize: '9px', fontFamily: 'var(--font-mono)', cursor: 'pointer', fontWeight: '700'
      }}>{t.toUpperCase()}</button>
    ))}
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
          {p.name}: {p.value?.toFixed(2)}
        </p>
      ))}
    </div>
  );
};

const getStatus = (val) => {
  if (val < 25) return { label: 'EXTREME FEAR', color: '#EF4444', bg: '#450A0A' };
  if (val < 45) return { label: 'FEAR', color: '#F59E0B', bg: '#451A03' };
  if (val <= 55) return { label: 'NEUTRAL', color: '#9CA3AF', bg: '#1F2937' };
  if (val <= 75) return { label: 'GREED', color: '#10B981', bg: '#022C22' };
  return { label: 'EXTREME GREED', color: '#38BDF8', bg: '#082F49' };
};

// Semicircular gauge: 180° arc from left (fear) to right (greed)
function FearGreedGauge({ value, isMobile }) {
  const size = isMobile ? 200 : 260;
  const cx = size / 2;
  const cy = size * 0.54; // center slightly below midpoint to show full arc
  const r = size * 0.38;
  const strokeW = size * 0.065;

  // Arc from 180° to 0° (left to right across top)
  const startAngle = Math.PI; // 180° — left (fear)
  const endAngle = 0;         // 0°  — right (greed)

  // Convert polar to cartesian (angle measured from positive x-axis, counter-clockwise)
  const polar = (angle) => ({
    x: cx + r * Math.cos(angle),
    y: cy - r * Math.sin(angle),
  });

  // Build the background track arc (full 180°)
  const trackStart = polar(startAngle);
  const trackEnd = polar(endAngle);
  const trackPath = `M ${trackStart.x} ${trackStart.y} A ${r} ${r} 0 0 1 ${trackEnd.x} ${trackEnd.y}`;

  // Zone arcs (5 zones: 0-25, 25-45, 45-55, 55-75, 75-100)
  const zones = [
    { from: 0,  to: 25,  color: '#EF4444' },
    { from: 25, to: 45,  color: '#F59E0B' },
    { from: 45, to: 55,  color: '#9CA3AF' },
    { from: 55, to: 75,  color: '#10B981' },
    { from: 75, to: 100, color: '#38BDF8' },
  ];

  const valToAngle = (v) => Math.PI - (v / 100) * Math.PI; // maps 0→180°, 100→0°

  const arcPath = (fromVal, toVal) => {
    const a1 = valToAngle(fromVal);
    const a2 = valToAngle(toVal);
    const p1 = polar(a1);
    const p2 = polar(a2);
    return `M ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p2.x} ${p2.y}`;
  };

  // Needle
  const needleAngle = valToAngle(value);
  const needleLen = r * 0.88;
  const needleTip = {
    x: cx + needleLen * Math.cos(needleAngle),
    y: cy - needleLen * Math.sin(needleAngle),
  };
  const baseHalf = strokeW * 0.22;
  const perpAngle = needleAngle + Math.PI / 2;
  const baseLeft = { x: cx + baseHalf * Math.cos(perpAngle), y: cy - baseHalf * Math.sin(perpAngle) };
  const baseRight = { x: cx - baseHalf * Math.cos(perpAngle), y: cy + baseHalf * Math.sin(perpAngle) };

  const status = getStatus(value);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={size} height={cy + strokeW / 2 + 4} style={{ overflow: 'visible' }}>
        {/* Track */}
        <path d={trackPath} fill="none" stroke="#1F2937" strokeWidth={strokeW} strokeLinecap="butt" />

        {/* Zone arcs */}
        {zones.map((z) => (
          <path
            key={z.from}
            d={arcPath(z.from, z.to)}
            fill="none"
            stroke={z.color}
            strokeWidth={strokeW}
            strokeLinecap="butt"
            opacity={0.28}
          />
        ))}

        {/* Active fill from 0 to current value */}
        {value > 0 && (
          <path
            d={arcPath(0, value)}
            fill="none"
            stroke={status.color}
            strokeWidth={strokeW * 0.55}
            strokeLinecap="round"
            opacity={0.9}
          />
        )}

        {/* Zone tick marks */}
        {[25, 45, 55, 75].map(v => {
          const a = valToAngle(v);
          const inner = { x: cx + (r - strokeW * 0.6) * Math.cos(a), y: cy - (r - strokeW * 0.6) * Math.sin(a) };
          const outer = { x: cx + (r + strokeW * 0.6) * Math.cos(a), y: cy - (r + strokeW * 0.6) * Math.sin(a) };
          return <line key={v} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="#374151" strokeWidth={1.5} />;
        })}

        {/* Zone labels */}
        {[
          { v: 12,  label: 'FEAR' },
          { v: 35,  label: '' },
          { v: 50,  label: '' },
          { v: 65,  label: '' },
          { v: 88,  label: 'GREED' },
        ].map(({ v, label }) => {
          if (!label) return null;
          const a = valToAngle(v);
          const labelR = r + strokeW * 1.2;
          const lx = cx + labelR * Math.cos(a);
          const ly = cy - labelR * Math.sin(a);
          const c = getStatus(v === 12 ? 10 : 90).color;
          return (
            <text key={v} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
              fill={c} fontSize={size * 0.038} fontFamily="var(--font-mono)" fontWeight="700" opacity={0.7}>
              {label}
            </text>
          );
        })}

        {/* Needle */}
        <polygon
          points={`${needleTip.x},${needleTip.y} ${baseLeft.x},${baseLeft.y} ${baseRight.x},${baseRight.y}`}
          fill={status.color}
          opacity={0.95}
        />
        {/* Pivot dot */}
        <circle cx={cx} cy={cy} r={strokeW * 0.28} fill={status.color} />
        <circle cx={cx} cy={cy} r={strokeW * 0.14} fill="#0F172A" />

        {/* Value text */}
        <text x={cx} y={cy - r * 0.18} textAnchor="middle" fill={status.color}
          fontSize={size * 0.13} fontFamily="var(--font-mono)" fontWeight="700">
          {Math.round(value)}
        </text>
        <text x={cx} y={cy + r * 0.1} textAnchor="middle" fill={status.color}
          fontSize={size * 0.048} fontFamily="var(--font-ui)" fontWeight="800" letterSpacing="1.5">
          {status.label}
        </text>
      </svg>
    </div>
  );
}

// Mini horizontal bar for component score
function ComponentBar({ value, color }) {
  return (
    <div style={{ height: '3px', background: '#1F2937', marginTop: '5px', position: 'relative' }}>
      <div style={{
        position: 'absolute', left: 0, top: 0,
        width: `${Math.min(100, Math.max(0, value))}%`,
        height: '100%',
        background: color,
        transition: 'width 0.4s ease',
      }} />
    </div>
  );
}

export function FearGreedIndex({ isMobile }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('5y');
  const [chartType, setChartType] = useState('area');
  const [meta, setMeta] = useState({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const r = await fetch('./fear_greed_index.csv');
        if (!r.ok) throw new Error('Failed to load Fear & Greed data');
        const text = await r.text();

        const lines = text.trim().split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) throw new Error('Invalid CSV data');

        const headers = lines[0].split(',').map(h => h.trim());
        const parsed = lines.slice(1).map(line => {
          const cells = line.split(',');
          const row = {};
          headers.forEach((h, i) => {
            row[h] = h === 'date' ? cells[i] : Number(cells[i]);
          });
          return row;
        }).filter(d => d.date && !isNaN(d.fear_greed_index));

        if (!cancelled) setData(parsed);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Unable to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }

      fetch('./fear_greed_meta.json').then(r => r.json()).then(m => { if (!cancelled) setMeta(m); }).catch(() => {});
    };
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: '32px', textAlign: 'center', marginTop: '1px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: '#F59E0B', marginBottom: '16px' }} className="pulse-animation">LOADING...</div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '16px', fontWeight: '700', color: 'white' }}>Loading Fear & Greed Index</div>
      </div>
    );
  }

  if (error || !data.length) {
    return (
      <div className="glass-card" style={{ padding: '32px', textAlign: 'center', marginTop: '1px', borderLeft: '3px solid #EF4444' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: '#EF4444', marginBottom: '16px' }}>ERROR</div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '16px', fontWeight: '700', color: 'white' }}>Couldn't Load Data</div>
        <div style={{ fontFamily: 'var(--font-mono)', color: '#9CA3AF', fontSize: '12px' }}>{error || 'No data available'}</div>
      </div>
    );
  }

  const filteredData = timeRange === 'all' ? data :
    timeRange === '10y' ? data.slice(-2520) :
    timeRange === '5y' ? data.slice(-1260) :
    timeRange === '2y' ? data.slice(-504) :
    timeRange === '1y' ? data.slice(-252) : data.slice(-63);

  const chartInterval = Math.floor((filteredData.length || 1) / 8);
  const current = data[data.length - 1];
  const prev = data[data.length - 2];
  const currentStatus = getStatus(current.fear_greed_index);
  const delta = prev ? (current.fear_greed_index - prev.fear_greed_index) : 0;

  const components = [
    { key: 'momentum',      label: 'MOMENTUM',     desc: 'SPX vs 125-day MA' },
    { key: 'strength',      label: 'STRENGTH',     desc: 'RSP/SPY breadth' },
    { key: 'breadth',       label: 'BREADTH',      desc: 'RSP/SPY 20d spread' },
    { key: 'put_call',      label: 'PUT/CALL',     desc: meta.put_call_is_proxy ? 'VIX proxy' : 'Put/Call ratio' },
    { key: 'volatility',    label: 'VOLATILITY',   desc: 'VIX vs 50-day MA' },
    { key: 'credit_spread', label: 'CREDIT',       desc: 'Moody\'s BAA-AAA' },
    { key: 'safe_haven',    label: 'SAFE HAVEN',   desc: 'SPX vs TLT 20d' },
  ];

  return (
    <>
      {/* Time Range */}
      <div className="mobile-scroll" style={{ display: 'flex', gap: '0', marginBottom: '1px', background: '#0B0F19', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {['3m', '1y', '2y', '5y', '10y', 'all'].map(range => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            style={{
              padding: isMobile ? '10px 20px' : '7px 16px',
              fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: '700',
              background: timeRange === range ? '#78350F' : 'transparent',
              color: timeRange === range ? '#F59E0B' : '#6B7280',
              border: 'none', borderRight: '1px solid #111827',
              borderBottom: timeRange === range ? '2px solid #F59E0B' : '2px solid transparent',
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0
            }}
          >
            {range.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Gauge + Components */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1px', marginBottom: '1px', background: '#111827' }}>

        {/* Gauge panel */}
        <div className="glass-card" style={{ padding: isMobile ? '16px 12px' : '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontFamily: 'var(--font-ui)', color: '#FCD34D', fontSize: '10px', fontWeight: '700', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '12px', textAlign: 'center' }}>
            FEAR & GREED INDEX — {current.date}
          </div>
          <FearGreedGauge value={current.fear_greed_index} isMobile={isMobile} />
          <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#6B7280' }}>
            <span>
              1D CHANGE:{' '}
              <span style={{ color: delta >= 0 ? '#10B981' : '#EF4444', fontWeight: '700' }}>
                {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
              </span>
            </span>
            <span style={{ color: '#374151' }}>|</span>
            <span>SCORE: <span style={{ color: currentStatus.color, fontWeight: '700' }}>{current.fear_greed_index.toFixed(1)}/100</span></span>
          </div>
        </div>

        {/* Components panel */}
        <div className="glass-card" style={{ padding: isMobile ? '12px' : '16px' }}>
          <div style={{ fontFamily: 'var(--font-ui)', color: '#FCD34D', fontSize: '10px', fontWeight: '700', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '12px' }}>
            COMPONENT BREAKDOWN
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {components.map(comp => {
              const val = current[comp.key];
              if (val === undefined || isNaN(val)) return null;
              const stat = getStatus(val);
              return (
                <div key={comp.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div>
                      <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: '700', color: '#E2E8F0', letterSpacing: '0.5px' }}>
                        {comp.label}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#4B5563', marginLeft: '6px' }}>
                        {comp.desc}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: stat.color, fontWeight: '700', letterSpacing: '0.5px' }}>
                        {stat.label}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: '700', color: stat.color, minWidth: '28px', textAlign: 'right' }}>
                        {val.toFixed(0)}
                      </span>
                    </div>
                  </div>
                  <ComponentBar value={val} color={stat.color} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Chart */}
      <div className="glass-card" style={{ padding: '0', marginBottom: '1px' }}>
        <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>FEAR & GREED INDEX — HISTORICAL (0–100)</span>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <ExportCsvButton data={filteredData} filename="fear_greed_index" />
            <ChartToggle type={chartType} setType={setChartType} />
          </div>
        </div>
        <div style={{ padding: isMobile ? '12px' : '16px' }}>
          <ResponsiveContainer width="100%" height={isMobile ? 240 : 320}>
            <ComposedChart data={filteredData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="fgGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.55}/>
                  <stop offset="25%" stopColor="#10B981" stopOpacity={0.35}/>
                  <stop offset="50%" stopColor="#9CA3AF" stopOpacity={0.15}/>
                  <stop offset="75%" stopColor="#F59E0B" stopOpacity={0.35}/>
                  <stop offset="100%" stopColor="#EF4444" stopOpacity={0.55}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="1 3" stroke="#111827" />
              <XAxis dataKey="date" stroke="#374151" tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickFormatter={formatDate} interval={chartInterval} />
              <YAxis domain={[0, 100]} stroke="#374151" tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'var(--font-mono)' }} />
              <Tooltip content={<CustomTooltip />} />

              <ReferenceLine y={25} stroke="#EF4444" strokeDasharray="3 3" label={{ value: 'Extreme Fear', fill: '#EF4444', fontSize: 9, position: 'insideTopLeft' }} />
              <ReferenceLine y={45} stroke="#F59E0B" strokeDasharray="3 3" />
              <ReferenceLine y={55} stroke="#10B981" strokeDasharray="3 3" />
              <ReferenceLine y={75} stroke="#38BDF8" strokeDasharray="3 3" label={{ value: 'Extreme Greed', fill: '#38BDF8', fontSize: 9, position: 'insideBottomLeft' }} />

              {chartType === 'area' ? (
                <Area type="monotone" dataKey="fear_greed_index" stroke="#F9FAFB" strokeWidth={1.5} fill="url(#fgGradient)" name="Index" dot={false} />
              ) : (
                <Line type="monotone" dataKey="fear_greed_index" stroke="#F9FAFB" strokeWidth={1.5} dot={false} name="Index" />
              )}
            </ComposedChart>
          </ResponsiveContainer>

          <div style={{ display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap', fontFamily: 'var(--font-mono)', fontSize: '9px', justifyContent: 'center' }}>
            {[
              { label: '0–25 EXTREME FEAR', color: '#EF4444' },
              { label: '25–45 FEAR', color: '#F59E0B' },
              { label: '45–55 NEUTRAL', color: '#9CA3AF' },
              { label: '55–75 GREED', color: '#10B981' },
              { label: '75–100 EXTREME GREED', color: '#38BDF8' },
            ].map(({ label, color }) => (
              <div key={label} style={{ padding: '2px 6px', border: `1px solid ${color}`, color }}>{label}</div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
