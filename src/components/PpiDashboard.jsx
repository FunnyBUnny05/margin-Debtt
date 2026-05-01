import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ExportCsvButton } from './ExportCsvButton';

// ── Seismic animation hook ────────────────────────────────
function useSeismic(dataLen, trigger) {
  const [wavePos, setWavePos] = useState(-0.1);
  const [settled, setSettled] = useState(() => new Array(dataLen).fill(0));
  const rafRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    setWavePos(-0.1);
    setSettled(new Array(dataLen).fill(0));
    startRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const WAVE_DUR = 900;
    const RISE_DUR = 160;
    const easeOutExpo = t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    const easeInOutQuart = t => t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;

    function tick(ts) {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const wp = Math.min(1.1, easeInOutQuart(elapsed / WAVE_DUR));
      setWavePos(wp);
      const s = Array.from({ length: dataLen }, (_, i) => {
        const passTime = (i / (dataLen - 1)) * WAVE_DUR;
        const t = Math.min(1, Math.max(0, (elapsed - passTime) / RISE_DUR));
        return easeOutExpo(t);
      });
      setSettled(s);
      if (wp < 1.05 || s[dataLen - 1] < 0.999) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [trigger, dataLen]);

  return { wavePos, settled };
}

// ── Seismic SVG chart ─────────────────────────────────────
function SeismicChart({ data, chartType, showAnnotations, animTrigger }) {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const [dims, setDims] = useState({ w: 900, h: 400 });
  const [hover, setHover] = useState(null);
  const { wavePos, settled } = useSeismic(data.length, animTrigger);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        setDims({ w: e.contentRect.width, h: e.contentRect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w, h } = dims;
  const P = { top: 20, right: 12, bottom: 28, left: 48 };
  const cW = w - P.left - P.right;
  const cH = h - P.top - P.bottom;

  const vals = data.map(d => d.v);
  const maxV = Math.max(...vals);
  const minV = Math.min(...vals);
  const span = Math.max(maxV - minV, 0.01);
  const yMin = minV - span * 0.14;
  const yMax = maxV + span * 0.14;

  const toX = i => P.left + (i / Math.max(data.length - 1, 1)) * cW;
  const toY = v => P.top + cH - ((v - yMin) / (yMax - yMin)) * cH;
  const zeroY = toY(0);
  const barW = Math.max(1, cW / data.length - 1.5);

  // y ticks
  const step = span > 2.5 ? 0.5 : 0.25;
  const yTicks = [];
  const ts = Math.ceil(yMin / step) * step;
  for (let t = ts; t <= yMax + 0.001; t += step) {
    yTicks.push(parseFloat(t.toFixed(2)));
  }

  // year labels
  const yearLabels = [];
  let lastYr = null;
  data.forEach((d, i) => {
    const yr = d.d.slice(0, 4);
    if (yr !== lastYr) { yearLabels.push({ i, yr }); lastYr = yr; }
  });

  const covidIdx = data.findIndex(d => d.d === '2020-04');
  const inflIdx = data.findIndex(d => d.d === '2022-03');

  const onMove = useCallback(e => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left - P.left;
    const idx = Math.round((mx / cW) * (data.length - 1));
    if (idx >= 0 && idx < data.length) setHover({ idx, ...data[idx] });
  }, [data, cW, P.left]);

  const posColor = 'oklch(74% 0.16 148)';
  const negColor = 'oklch(64% 0.18 28)';

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg
        ref={svgRef}
        width={w} height={h}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        style={{ cursor: 'crosshair', display: 'block' }}
      >
        <defs>
          <clipPath id="seismic-clip">
            <rect x={P.left} y={P.top} width={cW} height={cH} />
          </clipPath>
          <filter id="wave-blur">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* Grid lines */}
        {yTicks.filter(t => t === 0).map(t => (
          <line key={`zero-${t}`}
            x1={P.left} x2={P.left + cW}
            y1={toY(t)} y2={toY(t)}
            stroke="rgba(255,255,255,0.12)" strokeWidth={1}
          />
        ))}
        {yTicks.filter(t => t !== 0).map(t => (
          <line key={`grid-${t}`}
            x1={P.left} x2={P.left + cW}
            y1={toY(t)} y2={toY(t)}
            stroke="rgba(255,255,255,0.04)" strokeWidth={0.5}
          />
        ))}

        {/* Y-axis labels */}
        {yTicks.map(t => (
          <text key={`ylabel-${t}`}
            x={P.left - 6} y={toY(t) + 4}
            textAnchor="end"
            fill={t === 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)'}
            fontSize={9} fontFamily="'DM Mono', monospace"
          >
            {t > 0 ? `+${t.toFixed(1)}` : t.toFixed(1)}
          </text>
        ))}

        {/* X-axis year labels */}
        {yearLabels.map(({ i, yr }) => (
          <text key={yr}
            x={toX(i)} y={P.top + cH + 18}
            textAnchor="middle"
            fill="rgba(255,255,255,0.18)"
            fontSize={9} fontFamily="'DM Mono', monospace"
          >
            {yr}
          </text>
        ))}

        {/* Bar chart */}
        {chartType === 'bar' && (
          <g clipPath="url(#seismic-clip)">
            {wavePos >= 0 && wavePos <= 1 && (
              <rect
                x={P.left + wavePos * cW - 22} y={P.top}
                width={44} height={cH}
                fill="oklch(72% 0.14 42 / 0.06)"
                filter="url(#wave-blur)"
              />
            )}
            {wavePos >= 0 && wavePos <= 1 && (
              <line
                x1={P.left + wavePos * cW} x2={P.left + wavePos * cW}
                y1={P.top} y2={P.top + cH}
                stroke="oklch(72% 0.14 42)" strokeWidth={1} opacity={0.55}
              />
            )}
            {data.map((d, i) => {
              const isPos = d.v >= 0;
              const bx = toX(i) - barW / 2;
              const fullH = Math.abs(toY(d.v) - zeroY);
              const animH = fullH * settled[i];
              const by = isPos ? zeroY - animH : zeroY;
              const barNorm = i / (data.length - 1);
              const distFromWave = Math.abs(barNorm - wavePos);
              const boost = Math.max(0, 1 - distFromWave / 0.08) * 0.35;
              const baseOpacity = hover ? (hover.idx === i ? 1 : 0.35) : 0.75;
              return (
                <rect key={i}
                  x={bx} y={by}
                  width={barW} height={Math.max(0, animH)}
                  fill={isPos ? posColor : negColor}
                  opacity={Math.min(1, baseOpacity + boost)}
                />
              );
            })}
          </g>
        )}

        {/* Line chart */}
        {chartType === 'line' && (() => {
          const revealCount = Math.max(2, Math.round(wavePos * (data.length - 1)) + 1);
          const visible = data.slice(0, Math.min(revealCount, data.length));
          const lastIdx = visible.length - 1;
          return (
            <g clipPath="url(#seismic-clip)">
              {visible.length >= 2 && (
                <path
                  d={[
                    `M ${toX(0)} ${zeroY}`,
                    ...visible.map((d, i) => `L ${toX(i)} ${toY(d.v)}`),
                    `L ${toX(lastIdx)} ${zeroY}`,
                    'Z',
                  ].join(' ')}
                  fill="oklch(74% 0.16 148 / 0.07)"
                />
              )}
              {visible.length >= 2 && (
                <polyline
                  points={visible.map((d, i) => `${toX(i)},${toY(d.v)}`).join(' ')}
                  fill="none" stroke={posColor}
                  strokeWidth={1.5} opacity={0.85}
                />
              )}
              {wavePos >= 0 && wavePos <= 1 && (
                <line
                  x1={toX(lastIdx)} x2={toX(lastIdx)}
                  y1={P.top} y2={P.top + cH}
                  stroke="oklch(72% 0.14 42)" strokeWidth={1} opacity={0.55}
                />
              )}
              {hover && wavePos >= 1 && (
                <circle
                  cx={toX(hover.idx)} cy={toY(hover.v)} r={3.5}
                  fill={hover.v >= 0 ? posColor : negColor}
                />
              )}
            </g>
          );
        })()}

        {/* Annotations */}
        {showAnnotations && covidIdx >= 0 && (
          <g>
            <line x1={toX(covidIdx)} x2={toX(covidIdx)} y1={P.top} y2={P.top + cH}
              stroke="rgba(255,255,255,0.06)" strokeWidth={1} strokeDasharray="2,4" />
            <text x={toX(covidIdx) + 5} y={P.top + 14}
              fill="rgba(255,255,255,0.2)" fontSize={8}
              fontFamily="'DM Mono', monospace">COVID</text>
          </g>
        )}
        {showAnnotations && inflIdx >= 0 && (
          <g>
            <line x1={toX(inflIdx)} x2={toX(inflIdx)} y1={P.top} y2={P.top + cH}
              stroke="rgba(255,255,255,0.06)" strokeWidth={1} strokeDasharray="2,4" />
            <text x={toX(inflIdx) + 5} y={P.top + 14}
              fill="rgba(255,255,255,0.2)" fontSize={8}
              fontFamily="'DM Mono', monospace">PEAK INFL.</text>
          </g>
        )}

        {/* Hover hairline */}
        {hover && (
          <line
            x1={toX(hover.idx)} x2={toX(hover.idx)}
            y1={P.top} y2={P.top + cH}
            stroke="rgba(255,255,255,0.18)" strokeWidth={0.5}
          />
        )}
      </svg>

      {/* Tooltip */}
      {hover && (
        <div className="chart-tt" style={{
          left: Math.min(Math.max(toX(hover.idx), 90), w - 90),
          top: Math.max(toY(hover.v) - 66, 8),
          zIndex: 10,
        }}>
          <div className="chart-tt-date">{hover.d}</div>
          <div className={`chart-tt-val ${hover.v >= 0 ? 'pos' : 'neg'}`}>
            {hover.v >= 0 ? '+' : ''}{hover.v.toFixed(3)}%
          </div>
        </div>
      )}
    </div>
  );
}

// ── PPI Sidebar ───────────────────────────────────────────
function PpiSidebar({ data, period, onPeriodChange }) {
  const PERIODS = ['NSA', 'SA', '2Y', '5Y', '10Y', 'ALL'];

  if (!data || data.length === 0) return (
    <aside className="sidebar">
      <div className="sidebar-period">
        {PERIODS.map(p => (
          <button key={p} className={`period-btn ${period === p ? 'active' : ''}`}
            onClick={() => onPeriodChange(p)}>{p}</button>
        ))}
      </div>
      <div className="sidebar-stats" style={{ padding: '24px 16px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.14em' }}>
          LOADING DATA...
        </div>
      </div>
    </aside>
  );

  const latest = data[data.length - 1];
  const prev = data[data.length - 2];
  const yearAgo = data[data.length - 13];
  const mom = latest?.mom;
  const yoy = latest?.yoy;
  const idx = latest?.index;

  const yoyValues = data.filter(d => d.yoy !== null).map(d => d.yoy);
  const maxYoy = Math.max(...yoyValues);
  const minYoy = Math.min(...yoyValues);
  const avgYoy = yoyValues.length
    ? (yoyValues.reduce((a, b) => a + b, 0) / yoyValues.length).toFixed(2)
    : null;
  const yoyRange = maxYoy - minYoy;
  const yoyFillPct = yoyRange > 0
    ? Math.min(100, Math.max(0, ((yoy - minYoy) / yoyRange) * 100))
    : 50;

  return (
    <aside className="sidebar">
      <div className="sidebar-period">
        {PERIODS.map(p => (
          <button key={p} className={`period-btn ${period === p ? 'active' : ''}`}
            onClick={() => onPeriodChange(p)}>{p}</button>
        ))}
      </div>

      <div className="sidebar-stats">
        {/* MoM */}
        <div className="stat-block">
          <div className="stat-block-label">MoM Change · {latest?.date}</div>
          <div className={`stat-block-value ${mom > 0 ? 'pos' : mom < 0 ? 'neg' : 'neutral'}`}>
            {mom != null ? `${mom > 0 ? '+' : ''}${mom.toFixed(2)}%` : '—'}
          </div>
          <div className="stat-block-sub">Not Seasonally Adj.</div>
          {prev && (
            <div className="stat-block-badge">
              {mom > prev.mom ? '▲' : '▼'} Prior {prev.mom > 0 ? '+' : ''}{prev.mom?.toFixed(2)}%
            </div>
          )}
        </div>

        {/* YoY */}
        <div className="stat-block">
          <div className="stat-block-label">YoY Change</div>
          <div className={`stat-block-value ${yoy > 0 ? 'pos' : yoy < 0 ? 'neg' : 'neutral'}`}>
            {yoy != null ? `${yoy > 0 ? '+' : ''}${yoy.toFixed(2)}%` : '—'}
          </div>
          {yoy != null && (
            <div className="stat-block-badge">
              {yoy > 4 ? '▲ Hot' : yoy > 2 ? '▲ Elevated' : yoy < 0 ? '▼ Deflation' : '→ Moderate'}
            </div>
          )}
        </div>

        {/* Index level */}
        <div className="stat-block">
          <div className="stat-block-label">Index Level</div>
          <div className="stat-block-value accent">
            {idx != null ? idx.toFixed(1) : '—'}
          </div>
          <div className="stat-block-sub">Base: Nov 2009 = 100</div>
        </div>

        {/* YoY range */}
        <div className="stat-block">
          <div className="stat-block-label">YoY Range · All-Time</div>
          <div style={{ marginTop: 8 }}>
            <div className="range-labels">
              <span>{minYoy.toFixed(1)}%</span>
              <span style={{ color: 'var(--accent)' }}>{yoy?.toFixed(2)}%</span>
              <span>{maxYoy.toFixed(1)}%</span>
            </div>
            <div className="range-bar-track">
              <div className="range-bar-fill" style={{ width: `${yoyFillPct}%` }} />
              <div className="range-bar-marker" style={{ left: `${yoyFillPct}%` }} />
            </div>
          </div>
          {avgYoy && <div className="stat-block-sub" style={{ marginTop: 8 }}>Avg: {avgYoy}%</div>}
        </div>

        <div className="sidebar-source">
          SOURCE<br />
          U.S. Bureau of Labor Statistics<br />
          Series: WPUFD4<br />
          {latest?.date && `Updated: ${latest.date}`}
        </div>
      </div>
    </aside>
  );
}

// ── Main PpiDashboard export ──────────────────────────────
export function PpiDashboard() {
  const [rawData, setRawData] = useState({ unadj: [], adj: [] });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('ALL');
  const [chartType, setChartType] = useState('bar');
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [animTrigger, setAnimTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch('./ppi_data.json')
      .then(r => r.ok ? r.json() : Promise.reject('No data'))
      .then(json => {
        if (cancelled) return;
        setRawData({
          unadj: json.series?.WPUFD4?.data || [],
          adj: json.series?.WPUFD49104?.data || [],
        });
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const isSA = period === 'SA';
  const source = isSA ? rawData.adj : rawData.unadj;

  const filtered = (() => {
    if (!source.length) return [];
    if (period === '2Y')  return source.slice(-24);
    if (period === '5Y')  return source.slice(-60);
    if (period === '10Y') return source.slice(-120);
    return source;
  })();

  // Map to chart format { d, v }
  const chartData = filtered.map(d => ({ d: d.date, v: d.mom ?? 0 }));

  return (
    <>
      <PpiSidebar
        data={source}
        period={period}
        onPeriodChange={p => setPeriod(p)}
      />

      <main className="chart-panel">
        <div className="chart-topbar">
          <div className="chart-headline">
            PPI Final Demand — Month-over-Month % Change
          </div>
          <div className="chart-btn-group">
            <ExportCsvButton
              data={filtered}
              filename="ppi_mom"
              columns={[
                { key: 'date',  label: 'Date' },
                { key: 'mom',   label: 'MoM Change (%)' },
                { key: 'index', label: 'Index Level' },
              ]}
            />
            <button
              className="chart-btn outline"
              onClick={() => setAnimTrigger(n => n + 1)}
            >↺ Replay</button>
            <button
              className={`chart-btn ${chartType === 'bar' ? 'active' : ''}`}
              onClick={() => setChartType('bar')}
            >Bar</button>
            <button
              className={`chart-btn ${chartType === 'line' ? 'active' : ''}`}
              onClick={() => setChartType('line')}
            >Line</button>
          </div>
        </div>

        <div className="chart-area">
          {loading ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100%', fontFamily: 'var(--font-mono)', fontSize: '9px',
              letterSpacing: '0.2em', color: 'var(--text-dim)',
            }}>
              LOADING PPI DATA...
            </div>
          ) : chartData.length > 0 ? (
            <SeismicChart
              data={chartData}
              chartType={chartType}
              showAnnotations={showAnnotations}
              animTrigger={animTrigger}
            />
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100%', fontFamily: 'var(--font-mono)', fontSize: '9px',
              letterSpacing: '0.2em', color: 'var(--neg)',
            }}>
              NO DATA AVAILABLE
            </div>
          )}
        </div>
      </main>
    </>
  );
}
