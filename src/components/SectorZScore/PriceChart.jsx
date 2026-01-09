import React, { useEffect, useRef } from 'react';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Tooltip,
  Legend
} from 'chart.js';
import 'chartjs-adapter-date-fns';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Tooltip,
  Legend
);

export const PriceChart = ({ sectors, selectedSector, benchmarkData, benchmark, isMobile }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }

    if (!chartRef.current || !selectedSector || !benchmarkData) return;

    const sector = sectors.find((s) => s.symbol === selectedSector);
    if (!sector || !sector.prices || sector.prices.length === 0) return;

    const ctx = chartRef.current.getContext('2d');

    // Normalize prices to percentage change from start
    const normalizeData = (prices) => {
      if (!prices || prices.length === 0) return [];
      const startPrice = prices[0].price;
      return prices.map((p) => ({
        x: p.date,
        y: ((p.price / startPrice) - 1) * 100
      }));
    };

    // Align the data to start from the same date
    const sectorPrices = sector.prices;
    const benchPrices = benchmarkData;

    // Find common start date
    const sectorStart = sectorPrices[0]?.date.getTime() || 0;
    const benchStart = benchPrices[0]?.date.getTime() || 0;
    const commonStart = Math.max(sectorStart, benchStart);

    const filteredSector = sectorPrices.filter((p) => p.date.getTime() >= commonStart);
    const filteredBench = benchPrices.filter((p) => p.date.getTime() >= commonStart);

    const sectorData = normalizeData(filteredSector);
    const benchData = normalizeData(filteredBench);

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [
          {
            label: sector.symbol,
            data: sectorData,
            borderColor: sector.color,
            backgroundColor: sector.color + '20',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
            tension: 0.1
          },
          {
            label: benchmark,
            data: benchData,
            borderColor: '#888',
            backgroundColor: '#88820',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            pointHoverRadius: 5,
            tension: 0.1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: '#888',
              font: { size: 11 },
              usePointStyle: true,
              padding: 15
            }
          },
          tooltip: {
            enabled: true,
            backgroundColor: '#1a1a2e',
            titleColor: '#fff',
            bodyColor: '#e0e0e0',
            borderColor: '#444',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              title: (items) => {
                if (items.length > 0) {
                  const date = new Date(items[0].parsed.x);
                  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
                }
                return '';
              },
              label: (context) => {
                const value = context.parsed.y;
                const sign = value >= 0 ? '+' : '';
                return `${context.dataset.label}: ${sign}${value.toFixed(1)}%`;
              }
            }
          }
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'year',
              displayFormats: {
                year: 'yyyy'
              }
            },
            grid: {
              color: '#333',
              drawBorder: false
            },
            ticks: {
              color: '#888',
              font: { size: 11 },
              maxTicksLimit: isMobile ? 5 : 10
            }
          },
          y: {
            grid: {
              color: '#333',
              drawBorder: false
            },
            ticks: {
              color: '#888',
              font: { size: 11 },
              callback: (value) => `${value >= 0 ? '+' : ''}${value}%`
            }
          }
        }
      },
      plugins: [
        {
          id: 'zeroLine',
          beforeDraw: (chart) => {
            const ctx = chart.ctx;
            const yAxis = chart.scales.y;
            const xAxis = chart.scales.x;

            const yPixel = yAxis.getPixelForValue(0);

            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 1;
            ctx.moveTo(xAxis.left, yPixel);
            ctx.lineTo(xAxis.right, yPixel);
            ctx.stroke();
            ctx.restore();
          }
        }
      ]
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [sectors, selectedSector, benchmarkData, benchmark, isMobile]);

  if (!selectedSector) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#666',
          fontSize: '14px'
        }}
      >
        Select a sector to view price performance
      </div>
    );
  }

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      <canvas ref={chartRef} />
    </div>
  );
};

export default PriceChart;
