import { getScoreColor } from './utils/calculations';
import './FundamentalAnalysis.css';

export const MetricCard = ({ title, icon, score, metrics }) => {
  const scoreColor = getScoreColor(score);

  return (
    <div className="fa-metric-card glass-card">
      <div className="fa-card-header">
        <div className="fa-card-title">
          {icon} {title}
        </div>
        <div
          className="fa-card-score"
          style={{ color: scoreColor }}
        >
          {score}
        </div>
      </div>

      <div className="fa-metrics-list">
        {metrics.map((metric, index) => (
          <div key={index} className="fa-metric-item">
            <div className="fa-metric-name">{metric.name}</div>
            <div className="fa-metric-value-wrapper">
              <div className="fa-metric-value">{metric.value}</div>
              <div className={`fa-status-indicator fa-status-${metric.status}`} />
            </div>
          </div>
        ))}
      </div>

      <div className="fa-progress-bar">
        <div
          className="fa-progress-fill"
          style={{
            width: `${score}%`,
            background: scoreColor
          }}
        />
      </div>
    </div>
  );
};
