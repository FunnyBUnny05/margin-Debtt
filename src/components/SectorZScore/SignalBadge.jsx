import React from 'react';
import { SIGNAL_THRESHOLDS } from './constants';

const getSignal = (zScore) => {
  if (zScore === null || zScore === undefined) {
    return { label: 'N/A', color: 'var(--bb-gray-2)', bg: 'rgba(0, 0, 0, 0.2)', border: 'var(--bb-border-light)' };
  }
  if (zScore <= SIGNAL_THRESHOLDS.CYCLICAL_LOW) {
    return { label: 'CYCLIC LOW', color: 'var(--bb-green)', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.3)' };
  }
  if (zScore <= SIGNAL_THRESHOLDS.CHEAP) {
    return { label: 'CHEAP', color: 'var(--bb-cyan)', bg: 'rgba(56, 189, 248, 0.1)', border: 'rgba(56, 189, 248, 0.3)' };
  }
  if (zScore >= SIGNAL_THRESHOLDS.EXTENDED) {
    return { label: 'EXTENDED', color: 'var(--bb-red)', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)' };
  }
  return { label: 'NEUTRAL', color: 'var(--bb-gray-2)', bg: 'rgba(255, 255, 255, 0.05)', border: 'var(--bb-border-light)' };
};

export const SignalBadge = ({ zScore }) => {
  const signal = getSignal(zScore);

  return (
    <span
      style={{
        padding: '2px 6px',
        borderRadius: '4px',
        fontFamily: 'var(--font-mono)',
        fontSize: '9px',
        fontWeight: '700',
        color: signal.color,
        background: signal.bg,
        border: `1px solid ${signal.border}`,
        whiteSpace: 'nowrap',
        letterSpacing: '0.5px',
        textTransform: 'uppercase'
      }}
    >
      {signal.label}
    </span>
  );
};

export default SignalBadge;
