import React, { useState, useEffect } from 'react';
import { SECTOR_ETFS, RETURN_PERIODS, Z_WINDOWS } from './constants';
import { useYahooFinance } from './hooks/useYahooFinance';
import { useZScoreCalculation } from './hooks/useZScoreCalculation';
import { ControlPanel } from './ControlPanel';
import { SectorList } from './SectorList';
import { SectorChart } from './SectorChart';
import { PriceChart } from './PriceChart';
import { SignalBadge } from './SignalBadge';

const LoadingState = ({ progress }) => (
  <div className="glass-card" style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    marginTop: '1px'
  }}>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--bb-orange)', marginBottom: '12px', letterSpacing: '2px' }} className="pulse-animation">
      LOADING...
    </div>
    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: '700', color: 'var(--bb-white)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
      Loading Sector Analysis
    </div>
    {progress.total > 0 && (
      <>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--bb-gray-2)', marginBottom: '14px' }}>
          FETCHING {progress.current} OF {progress.total} SYMBOLS
        </div>
        <div style={{ width: '200px', height: '2px', background: 'var(--bb-border)', overflow: 'hidden' }}>
          <div
            style={{
              width: `${(progress.current / progress.total) * 100}%`,
              height: '100%',
              background: 'var(--bb-orange)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </>
    )}
  </div>
);

const ErrorState = ({ error, onRetry }) => (
  <div className="glass-card" style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    marginTop: '1px',
    borderLeft: '3px solid var(--bb-red)'
  }}>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--bb-red)', marginBottom: '12px', letterSpacing: '2px', fontWeight: '700' }}>
      ERROR
    </div>
    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: '700', color: 'var(--bb-white)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
      Couldn't Load Sector Data
    </div>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--bb-gray-2)', marginBottom: '20px', textAlign: 'center', maxWidth: '400px' }}>
      {error}
    </div>
    <button
      onClick={onRetry}
      className="btn-primary"
      style={{ background: 'var(--bb-orange)', color: '#fff', border: 'none' }}
    >
      RETRY
    </button>
  </div>
);

const StatCards = ({ sectors, isMobile }) => {
  const validSectors = sectors.filter((s) => s.currentZScore !== null);
  if (validSectors.length === 0) return null;

  const sorted = [...validSectors].sort((a, b) => a.currentZScore - b.currentZScore);
  const cheapest = sorted[0];
  const mostExtended = sorted[sorted.length - 1];

  const avgZScore = validSectors.reduce((sum, s) => sum + s.currentZScore, 0) / validSectors.length;

  const cyclicalLowCount = validSectors.filter((s) => s.currentZScore <= -2).length;
  const extendedCount = validSectors.filter((s) => s.currentZScore >= 2).length;

  return (
    <div
      className="responsive-grid"
      style={{ marginBottom: '1px', marginTop: '1px', gap: '1px', background: '#1A1A1A' }}
    >
      {/* Cheapest Sector Card */}
      <div className="stat-card" style={{ borderLeft: '3px solid #00CC44', padding: '12px 16px' }}>
        <div style={{ fontFamily: 'var(--font-ui)', color: '#FFD700', fontSize: '10px', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          CHEAPEST SECTOR
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <div style={{ width: '8px', height: '8px', background: cheapest.color, flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '22px' : '26px', fontWeight: '700', color: '#00CC44' }}>
            {cheapest.symbol}
          </span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#999999' }}>
          Z: <span style={{ color: '#FFFFFF', fontWeight: '700' }}>{cheapest.currentZScore.toFixed(2)}</span>
        </div>
      </div>

      {/* Most Extended Card */}
      <div className="stat-card" style={{ borderLeft: '3px solid #FF3333', padding: '12px 16px' }}>
        <div style={{ fontFamily: 'var(--font-ui)', color: '#FFD700', fontSize: '10px', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          MOST EXTENDED
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <div style={{ width: '8px', height: '8px', background: mostExtended.color, flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '22px' : '26px', fontWeight: '700', color: '#FF3333' }}>
            {mostExtended.symbol}
          </span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#999999' }}>
          Z: <span style={{ color: '#FFFFFF', fontWeight: '700' }}>{mostExtended.currentZScore.toFixed(2)}</span>
        </div>
      </div>

      {/* Average Z-Score Card */}
      <div className="stat-card" style={{ borderLeft: '3px solid #FF6600', padding: '12px 16px' }}>
        <div style={{ fontFamily: 'var(--font-ui)', color: '#FFD700', fontSize: '10px', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          AVG Z-SCORE
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: isMobile ? '22px' : '26px',
          fontWeight: '700',
          color: avgZScore < -1 ? '#00CC44' : avgZScore > 1 ? '#FF3333' : '#00CCCC',
          marginBottom: '4px'
        }}>
          {avgZScore >= 0 ? '+' : ''}{avgZScore.toFixed(2)}
        </div>
        <SignalBadge zScore={avgZScore} />
      </div>

      {/* Signal Count Card */}
      <div className="stat-card" style={{ borderLeft: '3px solid #00CCCC', padding: '12px 16px' }}>
        <div style={{ fontFamily: 'var(--font-ui)', color: '#FFD700', fontSize: '10px', fontWeight: '700', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          SIGNAL COUNT
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '20px' : '24px', fontWeight: '700', color: '#00CC44' }}>
              {cyclicalLowCount}
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: '#666666', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CYLIC LOW</div>
          </div>
          <div style={{ width: '1px', background: '#2A2A2A' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '20px' : '24px', fontWeight: '700', color: '#FF3333' }}>
              {extendedCount}
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: '#666666', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>EXTENDED</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SectorZScore = ({ isMobile }) => {
  const [benchmark, setBenchmark] = useState('SPY');
  const [returnPeriod, setReturnPeriod] = useState(RETURN_PERIODS[2].value); // 5Y default
  const [zWindow, setZWindow] = useState(Z_WINDOWS[2].value); // 3Y default
  const [selectedSector, setSelectedSector] = useState(null);

  const { data: sectorData, benchmarkData, loading, error, progress, refetch } = useYahooFinance(
    SECTOR_ETFS,
    benchmark
  );

  const { sectors, dates } = useZScoreCalculation(
    sectorData,
    benchmarkData,
    SECTOR_ETFS,
    returnPeriod,
    zWindow
  );

  // Auto-select cheapest sector when data loads
  useEffect(() => {
    if (!selectedSector && sectors.length > 0) {
      const validSectors = sectors.filter((s) => s.currentZScore !== null);
      if (validSectors.length > 0) {
        const sorted = [...validSectors].sort((a, b) => a.currentZScore - b.currentZScore);
        setSelectedSector(sorted[0].symbol);
      }
    }
  }, [sectors, selectedSector]);

  if (loading) {
    return <LoadingState progress={progress} />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={refetch} />;
  }

  const selectedSectorData = sectors.find((s) => s.symbol === selectedSector);

  return (
    <>
      <ControlPanel
        benchmark={benchmark}
        setBenchmark={setBenchmark}
        returnPeriod={returnPeriod}
        setReturnPeriod={setReturnPeriod}
        zWindow={zWindow}
        setZWindow={setZWindow}
        isMobile={isMobile}
      />

      <StatCards sectors={sectors} isMobile={isMobile} />

      {/* Charts Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 300px',
          gap: '1px',
          marginBottom: '1px',
          background: '#1A1A1A'
        }}
      >
        {/* Z-Score Chart */}
        <div className="glass-card" style={{ padding: '0' }}>
          <div className="bb-panel-header">Z-SCORE OVER TIME</div>
          <div style={{ padding: isMobile ? '12px' : '14px' }}>
          <div style={{ height: isMobile ? '280px' : '360px' }}>
            <SectorChart sectors={sectors} selectedSector={selectedSector} isMobile={isMobile} />
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
            <div className="badge badge-warning" style={{ fontSize: '10px' }}>CYCLICAL LOW (-2)</div>
            <div className="badge badge-success" style={{ fontSize: '10px' }}>EXTENDED (+2)</div>
          </div>
          </div>
        </div>

        {/* Sector List */}
        <SectorList
          sectors={sectors}
          selectedSector={selectedSector}
          onSelect={setSelectedSector}
          isMobile={isMobile}
        />
      </div>

      {/* Price Performance Chart */}
      <div className="glass-card" style={{ padding: '0', marginBottom: '1px', marginTop: '1px' }}>
        <div className="bb-panel-header">
          PRICE PERFORMANCE VS {benchmark}
          {selectedSectorData && (
            <span style={{ marginLeft: '12px', fontWeight: '400', opacity: 0.8 }}>
              — {selectedSectorData.symbol} ({selectedSectorData.name})
            </span>
          )}
        </div>
        <div style={{ padding: isMobile ? '12px' : '14px' }}>
        {selectedSectorData && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ width: '8px', height: '8px', background: selectedSectorData.color, flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: '#FFFFFF', fontSize: '12px' }}>
              {selectedSectorData.symbol}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', color: '#666666', fontSize: '11px' }}>{selectedSectorData.name}</span>
          </div>
        )}
        <div style={{ height: isMobile ? '260px' : '320px' }}>
          <PriceChart
            sectors={sectors}
            selectedSector={selectedSector}
            benchmarkData={benchmarkData}
            benchmark={benchmark}
            isMobile={isMobile}
          />
        </div>
        </div>
      </div>

      {/* About Section */}
      <div className="glass-card" style={{ padding: '0', marginTop: '1px', borderLeft: '3px solid #FF6600' }}>
        <div style={{ padding: isMobile ? '12px 14px' : '12px 16px' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontWeight: '700', color: '#FF6600', fontSize: '10px', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '8px' }}>ABOUT Z-SCORES (IMPROVED METHODOLOGY)</div>
          <p style={{ fontFamily: 'var(--font-mono)', color: '#CCCCCC', fontSize: '12px', lineHeight: '1.6', marginBottom: '8px' }}>
            The Z-score measures how many standard deviations a sector's excess performance is from its historical pattern.
            This calculation accounts for each sector's structural relationship with the benchmark.
          </p>
          <div style={{
            background: '#0D0D0D',
            padding: '10px 14px',
            borderLeft: '2px solid #FF6600',
            marginTop: '8px',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            lineHeight: '1.8'
          }}>
            <div style={{ color: '#FFD700', fontWeight: '700', marginBottom: '4px', fontFamily: 'var(--font-ui)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>HOW IT WORKS</div>
            <div style={{ color: '#999999' }}>
              1. <span style={{ color: '#CCCCCC' }}>STRUCTURAL BASELINE:</span> Calculate each sector's 10-year avg return vs {benchmark}<br/>
              2. <span style={{ color: '#CCCCCC' }}>EXCESS RETURN:</span> Current return minus the structural baseline<br/>
              3. <span style={{ color: '#CCCCCC' }}>Z-SCORE:</span> How many std deviations the excess return is from its mean
            </div>
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #2A2A2A', color: '#666666', fontSize: '11px' }}>
              <span style={{ color: '#00CC44' }}>Z ≤ -2:</span> Sector underperforming more than structural norm (CHEAP){' '}
              | <span style={{ color: '#FF3333' }}>Z ≥ +2:</span> Sector outperforming more than structural norm (EXTENDED)
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SectorZScore;
