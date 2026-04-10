/**
 * CreditMortgage/LeadLagChart.jsx
 * ────────────────────────────────
 * Dual-axis prediction chart:
 *   Left axis  (Neon Blue  #58A6FF): Rejection Rate shifted +2 quarters (LEADING)
 *   Right axis (Coral Red  #F85149): 90-day delinquency rate (LAGGING)
 *
 * Both series are normalized to 0–100 for direct comparison.
 * A predictive tooltip appears on the rejection rate line.
 */

import React, { useState } from 'react';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';

const BLUE   = '#58A6FF';
const RED    = '#F85149';
const AMBER  = '#D29922';

// ─── Custom Tooltip ─────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  const rej    = payload.find(p => p.dataKey === 'rejShiftedNorm');
  const delinq = payload.find(p => p.dataKey === 'delinqNorm');
  const showRejWarning = rej && rej.value > 60;

  return (
    <div style={{
      background: '#0D1117',
      border: `1px solid #30363D`,
      padding: '12px 14px',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '11px',
      maxWidth: '260px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    }}>
      <div style={{ color: '#8B949E', marginBottom: '8px', fontWeight: '700', letterSpacing: '0.5px' }}>
        {label}
      </div>

      {rej && (
        <div style={{ color: BLUE, marginBottom: '4px' }}>
          REJECTION RATE (LEADING):&nbsp;
          <strong>{rej.value != null ? `${rej.value.toFixed(1)}/100` : 'N/A'}</strong>
          {rej.value != null && (
            <span style={{ color: '#6E7681', marginLeft: '4px' }}>
              ({((rej.value / 100) * 60).toFixed(1)}% raw)
            </span>
          )}
        </div>
      )}

      {delinq && (
        <div style={{ color: RED, marginBottom: '4px' }}>
          DELINQUENCY 90+ (LAGGING):&nbsp;
          <strong>{delinq.value != null ? `${delinq.value.toFixed(1)}/100` : 'N/A'}</strong>
          {delinq.value != null && (
            <span style={{ color: '#6E7681', marginLeft: '4px' }}>
              ({((delinq.value / 100) * 8).toFixed(2)}% raw)
            </span>
          )}
        </div>
      )}

      {showRejWarning && (
        <div style={{
          marginTop: '8px',
          paddingTop: '8px',
          borderTop: `1px solid #21262D`,
          color: AMBER,
          fontSize: '10px',
          lineHeight: '1.5',
        }}>
          ⚠ High rejection suggests a credit freeze;<br />
          expect delinquency spikes in <strong>180 days</strong>.
        </div>
      )}
    </div>
  );
};

// ─── Legend ─────────────────────────────────────────────────────────────────
const ChartLegend = () => (
  <div style={{
    display: 'flex',
    gap: '20px',
    justifyContent: 'center',
    marginBottom: '10px',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '10px',
    flexWrap: 'wrap',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: BLUE }}>
      <span style={{ width: '20px', height: '2px', background: BLUE, display: 'inline-block' }} />
      REJECTION RATE (LEADING + 2Q)
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: RED }}>
      <span style={{
        width: '20px', height: '2px', background: RED,
        display: 'inline-block', borderTop: '2px dashed ' + RED,
      }} />
      90+ DAY DELINQUENCY (LAGGING)
    </div>
  </div>
);

// ─── Main Chart ──────────────────────────────────────────────────────────────
export function LeadLagChart({ data, isMobile }) {
  return (
    <div>
      <ChartLegend />

      {/* Annotation banner */}
      <div style={{
        background: 'rgba(88, 166, 255, 0.06)',
        border: `1px solid rgba(88, 166, 255, 0.2)`,
        padding: '6px 12px',
        marginBottom: '10px',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '10px',
        color: '#8B949E',
        lineHeight: '1.6',
      }}>
        <span style={{ color: BLUE }}>●</span> LEADING line is shifted <strong style={{ color: BLUE }}>+2 quarters forward</strong> — where the blue line is now, expect the red line to follow in ~180 days.
        Both series normalized 0–100.
      </div>

      <ResponsiveContainer width="100%" height={isMobile ? 240 : 320}>
        <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="blueGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BLUE} stopOpacity={0.15} />
              <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="1 4" stroke="#161B22" vertical={false} />

          <XAxis
            dataKey="quarter"
            tick={{ fill: '#6E7681', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
            axisLine={false}
            tickLine={false}
            interval={isMobile ? 3 : 1}
          />

          <YAxis
            yAxisId="left"
            domain={[0, 100]}
            tick={{ fill: BLUE, fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
            tickFormatter={v => `${v}`}
            axisLine={false}
            tickLine={false}
            width={32}
          />

          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            tick={{ fill: RED, fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
            tickFormatter={v => `${v}`}
            axisLine={false}
            tickLine={false}
            width={32}
          />

          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#30363D', strokeWidth: 1 }} />

          {/* Caution zone band */}
          <ReferenceLine yAxisId="left" y={60} stroke={AMBER} strokeDasharray="3 4" strokeOpacity={0.5}
            label={{ value: 'CAUTION', fill: AMBER, fontSize: 8, fontFamily: 'JetBrains Mono, monospace', position: 'insideTopLeft' }} />

          {/* Leading: Rejection Rate shifted +2Q */}
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="rejShiftedNorm"
            stroke={BLUE}
            strokeWidth={2.5}
            dot={false}
            connectNulls={false}
            name="Rejection Rate (Leading +2Q)"
          />

          {/* Lagging: 90+ Day Delinquency */}
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="delinqNorm"
            stroke={RED}
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
            name="90+ Day Delinquency"
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div style={{
        marginTop: '8px',
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '10px',
        color: '#6E7681',
      }}>
        <span>SOURCES: NY Fed SCE Credit Access Survey, HHD Report.</span>
        <span style={{ color: '#30363D' }}>|</span>
        <span>Normalization: Rejection [0–60%] → [0–100], Delinquency [0–8%] → [0–100].</span>
      </div>
    </div>
  );
}
