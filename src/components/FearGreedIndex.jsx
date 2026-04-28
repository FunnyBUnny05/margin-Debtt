import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Line
} from 'recharts';
import { ExportCsvButton } from './ExportCsvButton';

const ChartToggle = ({ type, setType }) => (
  <div style={{ display: 'flex', background: '#0B0F19', border: '1px solid #1F2937', overflow: 'hidden' }}>
    <button
      onClick={() => setType('area')}
      style={{
        background: type === 'area' ? '#4B5563' : 'transparent',
        color: type === 'area' ? '#F9FAFB' : '#6B7280',
        border: 'none', padding: '2px 8px', fontSize: '9px', fontFamily: 'var(--font-mono)', cursor: 'pointer', fontWeight: '700'
      }}
    >
      AREA
    </button>
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
  if (val < 25) return { label: 'EXTREME FEAR', color: '#EF4444' };
  if (val < 45) return { label: 'FEAR', color: '#F59E0B' };
  if (val <= 55) return { label: 'NEUTRAL', color: '#9CA3AF' };
  if (val <= 75) return { label: 'GREED', color: '#10B981' };
  return { label: 'EXTREME GREED', color: '#38BDF8' };
};

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

        if (!cancelled) {
          setData(parsed);
        }
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
    timeRange === '1y' ? data.slice(-252) : data.slice(-63); // 1y = ~252 trading days

  const chartInterval = Math.floor((filteredData.length || 1) / 8);
  const current = data[data.length - 1];
  const currentStatus = getStatus(current.fear_greed_index);

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

      {/* Main Stats */}
      <div className="responsive-grid" style={{ marginBottom: '1px', gap: '1px', background: '#111827' }}>
        <div className="stat-card" style={{ borderLeft: `3px solid ${currentStatus.color}`, padding: '12px 16px' }}>
          <div style={{ fontFamily: 'var(--font-ui)', color: '#FCD34D', fontSize: '10px', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            FEAR & GREED ({current.date})
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '24px' : '28px', fontWeight: '700', color: currentStatus.color }}>
            {current.fear_greed_index.toFixed(1)} <span style={{ fontSize: '14px' }}>/ 100</span>
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: '800', color: currentStatus.color, marginTop: '4px', letterSpacing: '1px' }}>
            {currentStatus.label}
          </div>
        </div>
      </div>

      {/* Components Stats */}
      <div className="responsive-grid" style={{ marginBottom: '1px', gap: '1px', background: '#111827', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(7, 1fr)' }}>
        {[
          { key: 'momentum', label: 'MOMENTUM' },
          { key: 'strength', label: 'STRENGTH' },
          { key: 'breadth', label: 'BREADTH' },
          { key: 'put_call', label: 'PUT/CALL' },
          { key: 'volatility', label: 'VOLATILITY' },
          { key: 'credit_spread', label: 'CREDIT SPREAD' },
          { key: 'safe_haven', label: 'SAFE HAVEN' },
        ].map(comp => {
          const val = current[comp.key];
          if (val === undefined) return null;
          const stat = getStatus(val);
          return (
            <div key={comp.key} className="stat-card" style={{ padding: '8px 12px', borderLeft: `2px solid ${stat.color}` }}>
              <div style={{ fontFamily: 'var(--font-ui)', color: '#9CA3AF', fontSize: '9px', fontWeight: '700', marginBottom: '2px', textTransform: 'uppercase' }}>
                {comp.label}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: '700', color: 'white' }}>
                {val.toFixed(0)}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: stat.color, marginTop: '2px' }}>
                {stat.label}
              </div>
              {comp.key === 'put_call' && meta.put_call_is_proxy && (
                <div style={{ fontSize: '8px', color: '#F59E0B', marginTop: '2px' }}>VIX PROXY</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Main Chart */}
      <div className="glass-card" style={{ padding: '0', marginBottom: '1px' }}>
        <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>FEAR & GREED INDEX (0-100)</span>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <ExportCsvButton data={filteredData} filename="fear_greed_index" />
            <ChartToggle type={chartType} setType={setChartType} />
          </div>
        </div>
        <div style={{ padding: isMobile ? '12px' : '16px' }}>
          <ResponsiveContainer width="100%" height={isMobile ? 240 : 360}>
            <ComposedChart data={filteredData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="fgGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.6}/>
                  <stop offset="25%" stopColor="#10B981" stopOpacity={0.4}/>
                  <stop offset="50%" stopColor="#9CA3AF" stopOpacity={0.2}/>
                  <stop offset="75%" stopColor="#F59E0B" stopOpacity={0.4}/>
                  <stop offset="100%" stopColor="#EF4444" stopOpacity={0.6}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="1 3" stroke="#111827" />
              <XAxis dataKey="date" stroke="#374151" tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickFormatter={formatDate} interval={chartInterval} />
              <YAxis domain={[0, 100]} stroke="#374151" tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'var(--font-mono)' }} />
              <Tooltip content={<CustomTooltip />} />
              
              <ReferenceLine y={25} stroke="#EF4444" strokeDasharray="3 3" label={{ value: '25 - Extreme Fear', fill: '#EF4444', fontSize: 9, position: 'insideTopLeft' }} />
              <ReferenceLine y={45} stroke="#F59E0B" strokeDasharray="3 3" />
              <ReferenceLine y={55} stroke="#10B981" strokeDasharray="3 3" />
              <ReferenceLine y={75} stroke="#38BDF8" strokeDasharray="3 3" label={{ value: '75 - Extreme Greed', fill: '#38BDF8', fontSize: 9, position: 'insideBottomLeft' }} />
              
              {chartType === 'area' ? (
                <Area type="monotone" dataKey="fear_greed_index" stroke="#F9FAFB" strokeWidth={2} fill="url(#fgGradient)" name="Index" dot={false} />
              ) : (
                <Line type="monotone" dataKey="fear_greed_index" stroke="#F9FAFB" strokeWidth={2} dot={false} name="Index" />
              )}
            </ComposedChart>
          </ResponsiveContainer>
          
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap', fontFamily: 'var(--font-mono)', fontSize: '9px', justifyContent: 'center' }}>
            <div style={{ padding: '2px 6px', border: '1px solid #EF4444', color: '#EF4444' }}>0-25 EXTREME FEAR</div>
            <div style={{ padding: '2px 6px', border: '1px solid #F59E0B', color: '#F59E0B' }}>25-45 FEAR</div>
            <div style={{ padding: '2px 6px', border: '1px solid #9CA3AF', color: '#9CA3AF' }}>45-55 NEUTRAL</div>
            <div style={{ padding: '2px 6px', border: '1px solid #10B981', color: '#10B981' }}>55-75 GREED</div>
            <div style={{ padding: '2px 6px', border: '1px solid #38BDF8', color: '#38BDF8' }}>75-100 EXTREME GREED</div>
          </div>
        </div>
      </div>
    </>
  );
}
