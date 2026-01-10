import React, { useEffect, useRef } from 'react';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import 'chartjs-adapter-date-fns';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Tooltip,
  Legend,
  Filler
);

export const SectorChart = ({ sectors, selectedSector, isMobile }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }

    if (!chartRef.current) return;

    const validSectors = sectors.filter(s => s.zScores && s.zScores.length > 0);
    if (validSectors.length === 0) return;

    const ctx = chartRef.current.getContext('2d');

    const datasets = validSectors.map((sector) => {
      const isSelected = selectedSector === sector.symbol;
      return {
        label: sector.symbol,
        data: sector.zScores.map((d) => ({
          x: d.date,
          y: d.zScore
        })),
        borderColor: sector.color,
        backgroundColor: sector.color + '20',
        borderWidth: isSelected ? 3 : 1,
        pointRadius: 0,
        pointHoverRadius: isSelected ? 6 : 4,
        tension: 0.1,
        order: isSelected ? 0 : 1
      };
    });

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(30, 41, 59, 0.95)',
            titleColor: '#ffffff',
            bodyColor: '#e0e7ff',
            borderColor: 'rgba(167, 139, 250, 0.3)',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            bodyFont: { size: 12 },
            titleFont: { size: 13, weight: '600' },
            callbacks: {
              title: (items) => {
                if (items.length > 0) {
                  const date = new Date(items[0].parsed.x);
                  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
                }
                return '';
              },
              label: (context) => {
                return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}`;
              }
            },
            filter: (item) => {
              // Only show selected sector in tooltip, or all if none selected
              if (!selectedSector) return true;
              return item.dataset.label === selectedSector;
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
              color: 'rgba(255, 255, 255, 0.08)',
              drawBorder: false
            },
            ticks: {
              color: 'var(--text-tertiary)',
              font: { size: 11, weight: '500' },
              maxTicksLimit: isMobile ? 5 : 10
            }
          },
          y: {
            min: -6,
            max: 6,
            grid: {
              color: 'rgba(255, 255, 255, 0.08)',
              drawBorder: false
            },
            ticks: {
              color: 'var(--text-tertiary)',
              font: { size: 11, weight: '500' },
              stepSize: 2
            }
          }
        }
      },
      plugins: [
        {
          id: 'referenceLines',
          beforeDraw: (chart) => {
            const ctx = chart.ctx;
            const yAxis = chart.scales.y;
            const xAxis = chart.scales.x;

            // Draw reference lines at -2, 0, +2
            const lines = [
              { y: 2, color: 'rgba(255, 107, 107, 0.6)', label: 'Extended (+2)' },
              { y: 0, color: 'rgba(255, 255, 255, 0.15)', label: '' },
              { y: -2, color: 'rgba(81, 207, 102, 0.6)', label: 'Cyclical Low (-2)' }
            ];

            lines.forEach((line) => {
              const yPixel = yAxis.getPixelForValue(line.y);

              ctx.save();
              ctx.beginPath();
              ctx.strokeStyle = line.color;
              ctx.lineWidth = line.y === 0 ? 2 : 1;
              ctx.setLineDash(line.y === 0 ? [] : [5, 5]);
              ctx.moveTo(xAxis.left, yPixel);
              ctx.lineTo(xAxis.right, yPixel);
              ctx.stroke();
              ctx.restore();
            });
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
  }, [sectors, selectedSector, isMobile]);

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      <canvas ref={chartRef} />
    </div>
  );
};

export default SectorChart;
