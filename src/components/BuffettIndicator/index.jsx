import React, { useMemo, useState } from 'react';
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
  ComposedChart, Line, Area,
} from 'recharts';
import { SourceLink } from '../SourceLink';
import { ChartToggle } from '../ChartToggle';
import { useFredBuffettData } from './useFredBuffettData';
import { ExportCsvButton } from '../ExportCsvButton';

// ── Berkshire historical fallback (if JSON's berkshire_cash is missing) ──────
// Sourced from Berkshire Hathaway Annual Reports (10-K filings).
const BRK_STATIC = [
  {year:1995,cash:2.7},{year:1996,cash:1.3},{year:1997,cash:1.1},
  {year:1998,cash:13.6},{year:1999,cash:3.8},{year:2000,cash:3.4},
  {year:2001,cash:4.5},{year:2002,cash:10.3},{year:2003,cash:24.4},
  {year:2004,cash:43.0},{year:2005,cash:44.7},{year:2006,cash:43.7},
  {year:2007,cash:44.3},{year:2008,cash:25.5},{year:2009,cash:66.3},
  {year:2010,cash:38.2},{year:2011,cash:68.5},{year:2012,cash:83.7},
  {year:2013,cash:77.0},{year:2014,cash:90.7},{year:2015,cash:97.7},
  {year:2016,cash:86.4},{year:2017,cash:116.0},{year:2018,cash:111.9},
  {year:2019,cash:128.0},{year:2020,cash:138.3},{year:2021,cash:146.7},
  {year:2022,cash:128.6},{year:2023,cash:167.6},{year:2024,cash:334.2},
];

const enrichWithYoY = (data) =>
  data.map((d, i) => ({
    ...d,
    yoy: i === 0 ? null : parseFloat((((d.cash - data[i-1].cash) / data[i-1].cash) * 100).toFixed(1)),
  }));

const TIME_RANGE_OPTIONS = [
  { label: '10Y', value: '10y' },
  { label: '15Y', value: '15y' },
  { label: '20Y', value: '20y' },
  { label: '25Y', value: '25y' },
  { label: 'ALL', value: 'all' },
];

const CashTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--rule-strong)', padding: '10px 14px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.14em', color: 'var(--text-dim)', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: 'var(--accent)' }}>${payload[0].value?.toFixed(1)}B</div>
    </div>
  );
};

const YoyTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  if (val == null) return null;
  return (
    <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--rule-strong)', padding: '10px 14px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.14em', color: 'var(--text-dim)', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: val >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
        {val >= 0 ? '+' : ''}{val}%
      </div>
    </div>
  );
};

const BuffettTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const ratio = payload.find(p => p.dataKey === 'ratio_pct');
  const trend = payload.find(p => p.dataKey === 'trend_pct');
  const p2    = payload.find(p => p.dataKey === 'band_plus2');
  const m2    = payload.find(p => p.dataKey === 'band_minus2');
  return (
    <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--rule-strong)', padding: '10px 14px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.14em', color: 'var(--text-dim)', marginBottom: '6px' }}>
        {label ? new Date(label).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : ''}
      </div>
      {ratio && <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: 'var(--accent)', lineHeight: 1.2 }}>{ratio.value?.toFixed(1)}%</div>}
      {trend && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-dim)', marginTop: '4px' }}>trend {trend.value?.toFixed(1)}%</div>}
      {p2 && m2 && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-dim)' }}>band {m2.value?.toFixed(0)}–{p2.value?.toFixed(0)}%</div>}
    </div>
  );
};

const valuationColorFor = (sd) => {
  if (sd == null) return 'var(--text-mid)';
  if (sd > 2)  return 'var(--neg)';
  if (sd > 1)  return 'var(--accent)';
  if (sd > -1) return 'var(--text)';
  return 'var(--pos)';
};

export const BuffettIndicator = ({ isMobile }) => {
  const [timeRange, setTimeRange]         = useState('all');
  const [buffettMainType, setBuffettMain] = useState('line');
  const [cashMainType, setCashMain]       = useState('bar');
  const [cashYoyType, setCashYoy]         = useState('bar');

  const { biData, biStatus: rawBiStatus } = useFredBuffettData();
  const biStatus = rawBiStatus === 'live' || rawBiStatus === 'fallback' ? 'loaded' : rawBiStatus;

  // ── Berkshire cash series (from embedded JSON; BRK_STATIC as fallback) ─────
  const ENRICHED = useMemo(() => {
    const series = biData?.berkshire_cash?.data ?? BRK_STATIC;
    return enrichWithYoY(series);
  }, [biData]);

  const filtered = useMemo(() => {
    const latestYear = ENRICHED[ENRICHED.length - 1]?.year ?? new Date().getFullYear();
    if (timeRange === 'all') return ENRICHED;
    const cutoffs = { '10y': 10, '15y': 15, '20y': 20, '25y': 25 };
    return ENRICHED.filter(d => d.year >= latestYear - cutoffs[timeRange]);
  }, [timeRange, ENRICHED]);

  const latest = ENRICHED[ENRICHED.length - 1];
  const prev   = ENRICHED[ENRICHED.length - 2];

  const { allTimeHigh, athYear, avgCash, spanYears } = useMemo(() => {
    let high = -Infinity, highYear = null, sum = 0;
    for (const d of ENRICHED) {
      sum += d.cash;
      if (d.cash > high) { high = d.cash; highYear = d.year; }
    }
    return {
      allTimeHigh: high,
      athYear: highYear,
      avgCash: (sum / ENRICHED.length).toFixed(1),
      spanYears: `${ENRICHED[0].year}–${ENRICHED[ENRICHED.length - 1]?.year}`,
    };
  }, [ENRICHED]);

  const biChartData = useMemo(() => {
    if (!biData?.data?.length) return [];
    if (timeRange === 'all') return biData.data;
    const years = { '10y': 10, '15y': 15, '20y': 20, '25y': 25 }[timeRange] ?? 99;
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - years);
    return biData.data.filter(d => new Date(d.date) >= cutoff);
  }, [biData, timeRange]);

  const biCurrent = biData?.current;
  const valColor  = valuationColorFor(biCurrent?.std_devs);
  const axTick    = { fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)' };
  const gridStroke = 'var(--rule)';

  return (
    <div>
      {/* ── BUFFETT INDICATOR CHART ── */}
      <div className="glass-card animate-in" style={{ padding: 0, marginBottom: '16px' }}>
        <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>Buffett Indicator — Wilshire 5000 / GDP</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.18em',
              color: rawBiStatus === 'live' ? 'var(--pos)' : 'var(--text-mid)' }}>
              ● {rawBiStatus === 'live' ? 'CURRENT' : rawBiStatus === 'fallback' ? 'CACHED' : rawBiStatus.toUpperCase()}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <ExportCsvButton data={biChartData} filename="buffett_indicator"
              columns={[
                { key: 'date', label: 'Date' }, { key: 'ratio_pct', label: 'Ratio (%)' },
                { key: 'trend_pct', label: 'Trend (%)' }, { key: 'band_plus2', label: '+2σ (%)' },
                { key: 'band_minus2', label: '-2σ (%)' },
              ]}
            />
            <ChartToggle type={buffettMainType} setType={setBuffettMain} />
          </div>
        </div>

        <div style={{ padding: isMobile ? '12px 8px' : '20px 16px' }}>
          {biStatus === 'error' && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.2em', color: 'var(--neg)', padding: '24px 0', textAlign: 'center' }}>
              DATA UNAVAILABLE
            </div>
          )}
          {biStatus === 'loading' && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.2em', color: 'var(--text-dim)', padding: '24px 0', textAlign: 'center' }} className="pulse-animation">
              LOADING DATA...
            </div>
          )}

          {biStatus === 'loaded' && biCurrent && (
            <>
              <div className="responsive-grid" style={{ marginBottom: '20px', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)' }}>
                <div className="stat-card">
                  <div className="stat-block-label">Current Ratio</div>
                  <div className="stat-block-value accent">{biCurrent.ratio_pct.toFixed(1)}%</div>
                  <div className="stat-block-sub">Wilshire / GDP</div>
                </div>
                <div className="stat-card">
                  <div className="stat-block-label">vs Trend</div>
                  <div className="stat-block-value" style={{ color: valColor }}>
                    {biCurrent.deviation_pct >= 0 ? '+' : ''}{biCurrent.deviation_pct.toFixed(1)}%
                  </div>
                  <div className="stat-block-sub">Trend: {biCurrent.trend_pct.toFixed(1)}%</div>
                </div>
                <div className="stat-card">
                  <div className="stat-block-label">Std Devs</div>
                  <div className="stat-block-value" style={{ color: valColor }}>
                    {biCurrent.std_devs >= 0 ? '+' : ''}{biCurrent.std_devs.toFixed(2)}σ
                  </div>
                  <div className="stat-block-sub">From log trend</div>
                </div>
                <div className="stat-card">
                  <div className="stat-block-label">Valuation</div>
                  <div className="stat-block-value sm" style={{ color: valColor }}>{biCurrent.valuation}</div>
                  <div className="stat-block-sub">
                    {biCurrent.gdp_billions > 0 ? `GDP $${biCurrent.gdp_billions.toLocaleString()}B` : 'Wilshire / GDP'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', marginBottom: '8px', flexWrap: 'wrap' }}>
                {[
                  { label: 'RATIO', color: 'var(--accent)', dash: false },
                  { label: 'TREND', color: 'var(--text-dim)', dash: true },
                  { label: '+2σ',  color: 'var(--neg)',      dash: true },
                  { label: '-2σ',  color: 'var(--pos)',      dash: true },
                ].map(({ label, color, dash }) => (
                  <span key={label} style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em', color, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: 18, height: 1, background: color, display: 'inline-block', borderTop: dash ? `1px dashed ${color}` : undefined }} />
                    {label}
                  </span>
                ))}
              </div>

              <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
                <ComposedChart data={biChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="1 4" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="date" tick={axTick} axisLine={false} tickLine={false}
                    tickFormatter={d => new Date(d).getFullYear()}
                    interval={isMobile ? 'preserveStartEnd' : Math.floor(biChartData.length / 8)}
                  />
                  <YAxis tickFormatter={v => `${v.toFixed(0)}%`} tick={axTick} axisLine={false} tickLine={false} width={48} />
                  <Tooltip content={<BuffettTooltip />} cursor={{ stroke: 'var(--rule-strong)', strokeWidth: 1 }} />
                  <Area dataKey="band_plus2"  stroke="none" fill="oklch(64% 0.18 28 / 0.07)"  fillOpacity={1} dot={false} legendType="none" />
                  <Area dataKey="band_minus2" stroke="none" fill="var(--bg)"                   fillOpacity={1} dot={false} legendType="none" />
                  <Line dataKey="band_plus1"  stroke="oklch(64% 0.18 28 / 0.5)"  strokeWidth={1} strokeDasharray="3 3" dot={false} legendType="none" />
                  <Line dataKey="band_plus2"  stroke="var(--neg)"                strokeWidth={1} strokeDasharray="3 3" dot={false} legendType="none" />
                  <Line dataKey="band_minus1" stroke="oklch(74% 0.16 148 / 0.5)" strokeWidth={1} strokeDasharray="3 3" dot={false} legendType="none" />
                  <Line dataKey="band_minus2" stroke="var(--pos)"                strokeWidth={1} strokeDasharray="3 3" dot={false} legendType="none" />
                  <Line dataKey="trend_pct"   stroke="var(--text-dim)"           strokeWidth={1} strokeDasharray="6 3" dot={false} legendType="none" />
                  {buffettMainType === 'line' ? (
                    <Line dataKey="ratio_pct" stroke="var(--accent)" strokeWidth={2} dot={false} legendType="none" />
                  ) : (
                    <Bar dataKey="ratio_pct" fill="var(--accent)" name="Ratio" />
                  )}
                  <ReferenceLine y={100} stroke="var(--rule-strong)" strokeWidth={1} strokeDasharray="2 4" />
                </ComposedChart>
              </ResponsiveContainer>

              <div style={{ marginTop: '12px', fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em', color: 'var(--text-dim)', lineHeight: '1.7', borderTop: '1px solid var(--rule)', paddingTop: '10px' }}>
                <span style={{ color: 'var(--text-mid)' }}>FORMULA:</span> Wilshire 5000 Full Cap Index ÷ Nominal GDP × 100.
                Bands show ±1σ and ±2σ from a log-linear trend fit over the full history (1971–present).
                <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>Sources: FRED WILL5000INDFC, GDP — pre-built weekly by CI.</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── BERKSHIRE CASH HOARD ── */}
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.18em',
        textTransform: 'uppercase', color: 'var(--text-mid)',
        padding: '14px 0 10px', borderTop: '1px solid var(--rule)', marginTop: '8px' }}>
        Berkshire Hathaway — Cash &amp; T-Bill Holdings
      </div>

      <div className="responsive-grid" style={{ marginBottom: '16px', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-block-label">{latest?.year} Cash Hoard</div>
          <div className="stat-block-value accent">${latest?.cash.toFixed(1)}B</div>
          <div className="stat-block-sub">Cash + T-Bills</div>
        </div>
        <div className="stat-card">
          <div className="stat-block-label">YoY Change</div>
          <div className={`stat-block-value ${latest?.yoy >= 0 ? 'pos' : 'neg'}`}>
            {latest?.yoy != null ? `${latest.yoy >= 0 ? '+' : ''}${latest.yoy}%` : '—'}
          </div>
          <div className="stat-block-sub">vs ${prev?.cash.toFixed(1)}B in {prev?.year}</div>
        </div>
        <div className="stat-card">
          <div className="stat-block-label">All-Time High</div>
          <div className="stat-block-value neutral">${allTimeHigh.toFixed(1)}B</div>
          <div className="stat-block-sub">{athYear}</div>
        </div>
        <div className="stat-card">
          <div className="stat-block-label">{ENRICHED.length}-Year Avg</div>
          <div className="stat-block-value neutral">${avgCash}B</div>
          <div className="stat-block-sub">{spanYears}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginBottom: '16px', borderBottom: '1px solid var(--rule)', paddingBottom: '10px' }}>
        {TIME_RANGE_OPTIONS.map(({ label, value }) => (
          <button key={value} onClick={() => setTimeRange(value)}
            className={`period-btn ${timeRange === value ? 'active' : ''}`}>
            {label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.14em', color: 'var(--text-dim)' }}>
          SOURCE: 10-K FILINGS
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1px', marginBottom: '16px', border: '1px solid var(--rule)' }}>
        {/* Cash */}
        <div className="glass-card" style={{ padding: 0 }}>
          <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Cash &amp; T-Bill Holdings</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <ExportCsvButton data={filtered} filename="berkshire_cash_holdings"
                columns={[{ key: 'year', label: 'Year' }, { key: 'cash', label: 'Cash + T-Bills ($B)' }, { key: 'yoy', label: 'YoY (%)' }]}
              />
              <ChartToggle type={cashMainType} setType={setCashMain} />
            </div>
          </div>
          <div style={{ padding: isMobile ? '12px 8px' : '16px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.14em', color: 'var(--text-dim)', marginBottom: '12px' }}>
              Annual cash + short-term U.S. Treasury holdings ($B)
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={filtered} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="1 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="year" tick={axTick} axisLine={false} tickLine={false} interval={isMobile ? 4 : 2} />
                <YAxis tickFormatter={v => `$${v}B`} tick={axTick} axisLine={false} tickLine={false} width={48} />
                <Tooltip content={<CashTooltip />} cursor={{ fill: 'oklch(72% 0.14 42 / 0.04)' }} />
                {cashMainType === 'line' ? (
                  <Line type="monotone" dataKey="cash" stroke="var(--accent)" strokeWidth={2} dot={false} />
                ) : (
                  <Bar dataKey="cash" name="Cash & T-Bills">
                    {filtered.map(entry => (
                      <Cell key={entry.year}
                        fill={entry.cash >= 200 ? 'var(--accent)' : `oklch(72% 0.14 42 / ${entry.cash >= 100 ? 0.7 : entry.cash >= 50 ? 0.5 : 0.3})`}
                      />
                    ))}
                  </Bar>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* YoY */}
        <div className="glass-card" style={{ padding: 0 }}>
          <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Year-over-Year Growth</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <ExportCsvButton data={filtered.filter(d => d.yoy !== null)} filename="berkshire_cash_yoy"
                columns={[{ key: 'year', label: 'Year' }, { key: 'yoy', label: 'YoY (%)' }, { key: 'cash', label: 'Cash ($B)' }]}
              />
              <ChartToggle type={cashYoyType} setType={setCashYoy} />
            </div>
          </div>
          <div style={{ padding: isMobile ? '12px 8px' : '16px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.14em', color: 'var(--text-dim)', marginBottom: '12px' }}>
              Annual change in cash holdings (%)
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={filtered.filter(d => d.yoy !== null)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="1 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="year" tick={axTick} axisLine={false} tickLine={false} interval={isMobile ? 4 : 2} />
                <YAxis tickFormatter={v => `${v}%`} tick={axTick} axisLine={false} tickLine={false} width={48} />
                <Tooltip content={<YoyTooltip />} cursor={{ fill: 'oklch(72% 0.14 42 / 0.04)' }} />
                <ReferenceLine y={0} stroke="var(--rule-strong)" strokeWidth={1} />
                {cashYoyType === 'line' ? (
                  <Line type="monotone" dataKey="yoy" stroke="var(--accent)" strokeWidth={2} dot={false} />
                ) : (
                  <Bar dataKey="yoy" name="YoY Growth">
                    {filtered.filter(d => d.yoy !== null).map(entry => (
                      <Cell key={entry.year} fill={entry.yoy >= 0 ? 'var(--pos)' : 'var(--neg)'} />
                    ))}
                  </Bar>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '14px 18px', marginBottom: '4px', borderLeft: '1px solid var(--rule-strong)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.12em', color: 'var(--text-dim)', lineHeight: '1.8' }}>
          <span style={{ color: 'var(--text-mid)' }}>DATA NOTES:</span>{' '}
          Cash holdings represent Berkshire Hathaway's combined cash &amp; cash equivalents
          plus short-term U.S. Treasury bill investments as reported in annual 10-K filings.
          1995–1999 figures reflect cash &amp; equivalents only (pre-T-bill era).
          The 1998 spike ($13.6B) reflects the General Re acquisition.
          Data is sourced directly from annual reports — no external API calls required.
        </div>
      </div>

      <SourceLink href="https://fred.stlouisfed.org/" label="FRED (St. Louis Fed)"
        note="Wilshire 5000 Full Cap (WILL5000INDFC) &amp; GDP" />
      <SourceLink href="https://www.berkshirehathaway.com/reports.html"
        label="Berkshire Hathaway Annual Reports" note="Cash + T-Bill Holdings (10-K)" />
    </div>
  );
};
