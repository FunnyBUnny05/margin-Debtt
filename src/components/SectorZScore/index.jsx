import React, { useState, useEffect, memo } from 'react';
import { SECTOR_ETFS, RETURN_PERIODS, Z_WINDOWS } from './constants';
import { useYahooFinance } from './hooks/useYahooFinance';
import { useZScoreCalculation } from './hooks/useZScoreCalculation';
import { ControlPanel } from './ControlPanel';
import { SourceLink } from '../SourceLink';
import { ChartToggle } from '../ChartToggle';
import { SectorList } from './SectorList';
import { SectorChart } from './SectorChart';
import { PriceChart } from './PriceChart';
import { SignalBadge } from './SignalBadge';
import { ExportCsvButton } from '../ExportCsvButton';

const LoadingState = ({ progress }) => (
  <div className="glass-card" style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    marginTop: '1px'
  }}>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-mid)', marginBottom: '12px', letterSpacing: '0.2em', textTransform: 'uppercase' }} className="pulse-animation">
      LOADING SECTOR ANALYSIS...
    </div>
    {progress.total > 0 && (
      <>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)', marginBottom: '14px', letterSpacing: '0.14em' }}>
          FETCHING {progress.current} OF {progress.total} SYMBOLS
        </div>
        <div style={{ width: '200px', height: '1px', background: 'var(--rule)', overflow: 'hidden' }}>
          <div
            style={{
              width: `${(progress.current / progress.total) * 100}%`,
              height: '100%',
              background: 'var(--accent)',
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
  }}>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--neg)', marginBottom: '12px', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
      ERROR
    </div>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-mid)', marginBottom: '20px', textAlign: 'center', maxWidth: '400px' }}>
      {error}
    </div>
    <button onClick={onRetry} className="bb-btn">RETRY</button>
  </div>
);

const StatCards = memo(function StatCards({ sectors, isMobile }) {
  const validSectors = sectors.filter((s) => s.currentZScore !== null);
  if (validSectors.length === 0) return null;

  const sorted = [...validSectors].sort((a, b) => a.currentZScore - b.currentZScore);
  const cheapest = sorted[0];
  const mostExtended = sorted[sorted.length - 1];

  const avgZScore = validSectors.reduce((sum, s) => sum + s.currentZScore, 0) / validSectors.length;
  const cyclicalLowCount = validSectors.filter((s) => s.currentZScore <= -2).length;
  const extendedCount = validSectors.filter((s) => s.currentZScore >= 2).length;

  return (
    <div className="responsive-grid" style={{ marginBottom: '20px', marginTop: '16px' }}>
      <div className="stat-card">
        <div className="stat-block-label">Cheapest Sector</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <div style={{ width: '6px', height: '6px', background: cheapest.color, flexShrink: 0 }} />
          <span className="stat-block-value pos">{cheapest.symbol}</span>
        </div>
        <div className="stat-block-sub">Z: {cheapest.currentZScore.toFixed(2)}</div>
      </div>

      <div className="stat-card">
        <div className="stat-block-label">Most Extended</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <div style={{ width: '6px', height: '6px', background: mostExtended.color, flexShrink: 0 }} />
          <span className="stat-block-value neg">{mostExtended.symbol}</span>
        </div>
        <div className="stat-block-sub">Z: {mostExtended.currentZScore.toFixed(2)}</div>
      </div>

      <div className="stat-card">
        <div className="stat-block-label">Avg Z-Score</div>
        <div className={`stat-block-value ${avgZScore < -1 ? 'pos' : avgZScore > 1 ? 'neg' : 'neutral'}`}>
          {avgZScore >= 0 ? '+' : ''}{avgZScore.toFixed(2)}
        </div>
        <div style={{ marginTop: '6px' }}>
          <SignalBadge zScore={avgZScore} />
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-block-label" style={{ marginBottom: '10px' }}>Signal Count</div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <div className="stat-block-value sm pos">{cyclicalLowCount}</div>
            <div className="stat-block-sub" style={{ marginTop: '2px' }}>CYCLIC LOW</div>
          </div>
          <div style={{ width: '1px', background: 'var(--rule)' }} />
          <div style={{ flex: 1 }}>
            <div className="stat-block-value sm neg">{extendedCount}</div>
            <div className="stat-block-sub" style={{ marginTop: '2px' }}>EXTENDED</div>
          </div>
        </div>
      </div>
    </div>
  );
});

export const SectorZScore = ({ isMobile }) => {
  const [benchmark, setBenchmark] = useState('SPY');
  const [returnPeriod, setReturnPeriod] = useState(RETURN_PERIODS[2].value);
  const [zWindow, setZWindow] = useState(Z_WINDOWS[2].value);
  const [selectedSector, setSelectedSector] = useState(null);

  const [zScoreType, setZScoreType] = useState('line');
  const [priceType, setPriceType] = useState('line');

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

  useEffect(() => {
    if (!selectedSector && sectors.length > 0) {
      const validSectors = sectors.filter((s) => s.currentZScore !== null);
      if (validSectors.length > 0) {
        const sorted = [...validSectors].sort((a, b) => a.currentZScore - b.currentZScore);
        setSelectedSector(sorted[0].symbol);
      }
    }
  }, [sectors, selectedSector]);

  if (loading) return <LoadingState progress={progress} />;
  if (error)   return <ErrorState error={error} onRetry={refetch} />;

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
          background: 'var(--rule)'
        }}
      >
        {/* Z-Score Chart */}
        <div className="glass-card animate-in" style={{ padding: '0', animationDelay: '100ms' }}>
          <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Z-SCORE OVER TIME</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <ExportCsvButton
                data={sectors
                  .filter(s => s.currentZScore !== null)
                  .map(s => ({ symbol: s.symbol, name: s.name, current_z_score: s.currentZScore?.toFixed(4) }))
                }
                filename="sector_z_scores"
                columns={[
                  { key: 'symbol',          label: 'Sector ETF' },
                  { key: 'name',            label: 'Sector Name' },
                  { key: 'current_z_score', label: 'Current Z-Score' },
                ]}
              />
              <ChartToggle type={zScoreType} setType={setZScoreType} />
            </div>
          </div>
          <div style={{ padding: isMobile ? '16px 8px' : '24px 16px' }}>
            <div style={{ height: isMobile ? '280px' : '360px' }}>
              <SectorChart sectors={sectors} selectedSector={selectedSector} isMobile={isMobile} chartType={zScoreType} />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <div className="badge" style={{ color: 'var(--pos)', borderColor: 'oklch(74% 0.16 148 / 0.3)', fontSize: '9px' }}>CYCLICAL LOW (−2)</div>
              <div className="badge" style={{ color: 'var(--neg)', borderColor: 'oklch(64% 0.18 28 / 0.3)',  fontSize: '9px' }}>EXTENDED (+2)</div>
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
      <div className="glass-card animate-in" style={{ padding: '0', marginBottom: '20px', marginTop: '20px', animationDelay: '200ms' }}>
        <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span>PRICE PERFORMANCE VS {benchmark}</span>
            {selectedSectorData && (
              <span style={{ marginLeft: '12px', fontWeight: '400', opacity: 0.6 }}>
                — {selectedSectorData.symbol} ({selectedSectorData.name})
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <ExportCsvButton
              data={(() => {
                if (!selectedSectorData?.prices?.length) return [];
                const startPrice = selectedSectorData.prices[0].price;
                return selectedSectorData.prices.map(p => ({
                  date: p.date instanceof Date ? p.date.toISOString().slice(0, 10) : p.date,
                  price: p.price?.toFixed(4),
                  pct_change_from_start: (((p.price / startPrice) - 1) * 100).toFixed(2),
                }));
              })()}
              filename={`price_performance_${selectedSector || 'all'}_vs_${benchmark}`}
              columns={[
                { key: 'date',                 label: 'Date' },
                { key: 'price',                label: `${selectedSector || ''} Price (USD)` },
                { key: 'pct_change_from_start', label: 'Return from Start (%)' },
              ]}
            />
            <ChartToggle type={priceType} setType={setPriceType} />
          </div>
        </div>
        <div style={{ padding: isMobile ? '16px 8px' : '24px 16px' }}>
          {selectedSectorData && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '6px 10px', background: 'var(--bg-wash)', border: '1px solid var(--rule)', width: 'fit-content' }}>
              <div style={{ width: '8px', height: '8px', background: selectedSectorData.color, flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)', fontSize: '12px' }}>
                {selectedSectorData.symbol}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-mid)', fontSize: '11px' }}>{selectedSectorData.name}</span>
            </div>
          )}
          <div style={{ height: isMobile ? '260px' : '320px' }}>
            <PriceChart
              sectors={sectors}
              selectedSector={selectedSector}
              benchmarkData={benchmarkData}
              benchmark={benchmark}
              isMobile={isMobile}
              chartType={priceType}
            />
          </div>
        </div>
      </div>

      {/* About Section */}
      <div className="glass-card animate-in" style={{ padding: '16px 20px', animationDelay: '300ms' }}>
        <div>
          <div className="stat-block-label" style={{ marginBottom: '8px' }}>About Z-Scores (Improved Methodology)</div>
          <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-mid)', fontSize: '13px', lineHeight: '1.6', marginBottom: '16px' }}>
            The Z-score measures how many standard deviations a sector's excess performance is from its historical pattern.
            This calculation accounts for each sector's structural relationship with the benchmark.
          </p>
          <div style={{
            background: 'var(--bg-wash)',
            padding: '12px 16px',
            borderLeft: '1px solid var(--rule-strong)',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            lineHeight: '1.8',
          }}>
            <div className="stat-block-label" style={{ marginBottom: '8px' }}>How It Works</div>
            <div style={{ color: 'var(--text-mid)' }}>
              1. <span style={{ color: 'var(--text)' }}>STRUCTURAL BASELINE:</span> Calculate each sector's 10-year avg return vs {benchmark}<br/>
              2. <span style={{ color: 'var(--text)' }}>EXCESS RETURN:</span> Current return minus the structural baseline<br/>
              3. <span style={{ color: 'var(--text)' }}>Z-SCORE:</span> How many std deviations the excess return is from its mean
            </div>
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--rule)', color: 'var(--text-dim)', fontSize: '11px' }}>
              <span style={{ color: 'var(--pos)' }}>Z ≤ −2:</span> Sector underperforming more than structural norm (CHEAP){' '}
              | <span style={{ color: 'var(--neg)' }}>Z ≥ +2:</span> Sector outperforming more than structural norm (EXTENDED)
            </div>
          </div>
        </div>
      </div>

      <SourceLink
        href="https://finance.yahoo.com"
        label="Yahoo Finance"
        note="Sector ETF price data (SPDR ETFs)"
      />
    </>
  );
};

export default SectorZScore;
