/**
 * CreditMortgage/GlossaryPanel.jsx
 * ─────────────────────────────────
 * Expandable accordion glossary for key credit metrics.
 */

import React, { useState } from 'react';

const TERMS = [
  {
    term: 'Discouraged Borrowers',
    abbr: null,
    definition:
      'Households that need credit — for a car, home, or emergency — but self-censor their applications because they anticipate rejection. This "shadow demand" is measured by the NY Fed SCE as the gap between households who want credit and those who actually apply. High discouragement rates suppress loan originations and mask the true demand for credit in the economy, often signaling that tightening financial conditions are more severe than official application data suggest.',
    color: '#58A6FF',
    icon: '🚫',
  },
  {
    term: 'Transition Rates',
    abbr: 'DQ Flows',
    definition:
      'The monthly percentage of a debt category flowing from one delinquency stage to the next. Key transitions tracked by the NY Fed HHD Report: Current → 30+ DPD (early stress), 30 DPD → 60 DPD (escalating), 60 DPD → 90+ DPD (serious delinquency). Rising transition rates are a compounding signal — they indicate that borrowers who fell behind are failing to cure, accelerating the pipeline toward default and charge-off.',
    color: '#F85149',
    icon: '📉',
  },
  {
    term: 'Financial Fragility',
    abbr: 'SCE $2K Metric',
    definition:
      'The share of households that report being "probably not" or "certainly not" able to come up with $2,000 within 30 days if an unexpected need arose. Tracked quarterly by the NY Fed Survey of Consumer Expectations (SCE). This metric is a leading indicator of default risk: households with no liquidity buffer are one paycheck away from missing a debt payment. As fragility rises, the systemic risk of cascading delinquencies across multiple debt categories increases non-linearly.',
    color: '#D29922',
    icon: '💸',
  },
  {
    term: 'Credit Freeze Signal',
    abbr: null,
    definition:
      'A condition triggered when lenders simultaneously tighten underwriting standards (reducing approvals) while rejection rates climb above ~40%. The dual effect — tighter supply and increased denial — causes "credit starvation" in consumer spending. Historically, credit freeze conditions precede broadening delinquency waves by 2–3 quarters, as households first exhaust savings, then miss payments. The Sentinel Lead-Lag chart visualizes this relationship by shifting rejection rates forward two quarters.',
    color: '#8B949E',
    icon: '🔒',
  },
  {
    term: 'Equity Tapping',
    abbr: 'HELOC Signal',
    definition:
      'The use of home equity lines of credit (HELOC) to fund everyday spending rather than home improvements — indicative of households under sustained cash-flow stress. When HELOC balances rise alongside declining consumer sentiment and stagnating wage growth, it suggests that home price appreciation is being used as an ATM to sustain consumption levels. This late-cycle behavior historically peaks shortly before housing market corrections.',
    color: '#F0883E',
    icon: '🏠',
  },
];

export function GlossaryPanel() {
  const [openIndex, setOpenIndex] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = TERMS.filter(t =>
    t.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.abbr && t.abbr.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div style={{ fontFamily: 'JetBrains Mono, monospace' }}>
      {/* Search */}
      <div style={{ marginBottom: '12px', position: 'relative' }}>
        <input
          type="text"
          placeholder="Search glossary..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            background: '#161B22',
            border: '1px solid #30363D',
            color: '#C9D1D9',
            padding: '7px 12px 7px 32px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '11px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <span style={{
          position: 'absolute',
          left: '10px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#6E7681',
          fontSize: '12px',
          pointerEvents: 'none',
        }}>🔍</span>
      </div>

      {filtered.length === 0 ? (
        <div style={{ color: '#6E7681', fontSize: '11px', padding: '8px 0', textAlign: 'center' }}>
          No terms match "{searchTerm}"
        </div>
      ) : (
        filtered.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div
              key={item.term}
              style={{
                borderBottom: '1px solid #161B22',
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => setOpenIndex(isOpen ? null : i)}
                style={{
                  width: '100%',
                  background: isOpen ? 'rgba(255,255,255,0.03)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  textAlign: 'left',
                  transition: 'background 0.1s',
                }}
              >
                <span style={{ fontSize: '14px', flexShrink: 0 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '11px',
                    fontWeight: '700',
                    color: item.color,
                    letterSpacing: '0.3px',
                  }}>
                    {item.term}
                  </span>
                  {item.abbr && (
                    <span style={{ marginLeft: '8px', color: '#6E7681', fontSize: '9px', letterSpacing: '0.3px' }}>
                      [{item.abbr}]
                    </span>
                  )}
                </span>
                <span style={{
                  color: '#6E7681',
                  fontSize: '12px',
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                  flexShrink: 0,
                }}>▾</span>
              </button>

              {isOpen && (
                <div style={{
                  padding: '0 12px 12px 36px',
                  color: '#8B949E',
                  fontSize: '11px',
                  lineHeight: '1.7',
                  borderLeft: `2px solid ${item.color}`,
                  marginLeft: '12px',
                  marginBottom: '4px',
                  animation: 'glossaryIn 0.15s ease',
                }}>
                  {item.definition}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
