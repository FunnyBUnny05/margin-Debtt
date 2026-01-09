import React from 'react';
import { BENCHMARKS, RETURN_PERIODS, Z_WINDOWS } from './constants';

const SelectDropdown = ({ label, value, options, onChange, isMobile }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
    <label style={{ color: '#888', fontSize: '11px', textTransform: 'uppercase' }}>
      {label}
    </label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: '#0d0d1a',
        color: '#e0e0e0',
        border: '1px solid #333',
        borderRadius: '4px',
        padding: isMobile ? '8px 10px' : '6px 10px',
        fontSize: '13px',
        cursor: 'pointer',
        outline: 'none',
        minWidth: isMobile ? '100%' : '120px'
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

export const ControlPanel = ({
  benchmark,
  setBenchmark,
  returnPeriod,
  setReturnPeriod,
  zWindow,
  setZWindow,
  isMobile
}) => {
  const benchmarkOptions = BENCHMARKS.map((b) => ({
    value: b.symbol,
    label: `${b.symbol} (${b.name})`
  }));

  const returnPeriodOptions = RETURN_PERIODS.map((p) => ({
    value: p.value,
    label: p.label
  }));

  const zWindowOptions = Z_WINDOWS.map((w) => ({
    value: w.value,
    label: w.label
  }));

  return (
    <div
      style={{
        display: 'flex',
        gap: isMobile ? '12px' : '20px',
        marginBottom: '20px',
        flexWrap: 'wrap',
        justifyContent: isMobile ? 'center' : 'flex-start',
        background: '#1a1a2e',
        padding: '16px',
        borderRadius: '8px'
      }}
    >
      <SelectDropdown
        label="Benchmark"
        value={benchmark}
        options={benchmarkOptions}
        onChange={setBenchmark}
        isMobile={isMobile}
      />
      <SelectDropdown
        label="Return Period"
        value={returnPeriod}
        options={returnPeriodOptions}
        onChange={(v) => setReturnPeriod(Number(v))}
        isMobile={isMobile}
      />
      <SelectDropdown
        label="Z-Score Window"
        value={zWindow}
        options={zWindowOptions}
        onChange={(v) => setZWindow(Number(v))}
        isMobile={isMobile}
      />
    </div>
  );
};

export default ControlPanel;
