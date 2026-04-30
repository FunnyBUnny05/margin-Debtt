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
          <div key={sector.symbol} style={{ borderBottom: '1px solid var(--bb-border-light)' }}>
            <div
              onClick={() => onSelect(sector.symbol)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                cursor: 'pointer',
                background: selectedSector === sector.symbol ? 'var(--bb-panel-alt)' : 'transparent',
                borderLeft: selectedSector === sector.symbol ? '3px solid var(--bb-yellow)' : '3px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (selectedSector !== sector.symbol) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedSector !== sector.symbol) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <div style={{ width: '8px', height: '8px', background: sector.color, flexShrink: 0, borderRadius: '50%' }} />
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--bb-white)', fontSize: '13px', fontWeight: '700' }}>
                  {sector.symbol}
                </span>
                {!isMobile && (
                  <span style={{
                    fontFamily: 'var(--font-ui)',
                    color: 'var(--bb-gray-2)',
                    fontSize: '11px',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <button
                  onClick={(e) => toggleExpand(sector.symbol, e)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--bb-gray-2)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    padding: '2px 4px',
                  }}
                >
                  {expandedSector === sector.symbol ? '[-]' : '[+]'}
                </button>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  color: sector.currentZScore < 0 ? 'var(--bb-green)' : 'var(--bb-red)',
                  fontWeight: '700',
                  fontSize: '13px',
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
              <div className="animate-in" style={{
                padding: '12px 16px',
                background: 'rgba(0, 0, 0, 0.2)',
                borderLeft: '3px solid var(--bb-border-light)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                lineHeight: '1.6'
              }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontWeight: '700', color: 'var(--bb-yellow)', fontSize: '10px', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>
                  CURRENT BREAKDOWN
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--bb-gray-2)' }}>STRUCT BASELINE:</span>
                    <span style={{ color: sector.structuralBaseline < 0 ? 'var(--bb-red)' : 'var(--bb-green)', fontWeight: '700' }}>
                      {sector.structuralBaseline >= 0 ? '+' : ''}{sector.structuralBaseline.toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--bb-gray-2)' }}>REL RETURN:</span>
                    <span style={{ color: sector.relativeReturn < 0 ? 'var(--bb-red)' : 'var(--bb-green)', fontWeight: '700' }}>
                      {sector.relativeReturn >= 0 ? '+' : ''}{sector.relativeReturn.toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', marginTop: '6px', borderTop: '1px solid var(--bb-border-light)' }}>
                    <span style={{ color: 'var(--bb-gray-1)', fontWeight: '700' }}>EXCESS RETURN:</span>
                    <span style={{ color: sector.excessReturn < 0 ? 'var(--bb-red)' : 'var(--bb-green)', fontWeight: '700' }}>
                      {sector.excessReturn >= 0 ? '+' : ''}{sector.excessReturn.toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ marginTop: '8px', padding: '6px 8px', background: 'rgba(255, 255, 255, 0.05)', fontSize: '11px', color: 'var(--bb-gray-2)', fontFamily: 'var(--font-ui)' }}>
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

                  {/* Limited history warning for young ETFs */}
                  {sector.dataPoints != null && sector.dataPoints < 700 && (
                    <div style={{ marginTop: '8px', padding: '6px 8px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: '11px', color: 'var(--bb-yellow)', fontFamily: 'var(--font-ui)' }}>
                      Limited history ({sector.dataPoints} wks) — signals may be less reliable
                    </div>
                  )}

                  {/* Time Spent in Zones */}
                  {sector.zScores && sector.zScores.length > 0 && (() => {
                    const totalPoints = sector.zScores.length;
                    // Single-pass aggregation instead of 5 separate filter calls
                    let cyclicalLowCount = 0, cheapCount = 0, neutralCount = 0, extendedLightCount = 0, extendedCount = 0;
                    for (const z of sector.zScores) {
                      const s = z.zScore;
                      if (s <= -2) cyclicalLowCount++;
                      else if (s <= -1) cheapCount++;
                      else if (s <= 1) neutralCount++;  // z=1.0 is neutral (matches SignalBadge + chart tooltip)
                      else if (s < 2) extendedLightCount++;
                      else extendedCount++;
                    }

                    const cyclicalLowPct = (cyclicalLowCount / totalPoints) * 100;
                    const cheapPct = (cheapCount / totalPoints) * 100;
                    const neutralPct = (neutralCount / totalPoints) * 100;
                    const extendedLightPct = (extendedLightCount / totalPoints) * 100;
                    const extendedPct = (extendedCount / totalPoints) * 100;

                    return (
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--bb-border-light)' }}>
                        <div style={{ fontFamily: 'var(--font-ui)', fontWeight: '700', color: 'var(--bb-yellow)', fontSize: '10px', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>
                          HISTORICAL TIME SPENT
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--bb-gray-2)' }}>CYCLIC LOW (&le;-2):</span>
                            <span style={{ color: 'var(--bb-green)', fontWeight: '700' }}>{cyclicalLowPct.toFixed(1)}%</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--bb-gray-2)' }}>CHEAP (-2 TO -1):</span>
                            <span style={{ color: 'var(--bb-cyan)', fontWeight: '700' }}>{cheapPct.toFixed(1)}%</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--bb-gray-2)' }}>NEUTRAL (-1 TO +1]:</span>
                            <span style={{ color: 'var(--bb-gray-2)', fontWeight: '700' }}>{neutralPct.toFixed(1)}%</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--bb-gray-2)' }}>SOMEWHAT EXT (+1 TO +2):</span>
                            <span style={{ color: 'var(--bb-yellow)', fontWeight: '700' }}>{extendedLightPct.toFixed(1)}%</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--bb-gray-2)' }}>EXTENDED (&ge;+2):</span>
                            <span style={{ color: 'var(--bb-red)', fontWeight: '700' }}>{extendedPct.toFixed(1)}%</span>
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
            fontFamily: 'var(--font-mono)',
            color: 'var(--bb-gray-2)',
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
});

export default SectorList;
