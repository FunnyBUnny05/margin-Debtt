#!/usr/bin/env python3
"""
Fetch FINRA margin statistics and convert to JSON for the dashboard.
FINRA publishes data at: https://www.finra.org/rules-guidance/key-topics/margin-accounts/margin-statistics
"""

import json
import pandas as pd
import requests
from datetime import datetime
from pathlib import Path

FINRA_URL = "https://www.finra.org/sites/default/files/2021-03/margin-statistics.xlsx"
OUTPUT_PATH = Path(__file__).parent.parent / "public" / "margin_data.json"

def fetch_finra_data():
    """Download and parse FINRA margin statistics Excel file."""
    print(f"Fetching FINRA data from {FINRA_URL}")
    
    # Download Excel file
    response = requests.get(FINRA_URL, timeout=30)
    response.raise_for_status()
    
    # Parse Excel
    df = pd.read_excel(response.content, engine='openpyxl')
    
    # Clean column names
    df.columns = df.columns.str.strip()
    
    # Find the margin debt column (debit balances)
    debit_col = [c for c in df.columns if 'Debit' in c and 'Margin' in c][0]
    
    # Sort by date ascending
    df = df.sort_values('Year-Month').reset_index(drop=True)
    
    # Calculate YoY growth
    df['margin_debt'] = df[debit_col]
    df['yoy_growth'] = df['margin_debt'].pct_change(periods=12) * 100
    
    # Prepare output data
    records = []
    for _, row in df.iterrows():
        if pd.notna(row['margin_debt']):
            record = {
                'date': str(row['Year-Month']),
                'margin_debt': int(row['margin_debt']),
                'yoy_growth': round(row['yoy_growth'], 1) if pd.notna(row['yoy_growth']) else None
            }
            records.append(record)
    
    # Add metadata
    output = {
        'last_updated': datetime.utcnow().isoformat() + 'Z',
        'source': 'FINRA Margin Statistics',
        'source_url': 'https://www.finra.org/rules-guidance/key-topics/margin-accounts/margin-statistics',
        'data': records
    }
    
    return output

def main():
    try:
        data = fetch_finra_data()
        
        # Ensure output directory exists
        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        
        # Write JSON
        with open(OUTPUT_PATH, 'w') as f:
            json.dump(data, f, indent=2)
        
        latest = data['data'][-1]
        print(f"Success! Latest data: {latest['date']} - ${latest['margin_debt']:,}M")
        print(f"YoY Growth: {latest['yoy_growth']}%")
        print(f"Total records: {len(data['data'])}")
        print(f"Output: {OUTPUT_PATH}")
        
    except Exception as e:
        print(f"Error fetching FINRA data: {e}")
        # If fetch fails, try to keep existing data
        if OUTPUT_PATH.exists():
            print("Keeping existing data file")
        else:
            raise

if __name__ == '__main__':
    main()
