import { SearchBar } from './SearchBar';
import { StockHeader } from './StockHeader';
import { MetricCard } from './MetricCard';
import { useAlphaVantage } from './hooks/useAlphaVantage';
import './FundamentalAnalysis.css';

export const FundamentalAnalysis = ({ isMobile }) => {
  const { data, loading, error, analyzeStock } = useAlphaVantage();

  return (
    <div className="fa-container">
      <div className="fa-header">
        <h1>📊 Fundamental Analysis Dashboard</h1>
        <p>Comprehensive stock fundamental analysis powered by Alpha Vantage</p>
      </div>

      <SearchBar onSearch={analyzeStock} isLoading={loading} />

      {loading && (
        <div className="fa-loading">
          <p>Fetching data... This may take a few seconds.</p>
        </div>
      )}

      {error && (
        <div className="fa-error">
          <p>{error}</p>
        </div>
      )}

      {data && !loading && !error && (
        <div className="fa-dashboard animate-in">
          <StockHeader data={data} />

          <div className="fa-metrics-grid">
            <MetricCard
              title="Valuation"
              icon="💰"
              score={data.scores.valuation}
              metrics={data.valuationMetrics}
            />

            <MetricCard
              title="Profitability"
              icon="📈"
              score={data.scores.profitability}
              metrics={data.profitabilityMetrics}
            />

            <MetricCard
              title="Financial Health"
              icon="💪"
              score={data.scores.health}
              metrics={data.healthMetrics}
            />

            <MetricCard
              title="Growth"
              icon="🚀"
              score={data.scores.growth}
              metrics={data.growthMetrics}
            />
          </div>
        </div>
      )}

      <div className="fa-info-text">
        <p>Data provided by Alpha Vantage • Scores calculated using industry-standard thresholds</p>
      </div>
    </div>
  );
};

export default FundamentalAnalysis;
