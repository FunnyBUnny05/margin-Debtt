import React, { useMemo, useState, useEffect } from 'react';
import {
  ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea,
} from 'recharts';

// Annual year-end values: Total US Market Cap / Nominal GDP (%)
// Source: Federal Reserve Z.1 (BOGZ1LM073064476Q) / BEA GDP
const HISTORICAL_DATA = [
  { year: 1971, ratio: 76 },
  { year: 1972, ratio: 87 },
  { year: 1973, ratio: 63 },
  { year: 1974, ratio: 44 },
  { year: 1975, ratio: 56 },
  { year: 1976, ratio: 61 },
  { year: 1977, ratio: 52 },
  { year: 1978, ratio: 50 },
  { year: 1979, ratio: 51 },
  { year: 1980, ratio: 57 },
  { year: 1981, ratio: 52 },
  { year: 1982, ratio: 61 },
  { year: 1983, ratio: 66 },
  { year: 1984, ratio: 60 },
  { year: 1985, ratio: 74 },
  { year: 1986, ratio: 83 },
  { year: 1987, ratio: 70 },
  { year: 1988, ratio: 73 },
  { year: 1989, ratio: 85 },
  { year: 1990, ratio: 70 },
  { year: 1991, ratio: 88 },
  { year: 1992, ratio: 91 },
  { year: 1993, ratio: 96 },
  { year: 1994, ratio: 90 },
  { year: 1995, ratio: 112 },
  { year: 1996, ratio: 129 },
  { year: 1997, ratio: 155 },
  { year: 1998, ratio: 176 },
  { year: 1999, ratio: 191 }, // dot-com peak
  { year: 2000, ratio: 149 },
  { year: 2001, ratio: 129 },
  { year: 2002, ratio: 89 },
  { year: 2003, ratio: 112 },
  { year: 2004, ratio: 123 },
  { year: 2005, ratio: 127 },
  { year: 2006, ratio: 140 },
  { year: 2007, ratio: 133 },
  { year: 2008, ratio: 78 },  // financial crisis
  { year: 2009, ratio: 107 },
  { year: 2010, ratio: 119 },
  { year: 2011, ratio: 105 },
  { year: 2012, ratio: 122 },
  { year: 2013, ratio: 152 },
  { year: 2014, ratio: 160 },
  { year: 2015, ratio: 139 },
  { year: 2016, ratio: 149 },
  { year: 2017, ratio: 165 },
  { year: 2018, ratio: 137 },
  { year: 2019, ratio: 163 },
  { year: 2020, ratio: 190 },
  { year: 2021, ratio: 214 }, // all-time high
  { year: 2022, ratio: 148 },
  { year: 2023, ratio: 178 },
  { year: 2024, ratio: 200 },
];

const CORS_PROXIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

const FRED_GDP_URL   = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=GDP';
// Z.1 total equity market cap, millions USD, quarterly
const FRED_MKTCAP_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=BOGZ1LM073064476Q';

const parseFredCsv = (text) => {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const out = {};
  for (let i = 1; i < lines.length; i++) {
    const [date, val] = lines[i].split(',').map(s => s.trim());
    if (date && val && val !== '.') {
      out[date.slice(0, 7)] = parseFloat(val); // "YYYY-MM" → value
    }
  }
  return out;
};

const fetchFredData = async () => {
  for (const proxy of CORS_PROXIES) {
    try {
      const [gdpRes, mktRes] = await Promise.all([
        fetch(proxy(FRED_GDP_URL),    { signal: AbortSignal.timeout(14000) }),
        fetch(proxy(FRED_MKTCAP_URL), { signal: AbortSignal.timeout(14000) }),
      ]);
      if (!gdpRes.ok || !mktRes.ok) continue;
      const [gdpText, mktText] = await Promise.all([gdpRes.text(), mktRes.text()]);
      const gdpMap = parseFredCsv(gdpText);   // billions (SAAR)
      const mktMap = parseFredCsv(mktText);   // millions

      // Aggregate quarterly data → annual (latest Q per year)
      const byYear = {};
      for (const [key, mkt] of Object.entries(mktMap)) {
        const gdp = gdpMap[key];
        if (!gdp || !mkt) continue;
        const year = parseInt(key.slice(0, 4), 10);
        const ratio = parseFloat(((mkt / 1000) / gdp * 100).toFixed(1));
        // keep the latest quarter per year
        if (!byYear[year] || key > byYear[year].key) {
          byYear[year] = { year, ratio, key };
        }
      }

      const rows = Object.values(byYear)
        .map(({ year, ratio }) => ({ year, ratio }))
        .sort((a, b) => a.year - b.year);

      if (rows.length > 10) return rows;
    } catch {
      // try next proxy
    }
  }
  return null;
};

const getZone = (ratio) => {
  if (ratio < 75)  return { label: 'Undervalued',              color: '#10b981', bg: 'rgba(16,185,129,0.12)'  };
  if (ratio < 100) return { label: 'Fair Value',               color: '#84cc16', bg: 'rgba(132,204,22,0.10)'  };
  if (ratio < 125) return { label: 'Moderately Overvalued',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  };
  if (ratio < 150) return { label: 'Significantly Overvalued', color: '#f97316', bg: 'rgba(249,115,22,0.12)'  };
  return             { label: 'Bubble Territory',              color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   };
};

const TIME_RANGES = [
  { label: '10Y', years: 10 },
  { label: '20Y', years: 20 },
  { label: '30Y', years: 30 },
  { label: 'ALL', years: null },
];

const RatioTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const ratio = payload[0].value;
  const zone = getZone(ratio);
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
      <div style={{ color: zone.color, fontWeight: '700', fontSize: '16px' }}>{ratio}%</div>
      <div style={{ color: zone.color, fontSize: '11px', marginTop: '4px' }}>{zone.label}</div>
    </div>
  );
};

export const MarketCapGDP = ({ isMobile }) => {
  const [timeRange, setTimeRange]   = useState('ALL');
  const [liveData, setLiveData]     = useState(null);
  const [fetchStatus, setFetchStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    fetchFredData().then(result => {
      if (cancelled) return;
      if (result) { setLiveData(result); setFetchStatus('live'); }
      else          { setFetchStatus('fallback'); }
    });
    return () => { cancelled = true; };
  }, []);

  const allData = useMemo(() => {
    if (!liveData) return HISTORICAL_DATA;
    // Prefer live data; back-fill any gaps with hardcoded
    const liveByYear = Object.fromEntries(liveData.map(d => [d.year, d]));
    const merged = HISTORICAL_DATA.map(d => liveByYear[d.year] ?? d);
    // Append live years beyond our hardcoded set
    const maxHardcoded = HISTORICAL_DATA[HISTORICAL_DATA.length - 1].year;
    const extra = liveData.filter(d => d.year > maxHardcoded);
    return [...merged, ...extra];
  }, [liveData]);

  const filtered = useMemo(() => {
    const maxYear = allData[allData.length - 1]?.year ?? new Date().getFullYear();
    const chosen  = TIME_RANGES.find(r => r.label === timeRange);
    if (!chosen?.years) return allData;
    return allData.filter(d => d.year >= maxYear - chosen.years);
  }, [timeRange, allData]);

  const latest   = allData[allData.length - 1];
  const zone     = getZone(latest?.ratio ?? 0);
  const avg      = (allData.reduce((s, d) => s + d.ratio, 0) / allData.length).toFixed(0);
  const ath      = allData.reduce((m, d) => d.ratio > m.ratio ? d : m, allData[0]);
  const minVal   = allData.reduce((m, d) => d.ratio < m.ratio ? d : m, allData[0]);

  const yDomain  = [0, Math.ceil(Math.max(...filtered.map(d => d.ratio), 250) / 50) * 50];

  return (
    <div>
      {/* Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '24px',
      }}>
        {[
          {
            label: `Current (${latest?.year})`,
            value: `${latest?.ratio}%`,
            sub: zone.label,
            color: zone.color,
          },
          {
            label: 'Historical Avg',
            value: `${avg}%`,
            sub: `${allData[0]?.year}–${latest?.year}`,
            color: '#60a5fa',
          },
          {
            label: 'All-Time High',
            value: `${ath?.ratio}%`,
            sub: String(ath?.year),
            color: '#f87171',
          },
          {
            label: 'All-Time Low',
            value: `${minVal?.ratio}%`,
            sub: String(minVal?.year),
            color: '#34d399',
          },
        ].map(({ label, value, sub, color }) => (
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

      {/* Current Signal Banner */}
      <div className="glass-card animate-in" style={{
        padding: '16px 24px',
        marginBottom: '24px',
        borderLeft: `4px solid ${zone.color}`,
        background: zone.bg,
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: '28px' }}>
          {latest?.ratio < 75 ? '🟢' : latest?.ratio < 100 ? '🟡' : latest?.ratio < 125 ? '🟠' : latest?.ratio < 150 ? '🔶' : '🔴'}
        </div>
        <div>
          <div style={{ fontWeight: '700', color: zone.color, fontSize: '16px' }}>{zone.label}</div>
          <div style={{ color: 'var(--text-tertiary)', fontSize: '13px', marginTop: '2px' }}>
            Market cap is <strong style={{ color: zone.color }}>{latest?.ratio}%</strong> of GDP — historical average is <strong style={{ color: 'var(--text-secondary)' }}>{avg}%</strong>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>
          {fetchStatus === 'loading' && '⏳ Fetching FRED data…'}
          {fetchStatus === 'live'    && '🟢 Live (FRED)'}
          {fetchStatus === 'fallback'&& '📋 Cached data'}
        </div>
      </div>

      {/* Time Range + Chart */}
      <div className="glass-card animate-in" style={{ padding: isMobile ? '20px 16px' : '28px 32px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>
              📊 Total Market Cap / GDP
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Wilshire 5000 equivalent / US nominal GDP (%)
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {TIME_RANGES.map(({ label }) => (
              <button
                key={label}
                onClick={() => setTimeRange(label)}
                className="btn-primary"
                style={{
                  padding: '6px 16px',
                  fontSize: '12px',
                  background: timeRange === label
                    ? 'linear-gradient(135deg,#f59e0b,#d97706)'
                    : 'var(--glass-bg)',
                  border: timeRange === label ? 'none' : '1px solid var(--glass-border)',
                  fontWeight: timeRange === label ? '600' : '400',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart data={filtered} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="ratioGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            {/* Valuation zone backgrounds */}
            <ReferenceArea y1={0}   y2={75}  fill="#10b981" fillOpacity={0.07} ifOverflow="extendDomain" />
            <ReferenceArea y1={75}  y2={100} fill="#84cc16" fillOpacity={0.07} ifOverflow="extendDomain" />
            <ReferenceArea y1={100} y2={125} fill="#f59e0b" fillOpacity={0.07} ifOverflow="extendDomain" />
            <ReferenceArea y1={125} y2={150} fill="#f97316" fillOpacity={0.07} ifOverflow="extendDomain" />
            <ReferenceArea y1={150} y2={400} fill="#ef4444" fillOpacity={0.07} ifOverflow="extendDomain" />

            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="year"
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval={isMobile ? 9 : 4}
            />
            <YAxis
              tickFormatter={v => `${v}%`}
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={48}
              domain={yDomain}
            />
            <Tooltip content={<RatioTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1 }} />

            {/* Zone threshold lines */}
            <ReferenceLine y={75}  stroke="#10b981" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: '75%',  fill: '#10b981', fontSize: 10, position: 'insideTopRight' }} />
            <ReferenceLine y={100} stroke="#84cc16" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: '100%', fill: '#84cc16', fontSize: 10, position: 'insideTopRight' }} />
            <ReferenceLine y={125} stroke="#f97316" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: '125%', fill: '#f97316', fontSize: 10, position: 'insideTopRight' }} />
            <ReferenceLine y={150} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: '150%', fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }} />

            <Area
              type="monotone"
              dataKey="ratio"
              stroke="#f59e0b"
              strokeWidth={2.5}
              fill="url(#ratioGradient)"
              dot={false}
              activeDot={{ r: 5, fill: '#f59e0b', strokeWidth: 0 }}
              name="Market Cap / GDP"
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Zone legend */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap', justifyContent: 'center', fontSize: '12px' }}>
          {[
            { color: '#10b981', label: '< 75% Undervalued'         },
            { color: '#84cc16', label: '75–100% Fair Value'         },
            { color: '#f59e0b', label: '100–125% Mod. Overvalued'   },
            { color: '#f97316', label: '125–150% Sig. Overvalued'   },
            { color: '#ef4444', label: '> 150% Bubble Territory'    },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: color, opacity: 0.8 }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Context note */}
      <div className="glass-card animate-in" style={{ padding: '16px 24px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.7' }}>
        <strong style={{ color: 'var(--text-tertiary)' }}>About the Buffett Indicator:</strong>{' '}
        Warren Buffett called this "probably the best single measure of where valuations stand at any given moment."
        It compares total US stock market capitalization to US nominal GDP. Readings above 100% suggest the market is overvalued relative to the underlying economy.
        Historical data uses Federal Reserve Z.1 equity market cap (BOGZ1LM073064476Q) divided by BEA nominal GDP.
        Live updates attempted via FRED; falls back to last known annual figures if unavailable.
      </div>
    </div>
  );
};
