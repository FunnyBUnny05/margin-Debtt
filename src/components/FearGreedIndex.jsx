import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Line
} from 'recharts';
import { ExportCsvButton } from './ExportCsvButton';
import { SourceLink } from './SourceLink';
import { ChartToggle } from './ChartToggle';
import { formatDate } from '../utils/formatDate';
import { ChartTooltip } from './ChartTooltip';

const CustomTooltip = (props) => <ChartTooltip {...props} />;

const RATING_STYLE = {
  'Extreme Fear': { color: 'var(--bb-red)' },
  'Fear':         { color: 'var(--bb-yellow)' },
  'Neutral':      { color: 'var(--bb-gray-2)' },
  'Greed':        { color: 'var(--bb-green)' },
  'Extreme Greed':{ color: 'var(--bb-blue)' },
};

const ratingColor = (rating) => (RATING_STYLE[rating] || RATING_STYLE['Neutral']).color;

const scoreColor = (score) => {
  if (score < 25) return 'var(--bb-red)';
  if (score < 45) return 'var(--bb-yellow)';
  if (score <= 55) return 'var(--bb-gray-2)';
  if (score <= 75) return 'var(--bb-green)';
  return 'var(--bb-blue)';
};

const COMPONENTS = [
  { key: 'momentum',  label: 'MOMENTUM'  },
  { key: 'strength',  label: 'STRENGTH'  },
  { key: 'breadth',   label: 'BREADTH'   },
  { key: 'put_call',  label: 'PUT/CALL'  },
  { key: 'volatility',label: 'VOLATILITY'},
  { key: 'junk_bond', label: 'JUNK BOND' },
  { key: 'safe_haven',label: 'SAFE HAVEN'},
];

export function FearGreedIndex({ isMobile }) {
  const [historical, setHistorical] = useState([]);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('5y');
  const [chartType, setChartType] = useState('area');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const r = await fetch('./fear_greed_index.json');
        if (!r.ok) throw new Error('Failed to load Fear & Greed data');
        const json = await r.json();

        if (!cancelled) {
          const hist = (json.historical || []).map(d => ({
            date: d.date,
            fear_greed_index: d.value,
          }));
          setHistorical(hist);
          setCurrent(json.current || null);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Unable to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: '40px 24px', textAlign: 'center', marginTop: '20px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--bb-blue)', marginBottom: '16px', letterSpacing: '2px' }} className="pulse-animation">LOADING...</div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '16px', fontWeight: '700', color: 'var(--bb-white)', textTransform: 'uppercase', letterSpacing: '1px' }}>Loading Fear & Greed Index</div>
      </div>
    );
  }

  if (error || !historical.length) {
    return (
      <div className="glass-card" style={{ padding: '40px 24px', textAlign: 'center', marginTop: '20px', borderTop: '3px solid var(--bb-red)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', color: 'var(--bb-red)', marginBottom: '16px', fontWeight: '700', letterSpacing: '2px' }}>ERROR</div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '16px', fontWeight: '700', color: 'var(--bb-white)', textTransform: 'uppercase', letterSpacing: '1px' }}>Couldn't Load Data</div>
        <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--bb-gray-3)', fontSize: '14px', marginTop: '8px' }}>{error || 'No data available'}</div>
      </div>
    );
  }

  const filteredData =
    timeRange === 'all'  ? historical :
    timeRange === '10y'  ? historical.slice(-2520) :
    timeRange === '5y'   ? historical.slice(-1260) :
    timeRange === '2y'   ? historical.slice(-504) :
    timeRange === '1y'   ? historical.slice(-252) :
                           historical.slice(-63);

  const chartInterval = Math.floor((filteredData.length || 1) / 8);
  const score   = current?.score ?? historical[historical.length - 1]?.fear_greed_index ?? 50;
  const rating  = current?.rating ?? 'Neutral';
  const mainColor = ratingColor(rating);

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

      {/* Current reading */}
      <div className="responsive-grid" style={{ marginBottom: '16px', marginTop: '16px' }}>
        <div className="stat-card" style={{ borderTop: `3px solid ${mainColor}` }}>
          <div style={{ fontFamily: 'var(--font-ui)', color: 'var(--bb-white)', fontSize: '12px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            CNN FEAR & GREED {current?.timestamp ? `(${current.timestamp.slice(0, 10)})` : ''}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '32px' : '36px', fontWeight: '700', color: mainColor }}>
            {score.toFixed(1)} <span style={{ fontSize: '16px', color: 'var(--bb-gray-3)' }}>/ 100</span>
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: '800', color: mainColor, marginTop: '8px', letterSpacing: '1px' }}>
            {rating.toUpperCase()}
          </div>
          {current && (
            <div style={{ display: 'flex', gap: '16px', marginTop: '12px', flexWrap: 'wrap' }}>
              {[
                { label: 'PREV CLOSE',   val: current.previous_close },
                { label: '1 WEEK AGO',   val: current.previous_1_week },
                { label: '1 MONTH AGO',  val: current.previous_1_month },
                { label: '1 YEAR AGO',   val: current.previous_1_year },
              ].filter(x => x.val).map(({ label, val }) => (
                <div key={label} style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                  <span style={{ color: 'var(--bb-gray-3)', fontSize: '9px', display: 'block', letterSpacing: '0.5px' }}>{label}</span>
                  <span style={{ color: scoreColor(val), fontWeight: '700' }}>{val.toFixed(1)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Component cards — only shown when CNN returns live component data */}
      {current?.components && Object.keys(current.components).length > 0 && (
        <div className="responsive-grid" style={{ marginBottom: '20px', gap: '12px', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(7, 1fr)' }}>
          {COMPONENTS.map(comp => {
            const c = current.components[comp.key];
            if (!c) return null;
            const col = ratingColor(c.rating);
            return (
              <div key={comp.key} className="glass-card animate-in" style={{ padding: '16px 12px', borderTop: `2px solid ${col}`, animationDelay: '100ms' }}>
                <div style={{ fontFamily: 'var(--font-ui)', color: 'var(--bb-gray-2)', fontSize: '10px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {comp.label}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: '700', color: 'var(--bb-white)' }}>
                  {c.score.toFixed(0)}
                </div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: '600', color: col, marginTop: '8px', letterSpacing: '0.5px' }}>
                  {c.rating.toUpperCase()}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Historical Chart */}
      <div className="glass-card animate-in" style={{ padding: '0', marginBottom: '20px', animationDelay: '200ms' }}>
        <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>FEAR & GREED INDEX (0-100)</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <ExportCsvButton data={filteredData} filename="fear_greed_index" />
            <ChartToggle type={chartType} setType={setChartType} options={['area', 'line']} />
          </div>
        </div>
        <div style={{ padding: isMobile ? '16px 8px' : '24px 16px' }}>
          <ResponsiveContainer width="100%" height={isMobile ? 240 : 360}>
            <ComposedChart data={filteredData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="fgGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--bb-blue)" stopOpacity={0.5}/>
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

              <ReferenceLine y={25} stroke="var(--bb-red)" strokeDasharray="3 3" label={{ value: '25 — Extreme Fear', fill: 'var(--bb-red)', fontSize: 9, position: 'insideTopLeft' }} />
              <ReferenceLine y={45} stroke="var(--bb-yellow)" strokeDasharray="3 3" />
              <ReferenceLine y={55} stroke="var(--bb-gray-2)" strokeDasharray="3 3" />
              <ReferenceLine y={75} stroke="var(--bb-green)" strokeDasharray="3 3" label={{ value: '75 — Extreme Greed', fill: 'var(--bb-green)', fontSize: 9, position: 'insideBottomLeft' }} />

              {chartType === 'area' ? (
                <Area type="monotone" dataKey="fear_greed_index" stroke="var(--bb-white)" strokeWidth={2} fill="url(#fgGradient)" name="Index" dot={false} />
              ) : (
                <Line type="monotone" dataKey="fear_greed_index" stroke="var(--bb-white)" strokeWidth={2} dot={false} name="Index" />
              )}
            </ComposedChart>
          </ResponsiveContainer>

          <div style={{ display: 'flex', gap: '8px', marginTop: '20px', flexWrap: 'wrap', fontFamily: 'var(--font-mono)', fontSize: '10px', justifyContent: 'center' }}>
            <div className="badge" style={{ color: 'var(--bb-red)',    borderColor: 'var(--bb-red)',    background: 'var(--bb-panel-alt)' }}>0-25 EXTREME FEAR</div>
            <div className="badge" style={{ color: 'var(--bb-yellow)', borderColor: 'var(--bb-yellow)', background: 'var(--bb-panel-alt)' }}>25-45 FEAR</div>
            <div className="badge" style={{ color: 'var(--bb-gray-2)', borderColor: 'var(--bb-border-light)', background: 'var(--bb-panel-alt)' }}>45-55 NEUTRAL</div>
            <div className="badge" style={{ color: 'var(--bb-green)',  borderColor: 'var(--bb-green)',  background: 'var(--bb-panel-alt)' }}>55-75 GREED</div>
            <div className="badge" style={{ color: 'var(--bb-blue)',   borderColor: 'var(--bb-blue)',   background: 'var(--bb-panel-alt)' }}>75-100 EXTREME GREED</div>
          </div>
        </div>
      </div>

      <SourceLink
        href="https://www.cnn.com/markets/fear-and-greed"
        label="CNN Fear & Greed Index"
        note="Live data via CNN API — updated daily"
      />
    </>
  );
}
