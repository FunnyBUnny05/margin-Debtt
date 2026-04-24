import React, { useEffect, useRef } from 'react';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  BarController,
  BarElement,
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
  BarController,
  BarElement,
  LinearScale,
  TimeScale,
  Tooltip,
  Legend,
  Filler
);

const buildOptions = (isMobile) => ({
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
      backgroundColor: '#0B0F19',
      titleColor: '#F59E0B',
      bodyColor: '#D1D5DB',
      borderColor: '#1F2937',
      borderWidth: 1,
      padding: 10,
      cornerRadius: 0,
      bodyFont: { size: 11, family: 'JetBrains Mono, monospace' },
      titleFont: { size: 11, weight: '700', family: 'JetBrains Mono, monospace' },
      bodySpacing: 4,
      displayColors: false,
      callbacks: {
        title: (items) => {
          if (items.length > 0) {
            const date = new Date(items[0].parsed.x);
            const sector = items[0].dataset.label;
            return `${sector} — ${date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}`;
          }
          return '';
        },
        label: (context) => {
          const dataPoint = context.raw;
          const lines = [];
          lines.push(`Z-SCORE: ${context.parsed.y.toFixed(2)}`);
          if (dataPoint.structuralBaseline !== undefined) {
            lines.push(`BASELINE: ${dataPoint.structuralBaseline >= 0 ? '+' : ''}${dataPoint.structuralBaseline.toFixed(2)}%`);
          }
          if (dataPoint.relativeReturn !== undefined) {
            lines.push(`RELATIVE: ${dataPoint.relativeReturn >= 0 ? '+' : ''}${dataPoint.relativeReturn.toFixed(2)}%`);
          }
          if (dataPoint.excessReturn !== undefined) {
            lines.push(`EXCESS: ${dataPoint.excessReturn >= 0 ? '+' : ''}${dataPoint.excessReturn.toFixed(2)}%`);
          }
          return lines;
        },
        labelTextColor: () => '#D1D5DB',
        afterLabel: (context) => {
          const zScore = context.parsed.y;
          if (zScore <= -2) return 'SIGNAL: CYCLICAL LOW';
          if (zScore >= 2) return 'SIGNAL: EXTENDED';
          if (zScore < -1) return 'SIGNAL: CHEAP';
          if (zScore > 1) return 'SIGNAL: SOMEWHAT EXTENDED';
          return 'SIGNAL: NEUTRAL';
        }
      }
    }
  },
  scales: {
    x: {
      type: 'time',
      time: { unit: 'year', displayFormats: { year: 'yyyy' } },
      grid: { color: '#111827', drawBorder: false },
      ticks: {
        color: '#6B7280',
        font: { size: 10, family: 'JetBrains Mono, monospace' },
        maxTicksLimit: isMobile ? 5 : 10
      }
    },
    y: {
      min: -6,
      max: 6,
      grid: { color: '#111827', drawBorder: false },
      ticks: {
        color: '#6B7280',
        font: { size: 10, family: 'JetBrains Mono, monospace' },
        stepSize: 2
      }
    }
  }
});

const REFERENCE_LINE_PLUGIN = {
  id: 'referenceLines',
  beforeDraw: (chart) => {
    const ctx = chart.ctx;
    const yAxis = chart.scales.y;
    const xAxis = chart.scales.x;
    const lines = [
      { y: 2, color: '#EF444466' },
      { y: 0, color: '#374151' },
      { y: -2, color: '#10B98166' }
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
};

export const SectorChart = ({ sectors, selectedSector, isMobile, chartType = 'line' }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const prevIsMobile = useRef(isMobile);
  const prevChartType = useRef(chartType);

  // Rebuild chart when isMobile changes (axis tick count changes)
  useEffect(() => {
    const mobileChanged = prevIsMobile.current !== isMobile;
    const typeChanged = prevChartType.current !== chartType;
    prevIsMobile.current = isMobile;
    prevChartType.current = chartType;

    const validSectors = sectors.filter(s => s.zScores && s.zScores.length > 0);
    const sectorsToShow = selectedSector
      ? validSectors.filter(s => s.symbol === selectedSector)
      : validSectors;

    if (!chartRef.current) return;

    if (chartInstance.current && !mobileChanged && !typeChanged) {
      // Update data in place — avoids destroying and recreating the canvas
      const chart = chartInstance.current;
      const newDatasets = sectorsToShow.map((sector) => ({
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
        pointHitRadius: 15,
        tension: 0.3,
        fill: false
      }));
      chart.data.datasets = newDatasets;
      chart.update('none'); // 'none' skips animation for instant update
      return;
    }

    // Destroy existing chart (either first render or isMobile changed)
    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }

    if (sectorsToShow.length === 0) return;

    const ctx = chartRef.current.getContext('2d');
    const datasets = sectorsToShow.map((sector) => ({
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
      pointHitRadius: 15,
      tension: 0.3,
      fill: false
    }));

    chartInstance.current = new Chart(ctx, {
      type: chartType,
      data: { datasets },
      options: buildOptions(isMobile),
      plugins: [REFERENCE_LINE_PLUGIN]
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [sectors, selectedSector, isMobile, chartType]);

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      <canvas ref={chartRef} />
    </div>
  );
};

export default SectorChart;
