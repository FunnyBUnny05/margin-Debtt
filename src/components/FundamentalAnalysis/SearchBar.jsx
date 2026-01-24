import { useState } from 'react';
import './FundamentalAnalysis.css';

export const SearchBar = ({ onSearch, isLoading }) => {
  const [ticker, setTicker] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = ticker.trim().toUpperCase();

    // Validate ticker format (1-5 uppercase letters)
    if (!trimmed) {
      setError('Please enter a ticker symbol');
      return;
    }

    if (!/^[A-Z]{1,5}$/.test(trimmed)) {
      setError('Invalid ticker symbol. Use 1-5 letters (e.g., AAPL, MSFT)');
      return;
    }

    setError('');
    onSearch(trimmed);
  };

  const handleChange = (e) => {
    const value = e.target.value.toUpperCase();
    setTicker(value);
    if (error) setError(''); // Clear error on input change
  };

  return (
    <form onSubmit={handleSubmit} className="fa-search-container">
      <input
        type="text"
        className="fa-search-input"
        value={ticker}
        onChange={handleChange}
        placeholder="Enter ticker symbol (e.g., AAPL)"
        disabled={isLoading}
        aria-label="Stock ticker symbol"
        aria-invalid={!!error}
        aria-describedby={error ? 'ticker-error' : undefined}
        maxLength={5}
      />
      <button
        type="submit"
        className="fa-search-btn"
        disabled={isLoading || !ticker.trim()}
        aria-label="Analyze stock"
      >
        {isLoading ? 'Analyzing...' : 'Analyze'}
      </button>
      {error && (
        <div id="ticker-error" className="fa-error-message" style={{
          color: 'var(--accent-coral)',
          fontSize: '13px',
          marginTop: '8px',
          gridColumn: '1 / -1'
        }}>
          {error}
        </div>
      )}
    </form>
  );
};
