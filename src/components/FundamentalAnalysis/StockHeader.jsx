import { getScoreColor } from './utils/calculations';
import './FundamentalAnalysis.css';

export const StockHeader = ({ data }) => {
  const scoreColor = getScoreColor(data.overallScore);

  return (
    <div className="fa-stock-header glass-card">
      <div className="fa-stock-title">
        <div className="fa-stock-name">
          <h2>
            {data.ticker} - {data.name}
          </h2>
          <p>
            {data.sector} | {data.industry} | Market Cap: {data.marketCap}
          </p>
        </div>
        <div className="fa-overall-score">
          <div className="fa-score-label">OVERALL SCORE</div>
          <div
            className="fa-score-number"
            style={{ color: scoreColor }}
          >
            {data.overallScore}
          </div>
          <div
            className="fa-rating-badge"
            style={{
              background: scoreColor,
              color: 'var(--background-primary)'
            }}
          >
            {data.rating}
          </div>
        </div>
      </div>
    </div>
  );
};
