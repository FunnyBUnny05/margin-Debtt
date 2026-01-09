import React from 'react';
import { SIGNAL_THRESHOLDS } from './constants';

const getSignal = (zScore) => {
  if (zScore === null || zScore === undefined) {
    return { label: 'N/A', color: '#666', bg: '#6661a' };
  }
  if (zScore <= SIGNAL_THRESHOLDS.CYCLICAL_LOW) {
    return { label: 'CYCLICAL LOW', color: '#22c55e', bg: '#22c55e1a' };
  }
  if (zScore <= SIGNAL_THRESHOLDS.CHEAP) {
    return { label: 'CHEAP', color: '#3b82f6', bg: '#3b82f61a' };
  }
  if (zScore >= SIGNAL_THRESHOLDS.EXTENDED) {
    return { label: 'EXTENDED', color: '#ef4444', bg: '#ef44441a' };
  }
  return { label: 'NEUTRAL', color: '#888', bg: '#8881a' };
};

export const SignalBadge = ({ zScore }) => {
  const signal = getSignal(zScore);

  return (
    <span
      style={{
        padding: '3px 8px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 'bold',
        color: signal.color,
        background: signal.bg,
        border: `1px solid ${signal.color}33`,
        whiteSpace: 'nowrap'
      }}
    >
      {signal.label}
    </span>
  );
};

export default SignalBadge;
