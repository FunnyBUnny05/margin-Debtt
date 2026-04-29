#!/usr/bin/env python3
"""
Fear & Greed Index Calculator — CNN-Accurate Reconstruction
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
  strength      : NYSE 52-wk H/L ratio via Stooq            (CNN exact; needs STOOQ_API_KEY)
                  ↳ fallback: RSP/SPY ratio                 (proxy if no Stooq key)
                  ↳ fallback: % sectors above 50-day SMA    (proxy if no RSP)
  breadth       : RSP/SPY 20-day return spread              (proxy; CNN uses NYSE McClellan Summation)
                  ↳ fallback: sector McClellan oscillator
  put_call      : CBOE total P/C ratio, 5-day SMA smoothed  (CNN applies ~5d smoothing)
                  ↳ fallback: VIX/realized-vol proxy (variance risk premium)
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
  CBOE CDN            total.csv (P/C ratio)           1995 → today (IP-blocked locally)
  Stooq               ^nyhgh, ^nylow (NYSE H/L)       ~2000 → today (needs STOOQ_API_KEY)

=== VALIDATION ===
  Ground truth: https://raw.githubusercontent.com/whit3rabbit/fear-greed-data/main/fear-greed.csv
  Contains CNN's actual published composite values 2011-present.

=== STOOQ API KEY SETUP ===
  1. Visit: https://stooq.com/q/d/?s=^nyhgh&get_apikey
  2. Complete the CAPTCHA
  3. Copy the apikey value from the generated download URL
  4. Set STOOQ_API_KEY environment variable

Why TLT instead of ^TNX?
  TNX pct_change is dimensionally incomparable to equity returns.
  TLT price returns are directly comparable. TLT inception July 2002.
"""

import json
import os
import sys
import time
import warnings
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
    """Fetch a Stooq daily series. Returns None if unavailable or no API key."""
    base = f"https://stooq.com/q/d/l/?s={symbol}&i=d"
    if api_key:
        base += f"&apikey={api_key}"
    try:
        r = requests.get(base, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
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
    """Fetch RSP/SPY for breadth+strength proxy; NYSE H/L from Stooq if key set."""
    print("  [yfinance] RSP, SPY")
    raw = yf.download(["RSP", "SPY"], start=FETCH_START, end=TODAY,
                      auto_adjust=True, progress=False, threads=True)
    close = raw["Close"] if isinstance(raw.columns, pd.MultiIndex) else raw
    result = {t: close[t].squeeze().dropna() for t in ["RSP", "SPY"]}
    result["nyse_highs"] = None
    result["nyse_lows"]  = None

    if STOOQ_API_KEY:
        print("  [Stooq] ^nyhgh, ^nylow (NYSE 52-week H/L)")
        result["nyse_highs"] = _stooq_csv("^nyhgh", STOOQ_API_KEY)
        result["nyse_lows"]  = _stooq_csv("^nylow",  STOOQ_API_KEY)
        if result["nyse_highs"] is not None:
            h = result["nyse_highs"]
            print(f"  nyhgh: {h.index[0].date()} → {h.index[-1].date()}  ({len(h):,} obs)")
        else:
            print("  Stooq H/L fetch failed — falling back to RSP/SPY for strength")
    else:
        print("  [Stooq] No STOOQ_API_KEY — strength uses RSP/SPY proxy")
        print("         Set STOOQ_API_KEY env var to enable NYSE H/L (CNN exact spec)")

    return result


def fetch_sector_data() -> pd.DataFrame:
    """Fallback breadth/strength if RSP unavailable (pre-2003-05)."""
    print(f"  [yfinance] {SECTOR_TICKERS}")
    raw = yf.download(SECTOR_TICKERS, start=FETCH_START, end=TODAY,
                      auto_adjust=True, progress=False, threads=True)
    close = raw["Close"] if isinstance(raw.columns, pd.MultiIndex) else raw
    return close


def fetch_fred_credit() -> tuple:
    """
    Prefer ICE BofA HY OAS minus IG OAS (true junk spread).
    Falls back to Moody's DBAA-DAAA if FRED returns < 2000 rows (licensing limit).
    Returns (wide, narrow, source_label).
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
            return hy, ig, "ICE_BofA_HY_IG"
        print(f"  → ICE BofA history too short ({len(hy)}/{len(ig)} rows). Falling back to Moody's.")
    except Exception as e:
        print(f"  → ICE BofA fetch failed ({e}). Falling back to Moody's.")

    print("  [FRED] DAAA, DBAA (Moody's AAA/BAA — IG spread, not true junk)")
    print("  WARNING: BAA-AAA is investment-grade only; understates stress during HY events.")
    daaa = _fred_csv("DAAA")
    dbaa = _fred_csv("DBAA")
    print(f"  DAAA: {daaa.index[0].date()} → {daaa.index[-1].date()}  ({len(daaa):,} obs)")
    print(f"  DBAA: {dbaa.index[0].date()} → {dbaa.index[-1].date()}  ({len(dbaa):,} obs)")
    return dbaa, daaa, "Moodys_BAA_AAA"


def fetch_cboe_putcall():
    """
    CBOE Total Put/Call ratio daily CSV.
    Often 403 from datacenter IPs — returns None if all sources blocked.
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
                    sess.headers.update({"User-Agent": "Mozilla/5.0",
                                         "Referer": "https://www.cboe.com/"})
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

    print("  [CBOE] All sources 403/timeout (local IP block is normal).", file=sys.stderr)
    return None


# ── Component Computations ────────────────────────────────────────────────────

def comp_momentum(gspc: pd.Series) -> pd.Series:
    """SPX vs 125-day SMA. CNN exact match."""
    sma = gspc.rolling(window=125, min_periods=63).mean()
    return ((gspc - sma) / sma * 100).rename("momentum")


def comp_strength_nyse_hl(highs: pd.Series, lows: pd.Series) -> pd.Series:
    """NYSE 52-week H/L ratio. CNN exact spec. (highs-lows)/(highs+lows) ∈ [-1,1]."""
    total = (highs + lows).replace(0, np.nan)
    return ((highs - lows) / total).rename("strength")


def comp_strength_proxy(rsp: pd.Series, spy: pd.Series) -> pd.Series:
    """
    Fallback: raw RSP/SPY price ratio.
    Equal-weight outperforming cap-weight = broad participation = greed.
    Returns raw ratio; normalize() handles z-score standardization.
    """
    return (rsp / spy).rename("strength")


def comp_strength_sector(sectors: pd.DataFrame) -> pd.Series:
    """Last-resort fallback: % of sector ETFs above their 50-day SMA."""
    sma = sectors.rolling(window=50, min_periods=25).mean()
    above = (sectors > sma).astype(float)
    valid = sectors.notna() & sma.notna()
    pct = above.where(valid).sum(axis=1) / valid.sum(axis=1).replace(0, np.nan)
    return pct.rename("strength")


def comp_breadth_rsp_spy(rsp: pd.Series, spy: pd.Series) -> pd.Series:
    """
    RSP/SPY 20-day return spread.
    Equal-weight recently outperforming cap-weight = breadth expanding = greed.
    CNN uses NYSE Volume McClellan Summation — not freely available via API.
    """
    return (rsp.pct_change(20) - spy.pct_change(20)).rename("breadth")


def comp_breadth_sector_mcclellan(sectors: pd.DataFrame) -> pd.Series:
    """
    Fallback: McClellan Oscillator from sector ETF daily breadth.
    CNN uses the Summation (cumulative) — this is the Oscillator, a known divergence.
    """
    rets = sectors.pct_change()
    advancing   = (rets > 0).sum(axis=1)
    declining   = (rets < 0).sum(axis=1)
    valid_count = sectors.notna().sum(axis=1).replace(0, np.nan)
    net   = (advancing - declining) / valid_count
    ema19 = net.ewm(span=19, adjust=False).mean()
    ema39 = net.ewm(span=39, adjust=False).mean()
    return (ema19 - ema39).rename("breadth")


def comp_putcall(pc: pd.Series) -> pd.Series:
    """CBOE Total P/C, 5-day SMA smoothed. CNN applies ~5-day smoothing."""
    return pc.rolling(5, min_periods=3).mean().rename("put_call")


def comp_putcall_proxy(vix: pd.Series, gspc: pd.Series) -> pd.Series:
    """
    Fallback: VIX / 20-day realized volatility (variance risk premium).
    When implied vol (VIX) exceeds actual realized vol, the options market is
    paying a fear premium — a direct proxy for elevated put buying.
    Distinct from comp_volatility (VIX/50MA) so the two components don't double-count.
    Available from full VIX history (1990+).
    """
    rvol = gspc.pct_change().rolling(20, min_periods=10).std() * np.sqrt(252) * 100
    return (vix / rvol.replace(0, np.nan)).rename("put_call")


def comp_volatility(vix: pd.Series) -> pd.Series:
    """VIX / 50-day SMA. CNN stated spec: 'concentrating on a 50-day moving average'."""
    vix_ma50 = vix.rolling(window=50, min_periods=25).mean()
    return (vix / vix_ma50).where(vix_ma50 > 0, np.nan).rename("volatility")


def comp_credit_spread(wide: pd.Series, narrow: pd.Series) -> pd.Series:
    """Wide minus narrow spread. Widens during fear (stress), tightens during greed."""
    return (wide - narrow).rename("credit_spread")


def comp_safe_haven(gspc: pd.Series, tlt: pd.Series) -> pd.Series:
    """20-day SPX return minus 20-day TLT return. CNN exact match."""
    return (gspc.pct_change(20) - tlt.pct_change(20)).rename("safe_haven")


# ── Normalization ─────────────────────────────────────────────────────────────

def normalize(s: pd.Series, invert: bool = False) -> pd.Series:
    """
    Rolling z-score normalization, clamped at ±SIGMA_CLIP, mapped to [0, 100].

    CNN methodology: "tracks how much each indicator deviates from its average
    compared to how much it normally diverges" = z-score by definition.

    Replaces min-max: one outlier (COVID VIX spike) no longer distorts 2 years
    of subsequent readings. ±2σ clip keeps central readings spread across 0-100.
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
    """Reindex all series to master trading-day index; ffill, bfill only leading NaNs."""
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


# ── Validation ────────────────────────────────────────────────────────────────

def fetch_cnn_ground_truth():
    """Fetch CNN's published Fear & Greed values (2011-present) from whit3rabbit archive."""
    url = "https://raw.githubusercontent.com/whit3rabbit/fear-greed-data/main/fear-greed.csv"
    try:
        r = requests.get(url, timeout=20)
        df = pd.read_csv(StringIO(r.text), parse_dates=["Date"], index_col="Date")
        s = df["Fear Greed"].dropna()
        print(f"  [CNN Truth] {len(s):,} rows  {s.index[0].date()} → {s.index[-1].date()}")
        return s
    except Exception as e:
        print(f"  [CNN Truth] Failed: {e}")
        return None


def run_validation(our_fg: pd.Series, cnn_truth: pd.Series) -> dict:
    """Pearson r and RMSE between our reconstruction and CNN ground truth."""
    shared = our_fg.index.intersection(cnn_truth.index)
    if len(shared) < 100:
        print(f"  Not enough overlapping dates ({len(shared)}) for validation")
        return {}
    a, b = our_fg.loc[shared], cnn_truth.loc[shared]
    corr = a.corr(b)
    rmse = float(np.sqrt(((a - b) ** 2).mean()))
    mae  = float((a - b).abs().mean())
    print(f"  Validation (n={len(shared):,} days):")
    print(f"    Pearson r : {corr:.4f}")
    print(f"    RMSE      : {rmse:.2f}   MAE: {mae:.2f}")
    print(f"    Mean bias : {float((a - b).mean()):.2f}  (+ = our index > CNN)")
    grade = "✓ Good (r>0.90)" if corr > 0.90 else ("~ Acceptable (r>0.80)" if corr > 0.80
            else "✗ Poor (r<0.80) — check component sources")
    print(f"    {grade}")
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

    print("\n[2/6] Breadth/strength data (RSP/SPY + optional Stooq NYSE H/L)…")
    breadth_data = fetch_breadth_data()
    rsp        = breadth_data["RSP"]
    spy        = breadth_data["SPY"]
    nyse_highs = breadth_data["nyse_highs"]
    nyse_lows  = breadth_data["nyse_lows"]

    print("\n[3/6] Sector ETF data (fallback)…")
    sectors = fetch_sector_data()

    print("\n[4/6] Credit spreads (FRED)…")
    cred_wide, cred_narrow, credit_source = fetch_fred_credit()

    print("\n[5/6] CBOE Put/Call ratio…")
    cboe_pc = fetch_cboe_putcall()
    using_pc_proxy = cboe_pc is None
    if using_pc_proxy:
        print("WARNING: CBOE blocked. Using VIX/realized-vol proxy for put/call.",
              file=sys.stderr)

    # 2. Select sources ────────────────────────────────────────────────────────
    has_nyse_hl = (nyse_highs is not None and nyse_lows is not None
                   and len(nyse_highs) > 500 and len(nyse_lows) > 500)
    has_rsp = len(rsp) > 500

    strength_source = ("NYSE_HL_Stooq" if has_nyse_hl
                       else "RSP_SPY_ratio" if has_rsp
                       else "sector_50SMA")
    breadth_source  = "RSP_SPY_20d_spread" if has_rsp else "sector_McClellan"
    pc_source       = "CBOE_total_5dSMA" if not using_pc_proxy else "VIX_realizedvol_proxy"

    print(f"\n  Sources: strength={strength_source}  breadth={breadth_source}"
          f"  put_call={pc_source}  credit={credit_source}")

    # 3. Compute raw components ────────────────────────────────────────────────
    print("\n[6/6] Computing components…")

    if has_nyse_hl:
        strength = comp_strength_nyse_hl(nyse_highs, nyse_lows)
    elif has_rsp:
        strength = comp_strength_proxy(rsp, spy)
    else:
        strength = comp_strength_sector(sectors)

    breadth = (comp_breadth_rsp_spy(rsp, spy) if has_rsp
               else comp_breadth_sector_mcclellan(sectors))

    raw = {
        "momentum":      comp_momentum(gspc),
        "strength":      strength,
        "breadth":       breadth,
        "put_call":      comp_putcall(cboe_pc) if not using_pc_proxy
                         else comp_putcall_proxy(vix, gspc),
        "volatility":    comp_volatility(vix),
        "credit_spread": comp_credit_spread(cred_wide, cred_narrow),
        "safe_haven":    comp_safe_haven(gspc, tlt),
    }

    # 4. Align ─────────────────────────────────────────────────────────────────
    master_idx = gspc.sort_index().index
    aligned    = align(raw, master_idx)

    # 5. Normalize (z-score, invert fear components) ───────────────────────────
    INVERT = {"put_call", "volatility", "credit_spread"}
    normed = {name: normalize(s, invert=(name in INVERT))
              for name, s in aligned.items()}

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

    meta = {
        "last_updated": TODAY,
        "index_start": INDEX_START,
        "normalization": "rolling_zscore_252d_clip2sigma",
        "put_call_is_proxy": using_pc_proxy,
        "sources": {
            "strength": strength_source,
            "breadth": breadth_source,
            "put_call": pc_source,
            "credit_spread": credit_source,
            "volatility": "VIX_vs_50MA",
            "momentum": "SPX_vs_125MA",
            "safe_haven": "SPX_minus_TLT_20d",
        },
        "known_deviations_from_cnn": [
            "breadth: CNN uses NYSE Volume McClellan Summation; we use RSP/SPY 20d spread",
            "strength: CNN uses NYSE 52-wk H/L; we use RSP/SPY ratio without STOOQ_API_KEY",
            "normalization window undisclosed by CNN; we use 252d rolling z-score ±2σ",
            "Moody's BAA-AAA is IG-only when ICE BofA OAS unavailable",
        ],
    }
    with open(META_FILE, "w") as f:
        json.dump(meta, f, indent=2)
    print(f"  Saved → {META_FILE}")

    # 7. Validation ────────────────────────────────────────────────────────────
    fg = df["fear_greed_index"]
    print(f"\n{'='*64}")
    print("VALIDATION REPORT")
    print(f"{'='*64}")
    print(f"First date: {df.index.min().date()}   Last date: {df.index.max().date()}")
    print(f"Rows: {len(df)}   min={fg.min():.1f}  mean={fg.mean():.1f}  max={fg.max():.1f}")

    print(f"\n  Distribution:")
    print(f"    Extreme Fear  0-25  : {(fg < 25).sum():5,}  ({(fg < 25).mean()*100:.1f}%)")
    print(f"    Fear         25-45  : {((fg>=25)&(fg<45)).sum():5,}  ({((fg>=25)&(fg<45)).mean()*100:.1f}%)")
    print(f"    Neutral      45-55  : {((fg>=45)&(fg<55)).sum():5,}  ({((fg>=45)&(fg<55)).mean()*100:.1f}%)")
    print(f"    Greed        55-75  : {((fg>=55)&(fg<75)).sum():5,}  ({((fg>=55)&(fg<75)).mean()*100:.1f}%)")
    print(f"    Extreme Greed 75-100: {(fg >= 75).sum():5,}  ({(fg>=75).mean()*100:.1f}%)")

    print(f"\n  Notable extremes (index < 15):")
    xf = df[df["fear_greed_index"] < 15][["fear_greed_index"]].head(15)
    print(xf.to_string() if not xf.empty else "    None")

    print(f"\n  Component correlations:")
    print(df[components].corr().round(2).to_string())

    print(f"\n  Latest 5 trading days:")
    print(df.tail(5).to_string())

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
