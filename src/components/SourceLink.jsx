import React from 'react';

export const SourceLink = ({ href, label, note }) => (
  <div style={{
    padding: '10px 0',
    marginTop: '4px',
    marginBottom: '20px',
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    color: 'var(--bb-gray-3)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    borderTop: '1px solid var(--bb-border-light)',
  }}>
    <span style={{ color: 'var(--bb-gray-4)', textTransform: 'uppercase', letterSpacing: '1px', whiteSpace: 'nowrap' }}>
      DATA SOURCE:
    </span>
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: 'var(--bb-cyan)', textDecoration: 'none' }}
      onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
      onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
    >
      {label}
    </a>
    {note && (
      <span style={{ color: 'var(--bb-gray-4)' }}>— {note}</span>
    )}
  </div>
);
