#!/usr/bin/env python3
"""
Fear & Greed Index Calculator
Computes a 0-100 composite sentiment indicator from 7 components.
Output: fear_greed_index.csv  (1998-01-01 → present)

All data sources verified free and programmatically accessible:

  Source              Series / Ticker         Coverage
  ──────────────────  ──────────────────────  ─────────────
  yfinance            ^GSPC                   1928 → today
  yfinance            ^TNX  (10-yr yield)     1962 → today
  yfinance            ^VIX                    1990 → today
  yfinance            ^RUT  (Russell 2000)    1979 → today
  FRED fredgraph.csv  DAAA  (AAA corp yield)  1983 → today  *daily, full history
  FRED fredgraph.csv  DBAA  (BAA corp yield)  1986 → today  *daily, full history
  CBOE CDN            total.csv (P/C ratio)   1995 → today  *may be IP-blocked locally
                      ↳ fallback: VIX/SMA-126 ratio (same fear signal, different metric)

Why DAAA/DBAA instead of BAMLH0A0HYM2/BAMLC0A0CM?
  The BAML/ICE OAS series on FRED are licensed — FRED's public fredgraph.csv
  endpoint only returns the most recent ~793 rows (~3 years) for those series.
  DAAA and DBAA (Moody's) are unrestricted and return full daily history since
  the 1980s through the same endpoint. The BAA-AAA quality spread captures the
  same credit-risk sentiment signal (widens in fear, tightens in greed).

Why SPX 52-week range position instead of FRED HIGNLOWS?
  FRED series 'HIGNLOWS' returns HTTP 404 — it does not exist in FRED's public API.
  The SPX 52-week price range position (0 = at 52-week low, 1 = at 52-week high)
  captures the same breadth concept: a market near its 52-week high implies
  widespread individual stock strength. Available from yfinance since 1928.

Why RUT-SPX return differential for McClellan instead of FRED BPANDI?
  FRED series 'BPANDI' returns HTTP 404. The daily Russell 2000 vs S&P 500
  return differential proxies NYSE advance/decline breadth: when small-caps
  outperform large-caps (broad participation), breadth is expanding (greed).
  The EMA19 - EMA39 formula mirrors the traditional McClellan Oscillator.
"""

import warnings, sys
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
FETCH_START  = "1986-01-01"   # earliest needed: DBAA starts 1986-01-02
INDEX_START  = "1998-01-01"   # effective first output date per spec
TODAY        = date.today().isoformat()
OUTPUT_FILE  = "public/fear_greed_index.csv"
NORM_WINDOW  = 730            # rolling normalization window (trading observations)
NORM_MIN_PER = 365            # min observations before normalization activates


# ── FRED Helper ───────────────────────────────────────────────────────────────
def _fred_csv(series_id: str) -> pd.Series:
    """
    Fetch a FRED series via the public fredgraph.csv endpoint.
    For unrestricted series (DAAA, DBAA, VIXCLS, etc.) this returns FULL history.
    """
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
    tickers = ["^GSPC", "^TNX", "^VIX", "^RUT"]
    print(f"  [yfinance] {tickers}")
    raw = yf.download(tickers, start=FETCH_START, end=TODAY,
                      auto_adjust=True, progress=False, threads=True)
    close = raw["Close"] if isinstance(raw.columns, pd.MultiIndex) else raw
    return {t: close[t].dropna() for t in tickers}


def fetch_fred_credit() -> tuple:
    """
    Fetch Moody's daily AAA and BAA corporate bond yields from FRED.
    Returns full history (1983+/1986+) — no licensing restriction.
    """
    print("  [FRED] DAAA (Moody's AAA daily)")
    daaa = _fred_csv("DAAA")
    print(f"         {daaa.index[0].date()} → {daaa.index[-1].date()}  ({len(daaa):,} obs)")

    print("  [FRED] DBAA (Moody's BAA daily)")
    dbaa = _fred_csv("DBAA")
    print(f"         {dbaa.index[0].date()} → {dbaa.index[-1].date()}  ({len(dbaa):,} obs)")

    return daaa, dbaa


def fetch_cboe_putcall():  # -> pd.Series | None
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

    print("  [CBOE] All sources returned 403/timeout (IP-blocked locally).")
    print("         → Using VIX/SMA-126 ratio as put/call proxy (same fear signal).")
    return None


# ── Component Computations ────────────────────────────────────────────────────

def comp_momentum(gspc: pd.Series) -> pd.Series:
    """SPX vs 125-day SMA. Higher = greed. No inversion."""
    sma = gspc.rolling(window=125, min_periods=63).mean()
    return ((gspc - sma) / sma * 100).rename("momentum")


def comp_strength(gspc: pd.Series) -> pd.Series:
    """
    SPX 52-week (252-day) price range position.
    0 = at 252-day low (all lows), 1 = at 252-day high (all highs).
    Higher = greed. No inversion.
    """
    lo  = gspc.rolling(252, min_periods=126).min()
    hi  = gspc.rolling(252, min_periods=126).max()
    rng = hi - lo
    s   = (gspc - lo) / rng
    return s.where(rng > 0, 0.5).rename("strength")


def comp_breadth(gspc: pd.Series, rut: pd.Series) -> pd.Series:
    """
    McClellan-style oscillator from (RUT - SPX) daily return differential.
    When small caps outperform large caps → broad participation → greed.
    EMA19 - EMA39 mirrors the traditional McClellan formula.
    Higher = greed. No inversion.
    """
    ad    = rut.pct_change(1) - gspc.pct_change(1)
    ema19 = ad.ewm(span=19, adjust=False).mean()
    ema39 = ad.ewm(span=39, adjust=False).mean()
    return (ema19 - ema39).rename("breadth")


def comp_putcall(pc: pd.Series) -> pd.Series:
    """CBOE Total Put/Call. Higher ratio = fear → inverted after normalization."""
    return pc.rename("put_call")


def comp_putcall_proxy(vix: pd.Series) -> pd.Series:
    """
    VIX / 126-day SMA  (VIX relative to its 6-month average).
    When VIX is well above its recent average, put buying is unusually elevated.
    Higher ratio = more put buying = fear → inverted after normalization.
    Distinct from the raw VIX level used in the Volatility component.
    """
    vix_sma = vix.rolling(126, min_periods=63).mean()
    ratio   = vix / vix_sma
    return ratio.where(vix_sma > 0, np.nan).rename("put_call")


def comp_volatility(vix: pd.Series) -> pd.Series:
    """VIX closing level. Higher = fear → inverted after normalization."""
    return vix.rename("volatility")


def comp_junk_bond(dbaa: pd.Series, daaa: pd.Series) -> pd.Series:
    """
    Moody's BAA yield minus AAA yield (quality credit spread).
    Widens during fear (credit stress), tightens during greed.
    Higher spread = fear → inverted after normalization.
    """
    return (dbaa - daaa).rename("junk_bond")


def comp_safe_haven(gspc: pd.Series, tnx: pd.Series) -> pd.Series:
    """
    SPX 20-day return minus TNX 20-day yield change.
    Higher = equities outperforming bonds = greed. No inversion.
    """
    return (gspc.pct_change(20) - tnx.pct_change(20)).rename("safe_haven")


# ── Normalization ─────────────────────────────────────────────────────────────

def normalize(s: pd.Series, invert: bool = False) -> pd.Series:
    """
    Rolling min-max normalization over NORM_WINDOW observations (min NORM_MIN_PER).
    Vectorized (no rolling.apply). Flat window → 50. Clamped to [0, 100].
    """
    rmin = s.rolling(window=NORM_WINDOW, min_periods=NORM_MIN_PER).min()
    rmax = s.rolling(window=NORM_WINDOW, min_periods=NORM_MIN_PER).max()
    rng  = rmax - rmin
    norm = (s - rmin) / rng * 100
    norm = norm.where(rng != 0, 50.0)
    if invert:
        norm = 100 - norm
    return norm.clip(0, 100)


# ── Alignment ─────────────────────────────────────────────────────────────────

def align(raw: dict, master_idx: pd.DatetimeIndex) -> dict:
    """Reindex all series to master trading-day index; ffill then bfill (≤5 days)."""
    return {name: s.reindex(master_idx).ffill().bfill(limit=5)
            for name, s in raw.items()}


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
    tnx  = mkt["^TNX"]
    vix  = mkt["^VIX"]
    rut  = mkt["^RUT"]

    print("\n[2/5] Credit spreads (FRED DAAA / DBAA)…")
    daaa, dbaa = fetch_fred_credit()

    print("\n[3/5] CBOE Put/Call ratio…")
    cboe_pc = fetch_cboe_putcall()

    # 2. Raw components ────────────────────────────────────────────────────────
    print("\n[4/5] Computing components…")
    raw = {
        "momentum":   comp_momentum(gspc),
        "strength":   comp_strength(gspc),
        "breadth":    comp_breadth(gspc, rut),
        "put_call":   comp_putcall(cboe_pc) if cboe_pc is not None
                      else comp_putcall_proxy(vix),
        "volatility": comp_volatility(vix),
        "junk_bond":  comp_junk_bond(dbaa, daaa),
        "safe_haven": comp_safe_haven(gspc, tnx),
    }

    using_pc_proxy = cboe_pc is None
    pc_label = "VIX/SMA-126 proxy" if using_pc_proxy else "CBOE total P/C"
    print(f"  put_call source: {pc_label}")

    # 3. Align to ^GSPC trading-day master index ───────────────────────────────
    master_idx = gspc.sort_index().index
    aligned    = align(raw, master_idx)

    # 4. Normalize (invert fear components) ───────────────────────────────────
    INVERT = {"put_call", "volatility", "junk_bond"}
    normed = {name: normalize(s, invert=(name in INVERT))
              for name, s in aligned.items()}

    # 5. Assemble ──────────────────────────────────────────────────────────────
    print("\n[5/5] Assembling index…")
    df = pd.DataFrame(normed).dropna()
    df = df[df.index >= INDEX_START]

    components = ["momentum", "strength", "breadth", "put_call",
                  "volatility", "junk_bond", "safe_haven"]
    df["fear_greed_index"] = df[components].mean(axis=1)

    df = df[["fear_greed_index"] + components].round(2)
    df.index.name = "date"
    df.to_csv(OUTPUT_FILE)
    print(f"  Saved → {OUTPUT_FILE}  ({len(df):,} rows)")

    # 6. Validation ────────────────────────────────────────────────────────────
    fg = df["fear_greed_index"]
    print(f"\n{'='*64}")
    print("VALIDATION REPORT")
    print(f"{'='*64}")
    print(f"  First date           : {df.index[0].date()}")
    print(f"  Last date            : {df.index[-1].date()}")
    print(f"  Total trading days   : {len(df):,}")
    print(f"  put_call source      : {pc_label}")

    print(f"\n  Fear & Greed Index:")
    print(f"    Min   {fg.min():.2f}   (Extreme Fear)")
    print(f"    Max   {fg.max():.2f}   (Extreme Greed)")
    print(f"    Mean  {fg.mean():.2f}")
    print(f"    Std   {fg.std():.2f}")

    print(f"\n  Distribution:")
    print(f"    Extreme Fear  0–25  : {(fg < 25).sum():5,} days  ({(fg < 25).mean()*100:.1f}%)")
    print(f"    Fear         25–45  : {((fg>=25)&(fg<45)).sum():5,} days  ({((fg>=25)&(fg<45)).mean()*100:.1f}%)")
    print(f"    Neutral      45–55  : {((fg>=45)&(fg<55)).sum():5,} days  ({((fg>=45)&(fg<55)).mean()*100:.1f}%)")
    print(f"    Greed        55–75  : {((fg>=55)&(fg<75)).sum():5,} days  ({((fg>=55)&(fg<75)).mean()*100:.1f}%)")
    print(f"    Extreme Greed 75–100: {(fg >= 75).sum():5,} days  ({(fg>=75).mean()*100:.1f}%)")

    print(f"\n  Notable extremes (Extreme Fear, index < 20):")
    xf = df[df["fear_greed_index"] < 20][["fear_greed_index"]].head(10)
    print(xf.to_string() if not xf.empty else "    None in this period")

    print(f"\n  Component Correlation Matrix:")
    print(df[components].corr().round(3).to_string())

    print(f"\n  Latest 5 trading days:")
    print(df.tail(5).to_string())

    return df


if __name__ == "__main__":
    main()
