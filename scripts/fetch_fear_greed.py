#!/usr/bin/env python3
"""
Fetch Fear & Greed Index directly from CNN's API.
Merges with the whit3rabbit archive (2011-present) for older history.
Output: public/fear_greed_index.json
"""

import json
import sys
import requests
from datetime import datetime, timezone

OUTPUT_FILE = "public/fear_greed_index.json"

CNN_API = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata"
ARCHIVE_URL = "https://raw.githubusercontent.com/whit3rabbit/fear-greed-data/main/fear-greed.csv"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.cnn.com/markets/fear-and-greed",
    "Origin": "https://www.cnn.com",
}

COMPONENT_MAP = {
    "market_momentum_sp500": "momentum",
    "stock_price_strength":  "strength",
    "stock_price_breadth":   "breadth",
    "put_and_call_options":  "put_call",
    "market_volatility_vix": "volatility",
    "junk_bond_demand":      "junk_bond",
    "safe_haven_demand":     "safe_haven",
}


def fetch_cnn():
    r = requests.get(CNN_API, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.json()


def fetch_archive():
    """Historical CNN values from whit3rabbit's archive (2011-present)."""
    r = requests.get(ARCHIVE_URL, timeout=30)
    r.raise_for_status()
    records = {}
    for line in r.text.strip().splitlines()[1:]:
        parts = line.strip().split(",")
        if len(parts) >= 2:
            try:
                records[parts[0].strip()] = round(float(parts[1].strip()), 1)
            except ValueError:
                pass
    return records


def main():
    print("Fetching CNN Fear & Greed Index...")

    # 1. Fetch from CNN API
    try:
        cnn_data = fetch_cnn()
        print("  CNN API: OK")
    except Exception as e:
        print(f"  CNN API failed: {e}", file=sys.stderr)
        sys.exit(1)

    fg_current = cnn_data.get("fear_and_greed", {})
    historical_raw = cnn_data.get("fear_and_greed_historical", {}).get("data", [])

    # CNN historical: [{x: ms_epoch, y: score}, ...]
    cnn_historical = {}
    for point in historical_raw:
        ts = point.get("x", 0)
        score = point.get("y")
        if ts and score is not None:
            date = datetime.fromtimestamp(ts / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
            cnn_historical[date] = round(float(score), 1)
    print(f"  CNN historical: {len(cnn_historical)} points "
          f"({min(cnn_historical) if cnn_historical else '?'} → "
          f"{max(cnn_historical) if cnn_historical else '?'})")

    # 2. Fetch archive for older history
    archive = {}
    try:
        archive = fetch_archive()
        print(f"  Archive:        {len(archive)} points "
              f"({min(archive) if archive else '?'} → {max(archive) if archive else '?'})")
    except Exception as e:
        print(f"  Archive fetch failed: {e}")

    # 3. Merge: archive (2011+) → CNN API (most recent ~1yr, most authoritative)
    # No fallback to old reconstructed data — only real CNN-published values.
    merged = {**archive, **cnn_historical}
    historical = [
        {"date": date, "value": val}
        for date, val in sorted(merged.items())
    ]
    print(f"  Total historical: {len(historical)} points")

    # 4. Extract current component scores
    components = {}
    for api_key, our_key in COMPONENT_MAP.items():
        comp = fg_current.get(api_key, {})
        if comp:
            components[our_key] = {
                "score": round(float(comp.get("score", 0)), 1),
                "rating": comp.get("rating", ""),
            }

    def _f(key, default=0.0):
        v = fg_current.get(key, default)
        try:
            return round(float(v), 1)
        except (TypeError, ValueError):
            return default

    output = {
        "last_updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "current": {
            "score":            _f("score"),
            "rating":           fg_current.get("rating", ""),
            "timestamp":        fg_current.get("timestamp", ""),
            "previous_close":   _f("previous_close"),
            "previous_1_week":  _f("previous_1_week"),
            "previous_1_month": _f("previous_1_month"),
            "previous_1_year":  _f("previous_1_year"),
            "components":       components,
        },
        "historical": historical,
    }

    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, separators=(",", ":"))

    print(f"  Saved → {OUTPUT_FILE}")
    print(f"  Current: {output['current']['score']} ({output['current']['rating']})")


if __name__ == "__main__":
    main()
