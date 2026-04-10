/**
 * CreditMortgage/SCECreditChart.jsx
 * ───────────────────────────────────
 * SCE Credit Access — Application Rates, Rejection Rates, Discouraged Borrowers
 *
 * Source: NY Fed SCE Credit Access Microdata
 * Survey cadence: tri-annual (February / June / October each year)
 * Latest wave in dataset: February 2025 = Q1 2025
 * Q2 2025 (June), Q3 2025 (October), Q4 2025: NOT YET RELEASED
 */

import React, { useState, useMemo } from 'react';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

const BLUE  = '#58A6FF';
const RED   = '#F85149';
const AMBER = '#D29922';
const GREEN = '#56D364';
const GRAY  = '#30363D';

const PENDING_QUARTERS = ['Q2 2025', 'Q3 2025', 'Q4 2025'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const isPending = PENDING_QUARTERS.includes(label);

  if (isPending) {
    return (
      <div style={{
        background: '#0D1117', border: `1px solid ${GRAY}`,
        padding: '10px 14px', fontFamily: 'var(--font-ui)', fontSize: '10px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}>
        <div style={{ color: '#8B949E', marginBottom: '4px', fontWeight: '700' }}>{label}</div>
        <div style={{ color: '#4D5566', fontSize: '9px', lineHeight: '1.5' }}>
          SCE WAVE NOT YET RELEASED<br />
          Survey cadence: Feb / Jun / Oct<br />
          Next expected: Jun 2025 wave
        </div>
      </div>
    );
  }

  const find = (key) => payload.find(p => p.dataKey === key);
  const appAny  = find('appRateAny');
  const rejCC   = find('rejectedCC');
  const rejMort = find('rejectedMortgage');
  const discAny = find('discouragedAny');

  return (
    <div style={{
      background: '#0D1117', border: '1px solid #30363D',
      padding: '12px 14px', fontFamily: 'var(--font-ui)', fontSize: '10px',
      maxWidth: '280px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    }}>
      <div style={{ color: '#8B949E', marginBottom: '8px', fontWeight: '700' }}>{label}</div>
      {appAny  && <div style={{ color: BLUE,  marginBottom: '3px' }}>APPLICATION RATE: <strong>{appAny.value?.toFixed(1)}%</strong></div>}
      {rejCC   && <div style={{ color: RED,   marginBottom: '3px' }}>CC REJECTED: <strong>{rejCC.value?.toFixed(1)}%</strong> of CC applicants</div>}
      {rejMort && <div style={{ color: AMBER, marginBottom: '3px' }}>MORTGAGE REJECTED: <strong>{rejMort.value?.toFixed(1)}%</strong></div>}
      {discAny && (
        <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #21262D', color: GREEN, fontSize: '9px' }}>
          DISCOURAGED BORROWERS: <strong>{discAny.value?.toFixed(1)}%</strong> of households did not apply fearing rejection
        </div>
      )}
    </div>
  );
};

// Custom X-axis tick — grays out pending quarters
const CustomXTick = ({ x, y, payload }) => {
  const isPending = PENDING_QUARTERS.includes(payload.value);
  return (
    <text
      x={x} y={y + 10}
      textAnchor="middle"
      fill={isPending ? '#3D444D' : '#6E7681'}
      fontSize={8}
      fontFamily="var(--font-mono)"
      fontStyle={isPending ? 'italic' : 'normal'}
    >
      {payload.value}{isPending ? ' ?' : ''}
    </text>
  );
};

export function SCECreditChart({ data, isMobile }) {
  const [mode, setMode] = useState('rejection');

  // Append pending quarter stubs so axis stretches to Q4 2025
  const extendedData = useMemo(() => [
    ...data,
    ...PENDING_QUARTERS.map(q => ({ quarter: q, _pending: true })),
  ], [data]);

  const lastRealQuarter = data[data.length - 1]?.quarter;

  const GapBanner = () => (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '10px',
      background: '#161B22', border: `1px solid ${GRAY}`,
      borderLeft: `3px solid ${AMBER}`, padding: '8px 12px',
      marginBottom: '10px', fontFamily: 'var(--font-ui)', fontSize: '10px',
    }}>
      <span style={{ fontSize: '14px', flexShrink: 0 }}>📅</span>
      <div>
        <div style={{ color: AMBER, fontWeight: '700', letterSpacing: '0.5px', marginBottom: '3px' }}>
          SCE SURVEY DATA THROUGH {lastRealQuarter} — Q2–Q4 2025 NOT YET RELEASED
        </div>
        <div style={{ color: '#6E7681', fontSize: '9px', lineHeight: '1.6' }}>
          The NY Fed Credit Access Survey is conducted <strong style={{ color: '#8B949E' }}>tri-annually</strong> (February, June, October).
          Latest wave: <strong style={{ color: '#8B949E' }}>February 2025 = Q1 2025</strong>.
          June 2025 (Q2) and October 2025 (Q3) waves are pending public release.
          Grayed labels on the right indicate unreleased quarters.
        </div>
      </div>
    </div>
  );

  const commonChartProps = {
    data: extendedData,
    margin: { top: 5, right: 20, left: 0, bottom: 0 },
  };

  const xAxisProps = {
    dataKey: 'quarter',
    tick: <CustomXTick />,
    axisLine: false,
    tickLine: false,
    interval: 4,
  };

  const yAxisProps = {
    tick: { fill: '#6E7681', fontSize: 9, fontFamily: 'var(--font-ui)' },
    tickFormatter: (v) => `${v}%`,
    axisLine: false,
    tickLine: false,
    width: 36,
  };

  const LastDataLine = () => (
    <ReferenceLine
      x={lastRealQuarter}
      stroke="#3D444D"
      strokeDasharray="4 3"
      label={{
        value: 'LAST WAVE →',
        fill: '#4D5566',
        fontSize: 7,
        fontFamily: 'var(--font-ui)',
        position: 'insideTopRight',
      }}
    />
  );

  return (
    <div style={{ fontFamily: 'var(--font-ui)' }}>
      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '12px', borderBottom: '1px solid #21262D' }}>
        {[
          { key: 'rejection',   label: 'REJECTION RATES',   color: RED   },
          { key: 'application', label: 'APPLICATION RATES',  color: BLUE  },
          { key: 'discouraged', label: 'DISCOURAGED',        color: AMBER },
        ].map(tab => (
          <button key={tab.key} onClick={() => setMode(tab.key)} style={{
            padding: '5px 12px',
            background: mode === tab.key ? '#161B22' : 'transparent',
            border: 'none',
            borderBottom: mode === tab.key ? `2px solid ${tab.color}` : '2px solid transparent',
            color: mode === tab.key ? tab.color : '#6E7681',
            cursor: 'pointer',
            fontFamily: 'var(--font-ui)',
            fontSize: '9px',
            fontWeight: '700',
            letterSpacing: '0.5px',
          }}>{tab.label}</button>
        ))}
      </div>

      <GapBanner />

      {mode === 'rejection' && (
        <>
          <div style={{ fontSize: '10px', color: '#8B949E', marginBottom: '8px', lineHeight: '1.6' }}>
            <span style={{ color: RED }}>●</span> % of applicants rejected by lenders.
            Rising CC rejection is a leading indicator for broader delinquency stress.
          </div>
          <ResponsiveContainer width="100%" height={isMobile ? 220 : 260}>
            <ComposedChart {...commonChartProps}>
              <CartesianGrid strokeDasharray="1 4" stroke="#161B22" vertical={false} />
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#30363D', strokeWidth: 1 }} />
              <LastDataLine />
              <Bar  dataKey="rejectedCC"       fill={RED}     fillOpacity={0.7} name="CC Rejected" />
              <Line type="monotone" dataKey="rejectedMortgage" stroke={AMBER}   strokeWidth={2}   dot={false} connectNulls name="Mortgage Rejected" />
              <Line type="monotone" dataKey="rejectedAuto"     stroke="#79C0FF" strokeWidth={2}   dot={false} connectNulls name="Auto Rejected" />
            </ComposedChart>
          </ResponsiveContainer>
        </>
      )}

      {mode === 'application' && (
        <>
          <div style={{ fontSize: '10px', color: '#8B949E', marginBottom: '8px', lineHeight: '1.6' }}>
            <span style={{ color: BLUE }}>●</span> % of respondents who applied for new credit in the past 12 months.
            Falling applications can signal tightening or rising discouragement.
          </div>
          <ResponsiveContainer width="100%" height={isMobile ? 220 : 260}>
            <ComposedChart {...commonChartProps}>
              <CartesianGrid strokeDasharray="1 4" stroke="#161B22" vertical={false} />
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#30363D', strokeWidth: 1 }} />
              <LastDataLine />
              <Bar  dataKey="appRateAny"       fill={BLUE}    fillOpacity={0.6} name="Any Credit" />
              <Line type="monotone" dataKey="appRateCC"       stroke={RED}    strokeWidth={2}   dot={false} connectNulls name="Credit Card" />
              <Line type="monotone" dataKey="appRateMortgage" stroke={AMBER}  strokeWidth={2}   dot={false} connectNulls name="Mortgage" />
              <Line type="monotone" dataKey="appRateAuto"     stroke="#79C0FF" strokeWidth={1.5} dot={false} connectNulls name="Auto" />
            </ComposedChart>
          </ResponsiveContainer>
        </>
      )}

      {mode === 'discouraged' && (
        <>
          <div style={{ fontSize: '10px', color: '#8B949E', marginBottom: '8px', lineHeight: '1.6' }}>
            <span style={{ color: AMBER }}>●</span> % of households who <strong>wanted credit but did not apply</strong> fearing rejection.
            "Shadow demand" invisible in official origination data.
          </div>
          <ResponsiveContainer width="100%" height={isMobile ? 220 : 260}>
            <ComposedChart {...commonChartProps}>
              <CartesianGrid strokeDasharray="1 4" stroke="#161B22" vertical={false} />
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#30363D', strokeWidth: 1 }} />
              <LastDataLine />
              <Bar  dataKey="discouragedAny"       fill={AMBER}   fillOpacity={0.7} name="Discouraged (Any)" />
              <Line type="monotone" dataKey="discouragedCC"       stroke={RED}     strokeWidth={2}   dot={false} connectNulls name="Discouraged CC" />
              <Line type="monotone" dataKey="discouragedMortgage" stroke="#79C0FF" strokeWidth={1.5} dot={false} connectNulls name="Discouraged Mortgage" />
            </ComposedChart>
          </ResponsiveContainer>
        </>
      )}

      <div style={{ fontSize: '9px', color: '#30363D', marginTop: '6px', borderTop: '1px solid #161B22', paddingTop: '6px' }}>
        SOURCE: NY Fed SCE Credit Access Microdata · {data.length} survey waves · {data[0]?.quarter}–{lastRealQuarter}
        &nbsp;·&nbsp;Survey cadence: Feb / Jun / Oct
        &nbsp;·&nbsp;Q2–Q4 2025: pending release (axis extended for visual continuity)
      </div>
    </div>
  );
}
