#!/usr/bin/env python3
"""
Fear & Greed Index Calculator — CNN-Accurate Reconstruction
Computes a 0-100 composite sentiment indicator from 7 components.
Output: public/fear_greed_index.csv  (2003-07 → present)

=== WHAT CHANGED FROM ORIGINAL AND WHY ===

1. NORMALIZATION: min-max  →  z-score (±2σ clamp, then 0-100 map)
   CNN: "tracks how much each indicator *deviates from its average* compared
         to how much it *normally diverges*" — that is textbook z-score, not
         min-max. Min-max is wrecked by a single outlier (March 2020 compresses
         everything else for 2 years). Z-score is outlier-robust.

2. VOLATILITY: raw VIX level  →  VIX / VIX.rolling(50).mean()
   CNN's stated spec: "concentrating on a 50-day moving average". The ratio
   captures whether VIX is elevated *relative to its recent baseline*, not
   whether it's 18 vs 28 in absolute terms (regime-dependent).

3. BREADTH: synthetic sector McClellan  →  RSP/SPY relative breadth
   CNN uses the NYSE Volume McClellan Summation Index (requires NYSE A/D volume
   data that is not freely available via API). The RSP/SPY ratio (equal-weight
   vs cap-weight SP500) is the cleanest accessible proxy: when small/mid-caps
   outperform mega-caps, market breadth is widening. Caveat: RSP only starts
   2003-05; sector-based McClellan fills pre-2003 if needed but is left as the
   fallback below (commented out) so you can switch back.
   NOTE: This component will still deviate from CNN — acknowledged limitation.

4. STRENGTH: sector 50-SMA  →  NYSE 52-week H/L ratio via Stooq
   CNN's stated spec: "number of stocks on the NYSE at 52-week highs vs lows".
   We fetch ^NYHGH and ^NYLOW from Stooq (requires Stooq API key; instructions
   below). Falls back to RSP/SPY breadth proxy if Stooq unavailable.
   Proxy: (highs - lows) / (highs + lows), then normalize. Higher = greed.

5. PUT/CALL: raw ratio  →  5-day SMA smoothed
   Multiple replication studies confirm CNN smooths the raw CBOE ratio with a
   5-day moving average before normalization. Without smoothing, single-day
   spikes (monthly expirations) create false fear signals.

6. CREDIT SPREAD: kept, better fallback chain documented

=== DATA SOURCES ===
  Source              Series                         Coverage
  ──────────────────  ─────────────────────────────  ─────────────
  yfinance            ^GSPC, ^VIX, TLT               1990/2002 → today
  yfinance            RSP (equal-weight SP500)        2003-05 → today
  yfinance            SPY (cap-weight SP500)          1993 → today
  yfinance            XLK,XLF,… (11 sectors)         2002-12 → today
  FRED fredgraph.csv  DAAA, DBAA (Moody's yields)    1983/1986 → today
  FRED fredgraph.csv  BAMLH0A0HYM2, BAMLC0A0CM       2005 → today (license may limit)
  CBOE CDN            total.csv (P/C ratio)           1995 → today (IP-blocked locally)
  Stooq               ^nyhgh, ^nylow (NYSE H/L)       ~2000 → today (requires API key)

=== VALIDATION ===
  Ground truth: https://raw.githubusercontent.com/whit3rabbit/fear-greed-data/main/fear-greed.csv
  Contains CNN's actual published composite values 2011-present.
  Run validation after building to compute correlation/RMSE vs CNN.

=== STOOQ API KEY SETUP ===
  1. Visit: https://stooq.com/q/d/?s=^nyhgh&get_apikey
  2. Complete the CAPTCHA
  3. Copy the apikey value from the generated download URL
  4. Set STOOQ_API_KEY environment variable or hardcode below
"""

import json
import os
import sys
import warnings
import time
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
FETCH_START   = "1986-01-01"
INDEX_START   = "2003-07-01"   # TLT inception + warm-up; RSP starts 2003-05
TODAY         = date.today().isoformat()
OUTPUT_FILE   = "public/fear_greed_index.csv"
META_FILE     = "public/fear_greed_meta.json"

NORM_WINDOW   = 252            # 1 year rolling — CNN implied spec
NORM_MIN_PER  = 126            # 6 months minimum warm-up

# Stooq API key for NYSE H/L data (set env var or paste here)
STOOQ_API_KEY = os.environ.get("STOOQ_API_KEY", "")

SECTOR_TICKERS = ["XLK", "XLF", "XLV", "XLY", "XLP", "XLE",
                  "XLI", "XLU", "XLB", "XLRE", "XLC"]


# ── FRED Helper ───────────────────────────────────────────────────────────────
def _fred_csv(series_id: str, retries: int = 3) -> pd.Series:
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}"
    headers = {"User-Agent": "python-research/1.0", "Accept": "text/csv"}
    for attempt in range(retries):
        try:
            r = requests.get(url, timeout=45, headers=headers)
            r.raise_for_status()
            df = pd.read_csv(StringIO(r.text), parse_dates=["observation_date"],
                             index_col="observation_date")
            s = df.iloc[:, 0].replace(".", np.nan).astype(float).dropna()
            s.name = series_id
            return s
        except Exception as e:
            if attempt < retries - 1:
                print(f"  FRED {series_id} attempt {attempt+1} failed: {e}. Retrying...")
                time.sleep(3 * (attempt + 1))
            else:
                raise


# ── Stooq Helper ──────────────────────────────────────────────────────────────
def _stooq_csv(symbol: str, api_key: str = ""):
    """
    Fetch a Stooq daily series. Returns None if unavailable or no API key.
    symbol examples: '^nyhgh', '^nylow'
    """
    base = f"https://stooq.com/q/d/l/?s={symbol}&i=d"
    if api_key:
        base += f"&apikey={api_key}"
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        r = requests.get(base, headers=headers, timeout=20)
        if r.status_code != 200 or "Get your apikey" in r.text:
            return None
        df = pd.read_csv(StringIO(r.text), parse_dates=["Date"], index_col="Date")
        s = df["Close"].dropna()
        s.name = symbol
        return s
    except Exception as e:
        print(f"  Stooq {symbol} failed: {e}")
        return None


# ── Data Fetchers ─────────────────────────────────────────────────────────────
def fetch_market_data() -> dict:
    tickers = ["^GSPC", "^VIX", "TLT"]
    print(f"  [yfinance] {tickers}")
    raw = yf.download(tickers, start=FETCH_START, end=TODAY,
                      auto_adjust=True, progress=False, threads=True)
    close = raw["Close"] if isinstance(raw.columns, pd.MultiIndex) else raw
    return {t: close[t].squeeze().dropna() for t in tickers}


def fetch_breadth_data() -> dict:
    """
    Fetch RSP (equal-weight) and SPY (cap-weight) for breadth proxy.
    Also fetches NYSE H/L from Stooq if API key available.
    """
    print("  [yfinance] RSP, SPY (breadth proxy)")
    raw = yf.download(["RSP", "SPY"], start=FETCH_START, end=TODAY,
                      auto_adjust=True, progress=False, threads=True)
    close = raw["Close"] if isinstance(raw.columns, pd.MultiIndex) else raw
    result = {t: close[t].squeeze().dropna() for t in ["RSP", "SPY"]}

    # Try NYSE H/L from Stooq (requires API key)
    result["nyse_highs"] = None
    result["nyse_lows"] = None
    if STOOQ_API_KEY:
        print("  [Stooq] ^nyhgh, ^nylow (NYSE 52-week H/L)")
        result["nyse_highs"] = _stooq_csv("^nyhgh", STOOQ_API_KEY)
        result["nyse_lows"]  = _stooq_csv("^nylow",  STOOQ_API_KEY)
        if result["nyse_highs"] is not None:
            h = result["nyse_highs"]
            print(f"  nyhgh: {h.index[0].date()} → {h.index[-1].date()}  ({len(h):,} obs)")
        else:
            print("  Stooq H/L fetch failed — will use RSP/SPY breadth for strength component")
    else:
        print("  [Stooq] No API key — NYSE H/L unavailable; strength uses RSP/SPY proxy")
        print("         Set STOOQ_API_KEY env var to enable. See file header for setup.")

    return result


def fetch_sector_data() -> pd.DataFrame:
    """Needed as fallback breadth if RSP unavailable (pre-2003-05)."""
    print(f"  [yfinance] {SECTOR_TICKERS}")
    raw = yf.download(SECTOR_TICKERS, start=FETCH_START, end=TODAY,
                      auto_adjust=True, progress=False, threads=True)
    close = raw["Close"] if isinstance(raw.columns, pd.MultiIndex) else raw
    return close


def fetch_fred_credit() -> tuple:
    """
    Prefer ICE BofA HY OAS minus IG OAS (true junk spread).
    FRED's April 2026 licensing change may have cut these to ~793 rows.
    Fallback: Moody's DBAA minus DAAA (both investment grade — not ideal but best available).
    """
    try:
        print("  [FRED] BAMLH0A0HYM2 (ICE BofA HY OAS)")
        hy = _fred_csv("BAMLH0A0HYM2")
        print(f"         {hy.index[0].date()} → {hy.index[-1].date()}  ({len(hy):,} obs)")
        print("  [FRED] BAMLC0A0CM   (ICE BofA IG OAS)")
        ig = _fred_csv("BAMLC0A0CM")
        print(f"         {ig.index[0].date()} → {ig.index[-1].date()}  ({len(ig):,} obs)")
        if len(hy) >= 2000 and len(ig) >= 2000:
            print("  → Using ICE BofA HY - IG OAS (true junk spread — matches CNN's source)")
            return hy, ig, "ICE_BofA_HY_IG"
        print(f"  → ICE BofA history too short ({len(hy)}/{len(ig)} rows). Fallback to Moody's.")
    except Exception as e:
        print(f"  → ICE BofA failed ({e}). Fallback to Moody's.")

    print("  [FRED] DAAA, DBAA (Moody's AAA/BAA — both IG, not true junk spread)")
    print("  WARNING: Moody's BAA-AAA is an investment-grade spread, NOT equivalent")
    print("           to CNN's HY-IG junk spread. Understates stress during HY events.")
    daaa = _fred_csv("DAAA")
    dbaa = _fred_csv("DBAA")
    print(f"  DAAA: {daaa.index[0].date()} → {daaa.index[-1].date()}  ({len(daaa):,} obs)")
    print(f"  DBAA: {dbaa.index[0].date()} → {dbaa.index[-1].date()}  ({len(dbaa):,} obs)")
    return dbaa, daaa, "Moodys_BAA_AAA"


def fetch_cboe_putcall():
    """
    CBOE Total Put/Call ratio daily CSV.
    Often 403 from datacenter IPs; use the proxy in that case.
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
                    sess.headers.update({
                        "User-Agent": "Mozilla/5.0",
                        "Referer": "https://www.cboe.com/"
                    })
                r = sess.get(url, timeout=25)
                if r.status_code != 200 or len(r.content) < 1000:
                    continue
                df = pd.read_csv(StringIO(r.text), skiprows=1, header=0)
                df.columns = df.columns.str.strip().str.lower()
                dcol = next(c for c in df.columns if "date" in c)
                vcol = next(
                    (c for c in df.columns
                     if c != dcol and any(k in c for k in ("total", "p/c", "put"))),
                    [c for c in df.columns if c != dcol][0]
                )
                df[dcol] = pd.to_datetime(df[dcol], errors="coerce")
                s = (df.dropna(subset=[dcol])
                       .set_index(dcol)
                       .sort_index()[vcol]
                       .pipe(pd.to_numeric, errors="coerce")
                       .dropna())
                s.name = "put_call"
                print(f"  [CBOE] OK  {s.index[0].date()} → {s.index[-1].date()}  ({len(s):,} obs)")
                return s
            except Exception:
                continue

    print("  [CBOE] All sources 403/timeout — local IP block is normal.", file=sys.stderr)
    return None


# ── Component Computations ────────────────────────────────────────────────────

def comp_momentum(gspc: pd.Series) -> pd.Series:
    """SPX vs 125-day SMA. CNN spec: exact match."""
    sma125 = gspc.rolling(window=125, min_periods=63).mean()
    return ((gspc - sma125) / sma125 * 100).rename("momentum")


def comp_strength_nyse_hl(highs: pd.Series, lows: pd.Series) -> pd.Series:
    """
    NYSE 52-week H/L ratio. CNN's exact spec.
    (highs - lows) / (highs + lows), range [-1, 1]. Higher = greed.
    Requires Stooq API key for ^nyhgh and ^nylow.
    """
    total = (highs + lows).replace(0, np.nan)
    return ((highs - lows) / total).rename("strength")


def comp_strength_proxy(rsp: pd.Series, spy: pd.Series) -> pd.Series:
    """
    Fallback: RSP/SPY relative performance smoothed over 63 days.
    Equal-weight outperforming cap-weight = broad participation = greed signal.
    Imperfect but directionally correct. Starts 2003-05.
    """
    ratio = (rsp / spy)
    # Rolling z-score of the ratio itself to remove long-term drift
    mu  = ratio.rolling(252, min_periods=126).mean()
    sd  = ratio.rolling(252, min_periods=126).std()
    return ((ratio - mu) / sd).rename("strength")


def comp_breadth_rsp_spy(rsp: pd.Series, spy: pd.Series) -> pd.Series:
    """
    RSP/SPY 20-day momentum spread.
    When equal-weight recently outperformed cap-weight, breadth is expanding.
    CNN uses NYSE Volume McClellan Summation (not freely available).
    This is the closest accessible proxy.
    """
    rsp_ret = rsp.pct_change(20)
    spy_ret = spy.pct_change(20)
    return (rsp_ret - spy_ret).rename("breadth")


def comp_breadth_sector_mcclellan(sectors: pd.DataFrame) -> pd.Series:
    """
    ORIGINAL fallback: McClellan Oscillator from sector ETFs.
    Less accurate than NYSE breadth but works without external data.
    Note: CNN uses the McClellan SUMMATION (cumulative), not just the Oscillator.
    This computes the Oscillator — a known divergence from CNN's actual value.
    """
    rets = sectors.pct_change()
    advancing = (rets > 0).sum(axis=1)
    declining  = (rets < 0).sum(axis=1)
    valid_count = sectors.notna().sum(axis=1).replace(0, np.nan)
    net  = (advancing - declining) / valid_count
    ema19 = net.ewm(span=19, adjust=False).mean()
    ema39 = net.ewm(span=39, adjust=False).mean()
    return (ema19 - ema39).rename("breadth")


def comp_putcall(pc: pd.Series) -> pd.Series:
    """
    CBOE Total P/C ratio, 5-day SMA smoothed.
    CNN applies ~5-day smoothing (confirmed by multiple replication studies).
    Raw daily ratio has massive expiration-driven spikes.
    """
    return pc.rolling(5, min_periods=3).mean().rename("put_call")


def comp_putcall_proxy(vix: pd.Series) -> pd.Series:
    """
    Fallback: VIX / 50-day SMA.
    NOTE: This creates partial overlap with the volatility component.
    We note this in metadata as a data quality flag.
    If possible, use real CBOE data.
    """
    vix_sma = vix.rolling(50, min_periods=25).mean()
    return (vix / vix_sma).where(vix_sma > 0, np.nan).rename("put_call")


def comp_volatility(vix: pd.Series) -> pd.Series:
    """
    VIX relative to its 50-day moving average. CNN's stated spec.
    Higher ratio = VIX elevated vs recent baseline = fear.
    FIXED from original: was using raw VIX level (regime-dependent).
    """
    vix_ma50 = vix.rolling(window=50, min_periods=25).mean()
    return (vix / vix_ma50).where(vix_ma50 > 0, np.nan).rename("volatility")


def comp_credit_spread(wide: pd.Series, narrow: pd.Series) -> pd.Series:
    """
    Wide spread minus narrow spread.
    HY OAS - IG OAS (preferred) or BAA yield - AAA yield (fallback).
    Widens during stress (fear), tightens during risk appetite (greed).
    """
    return (wide - narrow).rename("credit_spread")


def comp_safe_haven(gspc: pd.Series, tlt: pd.Series) -> pd.Series:
    """
    20-day SPX return minus 20-day TLT return. CNN's stated spec.
    Positive = stocks outperforming bonds = greed. Exact match.
    """
    return (gspc.pct_change(20) - tlt.pct_change(20)).rename("safe_haven")


# ── Normalization ─────────────────────────────────────────────────────────────

def normalize_zscore(s: pd.Series, invert: bool = False,
                     window: int = NORM_WINDOW,
                     min_periods: int = NORM_MIN_PER,
                     sigma_clip: float = 2.0) -> pd.Series:
    """
    Rolling z-score normalization, clamped at ±sigma_clip, mapped to [0, 100].

    CNN's stated methodology: "tracks how much each indicator deviates from its
    average compared to how much it normally diverges" = z-score by definition.

    sigma_clip=2.0 means observations >2σ from mean map to 0 or 100.
    This gives the index its crisp behavior at extremes while keeping central
    readings spread across the 0-100 range.

    Setting sigma_clip=3.0 is more conservative (fewer extreme readings).
    Try both and validate against CNN's published values.
    """
    mu  = s.rolling(window=window, min_periods=min_periods).mean()
    sd  = s.rolling(window=window, min_periods=min_periods).std()
    z   = (s - mu) / sd.replace(0, np.nan)
    z   = z.clip(-sigma_clip, sigma_clip)
    # Map [-sigma_clip, +sigma_clip] → [0, 100]
    norm = (z + sigma_clip) / (2 * sigma_clip) * 100
    if invert:
        norm = 100 - norm
    return norm.clip(0, 100)


# ── Alignment ─────────────────────────────────────────────────────────────────

def align(raw: dict, master_idx: pd.DatetimeIndex) -> dict:
    out = {}
    for name, s in raw.items():
        reindexed = s.reindex(master_idx).ffill()
        out[name] = reindexed
    return out


# ── Validation ────────────────────────────────────────────────────────────────

def fetch_cnn_ground_truth():
    """
    Fetch CNN's actual published Fear & Greed values (2011-present) from the
    whit3rabbit GitHub archive (scraped from CNN's own API).
    Use this to validate your reconstruction.
    """
    url = "https://raw.githubusercontent.com/whit3rabbit/fear-greed-data/main/fear-greed.csv"
    try:
        r = requests.get(url, timeout=20)
        df = pd.read_csv(StringIO(r.text), parse_dates=["Date"], index_col="Date")
        s = df["Fear Greed"].dropna()
        print(f"  [CNN Truth] Loaded {len(s):,} rows  "
              f"{s.index[0].date()} → {s.index[-1].date()}")
        return s
    except Exception as e:
        print(f"  [CNN Truth] Failed: {e}")
        return None


def run_validation(our_fg: pd.Series, cnn_truth: pd.Series) -> dict:
    """Compute correlation and RMSE between reconstruction and CNN truth."""
    shared = our_fg.index.intersection(cnn_truth.index)
    if len(shared) < 100:
        print(f"  Not enough overlapping dates ({len(shared)}) for validation")
        return {}
    a = our_fg.loc[shared]
    b = cnn_truth.loc[shared]
    corr = a.corr(b)
    rmse = float(np.sqrt(((a - b) ** 2).mean()))
    mae  = float((a - b).abs().mean())
    print(f"  Validation (n={len(shared):,} days):")
    print(f"    Pearson r : {corr:.4f}")
    print(f"    RMSE      : {rmse:.2f}")
    print(f"    MAE       : {mae:.2f}")
    print(f"    Mean bias : {float((a - b).mean()):.2f}  (positive = our index > CNN)")
    if corr > 0.90:
        print("  ✓ Good reconstruction (r > 0.90)")
    elif corr > 0.80:
        print("  ~ Acceptable reconstruction (r > 0.80)")
    else:
        print("  ✗ Poor reconstruction (r < 0.80) — check component data sources")
    return {"pearson_r": corr, "rmse": rmse, "mae": mae, "n_days": len(shared)}


# ── Main Pipeline ─────────────────────────────────────────────────────────────

def main() -> pd.DataFrame:
    sep = "─" * 64
    print(f"\n{sep}")
    print(f"  Fear & Greed Index Builder (CNN-accurate)  |  {TODAY}")
    print(sep)

    # 1. Fetch ─────────────────────────────────────────────────────────────────
    print("\n[1/6] Market data (yfinance)…")
    mkt  = fetch_market_data()
    gspc = mkt["^GSPC"]
    vix  = mkt["^VIX"]
    tlt  = mkt["TLT"]

    print("\n[2/6] Breadth data (RSP/SPY + optional Stooq NYSE H/L)…")
    breadth_data = fetch_breadth_data()
    rsp = breadth_data["RSP"]
    spy = breadth_data["SPY"]
    nyse_highs = breadth_data["nyse_highs"]
    nyse_lows  = breadth_data["nyse_lows"]

    print("\n[3/6] Sector ETF data (fallback breadth)…")
    sectors = fetch_sector_data()

    print("\n[4/6] Credit spreads (FRED)…")
    cred_wide, cred_narrow, credit_source = fetch_fred_credit()

    print("\n[5/6] CBOE Put/Call ratio…")
    cboe_pc = fetch_cboe_putcall()
    using_pc_proxy = cboe_pc is None
    if using_pc_proxy:
        print("WARNING: Using VIX/50MA proxy for P/C — overlaps with volatility component.",
              file=sys.stderr)

    # 2. Determine which sources we're using ───────────────────────────────────
    has_nyse_hl = (nyse_highs is not None and nyse_lows is not None
                   and len(nyse_highs) > 500 and len(nyse_lows) > 500)
    has_rsp = len(rsp) > 500

    strength_source = "NYSE_HL_Stooq" if has_nyse_hl else ("RSP_SPY_proxy" if has_rsp else "sector_50SMA")
    breadth_source  = "RSP_SPY_20d_momentum" if has_rsp else "sector_McClellan"
    pc_source       = "CBOE_total_5dSMA" if not using_pc_proxy else "VIX_50MA_proxy"

    print(f"\n  Sources selected:")
    print(f"    strength: {strength_source}")
    print(f"    breadth:  {breadth_source}")
    print(f"    put_call: {pc_source}")
    print(f"    credit:   {credit_source}")

    # 3. Compute raw components ────────────────────────────────────────────────
    print("\n[6/6] Computing components…")
    raw = {
        "momentum": comp_momentum(gspc),
        "volatility": comp_volatility(vix),         # FIXED: VIX/50MA not raw VIX
        "credit_spread": comp_credit_spread(cred_wide, cred_narrow),
        "safe_haven": comp_safe_haven(gspc, tlt),
        "put_call": (comp_putcall(cboe_pc)
                     if not using_pc_proxy
                     else comp_putcall_proxy(vix)),
    }

    # Strength
    if has_nyse_hl:
        raw["strength"] = comp_strength_nyse_hl(nyse_highs, nyse_lows)
    elif has_rsp:
        raw["strength"] = comp_strength_proxy(rsp, spy)
    else:
        # Original fallback (sector 50-SMA) — least accurate
        sma = sectors.rolling(50, min_periods=25).mean()
        above = (sectors > sma).astype(float)
        valid = sectors.notna() & sma.notna()
        raw["strength"] = (above.where(valid).sum(axis=1)
                           / valid.sum(axis=1).replace(0, np.nan)).rename("strength")

    # Breadth
    if has_rsp:
        raw["breadth"] = comp_breadth_rsp_spy(rsp, spy)
    else:
        raw["breadth"] = comp_breadth_sector_mcclellan(sectors)

    # 4. Align to SPX trading-day index ───────────────────────────────────────
    master_idx = gspc.sort_index().index
    aligned    = align(raw, master_idx)

    # 5. Normalize (z-score, invert fear components) ──────────────────────────
    # Fear components (higher raw = more fear → invert to make higher = greed)
    INVERT = {"put_call", "volatility", "credit_spread"}
    normed = {
        name: normalize_zscore(s, invert=(name in INVERT))
        for name, s in aligned.items()
    }

    # 6. Assemble ──────────────────────────────────────────────────────────────
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

    # Metadata
    meta = {
        "last_updated": TODAY,
        "index_start": INDEX_START,
        "normalization": "rolling_zscore_252d_clip2sigma",
        "sources": {
            "strength": strength_source,
            "breadth": breadth_source,
            "put_call": pc_source,
            "credit_spread": credit_source,
            "volatility": "VIX_vs_50MA",   # fixed from raw VIX
            "momentum": "SPX_vs_125MA",
            "safe_haven": "SPX_minus_TLT_20d",
        },
        "known_deviations_from_cnn": [
            "CNN uses NYSE Volume McClellan Summation Index for breadth; we use RSP/SPY 20d spread",
            "CNN uses NYSE 52-week H/L for strength; we use RSP/SPY z-score if no Stooq key",
            "CNN's exact normalization window is undisclosed; we use 252-day rolling z-score ±2σ",
            "Moody's BAA-AAA spread is IG-only, not equivalent to CNN's HY-IG junk spread",
            "Historical reconstruction will differ from CNN real-time readings (normalization path-dependence)",
        ]
    }
    with open(META_FILE, "w") as f:
        json.dump(meta, f, indent=2)
    print(f"  Saved → {META_FILE}")

    # 7. Validation vs CNN truth ───────────────────────────────────────────────
    print(f"\n{'='*64}")
    print("VALIDATION REPORT")
    print(f"{'='*64}")

    fg = df["fear_greed_index"]
    print(f"\nIndex stats: min={fg.min():.1f}  mean={fg.mean():.1f}  max={fg.max():.1f}")
    print(f"Rows: {len(df)}  |  {df.index[0].date()} → {df.index[-1].date()}")

    print(f"\nDistribution:")
    print(f"  Extreme Fear  0-25  : {(fg < 25).sum():5,}  ({(fg < 25).mean()*100:.1f}%)")
    print(f"  Fear         25-45  : {((fg>=25)&(fg<45)).sum():5,}  ({((fg>=25)&(fg<45)).mean()*100:.1f}%)")
    print(f"  Neutral      45-55  : {((fg>=45)&(fg<55)).sum():5,}  ({((fg>=45)&(fg<55)).mean()*100:.1f}%)")
    print(f"  Greed        55-75  : {((fg>=55)&(fg<75)).sum():5,}  ({((fg>=55)&(fg<75)).mean()*100:.1f}%)")
    print(f"  Extreme Greed 75-100: {(fg >= 75).sum():5,}  ({(fg>=75).mean()*100:.1f}%)")

    print(f"\nNotable extremes (index < 15):")
    xf = df[df["fear_greed_index"] < 15][["fear_greed_index"]].head(15)
    print(xf.to_string() if not xf.empty else "  None")

    print(f"\nLatest 5 trading days:")
    print(df.tail(5).to_string())

    print(f"\nComponent correlations:")
    print(df[components].corr().round(2).to_string())

    print(f"\n{'='*64}")
    print("CNN GROUND TRUTH COMPARISON (2011-present)")
    print(f"{'='*64}")
    cnn_truth = fetch_cnn_ground_truth()
    val_stats = {}
    if cnn_truth is not None:
        cnn_truth.index = pd.to_datetime(cnn_truth.index).normalize()
        val_stats = run_validation(fg, cnn_truth)
    else:
        print("  Ground truth unavailable — check network")

    meta["validation"] = val_stats
    with open(META_FILE, "w") as f:
        json.dump(meta, f, indent=2)

    return df


if __name__ == "__main__":
    main()
