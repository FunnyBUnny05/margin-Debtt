import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Line
} from 'recharts';
import { ExportCsvButton } from './ExportCsvButton';
import { SourceLink } from './SourceLink';

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
  if (val < 25) return { label: 'EXTREME FEAR', color: 'var(--bb-red)' };
  if (val < 45) return { label: 'FEAR', color: 'var(--bb-yellow)' };
  if (val <= 55) return { label: 'NEUTRAL', color: 'var(--bb-gray-2)' };
  if (val <= 75) return { label: 'GREED', color: 'var(--bb-green)' };
  return { label: 'EXTREME GREED', color: 'var(--bb-royal)' };
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
      <div className="glass-card" style={{ padding: '40px 24px', textAlign: 'center', marginTop: '20px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--bb-royal)', marginBottom: '16px', letterSpacing: '2px' }} className="pulse-animation">LOADING...</div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '16px', fontWeight: '700', color: 'var(--bb-white)', textTransform: 'uppercase', letterSpacing: '1px' }}>Loading Fear & Greed Index</div>
      </div>
    );
  }

  if (error || !data.length) {
    return (
      <div className="glass-card" style={{ padding: '40px 24px', textAlign: 'center', marginTop: '20px', borderTop: '3px solid var(--bb-red)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', color: 'var(--bb-red)', marginBottom: '16px', fontWeight: '700', letterSpacing: '2px' }}>ERROR</div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '16px', fontWeight: '700', color: 'var(--bb-white)', textTransform: 'uppercase', letterSpacing: '1px' }}>Couldn't Load Data</div>
        <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--bb-gray-3)', fontSize: '14px', marginTop: '8px' }}>{error || 'No data available'}</div>
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
      <div className="mobile-scroll" style={{ display: 'flex', gap: '8px', marginBottom: '20px', padding: isMobile ? '0 8px' : '0', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {['3m', '1y', '2y', '5y', '10y', 'all'].map(range => (
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

      {/* Main Stats */}
      <div className="responsive-grid" style={{ marginBottom: '16px', marginTop: '16px' }}>
        <div className="stat-card" style={{ borderTop: `3px solid ${currentStatus.color}` }}>
          <div style={{ fontFamily: 'var(--font-ui)', color: 'var(--bb-white)', fontSize: '12px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            FEAR & GREED ({current.date})
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '32px' : '36px', fontWeight: '700', color: currentStatus.color }}>
            {current.fear_greed_index.toFixed(1)} <span style={{ fontSize: '16px', color: 'var(--bb-gray-3)' }}>/ 100</span>
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: '800', color: currentStatus.color, marginTop: '8px', letterSpacing: '1px' }}>
            {currentStatus.label}
          </div>
        </div>
      </div>

      {/* Components Stats */}
      <div className="responsive-grid" style={{ marginBottom: '20px', gap: '12px', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(7, 1fr)' }}>
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
            <div key={comp.key} className="glass-card animate-in" style={{ padding: '16px 12px', borderTop: `2px solid ${stat.color}`, animationDelay: '100ms' }}>
              <div style={{ fontFamily: 'var(--font-ui)', color: 'var(--bb-gray-2)', fontSize: '10px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {comp.label}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: '700', color: 'var(--bb-white)' }}>
                {val.toFixed(0)}
              </div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: '600', color: stat.color, marginTop: '8px', letterSpacing: '0.5px' }}>
                {stat.label}
              </div>
              {comp.key === 'put_call' && meta.put_call_is_proxy && (
                <div style={{ fontSize: '9px', color: 'var(--bb-yellow)', marginTop: '4px', opacity: 0.8 }}>VIX PROXY</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Main Chart */}
      <div className="glass-card animate-in" style={{ padding: '0', marginBottom: '20px', animationDelay: '200ms' }}>
        <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>FEAR & GREED INDEX (0-100)</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <ExportCsvButton data={filteredData} filename="fear_greed_index" />
            <ChartToggle type={chartType} setType={setChartType} />
          </div>
        </div>
        <div style={{ padding: isMobile ? '16px 8px' : '24px 16px' }}>
          <ResponsiveContainer width="100%" height={isMobile ? 240 : 360}>
            <ComposedChart data={filteredData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="fgGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--bb-cyan)" stopOpacity={0.5}/>
                  <stop offset="25%" stopColor="var(--bb-green)" stopOpacity={0.3}/>
                  <stop offset="50%" stopColor="var(--bb-gray-2)" stopOpacity={0.1}/>
                  <stop offset="75%" stopColor="var(--bb-yellow)" stopOpacity={0.3}/>
                  <stop offset="100%" stopColor="var(--bb-red)" stopOpacity={0.5}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="1 3" stroke="var(--bb-border-light)" vertical={false} />
              <XAxis dataKey="date" stroke="var(--bb-gray-3)" tick={{ fill: 'var(--bb-gray-2)', fontSize: 11, fontFamily: 'var(--font-mono)' }} tickFormatter={formatDate} interval={chartInterval} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} stroke="var(--bb-gray-3)" tick={{ fill: 'var(--bb-gray-2)', fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              
              <ReferenceLine y={25} stroke="var(--bb-red)" strokeDasharray="3 3" label={{ value: '25 - Extreme Fear', fill: 'var(--bb-red)', fontSize: 9, position: 'insideTopLeft' }} />
              <ReferenceLine y={45} stroke="var(--bb-yellow)" strokeDasharray="3 3" />
              <ReferenceLine y={55} stroke="var(--bb-gray-2)" strokeDasharray="3 3" />
              <ReferenceLine y={75} stroke="var(--bb-green)" strokeDasharray="3 3" label={{ value: '75 - Extreme Greed', fill: 'var(--bb-green)', fontSize: 9, position: 'insideBottomLeft' }} />
              
              {chartType === 'area' ? (
                <Area type="monotone" dataKey="fear_greed_index" stroke="var(--bb-white)" strokeWidth={2} fill="url(#fgGradient)" name="Index" dot={false} />
              ) : (
                <Line type="monotone" dataKey="fear_greed_index" stroke="var(--bb-white)" strokeWidth={2} dot={false} name="Index" />
              )}
            </ComposedChart>
          </ResponsiveContainer>
          
          <div style={{ display: 'flex', gap: '8px', marginTop: '20px', flexWrap: 'wrap', fontFamily: 'var(--font-mono)', fontSize: '10px', justifyContent: 'center' }}>
            <div className="badge" style={{ color: 'var(--bb-red)', borderColor: 'var(--bb-red)', background: 'var(--bb-panel-alt)' }}>0-25 EXTREME FEAR</div>
            <div className="badge" style={{ color: 'var(--bb-yellow)', borderColor: 'var(--bb-yellow)', background: 'var(--bb-panel-alt)' }}>25-45 FEAR</div>
            <div className="badge" style={{ color: 'var(--bb-gray-2)', borderColor: 'var(--bb-border-light)', background: 'var(--bb-panel-alt)' }}>45-55 NEUTRAL</div>
            <div className="badge" style={{ color: 'var(--bb-green)', borderColor: 'var(--bb-green)', background: 'var(--bb-panel-alt)' }}>55-75 GREED</div>
            <div className="badge" style={{ color: 'var(--bb-royal)', borderColor: 'var(--bb-royal)', background: 'var(--bb-panel-alt)' }}>75-100 EXTREME GREED</div>
          </div>
        </div>
      </div>

      <SourceLink
        href="https://money.cnn.com/data/fear-and-greed/"
        label="CNN Fear &amp; Greed Index"
        note="Custom proxy — methodology inspired by CNN's composite sentiment indicator"
      />
    </>
  );
}
