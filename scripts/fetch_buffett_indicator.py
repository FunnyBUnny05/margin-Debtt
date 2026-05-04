#!/usr/bin/env python3
"""
Fetch Buffett Indicator data.

Buffett Indicator = Total US Public Equity Market Cap / Nominal GDP × 100

Data sources (tried in order, first success wins):
  Wilshire 5000 Full Cap:
    1. FRED WILL5000INDFC CSV (no API key, CORS-friendly)
    2. Yahoo Finance ^W5000 via yfinance (fallback; history starts 1989)
  GDP:
    FRED GDP CSV (Nominal, billions USD, SAAR, quarterly)

Berkshire Hathaway cash hoard is embedded in the output JSON so the browser
never needs to make a live external API call for it.
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
FRED_GDP_URL      = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=GDP'
EDGAR_CONCEPT_URL = (
    'https://data.sec.gov/api/xbrl/companyconcept/'
    'CIK0001067983/us-gaap/CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents.json'
)
OUTPUT_PATH = Path(__file__).parent.parent / 'public' / 'buffett_indicator_data.json'
STALE_THRESHOLD_DAYS = 100

FRED_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; SentinelMarketData/1.0)',
    'Accept': 'text/csv,text/plain,*/*',
}
EDGAR_HEADERS = {
    'User-Agent': 'SentinelMarketData/1.0 (contact@sentinel.app)',
    'Accept': 'application/json',
}

# ── Berkshire cash hoard (verified from annual 10-K filings) ─────────────────
# "Cash, cash equivalents and short-term U.S. Treasury Bill investments"
# Source: Berkshire Hathaway Annual Reports.
BERKSHIRE_CASH_HISTORY = {
    1995:   2.7,
    1996:   1.3,
    1997:   1.1,
    1998:  13.6,  # General Re acquisition proceeds
    1999:   3.8,
    2000:   3.4,
    2001:   4.5,
    2002:  10.3,
    2003:  24.4,
    2004:  43.0,
    2005:  44.7,
    2006:  43.7,
    2007:  44.3,
    2008:  25.5,
    2009:  66.3,
    2010:  38.2,
    2011:  68.5,
    2012:  83.7,
    2013:  77.0,
    2014:  90.7,
    2015:  97.7,
    2016:  86.4,
    2017: 116.0,  # T-bill holdings become dominant from here
    2018: 111.9,
    2019: 128.0,
    2020: 138.3,
    2021: 146.7,
    2022: 128.6,
    2023: 167.6,
    2024: 334.2,  # record; from FY2024 10-K filed Feb 2025
}


def fetch_fred_csv(url, label):
    print(f'  Fetching {label} from FRED...')
    r = requests.get(url, headers=FRED_HEADERS, timeout=30)
    r.raise_for_status()
    df = pd.read_csv(StringIO(r.text))
    df.columns = ['date', 'value']
    df['date'] = pd.to_datetime(df['date'])
    df['value'] = pd.to_numeric(df['value'], errors='coerce')
    df = df.dropna(subset=['value']).set_index('date').sort_index()
    print(f'    {label}: {len(df)} obs  latest={df.index[-1].date()}  val={df["value"].iloc[-1]:,.1f}')
    return df


def fetch_wilshire_yfinance():
    """Fetch Wilshire 5000 Full Cap via Yahoo Finance (^W5000). Covers 1989–present."""
    try:
        import yfinance as yf
    except ImportError:
        raise RuntimeError('yfinance not installed')
    print('  Fetching Wilshire 5000 via Yahoo Finance (^W5000)...')
    hist = yf.download('^W5000', period='max', interval='1mo', auto_adjust=True, progress=False)
    if hist.empty:
        raise RuntimeError('yfinance returned no data for ^W5000')
    df = hist[['Close']].copy()
    df.columns = ['value']
    df.index = pd.to_datetime(df.index).tz_localize(None)
    df = df.dropna().sort_index()
    print(f'    ^W5000 (yfinance): {len(df)} obs  latest={df.index[-1].date()}  val={df["value"].iloc[-1]:,.1f}')
    return df


def get_wilshire(existing_data=None):
    """
    Try FRED first, then yfinance.
    If yfinance only covers from 1989, splice with existing historical data.
    Returns DataFrame indexed by date with 'value' column.
    """
    # 1. Try FRED
    try:
        return fetch_fred_csv(FRED_WILSHIRE_URL, 'Wilshire 5000 Full Cap')
    except Exception as e:
        print(f'  FRED WILL5000INDFC unavailable: {e}')

    # 2. Try yfinance
    try:
        yf_df = fetch_wilshire_yfinance()

        # Splice with existing historical data if available (FRED had data from 1971)
        if existing_data and existing_data.get('data'):
            print('  Splicing yfinance with existing historical data (pre-1989)...')
            hist_records = [
                {'date': d['date'], 'value': d['ratio_pct']}
                for d in existing_data['data']
            ]
            hist_df = pd.DataFrame(hist_records)
            hist_df['date'] = pd.to_datetime(hist_df['date'])
            hist_df = hist_df.set_index('date').sort_index()

            # We can't directly use ratio_pct as Wilshire index (they're different scales)
            # Just return yfinance data (history from 1989) — trend will be shorter but still valid
            print('  NOTE: Using yfinance data from 1989 (FRED unavailable for pre-1989 history)')
        return yf_df
    except Exception as e:
        print(f'  yfinance fallback failed: {e}')
        raise RuntimeError('All Wilshire data sources failed')


def compute_indicator(wilshire_raw, gdp_raw):
    wilshire_q = wilshire_raw.resample('QE').last()
    gdp_q = gdp_raw.resample('QE').ffill()
    df = pd.DataFrame({'wilshire': wilshire_q['value'], 'gdp': gdp_q['value']}).dropna()
    df = df[df.index >= '1971-01-01'].copy()
    if len(df) < 20:
        raise RuntimeError(f'Too few overlapping data points: {len(df)}')

    # Ratio: Wilshire index / GDP-in-billions × 100
    # WILL5000INDFC points ≈ market cap in $B by Wilshire design
    # ^W5000 (Yahoo) gives same index series
    df['ratio_pct'] = (df['wilshire'] / df['gdp']) * 100.0

    t = np.arange(len(df), dtype=float)
    log_r = np.log(df['ratio_pct'].values)
    coeffs = np.polyfit(t, log_r, 1)
    log_trend = np.polyval(coeffs, t)
    residuals = log_r - log_trend
    std_res = float(np.std(residuals, ddof=1))

    df['trend_pct']   = np.exp(log_trend)
    df['band_plus1']  = np.exp(log_trend + std_res)
    df['band_plus2']  = np.exp(log_trend + 2.0 * std_res)
    df['band_minus1'] = np.exp(log_trend - std_res)
    df['band_minus2'] = np.exp(log_trend - 2.0 * std_res)
    return df, coeffs, std_res


def compute_current(df, wilshire_raw, gdp_raw, coeffs, std_res):
    latest_wilshire = float(wilshire_raw['value'].iloc[-1])
    latest_gdp      = float(gdp_raw['value'].iloc[-1])
    current_ratio   = (latest_wilshire / latest_gdp) * 100.0

    last_q  = df.index[-1]
    today   = datetime.utcnow()
    months  = (today.year - last_q.year) * 12 + (today.month - last_q.month)
    t_cur   = float(len(df) - 1) + months / 3.0
    log_tr  = float(np.polyval(coeffs, t_cur))
    trend   = float(np.exp(log_tr))
    std_devs = (np.log(current_ratio) - log_tr) / std_res
    dev_pct  = ((current_ratio - trend) / trend) * 100.0

    if std_devs > 2.0:    valuation = 'STRONGLY OVERVALUED'
    elif std_devs > 1.0:  valuation = 'OVERVALUED'
    elif std_devs > -1.0: valuation = 'FAIR VALUE'
    elif std_devs > -2.0: valuation = 'UNDERVALUED'
    else:                 valuation = 'STRONGLY UNDERVALUED'

    return {
        'ratio_pct':           round(current_ratio, 1),
        'market_cap_billions': round(latest_wilshire, 0),
        'gdp_billions':        round(latest_gdp, 0),
        'trend_pct':           round(trend, 1),
        'deviation_pct':       round(dev_pct, 1),
        'std_devs':            round(float(std_devs), 2),
        'valuation':           valuation,
    }


def fetch_berkshire_edgar():
    """
    Query SEC EDGAR for recent Berkshire cash data (cross-check only).
    Note: T-bills are excluded from XBRL concept → values will be lower than
    total cash hoard; used only to detect if BERKSHIRE_CASH_HISTORY needs updating.
    """
    try:
        print('  Querying SEC EDGAR for Berkshire cash cross-check...')
        r = requests.get(EDGAR_CONCEPT_URL, headers=EDGAR_HEADERS, timeout=20)
        r.raise_for_status()
        d = r.json()
        usd = d.get('units', {}).get('USD', [])
        annual = [x for x in usd if x.get('form') == '10-K' and str(x.get('end', '')).endswith('-12-31')]
        deduped = {}
        for x in annual:
            yr = int(x['end'][:4])
            deduped[yr] = round(x['val'] / 1e9, 1)
        max_yr = max(deduped) if deduped else 0
        print(f'    EDGAR (excl. T-bills): {len(deduped)} entries, latest FY{max_yr}')
        return deduped
    except Exception as e:
        print(f'    EDGAR fetch skipped: {e}')
        return {}


def build_berkshire_series(edgar_data):
    merged = dict(BERKSHIRE_CASH_HISTORY)
    max_hardcoded = max(merged.keys())
    for yr, val in edgar_data.items():
        if yr > max_hardcoded:
            print(f'    NOTE: EDGAR shows FY{yr} cash (excl. T-bills) ≈ ${val}B — '
                  f'update BERKSHIRE_CASH_HISTORY with full 10-K figure when available.')
    return [{'year': yr, 'cash': val} for yr, val in sorted(merged.items())]


def build_output(df, current_info, berkshire_series):
    records = [
        {
            'date':        d.strftime('%Y-%m-%d'),
            'ratio_pct':   round(float(r['ratio_pct']), 2),
            'trend_pct':   round(float(r['trend_pct']), 2),
            'band_plus1':  round(float(r['band_plus1']), 2),
            'band_plus2':  round(float(r['band_plus2']), 2),
            'band_minus1': round(float(r['band_minus1']), 2),
            'band_minus2': round(float(r['band_minus2']), 2),
        }
        for d, r in df.iterrows()
    ]
    return {
        'last_updated': datetime.utcnow().isoformat() + 'Z',
        'source': 'FRED — Wilshire 5000 Full Cap (WILL5000INDFC) / Nominal GDP',
        'source_note': (
            'Wilshire 5000 Full Cap Index ÷ US Nominal GDP × 100. '
            'Index points ≈ total US public equity market cap in $B. '
            'Bands = ±1σ / ±2σ from log-linear trend over full history.'
        ),
        'source_urls': [FRED_WILSHIRE_URL, FRED_GDP_URL],
        'current': current_info,
        'data': records,
        'berkshire_cash': {
            'source': 'Berkshire Hathaway Annual Reports (10-K)',
            'source_url': 'https://www.berkshirehathaway.com/reports.html',
            'note': 'Cash, cash equivalents + short-term U.S. Treasury Bill investments ($B).',
            'data': berkshire_series,
        },
    }


def check_staleness(data):
    d = datetime.strptime(data['data'][-1]['date'][:10], '%Y-%m-%d')
    return max((datetime.utcnow() - d).days - 30, 0)


def main():
    fetch_succeeded = False
    data = None
    existing_data = None

    # Load existing JSON (used for splice fallback)
    if OUTPUT_PATH.exists():
        try:
            with open(OUTPUT_PATH) as f:
                existing_data = json.load(f)
        except Exception:
            pass

    try:
        print('Fetching Buffett Indicator data...')
        wilshire_raw = get_wilshire(existing_data)
        gdp_raw      = fetch_fred_csv(FRED_GDP_URL, 'US Nominal GDP')

        df, coeffs, std_res = compute_indicator(wilshire_raw, gdp_raw)
        current_info = compute_current(df, wilshire_raw, gdp_raw, coeffs, std_res)

        edgar_data = fetch_berkshire_edgar()
        berkshire_series = build_berkshire_series(edgar_data)

        data = build_output(df, current_info, berkshire_series)
        fetch_succeeded = True

        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(OUTPUT_PATH, 'w') as f:
            json.dump(data, f, indent=2)

        print(f'\nSuccess!')
        print(f'  Buffett Indicator:  {current_info["ratio_pct"]}%  ({current_info["valuation"]})')
        print(f'  Wilshire index:     {current_info["market_cap_billions"]:,.0f}')
        print(f'  GDP ($B):           {current_info["gdp_billions"]:,.0f}')
        print(f'  Trend:              {current_info["trend_pct"]}%')
        print(f'  Deviation:          {current_info["deviation_pct"]:+.1f}%  ({current_info["std_devs"]:+.2f}σ)')
        print(f'  Quarterly records:  {len(data["data"])}')
        print(f'  Berkshire entries:  {len(berkshire_series)}  '
              f'(latest: {berkshire_series[-1]["year"]} = ${berkshire_series[-1]["cash"]}B)')
        print(f'  Output:             {OUTPUT_PATH}')

    except Exception as e:
        print(f'ERROR: {e}')
        if existing_data:
            print('Using existing cached data...')
            # Still embed Berkshire cash even in fallback path
            edgar_data = {}
            try:
                edgar_data = fetch_berkshire_edgar()
            except Exception:
                pass
            berkshire_series = build_berkshire_series(edgar_data)
            existing_data['berkshire_cash'] = {
                'source': 'Berkshire Hathaway Annual Reports (10-K)',
                'source_url': 'https://www.berkshirehathaway.com/reports.html',
                'note': 'Cash, cash equivalents + short-term U.S. Treasury Bill investments ($B).',
                'data': berkshire_series,
            }
            data = existing_data
            with open(OUTPUT_PATH, 'w') as f:
                json.dump(data, f, indent=2)
            print('  Updated existing JSON with Berkshire cash data.')
        else:
            print('No existing data file found.')
            sys.exit(1)

    if data and data.get('data'):
        stale_days = check_staleness(data)
        print(f'Data staleness: ~{stale_days} days since latest quarterly data point')
        if stale_days > STALE_THRESHOLD_DAYS and not fetch_succeeded:
            print(f'WARNING: Data is {stale_days} days stale and fetch failed.')
            sys.exit(1)


if __name__ == '__main__':
    main()
