/**
 * CreditMortgage/DebtBreakdown.jsx
 * ──────────────────────────────────
 * Horizontal stacked bar showing Q4 2025 household debt by category ($18.8T).
 * Alert badges pinned to Student Loans and HELOC.
 */

import React, { useState } from 'react';

export function DebtBreakdown({ breakdown }) {
  const [hoveredCategory, setHoveredCategory] = useState(null);
  const total = breakdown.totalTrillion;

  return (
    <div style={{ fontFamily: 'JetBrains Mono, monospace' }}>
      {/* Total header */}
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '10px', color: '#6E7681', letterSpacing: '1px', marginBottom: '4px' }}>
          TOTAL HOUSEHOLD DEBT — {breakdown.asOf}
        </div>
        <div style={{
          fontSize: '32px',
          fontWeight: '700',
          color: '#F0F6FC',
          letterSpacing: '-0.5px',
          lineHeight: 1,
        }}>
          ${total.toFixed(1)}T
        </div>
      </div>

      {/* Stacked bar */}
      <div style={{
        display: 'flex',
        height: '28px',
        borderRadius: '0',
        overflow: 'hidden',
        marginBottom: '12px',
        border: '1px solid #21262D',
        gap: '1px',
      }}>
        {breakdown.categories.map((cat) => {
          const pct = (cat.trillion / total) * 100;
          const isHovered = hoveredCategory === cat.label;
          return (
            <div
              key={cat.label}
              style={{
                width: `${pct}%`,
                background: cat.color,
                opacity: hoveredCategory ? (isHovered ? 1 : 0.4) : 0.85,
                transition: 'opacity 0.15s ease',
                cursor: 'pointer',
                position: 'relative',
              }}
              onMouseEnter={() => setHoveredCategory(cat.label)}
              onMouseLeave={() => setHoveredCategory(null)}
            />
          );
        })}
      </div>

      {/* Category rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {breakdown.categories.map((cat) => {
          const pct = (cat.trillion / total) * 100;
          const isHovered = hoveredCategory === cat.label;

          return (
            <div
              key={cat.label}
              onMouseEnter={() => setHoveredCategory(cat.label)}
              onMouseLeave={() => setHoveredCategory(null)}
              style={{
                padding: '8px 10px',
                borderBottom: '1px solid #161B22',
                background: isHovered ? 'rgba(255,255,255,0.03)' : 'transparent',
                cursor: 'default',
                transition: 'background 0.1s',
              }}
            >
              {/* Main row */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: cat.alert ? '6px' : '4px',
              }}>
                {/* Color dot */}
                <div style={{ width: '8px', height: '8px', background: cat.color, flexShrink: 0 }} />

                {/* Label */}
                <span style={{ color: '#C9D1D9', fontSize: '11px', fontWeight: '600', flex: 1 }}>
                  {cat.label}
                </span>

                {/* DQ badge */}
                <span style={{
                  fontSize: '9px',
                  color: cat.delinquency90 > 10 ? '#F85149' : cat.delinquency90 > 5 ? '#D29922' : '#6E7681',
                  background: cat.delinquency90 > 10 ? 'rgba(248,81,73,0.12)' : 'transparent',
                  padding: cat.delinquency90 > 10 ? '1px 5px' : '0',
                  border: cat.delinquency90 > 10 ? '1px solid rgba(248,81,73,0.3)' : 'none',
                  letterSpacing: '0.3px',
                }}>
                  {cat.delinquency90.toFixed(2)}% 90+DQ
                </span>

                {/* Amount */}
                <span style={{ color: '#F0F6FC', fontSize: '12px', fontWeight: '700', minWidth: '50px', textAlign: 'right' }}>
                  ${cat.trillion.toFixed(2)}T
                </span>

                {/* % bar */}
                <div style={{ width: '60px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{
                      flex: 1,
                      height: '4px',
                      background: '#21262D',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: cat.color,
                        opacity: 0.8,
                      }} />
                    </div>
                    <span style={{ color: '#6E7681', fontSize: '9px', flexShrink: 0 }}>
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Alert badge */}
              {cat.alert && (
                <div style={{
                  marginLeft: '16px',
                  padding: '6px 10px',
                  background: cat.color === '#F85149'
                    ? 'rgba(248,81,73,0.08)'
                    : 'rgba(240,136,62,0.08)',
                  border: `1px solid ${cat.color === '#F85149'
                    ? 'rgba(248,81,73,0.3)'
                    : 'rgba(240,136,62,0.3)'}`,
                  borderLeft: `3px solid ${cat.color}`,
                }}>
                  <div style={{
                    fontSize: '9px',
                    fontWeight: '700',
                    color: cat.color,
                    letterSpacing: '0.8px',
                    marginBottom: '3px',
                  }}>
                    ⚠ {cat.alert.label}
                  </div>
                  <div style={{
                    fontSize: '10px',
                    color: '#8B949E',
                    lineHeight: '1.5',
                  }}>
                    {cat.alert.description}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{
        margin: '8px 0 0 0',
        fontSize: '9px',
        color: '#30363D',
        lineHeight: '1.6',
        paddingTop: '8px',
        borderTop: '1px solid #161B22',
      }}>
        SOURCE: NY Fed Household Debt &amp; Credit Report, Q4 2025. Student loan 90+DQ reflects return of repayment obligation post-pandemic pause.
      </div>
    </div>
  );
}
