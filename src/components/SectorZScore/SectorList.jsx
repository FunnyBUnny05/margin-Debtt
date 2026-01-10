import React from 'react';
import { SignalBadge } from './SignalBadge';

export const SectorList = ({ sectors, selectedSector, onSelect, isMobile }) => {
  // Filter out sectors without valid z-scores and sort by z-score ascending
  const sorted = [...sectors]
    .filter(s => s.currentZScore !== null)
    .sort((a, b) => a.currentZScore - b.currentZScore);

  return (
    <div
      className="glass-card"
      style={{
        padding: isMobile ? '20px' : '24px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <div style={{ fontSize: '20px' }}>🎯</div>
        <h3 style={{
          color: 'var(--text-primary)',
          fontSize: '15px',
          fontWeight: '600',
          margin: 0
        }}>
          Sectors (Cheapest First)
        </h3>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          maxHeight: isMobile ? '250px' : '320px'
        }}
      >
        {sorted.map((sector) => (
          <div
            key={sector.symbol}
            onClick={() => onSelect(sector.symbol)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 12px',
              marginBottom: '6px',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              background: selectedSector === sector.symbol
                ? 'linear-gradient(135deg, rgba(167, 139, 250, 0.15) 0%, rgba(167, 139, 250, 0.05) 100%)'
                : 'rgba(255, 255, 255, 0.03)',
              border: selectedSector === sector.symbol
                ? '1px solid var(--accent-purple)'
                : '1px solid transparent',
              transition: 'all var(--transition-smooth)',
              boxShadow: selectedSector === sector.symbol
                ? '0 0 20px rgba(167, 139, 250, 0.2)'
                : 'none'
            }}
            onMouseEnter={(e) => {
              if (selectedSector !== sector.symbol) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.transform = 'translateX(2px)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedSector !== sector.symbol) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                e.currentTarget.style.transform = 'translateX(0)';
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: sector.color,
                  boxShadow: `0 0 8px ${sector.color}66`,
                  border: '2px solid rgba(255,255,255,0.15)',
                  flexShrink: 0
                }}
              />
              <span style={{
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: '700'
              }}>
                {sector.symbol}
              </span>
              {!isMobile && (
                <span style={{
                  color: 'var(--text-tertiary)',
                  fontSize: '11px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {sector.name}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <span
                style={{
                  color: sector.currentZScore < 0 ? 'var(--accent-emerald)' : 'var(--accent-coral)',
                  fontWeight: '700',
                  fontSize: '13px',
                  minWidth: '50px',
                  textAlign: 'right'
                }}
              >
                {sector.currentZScore?.toFixed(2) || 'N/A'}
              </span>
              <SignalBadge zScore={sector.currentZScore} />
            </div>
          </div>
        ))}
        {sorted.length === 0 && (
          <div style={{
            color: 'var(--text-tertiary)',
            textAlign: 'center',
            padding: '40px 20px',
            fontSize: '13px'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }} className="pulse-animation">⏳</div>
            <div>Loading sector data...</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SectorList;
