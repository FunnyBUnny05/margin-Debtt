import React, { useState, memo } from 'react';
import { SignalBadge } from './SignalBadge';

export const SectorList = memo(function SectorList({ sectors, selectedSector, onSelect, isMobile }) {
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
          <div key={sector.symbol} style={{ borderBottom: '1px solid #111827' }}>
            <div
              onClick={() => onSelect(sector.symbol)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                cursor: 'pointer',
                background: selectedSector === sector.symbol ? '#78350F' : 'transparent',
                borderLeft: selectedSector === sector.symbol ? '3px solid #F59E0B' : '3px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (selectedSector !== sector.symbol) {
                  e.currentTarget.style.background = '#111827';
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
                <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#F9FAFB', fontSize: '12px', fontWeight: '700' }}>
                  {sector.symbol}
                </span>
                {!isMobile && (
                  <span style={{
                    fontFamily: 'var(--font-ui)',
                    color: '#6B7280',
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
                    color: '#4B5563',
                    cursor: 'pointer',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '10px',
                    padding: '2px 4px',
                  }}
                >
                  {expandedSector === sector.symbol ? '[-]' : '[+]'}
                </button>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  color: sector.currentZScore < 0 ? '#10B981' : '#EF4444',
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
                background: '#0B0F19',
                borderLeft: '3px solid #1F2937',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '11px',
                lineHeight: '1.6'
              }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontWeight: '700', color: '#FCD34D', fontSize: '10px', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px' }}>
                  CURRENT BREAKDOWN
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6B7280' }}>STRUCT BASELINE:</span>
                    <span style={{ color: sector.structuralBaseline < 0 ? '#EF4444' : '#10B981', fontWeight: '700' }}>
                      {sector.structuralBaseline >= 0 ? '+' : ''}{sector.structuralBaseline.toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6B7280' }}>REL RETURN:</span>
                    <span style={{ color: sector.relativeReturn < 0 ? '#EF4444' : '#10B981', fontWeight: '700' }}>
                      {sector.relativeReturn >= 0 ? '+' : ''}{sector.relativeReturn.toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px', marginTop: '4px', borderTop: '1px solid #111827' }}>
                    <span style={{ color: '#9CA3AF', fontWeight: '700' }}>EXCESS RETURN:</span>
                    <span style={{ color: sector.excessReturn < 0 ? '#EF4444' : '#10B981', fontWeight: '700' }}>
                      {sector.excessReturn >= 0 ? '+' : ''}{sector.excessReturn.toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ marginTop: '4px', padding: '4px 8px', background: '#0B0F19', fontSize: '10px', color: '#6B7280', fontFamily: 'var(--font-ui)' }}>
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
                    // Single-pass aggregation instead of 5 separate filter calls
                    let cyclicalLowCount = 0, cheapCount = 0, neutralCount = 0, extendedLightCount = 0, extendedCount = 0;
                    for (const z of sector.zScores) {
                      const s = z.zScore;
                      if (s <= -2) cyclicalLowCount++;
                      else if (s <= -1) cheapCount++;
                      else if (s < 1) neutralCount++;
                      else if (s < 2) extendedLightCount++;
                      else extendedCount++;
                    }

                    const cyclicalLowPct = (cyclicalLowCount / totalPoints) * 100;
                    const cheapPct = (cheapCount / totalPoints) * 100;
                    const neutralPct = (neutralCount / totalPoints) * 100;
                    const extendedLightPct = (extendedLightCount / totalPoints) * 100;
                    const extendedPct = (extendedCount / totalPoints) * 100;

                    return (
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #111827' }}>
                        <div style={{ fontFamily: 'var(--font-ui)', fontWeight: '700', color: '#FCD34D', fontSize: '10px', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '4px' }}>
                          HISTORICAL TIME SPENT
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#6B7280' }}>CYCLIC LOW (&le;-2):</span>
                            <span style={{ color: '#10B981', fontWeight: '700' }}>{cyclicalLowPct.toFixed(1)}%</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#6B7280' }}>CHEAP (-1 TO -2):</span>
                            <span style={{ color: '#38BDF8', fontWeight: '700' }}>{cheapPct.toFixed(1)}%</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#6B7280' }}>NEUTRAL (-1 TO +1):</span>
                            <span style={{ color: '#6B7280', fontWeight: '700' }}>{neutralPct.toFixed(1)}%</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#6B7280' }}>SOMEWHAT EXT (+1 TO +2):</span>
                            <span style={{ color: '#FCD34D', fontWeight: '700' }}>{extendedLightPct.toFixed(1)}%</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#6B7280' }}>EXTENDED (&ge;+2):</span>
                            <span style={{ color: '#EF4444', fontWeight: '700' }}>{extendedPct.toFixed(1)}%</span>
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
            fontFamily: 'JetBrains Mono, monospace',
            color: '#4B5563',
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

});

export default SectorList;
