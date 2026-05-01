import React from 'react';

const defaultFormat = (p) =>
  typeof p.value === 'number' ? p.value.toFixed(2) : p.value;

export const ChartTooltip = ({ active, payload, label, formatValue = defaultFormat }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip glass-card" style={{ padding: '12px 16px' }}>
      <p style={{ color: 'var(--text-primary)', margin: 0, fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
        {label}
      </p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: '4px 0 0', fontSize: 13, fontWeight: 500 }}>
          {p.name}: {formatValue(p)}
        </p>
      ))}
    </div>
  );
};
