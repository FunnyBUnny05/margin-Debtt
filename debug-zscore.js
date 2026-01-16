// Debug script to analyze Z-score calculations
// This will show step-by-step how the Z-score is calculated

const fs = require('fs');

// Simulate the Z-score calculation logic
const calculateReturns = (prices, periodWeeks) => {
  if (!prices || prices.length < periodWeeks) return [];

  const returns = [];
  for (let i = periodWeeks; i < prices.length; i++) {
    const currentPrice = prices[i].price;
    const pastPrice = prices[i - periodWeeks].price;
    if (pastPrice > 0) {
      returns.push({
        date: prices[i].date,
        return: (currentPrice / pastPrice - 1) * 100
      });
    }
  }
  return returns;
};

const alignDates = (sectorReturns, benchmarkReturns) => {
  const benchmarkMap = new Map();
  for (const br of benchmarkReturns) {
    const dateKey = new Date(br.date).toISOString().split('T')[0];
    benchmarkMap.set(dateKey, br.return);
  }

  const aligned = [];
  for (const sr of sectorReturns) {
    const dateKey = new Date(sr.date).toISOString().split('T')[0];

    let benchmarkReturn = benchmarkMap.get(dateKey);

    if (benchmarkReturn === undefined) {
      const sectorDate = new Date(sr.date).getTime();
      for (const [key, value] of benchmarkMap) {
        const benchDate = new Date(key).getTime();
        if (Math.abs(sectorDate - benchDate) <= 7 * 24 * 60 * 60 * 1000) {
          benchmarkReturn = value;
          break;
        }
      }
    }

    if (benchmarkReturn !== undefined) {
      aligned.push({
        date: sr.date,
        sectorReturn: sr.return,
        benchmarkReturn,
        relativeReturn: sr.return - benchmarkReturn
      });
    }
  }

  return aligned;
};

const calculateZScores = (alignedData, windowWeeks) => {
  if (alignedData.length < windowWeeks) return [];

  const zScores = [];

  for (let i = windowWeeks; i < alignedData.length; i++) {
    const window = alignedData.slice(i - windowWeeks, i);
    const relativeReturns = window.map(d => d.relativeReturn);

    const mean = relativeReturns.reduce((a, b) => a + b, 0) / relativeReturns.length;
    const variance = relativeReturns.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / relativeReturns.length;
    const stdDev = Math.sqrt(variance);

    const currentRelReturn = alignedData[i].relativeReturn;
    let zScore = stdDev > 0 ? (currentRelReturn - mean) / stdDev : 0;

    // Clamp z-score to -6 to +6
    zScore = Math.max(-6, Math.min(6, zScore));

    zScores.push({
      date: alignedData[i].date,
      zScore,
      relativeReturn: currentRelReturn,
      sectorReturn: alignedData[i].sectorReturn,
      benchmarkReturn: alignedData[i].benchmarkReturn,
      mean,
      stdDev
    });
  }

  return zScores;
};

console.log('='.repeat(80));
console.log('Z-SCORE CALCULATION EXPLAINED');
console.log('='.repeat(80));
console.log();
console.log('HOW IT WORKS:');
console.log('1. Calculate returns over a period (default: 5 years = 260 weeks)');
console.log('2. Calculate relative returns: Sector Return - Benchmark Return');
console.log('3. For each data point, look back at a window (default: 3 years = 156 weeks)');
console.log('4. Calculate Z-Score: (Current Relative Return - Mean) / Std Dev');
console.log();
console.log('INTERPRETATION:');
console.log('  Z-Score < -2: Sector is CHEAP (underperforming vs benchmark)');
console.log('  Z-Score -2 to +2: NEUTRAL');
console.log('  Z-Score > +2: Sector is EXTENDED (outperforming vs benchmark)');
console.log();
console.log('IMPORTANT:');
console.log('  - Negative Z-score = Sector underperforming = "cheap"');
console.log('  - Positive Z-score = Sector outperforming = "expensive/extended"');
console.log('  - This is RELATIVE performance, not absolute valuation');
console.log();
console.log('='.repeat(80));
console.log();

// Example calculation
console.log('EXAMPLE CALCULATION:');
console.log();
console.log('Imagine over the past 3 years (156 weeks):');
console.log('  - Technology average relative return: +2% per period');
console.log('  - Standard deviation: 5%');
console.log('  - Current relative return: -8%');
console.log();
console.log('Z-Score = (-8% - 2%) / 5% = -10 / 5 = -2.0');
console.log();
console.log('This means: Technology is 2 standard deviations BELOW its mean');
console.log('Result: Technology is at a "cyclical low" - historically cheap vs SPY');
console.log();
console.log('='.repeat(80));
