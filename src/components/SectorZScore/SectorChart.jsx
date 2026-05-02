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
  LineController, LineElement, PointElement,
  BarController, BarElement,
  LinearScale, TimeScale,
  Tooltip, Legend, Filler
);

const buildOptions = (isMobile) => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'nearest', intersect: false, axis: 'x' },
  animation: { duration: 900, easing: 'easeOutQuart' },
  plugins: {
    legend: { display: false },
    tooltip: {
      enabled: true,
      backgroundColor: 'var(--bg-raised)',
      titleColor: 'var(--accent)',
      bodyColor: 'var(--text-mid)',
      borderColor: 'var(--rule-strong)',
      borderWidth: 1,
      padding: 10,
      cornerRadius: 0,
      bodyFont: { size: 11, family: 'DM Mono, monospace' },
      titleFont: { size: 11, weight: '700', family: 'DM Mono, monospace' },
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
          if (dataPoint.structuralBaseline !== undefined) lines.push(`BASELINE: ${dataPoint.structuralBaseline >= 0 ? '+' : ''}${dataPoint.structuralBaseline.toFixed(2)}%`);
          if (dataPoint.relativeReturn !== undefined)    lines.push(`RELATIVE: ${dataPoint.relativeReturn >= 0 ? '+' : ''}${dataPoint.relativeReturn.toFixed(2)}%`);
          if (dataPoint.excessReturn !== undefined)      lines.push(`EXCESS: ${dataPoint.excessReturn >= 0 ? '+' : ''}${dataPoint.excessReturn.toFixed(2)}%`);
          return lines;
        },
        labelTextColor: () => 'var(--text-mid)',
        afterLabel: (context) => {
          const z = context.parsed.y;
          if (z <= -2) return 'SIGNAL: CYCLICAL LOW';
          if (z >= 2)  return 'SIGNAL: EXTENDED';
          if (z < -1)  return 'SIGNAL: CHEAP';
          if (z > 1)   return 'SIGNAL: SOMEWHAT EXTENDED';
          return 'SIGNAL: NEUTRAL';
        }
      }
    }
  },
  scales: {
    x: {
      type: 'time',
      time: { unit: 'year', displayFormats: { year: 'yyyy' } },
      grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
      ticks: { color: 'rgba(255,255,255,0.2)', font: { size: 10, family: 'DM Mono, monospace' }, maxTicksLimit: isMobile ? 5 : 10 }
    },
    y: {
      min: -6, max: 6,
      grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
      ticks: { color: 'rgba(255,255,255,0.2)', font: { size: 10, family: 'DM Mono, monospace' }, stepSize: 2 }
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
      { y: 2,  color: 'oklch(64% 0.18 28 / 0.4)' },
      { y: 0,  color: 'rgba(255,255,255,0.15)' },
      { y: -2, color: 'oklch(74% 0.16 148 / 0.4)' }
    ];
    lines.forEach((line) => {
      const yPixel = yAxis.getPixelForValue(line.y);
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = line.color;
      ctx.lineWidth = line.y === 0 ? 1.5 : 1;
      ctx.setLineDash(line.y === 0 ? [] : [5, 5]);
      ctx.moveTo(xAxis.left, yPixel);
      ctx.lineTo(xAxis.right, yPixel);
      ctx.stroke();
      ctx.restore();
    });
  }
};

export const SectorChart = ({ sectors, selectedSector, isMobile, chartType = 'line', animTrigger = 0 }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const prevIsMobile = useRef(isMobile);
  const prevChartType = useRef(chartType);
  const prevAnimTrigger = useRef(animTrigger);

  useEffect(() => {
    const mobileChanged   = prevIsMobile.current !== isMobile;
    const typeChanged     = prevChartType.current !== chartType;
    const animTriggered   = prevAnimTrigger.current !== animTrigger;
    prevIsMobile.current    = isMobile;
    prevChartType.current   = chartType;
    prevAnimTrigger.current = animTrigger;

    const validSectors = sectors.filter(s => s.zScores && s.zScores.length > 0);
    const sectorsToShow = selectedSector
      ? validSectors.filter(s => s.symbol === selectedSector)
      : validSectors;

    if (!chartRef.current) return;

    if (chartInstance.current && !mobileChanged && !typeChanged && !animTriggered) {
      const chart = chartInstance.current;
      chart.data.datasets = sectorsToShow.map((sector) => ({
        label: sector.symbol,
        data: sector.zScores.map((d) => ({ x: d.date, y: d.zScore, excessReturn: d.excessReturn, relativeReturn: d.relativeReturn, structuralBaseline: d.structuralBaseline })),
        borderColor: sector.color,
        backgroundColor: sector.color + '20',
        borderWidth: 3, pointRadius: 0, pointHoverRadius: 6, pointHitRadius: 15, tension: 0.3, fill: false
      }));
      chart.update('none');
      return;
    }

    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }

    if (sectorsToShow.length === 0) return;

    const ctx = chartRef.current.getContext('2d');
    const datasets = sectorsToShow.map((sector) => ({
      label: sector.symbol,
      data: sector.zScores.map((d) => ({ x: d.date, y: d.zScore, excessReturn: d.excessReturn, relativeReturn: d.relativeReturn, structuralBaseline: d.structuralBaseline })),
      borderColor: sector.color,
      backgroundColor: sector.color + '20',
      borderWidth: 3, pointRadius: 0, pointHoverRadius: 6, pointHitRadius: 15, tension: 0.3, fill: false
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
  }, [sectors, selectedSector, isMobile, chartType, animTrigger]);

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      <canvas ref={chartRef} />
    </div>
  );
};

export default SectorChart;
