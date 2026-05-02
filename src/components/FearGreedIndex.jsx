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
import { useChartAnim, ChartWave } from './ChartWave';

const CustomTooltip = (props) => <ChartTooltip {...props} />;

const scoreColorClass = (score) => {
  if (score < 25) return 'neg';
  if (score <= 55) return 'neutral';
  return 'pos';
};

const scoreColor = (score) => {
  if (score < 25) return 'var(--neg)';
  if (score < 45) return 'var(--bb-orange)';
  if (score <= 55) return 'var(--text-mid)';
  if (score <= 75) return 'var(--pos)';
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

  const [fgTrigger, replayFg] = useChartAnim();
  const handleChartType = (t) => { setChartType(t); replayFg(); };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const r = await fetch('./fear_greed_index.json');
        if (!r.ok) throw new Error('Failed to load Fear & Greed data');
        const json = await r.json();
        if (!cancelled) {
          const hist = (json.historical || []).map(d => ({ date: d.date, fear_greed_index: d.value }));
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
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-mid)', letterSpacing: '0.2em', textTransform: 'uppercase' }} className="pulse-animation">
          LOADING FEAR &amp; GREED INDEX...
        </div>
      </div>
    );
  }

  if (error || !historical.length) {
    return (
      <div className="glass-card" style={{ padding: '40px 24px', textAlign: 'center', marginTop: '20px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--neg)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '8px' }}>ERROR</div>
        <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-mid)', fontSize: '12px' }}>{error || 'No data available'}</div>
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
  const mainColor = scoreColor(score);

  return (
    <>
      {/* Time Range */}
      <div className="mobile-scroll" style={{ display: 'flex', gap: '4px', marginBottom: '20px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {['3m', '1y', '2y', '5y', '10y', 'all'].map(range => (
          <button key={range} onClick={() => setTimeRange(range)}
            className={`period-btn ${timeRange === range ? 'active' : ''}`}>
            {range.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Current reading */}
      <div className="responsive-grid" style={{ marginBottom: '16px', marginTop: '16px' }}>
        <div className="stat-card">
          <div className="stat-block-label">
            CNN Fear &amp; Greed {current?.timestamp ? `· ${current.timestamp.slice(0, 10)}` : ''}
          </div>
          <div className={`stat-block-value ${scoreColorClass(score)}`} style={{ color: mainColor }}>
            {score.toFixed(1)}<span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--text-dim)', marginLeft: '6px' }}>/ 100</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: mainColor, marginTop: '8px', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            {rating}
          </div>
          {current && (
            <div style={{ display: 'flex', gap: '16px', marginTop: '12px', flexWrap: 'wrap' }}>
              {[
                { label: 'PREV CLOSE',  val: current.previous_close },
                { label: '1 WEEK AGO',  val: current.previous_1_week },
                { label: '1 MONTH AGO', val: current.previous_1_month },
                { label: '1 YEAR AGO',  val: current.previous_1_year },
              ].filter(x => x.val).map(({ label, val }) => (
                <div key={label} style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                  <span style={{ color: 'var(--text-dim)', fontSize: '8px', display: 'block', letterSpacing: '0.16em', textTransform: 'uppercase' }}>{label}</span>
                  <span style={{ color: scoreColor(val) }}>{val.toFixed(1)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Component cards */}
      {current?.components && Object.keys(current.components).length > 0 && (
        <div className="responsive-grid" style={{ marginBottom: '20px', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(7, 1fr)' }}>
          {COMPONENTS.map(comp => {
            const c = current.components[comp.key];
            if (!c) return null;
            const col = scoreColor(c.score);
            return (
              <div key={comp.key} className="stat-card animate-in" style={{ animationDelay: '100ms' }}>
                <div className="stat-block-label">{comp.label}</div>
                <div className="stat-block-value sm" style={{ color: col }}>{c.score.toFixed(0)}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: col, marginTop: '6px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  {c.rating}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Historical Chart */}
      <div className="glass-card animate-in" style={{ padding: '0', marginBottom: '20px', animationDelay: '200ms' }}>
        <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>FEAR &amp; GREED INDEX (0–100)</span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button onClick={replayFg} className="chart-btn" title="Replay animation">↺</button>
            <ExportCsvButton data={filteredData} filename="fear_greed_index" />
            <ChartToggle type={chartType} setType={handleChartType} options={['area', 'line']} />
          </div>
        </div>
        <div style={{ padding: isMobile ? '16px 8px' : '24px 16px' }}>
          <div style={{ position: 'relative' }}>
            <ResponsiveContainer key={fgTrigger} width="100%" height={isMobile ? 240 : 360}>
              <ComposedChart data={filteredData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="fgGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="var(--bb-blue)"  stopOpacity={0.4}/>
                    <stop offset="25%"  stopColor="var(--pos)"      stopOpacity={0.25}/>
                    <stop offset="50%"  stopColor="var(--text-mid)" stopOpacity={0.06}/>
                    <stop offset="75%"  stopColor="var(--bb-orange)"stopOpacity={0.2}/>
                    <stop offset="100%" stopColor="var(--neg)"      stopOpacity={0.4}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="1 3" stroke="var(--rule)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--rule)" tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickFormatter={formatDate} interval={chartInterval} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} stroke="var(--rule)" tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={25} stroke="var(--neg)"        strokeDasharray="3 3" label={{ value: '25 — Extreme Fear', fill: 'var(--neg)',  fontSize: 9, fontFamily: 'var(--font-mono)', position: 'insideTopLeft' }} />
                <ReferenceLine y={45} stroke="var(--bb-orange)"  strokeDasharray="3 3" />
                <ReferenceLine y={55} stroke="var(--rule-strong)"strokeDasharray="3 3" />
                <ReferenceLine y={75} stroke="var(--pos)"        strokeDasharray="3 3" label={{ value: '75 — Extreme Greed', fill: 'var(--pos)', fontSize: 9, fontFamily: 'var(--font-mono)', position: 'insideBottomLeft' }} />
                {chartType === 'area' ? (
                  <Area type="monotone" dataKey="fear_greed_index" stroke="var(--text)" strokeWidth={1.5} fill="url(#fgGradient)" name="Index" dot={false} isAnimationActive animationDuration={900} animationBegin={0} />
                ) : (
                  <Line type="monotone" dataKey="fear_greed_index" stroke="var(--text)" strokeWidth={1.5} dot={false} name="Index" isAnimationActive animationDuration={900} animationBegin={0} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
            <ChartWave trigger={fgTrigger} leftPct={3} />
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '20px', flexWrap: 'wrap', fontFamily: 'var(--font-mono)', fontSize: '9px', justifyContent: 'center', letterSpacing: '0.1em' }}>
            <div className="badge" style={{ color: 'var(--neg)',      borderColor: 'oklch(64% 0.18 28 / 0.3)' }}>0–25 EXTREME FEAR</div>
            <div className="badge" style={{ color: 'var(--bb-orange)',borderColor: 'oklch(72% 0.18 55 / 0.3)' }}>25–45 FEAR</div>
            <div className="badge" style={{ color: 'var(--text-mid)', borderColor: 'var(--rule-strong)' }}>45–55 NEUTRAL</div>
            <div className="badge" style={{ color: 'var(--pos)',      borderColor: 'oklch(74% 0.16 148 / 0.3)' }}>55–75 GREED</div>
            <div className="badge" style={{ color: 'var(--bb-blue)',  borderColor: 'oklch(66% 0.19 252 / 0.3)' }}>75–100 EXTREME GREED</div>
          </div>
        </div>
      </div>

      <SourceLink href="https://www.cnn.com/markets/fear-and-greed" label="CNN Fear & Greed Index" note="Live data via CNN API — updated daily" />
    </>
  );
}
