#!/usr/bin/env python3
"""
Fetch FINRA margin statistics and convert to JSON for the dashboard.
FINRA publishes data at: https://www.finra.org/investors/learn-to-invest/advanced-investing/margin-statistics
Excel download: https://www.finra.org/sites/default/files/2021-03/margin-statistics.xlsx
"""

import json
import sys
import pandas as pd
import requests
from datetime import datetime
from io import BytesIO
from pathlib import Path
from bs4 import BeautifulSoup

try:
    import cloudscraper
    _CLOUDSCRAPER_AVAILABLE = True
except ImportError:
    _CLOUDSCRAPER_AVAILABLE = False

# Primary page for investor-facing margin statistics
FINRA_LANDING_URL = "https://www.finra.org/investors/learn-to-invest/advanced-investing/margin-statistics"
# Known working Excel URL (contains all historical data through the latest published month)
FINRA_EXCEL_URL = "https://www.finra.org/sites/default/files/2021-03/margin-statistics.xlsx"
OUTPUT_PATH = Path(__file__).parent.parent / "public" / "margin_data.json"
STALE_THRESHOLD_DAYS = 65  # FINRA publishes monthly data with ~4-8 week lag

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/html,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.finra.org/investors/learn-to-invest/advanced-investing/margin-statistics',
}


def make_session():
    """Return a cloudscraper session (bypasses Cloudflare) or fall back to requests."""
    if _CLOUDSCRAPER_AVAILABLE:
        print("  Using cloudscraper (Cloudflare bypass)")
        return cloudscraper.create_scraper(
            browser={'browser': 'chrome', 'platform': 'windows', 'mobile': False}
        )
    print("  cloudscraper not available — falling back to requests")
    s = requests.Session()
    s.headers.update(HEADERS)
    return s


def discover_finra_urls():
    """Scrape the FINRA margin statistics page to find current download links."""
    print(f"Discovering download URLs from {FINRA_LANDING_URL}")
    try:
        session = make_session()
        # Don't override cloudscraper's internal headers; just add Referer
        extra = {'Referer': FINRA_LANDING_URL} if _CLOUDSCRAPER_AVAILABLE else HEADERS
        response = session.get(FINRA_LANDING_URL, headers=extra, timeout=30)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')

        urls = []
        for link in soup.find_all('a', href=True):
            href = link['href']
            if any(ext in href.lower() for ext in ['.csv', '.xlsx', '.xls']):
                if any(kw in href.lower() for kw in ['margin', 'statistic', 'debit', 'industry']):
                    full_url = href if href.startswith('http') else f"https://www.finra.org{href}"
                    urls.append(full_url)
                    print(f"  Discovered: {full_url}")

        return urls
    except Exception as e:
        print(f"  URL discovery failed: {e}")
        return []


def find_debit_column(df):
    """Find the margin debt (debit balances in margin accounts) column."""
    cols_lower = {c: c.lower() for c in df.columns}

    # Try exact patterns first, then broader ones
    patterns = [
        lambda cl: 'debit' in cl and 'margin' in cl,
        lambda cl: 'debit' in cl and 'balance' in cl,
        lambda cl: 'margin' in cl and 'debt' in cl,
        lambda cl: 'debit' in cl,
    ]
    for pattern in patterns:
        matches = [c for c, cl in cols_lower.items() if pattern(cl)]
        if matches:
            return matches[0]

    raise ValueError(f"Could not find debit/margin column in: {list(df.columns)}")


def find_date_column(df):
    """Find the date column with flexible matching."""
    for col in df.columns:
        cl = col.lower().strip()
        if cl in ('year-month', 'yearmonth', 'year_month', 'date', 'month'):
            return col
    # Fallback: first column that looks like dates
    for col in df.columns:
        sample = str(df[col].iloc[0]) if len(df) > 0 else ''
        if len(sample) >= 6 and '-' in sample:
            return col
    raise ValueError(f"Could not find date column in: {list(df.columns)}")


def try_fetch_excel(url):
    """Attempt to fetch and parse an Excel URL."""
    print(f"  Trying Excel: {url}")
    session = make_session()
    # Don't override cloudscraper's internal headers; just add Referer
    extra = {'Referer': FINRA_LANDING_URL} if _CLOUDSCRAPER_AVAILABLE else HEADERS
    response = session.get(url, headers=extra, timeout=60)
    response.raise_for_status()
    content_type = response.headers.get('content-type', '')
    if 'html' in content_type.lower() and 'spreadsheet' not in content_type.lower():
        raise ValueError("Response is HTML, not Excel")
    if len(response.content) < 1000:
        raise ValueError("Response too small to be a valid spreadsheet")
    df = pd.read_excel(BytesIO(response.content), engine='openpyxl')
    if len(df) < 10:
        raise ValueError(f"Too few rows ({len(df)}), likely not valid data")
    return df


def normalize_date(date_val):
    """Normalize date values to YYYY-MM format string."""
    s = str(date_val).strip()
    # Already in YYYY-MM format
    if len(s) >= 7 and s[4] == '-':
        return s[:7]
    # Try to parse various formats
    for fmt in ('%Y-%m', '%m/%Y', '%Y/%m', '%b-%Y', '%B-%Y'):
        try:
            return datetime.strptime(s, fmt).strftime('%Y-%m')
        except ValueError:
            continue
    return s


def fetch_finra_data():
    """Download and parse FINRA margin statistics Excel file."""
    # Strategy: try discovered URLs first, then the known-working Excel URL
    discovered = discover_finra_urls()

    # Build candidate list: discovered first, then known-working Excel URL
    # Removed dead CSV URL (https://www.finra.org/sites/default/files/Industry_Margin_Statistics.csv)
    candidate_urls = discovered + [FINRA_EXCEL_URL]

    # Deduplicate while preserving order
    seen = set()
    unique_urls = []
    for url in candidate_urls:
        if url not in seen:
            seen.add(url)
            unique_urls.append(url)

    print(f"Trying {len(unique_urls)} candidate URL(s)...")
    last_error = None
    df = None

    for url in unique_urls:
        try:
            df = try_fetch_excel(url)
            print(f"  Success: {url}")
            break
        except Exception as e:
            last_error = e
            print(f"  Failed: {e}")

    if df is None:
        raise RuntimeError(f"All {len(unique_urls)} URL(s) failed. Last error: {last_error}")

    # Clean column names
    df.columns = df.columns.str.strip()

    # Find columns flexibly
    debit_col = find_debit_column(df)
    date_col = find_date_column(df)
    print(f"  Using columns: date='{date_col}', debit='{debit_col}'")

    # Normalize dates and filter valid rows
    df['_date_norm'] = df[date_col].apply(normalize_date)
    df = df[df['_date_norm'].str.match(r'^\d{4}-\d{2}$')].copy()

    # Sort by date ascending (YYYY-MM string sort is chronologically correct)
    df = df.sort_values('_date_norm').reset_index(drop=True)

    # Calculate YoY growth
    df['margin_debt'] = pd.to_numeric(df[debit_col], errors='coerce')
    df = df[df['margin_debt'].notna()].reset_index(drop=True)
    df['yoy_growth'] = df['margin_debt'].pct_change(periods=12) * 100

    # Prepare output records
    records = []
    for _, row in df.iterrows():
        records.append({
            'date': row['_date_norm'],
            'margin_debt': int(row['margin_debt']),
            'yoy_growth': round(float(row['yoy_growth']), 1) if pd.notna(row['yoy_growth']) else None
        })

    if not records:
        raise RuntimeError("Parsed data but got zero valid records")

    latest = records[-1]
    print(f"  Latest data point: {latest['date']} — ${latest['margin_debt']:,}M (YoY: {latest['yoy_growth']}%)")

    output = {
        'last_updated': datetime.utcnow().isoformat() + 'Z',
        'source': 'FINRA Margin Statistics',
        'source_url': FINRA_LANDING_URL,
        'data': records
    }

    return output


def check_staleness(data):
    """Return number of days since the latest data point."""
    latest_date_str = data['data'][-1]['date']  # e.g., "2025-12"
    try:
        latest_date = datetime.strptime(latest_date_str[:7], "%Y-%m")
    except ValueError:
        latest_date = datetime.strptime(latest_date_str[:10], "%Y-%m-%d")
    # FINRA releases monthly data with ~4-6 week lag, so data up to 60 days old is fine
    age_days = (datetime.utcnow() - latest_date).days - 30
    return max(age_days, 0)


def main():
    fetch_succeeded = False
    data = None

    try:
        data = fetch_finra_data()
        fetch_succeeded = True

        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(OUTPUT_PATH, 'w') as f:
            json.dump(data, f, indent=2)

        latest = data['data'][-1]
        print(f"Success! Latest data: {latest['date']} - ${latest['margin_debt']:,}M")
        print(f"YoY Growth: {latest['yoy_growth']}%")
        print(f"Total records: {len(data['data'])}")
        print(f"Output: {OUTPUT_PATH}")

    except Exception as e:
        print(f"ERROR: Failed to fetch FINRA data: {e}")
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
        print(f"Data staleness: ~{stale_days} days since latest data point")

        if stale_days > STALE_THRESHOLD_DAYS:
            print(f"WARNING: Data is {stale_days} days stale (threshold: {STALE_THRESHOLD_DAYS})")
            if not fetch_succeeded:
                print("ERROR: Fetch failed and data is stale. Exiting with error.")
                sys.exit(1)
        elif not fetch_succeeded:
            print("WARNING: Fetch failed but existing data is still recent. Keeping cached data.")


if __name__ == '__main__':
    main()
