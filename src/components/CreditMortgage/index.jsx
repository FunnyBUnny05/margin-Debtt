/**
 * CreditMortgage/index.jsx
 * ─────────────────────────
 * "Credit & Mortgage Sentinel" — Predictive engine for U.S. consumer credit stress.
 *
 * Layout:
 *   ① Stat Cards Row (4 KPIs)
 *   ② Lead-Lag Prediction Chart (full width)
 *   ③ Two-column: Debt Breakdown | Sentinel Gauge
 *   ④ Global Alert Banners
 *   ⑤ Glossary Panel
 *   ⑥ Data Ingestion (collapsible)
 *
 * Design tokens:
 *   --cm-blue   #58A6FF  (leading indicators / info)
 *   --cm-red    #F85149  (lagging / risk)
 *   --cm-bg     #0D1117  (panel background — deeper than Bloomberg black)
 *   --cm-border #21262D
 *   --cm-amber  #D29922  (caution)
 */

import React, { useState, useMemo } from 'react';
import { QUARTERLY_DATA, DEBT_BREAKDOWN, SENTINEL_INPUTS } from './data';
import { buildChartData, calcSentinelScore } from './utils';
import { LeadLagChart }   from './LeadLagChart';
import { SentinelGauge }  from './SentinelGauge';
import { DebtBreakdown }  from './DebtBreakdown';
import { GlossaryPanel }  from './GlossaryPanel';
import { DataIngestion }  from './DataIngestion';

const BLUE  = '#58A6FF';
const RED   = '#F85149';
const AMBER = '#D29922';
const BG    = '#0D1117';
const BORDER = '#21262D';

// ─── Panel wrapper ───────────────────────────────────────────────────────────
function Panel({ title, accent, children, style }) {
  return (
    <div style={{
      background: BG,
      border: `1px solid ${BORDER}`,
      ...(style || {}),
    }}>
      <div style={{
        background: accent || '#161B22',
        padding: '4px 10px',
        margin: '-1px -1px 0 -1px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: '700',
        fontSize: '10px',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        color: accent ? '#0D1117' : '#6E7681',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        {title}
      </div>
      <div style={{ padding: '14px 16px' }}>
        {children}
      </div>
    </div>
  );
}

// ─── KPI Stat Card ───────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, alert }) {
  return (
    <div style={{
      background: BG,
      border: `1px solid ${BORDER}`,
      borderLeft: `3px solid ${color}`,
      padding: '12px 16px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* subtle glow in corner */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: '60px', height: '60px',
        background: `radial-gradient(circle at top right, ${color}18, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{
        fontFamily: 'Inter, sans-serif',
        color: '#FCD34D',
        fontSize: '9px',
        fontWeight: '700',
        marginBottom: '6px',
        textTransform: 'uppercase',
        letterSpacing: '0.8px',
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '24px',
        fontWeight: '700',
        color,
        lineHeight: 1,
        marginBottom: '4px',
      }}>
        {value}
      </div>
      {sub && (
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '10px',
          color: '#6E7681',
        }}>
          {sub}
        </div>
      )}
      {alert && (
        <div style={{
          marginTop: '5px',
          fontSize: '9px',
          color: AMBER,
          fontFamily: 'JetBrains Mono, monospace',
          letterSpacing: '0.3px',
        }}>
          ⚠ {alert}
        </div>
      )}
    </div>
  );
}

// ─── Alert Banner ────────────────────────────────────────────────────────────
function AlertBanner({ label, description, color, icon }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{
      background: `${color}10`,
      border: `1px solid ${color}44`,
      borderLeft: `4px solid ${color}`,
      padding: '10px 14px',
      cursor: 'pointer',
    }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '14px' }}>{icon}</span>
        <span style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '10px',
          fontWeight: '700',
          color,
          letterSpacing: '0.8px',
          flex: 1,
        }}>
          ALERT: {label}
        </span>
        <span style={{ color: '#6E7681', fontSize: '11px' }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>
      {expanded && (
        <div style={{
          marginTop: '8px',
          paddingTop: '8px',
          borderTop: `1px solid ${color}33`,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '11px',
          color: '#8B949E',
          lineHeight: '1.7',
        }}>
          {description}
        </div>
      )}
    </div>
  );
}

// ─── Collapsible Section ─────────────────────────────────────────────────────
function Collapsible({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: `1px solid ${BORDER}`, background: BG }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          background: '#161B22',
          border: 'none',
          padding: '9px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          color: '#8B949E',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '10px',
          fontWeight: '700',
          letterSpacing: '0.8px',
          textTransform: 'uppercase',
        }}
      >
        <span>{title}</span>
        <span style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>
      {open && (
        <div style={{ padding: '14px 16px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function CreditMortgage({ isMobile }) {
  const [customData, setCustomData] = useState(null);

  const rawData = customData ?? QUARTERLY_DATA;
  const chartData = useMemo(() => buildChartData(rawData), [rawData]);
  const sentinel  = useMemo(() => calcSentinelScore(SENTINEL_INPUTS), []);
  const latest    = rawData[rawData.length - 1];

  return (
    <div style={{ background: BG, minHeight: '100vh' }}>
      {/* ── Header ── */}
      <div style={{
        padding: '10px 16px 10px',
        borderBottom: `1px solid ${BORDER}`,
        background: '#0D1117',
      }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '10px',
          color: '#6E7681',
          letterSpacing: '0.5px',
        }}>
          Credit conditions & household balance-sheet stress — NY Fed SCE / HHD
          &nbsp;·&nbsp;
          <span style={{ color: AMBER }}>Q4 2025</span>
        </div>
      </div>

      {/* ── ① KPI Cards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
        gap: '1px',
        background: BORDER,
        marginBottom: '1px',
      }}>
        <StatCard
          label="Total Household Debt"
          value={`$${DEBT_BREAKDOWN.totalTrillion}T`}
          sub={`as of ${DEBT_BREAKDOWN.asOf}`}
          color={BLUE}
        />
        <StatCard
          label="Credit Rejection Rate"
          value={`${latest.rejectionRate}%`}
          sub="of all applicants denied"
          color={BLUE}
          alert="↑ High rejection → credit freeze risk"
        />
        <StatCard
          label="90+ Day Delinquency"
          value={`${latest.delinquency90}%`}
          sub="of all balances (all debt)"
          color={RED}
        />
        <StatCard
          label="Sentinel Risk Score"
          value={`${sentinel.score.toFixed(0)}/100`}
          sub={sentinel.label}
          color={sentinel.color}
          alert={sentinel.score >= 50 ? 'Systemic stress threshold breached' : null}
        />
      </div>

      {/* ── ② Alert Banners ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', marginBottom: '1px', background: BORDER }}>
        <AlertBanner
          label="Student Loan Delinquency — 16.19% (LIQUIDITY SHOCK TRIGGER)"
          description="16.19% of student loan balances are now 90+ days past due — the highest delinquency rate of any consumer debt category. The post-pandemic restart of repayment obligations has exposed millions of borrowers with insufficient cash flow to service these debts. Historically, student loan delinquency spikes have preceded broader consumer credit deterioration by 2–4 quarters, as households experiencing education debt distress reduce spending and begin missing payments on other obligations."
          color={RED}
          icon="⚡"
        />
        <AlertBanner
          label="HELOC Utilization Rising — Equity Tapping Signal of Household Cash-Flow Stress"
          description="Rising HELOC balances are a late-cycle signal indicating households are liquidating home equity to cover everyday expenses like groceries, utilities, and debt service — rather than productive investment. When housing wealth appreciation is used as an income substitute, it creates a fragile debt-to-asset dynamic: a modest correction in home prices could cause simultaneous net worth destruction and a HELOC-driven credit crunch."
          color={AMBER}
          icon="🏠"
        />
      </div>

      {/* ── ② Lead-Lag Prediction Chart ── */}
      <Panel
        title="Lead-Lag Prediction Engine — Credit Rejection vs. Delinquency"
        accent={null}
        style={{ marginBottom: '1px' }}
      >
        <LeadLagChart data={chartData} isMobile={isMobile} />
      </Panel>

      {/* ── ③ Two-column: Debt Breakdown + Sentinel Gauge ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 420px',
        gap: '1px',
        background: BORDER,
        marginBottom: '1px',
      }}>
        <Panel title="Debt Breakdown — Q4 2025" accent={null}>
          <DebtBreakdown breakdown={DEBT_BREAKDOWN} />
        </Panel>

        <Panel
          title="Sentinel Systemic Risk Gauge"
          accent={null}
          style={{ borderLeft: `3px solid ${sentinel.color}` }}
        >
          <SentinelGauge
            sentinelResult={sentinel}
            components={sentinel.components}
            isMobile={isMobile}
          />
        </Panel>
      </div>

      {/* ── ⑤ Glossary ── */}
      <Collapsible title="📖 Glossary — Credit Intelligence Terminology" defaultOpen={false}>
        <GlossaryPanel />
      </Collapsible>

      {/* ── ⑥ Data Ingestion ── */}
      <div style={{ marginTop: '1px' }}>
        <Collapsible title="⬆ Load Custom Data (CSV / JSON)" defaultOpen={false}>
          <DataIngestion onDataLoaded={setCustomData} />
          {customData && (
            <div style={{ marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#56D364' }}>
                ✓ Using custom dataset ({customData.length} rows)
              </span>
              <button
                onClick={() => setCustomData(null)}
                style={{
                  background: 'none',
                  border: '1px solid #30363D',
                  color: '#8B949E',
                  cursor: 'pointer',
                  padding: '2px 8px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '9px',
                }}
              >
                RESET TO DEFAULT
              </button>
            </div>
          )}
        </Collapsible>
      </div>

      {/* ── Footer ── */}
      <div style={{
        borderTop: `1px solid ${BORDER}`,
        padding: '10px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '6px',
        marginTop: '1px',
      }}>
        <span style={{
          fontFamily: 'JetBrains Mono, monospace',
          color: '#30363D',
          fontSize: '9px',
          letterSpacing: '0.5px',
        }}>
          SENTINEL CREDIT MODULE
        </span>
        <span style={{
          fontFamily: 'JetBrains Mono, monospace',
          color: '#30363D',
          fontSize: '9px',
        }}>
          SRC: NY Fed SCE Credit Access Survey · NY Fed HHD &amp; Credit Report · FRED
        </span>
      </div>

      {/* Keyframe for glossary expand */}
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
