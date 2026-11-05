#!/usr/bin/env python3
"""
Snapshot weekly adjusted closes for every Sector Z-Score ETF and benchmark into
public/sector_prices.json.

Why: the browser can't call Yahoo Finance directly (no CORS), so the dashboard used
to go through public CORS proxies one symbol at a time — slow and flaky. Fetching
server-side in the weekly GitHub Action makes the tab load from a single static file.

Keep SYMBOLS in sync with src/components/SectorZScore/constants.js.
"""

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

OUTPUT_PATH = Path(__file__).parent.parent / "public" / "sector_prices.json"

SECTORS = ["XLE", "XLU", "IGV", "XLK", "XLV", "CIBR", "XLF", "TAN", "XLP", "SOXX"]
BENCHMARKS = ["SPY", "QQQ", "IWM", "DIA"]
SYMBOLS = BENCHMARKS + SECTORS

YEARS = 25
URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; margin-debt-tracker data job)"}


def fetch_symbol(symbol: str, attempts: int = 4) -> dict:
    end = int(time.time())
    start = end - YEARS * 365 * 24 * 3600
    params = {"period1": start, "period2": end, "interval": "1wk", "events": "div,splits"}
    last_err = None
    for i in range(attempts):
        try:
            res = requests.get(URL.format(symbol=symbol), params=params, headers=HEADERS, timeout=30)
            res.raise_for_status()
            result = res.json()["chart"]["result"][0]
            timestamps = result["timestamp"]
            adj = (result["indicators"].get("adjclose") or [{}])[0].get("adjclose") \
                or result["indicators"]["quote"][0]["close"]

            dates, prices = [], []
            for ts, px in zip(timestamps, adj):
                if px is None:
                    continue
                d = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")
                if dates and d == dates[-1]:  # Yahoo sometimes repeats the current week
                    prices[-1] = round(px, 4)
                    continue
                dates.append(d)
                prices.append(round(px, 4))
            if len(prices) < 52:
                raise ValueError(f"only {len(prices)} weekly points")
            return {"dates": dates, "prices": prices}
        except Exception as e:
            last_err = e
            time.sleep(2 ** (i + 1))
    raise RuntimeError(f"{symbol}: {last_err}")


def main() -> int:
    existing = {}
    if OUTPUT_PATH.exists():
        existing = json.loads(OUTPUT_PATH.read_text()).get("symbols", {})

    symbols, failed = {}, []
    for sym in SYMBOLS:
        try:
            symbols[sym] = fetch_symbol(sym)
            s = symbols[sym]
            print(f"{sym:5s} {len(s['prices']):5d} weeks  {s['dates'][0]} → {s['dates'][-1]}  last={s['prices'][-1]}")
        except Exception as e:
            failed.append(sym)
            print(f"{sym:5s} FAILED: {e}")
            if sym in existing:  # keep last good copy rather than dropping the symbol
                symbols[sym] = existing[sym]
                print(f"{sym:5s} keeping previous snapshot (to {existing[sym]['dates'][-1]})")

    if not symbols:
        print("ERROR: nothing fetched; leaving existing file untouched")
        return 1

    out = {
        "last_updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "Yahoo Finance (weekly adjusted close)",
        "interval": "1wk",
        "symbols": symbols,
    }
    OUTPUT_PATH.write_text(json.dumps(out, separators=(",", ":")))
    print(f"Wrote {OUTPUT_PATH} ({OUTPUT_PATH.stat().st_size / 1024:.0f} KB), failed: {failed or 'none'}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
