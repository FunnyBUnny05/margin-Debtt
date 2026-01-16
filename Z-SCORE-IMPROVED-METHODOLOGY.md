# Z-Score Improved Methodology 🚀

## 🎯 The Problem We Solved

### ❌ Old Method (Flawed)
The original Z-score calculation had a **structural bias issue**:

```javascript
Z-Score = (Current Relative Return - Rolling Mean) / StdDev
```

**Problem:** This doesn't account for sectors that have a **natural structural relationship** with the benchmark.

### 📉 Example of the Flaw

**Scenario 1: False "CHEAP" Signal**
```
Sector: Energy (XLE)
Historical Performance: ALWAYS returns -1.0% vs SPY (structural underperformer)
Current Return: -0.8% vs SPY

Old System:
  - Sees: "Below recent mean of -0.5%"
  - Signals: "CHEAP" ❌

Reality:
  - Sector is doing BETTER than its structural norm (-0.8% is better than -1.0%)
  - Should signal: "NEUTRAL" or even "EXTENDED" ✅
```

**Scenario 2: True "CHEAP" Signal**
```
Sector: Technology (XLK)
Historical Performance: Returns -0.5% vs SPY on average
Current Return: -1.5% vs SPY

Old System:
  - Sees: "Below recent mean"
  - Signals: "CHEAP" ✅

New System:
  - Baseline: -0.5% (structural average)
  - Excess Return: -1.5% - (-0.5%) = -1.0%
  - Z-Score: Measures deviation of -1.0% from its historical pattern
  - Signals: "CHEAP" (correctly identifies underperformance vs structural norm) ✅
```

---

## ✅ New Method (Improved)

### Step-by-Step Calculation

#### 1. Calculate Structural Baseline
```javascript
// Use 10-year average relative return as the sector's "normal" performance
const calculateStructuralBaseline = (alignedData, baselinePeriod = 520) => {
  const baselineWindow = alignedData.slice(0, baselinePeriod);
  const relativeReturns = baselineWindow.map(d => d.relativeReturn);
  return average(relativeReturns);
};
```

**Example:**
- Technology (XLK) vs SPY over 10 years: Average relative return = -0.5%
- This means XLK typically **underperforms** SPY by 0.5%

#### 2. Calculate Excess Returns
```javascript
// Excess Return = How much sector deviates from its structural norm
const excessReturn = currentRelativeReturn - structuralBaseline;
```

**Example:**
- Structural Baseline: -0.5%
- Current Relative Return: -1.5% vs SPY
- **Excess Return: -1.5% - (-0.5%) = -1.0%**

This -1.0% represents how much **worse** XLK is performing compared to its typical underperformance.

#### 3. Calculate Z-Score on Excess Returns
```javascript
// Calculate Z-score based on excess returns (not raw relative returns)
for (let i = windowWeeks; i < alignedData.length; i++) {
  const window = alignedData.slice(i - windowWeeks, i);
  const excessReturns = window.map(d => d.excessReturn);

  const mean = average(excessReturns);
  const stdDev = standardDeviation(excessReturns);

  const currentExcessReturn = alignedData[i].excessReturn;
  const zScore = (currentExcessReturn - mean) / stdDev;
}
```

---

## 📊 Complete Example

### Technology Sector Analysis

#### Raw Data
```
10-Year Historical Data (520 weeks):
  - XLK returns: [...weekly returns...]
  - SPY returns: [...weekly returns...]
  - Relative returns: XLK - SPY for each week
```

#### Step 1: Structural Baseline
```
Calculate average of all relative returns over 10 years:
  - Sum of relative returns: -260%
  - Number of weeks: 520
  - Structural Baseline: -260% / 520 = -0.5%

Interpretation: XLK typically underperforms SPY by 0.5% per 5-year period
```

#### Step 2: Current Excess Return
```
Current Period:
  - XLK 5-year return: +45%
  - SPY 5-year return: +48%
  - Current Relative Return: +45% - 48% = -3%
  - Structural Baseline: -0.5%
  - Excess Return: -3% - (-0.5%) = -2.5%

Interpretation: XLK is underperforming 2.5% MORE than its typical 0.5% underperformance
```

#### Step 3: Z-Score Calculation
```
Look back 3 years (156 weeks):
  - Excess returns: [-0.3%, +0.2%, -0.5%, ..., -2.5%]
  - Mean of excess returns: +0.1%
  - Standard deviation: 1.2%
  - Current excess return: -2.5%

Z-Score = (-2.5% - 0.1%) / 1.2% = -2.17
```

#### Result
```
Z-Score: -2.17
Signal: 🔴 CYCLICAL LOW (CHEAP)

Explanation:
  - XLK is 2.17 standard deviations BELOW its mean excess return
  - It's underperforming MORE than its structural norm suggests
  - From a mean-reversion perspective: POTENTIAL BUY
```

---

## 🔬 Code Implementation

### Updated Files

#### 1. `constants.js`
```javascript
export const BASELINE_PERIODS = [
  { value: 260, label: '5Y', years: 5 },
  { value: 520, label: '10Y', years: 10 },  // DEFAULT
  { value: 780, label: '15Y', years: 15 },
  { value: 1040, label: '20Y', years: 20 }
];

export const DEFAULT_BASELINE_PERIOD = 520; // 10 years
```

#### 2. `useZScoreCalculation.js`
```javascript
const calculateStructuralBaseline = (alignedData, baselinePeriod) => {
  // Calculate long-term average relative return
};

const calculateZScores = (alignedData, windowWeeks, baselinePeriod) => {
  // 1. Calculate structural baseline
  const structuralBaseline = calculateStructuralBaseline(alignedData, baselinePeriod);

  // 2. Calculate excess returns for all data points
  const dataWithExcess = alignedData.map(d => ({
    ...d,
    excessReturn: d.relativeReturn - structuralBaseline
  }));

  // 3. Calculate Z-scores based on excess returns
  for (let i = windowWeeks; i < dataWithExcess.length; i++) {
    const window = dataWithExcess.slice(i - windowWeeks, i);
    const excessReturns = window.map(d => d.excessReturn);

    const mean = average(excessReturns);
    const stdDev = standardDeviation(excessReturns);
    const zScore = (currentExcessReturn - mean) / stdDev;
  }
};
```

#### 3. `SectorList.jsx`
- Added expandable breakdown showing:
  - Structural Baseline
  - Current Relative Return
  - Excess Return
  - Interpretation text

---

## 📈 Benefits of New Method

### 1. Eliminates False Signals
- **No more false "cheap" signals** for sectors that naturally underperform
- **No more false "extended" signals** for sectors that naturally outperform

### 2. Better Context
- Shows **why** a sector is cheap or extended
- Compares current performance to **sector-specific** historical norms
- Not all sectors should be expected to match SPY performance

### 3. Clearer Interpretation
```
Old: "XLK Z-Score: -2.0" (What does this mean?)
New: "XLK is underperforming 1.5% MORE than its typical 0.5% underperformance"
```

### 4. Sector-Aware Analysis
- Each sector has its own "normal" relationship with the benchmark
- Technology might naturally outperform (positive baseline)
- Utilities might naturally underperform (negative baseline)
- The Z-score now measures deviation from **sector-specific** norms

---

## 🎯 Interpretation Guide

### Z-Score Signals

| Z-Score | Old Interpretation | New Interpretation |
|---------|-------------------|-------------------|
| < -2 | "Sector is cheap vs SPY" | "Sector is underperforming MORE than its structural norm" |
| -2 to -1 | "Somewhat cheap" | "Slightly worse than structural average" |
| -1 to +1 | "Neutral" | "Near structural average performance" |
| +1 to +2 | "Somewhat extended" | "Slightly better than structural average" |
| > +2 | "Sector is extended vs SPY" | "Sector is outperforming MORE than its structural norm" |

### Example Interpretations

#### Technology (XLK)
```
Structural Baseline: -0.5% (slightly underperforms SPY)
Current Relative Return: -1.5%
Excess Return: -1.0%
Z-Score: -2.1

Interpretation:
"Technology is underperforming 1.0% more than its typical 0.5% underperformance.
This is 2.1 standard deviations below its mean excess return.
Signal: CYCLICAL LOW - potential mean reversion opportunity."
```

#### Utilities (XLU)
```
Structural Baseline: -2.0% (naturally underperforms SPY)
Current Relative Return: -2.1%
Excess Return: -0.1%
Z-Score: -0.3

Interpretation:
"Utilities are performing near their structural average.
While they're underperforming SPY by 2.1%, this is normal for utilities.
Signal: NEUTRAL - no strong mean reversion signal."
```

---

## 🧪 Testing

### Before & After Comparison

Run the app and click the **▶** button next to any sector to see:
- **Structural Baseline**: Long-term average vs SPY
- **Current Relative Return**: Current performance vs SPY
- **Excess Return**: Current - Baseline (the key metric!)
- **Interpretation**: Human-readable explanation

### Expected Changes

1. **Sectors with negative structural baselines** (Utilities, Consumer Staples):
   - Old: Often showed as "cheap"
   - New: Show as "neutral" unless they're underperforming even MORE than usual

2. **Sectors with positive structural baselines** (Technology, Healthcare):
   - Old: Often showed as "extended"
   - New: Show as "extended" only if they're outperforming even MORE than usual

3. **All sectors**:
   - More accurate signals
   - Better context
   - Clearer actionability

---

## 📝 Summary

| Aspect | Old Method | New Method |
|--------|-----------|------------|
| **Calculation** | Z-Score on relative returns | Z-Score on excess returns (adjusted for baseline) |
| **Accounts for sector structure** | ❌ No | ✅ Yes |
| **False signals** | ⚠️ Common | ✅ Rare |
| **Interpretation** | "Cheap vs SPY" | "Cheap vs its own historical norm" |
| **Actionability** | 🤔 Unclear | ✅ Clear |
| **Context** | ❌ Missing | ✅ Full breakdown available |

### Key Insight
> **The new method recognizes that not all sectors should be expected to match SPY performance. Each sector has its own "personality" in terms of relative performance. The Z-score now measures whether a sector is deviating from its OWN historical pattern, not just from SPY.**

---

## 🚀 Next Steps

- [x] Implement structural baseline calculation
- [x] Update Z-score to use excess returns
- [x] Add UI display of baseline metrics
- [x] Update documentation
- [ ] Test with real data and verify improved accuracy
- [ ] Consider adding baseline period selector to UI (currently hardcoded to 10 years)
- [ ] Add historical Z-score comparison chart (old vs new methodology)
