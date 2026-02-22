import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';

// Berkshire Hathaway annual cash holdings (cash + short-term investments / T-bills)
// Sources: Berkshire annual letters, stockanalysis.com, companiesmarketcap.com
const RAW_DATA = [
  { year: 2000, cash: 3.4 },
  { year: 2001, cash: 4.5 },
  { year: 2002, cash: 10.3 },
  { year: 2003, cash: 24.4 },
  { year: 2004, cash: 43.0 },
  { year: 2005, cash: 44.7 },
  { year: 2006, cash: 43.7 },
  { year: 2007, cash: 44.3 },
  { year: 2008, cash: 25.5 },
  { year: 2009, cash: 66.3 },
  { year: 2010, cash: 38.2 },
  { year: 2011, cash: 68.5 },
  { year: 2012, cash: 83.7 },
  { year: 2013, cash: 77.0 },
  { year: 2014, cash: 90.7 },
  { year: 2015, cash: 97.7 },
  { year: 2016, cash: 86.4 },
  { year: 2017, cash: 116.0 },
  { year: 2018, cash: 111.9 },
  { year: 2019, cash: 128.0 },
  { year: 2020, cash: 138.3 },
  { year: 2021, cash: 146.7 },
  { year: 2022, cash: 128.6 },
  { year: 2023, cash: 167.6 },
  { year: 2024, cash: 334.2 },
];

// Enrich with YoY growth
const ENRICHED = RAW_DATA.map((d, i) => {
  if (i === 0) return { ...d, yoy: null };
  const prev = RAW_DATA[i - 1].cash;
  return { ...d, yoy: parseFloat((((d.cash - prev) / prev) * 100).toFixed(1)) };
});

const TIME_RANGE_OPTIONS = [
  { label: '10Y', value: '10y' },
  { label: '15Y', value: '15y' },
  { label: '20Y', value: '20y' },
  { label: 'ALL', value: 'all' },
];

const CashTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(15,17,27,0.95)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '10px',
      padding: '12px 16px',
      fontSize: '13px',
      color: 'var(--text-primary)',
    }}>
      <div style={{ fontWeight: '600', marginBottom: '6px' }}>{label}</div>
      <div style={{ color: '#fbbf24' }}>
        Cash &amp; T-Bills: <strong>${payload[0].value?.toFixed(1)}B</strong>
      </div>
    </div>
  );
};

const YoyTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  if (val === null || val === undefined) return null;
  return (
    <div style={{
      background: 'rgba(15,17,27,0.95)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '10px',
      padding: '12px 16px',
      fontSize: '13px',
      color: 'var(--text-primary)',
    }}>
      <div style={{ fontWeight: '600', marginBottom: '6px' }}>{label}</div>
      <div style={{ color: val >= 0 ? '#51cf66' : '#ff6b6b' }}>
        YoY Growth: <strong>{val >= 0 ? '+' : ''}{val}%</strong>
      </div>
    </div>
  );
};

export const BuffettIndicator = ({ isMobile }) => {
  const [timeRange, setTimeRange] = useState('all');

  const filtered = useMemo(() => {
    const now = 2024;
    const cutoffs = { '10y': 10, '15y': 15, '20y': 20 };
    if (timeRange === 'all') return ENRICHED;
    return ENRICHED.filter(d => d.year >= now - cutoffs[timeRange]);
  }, [timeRange]);

  const latest = ENRICHED[ENRICHED.length - 1];
  const prev = ENRICHED[ENRICHED.length - 2];
  const allTimeHigh = Math.max(...ENRICHED.map(d => d.cash));
  const avgCash = (ENRICHED.reduce((s, d) => s + d.cash, 0) / ENRICHED.length).toFixed(1);

  const statCards = [
    {
      label: '2024 Cash Hoard',
      value: `$${latest.cash.toFixed(1)}B`,
      sub: 'Cash + T-Bills',
      color: '#fbbf24',
    },
    {
      label: 'YoY Change',
      value: `${latest.yoy >= 0 ? '+' : ''}${latest.yoy}%`,
      sub: `vs $${prev.cash.toFixed(1)}B in 2023`,
      color: latest.yoy >= 0 ? '#51cf66' : '#ff6b6b',
    },
    {
      label: 'All-Time High',
      value: `$${allTimeHigh.toFixed(1)}B`,
      sub: '2024',
      color: '#a78bfa',
    },
    {
      label: '25-Year Average',
      value: `$${avgCash}B`,
      sub: '2000–2024',
      color: '#60a5fa',
    },
  ];

  return (
    <div>
      {/* Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '24px',
      }}>
        {statCards.map(({ label, value, sub, color }) => (
          <div key={label} className="stat-card animate-in">
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
              {label}
            </div>
            <div style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: '700', color, lineHeight: 1 }}>
              {value}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '6px' }}>
              {sub}
            </div>
          </div>
        ))}
      </div>

      {/* Time Range Selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {TIME_RANGE_OPTIONS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setTimeRange(value)}
            className="btn-primary"
            style={{
              padding: '8px 20px',
              background: timeRange === value ? 'var(--gradient-amber, linear-gradient(135deg,#f59e0b,#d97706))' : 'var(--glass-bg)',
              border: timeRange === value ? 'none' : '1px solid var(--glass-border)',
              fontSize: '13px',
              fontWeight: timeRange === value ? '600' : '400',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Charts */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: '20px',
        marginBottom: '24px',
      }}>
        {/* Chart 1: Absolute Cash */}
        <div className="glass-card animate-in" style={{ padding: isMobile ? '20px 16px' : '28px 32px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>
            💰 Cash &amp; T-Bill Holdings
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Annual cash + short-term U.S. Treasury holdings (USD billions)
          </p>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={filtered} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval={isMobile ? 4 : 2}
              />
              <YAxis
                tickFormatter={v => `$${v}B`}
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip content={<CashTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="cash" radius={[3, 3, 0, 0]} name="Cash & T-Bills">
                {filtered.map((entry) => (
                  <Cell
                    key={entry.year}
                    fill={entry.cash >= 200 ? '#f59e0b' : entry.cash >= 100 ? '#fbbf24' : entry.cash >= 50 ? '#fcd34d' : '#fde68a'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2: YoY Growth */}
        <div className="glass-card animate-in" style={{ padding: isMobile ? '20px 16px' : '28px 32px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>
            📈 Year-over-Year Growth
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Annual change in cash holdings (%)
          </p>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={filtered.filter(d => d.yoy !== null)}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              barCategoryGap="25%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval={isMobile ? 4 : 2}
              />
              <YAxis
                tickFormatter={v => `${v}%`}
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip content={<YoyTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
              <Bar dataKey="yoy" radius={[3, 3, 0, 0]} name="YoY Growth">
                {filtered.filter(d => d.yoy !== null).map((entry) => (
                  <Cell
                    key={entry.year}
                    fill={entry.yoy >= 0 ? '#51cf66' : '#ff6b6b'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Note */}
      <div className="glass-card animate-in" style={{ padding: '16px 24px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.7' }}>
        <strong style={{ color: 'var(--text-tertiary)' }}>Data notes:</strong> Cash holdings represent Berkshire Hathaway's combined cash &amp; cash equivalents plus short-term U.S. Treasury bill investments as reported in annual filings.
        The 2024 figure ($334.2B) reflects the historic cash buildup disclosed in Buffett's February 2025 annual letter.
        Sources: Berkshire Hathaway annual reports, stockanalysis.com, companiesmarketcap.com.
      </div>
    </div>
  );
};
