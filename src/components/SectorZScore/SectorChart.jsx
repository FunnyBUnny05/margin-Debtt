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

    // Only show selected sector if one is selected
    const sectorsToShow = selectedSector
      ? validSectors.filter(s => s.symbol === selectedSector)
      : validSectors;

    if (sectorsToShow.length === 0) return;

    const ctx = chartRef.current.getContext('2d');

    const datasets = sectorsToShow.map((sector) => {
      return {
        label: sector.symbol,
        data: sector.zScores.map((d) => ({
          x: d.date,
          y: d.zScore,
          excessReturn: d.excessReturn,
          relativeReturn: d.relativeReturn,
          structuralBaseline: d.structuralBaseline
        })),
        borderColor: sector.color,
        backgroundColor: sector.color + '20',
        borderWidth: 3,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHitRadius: 15, // Makes hover easier - larger detection area
        tension: 0.3,
        fill: false
      };
    });

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'nearest',
          intersect: false,
          axis: 'x'
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(15, 23, 42, 0.98)',
            titleColor: '#ffffff',
            bodyColor: '#e0e7ff',
            borderColor: 'rgba(167, 139, 250, 0.5)',
            borderWidth: 2,
            padding: 16,
            cornerRadius: 12,
            bodyFont: { size: 13 },
            titleFont: { size: 14, weight: '700' },
            bodySpacing: 8,
            displayColors: false,
            callbacks: {
              title: (items) => {
                if (items.length > 0) {
                  const date = new Date(items[0].parsed.x);
                  const sector = items[0].dataset.label;
                  return `${sector} - ${date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`;
                }
                return '';
              },
              label: (context) => {
                const dataPoint = context.raw;
                const lines = [];
                lines.push(`Z-Score: ${context.parsed.y.toFixed(2)}`);

                if (dataPoint.structuralBaseline !== undefined) {
                  lines.push(`Baseline: ${dataPoint.structuralBaseline >= 0 ? '+' : ''}${dataPoint.structuralBaseline.toFixed(2)}%`);
                }

                if (dataPoint.relativeReturn !== undefined) {
                  lines.push(`Relative: ${dataPoint.relativeReturn >= 0 ? '+' : ''}${dataPoint.relativeReturn.toFixed(2)}%`);
                }

                if (dataPoint.excessReturn !== undefined) {
                  lines.push(`Excess: ${dataPoint.excessReturn >= 0 ? '+' : ''}${dataPoint.excessReturn.toFixed(2)}%`);
                }

                return lines;
              },
              labelTextColor: (context) => {
                return '#cbd5e1';
              },
              afterLabel: (context) => {
                const zScore = context.parsed.y;
                if (zScore <= -2) return '\n🔴 Cyclical Low (CHEAP)';
                if (zScore >= 2) return '\n🟢 Extended (EXPENSIVE)';
                if (zScore < -1) return '\n🟡 Somewhat Cheap';
                if (zScore > 1) return '\n🟡 Somewhat Extended';
                return '\n⚪ Neutral';
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
