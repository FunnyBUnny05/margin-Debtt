#!/usr/bin/env python3
"""
Fetch the AAII Asset Allocation Survey history and write it as JSON for the dashboard.

The HTML page (https://www.aaii.com/assetallocation) blocks scripted access, but AAII
publishes the full monthly history as a public spreadsheet:
    https://www.aaii.com/files/surveys/asset.xls

Columns 8-10 of that sheet are the headline totals (Stocks = stock funds + stocks,
Bonds = bond funds + bonds, Cash), stored as fractions (0.701 = 70.1%).

If the download or parse fails, the existing JSON is kept untouched so the dashboard
never loses data.
"""

import io
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import requests

AAII_XLS_URL = "https://www.aaii.com/files/surveys/asset.xls"
OUTPUT_PATH = Path(__file__).parent.parent / "public" / "aaii_allocation_data.json"

# Column positions in the spreadsheet (0-based)
COL_DATE, COL_STOCKS, COL_BONDS, COL_CASH = 0, 8, 9, 10

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
}


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_allocation_xls(content: bytes) -> list[dict]:
    """Turn the AAII spreadsheet into [{date, stocks, bonds, cash}] sorted by date."""
    df = pd.read_excel(io.BytesIO(content), header=None,
                       usecols=[COL_DATE, COL_STOCKS, COL_BONDS, COL_CASH])
    df.columns = ["date", "stocks", "bonds", "cash"]

    # Data rows are the ones whose first column is a real date
    df["date"] = pd.to_datetime(df["date"], errors="coerce", format="mixed")
    df = df.dropna(subset=["date"])
    for col in ("stocks", "bonds", "cash"):
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.dropna(subset=["stocks", "bonds", "cash"])

    # AAII's sheet has year typos (e.g. Feb–Dec 2006 and 2007 are labelled 2005).
    # Rows are in chronological order, so any date that doesn't move forward is
    # repaired to "previous survey month + 1" (month-end).
    fixed_dates = []
    prev = None
    for d in df["date"]:
        if prev is not None and d <= prev:
            d = (prev + pd.offsets.MonthEnd(1)) if prev.is_month_end else (prev + pd.DateOffset(months=1))
        fixed_dates.append(d)
        prev = d
    df["date"] = fixed_dates

    records = []
    for row in df.itertuples(index=False):
        # Sanity check: each share must be a fraction and the three should sum to ~100%
        total = row.stocks + row.bonds + row.cash
        if not (0 < row.stocks < 1 and 0 <= row.bonds < 1 and 0 <= row.cash < 1):
            continue
        if not (0.97 <= total <= 1.03):
            continue
        records.append({
            "date": row.date.strftime("%Y-%m-%d"),
            "stocks": round(row.stocks * 100, 1),
            "bonds": round(row.bonds * 100, 1),
            "cash": round(row.cash * 100, 1),
        })

    # One reading per month (keep the latest if AAII ever duplicates a month)
    by_month = {}
    for r in records:
        by_month[r["date"][:7]] = r
    return [by_month[k] for k in sorted(by_month)]


def download_xls(attempts: int = 5) -> bytes:
    """AAII's bot protection randomly returns 403, so retry with backoff."""
    last_err = None
    for i in range(attempts):
        try:
            res = requests.get(AAII_XLS_URL, headers=HEADERS, timeout=60)
            res.raise_for_status()
            if not res.content.startswith(b"\xd0\xcf\x11\xe0"):  # OLE2 (.xls) magic
                raise ValueError("response is not an .xls file")
            return res.content
        except Exception as e:
            last_err = e
            wait = 2 ** (i + 1)
            print(f"  attempt {i + 1}/{attempts} failed ({e}); retrying in {wait}s")
            time.sleep(wait)
    raise RuntimeError(f"download failed after {attempts} attempts: {last_err}")


def load_existing() -> dict:
    if OUTPUT_PATH.exists():
        with open(OUTPUT_PATH) as f:
            return json.load(f)
    return {}


def main() -> int:
    existing = load_existing()
    existing_data = existing.get("data", [])
    print(f"Existing records: {len(existing_data)}"
          + (f" (latest {existing_data[-1]['date']})" if existing_data else ""))

    try:
        if len(sys.argv) > 2 and sys.argv[1] == "--file":
            # Manual update path: python fetch_aaii_allocation.py --file ~/Downloads/asset.xls
            print(f"Reading {sys.argv[2]}")
            content = Path(sys.argv[2]).read_bytes()
        else:
            print(f"Downloading {AAII_XLS_URL}")
            content = download_xls()
        data = parse_allocation_xls(content)
    except Exception as e:  # network, HTTP, or parse failure
        print(f"ERROR: could not fetch/parse AAII spreadsheet: {e}")
        print("Keeping existing data file unchanged")
        return 1

    # Refuse to shrink the dataset — a truncated download shouldn't wipe history
    if len(data) < max(100, int(len(existing_data) * 0.9)):
        print(f"ERROR: parsed only {len(data)} rows (had {len(existing_data)}); keeping existing data")
        return 1

    latest = data[-1]
    changed = data != existing_data
    output = {
        "last_updated": now_iso() if changed else existing.get("last_updated", now_iso()),
        "last_checked": now_iso(),
        "latest_survey_date": latest["date"],
        "source": "AAII Asset Allocation Survey",
        "source_url": "https://www.aaii.com/assetallocation",
        "data": data,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(f"{'Updated' if changed else 'No change'}: {len(data)} records, "
          f"latest {latest['date']} — stocks {latest['stocks']}%, "
          f"bonds {latest['bonds']}%, cash {latest['cash']}%")
    return 0


if __name__ == "__main__":
    sys.exit(main())
