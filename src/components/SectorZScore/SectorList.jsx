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
        padding: '0',
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div className="bb-panel-header">SECTORS (CHEAPEST FIRST)</div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          maxHeight: isMobile ? '250px' : '420px'
        }}
      >
        {sorted.map((sector) => (
          <div key={sector.symbol} style={{ borderBottom: '1px solid #1A1A1A' }}>
            <div
              onClick={() => onSelect(sector.symbol)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                cursor: 'pointer',
                background: selectedSector === sector.symbol ? '#1A1000' : 'transparent',
                borderLeft: selectedSector === sector.symbol ? '3px solid #FF6600' : '3px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (selectedSector !== sector.symbol) {
                  e.currentTarget.style.background = '#111111';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedSector !== sector.symbol) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <div style={{ width: '6px', height: '6px', background: sector.color, flexShrink: 0 }} />
                <span style={{ fontFamily: 'Courier New, monospace', color: '#FFFFFF', fontSize: '12px', fontWeight: '700' }}>
                  {sector.symbol}
                </span>
                {!isMobile && (
                  <span style={{
                    fontFamily: 'var(--font-ui)',
                    color: '#555555',
                    fontSize: '10px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px'
                  }}>
                    {sector.name}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <button
                  onClick={(e) => toggleExpand(sector.symbol, e)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#444444',
                    cursor: 'pointer',
                    fontFamily: 'Courier New, monospace',
                    fontSize: '10px',
                    padding: '2px 4px',
                  }}
                >
                  {expandedSector === sector.symbol ? '[-]' : '[+]'}
                </button>
                <span style={{
                  fontFamily: 'Courier New, monospace',
                  color: sector.currentZScore < 0 ? '#00CC44' : '#FF3333',
                  fontWeight: '700',
                  fontSize: '12px',
                  minWidth: '46px',
                  textAlign: 'right'
                }}>
                  {sector.currentZScore?.toFixed(2) || 'N/A'}
                </span>
                <SignalBadge zScore={sector.currentZScore} />
              </div>
            </div>

            {/* Expanded Details */}
            {expandedSector === sector.symbol && sector.structuralBaseline !== null && (
              <div style={{
                padding: '10px 12px 10px 15px',
                background: '#060606',
                borderLeft: '3px solid #2A2A2A',
                fontFamily: 'Courier New, monospace',
                fontSize: '11px',
                lineHeight: '1.6'
              }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontWeight: '700', color: '#FFD700', fontSize: '10px', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px' }}>
                  CURRENT BREAKDOWN
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666666' }}>STRUCT BASELINE:</span>
                    <span style={{ color: sector.structuralBaseline < 0 ? '#FF3333' : '#00CC44', fontWeight: '700' }}>
                      {sector.structuralBaseline >= 0 ? '+' : ''}{sector.structuralBaseline.toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666666' }}>REL RETURN:</span>
                    <span style={{ color: sector.relativeReturn < 0 ? '#FF3333' : '#00CC44', fontWeight: '700' }}>
                      {sector.relativeReturn >= 0 ? '+' : ''}{sector.relativeReturn.toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px', marginTop: '4px', borderTop: '1px solid #1A1A1A' }}>
                    <span style={{ color: '#999999', fontWeight: '700' }}>EXCESS RETURN:</span>
                    <span style={{ color: sector.excessReturn < 0 ? '#FF3333' : '#00CC44', fontWeight: '700' }}>
                      {sector.excessReturn >= 0 ? '+' : ''}{sector.excessReturn.toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ marginTop: '4px', padding: '4px 8px', background: '#0A0A0A', fontSize: '10px', color: '#555555', fontFamily: 'var(--font-ui)' }}>
                    {sector.excessReturn !== null && sector.excessReturn !== undefined && (
                      <>
                        {sector.excessReturn < -5
                          ? `Underperforming ${Math.abs(sector.excessReturn).toFixed(2)}% more than its 10-year avg`
                          : sector.excessReturn > 5
                          ? `Outperforming ${Math.abs(sector.excessReturn).toFixed(2)}% more than its 10-year avg`
                          : Math.abs(sector.excessReturn) > 2
                          ? sector.excessReturn < 0
                            ? `Underperforming ${Math.abs(sector.excessReturn).toFixed(2)}% vs structural baseline`
                            : `Outperforming ${Math.abs(sector.excessReturn).toFixed(2)}% vs structural baseline`
                          : 'Performance near historical norm'}
                      </>
                    )}
                  </div>

                  {/* Time Spent in Zones */}
                  {sector.zScores && sector.zScores.length > 0 && (() => {
                    const totalPoints = sector.zScores.length;
                    const cyclicalLowCount = sector.zScores.filter(z => z.zScore <= -2).length;
                    const cheapCount = sector.zScores.filter(z => z.zScore > -2 && z.zScore <= -1).length;
                    const neutralCount = sector.zScores.filter(z => z.zScore > -1 && z.zScore < 1).length;
                    const extendedLightCount = sector.zScores.filter(z => z.zScore >= 1 && z.zScore < 2).length;
                    const extendedCount = sector.zScores.filter(z => z.zScore >= 2).length;

                    const cyclicalLowPct = (cyclicalLowCount / totalPoints) * 100;
                    const cheapPct = (cheapCount / totalPoints) * 100;
                    const neutralPct = (neutralCount / totalPoints) * 100;
                    const extendedLightPct = (extendedLightCount / totalPoints) * 100;
                    const extendedPct = (extendedCount / totalPoints) * 100;

                    return (
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #1A1A1A' }}>
                        <div style={{ fontFamily: 'var(--font-ui)', fontWeight: '700', color: '#FFD700', fontSize: '10px', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '4px' }}>
                          HISTORICAL TIME SPENT
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#555555' }}>CYCLIC LOW (&le;-2):</span>
                            <span style={{ color: '#00CC44', fontWeight: '700' }}>{cyclicalLowPct.toFixed(1)}%</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#555555' }}>CHEAP (-1 TO -2):</span>
                            <span style={{ color: '#00CCCC', fontWeight: '700' }}>{cheapPct.toFixed(1)}%</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#555555' }}>NEUTRAL (-1 TO +1):</span>
                            <span style={{ color: '#666666', fontWeight: '700' }}>{neutralPct.toFixed(1)}%</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#555555' }}>SOMEWHAT EXT (+1 TO +2):</span>
                            <span style={{ color: '#FFD700', fontWeight: '700' }}>{extendedLightPct.toFixed(1)}%</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#555555' }}>EXTENDED (&ge;+2):</span>
                            <span style={{ color: '#FF3333', fontWeight: '700' }}>{extendedPct.toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        ))}
        {sorted.length === 0 && (
          <div style={{
            fontFamily: 'Courier New, monospace',
            color: '#444444',
            textAlign: 'center',
            padding: '32px 20px',
            fontSize: '12px'
          }} className="pulse-animation">
            LOADING SECTOR DATA...
          </div>
        )}
      </div>
    </div>
  );
};

export default SectorList;
