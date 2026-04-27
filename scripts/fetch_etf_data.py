#!/usr/bin/env python3
"""
Pre-fetch weekly ETF price data for all sector ETFs and benchmarks.
Runs server-side in GitHub Actions (no CORS issues), saving to public/etf_data.json
so the frontend can load data instantly without hitting external APIs.
"""

import csv
import json
import sys
import time
import requests
from datetime import datetime, timedelta
from io import StringIO
from pathlib import Path

# All symbols the frontend needs (sector ETFs + benchmarks)
SYMBOLS = [
    'XLE', 'XLU', 'IGV', 'XLK', 'XLV', 'CIBR', 'XLF', 'TAN', 'XLP',  # sector ETFs
    'SPY', 'QQQ', 'IWM', 'DIA',                                          # benchmarks
]

OUTPUT_PATH = Path(__file__).parent.parent / "public" / "etf_data.json"
YEARS_OF_HISTORY = 25

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/csv,text/plain,*/*',
}


def fetch_yahoo_csv(symbol: str) -> list:
    """Fetch weekly adjusted close prices from Yahoo Finance v7 download endpoint."""
    end_ts = int(datetime.utcnow().timestamp())
    start_ts = int((datetime.utcnow() - timedelta(days=YEARS_OF_HISTORY * 365)).timestamp())

    url = (
        f"https://query1.finance.yahoo.com/v7/finance/download/{symbol}"
        f"?period1={start_ts}&period2={end_ts}"
        f"&interval=1wk&events=history&includeAdjustedClose=true"
    )

    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()

    content_type = resp.headers.get('content-type', '')
    if 'text/html' in content_type and 'csv' not in content_type:
        raise ValueError(f"Got HTML response (possibly rate limited) for {symbol}")

    reader = csv.DictReader(StringIO(resp.text))
    prices = []
    for row in reader:
        try:
            adj_close_raw = row.get('Adj Close') or row.get('Close') or ''
            adj_close = float(adj_close_raw)
            date_str = row['Date'][:10]  # Ensure YYYY-MM-DD
            prices.append({'date': date_str, 'price': round(adj_close, 4)})
        except (ValueError, KeyError, TypeError):
            continue

    if len(prices) < 50:
        raise ValueError(f"Too few rows ({len(prices)}) for {symbol} — likely invalid data")

    return sorted(prices, key=lambda x: x['date'])


def fetch_yahoo_v8(symbol: str) -> list:
    """Fallback: use Yahoo Finance v8 JSON chart API."""
    end_ts = int(datetime.utcnow().timestamp())
    start_ts = int((datetime.utcnow() - timedelta(days=YEARS_OF_HISTORY * 365)).timestamp())

    url = (
        f"https://query2.finance.yahoo.com/v8/finance/chart/{symbol}"
        f"?period1={start_ts}&period2={end_ts}&interval=1wk"
    )

    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()

    data = resp.json()
    result = data.get('chart', {}).get('result', [None])[0]
    if not result:
        raise ValueError(f"No chart result for {symbol}")

    timestamps = result.get('timestamp', [])
    adj_close = (
        result.get('indicators', {}).get('adjclose', [{}])[0].get('adjclose')
        or result.get('indicators', {}).get('quote', [{}])[0].get('close')
    )

    if not timestamps or not adj_close:
        raise ValueError(f"Missing timestamps or prices for {symbol}")

    prices = []
    for ts, price in zip(timestamps, adj_close):
        if price is not None:
            date_str = datetime.utcfromtimestamp(ts).strftime('%Y-%m-%d')
            prices.append({'date': date_str, 'price': round(price, 4)})

    if len(prices) < 50:
        raise ValueError(f"Too few rows ({len(prices)}) for {symbol}")

    return sorted(prices, key=lambda x: x['date'])


def fetch_symbol(symbol: str) -> list:
    """Try Yahoo v7 CSV first, then v8 JSON fallback."""
    try:
        return fetch_yahoo_csv(symbol)
    except Exception as e:
        print(f"    v7 CSV failed for {symbol}: {e} — trying v8 JSON...")
        return fetch_yahoo_v8(symbol)


def load_existing_data() -> dict:
    """Load previously fetched data to use as fallback for failed symbols."""
    if not OUTPUT_PATH.exists():
        return {}
    try:
        with open(OUTPUT_PATH) as f:
            return json.load(f).get('data', {})
    except Exception:
        return {}


def main():
    print(f"Fetching weekly ETF data for {len(SYMBOLS)} symbols...")
    existing = load_existing_data()
    results = {}
    failed = []

    for i, symbol in enumerate(SYMBOLS):
        if i > 0:
            time.sleep(1.0)  # Polite delay between requests

        success = False
        for attempt in range(3):
            try:
                prices = fetch_symbol(symbol)
                results[symbol] = prices
                print(f"  {symbol}: OK — {len(prices)} bars, latest {prices[-1]['date']}")
                success = True
                break
            except Exception as e:
                wait = 2 ** attempt
                print(f"  {symbol}: attempt {attempt + 1}/3 failed — {e}")
                if attempt < 2:
                    time.sleep(wait)

        if not success:
            failed.append(symbol)
            if symbol in existing:
                results[symbol] = existing[symbol]
                print(f"  {symbol}: using cached data ({len(existing[symbol])} bars)")
            else:
                print(f"  {symbol}: no cached data available")

    if not results:
        print("ERROR: No data fetched for any symbol. Exiting.")
        sys.exit(1)

    output = {
        'last_updated': datetime.utcnow().isoformat() + 'Z',
        'symbols_fetched': len(results),
        'symbols_failed': failed,
        'data': results,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, 'w') as f:
        # Compact JSON — no extra whitespace to keep file size small
        json.dump(output, f, separators=(',', ':'))

    size_kb = OUTPUT_PATH.stat().st_size / 1024
    print(f"\nWrote {OUTPUT_PATH} ({size_kb:.0f} KB)")
    print(f"Symbols OK: {len(results) - len(failed)}/{len(SYMBOLS)}")

    if failed:
        print(f"Symbols that failed (using cache): {', '.join(failed)}")

    # Fail the CI step only if more than half of symbols are missing entirely
    truly_missing = [s for s in failed if s not in existing]
    if len(truly_missing) > len(SYMBOLS) // 2:
        print(f"ERROR: {len(truly_missing)} symbols have no data at all.")
        sys.exit(1)


if __name__ == '__main__':
    main()
