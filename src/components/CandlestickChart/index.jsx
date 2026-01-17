import React, { useState, useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import Papa from 'papaparse';

export const CandlestickChart = ({ isMobile }) => {
  const [csvData, setCsvData] = useState(null);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candlestickSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Cleanup existing chart if any
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const containerWidth = chartContainerRef.current.clientWidth;
    const containerHeight = chartContainerRef.current.clientHeight;

    const chart = createChart(chartContainerRef.current, {
      width: containerWidth,
      height: containerHeight,
      layout: {
        background: { color: 'transparent' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.1)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.1)' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#22d3ee',
          width: 1,
          style: 2,
          labelBackgroundColor: '#22d3ee',
        },
        horzLine: {
          color: '#22d3ee',
          width: 1,
          style: 2,
          labelBackgroundColor: '#22d3ee',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(148, 163, 184, 0.2)',
      },
      timeScale: {
        borderColor: 'rgba(148, 163, 184, 0.2)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        vertTouchDrag: true,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#51cf66',
      downColor: '#ff6b6b',
      borderUpColor: '#51cf66',
      borderDownColor: '#ff6b6b',
      wickUpColor: '#51cf66',
      wickDownColor: '#ff6b6b',
    });

    const volumeSeries = chart.addHistogramSeries({
      color: '#60a5fa',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        const newWidth = chartContainerRef.current.clientWidth;
        const newHeight = chartContainerRef.current.clientHeight;
        chartRef.current.applyOptions({
          width: newWidth,
          height: newHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []);

  // Update chart data
  useEffect(() => {
    if (csvData && candlestickSeriesRef.current && volumeSeriesRef.current) {
      try {
        candlestickSeriesRef.current.setData(csvData.candlesticks);
        if (csvData.volumes && csvData.volumes.length > 0) {
          volumeSeriesRef.current.setData(csvData.volumes);
        }
        chartRef.current.timeScale().fitContent();
      } catch (err) {
        setError(`Failed to render chart: ${err.message}`);
      }
    }
  }, [csvData]);

  const parseCSV = (file) => {
    setError(null);

    Papa.parse(file, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const headers = results.meta.fields;

          // Auto-map TradingView headers (case-insensitive)
          const timeHeader = headers.find(h => h.toLowerCase().includes('time') || h.toLowerCase() === 'date');
          const openHeader = headers.find(h => h.toLowerCase() === 'open');
          const highHeader = headers.find(h => h.toLowerCase() === 'high');
          const lowHeader = headers.find(h => h.toLowerCase() === 'low');
          const closeHeader = headers.find(h => h.toLowerCase() === 'close');
          const volumeHeader = headers.find(h => h.toLowerCase() === 'volume');

          if (!timeHeader || !openHeader || !highHeader || !lowHeader || !closeHeader) {
            setError('CSV must contain Time/Date, Open, High, Low, and Close columns');
            return;
          }

          const candlesticks = [];
          const volumes = [];

          results.data.forEach((row) => {
            const timeStr = row[timeHeader];
            if (!timeStr) return;

            // Parse time - handle various formats
            let time;
            if (timeStr.includes('T') || timeStr.includes('-')) {
              // ISO format or YYYY-MM-DD
              time = Math.floor(new Date(timeStr).getTime() / 1000);
            } else if (timeStr.includes('/')) {
              // MM/DD/YYYY or DD/MM/YYYY
              time = Math.floor(new Date(timeStr).getTime() / 1000);
            } else {
              // Unix timestamp
              time = parseInt(timeStr);
            }

            if (isNaN(time)) return;

            const open = parseFloat(row[openHeader]);
            const high = parseFloat(row[highHeader]);
            const low = parseFloat(row[lowHeader]);
            const close = parseFloat(row[closeHeader]);

            if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) return;

            candlesticks.push({
              time,
              open,
              high,
              low,
              close,
            });

            // Add volume if available
            if (volumeHeader && row[volumeHeader]) {
              const volume = parseFloat(row[volumeHeader]);
              if (!isNaN(volume)) {
                volumes.push({
                  time,
                  value: volume,
                  color: close >= open ? 'rgba(81, 207, 102, 0.5)' : 'rgba(255, 107, 107, 0.5)',
                });
              }
            }
          });

          if (candlesticks.length === 0) {
            setError('No valid data found in CSV file');
            return;
          }

          // Sort by time
          candlesticks.sort((a, b) => a.time - b.time);
          volumes.sort((a, b) => a.time - b.time);

          setCsvData({ candlesticks, volumes });
        } catch (err) {
          setError(`Failed to parse CSV: ${err.message}`);
        }
      },
      error: (error) => {
        setError(`CSV parsing error: ${error.message}`);
      },
    });
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      parseCSV(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        parseCSV(file);
      } else {
        setError('Please upload a CSV file');
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const downloadScreenshot = () => {
    if (!chartRef.current || !csvData) {
      setError('Please load data before taking a screenshot');
      return;
    }

    try {
      // Use lightweight-charts' built-in screenshot function
      const screenshot = chartRef.current.takeScreenshot();

      if (!screenshot) {
        setError('Failed to capture chart screenshot');
        return;
      }

      // Create download link
      const a = document.createElement('a');
      a.href = screenshot.toDataURL();
      a.download = `candlestick-chart-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      // Fallback method
      try {
        const canvases = chartContainerRef.current.querySelectorAll('canvas');
        if (!canvases || canvases.length === 0) {
          setError('Failed to capture chart screenshot');
          return;
        }

        // Get the main canvas (usually the largest one)
        let mainCanvas = canvases[0];
        canvases.forEach(canvas => {
          if (canvas.width * canvas.height > mainCanvas.width * mainCanvas.height) {
            mainCanvas = canvas;
          }
        });

        // Create a temporary canvas with dark background
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = mainCanvas.width;
        tempCanvas.height = mainCanvas.height;
        const ctx = tempCanvas.getContext('2d');

        // Fill with dark background
        ctx.fillStyle = '#0a0e27';
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        // Draw the chart on top
        ctx.drawImage(mainCanvas, 0, 0);

        // Convert to blob and download
        tempCanvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `candlestick-chart-${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        });
      } catch (fallbackErr) {
        setError(`Failed to download screenshot: ${fallbackErr.message}`);
      }
    }
  };

  return (
    <div className="animate-in">
      {/* File Upload Section */}
      <div className="glass-card" style={{ padding: isMobile ? '20px' : '32px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px' }}>
          📊 Upload TradingView CSV
        </h2>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          style={{
            border: `2px dashed ${isDragging ? 'var(--accent-cyan)' : 'var(--glass-border)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '40px',
            textAlign: 'center',
            background: isDragging ? 'rgba(34, 211, 238, 0.1)' : 'var(--background-secondary)',
            transition: 'all var(--transition-smooth)',
            cursor: 'pointer',
          }}
        >
          <input
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            id="csv-upload"
          />
          <label
            htmlFor="csv-upload"
            style={{
              cursor: 'pointer',
              display: 'block',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📈</div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
              Drop your CSV file here or click to browse
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
              Supports TradingView CSV exports with Time, Open, High, Low, Close, Volume
            </div>
          </label>
        </div>

        {error && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px 16px',
              background: 'rgba(255, 107, 107, 0.1)',
              border: '1px solid rgba(255, 107, 107, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--accent-coral)',
              fontSize: '14px',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {csvData && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px 16px',
              background: 'rgba(81, 207, 102, 0.1)',
              border: '1px solid rgba(81, 207, 102, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--accent-emerald)',
              fontSize: '14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              ✓ Loaded {csvData.candlesticks.length} candles
              {csvData.volumes.length > 0 && ` with volume data`}
            </div>
            <button
              onClick={downloadScreenshot}
              className="btn-primary"
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                background: 'var(--gradient-blue)',
              }}
            >
              📸 Download Screenshot
            </button>
          </div>
        )}
      </div>

      {/* Chart Section */}
      <div className="glass-card" style={{ padding: isMobile ? '16px' : '24px' }}>
        <div
          ref={chartContainerRef}
          style={{
            width: '100%',
            height: isMobile ? '400px' : '600px',
            position: 'relative',
          }}
        >
          {!csvData && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                color: 'var(--text-tertiary)',
              }}
            >
              <div style={{ fontSize: '64px', marginBottom: '16px', opacity: 0.5 }}>📊</div>
              <div style={{ fontSize: '18px', fontWeight: '600' }}>Upload a CSV to view the chart</div>
              <div style={{ fontSize: '14px', marginTop: '8px', opacity: 0.7 }}>
                Your candlestick chart will appear here
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="glass-card" style={{ padding: isMobile ? '20px' : '24px', marginTop: '24px', borderLeft: '4px solid var(--accent-cyan)' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          <div style={{ fontSize: '32px' }}>💡</div>
          <div style={{ flex: 1 }}>
            <strong style={{ color: 'var(--accent-cyan)', fontSize: '15px' }}>How to use:</strong>
            <ul style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px', lineHeight: '1.6', paddingLeft: '20px' }}>
              <li>Export your data from TradingView as CSV (Time, Open, High, Low, Close, Volume)</li>
              <li>Drag and drop the CSV file into the upload area above</li>
              <li>The chart will automatically render with green/red candlesticks</li>
              <li>Use mouse wheel to zoom, drag to pan, click to see details</li>
              <li>Click "Download Screenshot" to save the chart as PNG for AI analysis</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
