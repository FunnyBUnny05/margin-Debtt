#!/usr/bin/env python3
"""
Fetch CBOE Put/Call Ratio data and convert to JSON for the dashboard.
CBOE provides equity put/call ratio data at: https://www.cboe.com/us/options/market_statistics/
"""

import json
import pandas as pd
import requests
from datetime import datetime
from pathlib import Path
from io import StringIO

# CBOE data endpoints
CBOE_DATA_URL = "https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv"
CBOE_PC_RATIO_URL = "https://cdn.cboe.com/resources/us_indices/dashboard/data.json"
OUTPUT_PATH = Path(__file__).parent.parent / "public" / "put_call_data.json"

def fetch_cboe_putcall_data():
    """Fetch CBOE Put/Call ratio data."""
    print(f"Fetching CBOE Put/Call data...")

    # Try to load existing data first
    existing_data = []
    if OUTPUT_PATH.exists():
        with open(OUTPUT_PATH, 'r') as f:
            existing_json = json.load(f)
            existing_data = existing_json.get('data', [])
            print(f"Loaded {len(existing_data)} existing records")

    # Try multiple sources for Put/Call ratio data
    # Unfortunately, CBOE doesn't provide a simple public API for historical Put/Call ratios
    # The data typically requires scraping or paid data services

    # For now, we'll try to fetch from the CBOE data portal API
    try:
        # This endpoint may require authentication or may not be available
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }

        # Try the CBOE market statistics page
        response = requests.get(
            "https://www.cboe.com/us/options/market_statistics/daily/",
            headers=headers,
            timeout=30
        )

        if response.status_code == 200:
            print("Successfully connected to CBOE market statistics page")
            # The actual scraping would require parsing HTML/JavaScript
            # This is a placeholder that keeps existing data
            print("CBOE Put/Call data requires manual update or paid data feed")
            print("Keeping existing data")

    except Exception as e:
        print(f"Error fetching CBOE data: {e}")
        print("Keeping existing data")

    # Return existing data with updated timestamp
    output = {
        'last_updated': datetime.utcnow().isoformat() + 'Z',
        'source': 'CBOE Equity Put/Call Ratio',
        'source_url': 'https://www.cboe.com/tradable_products/sp_500/put-call_ratio/',
        'data': existing_data,
        'note': 'CBOE Put/Call ratio data requires manual updates or paid data feed access'
    }

    return output

def main():
    try:
        data = fetch_cboe_putcall_data()

        # Ensure output directory exists
        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

        # Write JSON
        with open(OUTPUT_PATH, 'w') as f:
            json.dump(data, f, indent=2)

        if data['data']:
            latest = data['data'][-1]
            print(f"Latest data: {latest['date']} - Ratio: {latest['ratio']}")
        print(f"Total records: {len(data['data'])}")
        print(f"Output: {OUTPUT_PATH}")

    except Exception as e:
        print(f"Error in CBOE data fetch: {e}")
        # Keep existing data file if it exists
        if OUTPUT_PATH.exists():
            print("Keeping existing data file")
        else:
            raise

if __name__ == '__main__':
    main()
