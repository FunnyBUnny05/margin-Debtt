import React from 'react';

const DEFAULT_OPTIONS = ['line', 'bar'];

export const ChartToggle = ({ type, setType, options = DEFAULT_OPTIONS }) => (
  <div style={{ display: 'flex', background: '#0B0F19', border: '1px solid #1F2937', overflow: 'hidden' }}>
    {options.map(opt => (
      <button
        key={opt}
        onClick={() => setType(opt)}
        style={{
          background: type === opt ? '#4B5563' : 'transparent',
          color: type === opt ? '#F9FAFB' : '#6B7280',
          border: 'none',
          padding: '2px 8px',
          fontSize: '9px',
          fontFamily: 'var(--font-mono)',
          cursor: 'pointer',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {opt}
      </button>
    ))}
  </div>
);
