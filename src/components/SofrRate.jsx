import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Bar
} from 'recharts';
import { SourceLink } from './SourceLink';
import { ExportCsvButton } from './ExportCsvButton';
import { ChartToggle } from './ChartToggle';
import { formatDate } from '../utils/formatDate';
import { ChartTooltip } from './ChartTooltip';

const sofrFormatValue = (p) =>
  typeof p.value === 'number' ? `${p.value.toFixed(2)}%` : p.value;
const CustomTooltip = (props) => <ChartTooltip {...props} formatValue={sofrFormatValue} />;

export function SofrRate({ isMobile }) {
  const [rawData, setRawData] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('2y');

  const [sofrMainType, setSofrMainType] = useState('line');
  const [sofrBandType, setSofrBandType] = useState('line');
  const [sofrVolType, setSofrVolType] = useState('line');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const apiUrl = 'https://markets.newyorkfed.org/api/rates/secured/sofr/search.json?startDate=2018-04-02&endDate=2099-12-31';
        let records = [];
        try {
          const r = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) });
          if (r.ok) {
            const json = await r.json();
            records = (json.refRates || [])
              .map(x => ({
                date: x.effectiveDate,
                rate: x.percentRate,
                p1: x.percentPercentile1,
                p25: x.percentPercentile25,
                p75: x.percentPercentile75,
                p99: x.percentPercentile99,
                volume: x.volumeInBillions,
              }))
              .sort((a, b) => a.date.localeCompare(b.date));
          }
        } catch { /* fall through to static file */ }

        if (!records.length) {
          const r = await fetch('./sofr_data.json');
          if (!r.ok) throw new Error('Failed to load SOFR data');
          const json = await r.json();
          records = json.data || [];
          if (!cancelled) setMetadata({ lastUpdated: json.last_updated, source: json.source, sourceUrl: json.source_url });
        } else {
          if (!cancelled) setMetadata({
            lastUpdated: new Date().toISOString(),
            source: 'Federal Reserve Bank of New York — SOFR (Live)',
            sourceUrl: 'https://www.newyorkfed.org/markets/reference-rates/sofr',
          });
        }

        if (!records.length) throw new Error('No SOFR records found');
        if (!cancelled) setRawData(records);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) return (
    <div className="glass-card" style={{ padding: '40px 24px', textAlign: 'center', marginTop: '20px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-mid)', letterSpacing: '0.2em', textTransform: 'uppercase' }} className="pulse-animation">LOADING SOFR...</div>
    </div>
  );

  if (error) return (
    <div className="glass-card" style={{ padding: '40px 24px', textAlign: 'center', marginTop: '20px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--neg)', fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase' }}>ERROR: {error}</div>
    </div>
  );

  const filtered = timeRange === 'all' ? rawData
    : timeRange === '5y' ? rawData.slice(-1260)
    : timeRange === '2y' ? rawData.slice(-504)
    : rawData.slice(-126);

  const latest = rawData[rawData.length - 1];
  const prev = rawData[rawData.length - 2];
  const dayChange = latest && prev ? (latest.rate - prev.rate).toFixed(2) : null;

  const yearAgo = rawData[rawData.length - 252];
  const yoyChange = latest && yearAgo ? (latest.rate - yearAgo.rate).toFixed(2) : null;

  const allRates = rawData.map(d => d.rate);
  const maxRate = Math.max(...allRates);
  const minRate = Math.min(...allRates);
  const avgRate = (allRates.reduce((a, b) => a + b, 0) / allRates.length).toFixed(2);

  const chartInterval = Math.floor((filtered.length || 1) / 8);

  return (
    <>
      {/* Key Metrics */}
      <div className="responsive-grid" style={{ marginTop: '16px', marginBottom: '20px' }}>
        <div className="stat-card">
          <div className="stat-block-label">SOFR Rate · {latest?.date}</div>
          <div className="stat-block-value accent">{latest?.rate?.toFixed(2)}%</div>
        </div>

        <div className="stat-card">
          <div className="stat-block-label">1-Day Change</div>
          <div className={`stat-block-value ${Number(dayChange) > 0 ? 'neg' : Number(dayChange) < 0 ? 'pos' : 'neutral'}`}>
            {dayChange !== null ? `${Number(dayChange) > 0 ? '+' : ''}${dayChange}%` : 'N/A'}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-block-label">YoY Change</div>
          <div className={`stat-block-value ${Number(yoyChange) > 0 ? 'neg' : Number(yoyChange) < 0 ? 'pos' : 'neutral'}`}>
            {yoyChange !== null ? `${Number(yoyChange) > 0 ? '+' : ''}${yoyChange}%` : 'N/A'}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-block-label">Hist. Range (All-Time)</div>
          <div className="stat-block-value sm neutral">{minRate.toFixed(2)}% – {maxRate.toFixed(2)}%</div>
          <div className="stat-block-sub">AVG: {avgRate}%</div>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="mobile-scroll" style={{ display: 'flex', gap: '4px', marginBottom: '20px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {['6m', '2y', '5y', 'all'].map(r => (
          <button
            key={r}
            onClick={() => setTimeRange(r)}
            className={`period-btn ${timeRange === r ? 'active' : ''}`}
          >
            {r.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Main SOFR Line Chart */}
      <div className="glass-card animate-in" style={{ padding: '0', marginBottom: '20px', animationDelay: '100ms' }}>
        <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>SOFR RATE OVER TIME</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <ExportCsvButton
              data={filtered}
              filename="sofr_rate"
              columns={[
                { key: 'date', label: 'Date' },
                { key: 'rate', label: 'SOFR Rate (%)' },
                { key: 'volume', label: 'Volume (Billions USD)' },
              ]}
            />
            <ChartToggle type={sofrMainType} setType={setSofrMainType} />
          </div>
        </div>
        <div style={{ padding: isMobile ? '16px 8px' : '24px 16px' }}>
          <ResponsiveContainer width="100%" height={isMobile ? 240 : 340}>
            <ComposedChart data={filtered} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="sofrGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="1 3" stroke="var(--rule)" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="var(--rule)"
                tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                tickFormatter={formatDate}
                interval={chartInterval}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                stroke="var(--rule)"
                tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                tickFormatter={v => `${v.toFixed(1)}%`}
                domain={['auto', 'auto']}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0.07} stroke="var(--rule-strong)" strokeDasharray="4 4"
                label={{ value: 'ZIRP era', fill: 'var(--text-dim)', fontSize: 9, fontFamily: 'var(--font-mono)' }} />
              {sofrMainType === 'line' ? (
                <Area
                  type="monotone" dataKey="rate" stroke="var(--accent)" strokeWidth={1.5}
                  fill="url(#sofrGradient)" name="SOFR Rate"
                />
              ) : (
                <Bar dataKey="rate" fill="var(--accent)" name="SOFR Rate" />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Percentile Band Chart */}
      <div className="glass-card animate-in" style={{ padding: '0', marginBottom: '20px', animationDelay: '200ms' }}>
        <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>SOFR PERCENTILE BANDS (P1 / P25 / P75 / P99)</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <ExportCsvButton
              data={filtered}
              filename="sofr_percentile_bands"
              columns={[
                { key: 'date', label: 'Date' },
                { key: 'p1',   label: 'P1 (%)' },
                { key: 'p25',  label: 'P25 (%)' },
                { key: 'rate', label: 'Median SOFR (%)' },
                { key: 'p75',  label: 'P75 (%)' },
                { key: 'p99',  label: 'P99 (%)' },
              ]}
            />
            <ChartToggle type={sofrBandType} setType={setSofrBandType} />
          </div>
        </div>
        <div style={{ padding: isMobile ? '16px 8px' : '24px 16px' }}>
          <ResponsiveContainer width="100%" height={isMobile ? 200 : 280}>
            <ComposedChart data={filtered} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="1 3" stroke="var(--rule)" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="var(--rule)"
                tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                tickFormatter={formatDate}
                interval={chartInterval}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                stroke="var(--rule)"
                tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                tickFormatter={v => `${v.toFixed(1)}%`}
                domain={['auto', 'auto']}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              {sofrBandType === 'line' ? (
                <>
                  <Line type="monotone" dataKey="p1"  stroke="var(--text-dim)" strokeWidth={1} dot={false} name="P1"  strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="p25" stroke="var(--bb-orange)" strokeWidth={1} dot={false} name="P25" />
                  <Line type="monotone" dataKey="rate" stroke="var(--accent)" strokeWidth={2} dot={false} name="SOFR (Median)" />
                  <Line type="monotone" dataKey="p75" stroke="var(--bb-orange)" strokeWidth={1} dot={false} name="P75" />
                  <Line type="monotone" dataKey="p99" stroke="var(--neg)" strokeWidth={1} dot={false} name="P99" strokeDasharray="3 3" />
                </>
              ) : (
                <>
                  <Bar dataKey="p1" fill="var(--text-dim)" name="P1" stackId="a" />
                  <Bar dataKey="p25" fill="var(--bb-orange)" name="P25" stackId="a" />
                  <Bar dataKey="rate" fill="var(--accent)" name="SOFR (Median)" stackId="a" />
                  <Bar dataKey="p75" fill="var(--bb-orange)" name="P75" stackId="a" />
                  <Bar dataKey="p99" fill="var(--neg)" name="P99" stackId="a" />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
            {[
              { label: 'P99', color: 'var(--neg)' },
              { label: 'P75', color: 'var(--bb-orange)' },
              { label: 'SOFR', color: 'var(--accent)' },
              { label: 'P25', color: 'var(--bb-orange)' },
              { label: 'P1',  color: 'var(--text-dim)' },
            ].map(({ label, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 20, height: 1, background: color }} />
                <span style={{ color: 'var(--text-mid)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transaction Volume Chart */}
      <div className="glass-card animate-in" style={{ padding: '0', marginBottom: '20px', animationDelay: '300ms' }}>
        <div className="bb-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>DAILY TRANSACTION VOLUME (USD BILLIONS)</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <ExportCsvButton
              data={filtered}
              filename="sofr_volume"
              columns={[
                { key: 'date',   label: 'Date' },
                { key: 'volume', label: 'Volume (Billions USD)' },
                { key: 'rate',   label: 'SOFR Rate (%)' },
              ]}
            />
            <ChartToggle type={sofrVolType} setType={setSofrVolType} />
          </div>
        </div>
        <div style={{ padding: isMobile ? '16px 8px' : '24px 16px' }}>
          <ResponsiveContainer width="100%" height={isMobile ? 160 : 220}>
            <ComposedChart data={filtered} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="volGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--pos)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--pos)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="1 3" stroke="var(--rule)" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="var(--rule)"
                tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                tickFormatter={formatDate}
                interval={chartInterval}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                stroke="var(--rule)"
                tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                tickFormatter={v => `$${v}B`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              {sofrVolType === 'line' ? (
                <Area type="monotone" dataKey="volume" stroke="var(--pos)" strokeWidth={1.5}
                  fill="url(#volGradient)" name="Volume ($B)" />
              ) : (
                <Bar dataKey="volume" fill="var(--pos)" name="Volume ($B)" />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* About Card */}
      <div className="glass-card animate-in" style={{ padding: '16px 20px', animationDelay: '400ms' }}>
        <div>
          <div className="stat-block-label" style={{ marginBottom: '8px' }}>About SOFR</div>
          <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-mid)', fontSize: '13px', lineHeight: '1.6', margin: 0 }}>
            The Secured Overnight Financing Rate (SOFR) is a broad measure of the cost of borrowing cash
            overnight collateralized by U.S. Treasury securities. Published by the NY Fed each business day,
            SOFR replaced LIBOR as the primary USD benchmark rate in June 2023. Rising SOFR signals
            tightening financial conditions; falling SOFR reflects easing or excess liquidity.
          </p>
        </div>
      </div>

      <SourceLink
        href="https://www.newyorkfed.org/markets/reference-rates/sofr"
        label="NY Fed — SOFR Reference Rate"
      />
    </>
  );
}
