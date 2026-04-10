/**
 * CreditMortgage/index.jsx
 * ─────────────────────────
 * "Credit & Mortgage Sentinel" — Real data engine.
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

const BLUE   = '#38BDF8';
const RED    = '#F43F5E';
const AMBER  = '#F59E0B';
const BG     = 'var(--bb-black)';
const PANEL  = 'var(--bb-panel)';
const BORDER = 'var(--bb-border)';

// ─── Shared UI Primitives ────────────────────────────────────────────────────

function Panel({ title, accent, badge, children, style }) {
  return (
    <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 'var(--radius-md)', overflow: 'hidden', ...style }}>
      <div style={{
        background: accent ? accent : 'var(--bb-panel-alt)',
        padding: '10px 16px',
        fontFamily: 'var(--font-ui)',
        fontWeight: '600', fontSize: '13px', letterSpacing: '0.3px',
        color: accent ? '#09090b' : 'var(--bb-gray-2)',
        display: 'flex', alignItems: 'center', gap: '10px',
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <span>{title}</span>
        {badge && (
          <span style={{
            marginLeft: 'auto', background: `${RED}15`,
            border: `1px solid ${RED}40`, color: RED,
            fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-mono)'
          }}>{badge}</span>
        )}
      </div>
      <div style={{ padding: '20px 24px' }}>{children}</div>
    </div>
  );
}

function StatCard({ label, value, sub, color, alert }) {
  return (
    <div style={{
      background: PANEL, border: `1px solid ${BORDER}`,
      borderBottom: `3px solid ${color}`, padding: '20px',
      borderRadius: 'var(--radius-md)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, right: 0, width: '100px', height: '100px',
        background: `radial-gradient(circle at top right, ${color}14, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ fontFamily: 'var(--font-ui)', color: 'var(--bb-gray-2)', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: '700', color, lineHeight: 1, marginBottom: '6px' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--bb-gray-3)' }}>{sub}</div>
      )}
      {alert && (
        <div style={{ marginTop: '10px', fontSize: '12px', color: AMBER, fontFamily: 'var(--font-ui)', fontWeight: '500' }}>
          <span style={{ marginRight: '6px' }}>⚠</span>{alert}
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
      borderLeft: `4px solid ${color}`, padding: '14px 20px', cursor: 'pointer',
      borderRadius: 'var(--radius-md)',
    }} onClick={() => setExpanded(e => !e)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '16px' }}>{icon}</span>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: '600', color, flex: 1 }}>
          {label}
        </span>
        <span style={{ color: 'var(--bb-gray-3)', fontSize: '12px' }}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${color}33`, fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--bb-gray-2)', lineHeight: '1.6' }}>
          {description}
        </div>
      )}
    </div>
  );
}

function Collapsible({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: `1px solid ${BORDER}`, background: PANEL, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', background: 'var(--bb-panel-alt)', border: 'none',
        padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: 'pointer', color: 'var(--bb-gray-2)', fontFamily: 'var(--font-ui)',
        fontSize: '14px', fontWeight: '600',
      }}>
        <span>{title}</span>
        <span style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>
      {open && <div style={{ padding: '20px 24px' }}>{children}</div>}
    </div>
  );
}

function DataProvenance() {
  return (
    <div style={{
      display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '24px',
      padding: '12px 20px', background: 'var(--bb-panel)', borderRadius: 'var(--radius-md)', border: `1px solid ${BORDER}`,
      fontFamily: 'var(--font-ui)', fontSize: '13px',
    }}>
      {[
        { label: 'HHD Q4 2025', sub: '92 quarters of debt & delinquency data', color: BLUE },
        { label: 'SCE MICRODATA', sub: '37,136 survey responses · 34 quarters', color: AMBER },
        { label: 'LIVE DATA', sub: 'Extracted directly from NY Fed files', color: '#10B981' },
      ].map(({ label, sub, color }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: `${color}10`, border: `1px solid ${color}33`, borderRadius: 'var(--radius-sm)' }}>
          <span style={{ color, fontWeight: '600', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{label}</span>
          <span style={{ color: 'var(--bb-gray-2)' }}>{sub}</span>
        </div>
      ))}
    </div>
  );
}

export function CreditMortgage({ isMobile }) {
  const sentinel = useMemo(() => calcSentinelScore(SENTINEL_INPUTS, NORM_RANGES), []);

  return (
    <div style={{ background: BG, minHeight: '100vh', padding: isMobile ? '16px' : '24px' }}>
      {/* Header */}
      <div style={{ padding: '0 0 16px 0' }}>
        <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '24px', color: 'var(--bb-white)', fontWeight: '600', margin: '0 0 8px 0' }}>Credit & Mortgage Sentinel</h2>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--bb-gray-2)' }}>
          Household balance-sheet stress engine · NY Fed SCE/HHD · Q1 2003–Q4 2025
          &nbsp;·&nbsp;<strong style={{ color: AMBER, fontWeight: '600' }}>Q4 2025 Release</strong>
        </span>
      </div>

      <DataProvenance />

      {/* ① KPI Cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)',
        gap: '16px', marginBottom: '24px',
      }}>
        <StatCard label="Total Household Debt" value={`$${LATEST_DEBT.total.toFixed(2)}T`}
          sub="Q4 2025 (HHD)" color={BLUE} />
        <StatCard label="CC Rejection Rate" value={`${LATEST_SCE.rejectedCC?.toFixed(1)}%`}
          sub="of CC applicants denied (SCE Q1 2025)" color={RED}
          alert="Rising since 2022" />
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
        style={{ marginBottom: '24px' }}>
        <SCECreditChart data={SCE_QUARTERLY} isMobile={isMobile} />
      </Panel>

      {/* ③ 90+ Day Delinquency — All Categories */}
      <Panel title="90+ Day Delinquency by Debt Category — Q1 2003 – Q4 2025"
        badge={`${DELINQUENCY90.length}Q REAL DATA`}
        style={{ marginBottom: '24px' }}>
        <DelinquencyChart data={DELINQUENCY90} isMobile={isMobile} />
      </Panel>

      {/* ④ Two-column: Debt Breakdown + Sentinel Gauge */}
      <div style={{
        display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 420px',
        gap: '24px', marginBottom: '24px',
      }}>
        <Panel title="Debt Breakdown — Q4 2025 (HHD)">
          <DebtBreakdown breakdown={DEBT_BREAKDOWN} />
        </Panel>
        <Panel title="Sentinel Systemic Risk Gauge">
          <SentinelGauge sentinelResult={sentinel} components={sentinel.components} isMobile={isMobile} />
          <div style={{ marginTop: '20px', padding: '16px', background: 'var(--bb-panel-alt)', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontFamily: 'var(--font-ui)', color: 'var(--bb-gray-2)', lineHeight: '1.6' }}>
            <strong style={{ color: 'var(--bb-gray-1)' }}>Formula:</strong> CC Rejection×40% + 90+DQ×30% + Discouraged×20% + App Rate×10%
            <br />Inputs: SCE Q1&apos;25 + HHD Q4&apos;25
          </div>
        </Panel>
      </div>

      {/* ⑤ Transition Rates */}
      <Panel title="Debt Transition Rates — Quarterly Flow into Delinquency"
        badge={`${TRANSITION_MORTGAGE.length}Q REAL DATA`}
        style={{ marginBottom: '24px' }}>
        <TransitionRatesChart
          mortgageData={TRANSITION_MORTGAGE}
          consumerData={TRANSITION_CONSUMER}
          isMobile={isMobile}
        />
      </Panel>

      {/* ⑥ Alert Banners */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        <AlertBanner
          label={`Student Loan Elevating Risk: 90+ DQ at ${LATEST_DQ.student.toFixed(2)}%`}
          description={`${LATEST_DQ.student.toFixed(2)}% of student loan balances are 90+ days delinquent as of Q4 2025 — among the highest rates of any debt category. Consumer credit transition rates show ${LATEST_TRANS_CONS.to90.toFixed(1)}% of delinquent balances flowing to 90+ days per quarter, well above pre-pandemic levels. This reflects the end of the pandemic repayment pause and the exposing of structural cash-flow deficits in the student borrower population.`}
          color={RED} icon="⚡"
        />
        <AlertBanner
          label={`Discouraged Borrowers at ${LATEST_SCE.discouragedAny?.toFixed(1)}%`}
          description={`${LATEST_SCE.discouragedAny?.toFixed(1)}% of SCE respondents needed credit but did not apply because they did not believe they would be approved. This "shadow demand" suppresses both origination volume and official rejection statistics. As rates rise and credit conditions tighten further, discouraged borrower rates are likely to increase — compressing lower-income household spending before delinquencies spike.`}
          color={AMBER} icon="⚠"
        />
        <AlertBanner
          label={`Credit Card Supply Squeeze — Rejection at ${LATEST_SCE.rejectedCC?.toFixed(1)}%`}
          description={`Credit card serious delinquency at ${LATEST_DQ.cc.toFixed(2)}% is at cycle highs. Combined with a ${LATEST_SCE.rejectedCC?.toFixed(1)}% rejection rate for CC applicants and ${LATEST_SCE.discouragedCC?.toFixed(1)}% self-censoring, the consumer credit market is exhibiting simultaneous demand compression and supply restriction — a credit crunch precondition.`}
          color="#38BDF8" icon="💳"
        />
      </div>

      {/* ⑦ Glossary */}
      <Collapsible title="📖 Glossary — Credit Intelligence Terminology" defaultOpen={false}>
        <GlossaryPanel />
      </Collapsible>

      {/* Footer */}
      <div style={{
        borderTop: `1px solid ${BORDER}`, paddingTop: '20px',
        display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginTop: '24px',
      }}>
        <span style={{ fontFamily: 'var(--font-ui)', color: 'var(--bb-gray-3)', fontSize: '12px' }}>
          SENTINEL CREDIT MODULE · {DATA_SCHEMA.range}
        </span>
        <span style={{ fontFamily: 'var(--font-ui)', color: 'var(--bb-gray-3)', fontSize: '12px' }}>
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
