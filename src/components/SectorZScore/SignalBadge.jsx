import React from 'react';
import { SIGNAL_THRESHOLDS } from './constants';

const getSignal = (zScore) => {
  if (zScore === null || zScore === undefined) {
    return { label: 'N/A', color: 'var(--text-muted)', bg: 'rgba(255, 255, 255, 0.05)' };
  }
  if (zScore <= SIGNAL_THRESHOLDS.CYCLICAL_LOW) {
    return { label: 'CYCLICAL LOW', color: 'var(--accent-emerald)', bg: 'rgba(81, 207, 102, 0.12)' };
  }
  if (zScore <= SIGNAL_THRESHOLDS.CHEAP) {
    return { label: 'CHEAP', color: 'var(--accent-blue)', bg: 'rgba(59, 130, 246, 0.12)' };
  }
  if (zScore >= SIGNAL_THRESHOLDS.EXTENDED) {
    return { label: 'EXTENDED', color: 'var(--accent-coral)', bg: 'rgba(255, 107, 107, 0.12)' };
  }
  return { label: 'NEUTRAL', color: 'var(--text-tertiary)', bg: 'rgba(255, 255, 255, 0.05)' };
};

export const SignalBadge = ({ zScore }) => {
  const signal = getSignal(zScore);

  return (
    <span
      style={{
        padding: '4px 10px',
        borderRadius: 'var(--radius-sm)',
        fontSize: '10px',
        fontWeight: '700',
        color: signal.color,
        background: signal.bg,
        border: `1px solid ${signal.color}40`,
        whiteSpace: 'nowrap',
        letterSpacing: '0.3px',
        textTransform: 'uppercase'
      }}
    >
      {signal.label}
    </span>
  );
};

export default SignalBadge;
