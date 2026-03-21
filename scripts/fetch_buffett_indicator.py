#!/usr/bin/env python3
"""
Fetch Buffett Indicator data: Total US Market Cap (Wilshire 5000 Full Cap) / GDP.
Data sources (FRED — public CSV, no API key required):
  - WILL5000INDFC: Wilshire 5000 Full Cap Index (billions USD)
  - GDP: Nominal US GDP (billions USD, SAAR, quarterly)
"""

import json
import sys
import numpy as np
import pandas as pd
import requests
from datetime import datetime
from io import StringIO
from pathlib import Path

FRED_WILSHIRE_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=WILL5000INDFC'
FRED_GDP_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=GDP'
OUTPUT_PATH = Path(__file__).parent.parent / 'public' / 'buffett_indicator_data.json'
STALE_THRESHOLD_DAYS = 100  # GDP updates quarterly, so 100 days is fine

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/csv,text/plain,*/*',
}


def fetch_fred_csv(url, label):
    """Fetch a FRED CSV and return a DataFrame indexed by date."""
    print(f"  Fetching {label} from: {url}")
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    df = pd.read_csv(StringIO(r.text))
    # FRED CSV always has two columns: DATE and the series ID
    df.columns = ['date', 'value']
    df['date'] = pd.to_datetime(df['date'])
    df['value'] = pd.to_numeric(df['value'], errors='coerce')  # '.' → NaN
    df = df.dropna(subset=['value'])
    df = df.set_index('date').sort_index()
    print(f"    {label}: {len(df)} observations, latest: {df.index[-1].date()} = {df['value'].iloc[-1]:,.1f}")
    return df


def compute_indicator(wilshire_raw, gdp_raw):
    """Align to quarterly, compute ratio, trend, and SD bands."""
    # Resample Wilshire weekly → quarterly (last value in each quarter)
    wilshire_q = wilshire_raw.resample('QE').last()

    # GDP is quarterly but may be date-stamped on quarter start; resample to QE to align
    gdp_q = gdp_raw.resample('QE').ffill()

    # Inner join on quarter-end dates
    df = pd.DataFrame({
        'wilshire': wilshire_q['value'],
        'gdp': gdp_q['value'],
    }).dropna()

    # Start from 1971-Q1 (when Wilshire 5000 data begins)
    df = df[df.index >= '1971-01-01'].copy()

    if len(df) < 20:
        raise RuntimeError(f"Too few overlapping data points: {len(df)}")

    # Buffett Indicator ratio as a percentage
    df['ratio_pct'] = (df['wilshire'] / df['gdp']) * 100.0

    # Log-linear OLS trend: log(ratio) = a + b*t
    t = np.arange(len(df), dtype=float)
    log_r = np.log(df['ratio_pct'].values)
    coeffs = np.polyfit(t, log_r, 1)
    log_trend = np.polyval(coeffs, t)

    # Standard deviation of log residuals
    residuals = log_r - log_trend
    std_res = float(np.std(residuals, ddof=1))

    # Trend and band values (back-transformed from log scale)
    df['trend_pct'] = np.exp(log_trend)
    df['band_plus1'] = np.exp(log_trend + std_res)
    df['band_plus2'] = np.exp(log_trend + 2.0 * std_res)
    df['band_minus1'] = np.exp(log_trend - std_res)
    df['band_minus2'] = np.exp(log_trend - 2.0 * std_res)

    return df, coeffs, std_res


def compute_current(df, wilshire_raw, gdp_raw, coeffs, std_res):
    """Compute current ratio using the very latest Wilshire value vs most recent GDP."""
    latest_wilshire = float(wilshire_raw['value'].iloc[-1])
    latest_gdp = float(gdp_raw['value'].iloc[-1])
    current_ratio_pct = (latest_wilshire / latest_gdp) * 100.0

    # Project the trend to the current time index
    # Use the last quarterly index + fractional quarters elapsed
    last_q_date = df.index[-1]
    today = datetime.utcnow()
    months_since_last_q = (today.year - last_q_date.year) * 12 + (today.month - last_q_date.month)
    t_current = float(len(df) - 1) + months_since_last_q / 3.0
    log_trend_current = np.polyval(coeffs, t_current)
    trend_current = float(np.exp(log_trend_current))

    # Standard deviations above/below trend (in log space)
    std_devs = (np.log(current_ratio_pct) - log_trend_current) / std_res

    deviation_pct = ((current_ratio_pct - trend_current) / trend_current) * 100.0

    if std_devs > 2.0:
        valuation = 'STRONGLY OVERVALUED'
    elif std_devs > 1.0:
        valuation = 'OVERVALUED'
    elif std_devs > -1.0:
        valuation = 'FAIR VALUE'
    elif std_devs > -2.0:
        valuation = 'UNDERVALUED'
    else:
        valuation = 'STRONGLY UNDERVALUED'

    return {
        'ratio_pct': round(current_ratio_pct, 1),
        'market_cap_billions': round(latest_wilshire, 0),
        'gdp_billions': round(latest_gdp, 0),
        'trend_pct': round(trend_current, 1),
        'deviation_pct': round(deviation_pct, 1),
        'std_devs': round(float(std_devs), 2),
        'valuation': valuation,
    }


def build_output(df, current_info):
    """Build the final JSON-serialisable dict."""
    records = []
    for date, row in df.iterrows():
        records.append({
            'date': date.strftime('%Y-%m-%d'),
            'ratio_pct': round(float(row['ratio_pct']), 2),
            'trend_pct': round(float(row['trend_pct']), 2),
            'band_plus1': round(float(row['band_plus1']), 2),
            'band_plus2': round(float(row['band_plus2']), 2),
            'band_minus1': round(float(row['band_minus1']), 2),
            'band_minus2': round(float(row['band_minus2']), 2),
        })

    return {
        'last_updated': datetime.utcnow().isoformat() + 'Z',
        'source': 'FRED — Wilshire 5000 Full Cap Index (WILL5000INDFC) / GDP',
        'source_urls': [FRED_WILSHIRE_URL, FRED_GDP_URL],
        'current': current_info,
        'data': records,
    }


def check_staleness(data):
    """Return days since the latest data point."""
    latest_date_str = data['data'][-1]['date']
    latest_date = datetime.strptime(latest_date_str[:10], '%Y-%m-%d')
    return max((datetime.utcnow() - latest_date).days - 30, 0)


def main():
    fetch_succeeded = False
    data = None

    try:
        print("Fetching Buffett Indicator data from FRED...")
        wilshire_raw = fetch_fred_csv(FRED_WILSHIRE_URL, 'Wilshire 5000 Full Cap')
        gdp_raw = fetch_fred_csv(FRED_GDP_URL, 'US GDP')

        df, coeffs, std_res = compute_indicator(wilshire_raw, gdp_raw)
        current_info = compute_current(df, wilshire_raw, gdp_raw, coeffs, std_res)
        data = build_output(df, current_info)
        fetch_succeeded = True

        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(OUTPUT_PATH, 'w') as f:
            json.dump(data, f, indent=2)

        print(f"Success!")
        print(f"  Current Buffett Indicator: {current_info['ratio_pct']}%")
        print(f"  Market Cap: ${current_info['market_cap_billions']:,.0f}B")
        print(f"  GDP: ${current_info['gdp_billions']:,.0f}B")
        print(f"  Trend: {current_info['trend_pct']}%")
        print(f"  Deviation: {current_info['deviation_pct']:+.1f}%  ({current_info['std_devs']:+.2f}σ)")
        print(f"  Valuation: {current_info['valuation']}")
        print(f"  Quarterly records: {len(data['data'])}")
        print(f"  Output: {OUTPUT_PATH}")

    except Exception as e:
        print(f"ERROR: Failed to fetch Buffett Indicator data: {e}")
        if OUTPUT_PATH.exists():
            print("Loading existing data to check staleness...")
            with open(OUTPUT_PATH) as f:
                data = json.load(f)
        else:
            print("No existing data file found. Cannot continue.")
            sys.exit(1)

    # Staleness check
    if data and data.get('data'):
        stale_days = check_staleness(data)
        print(f"Data staleness: ~{stale_days} days since latest quarterly data point")
        if stale_days > STALE_THRESHOLD_DAYS:
            print(f"WARNING: Data is {stale_days} days stale (threshold: {STALE_THRESHOLD_DAYS})")
            if not fetch_succeeded:
                print("ERROR: Fetch failed and data is stale. Exiting with error.")
                sys.exit(1)
        elif not fetch_succeeded:
            print("WARNING: Fetch failed but existing data is still recent. Keeping cached data.")


if __name__ == '__main__':
    main()
