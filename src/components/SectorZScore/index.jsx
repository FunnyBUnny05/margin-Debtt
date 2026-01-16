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
    padding: '60px 20px',
    margin: '24px 0'
  }}>
    <div style={{ fontSize: '48px', marginBottom: '24px' }} className="pulse-animation">
      🎯
    </div>
    <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px' }}>
      Loading Sector Analysis
    </div>
    {progress.total > 0 && (
      <>
        <div style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '20px' }}>
          Fetching {progress.current} of {progress.total} symbols
        </div>
        <div style={{ width: '200px', height: '4px', background: 'var(--glass-bg)', borderRadius: '999px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${(progress.current / progress.total) * 100}%`,
              height: '100%',
              background: 'var(--gradient-purple)',
              transition: 'width 0.3s ease',
              borderRadius: '999px'
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
    padding: '60px 20px',
    margin: '24px 0',
    border: '1px solid rgba(239, 68, 68, 0.3)'
  }}>
    <div style={{ fontSize: '48px', marginBottom: '24px' }}>⚠️</div>
    <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px' }}>
      Couldn't Load Sector Data
    </div>
    <div style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '24px', textAlign: 'center', maxWidth: '400px' }}>
      {error}
    </div>
    <button
      onClick={onRetry}
      className="btn-primary"
      style={{ background: 'var(--gradient-purple)' }}
    >
      🔄 Retry
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
      style={{ marginBottom: '24px' }}
    >
      {/* Cheapest Sector Card */}
      <div className="stat-card animate-in" style={{
        borderLeft: '3px solid var(--accent-emerald)',
        background: 'linear-gradient(135deg, rgba(81, 207, 102, 0.05) 0%, rgba(81, 207, 102, 0) 100%), var(--glass-bg)'
      }}>
        <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          🔻 Cheapest Sector
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: cheapest.color,
              boxShadow: `0 0 12px ${cheapest.color}66`,
              border: '2px solid rgba(255,255,255,0.2)'
            }}
          />
          <span style={{ fontSize: isMobile ? '24px' : '28px', fontWeight: '700', color: 'var(--accent-emerald)' }}>
            {cheapest.symbol}
          </span>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Z-Score:</span>
          <span style={{ fontWeight: '600' }}>{cheapest.currentZScore.toFixed(2)}</span>
        </div>
      </div>

      {/* Most Extended Card */}
      <div className="stat-card animate-in" style={{
        borderLeft: '3px solid var(--accent-coral)',
        background: 'linear-gradient(135deg, rgba(255, 107, 107, 0.05) 0%, rgba(255, 107, 107, 0) 100%), var(--glass-bg)',
        animationDelay: '0.1s'
      }}>
        <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          🔺 Most Extended
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: mostExtended.color,
              boxShadow: `0 0 12px ${mostExtended.color}66`,
              border: '2px solid rgba(255,255,255,0.2)'
            }}
          />
          <span style={{ fontSize: isMobile ? '24px' : '28px', fontWeight: '700', color: 'var(--accent-coral)' }}>
            {mostExtended.symbol}
          </span>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Z-Score:</span>
          <span style={{ fontWeight: '600' }}>{mostExtended.currentZScore.toFixed(2)}</span>
        </div>
      </div>

      {/* Average Z-Score Card */}
      <div className="stat-card animate-in" style={{
        borderLeft: '3px solid var(--accent-purple)',
        background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.05) 0%, rgba(167, 139, 250, 0) 100%), var(--glass-bg)',
        animationDelay: '0.2s'
      }}>
        <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          📊 Average Z-Score
        </div>
        <div style={{
          fontSize: isMobile ? '28px' : '32px',
          fontWeight: '700',
          color: avgZScore < -1 ? 'var(--accent-emerald)' : avgZScore > 1 ? 'var(--accent-coral)' : 'var(--accent-blue)',
          marginBottom: '8px'
        }}>
          {avgZScore >= 0 ? '+' : ''}{avgZScore.toFixed(2)}
        </div>
        <SignalBadge zScore={avgZScore} />
      </div>

      {/* Signal Count Card */}
      <div className="stat-card animate-in" style={{
        borderLeft: '3px solid var(--accent-cyan)',
        background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.05) 0%, rgba(34, 211, 238, 0) 100%), var(--glass-bg)',
        animationDelay: '0.3s'
      }}>
        <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', fontWeight: '600', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          🎯 Signal Count
        </div>
        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: isMobile ? '24px' : '28px', fontWeight: '700', color: 'var(--accent-emerald)' }}>
              {cyclicalLowCount}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Cyclical Low</div>
          </div>
          <div style={{ width: '1px', background: 'var(--glass-border)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: isMobile ? '24px' : '28px', fontWeight: '700', color: 'var(--accent-coral)' }}>
              {extendedCount}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Extended</div>
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
          gridTemplateColumns: isMobile ? '1fr' : '1fr 320px',
          gap: '20px',
          marginBottom: '24px'
        }}
      >
        {/* Z-Score Chart */}
        <div className="glass-card" style={{ padding: isMobile ? '20px' : '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ fontSize: '24px' }}>📈</div>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
              Z-Score Over Time
            </h2>
          </div>
          <div style={{ height: isMobile ? '300px' : '380px' }}>
            <SectorChart sectors={sectors} selectedSector={selectedSector} isMobile={isMobile} />
          </div>
          <div
            style={{
              display: 'flex',
              gap: '24px',
              marginTop: '16px',
              fontSize: '12px',
              flexWrap: 'wrap',
              justifyContent: isMobile ? 'center' : 'flex-start'
            }}
          >
            <div className="badge badge-warning" style={{ background: 'rgba(255, 107, 107, 0.12)', fontSize: '11px' }}>
              <span>🔴</span> Cyclical Low (-2)
            </div>
            <div className="badge badge-success" style={{ background: 'rgba(81, 207, 102, 0.12)', fontSize: '11px' }}>
              <span>🟢</span> Extended (+2)
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
      <div className="glass-card" style={{ padding: isMobile ? '20px' : '28px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '24px' }}>📊</div>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
            Price Performance vs {benchmark}
          </h2>
        </div>
        {selectedSectorData && (
          <div style={{
            fontSize: '14px',
            color: 'var(--text-tertiary)',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: selectedSectorData.color,
                boxShadow: `0 0 8px ${selectedSectorData.color}66`
              }}
            />
            <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
              {selectedSectorData.symbol}
            </span>
            <span>-</span>
            <span>{selectedSectorData.name}</span>
          </div>
        )}
        <div style={{ height: isMobile ? '280px' : '340px' }}>
          <PriceChart
            sectors={sectors}
            selectedSector={selectedSector}
            benchmarkData={benchmarkData}
            benchmark={benchmark}
            isMobile={isMobile}
          />
        </div>
      </div>

      {/* About Section */}
      <div className="glass-card" style={{
        padding: isMobile ? '20px' : '24px',
        borderLeft: '4px solid var(--accent-purple)'
      }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          <div style={{ fontSize: '32px' }}>💡</div>
          <div style={{ flex: 1 }}>
            <strong style={{ color: 'var(--accent-purple)', fontSize: '15px' }}>About Z-Scores (Improved Methodology):</strong>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px', lineHeight: '1.6', margin: '8px 0 12px 0' }}>
              The Z-score measures how many standard deviations a sector's <strong style={{ color: 'var(--text-primary)' }}>excess performance</strong> is from its historical pattern.
              This improved calculation accounts for each sector's <strong style={{ color: 'var(--text-primary)' }}>structural relationship</strong> with the benchmark.
            </p>
            <div style={{
              background: 'rgba(167, 139, 250, 0.08)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              borderLeft: '3px solid var(--accent-purple)',
              marginTop: '12px',
              fontSize: '13px',
              lineHeight: '1.7'
            }}>
              <div style={{ color: 'var(--text-primary)', fontWeight: '600', marginBottom: '8px' }}>How it works:</div>
              <div style={{ color: 'var(--text-secondary)' }}>
                1. <strong style={{ color: 'var(--text-primary)' }}>Structural Baseline:</strong> Calculate each sector's 10-year average return vs {benchmark}<br/>
                2. <strong style={{ color: 'var(--text-primary)' }}>Excess Return:</strong> Current return minus the structural baseline<br/>
                3. <strong style={{ color: 'var(--text-primary)' }}>Z-Score:</strong> How many standard deviations the excess return is from its mean
              </div>
              <div style={{
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: '1px solid rgba(167, 139, 250, 0.2)',
                color: 'var(--text-tertiary)',
                fontSize: '12px'
              }}>
                <strong style={{ color: 'var(--accent-emerald)' }}>Z-Score ≤ -2:</strong> Sector is underperforming MORE than its structural norm (CHEAP)<br/>
                <strong style={{ color: 'var(--accent-coral)' }}>Z-Score ≥ +2:</strong> Sector is outperforming MORE than its structural norm (EXTENDED)
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SectorZScore;
