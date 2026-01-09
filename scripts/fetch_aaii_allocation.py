#!/usr/bin/env python3
"""
Fetch AAII Asset Allocation Survey data and convert to JSON for the dashboard.
AAII publishes data at: https://www.aaii.com/assetallocation
Note: AAII data typically requires membership access
"""

import json
import pandas as pd
import requests
from datetime import datetime
from pathlib import Path
from bs4 import BeautifulSoup
import re

AAII_URL = "https://www.aaii.com/assetallocation"
AAII_MEMBERS_URL = "https://www.aaii.com/sentimentsurvey"
OUTPUT_PATH = Path(__file__).parent.parent / "public" / "aaii_allocation_data.json"

def fetch_aaii_allocation_data():
    """Fetch AAII Asset Allocation Survey data."""
    print(f"Fetching AAII Allocation data from {AAII_URL}")

    # Try to load existing data first
    existing_data = []
    if OUTPUT_PATH.exists():
        with open(OUTPUT_PATH, 'r') as f:
            existing_json = json.load(f)
            existing_data = existing_json.get('data', [])
            print(f"Loaded {len(existing_data)} existing records")

    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

        # Try to fetch the AAII page
        response = requests.get(AAII_URL, headers=headers, timeout=30)

        if response.status_code == 200:
            print("Successfully connected to AAII website")

            # Try to parse any publicly available data
            soup = BeautifulSoup(response.text, 'html.parser')

            # Look for asset allocation data in the page
            # This is a best-effort scraping that may need updates if page structure changes

            # Check if page requires login
            if 'login' in response.text.lower() or 'member' in response.text.lower():
                print("AAII data appears to require member login")
                print("Keeping existing data")
            else:
                # Try to find allocation data in page
                # This would need to be customized based on actual page structure
                print("Page accessible but data extraction needs customization")
                print("Keeping existing data")

        else:
            print(f"Failed to access AAII website: Status {response.status_code}")
            print("Keeping existing data")

    except Exception as e:
        print(f"Error fetching AAII data: {e}")
        print("Keeping existing data")

    # Calculate summary statistics from existing data
    if existing_data:
        df = pd.DataFrame(existing_data)
        avg_stocks = df['stocks'].mean()
        avg_bonds = df['bonds'].mean()
        avg_cash = df['cash'].mean()
        print(f"\nHistorical Averages:")
        print(f"  Stocks: {avg_stocks:.1f}%")
        print(f"  Bonds: {avg_bonds:.1f}%")
        print(f"  Cash: {avg_cash:.1f}%")

    # Return existing data with updated check timestamp
    output = {
        'last_updated': existing_json.get('last_updated', datetime.utcnow().isoformat() + 'Z') if existing_json else datetime.utcnow().isoformat() + 'Z',
        'last_checked': datetime.utcnow().isoformat() + 'Z',
        'source': 'AAII Asset Allocation Survey',
        'source_url': 'https://www.aaii.com/',
        'data': existing_data,
        'note': 'AAII Asset Allocation data requires membership access. Manual updates recommended.'
    }

    return output

def main():
    try:
        data = fetch_aaii_allocation_data()

        # Ensure output directory exists
        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

        # Write JSON
        with open(OUTPUT_PATH, 'w') as f:
            json.dump(data, f, indent=2)

        if data['data']:
            latest = data['data'][-1]
            print(f"\nLatest data: {latest['date']}")
            print(f"  Stocks: {latest['stocks']}%")
            print(f"  Bonds: {latest['bonds']}%")
            print(f"  Cash: {latest['cash']}%")
        print(f"Total records: {len(data['data'])}")
        print(f"Output: {OUTPUT_PATH}")

    except Exception as e:
        print(f"Error in AAII data fetch: {e}")
        # Keep existing data file if it exists
        if OUTPUT_PATH.exists():
            print("Keeping existing data file")
        else:
            raise

if __name__ == '__main__':
    main()
