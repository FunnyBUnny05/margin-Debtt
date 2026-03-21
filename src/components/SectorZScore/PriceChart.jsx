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
            borderColor: '#555555',
            backgroundColor: '#55555515',
            borderWidth: 1,
            borderDash: [4, 4],
            pointRadius: 0,
            pointHoverRadius: 4,
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
              color: '#999999',
              font: { size: 10, family: 'Courier New, monospace' },
              usePointStyle: true,
              padding: 12,
              boxWidth: 6,
              boxHeight: 6
            }
          },
          tooltip: {
            enabled: true,
            backgroundColor: '#0A0A0A',
            titleColor: '#FF6600',
            bodyColor: '#CCCCCC',
            borderColor: '#2A2A2A',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 0,
            bodyFont: { size: 11, family: 'Courier New, monospace' },
            titleFont: { size: 11, weight: '700', family: 'Courier New, monospace' },
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
              color: '#1A1A1A',
              drawBorder: false
            },
            ticks: {
              color: '#555555',
              font: { size: 10, family: 'Courier New, monospace' },
              maxTicksLimit: isMobile ? 5 : 10
            }
          },
          y: {
            grid: {
              color: '#1A1A1A',
              drawBorder: false
            },
            ticks: {
              color: '#555555',
              font: { size: 10, family: 'Courier New, monospace' },
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
            ctx.strokeStyle = '#333333';
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
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
      >
        <div style={{ fontFamily: 'Courier New, monospace', fontSize: '12px', color: '#444444' }}>
          SELECT A SECTOR TO VIEW PRICE PERFORMANCE
        </div>
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
