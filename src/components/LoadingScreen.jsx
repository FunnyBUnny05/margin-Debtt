import React, { useEffect, useRef, useState } from 'react';

const SOURCES = [
  { source: 'BLS / PPI',     label: 'Fetching producer price index data' },
  { source: 'FINRA',         label: 'Loading margin debt statistics' },
  { source: 'AAII',          label: 'Retrieving investor sentiment survey' },
  { source: 'FRED / SOFR',   label: 'Syncing secured overnight financing rate' },
  { source: 'CBOE',          label: 'Pulling fear & greed index data' },
  { source: 'S&P / SECTORS', label: 'Computing sector z-score distributions' },
  { source: 'WORLD BANK',    label: 'Loading Buffett indicator ratios' },
  { source: 'SENTINEL',      label: 'Calibrating models — almost ready' },
];

const TOTAL_MS = 4200;

export function LoadingScreen({ onComplete }) {
  const [pct, setPct] = useState(0);
  const [sourceIdx, setSourceIdx] = useState(0);
  const [sourceVisible, setSourceVisible] = useState(true);
  const [done, setDone] = useState(false);
  const startRef = useRef(null);
  const rafRef = useRef(null);
  const prevIdxRef = useRef(0);

  useEffect(() => {
    const gridEl = document.getElementById('ls-grid');
    if (gridEl) {
      for (let i = 1; i < 8; i++) {
        const line = document.createElement('div');
        line.className = 'loading-grid-line';
        line.style.top = `${(i / 8) * 100}%`;
        gridEl.appendChild(line);
      }
    }

    const timeout = setTimeout(() => {
      function tick(ts) {
        if (!startRef.current) startRef.current = ts;
        const elapsed = ts - startRef.current;
        const progress = Math.min(1, elapsed / TOTAL_MS);
        const eased = 1 - Math.pow(1 - progress, 2.2);
        const newPct = Math.round(eased * 100);
        setPct(newPct);

        const newIdx = Math.min(SOURCES.length - 1, Math.floor(eased * SOURCES.length));
        if (newIdx !== prevIdxRef.current) {
          prevIdxRef.current = newIdx;
          setSourceVisible(false);
          setTimeout(() => {
            setSourceIdx(newIdx);
            setSourceVisible(true);
          }, 200);
        }

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          setDone(true);
          setTimeout(() => onComplete?.(), 600);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }, 900);

    return () => {
      clearTimeout(timeout);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [onComplete]);

  const today = new Date();
  const monthStr = today.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const dateStr = `SENTINEL v2.1 / ${monthStr} ${String(today.getDate()).padStart(2,'0')}, ${today.getFullYear()}`;

  return (
    <div className="loading-screen">
      <div className="loading-corner loading-corner-tl" />
      <div className="loading-corner loading-corner-tr" />
      <div className="loading-corner loading-corner-bl" />
      <div className="loading-corner loading-corner-br" />

      <div className="loading-scan-wrap">
        <div className="loading-scan-line" />
      </div>
      <div className="loading-grid-lines" id="ls-grid" />

      <div className="loading-top-meta">US Economy &amp; Markets Intelligence</div>

      <div className="loading-wordmark">Sentinel</div>
      <div className="loading-wordmark-sub">Establishing secure data connection</div>

      <div className="loading-data-status">
        <div
          className="loading-status-source"
          style={{
            opacity: sourceVisible ? 1 : 0,
            color: done ? 'var(--pos)' : 'var(--accent)',
          }}
        >
          {done ? 'READY' : SOURCES[sourceIdx].source}
        </div>
        <div
          className="loading-status-label"
          style={{ opacity: sourceVisible ? 1 : 0 }}
        >
          {done ? 'All data sources loaded successfully' : SOURCES[sourceIdx].label}
        </div>
      </div>

      <div className="loading-progress-wrap">
        <div className="loading-progress-fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="loading-progress-readout">{pct}%</div>
      <div className="loading-left-meta">{dateStr}</div>
    </div>
  );
}
