import React from 'react';
import { BENCHMARKS, RETURN_PERIODS, Z_WINDOWS } from './constants';

const SelectDropdown = ({ label, value, options, onChange, isMobile }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: isMobile ? '1 1 100%' : '1 1 auto' }}>
    <label style={{
      color: 'var(--text-tertiary)',
      fontSize: '11px',
      textTransform: 'uppercase',
      fontWeight: '600',
      letterSpacing: '0.5px'
    }}>
      {label}
    </label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: 'var(--glass-bg)',
        color: 'var(--text-primary)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-md)',
        padding: isMobile ? '10px 12px' : '8px 12px',
        fontSize: '13px',
        fontWeight: '500',
        cursor: 'pointer',
        outline: 'none',
        minWidth: isMobile ? '100%' : '140px',
        transition: 'all var(--transition-smooth)',
        backdropFilter: 'blur(8px)'
      }}
      onMouseEnter={(e) => {
        e.target.style.borderColor = 'var(--accent-purple)';
        e.target.style.boxShadow = '0 0 0 3px rgba(167, 139, 250, 0.1)';
      }}
      onMouseLeave={(e) => {
        e.target.style.borderColor = 'var(--glass-border)';
        e.target.style.boxShadow = 'none';
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
      className="glass-card"
      style={{
        display: 'flex',
        gap: isMobile ? '12px' : '20px',
        marginBottom: '24px',
        flexWrap: 'wrap',
        justifyContent: isMobile ? 'center' : 'flex-start',
        padding: isMobile ? '20px' : '24px'
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
