#!/usr/bin/env python3
"""
Fetch Secured Overnight Financing Rate (SOFR) data from the NY Fed Markets API.

Source: https://markets.newyorkfed.org/api/rates/secured/sofr/
API Docs: https://markets.newyorkfed.org/static/docs/markets-api.html

The NY Fed publishes SOFR each U.S. business day after 8:00 AM ET.
This script fetches all available history (from April 2018 when SOFR was first published).
Output: public/sofr_data.json
"""

import json
import sys
import requests
from datetime import datetime, date, timedelta
from pathlib import Path

# NY Fed Markets API - SOFR endpoint
# /search.json supports date range queries; returns newest-first by default
SOFR_API_BASE = "https://markets.newyorkfed.org/api/rates/secured/sofr"
SOFR_START_DATE = "2018-04-02"  # First SOFR publication date

OUTPUT_PATH = Path(__file__).parent.parent / "public" / "sofr_data.json"
STALE_THRESHOLD_DAYS = 5  # SOFR is daily; warn if data is more than 5 business days old

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}


def fetch_sofr_range(start_date: str, end_date: str) -> list:
    """Fetch SOFR data for a given date range from the NY Fed API."""
    url = f"{SOFR_API_BASE}/search.json?startDate={start_date}&endDate={end_date}"
    print(f"  Fetching: {url}")
    response = requests.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()
    data = response.json()
    return data.get("refRates", [])


def fetch_all_sofr() -> list:
    """
    Fetch the full SOFR history by chunking into yearly batches.
    The NY Fed API handles large ranges fine, but chunking provides
    better progress logging and resilience.
    """
    all_records = []
    today = date.today()
    current_start = datetime.strptime(SOFR_START_DATE, "%Y-%m-%d").date()

    while current_start <= today:
        # Fetch one year at a time
        current_end = min(
            date(current_start.year + 1, current_start.month, current_start.day) - timedelta(days=1),
            today
        )
        start_str = current_start.strftime("%Y-%m-%d")
        end_str = current_end.strftime("%Y-%m-%d")

        try:
            records = fetch_sofr_range(start_str, end_str)
            print(f"    Got {len(records)} records for {start_str} → {end_str}")
            all_records.extend(records)
        except Exception as e:
            print(f"    ERROR fetching {start_str} → {end_str}: {e}")
            raise

        current_start = current_end + timedelta(days=1)

    return all_records


def normalize_records(raw_records: list) -> list:
    """
    Normalize and sort raw API records into clean output format.
    API returns newest-first per batch, so we re-sort ascending.
    """
    seen_dates = set()
    cleaned = []

    for r in raw_records:
        effective_date = r.get("effectiveDate", "")
        if not effective_date or effective_date in seen_dates:
            continue
        seen_dates.add(effective_date)

        rate = r.get("percentRate")
        if rate is None:
            continue

        cleaned.append({
            "date": effective_date,                            # YYYY-MM-DD
            "rate": float(rate),                              # SOFR rate %
            "percentile_1": r.get("percentPercentile1"),      # 1st percentile
            "percentile_25": r.get("percentPercentile25"),    # 25th percentile
            "percentile_75": r.get("percentPercentile75"),    # 75th percentile
            "percentile_99": r.get("percentPercentile99"),    # 99th percentile
            "volume_bn": r.get("volumeInBillions"),           # Transaction volume
        })

    # Sort ascending by date
    cleaned.sort(key=lambda x: x["date"])
    return cleaned


def check_staleness(records: list) -> int:
    """Return approximate business days since the latest data point."""
    if not records:
        return 999
    latest_str = records[-1]["date"]
    latest_date = datetime.strptime(latest_str, "%Y-%m-%d").date()
    # Count calendar days (rough proxy)
    return (date.today() - latest_date).days


def main():
    print("=== SOFR Data Fetcher ===")
    print(f"Source: {SOFR_API_BASE}")
    print(f"Start date: {SOFR_START_DATE}")
    print()

    fetch_succeeded = False
    records = []

    try:
        raw = fetch_all_sofr()
        print(f"\nTotal raw records: {len(raw)}")

        records = normalize_records(raw)
        print(f"Valid normalized records: {len(records)}")

        if not records:
            raise RuntimeError("No valid SOFR records after normalization")

        output = {
            "last_updated": datetime.utcnow().isoformat() + "Z",
            "source": "Federal Reserve Bank of New York — SOFR",
            "source_url": "https://www.newyorkfed.org/markets/reference-rates/sofr",
            "data": records,
        }

        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(OUTPUT_PATH, "w") as f:
            json.dump(output, f, indent=2)

        latest = records[-1]
        print(f"\nSuccess!")
        print(f"  Latest SOFR: {latest['date']} — {latest['rate']}%")
        print(f"  Volume: ${latest['volume_bn']}B")
        print(f"  Total records: {len(records)}")
        print(f"  Output: {OUTPUT_PATH}")
        fetch_succeeded = True

    except Exception as e:
        print(f"\nERROR: Failed to fetch SOFR data: {e}")

        # Fall back to existing data if available
        if OUTPUT_PATH.exists():
            print("Loading existing cached data...")
            with open(OUTPUT_PATH) as f:
                existing = json.load(f)
            records = existing.get("data", [])
            print(f"  Loaded {len(records)} cached records")
        else:
            print("No cached data found. Cannot continue.")
            sys.exit(1)

    # Staleness check
    stale_days = check_staleness(records)
    print(f"\nData staleness: ~{stale_days} calendar days since latest point")

    if stale_days > STALE_THRESHOLD_DAYS:
        print(f"WARNING: Data is {stale_days} days old (threshold: {STALE_THRESHOLD_DAYS})")
        if not fetch_succeeded:
            print("ERROR: Fetch failed and data is stale.")
            sys.exit(1)
    elif not fetch_succeeded:
        print("WARNING: Fetch failed but cached data is recent enough. Keeping cached data.")


if __name__ == "__main__":
    main()
