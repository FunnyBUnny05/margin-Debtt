/**
 * CreditMortgage/SCECreditChart.jsx
 * ───────────────────────────────────
 * SCE Credit Access — Application Rates, Rejection Rates, Discouraged Borrowers
 * Source: NY Fed SCE Credit Access Microdata, Q4 2013 – Q1 2025 (34 quarters)
 */

import React, { useState } from 'react';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

const BLUE  = '#58A6FF';
const RED   = '#F85149';
const AMBER = '#D29922';
const GREEN = '#56D364';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const find = (key) => payload.find(p => p.dataKey === key);
  const appAny   = find('appRateAny');
  const rejCC    = find('rejectedCC');
  const rejMort  = find('rejectedMortgage');
  const discAny  = find('discouragedAny');

  return (
    <div style={{
      background: '#0D1117', border: '1px solid #30363D',
      padding: '12px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px',
      maxWidth: '280px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    }}>
      <div style={{ color: '#8B949E', marginBottom: '8px', fontWeight: '700' }}>{label}</div>
      {appAny    && <div style={{ color: BLUE,  marginBottom: '3px' }}>APPLICATION RATE: <strong>{appAny.value?.toFixed(1)}%</strong> of survey respondents</div>}
      {rejCC     && <div style={{ color: RED,   marginBottom: '3px' }}>CC REJECTED: <strong>{rejCC.value?.toFixed(1)}%</strong> of CC applicants</div>}
      {rejMort   && <div style={{ color: AMBER, marginBottom: '3px' }}>MORTGAGE REJECTED: <strong>{rejMort.value?.toFixed(1)}%</strong> of mortgage applicants</div>}
      {discAny   && (
        <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #21262D', color: GREEN, fontSize: '9px' }}>
          ⚠ DISCOURAGED BORROWERS: <strong>{discAny.value?.toFixed(1)}%</strong> of households did not apply fearing rejection
        </div>
      )}
    </div>
  );
};

export function SCECreditChart({ data, isMobile }) {
  const [mode, setMode] = useState('rejection'); // 'rejection' | 'application' | 'discouraged'

  return (
    <div style={{ fontFamily: 'JetBrains Mono, monospace' }}>
      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '12px', borderBottom: '1px solid #21262D' }}>
        {[
          { key: 'rejection',   label: 'REJECTION RATES',  color: RED   },
          { key: 'application', label: 'APPLICATION RATES', color: BLUE  },
          { key: 'discouraged', label: 'DISCOURAGED',       color: AMBER },
        ].map(tab => (
          <button key={tab.key} onClick={() => setMode(tab.key)} style={{
            padding: '5px 14px', background: mode === tab.key ? '#161B22' : 'transparent',
            border: 'none', borderBottom: mode === tab.key ? `2px solid ${tab.color}` : '2px solid transparent',
            color: mode === tab.key ? tab.color : '#6E7681', cursor: 'pointer',
            fontFamily: 'JetBrains Mono, monospace', fontSize: '9px', fontWeight: '700', letterSpacing: '0.5px',
          }}>{tab.label}</button>
        ))}
      </div>

      {mode === 'rejection' && (
        <>
          <div style={{ fontSize: '10px', color: '#8B949E', marginBottom: '8px', lineHeight: '1.6' }}>
            <span style={{ color: RED }}>●</span> % of applicants whose request was <strong>rejected</strong> by lenders.
            Rising CC rejection is a leading indicator for broader credit stress.
          </div>
          <ResponsiveContainer width="100%" height={isMobile ? 220 : 260}>
            <ComposedChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="1 4" stroke="#161B22" vertical={false} />
              <XAxis dataKey="quarter" tick={{ fill: '#6E7681', fontSize: 8, fontFamily: 'JetBrains Mono, monospace' }}
                axisLine={false} tickLine={false} interval={5} />
              <YAxis tick={{ fill: '#6E7681', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
                tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} width={36} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#30363D', strokeWidth: 1 }} />
              <Bar dataKey="rejectedCC"       fill={RED}   fillOpacity={0.7} name="CC Rejected" />
              <Line type="monotone" dataKey="rejectedMortgage" stroke={AMBER}  strokeWidth={2} dot={false} name="Mortgage Rejected" />
              <Line type="monotone" dataKey="rejectedAuto"     stroke="#79C0FF" strokeWidth={2} dot={false} name="Auto Rejected" />
            </ComposedChart>
          </ResponsiveContainer>
        </>
      )}

      {mode === 'application' && (
        <>
          <div style={{ fontSize: '10px', color: '#8B949E', marginBottom: '8px', lineHeight: '1.6' }}>
            <span style={{ color: BLUE }}>●</span> % of survey respondents who <strong>applied</strong> for new credit in the past 12 months.
            Falling applications can signal tightening conditions or discouragement.
          </div>
          <ResponsiveContainer width="100%" height={isMobile ? 220 : 260}>
            <ComposedChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="1 4" stroke="#161B22" vertical={false} />
              <XAxis dataKey="quarter" tick={{ fill: '#6E7681', fontSize: 8, fontFamily: 'JetBrains Mono, monospace' }}
                axisLine={false} tickLine={false} interval={5} />
              <YAxis tick={{ fill: '#6E7681', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
                tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} width={36} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#30363D', strokeWidth: 1 }} />
              <Bar dataKey="appRateAny"       fill={BLUE}  fillOpacity={0.6} name="Any Credit" />
              <Line type="monotone" dataKey="appRateCC"       stroke={RED}   strokeWidth={2} dot={false} name="Credit Card" />
              <Line type="monotone" dataKey="appRateMortgage" stroke={AMBER} strokeWidth={2} dot={false} name="Mortgage" />
              <Line type="monotone" dataKey="appRateAuto"     stroke="#79C0FF" strokeWidth={1.5} dot={false} name="Auto" />
            </ComposedChart>
          </ResponsiveContainer>
        </>
      )}

      {mode === 'discouraged' && (
        <>
          <div style={{ fontSize: '10px', color: '#8B949E', marginBottom: '8px', lineHeight: '1.6' }}>
            <span style={{ color: AMBER }}>●</span> % of households who <strong>wanted credit but did not apply</strong> because they
            did not think they would be approved — "Discouraged Borrowers." This shadow demand is
            invisible in application data.
          </div>
          <ResponsiveContainer width="100%" height={isMobile ? 220 : 260}>
            <ComposedChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="1 4" stroke="#161B22" vertical={false} />
              <XAxis dataKey="quarter" tick={{ fill: '#6E7681', fontSize: 8, fontFamily: 'JetBrains Mono, monospace' }}
                axisLine={false} tickLine={false} interval={5} />
              <YAxis tick={{ fill: '#6E7681', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
                tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} width={36} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#30363D', strokeWidth: 1 }} />
              <Bar  dataKey="discouragedAny"       fill={AMBER}  fillOpacity={0.7} name="Discouraged (Any)" />
              <Line type="monotone" dataKey="discouragedCC"       stroke={RED}   strokeWidth={2} dot={false} name="Discouraged CC" />
              <Line type="monotone" dataKey="discouragedMortgage" stroke="#79C0FF" strokeWidth={1.5} dot={false} name="Discouraged Mortgage" />
            </ComposedChart>
          </ResponsiveContainer>
        </>
      )}

      <div style={{ fontSize: '9px', color: '#30363D', marginTop: '6px', borderTop: '1px solid #161B22', paddingTop: '6px' }}>
        SOURCE: NY Fed Survey of Consumer Expectations — Credit Access Microdata. {data.length} quarters.
        Data aggregated from {data[0]?.quarter} to {data[data.length-1]?.quarter}.
      </div>
    </div>
  );
}
