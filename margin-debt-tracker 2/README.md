# FINRA Margin Debt Tracker

Live dashboard tracking FINRA margin debt with year-over-year growth analysis. Data auto-updates weekly via GitHub Actions.

![Dashboard Preview](https://img.shields.io/badge/Data-Live-brightgreen)

## Features

- **Live Data**: Auto-fetches FINRA margin statistics weekly
- **YoY Growth Analysis**: Tracks year-over-year growth with historical ±30% threshold indicators
- **Historical Context**: Compares current levels to 2000 and 2021 peaks
- **Time Range Filters**: 2Y, 5Y, 10Y, All-time views
- **Zero Backend**: Runs entirely on GitHub Pages

## Quick Deploy to GitHub

### 1. Create Repository

```bash
# Clone or download this folder, then:
cd margin-debt-tracker
git init
git add .
git commit -m "Initial commit"

# Create new repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/margin-debt-tracker.git
git branch -M main
git push -u origin main
```

### 2. Enable GitHub Pages

1. Go to your repo → **Settings** → **Pages**
2. Under "Build and deployment":
   - Source: **GitHub Actions**
3. That's it! The workflow will auto-trigger on push.

### 3. Access Your Dashboard

After the first workflow completes (~2-3 min):
- URL: `https://YOUR_USERNAME.github.io/margin-debt-tracker/`

## Data Updates

The GitHub Action runs:
- **Automatically**: Every Monday at 6 AM UTC
- **On push**: Any push to `main` branch
- **Manually**: Go to Actions → "Update FINRA Data & Deploy" → "Run workflow"

FINRA typically publishes new data the third week of each month, so the weekly Monday schedule catches updates promptly.

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Project Structure

```
margin-debt-tracker/
├── .github/workflows/
│   └── deploy.yml          # GitHub Actions workflow
├── public/
│   └── margin_data.json    # Data file (auto-updated)
├── scripts/
│   └── fetch_finra_data.py # Data fetcher script
├── src/
│   ├── App.jsx             # Main React component
│   └── main.jsx            # Entry point
├── index.html
├── package.json
└── vite.config.js
```

## Data Source

- **Source**: [FINRA Margin Statistics](https://www.finra.org/rules-guidance/key-topics/margin-accounts/margin-statistics)
- **Metric**: Debit Balances in Customers' Securities Margin Accounts
- **Frequency**: Monthly (published ~3rd week of following month)
- **History**: January 1997 to present

## Interpretation

| YoY Growth | Signal |
|------------|--------|
| > +30% | Euphoria zone - historically preceded major corrections |
| +10% to +30% | Elevated leverage |
| -10% to +10% | Normal range |
| < -30% | Capitulation zone - often near market bottoms |

### Historical Peaks Before Crashes

| Date | YoY Growth | What Followed |
|------|------------|---------------|
| Mar 2000 | +80% | Dot-com crash |
| Jul 2007 | +62% | Financial crisis |
| Mar 2021 | +71% | 2022 bear market |

## License

MIT
