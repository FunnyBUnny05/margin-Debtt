/**
 * CreditMortgage/SentinelGauge.jsx
 * ──────────────────────────────────
 * Custom SVG radial arc gauge — "Sentinel" Systemic Risk Score.
 * No external chart library required.
 *
 * Arc: 240° sweep (8 o'clock → 4 o'clock, clockwise through 12)
 * Zones:
 *   0–25  STABLE    #238636 (green)
 *   25–50 CAUTION   #D29922 (amber)
 *   50–75 STRESS    #F85149 (coral red)
 *   75–100 CRITICAL #FF375F (bright red)
 */

import React, { useEffect, useState } from 'react';

const CX = 180;        // viewBox center X
const CY = 170;        // viewBox center Y (shifted up to leave room for needle base)
const R_OUTER = 130;   // outer radius of arc track
const R_INNER = 95;    // inner radius (thickness)
const R_TICK  = 88;    // tick mark inner radius
const R_LABEL = 72;    // zone label radius

// start at 8 o'clock (240° from 12) → end at 4 o'clock (120° from 12)
const ARC_START_DEG  = 240;
const ARC_TOTAL_DEG  = 240;

const ZONES = [
  { min: 0,  max: 25,  color: '#238636', label: 'STABLE'   },
  { min: 25, max: 50,  color: '#D29922', label: 'CAUTION'  },
  { min: 50, max: 75,  color: '#F85149', label: 'STRESS'   },
  { min: 75, max: 100, color: '#FF375F', label: 'CRITICAL' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
/** Convert (cx, cy, r, angleDeg) where 0° = 12 o'clock, positive = clockwise */
function polar(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) / 180) * Math.PI;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

/** Build SVG path for an annular arc from startDeg to endDeg (clockwise) */
function arcPath(cx, cy, ro, ri, startDeg, endDeg) {
  const s1 = polar(cx, cy, ro, startDeg);
  const e1 = polar(cx, cy, ro, endDeg);
  const s2 = polar(cx, cy, ri, endDeg);
  const e2 = polar(cx, cy, ri, startDeg);
  const sweep = ((endDeg - startDeg) + 360) % 360;
  const large = sweep > 180 ? 1 : 0;

  return [
    `M ${s1.x.toFixed(3)} ${s1.y.toFixed(3)}`,
    `A ${ro} ${ro} 0 ${large} 1 ${e1.x.toFixed(3)} ${e1.y.toFixed(3)}`,
    `L ${s2.x.toFixed(3)} ${s2.y.toFixed(3)}`,
    `A ${ri} ${ri} 0 ${large} 0 ${e2.x.toFixed(3)} ${e2.y.toFixed(3)}`,
    'Z',
  ].join(' ');
}

/** Score (0-100) → arc angle from ARC_START_DEG, clockwise */
function scoreToAngle(score) {
  return ARC_START_DEG + (score / 100) * ARC_TOTAL_DEG;
}

// ─── Gauge ───────────────────────────────────────────────────────────────────
export function SentinelGauge({ sentinelResult, components, isMobile }) {
  const [animScore, setAnimScore] = useState(0);

  // Animate needle on mount
  useEffect(() => {
    let start;
    const target = sentinelResult.score;
    const duration = 1400;

    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimScore(eased * target);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [sentinelResult.score]);

  const needleAngle = scoreToAngle(animScore);
  const needleTip   = polar(CX, CY, R_OUTER - 8, needleAngle);
  const needleLeft  = polar(CX, CY, 14, needleAngle - 90);
  const needleRight = polar(CX, CY, 14, needleAngle + 90);

  const viewBox = isMobile ? '0 0 360 320' : '0 0 360 320';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg
        viewBox={viewBox}
        style={{ width: '100%', maxWidth: '360px', overflow: 'visible' }}
        aria-label={`Sentinel Stress Gauge: ${sentinelResult.score.toFixed(0)} — ${sentinelResult.label}`}
      >
        <defs>
          {/* Glow filter for active score arc */}
          <filter id="arcGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Needle drop shadow */}
          <filter id="needleGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── Background track (gray) ── */}
        {ZONES.map((z, i) => {
          const startDeg = ARC_START_DEG + (z.min / 100) * ARC_TOTAL_DEG;
          const endDeg   = ARC_START_DEG + (z.max / 100) * ARC_TOTAL_DEG;
          return (
            <path
              key={i}
              d={arcPath(CX, CY, R_OUTER, R_INNER, startDeg, endDeg)}
              fill={z.color}
              fillOpacity={0.15}
            />
          );
        })}

        {/* ── Active score arc (bright, with glow) ── */}
        {animScore > 0.5 && (() => {
          const endDeg = scoreToAngle(animScore);
          // color = zone that the current score falls in
          const activeZone = ZONES.find(z => animScore < z.max) ?? ZONES[ZONES.length - 1];
          return (
            <path
              d={arcPath(CX, CY, R_OUTER, R_INNER, ARC_START_DEG, endDeg)}
              fill={activeZone.color}
              fillOpacity={0.85}
              filter="url(#arcGlow)"
            />
          );
        })()}

        {/* ── Zone boundary ticks ── */}
        {[0, 25, 50, 75, 100].map(pct => {
          const angle = scoreToAngle(pct);
          const outer = polar(CX, CY, R_OUTER + 4, angle);
          const inner = polar(CX, CY, R_TICK,      angle);
          return (
            <line
              key={pct}
              x1={inner.x} y1={inner.y}
              x2={outer.x} y2={outer.y}
              stroke="#30363D"
              strokeWidth={2}
            />
          );
        })}

        {/* ── Zone labels ── */}
        {ZONES.map((z, i) => {
          const midPct = (z.min + z.max) / 2;
          const midAngle = scoreToAngle(midPct);
          const pt = polar(CX, CY, R_OUTER + 20, midAngle);
          return (
            <text
              key={i}
              x={pt.x}
              y={pt.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={z.color}
              fontSize="8"
              fontFamily="JetBrains Mono, monospace"
              fontWeight="700"
              letterSpacing="0.5"
            >
              {z.label}
            </text>
          );
        })}

        {/* ── Needle ── */}
        <polygon
          points={`${needleLeft.x.toFixed(2)},${needleLeft.y.toFixed(2)} ${needleTip.x.toFixed(2)},${needleTip.y.toFixed(2)} ${needleRight.x.toFixed(2)},${needleRight.y.toFixed(2)}`}
          fill={sentinelResult.color}
          filter="url(#needleGlow)"
          style={{ transition: 'all 0.05s' }}
        />
        {/* Needle base circle */}
        <circle cx={CX} cy={CY} r={10} fill="#0D1117" stroke="#30363D" strokeWidth={2} />
        <circle cx={CX} cy={CY} r={5}  fill={sentinelResult.color} />

        {/* ── Center Score ── */}
        <text
          x={CX}
          y={CY + 38}
          textAnchor="middle"
          fill={sentinelResult.color}
          fontSize="36"
          fontWeight="700"
          fontFamily="JetBrains Mono, monospace"
        >
          {Math.round(animScore)}
        </text>
        <text
          x={CX}
          y={CY + 58}
          textAnchor="middle"
          fill={sentinelResult.color}
          fontSize="11"
          fontWeight="700"
          fontFamily="JetBrains Mono, monospace"
          letterSpacing="2"
        >
          {sentinelResult.label}
        </text>
        <text
          x={CX}
          y={CY + 74}
          textAnchor="middle"
          fill="#6E7681"
          fontSize="9"
          fontFamily="JetBrains Mono, monospace"
          letterSpacing="0.5"
        >
          SYSTEMIC RISK SCORE / 100
        </text>

        {/* ── 0 and 100 end labels ── */}
        {(() => {
          const startPt = polar(CX, CY, R_OUTER + 18, ARC_START_DEG);
          const endPt   = polar(CX, CY, R_OUTER + 18, ARC_START_DEG + ARC_TOTAL_DEG);
          return (
            <>
              <text x={startPt.x} y={startPt.y} textAnchor="middle" fill="#30363D" fontSize="9" fontFamily="JetBrains Mono, monospace">0</text>
              <text x={endPt.x}   y={endPt.y}   textAnchor="middle" fill="#30363D" fontSize="9" fontFamily="JetBrains Mono, monospace">100</text>
            </>
          );
        })()}
      </svg>

      {/* ── Weight Breakdown ── */}
      <div style={{
        width: '100%',
        marginTop: '8px',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}>
        {[
          { label: 'REJECTION RATE', norm: components.rejectionNorm,   weight: 40, color: '#58A6FF' },
          { label: 'DELINQUENCY 90+', norm: components.delinquencyNorm, weight: 30, color: '#F85149' },
          { label: 'FRAGILITY',       norm: components.fragilityNorm,   weight: 20, color: '#D29922' },
          { label: 'UTILIZATION',     norm: components.utilizationNorm, weight: 10, color: '#8B949E' },
        ].map(({ label, norm, weight, color }) => (
          <div key={label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span style={{ color: '#8B949E' }}>{label}</span>
              <span style={{ color }}>
                {norm.toFixed(1)} × {weight}% = <strong>{(norm * weight / 100).toFixed(1)}</strong>
              </span>
            </div>
            <div style={{ height: '3px', background: '#161B22', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                width: `${norm}%`,
                height: '100%',
                background: color,
                borderRadius: '2px',
                transition: 'width 1s ease',
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
