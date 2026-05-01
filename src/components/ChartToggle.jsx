import React from 'react';

const DEFAULT_OPTIONS = ['line', 'bar'];

export const ChartToggle = ({ type, setType, options = DEFAULT_OPTIONS }) => (
  <div style={{
    display: 'flex',
    background: 'var(--bb-black)',
    border: '1px solid var(--bb-border-light)',
    overflow: 'hidden',
    borderRadius: 'var(--radius-md)',
  }}>
    {options.map(opt => (
      <button
        key={opt}
        onClick={() => setType(opt)}
        style={{
          background: type === opt ? 'var(--bb-border-light)' : 'transparent',
          color: type === opt ? 'var(--bb-white)' : 'var(--bb-gray-2)',
          border: 'none',
          padding: '4px 10px',
          fontSize: '9px',
          fontFamily: 'var(--font-mono)',
          cursor: 'pointer',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          transition: 'color 0.08s ease, background 0.08s ease',
        }}
      >
        {opt}
      </button>
    ))}
  </div>
);
