# Z-Score Scoring System Explained

## 🎯 What is the Z-Score?

The Z-Score measures **how many standard deviations** a sector's relative performance is from its historical average.

### Key Formula

```
Z-Score = (Current Relative Return - Historical Mean) / Standard Deviation
```

Where:
- **Relative Return** = Sector Return - Benchmark Return
- **Historical Mean** = Average relative return over the lookback window (default: 3 years)
- **Standard Deviation** = Volatility of relative returns

## 📊 Step-by-Step Calculation

### Step 1: Calculate Returns
For each sector and the benchmark (SPY):
- Look back over a period (default: **5 years** = 260 weeks)
- Calculate percentage returns: `(Current Price / Past Price - 1) × 100`

### Step 2: Calculate Relative Returns
For each time point:
```
Relative Return = Sector Return - Benchmark Return
```

**Example:**
- XLK (Technology) return: +15%
- SPY (Benchmark) return: +10%
- Relative Return = +5%

This means technology **outperformed** the benchmark by 5%.

### Step 3: Calculate Z-Score
For the current point, look back over a window (default: **3 years** = 156 weeks):

1. Calculate **mean** of relative returns in the window
2. Calculate **standard deviation** of relative returns
3. Calculate Z-Score: `(Current Relative Return - Mean) / Std Dev`

### Step 4: Clamp and Interpret
- Z-Scores are clamped between -6 and +6
- Then interpreted based on thresholds

## 🔍 Interpretation

### Negative Z-Score (Technology is "CHEAP")

```
Z-Score < -2: Cyclical Low (CHEAP)
Z-Score -2 to -1: Somewhat Cheap
```

**What this means:**
- Technology is **UNDERPERFORMING** the benchmark
- Current relative return is **BELOW** its historical average
- From a mean-reversion perspective: **Potential buying opportunity**

**Important:** This is **RELATIVE** performance, not absolute valuation!
- Doesn't mean P/E ratios are low
- Doesn't mean stocks are fundamentally cheap
- Just means: "Technology has been lagging the market"

### Positive Z-Score (Technology is "EXTENDED")

```
Z-Score +1 to +2: Somewhat Extended
Z-Score > +2: Extended (EXPENSIVE)
```

**What this means:**
- Technology is **OUTPERFORMING** the benchmark
- Current relative return is **ABOVE** its historical average
- From a mean-reversion perspective: **Potential profit-taking opportunity**

## 🧮 Real-World Example

Let's say over the past 3 years:
- Technology's average relative return: **+2% per period**
- Standard deviation: **5%**
- Current relative return: **-8%**

```
Z-Score = (-8% - 2%) / 5% = -10 / 5 = -2.0
```

**Result:** Technology is **2 standard deviations BELOW** its mean
→ Signal: "Cyclical Low" (CHEAP)

**Why?** Technology has been underperforming the benchmark significantly compared to its historical pattern.

## ⚙️ Configuration

The calculation uses these parameters (from `/src/components/SectorZScore/constants.js`):

### Return Period (default: 5 years)
```javascript
RETURN_PERIODS = [
  { value: 52, label: '1Y', years: 1 },
  { value: 156, label: '3Y', years: 3 },
  { value: 260, label: '5Y', years: 5 },  // ← DEFAULT
  { value: 520, label: '10Y', years: 10 }
]
```

### Z-Window (default: 3 years)
```javascript
Z_WINDOWS = [
  { value: 52, label: '1Y', years: 1 },
  { value: 104, label: '2Y', years: 2 },
  { value: 156, label: '3Y', years: 3 },  // ← DEFAULT
  { value: 260, label: '5Y', years: 5 }
]
```

### Signal Thresholds
```javascript
SIGNAL_THRESHOLDS = {
  CYCLICAL_LOW: -2,   // Cheap signal
  CHEAP: -1,          // Somewhat cheap
  EXTENDED: 2         // Extended signal
}
```

## 🔬 Code Implementation

The calculation is in `/src/components/SectorZScore/hooks/useZScoreCalculation.js`:

```javascript
// 1. Calculate returns
const returns = calculateReturns(prices, returnPeriod);

// 2. Align sector and benchmark dates
const aligned = alignDates(sectorReturns, benchmarkReturns);

// 3. Calculate Z-scores with rolling window
for (let i = windowWeeks; i < alignedData.length; i++) {
  const window = alignedData.slice(i - windowWeeks, i);
  const relativeReturns = window.map(d => d.relativeReturn);

  const mean = average(relativeReturns);
  const stdDev = standardDeviation(relativeReturns);

  const currentRelReturn = alignedData[i].relativeReturn;
  let zScore = (currentRelReturn - mean) / stdDev;

  // Clamp to [-6, +6]
  zScore = Math.max(-6, Math.min(6, zScore));
}
```

## ❓ Why Technology Might Show as "CHEAP"

If the Z-score system says technology is cheap, it means:

1. **Recent Underperformance**: Technology ETF (XLK) has been underperforming SPY
2. **Below Historical Average**: Current relative return is significantly below the 3-year average
3. **Mean Reversion Signal**: Historically, when technology deviates this far, it tends to revert to the mean

**This is a RELATIVE measure, not fundamental analysis!**

To verify if technology is actually fundamentally cheap, you would need to:
- Check P/E ratios vs historical averages
- Analyze earnings growth
- Compare valuation metrics to other sectors
- Consider macroeconomic factors

## 🧪 Testing

I've created two files to help debug the Z-score:

1. **`debug-zscore.js`** - Explains the calculation logic
2. **`test-zscore-calculation.html`** - Interactive HTML tool that:
   - Fetches live data for XLK and SPY
   - Shows step-by-step calculation
   - Displays current Z-score
   - Shows recent history

**To use:** Open `test-zscore-calculation.html` in a browser

## 📝 Summary

| Z-Score Range | Signal | Meaning | Action |
|--------------|--------|---------|--------|
| < -2 | 🔴 Cyclical Low | Sector is cheap vs benchmark | Potential BUY |
| -2 to -1 | 🟡 Somewhat Cheap | Below average | Watch |
| -1 to +1 | ⚪ Neutral | Near average | Hold |
| +1 to +2 | 🟡 Somewhat Extended | Above average | Watch |
| > +2 | 🟢 Extended | Sector is expensive vs benchmark | Potential SELL |

**Remember:** This is a **mean-reversion trading signal**, not a fundamental valuation metric!
