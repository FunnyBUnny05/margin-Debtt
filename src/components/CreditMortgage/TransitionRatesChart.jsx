/**
 * CreditMortgage/TransitionRatesChart.jsx
 * ────────────────────────────────────────
 * Quarterly transition rates — how debt flows from current → delinquent → default.
 * Source: NY Fed HHD Q4 2025 — Page 15 (Mortgage) + Page 16 (Consumer Credit)
 * 92 quarters Q1 2003 – Q4 2025
 */

import React, { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

const BLUE  = '#58A6FF';
const RED   = '#F85149';
const AMBER = '#D29922';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#0D1117', border: '1px solid #30363D',
      padding: '10px 14px', fontFamily: 'var(--font-ui)', fontSize: '10px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    }}>
      <div style={{ color: '#8B949E', marginBottom: '6px', fontWeight: '700' }}>{label}</div>
      {payload.map(p => p.value != null && (
        <div key={p.dataKey} style={{ color: p.stroke || p.fill || '#fff', marginBottom: '2px' }}>
          {p.name}: <strong>{p.value.toFixed(2)}%</strong>
        </div>
      ))}
    </div>
  );
};

export function TransitionRatesChart({ mortgageData, consumerData, isMobile }) {
  const [mode, setMode] = useState('consumer'); // 'mortgage' | 'consumer'

  // Filter to post-2010 for cleaner view
  const [range, setRange] = useState('15y');
  const filterData = (d) => {
    if (range === 'all') return d;
    const yr = parseInt(d.quarter.split(' ')[1]);
    const cutoff = range === '5y' ? 2020 : range === '10y' ? 2015 : 2010;
    return yr >= cutoff;
  };

  const mortFiltered = mortgageData.filter(filterData);
  const consFiltered = consumerData.filter(filterData);

  return (
    <div style={{ fontFamily: 'var(--font-ui)' }}>
      {/* Mode + Range */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0', border: '1px solid #21262D' }}>
          {[{ key: 'consumer', label: 'CONSUMER CREDIT' }, { key: 'mortgage', label: 'MORTGAGE' }].map(m => (
            <button key={m.key} onClick={() => setMode(m.key)} style={{
              padding: '3px 12px', background: mode === m.key ? '#161B22' : 'transparent',
              border: 'none', borderRight: '1px solid #21262D',
              color: mode === m.key ? BLUE : '#6E7681', cursor: 'pointer',
              fontFamily: 'var(--font-ui)', fontSize: '9px', fontWeight: '700',
            }}>{m.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0', border: '1px solid #21262D' }}>
          {['5y','10y','15y','all'].map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              padding: '3px 10px', background: range === r ? '#161B22' : 'transparent',
              border: 'none', color: range === r ? BLUE : '#6E7681', cursor: 'pointer',
              fontFamily: 'var(--font-ui)', fontSize: '9px', fontWeight: '700',
              borderRight: '1px solid #21262D',
            }}>{r.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {mode === 'consumer' && (
        <>
          <div style={{ fontSize: '10px', color: '#8B949E', marginBottom: '8px', lineHeight: '1.6' }}>
            Quarterly rate of <strong>delinquent</strong> consumer credit accounts transitioning into <strong>90+ days late</strong> status.
            Rising <span style={{ color: RED }}>to90</span> signals escalating default pipeline.
          </div>
          <ResponsiveContainer width="100%" height={isMobile ? 220 : 260}>
            <AreaChart data={consFiltered} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="consGrad90" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={RED}  stopOpacity={0.3} />
                  <stop offset="100%" stopColor={RED} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="consGradCur" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={BLUE}  stopOpacity={0.15} />
                  <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="1 4" stroke="#161B22" vertical={false} />
              <XAxis dataKey="quarter" tick={{ fill: '#6E7681', fontSize: 8, fontFamily: 'var(--font-ui)' }}
                axisLine={false} tickLine={false}
                interval={range === '5y' ? 3 : range === '10y' ? 7 : 11} />
              <YAxis tick={{ fill: '#6E7681', fontSize: 9, fontFamily: 'var(--font-ui)' }}
                tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} width={36} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#30363D', strokeWidth: 1 }} />
              <Area type="monotone" dataKey="toCurrent" stroke={BLUE} strokeWidth={1.5}
                fill="url(#consGradCur)" name="→ Cures (to Current)" connectNulls />
              <Area type="monotone" dataKey="to90" stroke={RED}  strokeWidth={2}
                fill="url(#consGrad90)" name="→ 90+ Days Late" connectNulls />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '10px' }}>
            <span style={{ color: BLUE }}>■ → Cures (to Current)</span>
            <span style={{ color: RED  }}>■ → 90+ Days Late</span>
          </div>
        </>
      )}

      {mode === 'mortgage' && (
        <>
          <div style={{ fontSize: '10px', color: '#8B949E', marginBottom: '8px', lineHeight: '1.6' }}>
            Quarterly rate of <strong>current</strong> mortgage accounts flowing into <strong>30–60 day</strong> or <strong>90+ day</strong> delinquency.
          </div>
          <ResponsiveContainer width="100%" height={isMobile ? 220 : 260}>
            <AreaChart data={mortFiltered} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="mortGrad90" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={RED}   stopOpacity={0.3} />
                  <stop offset="100%" stopColor={RED}  stopOpacity={0} />
                </linearGradient>
                <linearGradient id="mortGrad30" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={AMBER}  stopOpacity={0.25} />
                  <stop offset="100%" stopColor={AMBER} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="1 4" stroke="#161B22" vertical={false} />
              <XAxis dataKey="quarter" tick={{ fill: '#6E7681', fontSize: 8, fontFamily: 'var(--font-ui)' }}
                axisLine={false} tickLine={false}
                interval={range === '5y' ? 3 : range === '10y' ? 7 : 11} />
              <YAxis tick={{ fill: '#6E7681', fontSize: 9, fontFamily: 'var(--font-ui)' }}
                tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} width={36} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#30363D', strokeWidth: 1 }} />
              <ReferenceLine x="Q3 2010" stroke={AMBER} strokeDasharray="3 4" strokeOpacity={0.5}
                label={{ value: 'GFC PEAK', fill: AMBER, fontSize: 7, position: 'insideTopLeft' }} />
              <Area type="monotone" dataKey="to30" stroke={AMBER} strokeWidth={1.5}
                fill="url(#mortGrad30)" name="→ 30-60 Days Late" connectNulls />
              <Area type="monotone" dataKey="to90" stroke={RED}   strokeWidth={2}
                fill="url(#mortGrad90)" name="→ 90+ Days Late" connectNulls />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '10px' }}>
            <span style={{ color: AMBER }}>■ → 30–60 Days Late</span>
            <span style={{ color: RED   }}>■ → 90+ Days Late</span>
          </div>
        </>
      )}

      <div style={{ fontSize: '9px', color: '#30363D', marginTop: '6px', borderTop: '1px solid #161B22', paddingTop: '6px' }}>
        SOURCE: NY Fed HHD Q4 2025 — Pages 15/16. Q1 2003 – Q4 2025. Source: NY Fed Consumer Credit Panel/Equifax.
      </div>
    </div>
  );
}
