#!/usr/bin/env python3
"""
Fetch AAII Asset Allocation Survey data automatically from multiple sources.

Data sources (tried in order):
1. MacroMicro.me - chart page embedded data / chart data API
2. MacroMicro.me - individual series pages
3. AAII website - public page scraping
4. Fallback - preserve existing historical data

MacroMicro series IDs:
  - Stocks: 7363
  - Bonds:  7365
  - Cash:   7367
  - Chart:  23218
"""

import json
import re
import time
from datetime import datetime, timedelta
from pathlib import Path

import requests
from bs4 import BeautifulSoup

OUTPUT_PATH = Path(__file__).parent.parent / "public" / "aaii_allocation_data.json"

MACROMICRO_CHART_URL = "https://en.macromicro.me/charts/23218/aaii-asset-allocation-survey"
MACROMICRO_CHART_DATA_URLS = [
    "https://sc.macromicro.me/charts/data/23218",
    "https://en.macromicro.me/charts/data/23218",
]
MACROMICRO_SERIES = {
    "stocks": 7363,
    "bonds": 7365,
    "cash": 7367,
}

AAII_URLS = [
    "https://www.aaii.com/assetallocationsurvey",
    "https://www.aaii.com/latest/updatearchive?category=487",
]

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/121.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_existing_data():
    """Load existing AAII data from the JSON file."""
    if OUTPUT_PATH.exists():
        with open(OUTPUT_PATH, "r") as f:
            data = json.load(f)
        return data.get("data", []), data
    return [], None


def normalize_date(raw):
    """Convert various date formats to YYYY-MM-01."""
    if isinstance(raw, (int, float)):
        # Unix timestamp in milliseconds
        dt = datetime.utcfromtimestamp(raw / 1000)
        return dt.strftime("%Y-%m-01")
    if isinstance(raw, str):
        raw = raw.strip()
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y", "%b %Y", "%B %Y"):
            try:
                dt = datetime.strptime(raw, fmt)
                return dt.strftime("%Y-%m-01")
            except ValueError:
                continue
        # Already looks like a date – just normalise day
        m = re.match(r"(\d{4})-(\d{2})", raw)
        if m:
            return f"{m.group(1)}-{m.group(2)}-01"
    return None


def merge_new_into_existing(existing, new_records):
    """Merge new records into existing data, avoiding duplicates."""
    existing_dates = {r["date"] for r in existing}
    added = 0
    for rec in new_records:
        d = normalize_date(rec["date"])
        if d is None:
            continue
        rec["date"] = d
        if d not in existing_dates:
            existing.append(rec)
            existing_dates.add(d)
            added += 1
    existing.sort(key=lambda x: x["date"])
    return existing, added


# ---------------------------------------------------------------------------
# Source 1: MacroMicro chart page – embedded JSON in HTML
# ---------------------------------------------------------------------------

def fetch_macromicro_embedded(session):
    """Fetch the MacroMicro chart page and extract data embedded in <script> tags."""
    print("  Fetching chart page for embedded data …")
    try:
        resp = session.get(MACROMICRO_CHART_URL, headers=BROWSER_HEADERS, timeout=30)
        if resp.status_code != 200:
            print(f"  Chart page returned {resp.status_code}")
            return None

        html = resp.text

        # MacroMicro often embeds chart data as JSON inside <script> tags.
        # Look for patterns like: chartData = [...] or "series":[...]
        # Also look for __NEXT_DATA__ or similar hydration payloads.

        records = []

        # Pattern 1: __NEXT_DATA__ / Nuxt hydration payload
        next_data_match = re.search(
            r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL
        )
        if next_data_match:
            try:
                payload = json.loads(next_data_match.group(1))
                records = extract_from_nested_json(payload)
                if records:
                    print(f"  Extracted {len(records)} records from __NEXT_DATA__")
                    return records
            except json.JSONDecodeError:
                pass

        # Pattern 2: Look for JSON arrays with date/value pairs in any script tag
        script_tags = re.findall(r"<script[^>]*>(.*?)</script>", html, re.DOTALL)
        for script in script_tags:
            # Look for arrays of [timestamp, value] pairs
            arrays = re.findall(r'\[\s*\[\s*\d{10,13}\s*,\s*[\d.]+\s*\](?:\s*,\s*\[\s*\d{10,13}\s*,\s*[\d.]+\s*\])+\s*\]', script)
            if len(arrays) >= 3:
                try:
                    series_list = [json.loads(a) for a in arrays[:3]]
                    records = build_records_from_series(series_list)
                    if records:
                        print(f"  Extracted {len(records)} records from script arrays")
                        return records
                except (json.JSONDecodeError, ValueError):
                    pass

            # Look for JSON objects with series data
            json_blobs = re.findall(r'\{[^{}]*"series"\s*:\s*\[.*?\]\s*\}', script, re.DOTALL)
            for blob in json_blobs:
                try:
                    data = json.loads(blob)
                    records = extract_from_nested_json(data)
                    if records:
                        print(f"  Extracted {len(records)} records from JSON blob")
                        return records
                except json.JSONDecodeError:
                    pass

        # Pattern 3: Look for stat data in the page
        stat_matches = re.findall(
            r'"stat":\s*(\[.*?\])', html, re.DOTALL
        )
        for match in stat_matches:
            try:
                stat_data = json.loads(match)
                if len(stat_data) >= 3:
                    records = build_records_from_stat(stat_data)
                    if records:
                        print(f"  Extracted {len(records)} records from stat data")
                        return records
            except json.JSONDecodeError:
                pass

        print("  No embedded data found in chart page")
        return None

    except Exception as e:
        print(f"  Error fetching chart page: {e}")
        return None


def extract_from_nested_json(data, depth=0):
    """Recursively search a JSON structure for AAII allocation data."""
    if depth > 10:
        return None

    if isinstance(data, dict):
        # Check if this dict has series/data arrays
        for key in ("series", "data", "chartData", "datasets"):
            if key in data and isinstance(data[key], list):
                series = data[key]
                if len(series) >= 3:
                    records = build_records_from_series_objects(series)
                    if records:
                        return records

        # Recurse into values
        for v in data.values():
            result = extract_from_nested_json(v, depth + 1)
            if result:
                return result

    elif isinstance(data, list):
        # Check if this is a list of series
        if len(data) >= 3 and all(isinstance(item, (list, dict)) for item in data):
            records = build_records_from_series_objects(data)
            if records:
                return records

        for item in data:
            result = extract_from_nested_json(item, depth + 1)
            if result:
                return result

    return None


def build_records_from_series(series_list):
    """Build records from a list of [[timestamp, value], ...] arrays."""
    if len(series_list) < 3:
        return None

    categories = ["stocks", "bonds", "cash"]
    by_date = {}

    for i, series in enumerate(series_list[:3]):
        cat = categories[i]
        for point in series:
            if isinstance(point, list) and len(point) >= 2:
                date = normalize_date(point[0])
                if date:
                    by_date.setdefault(date, {"date": date})[cat] = round(float(point[1]), 2)

    records = [
        r for r in sorted(by_date.values(), key=lambda x: x["date"])
        if all(k in r for k in ("stocks", "bonds", "cash"))
    ]
    return records if len(records) > 10 else None


def build_records_from_series_objects(series_list):
    """Build records from series objects that contain data/values arrays."""
    categories = ["stocks", "bonds", "cash"]
    by_date = {}

    for i, series in enumerate(series_list[:3]):
        cat = categories[i]

        # Extract the actual data points from various possible structures
        points = []
        if isinstance(series, dict):
            for key in ("data", "values", "series"):
                if key in series and isinstance(series[key], list):
                    points = series[key]
                    break
        elif isinstance(series, list):
            points = series

        for point in points:
            date = None
            value = None
            if isinstance(point, list) and len(point) >= 2:
                date, value = point[0], point[1]
            elif isinstance(point, dict):
                date = point.get("date") or point.get("x") or point.get("t")
                value = point.get("val") or point.get("value") or point.get("y")

            if date is not None and value is not None:
                d = normalize_date(date)
                if d:
                    by_date.setdefault(d, {"date": d})[cat] = round(float(value), 2)

    records = [
        r for r in sorted(by_date.values(), key=lambda x: x["date"])
        if all(k in r for k in ("stocks", "bonds", "cash"))
    ]
    return records if len(records) > 10 else None


def build_records_from_stat(stat_data):
    """Build records from MacroMicro 'stat' array format."""
    categories = ["stocks", "bonds", "cash"]
    by_date = {}

    for i, series in enumerate(stat_data[:3]):
        cat = categories[i]
        data_points = []
        if isinstance(series, dict):
            data_points = series.get("data", series.get("values", []))
        elif isinstance(series, list):
            data_points = series

        for point in data_points:
            date = None
            value = None
            if isinstance(point, list) and len(point) >= 2:
                date, value = point[0], point[1]
            elif isinstance(point, dict):
                date = point.get("date", point.get("d"))
                value = point.get("val", point.get("v", point.get("value")))

            if date is not None and value is not None:
                d = normalize_date(date)
                if d:
                    by_date.setdefault(d, {"date": d})[cat] = round(float(value), 2)

    records = [
        r for r in sorted(by_date.values(), key=lambda x: x["date"])
        if all(k in r for k in ("stocks", "bonds", "cash"))
    ]
    return records if len(records) > 10 else None


# ---------------------------------------------------------------------------
# Source 2: MacroMicro chart data API
# ---------------------------------------------------------------------------

def fetch_macromicro_chart_api(session):
    """Try MacroMicro's chart data API endpoints."""
    for url in MACROMICRO_CHART_DATA_URLS:
        print(f"  Trying {url} …")
        try:
            headers = {
                **BROWSER_HEADERS,
                "Accept": "application/json, text/plain, */*",
                "Referer": MACROMICRO_CHART_URL,
            }
            resp = session.get(url, headers=headers, timeout=30)
            if resp.status_code == 200:
                data = resp.json()
                records = extract_from_nested_json(data)
                if records:
                    print(f"  Got {len(records)} records from chart API")
                    return records
                print("  Got response but could not parse records")
            else:
                print(f"  Status {resp.status_code}")
        except Exception as e:
            print(f"  Error: {e}")
    return None


# ---------------------------------------------------------------------------
# Source 3: MacroMicro individual series pages
# ---------------------------------------------------------------------------

def fetch_macromicro_series(session):
    """Try fetching individual series pages and extracting data from HTML."""
    all_series = {}

    for category, series_id in MACROMICRO_SERIES.items():
        page_url = f"https://en.macromicro.me/series/{series_id}/aaii-asset-allocation-survey-{category.replace('stocks', 'stock')}"
        data_urls = [
            f"https://sc.macromicro.me/series/data/{series_id}",
            f"https://en.macromicro.me/series/data/{series_id}",
        ]

        # Try data API first
        for url in data_urls:
            try:
                headers = {
                    **BROWSER_HEADERS,
                    "Accept": "application/json, text/plain, */*",
                    "Referer": page_url,
                }
                resp = session.get(url, headers=headers, timeout=30)
                if resp.status_code == 200:
                    data = resp.json()
                    values = parse_single_series_json(data)
                    if values:
                        all_series[category] = values
                        print(f"  {category}: {len(values)} data points from API")
                        break
            except Exception as e:
                print(f"  {category} API error: {e}")

        # Try page scraping if API failed
        if category not in all_series:
            try:
                resp = session.get(page_url, headers=BROWSER_HEADERS, timeout=30)
                if resp.status_code == 200:
                    values = extract_series_from_html(resp.text)
                    if values:
                        all_series[category] = values
                        print(f"  {category}: {len(values)} data points from page HTML")
            except Exception as e:
                print(f"  {category} page error: {e}")

        time.sleep(1)  # Be polite between requests

    if len(all_series) < 3:
        missing = set(MACROMICRO_SERIES.keys()) - set(all_series.keys())
        print(f"  Missing series: {missing}")
        return None

    return merge_three_series(all_series)


def parse_single_series_json(data):
    """Parse a single series JSON response into {date: value} dict."""
    values = {}
    # Try common structures
    points = []
    if isinstance(data, dict):
        for key in ("data", "series", "values"):
            if key in data and isinstance(data[key], list):
                points = data[key]
                break
    elif isinstance(data, list):
        points = data

    for point in points:
        date = None
        val = None
        if isinstance(point, list) and len(point) >= 2:
            date, val = point[0], point[1]
        elif isinstance(point, dict):
            date = point.get("date") or point.get("d") or point.get("x")
            val = point.get("val") or point.get("value") or point.get("v") or point.get("y")

        if date is not None and val is not None:
            d = normalize_date(date)
            if d:
                values[d] = round(float(val), 2)

    return values if values else None


def extract_series_from_html(html):
    """Extract a single time-series from embedded data in an HTML page."""
    values = {}

    # Look for arrays of [timestamp, value] pairs
    matches = re.findall(
        r'\[\s*\[\s*(\d{10,13})\s*,\s*([\d.]+)\s*\](?:\s*,\s*\[\s*\d{10,13}\s*,\s*[\d.]+\s*\])*\s*\]',
        html,
    )
    for match_str in re.findall(r'\[\s*\[.*?\]\s*\]', html, re.DOTALL):
        try:
            arr = json.loads(match_str)
            if isinstance(arr, list) and len(arr) > 10:
                for item in arr:
                    if isinstance(item, list) and len(item) >= 2:
                        d = normalize_date(item[0])
                        if d:
                            values[d] = round(float(item[1]), 2)
                if values:
                    return values
        except (json.JSONDecodeError, ValueError):
            pass

    # Look for latest value in visible page text
    # e.g. "14.40 %" or "67.90%"
    val_match = re.search(r'class="[^"]*latest[^"]*"[^>]*>.*?([\d.]+)\s*%', html, re.DOTALL)
    if val_match:
        # Only the latest value - not very useful for historical data
        pass

    return values if values else None


def merge_three_series(all_series):
    """Merge stocks, bonds, cash dicts into a list of records."""
    all_dates = set()
    for s in all_series.values():
        all_dates.update(s.keys())

    records = []
    for date in sorted(all_dates):
        if all(date in all_series[cat] for cat in ("stocks", "bonds", "cash")):
            records.append({
                "date": date,
                "stocks": all_series["stocks"][date],
                "bonds": all_series["bonds"][date],
                "cash": all_series["cash"][date],
            })

    return records if len(records) > 10 else None


# ---------------------------------------------------------------------------
# Source 4: AAII website scraping
# ---------------------------------------------------------------------------

def fetch_aaii_website(session):
    """Try to scrape latest allocation data from AAII's public pages."""
    for url in AAII_URLS:
        print(f"  Trying {url} …")
        try:
            resp = session.get(url, headers=BROWSER_HEADERS, timeout=30)
            if resp.status_code != 200:
                print(f"  Status {resp.status_code}")
                continue

            result = parse_aaii_html(resp.text)
            if result:
                return result
        except Exception as e:
            print(f"  Error: {e}")
    return None


def parse_aaii_html(html):
    """Extract latest allocation percentages from AAII HTML."""
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(" ", strip=True)

    # --- Extract the survey month/year ---
    # Pattern: "Results for January 2026" or "Asset Allocation Results for January 2026"
    date_str = None
    date_m = re.search(
        r"Results\s+for\s+(\w+)\s+(\d{4})", text
    )
    if date_m:
        month_name, year = date_m.group(1), date_m.group(2)
        try:
            dt = datetime.strptime(f"{month_name} {year}", "%B %Y")
            date_str = dt.strftime("%Y-%m-01")
        except ValueError:
            pass

    if not date_str:
        # Fallback: assume data is for previous month
        now = datetime.utcnow()
        prev = now.replace(day=1) - timedelta(days=1)
        date_str = prev.strftime("%Y-%m-01")

    # --- Extract allocation totals ---
    # The AAII page shows: "Stocks Total 70.21%" / "Bonds Total 15.37%" / "Cash 14.42%"
    stocks = None
    bonds = None
    cash = None

    # Stocks Total XX.XX%
    stocks_m = re.search(r"Stocks\s+Total\s+([\d.]+)\s*%", text)
    if stocks_m:
        stocks = float(stocks_m.group(1))

    # Bonds Total XX.XX%
    bonds_m = re.search(r"Bonds\s+Total\s+([\d.]+)\s*%", text)
    if bonds_m:
        bonds = float(bonds_m.group(1))

    # Cash XX.XX%
    cash_m = re.search(r"Cash\s+([\d.]+)\s*%", text)
    if cash_m:
        cash = float(cash_m.group(1))

    # Fallback patterns for different page layouts
    if stocks is None:
        m = re.search(r"[Ss]tocks?\s*[:\-–]\s*([\d.]+)\s*%", text)
        if m:
            stocks = float(m.group(1))
    if bonds is None:
        m = re.search(r"[Bb]onds?\s*[:\-–]\s*([\d.]+)\s*%", text)
        if m:
            bonds = float(m.group(1))
    if cash is None:
        m = re.search(r"[Cc]ash\s*[:\-–]\s*([\d.]+)\s*%", text)
        if m:
            cash = float(m.group(1))

    if stocks is not None and bonds is not None and cash is not None:
        total = stocks + bonds + cash
        if 95 <= total <= 105:
            record = {
                "date": date_str,
                "stocks": round(stocks, 1),
                "bonds": round(bonds, 1),
                "cash": round(cash, 1),
            }
            print(f"  Parsed: {date_str} — Stocks {stocks}%, Bonds {bonds}%, Cash {cash}%")
            return [record]

    print("  Could not parse exact allocation numbers from page")
    return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=" * 60)
    print("AAII Asset Allocation Data Fetcher")
    print(f"Time: {datetime.utcnow().isoformat()}Z")
    print("=" * 60)

    existing_data, existing_json = load_existing_data()
    print(f"\nExisting records: {len(existing_data)}")
    if existing_data:
        latest = existing_data[-1]
        print(f"Latest existing:  {latest['date']} — "
              f"Stocks {latest['stocks']}%, Bonds {latest['bonds']}%, Cash {latest['cash']}%")

    new_data = None
    source_method = None

    # Use a session to persist cookies across requests
    session = requests.Session()

    # --- Source 1: MacroMicro embedded data ---
    print("\n[1/4] MacroMicro chart page (embedded data) …")
    new_data = fetch_macromicro_embedded(session)
    if new_data:
        source_method = "macromicro_embedded"

    # --- Source 2: MacroMicro chart data API ---
    if not new_data:
        print("\n[2/4] MacroMicro chart data API …")
        new_data = fetch_macromicro_chart_api(session)
        if new_data:
            source_method = "macromicro_chart_api"

    # --- Source 3: MacroMicro individual series ---
    if not new_data:
        print("\n[3/4] MacroMicro individual series …")
        new_data = fetch_macromicro_series(session)
        if new_data:
            source_method = "macromicro_series"

    # --- Source 4: AAII website ---
    if not new_data:
        print("\n[4/4] AAII website …")
        new_data = fetch_aaii_website(session)
        if new_data:
            source_method = "aaii_website"

    # --- Merge results ---
    if new_data:
        final_data, added = merge_new_into_existing(existing_data, new_data)
        last_updated = datetime.utcnow().isoformat() + "Z"
        print(f"\nMerged {added} new record(s) into dataset")
    else:
        print("\nNo new data from any source — keeping existing data")
        final_data = existing_data
        last_updated = (
            existing_json.get("last_updated") if existing_json
            else datetime.utcnow().isoformat() + "Z"
        )
        source_method = "existing_data"

    # --- Write output ---
    output = {
        "last_updated": last_updated,
        "last_checked": datetime.utcnow().isoformat() + "Z",
        "source": "AAII Asset Allocation Survey",
        "source_url": "https://www.aaii.com/",
        "fetch_method": source_method,
        "data": final_data,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    if final_data:
        latest = final_data[-1]
        print(f"\nLatest data: {latest['date']}")
        print(f"  Stocks: {latest['stocks']}%")
        print(f"  Bonds:  {latest['bonds']}%")
        print(f"  Cash:   {latest['cash']}%")
    print(f"Total records: {len(final_data)}")
    print(f"Fetch method:  {source_method}")
    print(f"Output:        {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
