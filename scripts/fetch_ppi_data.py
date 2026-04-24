#!/usr/bin/env python3
"""
Fetch Producer Price Index (PPI) - Final Demand data from the BLS Public API.

Source: https://www.bls.gov/charts/producer-price-index/final-demand-1-month-percent-change.htm
BLS API: https://api.bls.gov/publicAPI/v1/timeseries/data/

Series fetched:
  WPUFD4     = PPI Final Demand (not seasonally adjusted)
  WPUFD49104 = PPI Final Demand (seasonally adjusted)

The BLS public API (no key) allows:
  - Up to 25 series per request
  - Up to 20 years per request (2 chunks needed for 2010→today)

Output: public/ppi_data.json
"""

import json
import sys
import requests
from datetime import datetime, date
from pathlib import Path

BLS_API_URL = "https://api.bls.gov/publicAPI/v1/timeseries/data/"
SERIES_UNADJ = "WPUFD4"       # PPI Final Demand, Not Seasonally Adjusted
SERIES_ADJ   = "WPUFD49104"   # PPI Final Demand, Seasonally Adjusted
START_YEAR   = 2009            # BLS started publishing PPI Final Demand in Nov 2009
CHUNK_YEARS  = 10             # BLS API v1 free tier cap is 10 years per request
OUTPUT_PATH  = Path(__file__).parent.parent / "public" / "ppi_data.json"

HEADERS = {
    "User-Agent": "margin-debt-tracker/1.0 (data@example.com)",
    "Content-Type": "application/json",
}


def fetch_bls_chunk(series_ids: list, start_year: int, end_year: int) -> dict:
    """Fetch one chunk from the BLS API, returns dict keyed by seriesID -> list of points."""
    payload = {
        "seriesid": series_ids,
        "startyear": str(start_year),
        "endyear": str(end_year),
    }
    print(f"  Fetching {series_ids} for {start_year}–{end_year}...")
    r = requests.post(BLS_API_URL, json=payload, headers=HEADERS, timeout=30)
    r.raise_for_status()
    data = r.json()

    if data.get("status") not in ("REQUEST_SUCCEEDED", "200"):
        msgs = data.get("message", [])
        raise RuntimeError(f"BLS API error: {msgs}")

    result = {}
    for s in data.get("Results", {}).get("series", []):
        result[s["seriesID"]] = s.get("data", [])
    return result


def bls_point_to_date(point: dict) -> str:
    """Convert BLS period ('M03', 'M12') + year to YYYY-MM string."""
    year = point["year"]
    period = point["period"]   # e.g. 'M01' .. 'M12'
    if not period.startswith("M"):
        return None  # skip annual / quarterly markers
    month = period[1:]  # strip 'M'
    return f"{year}-{month.zfill(2)}"


def fetch_all_ppi() -> tuple[list, list]:
    """
    Returns (unadj_records, adj_records) sorted ascending by date.
    Fetches in chunks to respect the 20-year BLS API limit.
    """
    current_year = date.today().year
    chunks = []
    y = START_YEAR
    while y <= current_year:
        chunks.append((y, min(y + CHUNK_YEARS - 1, current_year)))
        y += CHUNK_YEARS

    raw_unadj: dict[str, float] = {}  # date -> index value
    raw_adj:   dict[str, float] = {}

    for start, end in chunks:
        chunk = fetch_bls_chunk([SERIES_UNADJ, SERIES_ADJ], start, end)
        for pt in chunk.get(SERIES_UNADJ, []):
            d = bls_point_to_date(pt)
            if d:
                raw_unadj[d] = float(pt["value"])
        for pt in chunk.get(SERIES_ADJ, []):
            d = bls_point_to_date(pt)
            if d:
                raw_adj[d] = float(pt["value"])

    # Sort ascending
    sorted_unadj = sorted(raw_unadj.items())
    sorted_adj   = sorted(raw_adj.items())

    return sorted_unadj, sorted_adj


def compute_changes(sorted_pairs: list) -> list:
    """
    Given [(date, index_value), ...] sorted ascending,
    compute MoM % change and YoY % change.
    """
    records = []
    date_map = {d: v for d, v in sorted_pairs}
    dates = [d for d, _ in sorted_pairs]

    for i, (d, val) in enumerate(sorted_pairs):
        # MoM change
        prev_date = dates[i - 1] if i > 0 else None
        prev_val  = date_map.get(prev_date) if prev_date else None
        mom = round((val / prev_val - 1) * 100, 3) if prev_val else None

        # YoY: find the date 12 months back
        y, m = d.split("-")
        yoy_date = f"{int(y)-1}-{m}"
        yoy_val  = date_map.get(yoy_date)
        yoy = round((val / yoy_val - 1) * 100, 3) if yoy_val else None

        records.append({
            "date":  d,
            "index": round(val, 3),
            "mom":   mom,
            "yoy":   yoy,
        })

    return records


def main():
    print("=== PPI Final Demand Fetcher ===")
    print(f"Source: {BLS_API_URL}")
    print(f"Series: {SERIES_UNADJ} (unadj), {SERIES_ADJ} (seasonally adj)")
    print()

    fetch_succeeded = False

    try:
        unadj_pairs, adj_pairs = fetch_all_ppi()
        print(f"\nRaw records: unadj={len(unadj_pairs)}, adj={len(adj_pairs)}")

        unadj_records = compute_changes(unadj_pairs)
        adj_records   = compute_changes(adj_pairs)

        if not unadj_records:
            raise RuntimeError("No PPI records after processing")

        output = {
            "last_updated": datetime.utcnow().isoformat() + "Z",
            "source":       "U.S. Bureau of Labor Statistics — PPI Final Demand",
            "source_url":   "https://www.bls.gov/ppi/",
            "series": {
                SERIES_UNADJ: {
                    "label":       "PPI Final Demand (NSA)",
                    "description": "Not Seasonally Adjusted",
                    "data":        unadj_records,
                },
                SERIES_ADJ: {
                    "label":       "PPI Final Demand (SA)",
                    "description": "Seasonally Adjusted",
                    "data":        adj_records,
                },
            },
        }

        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(OUTPUT_PATH, "w") as f:
            json.dump(output, f, indent=2)

        latest = unadj_records[-1]
        print(f"\nSuccess!")
        print(f"  Latest (unadj): {latest['date']} — index={latest['index']}, MoM={latest['mom']}%, YoY={latest['yoy']}%")
        print(f"  Total records:  {len(unadj_records)} (unadj), {len(adj_records)} (adj)")
        print(f"  Output: {OUTPUT_PATH}")
        fetch_succeeded = True

    except Exception as e:
        print(f"\nERROR: {e}")
        if OUTPUT_PATH.exists():
            print("Keeping existing cached data.")
        else:
            print("No cached data. Cannot continue.")
            sys.exit(1)

    if not fetch_succeeded and OUTPUT_PATH.exists():
        print("WARNING: Fetch failed, using cached data.")


if __name__ == "__main__":
    main()
