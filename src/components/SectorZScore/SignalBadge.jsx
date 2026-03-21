import React from 'react';
import { SIGNAL_THRESHOLDS } from './constants';

const getSignal = (zScore) => {
  if (zScore === null || zScore === undefined) {
    return { label: 'N/A', color: '#4B5563', bg: '#0B0F19', border: '#374151' };
  }
  if (zScore <= SIGNAL_THRESHOLDS.CYCLICAL_LOW) {
    return { label: 'CYCLIC LOW', color: '#10B981', bg: '#064E3B', border: '#10B981' };
  }
  if (zScore <= SIGNAL_THRESHOLDS.CHEAP) {
    return { label: 'CHEAP', color: '#38BDF8', bg: '#082F49', border: '#38BDF8' };
  }
  if (zScore >= SIGNAL_THRESHOLDS.EXTENDED) {
    return { label: 'EXTENDED', color: '#EF4444', bg: '#450A0A', border: '#EF4444' };
  }
  return { label: 'NEUTRAL', color: '#6B7280', bg: '#111827', border: '#374151' };
};

export const SignalBadge = ({ zScore }) => {
  const signal = getSignal(zScore);

  return (
    <span
      style={{
        padding: '2px 6px',
        borderRadius: '0',
        fontFamily: 'JetBrains Mono, monospace',
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
