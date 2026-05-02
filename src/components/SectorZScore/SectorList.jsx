import React, { useState, memo } from 'react';
import { SignalBadge } from './SignalBadge';

export const SectorList = memo(function SectorList({ sectors, selectedSector, onSelect, isMobile }) {
  const [expandedSector, setExpandedSector] = useState(null);

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
          <div key={sector.symbol} style={{ borderBottom: '1px solid var(--rule)' }}>
            <div
              onClick={() => onSelect(sector.symbol)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 16px',
                cursor: 'pointer',
                background: selectedSector === sector.symbol ? 'var(--bg-wash)' : 'transparent',
                borderLeft: selectedSector === sector.symbol ? '2px solid var(--accent)' : '2px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (selectedSector !== sector.symbol) {
                  e.currentTarget.style.background = 'var(--bg-wash)';
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
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)', fontSize: '12px' }}>
                  {sector.symbol}
                </span>
                {!isMobile && (
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-dim)',
                    fontSize: '10px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
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
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    padding: '2px 4px',
                  }}
                >
                  {expandedSector === sector.symbol ? '[-]' : '[+]'}
                </button>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  color: sector.currentZScore < 0 ? 'var(--pos)' : 'var(--neg)',
                  fontSize: '12px',
                  minWidth: '46px',
                  textAlign: 'right'
                }}>
                  {sector.currentZScore?.toFixed(2) || 'N/A'}
                </span>
                <SignalBadge zScore={sector.currentZScore} />
              </div>
            </div>

            {expandedSector === sector.symbol && sector.structuralBaseline !== null && (
              <div className="animate-in" style={{
                padding: '12px 16px',
                background: 'var(--bg-wash)',
                borderLeft: '2px solid var(--rule-strong)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                lineHeight: '1.6'
              }}>
                <div className="stat-block-label" style={{ marginBottom: '8px' }}>Current Breakdown</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-dim)' }}>STRUCT BASELINE:</span>
                    <span style={{ color: sector.structuralBaseline < 0 ? 'var(--neg)' : 'var(--pos)' }}>
                      {sector.structuralBaseline >= 0 ? '+' : ''}{sector.structuralBaseline.toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-dim)' }}>REL RETURN:</span>
                    <span style={{ color: sector.relativeReturn < 0 ? 'var(--neg)' : 'var(--pos)' }}>
                      {sector.relativeReturn >= 0 ? '+' : ''}{sector.relativeReturn.toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', marginTop: '6px', borderTop: '1px solid var(--rule)' }}>
                    <span style={{ color: 'var(--text-mid)' }}>EXCESS RETURN:</span>
                    <span style={{ color: sector.excessReturn < 0 ? 'var(--neg)' : 'var(--pos)' }}>
                      {sector.excessReturn >= 0 ? '+' : ''}{sector.excessReturn.toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ marginTop: '8px', padding: '6px 8px', background: 'var(--bg-raised)', fontSize: '11px', color: 'var(--text-mid)' }}>
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

                  {sector.dataPoints != null && sector.dataPoints < 700 && (
                    <div style={{ marginTop: '8px', padding: '6px 8px', background: 'var(--accent-dim)', border: '1px solid oklch(72% 0.14 42 / 0.2)', fontSize: '11px', color: 'var(--accent)' }}>
                      Limited history ({sector.dataPoints} wks) — signals may be less reliable
                    </div>
                  )}

                  {sector.zScores && sector.zScores.length > 0 && (() => {
                    const totalPoints = sector.zScores.length;
                    let cyclicalLowCount = 0, cheapCount = 0, neutralCount = 0, extendedLightCount = 0, extendedCount = 0;
                    for (const z of sector.zScores) {
                      const s = z.zScore;
                      if (s <= -2) cyclicalLowCount++;
                      else if (s <= -1) cheapCount++;
                      else if (s <= 1) neutralCount++;
                      else if (s < 2) extendedLightCount++;
                      else extendedCount++;
                    }

                    return (
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--rule)' }}>
                        <div className="stat-block-label" style={{ marginBottom: '8px' }}>Historical Time Spent</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-dim)' }}>CYCLIC LOW (≤−2):</span>
                            <span style={{ color: 'var(--pos)' }}>{((cyclicalLowCount / totalPoints) * 100).toFixed(1)}%</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-dim)' }}>CHEAP (−2 TO −1):</span>
                            <span style={{ color: 'var(--accent)' }}>{((cheapCount / totalPoints) * 100).toFixed(1)}%</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-dim)' }}>NEUTRAL (−1 TO +1]:</span>
                            <span style={{ color: 'var(--text-mid)' }}>{((neutralCount / totalPoints) * 100).toFixed(1)}%</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-dim)' }}>SOMEWHAT EXT (+1 TO +2):</span>
                            <span style={{ color: 'var(--bb-orange)' }}>{((extendedLightCount / totalPoints) * 100).toFixed(1)}%</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-dim)' }}>EXTENDED (≥+2):</span>
                            <span style={{ color: 'var(--neg)' }}>{((extendedCount / totalPoints) * 100).toFixed(1)}%</span>
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
            color: 'var(--text-dim)',
            textAlign: 'center',
            padding: '32px 20px',
            fontSize: '11px',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
          }} className="pulse-animation">
            LOADING SECTOR DATA...
          </div>
        )}
      </div>
    </div>
  );
});

export default SectorList;
