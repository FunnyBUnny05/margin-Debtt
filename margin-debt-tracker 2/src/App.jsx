import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart } from 'recharts';

const formatDate = (date) => {
  const [year, month] = date.split('-');
  return `${month}/${year.slice(2)}`;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#1a1a2e', border: '1px solid #444', padding: '10px', borderRadius: '4px' }}>
        <p style={{ color: '#fff', margin: 0, fontWeight: 'bold' }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color, margin: '4px 0 0 0' }}>
            {p.name}: {p.name === 'YoY Growth' ? `${p.value?.toFixed(1)}%` : `$${p.value?.toFixed(0)}B`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function App() {
  const [rawData, setRawData] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('all');

  useEffect(() => {
    fetch('./margin_data.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load data');
        return res.json();
      })
      .then(json => {
        setRawData(json.data);
        setMetadata({
          lastUpdated: json.last_updated,
          source: json.source,
          sourceUrl: json.source_url
        });
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ background: '#0d0d1a', color: '#e0e0e0', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>Loading FINRA Data...</div>
          <div style={{ color: '#888' }}>Fetching margin statistics</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: '#0d0d1a', color: '#ef4444', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>Error Loading Data</div>
          <div>{error}</div>
        </div>
      </div>
    );
  }

  const data = rawData.map(d => ({
    ...d,
    margin_debt_bn: d.margin_debt / 1000
  }));

  const filteredData = timeRange === 'all' ? data : 
    timeRange === '10y' ? data.slice(-120) :
    timeRange === '5y' ? data.slice(-60) : data.slice(-24);

  const currentDebt = data[data.length - 1];
  const peak2021 = data.find(d => d.date === '2021-10') || data[data.length - 1];
  const peak2000 = data.find(d => d.date === '2000-03') || data[0];
  
  const formatLastUpdated = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div style={{ background: '#0d0d1a', color: '#e0e0e0', padding: '20px', minHeight: '100vh', fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div>
            <h1 style={{ fontSize: '24px', marginBottom: '8px', color: '#fff' }}>FINRA Margin Debt Tracker</h1>
            <p style={{ color: '#888', marginBottom: '4px' }}>Securities margin account debit balances ($ billions)</p>
          </div>
          {metadata && (
            <div style={{ textAlign: 'right', fontSize: '12px', color: '#666' }}>
              <div>Last updated: {formatLastUpdated(metadata.lastUpdated)}</div>
              <a href={metadata.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
                Source: {metadata.source}
              </a>
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {['2y', '5y', '10y', 'all'].map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              style={{
                padding: '6px 16px',
                background: timeRange === range ? '#3b82f6' : '#1a1a2e',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {range.toUpperCase()}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: '#1a1a2e', padding: '16px', borderRadius: '8px' }}>
            <div style={{ color: '#888', fontSize: '12px' }}>Current ({currentDebt.date})</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>${currentDebt.margin_debt_bn.toFixed(0)}B</div>
          </div>
          <div style={{ background: '#1a1a2e', padding: '16px', borderRadius: '8px' }}>
            <div style={{ color: '#888', fontSize: '12px' }}>YoY Growth</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: currentDebt.yoy_growth > 0 ? '#ef4444' : '#22c55e' }}>
              {currentDebt.yoy_growth > 0 ? '+' : ''}{currentDebt.yoy_growth?.toFixed(1) || 'N/A'}%
            </div>
          </div>
          <div style={{ background: '#1a1a2e', padding: '16px', borderRadius: '8px' }}>
            <div style={{ color: '#888', fontSize: '12px' }}>vs 2021 Peak</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>
              {currentDebt.margin_debt >= peak2021.margin_debt ? '+' : ''}{((currentDebt.margin_debt / peak2021.margin_debt - 1) * 100).toFixed(0)}%
            </div>
          </div>
          <div style={{ background: '#1a1a2e', padding: '16px', borderRadius: '8px' }}>
            <div style={{ color: '#888', fontSize: '12px' }}>vs 2000 Peak</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#a855f7' }}>
              +{((currentDebt.margin_debt / peak2000.margin_debt - 1) * 100).toFixed(0)}%
            </div>
          </div>
        </div>

        <div style={{ background: '#1a1a2e', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '16px', marginBottom: '16px', color: '#fff' }}>Margin Debt Level</h2>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={filteredData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="debtGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis 
                dataKey="date" 
                stroke="#666" 
                tick={{ fill: '#888', fontSize: 11 }}
                tickFormatter={formatDate}
                interval={Math.floor(filteredData.length / 8)}
              />
              <YAxis 
                stroke="#666" 
                tick={{ fill: '#888', fontSize: 11 }}
                tickFormatter={(v) => `$${v}B`}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="margin_debt_bn" 
                stroke="#3b82f6" 
                fill="url(#debtGradient)"
                name="Margin Debt"
              />
              <Line 
                type="monotone" 
                dataKey="margin_debt_bn" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={false}
                name="Margin Debt"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: '#1a1a2e', borderRadius: '8px', padding: '20px' }}>
          <h2 style={{ fontSize: '16px', marginBottom: '16px', color: '#fff' }}>Year-over-Year Growth Rate</h2>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={filteredData.filter(d => d.yoy_growth !== null)} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis 
                dataKey="date" 
                stroke="#666" 
                tick={{ fill: '#888', fontSize: 11 }}
                tickFormatter={formatDate}
                interval={Math.floor(filteredData.length / 8)}
              />
              <YAxis 
                stroke="#666" 
                tick={{ fill: '#888', fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#666" strokeWidth={2} />
              <ReferenceLine y={30} stroke="#ef4444" strokeDasharray="5 5" strokeOpacity={0.5} />
              <ReferenceLine y={-30} stroke="#22c55e" strokeDasharray="5 5" strokeOpacity={0.5} />
              <Line 
                type="monotone" 
                dataKey="yoy_growth" 
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                name="YoY Growth"
              />
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: '24px', marginTop: '12px', fontSize: '12px', color: '#888' }}>
            <span>🔴 +30% threshold (euphoria zone)</span>
            <span>🟢 -30% threshold (capitulation zone)</span>
          </div>
        </div>

        <div style={{ marginTop: '20px', padding: '16px', background: '#1a1a2e', borderRadius: '8px', fontSize: '13px', color: '#888' }}>
          <strong style={{ color: '#f59e0b' }}>Historical pattern:</strong> Sustained 30%+ YoY margin debt growth has preceded every major market correction. 
          2000 peak (+80% YoY) → dot-com crash. 2007 peak (+62% YoY) → financial crisis. 2021 peak (+71% YoY) → 2022 bear market.
          Data auto-updates weekly from FINRA.
        </div>
      </div>
    </div>
  );
}
