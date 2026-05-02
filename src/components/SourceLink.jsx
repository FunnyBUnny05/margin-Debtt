import React from 'react';

export const SourceLink = ({ href, label, note }) => (
  <div style={{
    padding: '10px 0',
    marginTop: '4px',
    marginBottom: '20px',
    fontFamily: 'var(--font-mono)',
    fontSize: '8px',
    letterSpacing: '0.14em',
    color: 'var(--text-dim)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    borderTop: '1px solid var(--rule)',
  }}>
    <span style={{ textTransform: 'uppercase', whiteSpace: 'nowrap' }}>SOURCE:</span>
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: 'var(--accent)', textDecoration: 'none' }}
      onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
      onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
    >
      {label}
    </a>
    {note && <span>— {note}</span>}
  </div>
);
