/**
 * CreditMortgage/DelinquencyChart.jsx
 * ────────────────────────────────────
 * Multi-series 90+ day delinquency rates by debt category.
 * Source: NY Fed HHD Q4 2025 — Page 12 Data
 * 92 quarters Q1 2003 – Q4 2025
 */

import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';

const COLORS = {
  mortgage:   '#58A6FF',
  heloc:      '#F0883E',
  auto:       '#D29922',
  cc:         '#F85149',
  student:    '#FF375F',
  all:        '#E6EDF3',
};

const LABELS = {
  mortgage: 'MORTGAGE',
  heloc:    'HELOC',
  auto:     'AUTO',
  cc:       'CREDIT CARDS',
  student:  'STUDENT LOANS',
  all:      'ALL DEBT',
};

const BLUE  = '#58A6FF';
const RED   = '#F85149';
const AMBER = '#D29922';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#0D1117', border: '1px solid #30363D',
      padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px',
      maxWidth: '240px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    }}>
      <div style={{ color: '#8B949E', marginBottom: '6px', fontWeight: '700' }}>{label}</div>
      {payload.map(p => p.value != null && (
        <div key={p.dataKey} style={{ color: COLORS[p.dataKey] || '#fff', marginBottom: '2px' }}>
          {LABELS[p.dataKey] || p.dataKey}: <strong>{p.value.toFixed(2)}%</strong>
        </div>
      ))}
    </div>
  );
};

export function DelinquencyChart({ data, isMobile }) {
  const [visible, setVisible] = useState({
    mortgage: true, heloc: false, auto: true, cc: true, student: true, all: true,
  });

  const toggle = (key) => setVisible(v => ({ ...v, [key]: !v[key] }));

  // Filter to last N years for default view
  const [range, setRange] = useState('15y');
  const filtered = range === 'all' ? data :
    data.filter(d => {
      const yr = parseInt(d.quarter.split(' ')[1]);
      const cutoff = range === '5y' ? 2020 : range === '10y' ? 2015 : 2010;
      return yr >= cutoff;
    });

  return (
    <div style={{ fontFamily: 'JetBrains Mono, monospace' }}>
      {/* Controls row */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Range selector */}
        <div style={{ display: 'flex', gap: '0', border: '1px solid #21262D' }}>
          {['5y','10y','15y','all'].map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              padding: '3px 10px', background: range === r ? '#161B22' : 'transparent',
              border: 'none', color: range === r ? BLUE : '#6E7681', cursor: 'pointer',
              fontFamily: 'JetBrains Mono, monospace', fontSize: '9px', fontWeight: '700',
              borderRight: '1px solid #21262D', letterSpacing: '0.5px',
            }}>{r.toUpperCase()}</button>
          ))}
        </div>

        {/* Series toggles */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {Object.entries(COLORS).map(([key, color]) => (
            <button key={key} onClick={() => toggle(key)} style={{
              padding: '2px 8px', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: '9px',
              background: visible[key] ? `${color}20` : 'transparent',
              border: `1px solid ${visible[key] ? color : '#30363D'}`,
              color: visible[key] ? color : '#6E7681',
              letterSpacing: '0.3px',
            }}>
              {LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={isMobile ? 240 : 300}>
        <LineChart data={filtered} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="1 4" stroke="#161B22" vertical={false} />
          <XAxis
            dataKey="quarter"
            tick={{ fill: '#6E7681', fontSize: 8, fontFamily: 'JetBrains Mono, monospace' }}
            axisLine={false} tickLine={false}
            interval={range === '5y' ? 3 : range === '10y' ? 7 : 11}
          />
          <YAxis
            tick={{ fill: '#6E7681', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
            tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} width={36}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#30363D', strokeWidth: 1 }} />

          {/* GFC peak reference */}
          <ReferenceLine
            x="Q3 2010"
            stroke={AMBER} strokeDasharray="3 4" strokeOpacity={0.6}
            label={{ value: 'GFC PEAK', fill: AMBER, fontSize: 7, position: 'insideTopLeft' }}
          />

          {Object.entries(COLORS).map(([key, color]) =>
            visible[key] && (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={color}
                strokeWidth={key === 'all' ? 2.5 : 1.5}
                dot={false}
                connectNulls
              />
            )
          )}
        </LineChart>
      </ResponsiveContainer>

      <div style={{ fontSize: '9px', color: '#30363D', marginTop: '6px', borderTop: '1px solid #161B22', paddingTop: '6px' }}>
        SOURCE: NY Fed HHD Q4 2025 — Page 12. {data.length} quarters from Q1 2003 to Q4 2025.
      </div>
    </div>
  );
}
