import { useState } from 'react';
import './FundamentalAnalysis.css';

export const SearchBar = ({ onSearch, isLoading }) => {
  const [ticker, setTicker] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (ticker.trim()) {
      onSearch(ticker.trim().toUpperCase());
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  return (
    <div className="fa-search-container">
      <input
        type="text"
        className="fa-search-input"
        value={ticker}
        onChange={(e) => setTicker(e.target.value.toUpperCase())}
        onKeyDown={handleKeyPress}
        placeholder="Enter ticker symbol (e.g., AAPL)"
        disabled={isLoading}
      />
      <button
        className="fa-search-btn"
        onClick={handleSubmit}
        disabled={isLoading}
      >
        {isLoading ? 'Analyzing...' : 'Analyze'}
      </button>
    </div>
  );
};
