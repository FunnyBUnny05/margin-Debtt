import React from 'react';
import { SignalBadge } from './SignalBadge';

export const SectorList = ({ sectors, selectedSector, onSelect, isMobile }) => {
  // Filter out sectors without valid z-scores and sort by z-score ascending
  const sorted = [...sectors]
    .filter(s => s.currentZScore !== null)
    .sort((a, b) => a.currentZScore - b.currentZScore);

  return (
    <div
      style={{
        background: '#1a1a2e',
        borderRadius: '8px',
        padding: '16px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <h3 style={{ color: '#fff', fontSize: '14px', margin: '0 0 12px 0' }}>
        Sectors by Z-Score (Cheapest First)
      </h3>
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
              padding: '8px 10px',
              marginBottom: '4px',
              borderRadius: '4px',
              cursor: 'pointer',
              background: selectedSector === sector.symbol ? '#3b82f61a' : 'transparent',
              border: selectedSector === sector.symbol ? '1px solid #3b82f6' : '1px solid transparent',
              transition: 'background 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: sector.color,
                  flexShrink: 0
                }}
              />
              <span style={{ color: '#e0e0e0', fontSize: '13px', fontWeight: 'bold' }}>
                {sector.symbol}
              </span>
              {!isMobile && (
                <span style={{ color: '#888', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sector.name}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <span
                style={{
                  color: sector.currentZScore < 0 ? '#22c55e' : '#ef4444',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  minWidth: '45px',
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
          <div style={{ color: '#666', textAlign: 'center', padding: '20px', fontSize: '13px' }}>
            Loading sector data...
          </div>
        )}
      </div>
    </div>
  );
};

export default SectorList;
