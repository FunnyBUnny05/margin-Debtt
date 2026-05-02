import React from 'react';

const DEFAULT_OPTIONS = ['line', 'bar'];

export const ChartToggle = ({ type, setType, options = DEFAULT_OPTIONS }) => (
  <div style={{ display: 'flex', gap: '4px' }}>
    {options.map(opt => (
      <button
        key={opt}
        onClick={() => setType(opt)}
        className={`chart-btn ${type === opt ? 'active' : ''}`}
      >
        {opt}
      </button>
    ))}
  </div>
);
