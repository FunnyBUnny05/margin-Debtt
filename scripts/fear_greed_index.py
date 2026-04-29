#!/usr/bin/env python3
"""
Fear & Greed Index Calculator
Computes a 0-100 composite sentiment indicator from 7 components.
Output: public/fear_greed_index.csv  (2003-07-01 → present)

=== NORMALIZATION: z-score (not min-max) ===
CNN: "tracks how much each indicator deviates from its average compared to
      how much it normally diverges" — that is textbook z-score.
Min-max is wrecked by a single outlier: the March 2020 COVID VIX spike
compressed every subsequent reading for 2 years inside a 2-year window.
Z-score (rolling 252d, ±2σ clip) is outlier-robust and matches CNN's spec.

=== COMPONENT SPECS ===
  momentum      : SPX vs 125-day SMA                       (CNN exact match)
  strength      : % of 11 SPDR sectors above 50-day SMA    (proxy; CNN uses NYSE 52-wk H/L)
  breadth       : RSP/SPY 20-day return spread              (proxy; CNN uses NYSE McClellan Summation)
  put_call      : CBOE total P/C ratio, 5-day SMA smoothed  (CNN applies ~5d smoothing)
  volatility    : VIX / VIX.rolling(50).mean()              (CNN: "concentrating on 50-day MA")
  credit_spread : ICE BofA HY OAS - IG OAS (or BAA-AAA)    (CNN: junk bond demand)
  safe_haven    : SPX 20d return - TLT 20d return           (CNN exact match)

=== DATA SOURCES ===
  Source              Series                         Coverage
  ──────────────────  ─────────────────────────────  ─────────────
  yfinance            ^GSPC, ^VIX, TLT               1990/2002 → today
  yfinance            RSP (equal-weight SP500)        2003-05 → today
  yfinance            SPY (cap-weight SP500)          1993 → today
  yfinance            XLK,XLF,… (11 sectors)         2002-12 → today
  FRED fredgraph.csv  DAAA, DBAA (Moody's yields)    1983/1986 → today
  FRED fredgraph.csv  BAMLH0A0HYM2, BAMLC0A0CM       ~2005 → today
  CBOE CDN            total.csv (P/C ratio)           1995 → today
                      ↳ fallback: VIX/50MA proxy

Why TLT instead of ^TNX?
  TNX pct_change is dimensionally incomparable to equity returns.
  TLT price returns are directly comparable. TLT inception July 2002.
"""

import json
import warnings
import sys
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
import requests
from io import StringIO
from datetime import date

import yfinance as yf

try:
    import cloudscraper
    HAS_CS = True
except ImportError:
    HAS_CS = False

# ── Configuration ─────────────────────────────────────────────────────────────
FETCH_START  = "1986-01-01"
INDEX_START  = "2003-07-01"   # TLT inception + warm-up; RSP starts 2003-05
TODAY        = date.today().isoformat()
OUTPUT_FILE  = "public/fear_greed_index.csv"
META_FILE    = "public/fear_greed_meta.json"
NORM_WINDOW  = 252            # 1 trading year rolling z-score window
NORM_MIN_PER = 126            # 6 months minimum warm-up
SIGMA_CLIP   = 2.0            # ±2σ clamp → maps to [0, 100]

SECTOR_TICKERS = ["XLK", "XLF", "XLV", "XLY", "XLP", "XLE", "XLI", "XLU", "XLB", "XLRE", "XLC"]


# ── FRED Helper ───────────────────────────────────────────────────────────────
def _fred_csv(series_id: str) -> pd.Series:
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}"
    headers = {"User-Agent": "python-research/1.0", "Accept": "text/csv"}
    r = requests.get(url, timeout=45, headers=headers)
    r.raise_for_status()
    df = pd.read_csv(StringIO(r.text), parse_dates=["observation_date"],
                     index_col="observation_date")
    s = df.iloc[:, 0].replace(".", np.nan).astype(float).dropna()
    s.name = series_id
    return s


# ── Data Fetchers ─────────────────────────────────────────────────────────────
def fetch_market_data() -> dict:
    """Download all yfinance tickers in one call."""
    tickers = ["^GSPC", "^VIX", "TLT", "RSP", "SPY"]
    print(f"  [yfinance] {tickers}")
    raw = yf.download(tickers, start=FETCH_START, end=TODAY,
                      auto_adjust=True, progress=False, threads=True)
    close = raw["Close"] if isinstance(raw.columns, pd.MultiIndex) else raw
    return {t: close[t].dropna() for t in tickers}


def fetch_sector_data() -> pd.DataFrame:
    """Fetch 11 SPDR sector ETFs. XLRE starts 2015, XLC starts 2018 — handled gracefully."""
    print(f"  [yfinance] {SECTOR_TICKERS}")
    raw = yf.download(SECTOR_TICKERS, start=FETCH_START, end=TODAY,
                      auto_adjust=True, progress=False, threads=True)
    close = raw["Close"] if isinstance(raw.columns, pd.MultiIndex) else raw
    return close


def fetch_fred_credit() -> tuple:
    """
    Prefer ICE BofA HY OAS minus IG OAS (true junk spread).
    Falls back to Moody's DBAA-DAAA if FRED returns truncated history (<2000 rows).
    Returns (wide, narrow) — wide widens in stress, narrow is the tighter reference.
    """
    try:
        print("  [FRED] BAMLH0A0HYM2 (ICE BofA HY OAS)…")
        hy = _fred_csv("BAMLH0A0HYM2")
        print(f"         {hy.index[0].date()} → {hy.index[-1].date()}  ({len(hy):,} obs)")
        print("  [FRED] BAMLC0A0CM   (ICE BofA IG OAS)…")
        ig = _fred_csv("BAMLC0A0CM")
        print(f"         {ig.index[0].date()} → {ig.index[-1].date()}  ({len(ig):,} obs)")
        if len(hy) >= 2000 and len(ig) >= 2000:
            print("  → Using ICE BofA HY - IG OAS (true junk spread)")
            return hy, ig
        print(f"  → ICE BofA history too short ({len(hy)}/{len(ig)} rows). Falling back to Moody's.")
    except Exception as e:
        print(f"  → ICE BofA fetch failed ({e}). Falling back to Moody's.")

    print("  [FRED] DAAA, DBAA (Moody's AAA/BAA — IG spread, not true junk)")
    daaa = _fred_csv("DAAA")
    dbaa = _fred_csv("DBAA")
    print(f"  DAAA: {daaa.index[0].date()} → {daaa.index[-1].date()}  ({len(daaa):,} obs)")
    print(f"  DBAA: {dbaa.index[0].date()} → {dbaa.index[-1].date()}  ({len(dbaa):,} obs)")
    return dbaa, daaa


def fetch_cboe_putcall():
    """
    Attempt to fetch CBOE Total Put/Call ratio CSV.
    Works on GitHub Actions / cloud IPs. Returns None if all sources return 403.
    """
    urls = [
        "https://cdn.cboe.com/resources/options/volume_and_call_put_ratios/total.csv",
        "https://www.cboe.com/data/public/options/volume_and_call_put_ratios/total.csv",
    ]
    sessions = [requests.Session()]
    if HAS_CS:
        sessions.append(cloudscraper.create_scraper())

    for sess in sessions:
        for url in urls:
            try:
                if isinstance(sess, requests.Session):
                    sess.headers.update({"User-Agent": "Mozilla/5.0", "Referer": "https://www.cboe.com/"})
                r = sess.get(url, timeout=25)
                if r.status_code != 200 or len(r.content) < 1000:
                    continue
                df = pd.read_csv(StringIO(r.text), skiprows=1, header=0)
                df.columns = df.columns.str.strip().str.lower()
                dcol = next(c for c in df.columns if "date" in c)
                vcol = next(
                    (c for c in df.columns if c != dcol and any(k in c for k in ("total", "p/c", "put"))),
                    [c for c in df.columns if c != dcol][0]
                )
                df[dcol] = pd.to_datetime(df[dcol], errors="coerce")
                s = (df.dropna(subset=[dcol])
                       .set_index(dcol)
                       .sort_index()[vcol]
                       .pipe(pd.to_numeric, errors="coerce")
                       .dropna())
                s.name = "put_call"
                print(f"  [CBOE] {url.split('/')[2]} OK  {s.index[0].date()} → {s.index[-1].date()}  ({len(s):,} obs)")
                return s
            except Exception:
                continue

    print("  [CBOE] All sources returned 403/timeout (IP-blocked locally).", file=sys.stderr)
    return None


# ── Component Computations ────────────────────────────────────────────────────

def comp_momentum(gspc: pd.Series) -> pd.Series:
    """SPX vs 125-day SMA. Higher = greed."""
    sma = gspc.rolling(window=125, min_periods=63).mean()
    return ((gspc - sma) / sma * 100).rename("momentum")


def comp_strength(sectors: pd.DataFrame) -> pd.Series:
    """% of sector ETFs above their 50-day SMA. Higher = broader participation = greed."""
    sma = sectors.rolling(window=50, min_periods=25).mean()
    above = (sectors > sma).astype(float)
    valid = sectors.notna() & sma.notna()
    pct_above = above.where(valid).sum(axis=1) / valid.sum(axis=1).replace(0, np.nan)
    return pct_above.rename("strength")


def comp_breadth(rsp: pd.Series, spy: pd.Series, sectors: pd.DataFrame) -> pd.Series:
    """
    Primary: RSP/SPY 20-day return spread.
    Equal-weight outperforming cap-weight = broad participation = greed.
    RSP starts 2003-05; sector McClellan used as fallback if RSP unavailable.
    """
    if len(rsp) > 500:
        return (rsp.pct_change(20) - spy.pct_change(20)).rename("breadth")
    # Fallback: sector McClellan oscillator
    rets = sectors.pct_change()
    advancing = (rets > 0).sum(axis=1)
    declining  = (rets < 0).sum(axis=1)
    valid_count = sectors.notna().sum(axis=1).replace(0, np.nan)
    net   = (advancing - declining) / valid_count
    ema19 = net.ewm(span=19, adjust=False).mean()
    ema39 = net.ewm(span=39, adjust=False).mean()
    return (ema19 - ema39).rename("breadth")


def comp_putcall(pc: pd.Series) -> pd.Series:
    """CBOE Total P/C ratio, 5-day SMA smoothed. Raw daily spikes (expirations) create false signals."""
    return pc.rolling(5, min_periods=3).mean().rename("put_call")


def comp_putcall_proxy(vix: pd.Series) -> pd.Series:
    """
    Fallback: VIX / 50-day SMA (matches window used in comp_volatility).
    NOTE: when CBOE is blocked, put_call and volatility are correlated (both use VIX/50MA).
    This is flagged in metadata.
    """
    vix_sma = vix.rolling(50, min_periods=25).mean()
    return (vix / vix_sma).where(vix_sma > 0, np.nan).rename("put_call")


def comp_volatility(vix: pd.Series) -> pd.Series:
    """VIX / 50-day SMA. CNN stated spec: 'concentrating on a 50-day moving average'."""
    vix_ma50 = vix.rolling(window=50, min_periods=25).mean()
    return (vix / vix_ma50).where(vix_ma50 > 0, np.nan).rename("volatility")


def comp_credit_spread(wide: pd.Series, narrow: pd.Series) -> pd.Series:
    """Wide spread minus narrow spread. Widens during fear (credit stress), tightens during greed."""
    return (wide - narrow).rename("credit_spread")


def comp_safe_haven(gspc: pd.Series, tlt: pd.Series) -> pd.Series:
    """20-day SPX return minus 20-day TLT return. Higher = equity outperformance = greed."""
    return (gspc.pct_change(20) - tlt.pct_change(20)).rename("safe_haven")


# ── Normalization ─────────────────────────────────────────────────────────────

def normalize(s: pd.Series, invert: bool = False) -> pd.Series:
    """
    Rolling z-score normalization, clamped at ±SIGMA_CLIP, mapped to [0, 100].

    Replaces min-max: one outlier (COVID March 2020 VIX spike) stretched the
    2-year min-max window and compressed every subsequent reading for 2 years,
    making 2022 bear market readings appear as GREED. Z-score is outlier-robust.

    ±2σ clip: observations >2σ from rolling mean map to 0 or 100.
    """
    mu   = s.rolling(window=NORM_WINDOW, min_periods=NORM_MIN_PER).mean()
    sd   = s.rolling(window=NORM_WINDOW, min_periods=NORM_MIN_PER).std()
    z    = (s - mu) / sd.replace(0, np.nan)
    z    = z.clip(-SIGMA_CLIP, SIGMA_CLIP)
    norm = (z + SIGMA_CLIP) / (2 * SIGMA_CLIP) * 100
    if invert:
        norm = 100 - norm
    return norm.clip(0, 100)


# ── Alignment ─────────────────────────────────────────────────────────────────

def align(raw: dict, master_idx: pd.DatetimeIndex) -> dict:
    """Reindex all series to master trading-day index; ffill, then bfill only leading NaNs."""
    out = {}
    for name, s in raw.items():
        reindexed = s.reindex(master_idx).ffill()
        first_valid = reindexed.first_valid_index()
        if first_valid is not None:
            loc = reindexed.index.get_loc(first_valid)
            head_idx = reindexed.index[max(0, loc - 5): loc]
            if len(head_idx):
                reindexed.loc[head_idx] = reindexed.loc[head_idx].bfill()
        out[name] = reindexed
    return out


# ── Main Pipeline ─────────────────────────────────────────────────────────────

def main() -> pd.DataFrame:
    sep = "─" * 64
    print(f"\n{sep}")
    print(f"  Fear & Greed Index Builder  |  {FETCH_START} → {TODAY}")
    print(sep)

    # 1. Fetch ─────────────────────────────────────────────────────────────────
    print("\n[1/5] Market data (yfinance)…")
    mkt  = fetch_market_data()
    gspc = mkt["^GSPC"]
    vix  = mkt["^VIX"]
    tlt  = mkt["TLT"]
    rsp  = mkt["RSP"]
    spy  = mkt["SPY"]

    print("\n[2/5] Sector ETF data (yfinance)…")
    sectors = fetch_sector_data()

    print("\n[3/5] Credit spreads (FRED)…")
    cred_wide, cred_narrow = fetch_fred_credit()

    print("\n[4/5] CBOE Put/Call ratio…")
    cboe_pc = fetch_cboe_putcall()
    using_pc_proxy = cboe_pc is None
    if using_pc_proxy:
        print("WARNING: CBOE put/call fetch failed. Using VIX/50MA proxy.", file=sys.stderr)
        print("         NOTE: proxy overlaps with volatility component (both use VIX/50MA).", file=sys.stderr)

    # 2. Raw components ────────────────────────────────────────────────────────
    print("\n[5/5] Computing components…")
    breadth_source = "RSP/SPY_20d_spread" if len(rsp) > 500 else "sector_McClellan"
    pc_source = "VIX_50MA_proxy" if using_pc_proxy else "CBOE_total_5dSMA"

    raw = {
        "momentum":      comp_momentum(gspc),
        "strength":      comp_strength(sectors),
        "breadth":       comp_breadth(rsp, spy, sectors),
        "put_call":      comp_putcall(cboe_pc) if cboe_pc is not None
                         else comp_putcall_proxy(vix),
        "volatility":    comp_volatility(vix),
        "credit_spread": comp_credit_spread(cred_wide, cred_narrow),
        "safe_haven":    comp_safe_haven(gspc, tlt),
    }

    print(f"  breadth source:  {breadth_source}")
    print(f"  put_call source: {pc_source}")

    # 3. Align to ^GSPC trading-day master index ───────────────────────────────
    master_idx = gspc.sort_index().index
    aligned    = align(raw, master_idx)

    # 4. Normalize (z-score, invert fear components) ──────────────────────────
    INVERT = {"put_call", "volatility", "credit_spread"}
    normed = {name: normalize(s, invert=(name in INVERT))
              for name, s in aligned.items()}

    # 5. Assemble ──────────────────────────────────────────────────────────────
    print("\n  Assembling index…")
    df = pd.DataFrame(normed).dropna()
    df = df[df.index >= INDEX_START]

    components = ["momentum", "strength", "breadth", "put_call",
                  "volatility", "credit_spread", "safe_haven"]
    df["fear_greed_index"] = df[components].mean(axis=1)
    df = df[["fear_greed_index"] + components].round(2)
    df.index.name = "date"
    df.to_csv(OUTPUT_FILE)
    print(f"  Saved → {OUTPUT_FILE}  ({len(df):,} rows)")

    with open(META_FILE, "w") as f:
        json.dump({
            "put_call_is_proxy": using_pc_proxy,
            "last_updated": TODAY,
            "normalization": "rolling_zscore_252d_clip2sigma",
            "breadth_source": breadth_source,
            "put_call_source": pc_source,
        }, f)
    print(f"  Saved → {META_FILE}")

    # 6. Validation ────────────────────────────────────────────────────────────
    fg = df["fear_greed_index"]
    print(f"\n{'='*64}")
    print("VALIDATION REPORT")
    print(f"{'='*64}")
    print(f"First date: {df.index.min().date()}")
    print(f"Last date:  {df.index.max().date()}")
    print(f"Rows:       {len(df)}")
    print(f"Index stats: min={fg.min():.1f}, mean={fg.mean():.1f}, max={fg.max():.1f}")

    print(f"\n  Distribution:")
    print(f"    Extreme Fear  0–25  : {(fg < 25).sum():5,} days  ({(fg < 25).mean()*100:.1f}%)")
    print(f"    Fear         25–45  : {((fg>=25)&(fg<45)).sum():5,} days  ({((fg>=25)&(fg<45)).mean()*100:.1f}%)")
    print(f"    Neutral      45–55  : {((fg>=45)&(fg<55)).sum():5,} days  ({((fg>=45)&(fg<55)).mean()*100:.1f}%)")
    print(f"    Greed        55–75  : {((fg>=55)&(fg<75)).sum():5,} days  ({((fg>=55)&(fg<75)).mean()*100:.1f}%)")
    print(f"    Extreme Greed 75–100: {(fg >= 75).sum():5,} days  ({(fg>=75).mean()*100:.1f}%)")

    print(f"\n  Notable extremes (index < 20):")
    xf = df[df["fear_greed_index"] < 20][["fear_greed_index"]].head(10)
    print(xf.to_string() if not xf.empty else "    None")

    print(f"\nComponent correlation matrix:")
    print(df[components].corr().round(2))

    print(f"\n  Latest 5 trading days:")
    print(df.tail(5).to_string())

    return df


if __name__ == "__main__":
    main()
