import React from 'react';
import { BENCHMARKS, RETURN_PERIODS, Z_WINDOWS } from './constants';

const SelectDropdown = ({ label, value, options, onChange, isMobile }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: isMobile ? '1 1 100%' : '1 1 auto' }}>
    <label style={{
      fontFamily: 'var(--font-ui)',
      color: 'var(--bb-yellow)',
      fontSize: '10px',
      textTransform: 'uppercase',
      fontWeight: '700',
      letterSpacing: '0.8px'
    }}>
      {label}
    </label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: 'var(--bb-black)',
        color: 'var(--bb-white)',
        border: '1px solid var(--bb-border)',
        borderRadius: '4px',
        padding: isMobile ? '8px 10px' : '6px 10px',
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
        fontWeight: '700',
        cursor: 'pointer',
        outline: 'none',
        minWidth: isMobile ? '100%' : '140px',
      }}
      onFocus={(e) => { e.target.style.borderColor = 'var(--bb-yellow)'; }}
      onBlur={(e) => { e.target.style.borderColor = 'var(--bb-border)'; }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} style={{ background: '#0B0F19' }}>
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
      className="glass-card"
      style={{
        display: 'flex',
        gap: isMobile ? '12px' : '16px',
        marginBottom: '1px',
        marginTop: '1px',
        flexWrap: 'wrap',
        justifyContent: isMobile ? 'center' : 'flex-start',
        padding: isMobile ? '12px' : '12px 16px'
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
