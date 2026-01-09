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
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 20px',
      color: '#888'
    }}
  >
    <div
      style={{
        width: '40px',
        height: '40px',
        border: '3px solid #333',
        borderTopColor: '#3b82f6',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: '16px'
      }}
    />
    <style>
      {`@keyframes spin { to { transform: rotate(360deg); } }`}
    </style>
    <div style={{ fontSize: '16px', marginBottom: '8px' }}>Loading sector data...</div>
    {progress.total > 0 && (
      <div style={{ fontSize: '13px', color: '#666' }}>
        Fetched {progress.current} of {progress.total} symbols
      </div>
    )}
  </div>
);

const ErrorState = ({ error, onRetry }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 20px',
      color: '#ef4444'
    }}
  >
    <div style={{ fontSize: '18px', marginBottom: '12px' }}>Error Loading Data</div>
    <div style={{ fontSize: '14px', color: '#888', marginBottom: '20px', textAlign: 'center' }}>
      {error}
    </div>
    <button
      onClick={onRetry}
      style={{
        padding: '10px 24px',
        background: '#3b82f6',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px'
      }}
    >
      Retry
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
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '24px'
      }}
    >
      <div style={{ background: '#1a1a2e', padding: '16px', borderRadius: '8px' }}>
        <div style={{ color: '#888', fontSize: '12px', marginBottom: '4px' }}>Cheapest Sector</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: cheapest.color
            }}
          />
          <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#22c55e' }}>
            {cheapest.symbol}
          </span>
        </div>
        <div style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>
          Z-Score: {cheapest.currentZScore.toFixed(2)}
        </div>
      </div>

      <div style={{ background: '#1a1a2e', padding: '16px', borderRadius: '8px' }}>
        <div style={{ color: '#888', fontSize: '12px', marginBottom: '4px' }}>Most Extended</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: mostExtended.color
            }}
          />
          <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#ef4444' }}>
            {mostExtended.symbol}
          </span>
        </div>
        <div style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>
          Z-Score: {mostExtended.currentZScore.toFixed(2)}
        </div>
      </div>

      <div style={{ background: '#1a1a2e', padding: '16px', borderRadius: '8px' }}>
        <div style={{ color: '#888', fontSize: '12px', marginBottom: '4px' }}>Avg Z-Score</div>
        <div
          style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: avgZScore < 0 ? '#22c55e' : avgZScore > 0 ? '#ef4444' : '#888'
          }}
        >
          {avgZScore.toFixed(2)}
        </div>
        <div style={{ marginTop: '4px' }}>
          <SignalBadge zScore={avgZScore} />
        </div>
      </div>

      <div style={{ background: '#1a1a2e', padding: '16px', borderRadius: '8px' }}>
        <div style={{ color: '#888', fontSize: '12px', marginBottom: '4px' }}>Signal Count</div>
        <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#22c55e' }}>
              {cyclicalLowCount}
            </div>
            <div style={{ fontSize: '10px', color: '#888' }}>Cyclical Low</div>
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ef4444' }}>
              {extendedCount}
            </div>
            <div style={{ fontSize: '10px', color: '#888' }}>Extended</div>
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 280px',
          gap: '16px',
          marginBottom: '24px'
        }}
      >
        <div style={{ background: '#1a1a2e', borderRadius: '8px', padding: '20px' }}>
          <h2 style={{ fontSize: '16px', color: '#fff', margin: '0 0 16px 0' }}>
            Z-Score Over Time
          </h2>
          <div style={{ height: isMobile ? '280px' : '350px' }}>
            <SectorChart sectors={sectors} selectedSector={selectedSector} isMobile={isMobile} />
          </div>
          <div
            style={{
              display: 'flex',
              gap: '16px',
              marginTop: '12px',
              fontSize: '11px',
              color: '#888',
              flexWrap: 'wrap',
              justifyContent: isMobile ? 'center' : 'flex-start'
            }}
          >
            <span>
              <span style={{ color: '#ef4444' }}>---</span> Cyclical Low (-2)
            </span>
            <span>
              <span style={{ color: '#22c55e' }}>---</span> Extended (+2)
            </span>
          </div>
        </div>

        <SectorList
          sectors={sectors}
          selectedSector={selectedSector}
          onSelect={setSelectedSector}
          isMobile={isMobile}
        />
      </div>

      <div style={{ background: '#1a1a2e', borderRadius: '8px', padding: '20px' }}>
        <h2 style={{ fontSize: '16px', color: '#fff', margin: '0 0 16px 0' }}>
          Price Performance vs {benchmark}
          {selectedSectorData && (
            <span style={{ fontWeight: 'normal', color: '#888', marginLeft: '8px' }}>
              ({selectedSectorData.symbol} - {selectedSectorData.name})
            </span>
          )}
        </h2>
        <div style={{ height: isMobile ? '250px' : '300px' }}>
          <PriceChart
            sectors={sectors}
            selectedSector={selectedSector}
            benchmarkData={benchmarkData}
            benchmark={benchmark}
            isMobile={isMobile}
          />
        </div>
      </div>

      <div
        style={{
          marginTop: '20px',
          padding: '16px',
          background: '#1a1a2e',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#888',
          textAlign: isMobile ? 'center' : 'left'
        }}
      >
        <strong style={{ color: '#a855f7' }}>About Z-Scores:</strong> The Z-score measures how many
        standard deviations a sector's relative performance is from its historical mean. Negative
        Z-scores (below -2) indicate sectors that are historically cheap relative to the benchmark,
        potentially signaling buying opportunities. Positive Z-scores (above +2) indicate extended
        sectors that may be due for mean reversion.
      </div>
    </>
  );
};

export default SectorZScore;
