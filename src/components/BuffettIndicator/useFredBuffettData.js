/**
 * useFredBuffettData
 *
 * Loads the Buffett Indicator dataset from the static JSON produced by the
 * weekly CI job (scripts/fetch_buffett_indicator.py). That script pulls the
 * raw WILL5000INDFC and GDP series from FRED and runs the log-linear
 * regression itself — the ratio/trend/σ-bands are a local calculation, not a
 * value pulled pre-computed from a site.
 *
 * A prior version of this hook also tried fetching the raw FRED CSVs
 * directly from the browser to recompute the same regression client-side.
 * FRED's fredgraph.csv endpoint doesn't send CORS headers for cross-origin
 * requests, so that fetch failed silently on every load and this hook always
 * ended up on the static-JSON fallback anyway — it added latency and
 * complexity without ever actually running in a browser.
 *
 * Returns { biData, biStatus }
 *   biStatus: 'loading' | 'loaded' | 'error'
 */

import { useState, useEffect } from 'react';

export const useFredBuffettData = () => {
  const [biData, setBiData]     = useState(null);
  const [biStatus, setBiStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;

    fetch('./buffett_indicator_data.json')
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (cancelled) return;
        if (json) {
          setBiData(json);
          setBiStatus('loaded');
        } else {
          setBiStatus('error');
        }
      })
      .catch(() => {
        if (!cancelled) setBiStatus('error');
      });

    return () => { cancelled = true; };
  }, []);

  return { biData, biStatus };
};
