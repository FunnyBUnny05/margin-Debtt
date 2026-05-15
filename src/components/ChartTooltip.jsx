import React from 'react';

export const ChartTooltip = ({ active, payload, label, formatValue }) => {
  if (!active || !payload?.length) return null;
  const fmt = formatValue ?? (p => typeof p.value === 'number' ? p.value.toFixed(2) : p.value);
  return (
    <div style={{
      background: 'var(--bb-panel)',
      border: '1px solid var(--bb-border-light)',
      padding: '12px 16px',
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.5px', color: 'var(--bb-gray-3)', marginBottom: '6px' }}>
        {label}
      </div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: '700', color: p.color || 'var(--bb-white)', lineHeight: 1.3 }}>
          {fmt(p)}
          {payload.length > 1 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--bb-gray-2)', marginLeft: '6px', verticalAlign: 'middle' }}>
              {p.name}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};
