import React, { useState, useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import Papa from 'papaparse';

export const CandlestickChart = ({ isMobile }) => {
  const [csvData, setCsvData] = useState(null);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [chartReady, setChartReady] = useState(false);
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candlestickSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);

  // Initialize chart when data is available
  useEffect(() => {
    // Only initialize chart if we have data
    if (!csvData) {
      console.log('No data yet, waiting...');
      return;
    }

    // Wait for container to be ready
    if (!chartContainerRef.current) {
      console.log('Container not ready');
      return;
    }

    // Use setTimeout to ensure DOM is fully rendered
    const initTimer = setTimeout(() => {
      try {
        // Cleanup existing chart if any
        if (chartRef.current) {
          console.log('Removing existing chart');
          chartRef.current.remove();
          chartRef.current = null;
          candlestickSeriesRef.current = null;
          volumeSeriesRef.current = null;
        }

        const container = chartContainerRef.current;
        if (!container) {
          console.error('Container element is null');
          return;
        }

        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        console.log('Creating chart with dimensions:', containerWidth, 'x', containerHeight);

        if (containerWidth === 0 || containerHeight === 0) {
          console.error('Container has zero dimensions:', { containerWidth, containerHeight });
          setError('Chart container has invalid dimensions. Please refresh the page.');
          return;
        }

        const chart = createChart(container, {
          width: containerWidth,
          height: containerHeight,
          autoSize: false,
          layout: {
            background: { color: '#1a1f3a' },
            textColor: '#d1d5db',
          },
          grid: {
            vertLines: { color: '#2d3748' },
            horzLines: { color: '#2d3748' },
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
            borderColor: '#4a5568',
            visible: true,
          },
          timeScale: {
            borderColor: '#4a5568',
            timeVisible: true,
            secondsVisible: false,
            visible: true,
          },
          handleScroll: {
            vertTouchDrag: true,
            mouseWheel: true,
            pressedMouseMove: true,
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

        console.log('Chart created successfully, now loading data...');

        // Load data immediately
        if (csvData && csvData.candlesticks && csvData.candlesticks.length > 0) {
          console.log('Loading', csvData.candlesticks.length, 'candlesticks into chart');
          candlestickSeries.setData(csvData.candlesticks);

          if (csvData.volumes && csvData.volumes.length > 0) {
            console.log('Loading', csvData.volumes.length, 'volume bars');
            volumeSeries.setData(csvData.volumes);
          }

          chart.timeScale().fitContent();
          console.log('Chart data loaded and fitted to view');
          setChartReady(true);
        }

        // Handle resize
        const handleResize = () => {
          if (container && chartRef.current) {
            const newWidth = container.clientWidth;
            const newHeight = container.clientHeight;
            if (newWidth > 0 && newHeight > 0) {
              chartRef.current.applyOptions({
                width: newWidth,
                height: newHeight,
              });
            }
          }
        };

        window.addEventListener('resize', handleResize);

        // Cleanup function
        return () => {
          window.removeEventListener('resize', handleResize);
          if (chartRef.current) {
            try {
              chartRef.current.remove();
            } catch (e) {
              console.error('Error removing chart:', e);
            }
            chartRef.current = null;
            candlestickSeriesRef.current = null;
            volumeSeriesRef.current = null;
          }
        };
      } catch (err) {
        console.error('Chart initialization error:', err);
        setError('Failed to initialize chart: ' + err.message);
      }
    }, 100);

    return () => clearTimeout(initTimer);
  }, [csvData, isMobile]); // Re-initialize when data changes or screen size changes

  const parseCSV = (file) => {
    setError(null);
    console.log('Parsing CSV file:', file.name);

    Papa.parse(file, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const headers = results.meta.fields;
          console.log('CSV headers:', headers);

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

          console.log('Parsed', candlesticks.length, 'candlesticks');
          setCsvData({ candlesticks, volumes });
        } catch (err) {
          console.error('CSV parsing error:', err);
          setError(`Failed to parse CSV: ${err.message}`);
        }
      },
      error: (error) => {
        console.error('Papa parse error:', error);
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
      // Fallback method using canvas
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
    } catch (err) {
      console.error('Screenshot error:', err);
      setError(`Failed to download screenshot: ${err.message}`);
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
      <div className="glass-card" style={{ padding: isMobile ? '16px' : '24px', marginBottom: '24px' }}>
        {!csvData && (
          <div
            style={{
              width: '100%',
              height: isMobile ? '400px' : '600px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              color: 'var(--text-tertiary)',
            }}
          >
            <div>
              <div style={{ fontSize: '64px', marginBottom: '16px', opacity: 0.5 }}>📊</div>
              <div style={{ fontSize: '18px', fontWeight: '600' }}>Upload a CSV to view the chart</div>
              <div style={{ fontSize: '14px', marginTop: '8px', opacity: 0.7 }}>
                Your candlestick chart will appear here
              </div>
            </div>
          </div>
        )}
        {csvData && (
          <div
            ref={chartContainerRef}
            style={{
              width: '100%',
              height: isMobile ? '400px' : '600px',
              minHeight: isMobile ? '400px' : '600px',
              position: 'relative',
              backgroundColor: '#1a1f3a',
            }}
          />
        )}
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
