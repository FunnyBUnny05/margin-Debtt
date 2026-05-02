import React from 'react';

export const ChartTooltip = ({ active, payload, label, formatValue }) => {
  if (!active || !payload?.length) return null;
  const fmt = formatValue ?? (p => typeof p.value === 'number' ? p.value.toFixed(2) : p.value);
  return (
    <div style={{
      background: 'var(--bg-raised)',
      border: '1px solid var(--rule-strong)',
      padding: '10px 14px',
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.14em', color: 'var(--text-dim)', marginBottom: '6px' }}>
        {label}
      </div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '400', letterSpacing: '-0.02em', color: p.color || 'var(--text)', lineHeight: 1.2 }}>
          {fmt(p)}
          {payload.length > 1 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.1em', color: 'var(--text-dim)', marginLeft: '6px', verticalAlign: 'middle' }}>
              {p.name}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};
