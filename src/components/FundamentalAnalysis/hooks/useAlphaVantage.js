import { useState } from 'react';
import { ALPHA_VANTAGE_API_KEY, ALPHA_VANTAGE_BASE_URL } from '../constants';
import {
  safeFloat,
  calculateValuationScore,
  calculateProfitabilityScore,
  calculateHealthScore,
  calculateGrowthScore,
  calculateOverallScore,
  getRating,
  formatMarketCap,
  formatMetricValue,
  getMetricStatus
} from '../utils/calculations';

/**
 * Custom hook for fetching and analyzing stock data from Alpha Vantage
 */
export const useAlphaVantage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  /**
   * Fetches and analyzes stock data for a given ticker
   */
  const analyzeStock = async (ticker) => {
    if (!ticker || ticker.trim() === '') {
      setError('Please enter a ticker symbol');
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const url = `${ALPHA_VANTAGE_BASE_URL}?function=OVERVIEW&symbol=${ticker.toUpperCase()}&apikey=${ALPHA_VANTAGE_API_KEY}`;
      const response = await fetch(url);
      const apiData = await response.json();

      // Check for API errors
      if (!apiData.Symbol) {
        throw new Error(apiData.Note || apiData['Error Message'] || 'Invalid ticker symbol or API error');
      }

      // Extract and convert metrics
      const metrics = {
        pe_ratio: safeFloat(apiData.PERatio),
        peg_ratio: safeFloat(apiData.PEGRatio),
        pb_ratio: safeFloat(apiData.PriceToBookRatio),
        ps_ratio: safeFloat(apiData.PriceToSalesRatioTTM),
        profit_margin: safeFloat(apiData.ProfitMargin) * 100,
        operating_margin: safeFloat(apiData.OperatingMarginTTM) * 100,
        roe: safeFloat(apiData.ReturnOnEquityTTM) * 100,
        roa: safeFloat(apiData.ReturnOnAssetsTTM) * 100,
        current_ratio: safeFloat(apiData.CurrentRatio),
        quick_ratio: safeFloat(apiData.QuickRatio),
        debt_to_equity: safeFloat(apiData.DebtToEquity),
        beta: safeFloat(apiData.Beta),
        revenue_growth: safeFloat(apiData.QuarterlyRevenueGrowthYOY) * 100,
        eps_growth: safeFloat(apiData.QuarterlyEarningsGrowthYOY) * 100,
        dividend_yield: safeFloat(apiData.DividendYield) * 100
      };

      // Calculate scores
      const scores = {
        valuation: calculateValuationScore(metrics),
        profitability: calculateProfitabilityScore(metrics),
        health: calculateHealthScore(metrics),
        growth: calculateGrowthScore(metrics)
      };

      const overallScore = calculateOverallScore(scores);
      const rating = getRating(overallScore);

      // Format data for display
      const result = {
        ticker: apiData.Symbol,
        name: apiData.Name || 'N/A',
        sector: apiData.Sector || 'N/A',
        industry: apiData.Industry || 'N/A',
        marketCap: formatMarketCap(apiData.MarketCapitalization),
        overallScore,
        rating,
        scores,
        valuationMetrics: [
          {
            name: 'P/E Ratio',
            value: formatMetricValue(metrics.pe_ratio),
            status: getMetricStatus('PE_RATIO', metrics.pe_ratio)
          },
          {
            name: 'PEG Ratio',
            value: formatMetricValue(metrics.peg_ratio),
            status: getMetricStatus('PEG_RATIO', metrics.peg_ratio)
          },
          {
            name: 'P/B Ratio',
            value: formatMetricValue(metrics.pb_ratio),
            status: getMetricStatus('PB_RATIO', metrics.pb_ratio)
          },
          {
            name: 'P/S Ratio',
            value: formatMetricValue(metrics.ps_ratio),
            status: getMetricStatus('PS_RATIO', metrics.ps_ratio)
          }
        ],
        profitabilityMetrics: [
          {
            name: 'Profit Margin',
            value: formatMetricValue(metrics.profit_margin, true),
            status: getMetricStatus('PROFIT_MARGIN', metrics.profit_margin)
          },
          {
            name: 'Operating Margin',
            value: formatMetricValue(metrics.operating_margin, true),
            status: getMetricStatus('OPERATING_MARGIN', metrics.operating_margin)
          },
          {
            name: 'ROE',
            value: formatMetricValue(metrics.roe, true),
            status: getMetricStatus('ROE', metrics.roe)
          },
          {
            name: 'ROA',
            value: formatMetricValue(metrics.roa, true),
            status: getMetricStatus('ROA', metrics.roa)
          }
        ],
        healthMetrics: [
          {
            name: 'Current Ratio',
            value: formatMetricValue(metrics.current_ratio),
            status: getMetricStatus('CURRENT_RATIO', metrics.current_ratio)
          },
          {
            name: 'Quick Ratio',
            value: formatMetricValue(metrics.quick_ratio),
            status: getMetricStatus('QUICK_RATIO', metrics.quick_ratio)
          },
          {
            name: 'Debt/Equity',
            value: formatMetricValue(metrics.debt_to_equity),
            status: getMetricStatus('DEBT_TO_EQUITY', metrics.debt_to_equity)
          },
          {
            name: 'Beta',
            value: formatMetricValue(metrics.beta),
            status: metrics.beta > 0.8 && metrics.beta < 1.2 ? 'good' : 'caution'
          }
        ],
        growthMetrics: [
          {
            name: 'Revenue Growth (YoY)',
            value: formatMetricValue(metrics.revenue_growth, true),
            status: getMetricStatus('REVENUE_GROWTH', metrics.revenue_growth)
          },
          {
            name: 'EPS Growth (YoY)',
            value: formatMetricValue(metrics.eps_growth, true),
            status: getMetricStatus('EPS_GROWTH', metrics.eps_growth)
          },
          {
            name: 'Dividend Yield',
            value: formatMetricValue(metrics.dividend_yield, true),
            status: getMetricStatus('DIVIDEND_YIELD', metrics.dividend_yield)
          }
        ]
      };

      setData(result);
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Error fetching data. Please try again.');
      setLoading(false);
      console.error('Alpha Vantage API Error:', err);
    }
  };

  return {
    data,
    loading,
    error,
    analyzeStock
  };
};
