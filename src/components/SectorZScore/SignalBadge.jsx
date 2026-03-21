import React from 'react';
import { SIGNAL_THRESHOLDS } from './constants';

const getSignal = (zScore) => {
  if (zScore === null || zScore === undefined) {
    return { label: 'N/A', color: '#444444', bg: '#0A0A0A', border: '#333333' };
  }
  if (zScore <= SIGNAL_THRESHOLDS.CYCLICAL_LOW) {
    return { label: 'CYCLIC LOW', color: '#00CC44', bg: '#001A00', border: '#00CC44' };
  }
  if (zScore <= SIGNAL_THRESHOLDS.CHEAP) {
    return { label: 'CHEAP', color: '#00CCCC', bg: '#001A1A', border: '#00CCCC' };
  }
  if (zScore >= SIGNAL_THRESHOLDS.EXTENDED) {
    return { label: 'EXTENDED', color: '#FF3333', bg: '#1A0000', border: '#FF3333' };
  }
  return { label: 'NEUTRAL', color: '#666666', bg: '#111111', border: '#333333' };
};

export const SignalBadge = ({ zScore }) => {
  const signal = getSignal(zScore);

  return (
    <span
      style={{
        padding: '2px 6px',
        borderRadius: '0',
        fontFamily: 'Courier New, monospace',
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
