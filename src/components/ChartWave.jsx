import React, { useState, useEffect, useRef } from 'react';

/**
 * useChartAnim — returns [trigger, replay]
 * trigger: increments on replay to re-mount recharts / re-run wave
 * replay: call when user clicks ↺ or toggles chart type
 */
export function useChartAnim() {
  const [trigger, setTrigger] = useState(0);
  return [trigger, () => setTrigger(t => t + 1)];
}

/**
 * ChartWave — accent wave front that sweeps left→right over the chart area.
 * Place inside a position:relative wrapper that contains the chart.
 *
 * leftPct: approximate left margin of the chart data area (y-axis takes space)
 * topPct:  approximate top margin to skip (chart has a small top pad)
 */
export function ChartWave({ trigger, leftPct = 7, topPct = 5 }) {
  const [pos, setPos] = useState(-0.02);
  const rafRef = useRef(null);
  const t0Ref = useRef(null);

  useEffect(() => {
    setPos(-0.02);
    t0Ref.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const DUR = 900;
    const easeInOutQuart = t =>
      t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;

    function tick(ts) {
      if (!t0Ref.current) t0Ref.current = ts;
      const p = Math.min(1.05, easeInOutQuart((ts - t0Ref.current) / DUR));
      setPos(p);
      if (p < 1.01) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [trigger]);

  if (pos <= 0 || pos >= 1) return null;

  const xPct = leftPct + pos * (100 - leftPct);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {/* Glow rect */}
      <div style={{
        position: 'absolute',
        top: `${topPct}%`,
        bottom: 0,
        left: `${xPct}%`,
        width: '56px',
        transform: 'translateX(-50%)',
        background: 'oklch(72% 0.14 42 / 0.1)',
        filter: 'blur(12px)',
      }} />
      {/* Wave line */}
      <div style={{
        position: 'absolute',
        top: `${topPct}%`,
        bottom: 0,
        left: `${xPct}%`,
        width: '1px',
        transform: 'translateX(-50%)',
        background: 'oklch(72% 0.14 42)',
        opacity: 0.45,
      }} />
    </div>
  );
}
