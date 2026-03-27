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

const ZERO_LINE_PLUGIN = {
  id: 'zeroLine',
  beforeDraw: (chart) => {
    const ctx = chart.ctx;
    const yAxis = chart.scales.y;
    const xAxis = chart.scales.x;
    const yPixel = yAxis.getPixelForValue(0);
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = '#374151';
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
  plugins: {
    legend: {
      display: true,
      position: 'top',
      labels: {
        color: '#9CA3AF',
        font: { size: 10, family: 'JetBrains Mono, monospace' },
        usePointStyle: true,
        padding: 12,
        boxWidth: 6,
        boxHeight: 6
      }
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
      grid: { color: '#111827', drawBorder: false },
      ticks: {
        color: '#6B7280',
        font: { size: 10, family: 'JetBrains Mono, monospace' },
        maxTicksLimit: isMobile ? 5 : 10
      }
    },
    y: {
      grid: { color: '#111827', drawBorder: false },
      ticks: {
        color: '#6B7280',
        font: { size: 10, family: 'JetBrains Mono, monospace' },
        callback: (value) => `${value >= 0 ? '+' : ''}${value}%`
      }
    }
  }
});

// Normalize prices to percentage change from start
const normalizeData = (prices) => {
  if (!prices || prices.length === 0) return [];
  const startPrice = prices[0].price;
  return prices.map((p) => ({ x: p.date, y: ((p.price / startPrice) - 1) * 100 }));
};

export const PriceChart = ({ sectors, selectedSector, benchmarkData, benchmark, isMobile }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const prevIsMobile = useRef(isMobile);

  useEffect(() => {
    const mobileChanged = prevIsMobile.current !== isMobile;
    prevIsMobile.current = isMobile;

    if (!chartRef.current || !selectedSector || !benchmarkData) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
      return;
    }

    const sector = sectors.find((s) => s.symbol === selectedSector);
    if (!sector || !sector.prices || sector.prices.length === 0) return;

    // Align to common start date
    const sectorStart = sector.prices[0]?.date.getTime() || 0;
    const benchStart = benchmarkData[0]?.date.getTime() || 0;
    const commonStart = Math.max(sectorStart, benchStart);
    const filteredSector = sector.prices.filter((p) => p.date.getTime() >= commonStart);
    const filteredBench = benchmarkData.filter((p) => p.date.getTime() >= commonStart);
    const sectorDataset = normalizeData(filteredSector);
    const benchDataset = normalizeData(filteredBench);

    if (chartInstance.current && !mobileChanged) {
      // Update data in place
      const chart = chartInstance.current;
      chart.data.datasets[0].label = sector.symbol;
      chart.data.datasets[0].data = sectorDataset;
      chart.data.datasets[0].borderColor = sector.color;
      chart.data.datasets[0].backgroundColor = sector.color + '20';
      chart.data.datasets[1].label = benchmark;
      chart.data.datasets[1].data = benchDataset;
      chart.update('none');
      return;
    }

    // Destroy and recreate (first render or isMobile changed)
    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }

    const ctx = chartRef.current.getContext('2d');
    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [
          {
            label: sector.symbol,
            data: sectorDataset,
            borderColor: sector.color,
            backgroundColor: sector.color + '20',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
            tension: 0.1
          },
          {
            label: benchmark,
            data: benchDataset,
            borderColor: '#6B7280',
            backgroundColor: '#6B728015',
            borderWidth: 1,
            borderDash: [4, 4],
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.1
          }
        ]
      },
      options: buildOptions(isMobile),
      plugins: [ZERO_LINE_PLUGIN]
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
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#4B5563' }}>
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
