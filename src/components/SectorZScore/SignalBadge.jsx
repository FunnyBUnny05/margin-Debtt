import React from 'react';
import { SIGNAL_THRESHOLDS } from './constants';

const getSignal = (zScore) => {
  if (zScore === null || zScore === undefined) {
    return { label: 'N/A', color: 'var(--bb-gray-2)', bg: 'var(--bb-border-light)', border: 'var(--bb-border-light)' };
  }
  if (zScore <= SIGNAL_THRESHOLDS.CYCLICAL_LOW) {
    return { label: 'CYCLIC LOW', color: 'var(--bb-green)', bg: 'var(--bb-panel-alt)', border: 'var(--bb-green)' };
  }
  if (zScore <= SIGNAL_THRESHOLDS.CHEAP) {
    return { label: 'CHEAP', color: 'var(--bb-royal)', bg: 'var(--bb-panel-alt)', border: 'var(--bb-royal)' };
  }
  if (zScore >= SIGNAL_THRESHOLDS.EXTENDED) {
    return { label: 'EXTENDED', color: 'var(--bb-red)', bg: 'var(--bb-panel-alt)', border: 'var(--bb-red)' };
  }
  return { label: 'NEUTRAL', color: 'var(--bb-gray-2)', bg: 'var(--bb-panel-alt)', border: 'var(--bb-border-light)' };
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
