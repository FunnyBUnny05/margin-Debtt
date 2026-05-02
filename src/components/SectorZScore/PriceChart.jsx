import React, { useEffect, useRef } from 'react';
import {
  Chart,
  LineController, LineElement, PointElement,
  BarController, BarElement,
  LinearScale, TimeScale,
  Tooltip, Legend
} from 'chart.js';
import 'chartjs-adapter-date-fns';

Chart.register(
  LineController, LineElement, PointElement,
  BarController, BarElement,
  LinearScale, TimeScale,
  Tooltip, Legend
);

const ZERO_LINE_PLUGIN = {
  id: 'zeroLine',
  beforeDraw: (chart) => {
    const ctx = chart.ctx;
    const yAxis = chart.scales.y;
    const xAxis = chart.scales.x;
    const yPixel = yAxis.getPixelForValue(0);
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.moveTo(xAxis.left, yPixel);
    ctx.lineTo(xAxis.right, yPixel);
    ctx.stroke();
    ctx.restore();
  }
};

const buildOptions = (isMobile) => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  animation: { duration: 900, easing: 'easeOutQuart' },
  plugins: {
    legend: {
      display: true,
      position: 'top',
      labels: {
        color: 'rgba(255,255,255,0.3)',
        font: { size: 10, family: 'DM Mono, monospace' },
        usePointStyle: true,
        padding: 12, boxWidth: 6, boxHeight: 6
      }
    },
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
      callbacks: {
        title: (items) => {
          if (items.length > 0) {
            return new Date(items[0].parsed.x).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
          }
          return '';
        },
        label: (context) => {
          const value = context.parsed.y;
          return `${context.dataset.label}: ${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
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
      grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
      ticks: {
        color: 'rgba(255,255,255,0.2)',
        font: { size: 10, family: 'DM Mono, monospace' },
        callback: (value) => `${value >= 0 ? '+' : ''}${value}%`
      }
    }
  }
});

const normalizeData = (prices) => {
  if (!prices || prices.length === 0) return [];
  const startPrice = prices[0].price;
  return prices.map((p) => ({ x: p.date, y: ((p.price / startPrice) - 1) * 100 }));
};

export const PriceChart = ({ sectors, selectedSector, benchmarkData, benchmark, isMobile, chartType = 'line', animTrigger = 0 }) => {
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

    if (!chartRef.current || !selectedSector || !benchmarkData) {
      if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; }
      return;
    }

    const sector = sectors.find((s) => s.symbol === selectedSector);
    if (!sector || !sector.prices || sector.prices.length === 0) return;

    const sectorStart  = sector.prices[0]?.date.getTime() || 0;
    const benchStart   = benchmarkData[0]?.date.getTime() || 0;
    const commonStart  = Math.max(sectorStart, benchStart);
    const filteredSector = sector.prices.filter((p) => p.date.getTime() >= commonStart);
    const filteredBench  = benchmarkData.filter((p) => p.date.getTime() >= commonStart);
    const sectorDataset  = normalizeData(filteredSector);
    const benchDataset   = normalizeData(filteredBench);

    if (chartInstance.current && !mobileChanged && !typeChanged && !animTriggered) {
      const chart = chartInstance.current;
      chart.data.datasets[0].label = sector.symbol;
      chart.data.datasets[0].data  = sectorDataset;
      chart.data.datasets[0].borderColor = sector.color;
      chart.data.datasets[0].backgroundColor = sector.color + '20';
      chart.data.datasets[1].label = benchmark;
      chart.data.datasets[1].data  = benchDataset;
      chart.update('none');
      return;
    }

    if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; }

    const ctx = chartRef.current.getContext('2d');
    chartInstance.current = new Chart(ctx, {
      type: chartType,
      data: {
        datasets: [
          {
            label: sector.symbol,
            data: sectorDataset,
            borderColor: sector.color,
            backgroundColor: sector.color + '20',
            borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, tension: 0.1
          },
          {
            label: benchmark,
            data: benchDataset,
            borderColor: 'rgba(255,255,255,0.2)',
            backgroundColor: 'rgba(255,255,255,0.04)',
            borderWidth: 1, borderDash: [4, 4],
            pointRadius: 0, pointHoverRadius: 4, tension: 0.1
          }
        ]
      },
      options: buildOptions(isMobile),
      plugins: [ZERO_LINE_PLUGIN]
    });

    return () => {
      if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; }
    };
  }, [sectors, selectedSector, benchmarkData, benchmark, isMobile, chartType, animTrigger]);

  if (!selectedSector) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-dim)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
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
