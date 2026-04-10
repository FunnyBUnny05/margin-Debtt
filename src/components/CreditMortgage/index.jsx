/**
 * CreditMortgage/index.jsx
 * ─────────────────────────
 * "Credit & Mortgage Sentinel" — Real data engine.
 *
 * Data sources:
 *   NY Fed HHD Q4 2025 — 92 quarters (Q1 2003 – Q4 2025)
 *   NY Fed SCE Credit Access Microdata — 34 quarters (Q4 2013 – Q1 2025)
 *
 * Layout:
 *   ① Stat Cards Row
 *   ② SCE Credit Access (Rejection / Application / Discouraged)
 *   ③ 90+ Day Delinquency by Category (multi-series HHD)
 *   ④ Two-column: Debt Breakdown | Sentinel Gauge
 *   ⑤ Transition Rates (mortgage + consumer)
 *   ⑥ Alert Banners
 *   ⑦ Glossary Panel
 */

import React, { useMemo, useState } from 'react';
import {
  DEBT_BALANCE, DELINQUENCY90, TRANSITION_MORTGAGE, TRANSITION_CONSUMER,
  SCE_QUARTERLY, LATEST_DEBT, LATEST_DQ, LATEST_SCE, LATEST_TRANS_CONS,
  SENTINEL_INPUTS, NORM_RANGES, DEBT_BREAKDOWN, DATA_SCHEMA,
} from './data';
import { calcSentinelScore } from './utils';
import { SentinelGauge }         from './SentinelGauge';
import { DebtBreakdown }         from './DebtBreakdown';
import { DelinquencyChart }      from './DelinquencyChart';
import { SCECreditChart }        from './SCECreditChart';
import { TransitionRatesChart }  from './TransitionRatesChart';
import { GlossaryPanel }         from './GlossaryPanel';

const BLUE   = '#58A6FF';
const RED    = '#F85149';
const AMBER  = '#D29922';
const BG     = '#0D1117';
const BORDER = '#21262D';

// ─── Shared UI Primitives ────────────────────────────────────────────────────

function Panel({ title, accent, badge, children, style }) {
  return (
    <div style={{ background: BG, border: `1px solid ${BORDER}`, ...style }}>
      <div style={{
        background: accent ? accent : '#161B22',
        padding: '5px 12px',
        margin: '-1px -1px 0 -1px',
        fontFamily: 'JetBrains Mono, monospace',
        fontWeight: '700', fontSize: '10px', letterSpacing: '1px',
        color: accent ? '#0D1117' : '#8B949E',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <span>{title}</span>
        {badge && (
          <span style={{
            marginLeft: 'auto', background: `${RED}22`,
            border: `1px solid ${RED}55`, color: RED,
            fontSize: '9px', padding: '1px 6px', letterSpacing: '0.3px',
          }}>{badge}</span>
        )}
      </div>
      <div style={{ padding: '14px 16px' }}>{children}</div>
    </div>
  );
}

function StatCard({ label, value, sub, color, alert, trend }) {
  return (
    <div style={{
      background: BG, border: `1px solid ${BORDER}`,
      borderLeft: `3px solid ${color}`, padding: '12px 16px',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, right: 0, width: '70px', height: '70px',
        background: `radial-gradient(circle at top right, ${color}14, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ fontFamily: 'Inter, sans-serif', color: '#FCD34D', fontSize: '9px', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '22px', fontWeight: '700', color, lineHeight: 1, marginBottom: '3px' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '9px', color: '#6E7681' }}>{sub}</div>
      )}
      {alert && (
        <div style={{ marginTop: '5px', fontSize: '9px', color: AMBER, fontFamily: 'JetBrains Mono, monospace' }}>
          ⚠ {alert}
        </div>
      )}
    </div>
  );
}

function AlertBanner({ label, description, color, icon }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{
      background: `${color}0C`, border: `1px solid ${color}44`,
      borderLeft: `4px solid ${color}`, padding: '10px 14px', cursor: 'pointer',
    }} onClick={() => setExpanded(e => !e)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '14px' }}>{icon}</span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', fontWeight: '700', color, flex: 1, letterSpacing: '0.8px' }}>
          ALERT: {label}
        </span>
        <span style={{ color: '#6E7681', fontSize: '11px' }}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${color}33`, fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#8B949E', lineHeight: '1.7' }}>
          {description}
        </div>
      )}
    </div>
  );
}

function Collapsible({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: `1px solid ${BORDER}`, background: BG }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', background: '#161B22', border: 'none',
        padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: 'pointer', color: '#8B949E', fontFamily: 'JetBrains Mono, monospace',
        fontSize: '10px', fontWeight: '700', letterSpacing: '0.8px', textTransform: 'uppercase',
      }}>
        <span>{title}</span>
        <span style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>
      {open && <div style={{ padding: '14px 16px' }}>{children}</div>}
    </div>
  );
}

// ─── Data Source Badge ───────────────────────────────────────────────────────
function DataProvenance() {
  return (
    <div style={{
      display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '1px',
      padding: '6px 12px', background: '#0A0D12', borderBottom: `1px solid ${BORDER}`,
      fontFamily: 'JetBrains Mono, monospace', fontSize: '9px',
    }}>
      {[
        { label: 'HHD Q4 2025', sub: '92 quarters of debt & delinquency data', color: BLUE },
        { label: 'SCE MICRODATA', sub: '37,136 survey responses · 34 quarters', color: AMBER },
        { label: 'LIVE DATA', sub: 'Extracted directly from NY Fed files', color: '#56D364' },
      ].map(({ label, sub, color }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 8px', background: `${color}10`, border: `1px solid ${color}33` }}>
          <span style={{ color, fontWeight: '700' }}>{label}</span>
          <span style={{ color: '#6E7681' }}>{sub}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function CreditMortgage({ isMobile }) {
  const sentinel = useMemo(() => calcSentinelScore(SENTINEL_INPUTS, NORM_RANGES), []);

  return (
    <div style={{ background: BG, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ padding: '8px 16px', borderBottom: `1px solid ${BORDER}`, background: '#0D1117' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#6E7681' }}>
          Household balance-sheet stress engine · NY Fed SCE/HHD · Q1 2003–Q4 2025
          &nbsp;·&nbsp;<span style={{ color: AMBER }}>Q4 2025</span>
        </span>
      </div>

      {/* Data provenance */}
      <DataProvenance />

      {/* ① KPI Cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)',
        gap: '1px', background: BORDER, marginBottom: '1px',
      }}>
        <StatCard label="Total Household Debt" value={`$${LATEST_DEBT.total.toFixed(2)}T`}
          sub="Q4 2025 (HHD)" color={BLUE} />
        <StatCard label="CC Rejection Rate" value={`${LATEST_SCE.rejectedCC?.toFixed(1)}%`}
          sub="of CC applicants denied (SCE Q1 2025)" color={RED}
          alert="↑ Rising since 2022" />
        <StatCard label="90+ DQ — All Debt" value={`${LATEST_DQ.all?.toFixed(2)}%`}
          sub="of all balances (HHD Q4 2025)" color={RED} />
        <StatCard label="Discouraged Borrowers" value={`${LATEST_SCE.discouragedAny?.toFixed(1)}%`}
          sub="didn't apply fearing rejection (SCE)" color={AMBER}
          alert="Shadow demand invisible in app data" />
        <StatCard label="Sentinel Risk Score" value={`${sentinel.score.toFixed(0)}/100`}
          sub={sentinel.label} color={sentinel.color}
          alert={sentinel.score >= 50 ? 'Stress threshold breached' : null} />
      </div>

      {/* ② SCE Credit Access */}
      <Panel title="SCE Credit Access — Rejection · Application · Discouraged Borrowers"
        badge={`${SCE_QUARTERLY.length}Q REAL DATA`}
        style={{ marginBottom: '1px' }}>
        <SCECreditChart data={SCE_QUARTERLY} isMobile={isMobile} />
      </Panel>

      {/* ③ 90+ Day Delinquency — All Categories */}
      <Panel title="90+ Day Delinquency by Debt Category — Q1 2003 – Q4 2025"
        badge={`${DELINQUENCY90.length}Q REAL DATA`}
        style={{ marginBottom: '1px' }}>
        <DelinquencyChart data={DELINQUENCY90} isMobile={isMobile} />
      </Panel>

      {/* ④ Two-column: Debt Breakdown + Sentinel Gauge */}
      <div style={{
        display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 420px',
        gap: '1px', background: BORDER, marginBottom: '1px',
      }}>
        <Panel title="Debt Breakdown — Q4 2025 (HHD)">
          <DebtBreakdown breakdown={DEBT_BREAKDOWN} />
        </Panel>
        <Panel title="Sentinel Systemic Risk Gauge" style={{ borderLeft: `3px solid ${sentinel.color}` }}>
          <SentinelGauge sentinelResult={sentinel} components={sentinel.components} isMobile={isMobile} />
          <div style={{ marginTop: '12px', padding: '8px 10px', background: '#161B22', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#6E7681', lineHeight: '1.6' }}>
            <strong style={{ color: '#C9D1D9' }}>Formula:</strong> CC Rejection×40% + 90+DQ×30% + Discouraged×20% + App Rate×10%
            <br />Inputs: SCE Q1&apos;25 + HHD Q4&apos;25
          </div>
        </Panel>
      </div>

      {/* ⑤ Transition Rates */}
      <Panel title="Debt Transition Rates — Quarterly Flow into Delinquency"
        badge={`${TRANSITION_MORTGAGE.length}Q REAL DATA`}
        style={{ marginBottom: '1px' }}>
        <TransitionRatesChart
          mortgageData={TRANSITION_MORTGAGE}
          consumerData={TRANSITION_CONSUMER}
          isMobile={isMobile}
        />
      </Panel>

      {/* ⑥ Alert Banners */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', marginBottom: '1px', background: BORDER }}>
        <AlertBanner
          label={`Student Loan 90+ DQ: ${LATEST_DQ.student.toFixed(2)}% — SERIOUS DELINQUENCY ELEVATED`}
          description={`${LATEST_DQ.student.toFixed(2)}% of student loan balances are 90+ days delinquent as of Q4 2025 — among the highest rates of any debt category. Consumer credit transition rates show ${LATEST_TRANS_CONS.to90.toFixed(1)}% of delinquent balances flowing to 90+ days per quarter, well above pre-pandemic levels. This reflects the end of the pandemic repayment pause and the exposing of structural cash-flow deficits in the student borrower population.`}
          color={RED} icon="⚡"
        />
        <AlertBanner
          label={`Discouraged Borrowers at ${LATEST_SCE.discouragedAny?.toFixed(1)}% — Shadow Demand Invisible in Origination Data`}
          description={`${LATEST_SCE.discouragedAny?.toFixed(1)}% of SCE respondents needed credit but did not apply because they did not believe they would be approved. This "shadow demand" suppresses both origination volume and official rejection statistics. As rates rise and credit conditions tighten further, discouraged borrower rates are likely to increase — compressing lower-income household spending before delinquencies spike.`}
          color={AMBER} icon="⚠"
        />
        <AlertBanner
          label={`Credit Card 90+ DQ at ${LATEST_DQ.cc.toFixed(2)}% — CC Rejection Rate ${LATEST_SCE.rejectedCC?.toFixed(1)}%`}
          description={`Credit card serious delinquency at ${LATEST_DQ.cc.toFixed(2)}% is at cycle highs. Combined with a ${LATEST_SCE.rejectedCC?.toFixed(1)}% rejection rate for CC applicants and ${LATEST_SCE.discouragedCC?.toFixed(1)}% self-censoring, the consumer credit market is exhibiting simultaneous demand compression and supply restriction — a credit crunch precondition.`}
          color="#D29922" icon="💳"
        />
      </div>

      {/* ⑦ Glossary */}
      <Collapsible title="📖 Glossary — Credit Intelligence Terminology" defaultOpen={false}>
        <GlossaryPanel />
      </Collapsible>

      {/* Footer */}
      <div style={{
        borderTop: `1px solid ${BORDER}`, padding: '10px 16px',
        display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', marginTop: '1px',
      }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#30363D', fontSize: '9px' }}>
          SENTINEL CREDIT MODULE · {DATA_SCHEMA.range}
        </span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#30363D', fontSize: '9px' }}>
          SRC: NY Fed HHD Q4 2025 · SCE Credit Access Microdata · Equifax/CCCP
        </span>
      </div>

      <style>{`
        @keyframes glossaryIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default CreditMortgage;
