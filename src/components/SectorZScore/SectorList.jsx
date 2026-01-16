import React, { useState } from 'react';
import { SignalBadge } from './SignalBadge';

export const SectorList = ({ sectors, selectedSector, onSelect, isMobile }) => {
  const [expandedSector, setExpandedSector] = useState(null);

  // Filter out sectors without valid z-scores and sort by z-score ascending
  const sorted = [...sectors]
    .filter(s => s.currentZScore !== null)
    .sort((a, b) => a.currentZScore - b.currentZScore);

  const toggleExpand = (symbol, e) => {
    e.stopPropagation();
    setExpandedSector(expandedSector === symbol ? null : symbol);
  };

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
          maxHeight: isMobile ? '250px' : '420px'
        }}
      >
        {sorted.map((sector) => (
          <div key={sector.symbol} style={{ marginBottom: '6px' }}>
            <div
              onClick={() => onSelect(sector.symbol)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <button
                  onClick={(e) => toggleExpand(sector.symbol, e)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-tertiary)';
                  }}
                  title="Show breakdown"
                >
                  {expandedSector === sector.symbol ? '▼' : '▶'}
                </button>
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

            {/* Expanded Details */}
            {expandedSector === sector.symbol && sector.structuralBaseline !== null && (
              <div style={{
                marginTop: '4px',
                padding: '12px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(167, 139, 250, 0.2)',
                fontSize: '11px',
                lineHeight: '1.6'
              }}>
                <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
                  📊 Breakdown:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>Structural Baseline:</span>
                    <span style={{
                      color: sector.structuralBaseline < 0 ? 'var(--accent-coral)' : 'var(--accent-emerald)',
                      fontWeight: '600'
                    }}>
                      {sector.structuralBaseline >= 0 ? '+' : ''}{sector.structuralBaseline.toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>Current Relative Return:</span>
                    <span style={{
                      color: sector.relativeReturn < 0 ? 'var(--accent-coral)' : 'var(--accent-emerald)',
                      fontWeight: '600'
                    }}>
                      {sector.relativeReturn >= 0 ? '+' : ''}{sector.relativeReturn.toFixed(2)}%
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    paddingTop: '6px',
                    marginTop: '6px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>Excess Return:</span>
                    <span style={{
                      color: sector.excessReturn < 0 ? 'var(--accent-coral)' : 'var(--accent-emerald)',
                      fontWeight: '700'
                    }}>
                      {sector.excessReturn >= 0 ? '+' : ''}{sector.excessReturn.toFixed(2)}%
                    </span>
                  </div>
                  <div style={{
                    marginTop: '8px',
                    padding: '6px 8px',
                    background: sector.currentZScore <= -2
                      ? 'rgba(81, 207, 102, 0.1)'
                      : sector.currentZScore >= 2
                      ? 'rgba(255, 107, 107, 0.1)'
                      : 'rgba(99, 102, 241, 0.1)',
                    borderRadius: '4px',
                    fontSize: '10px',
                    color: 'var(--text-tertiary)',
                    fontStyle: 'italic'
                  }}>
                    {sector.currentZScore <= -2
                      ? `Underperforming ${Math.abs(sector.excessReturn).toFixed(2)}% more than its 10-year average`
                      : sector.currentZScore >= 2
                      ? `Outperforming ${Math.abs(sector.excessReturn).toFixed(2)}% more than its 10-year average`
                      : 'Performance near its historical norm'}
                  </div>
                </div>
              </div>
            )}
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
