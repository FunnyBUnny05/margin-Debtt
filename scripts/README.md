# Data Fetching Scripts

This directory contains automated scripts for fetching live market data used by the margin-debt tracker dashboard.

## Scripts

### 1. fetch_finra_data.py
**Status**: ✅ Fully Automated

Fetches FINRA margin debt statistics from the official FINRA website.

- **Data Source**: FINRA Margin Statistics
- **URL**: https://www.finra.org/rules-guidance/key-topics/margin-accounts/margin-statistics
- **Update Frequency**: Weekly (Monday 6 AM UTC via GitHub Actions)
- **Output**: `public/margin_data.json`

**What it fetches**:
- Monthly margin account debit balances (securities margin debt in billions)
- Year-over-year growth percentages
- Historical data from 1997 to present

**Run manually**:
```bash
python scripts/fetch_finra_data.py
```

### 2. fetch_aaii_allocation.py
**Status**: ✅ Fully Automated (multi-source)

Fetches AAII Asset Allocation Survey data using multiple sources with automatic fallback.

- **Data Source**: AAII Asset Allocation Survey
- **Primary URL**: https://www.aaii.com/assetallocationsurvey
- **Fallback**: MacroMicro.me chart/series APIs
- **Update Frequency**: Weekly (Monday 6 AM UTC via GitHub Actions)
- **Output**: `public/aaii_allocation_data.json`

**Data sources tried (in order)**:
1. MacroMicro chart page (embedded data)
2. MacroMicro chart data API
3. MacroMicro individual series (stocks/bonds/cash)
4. AAII website (public survey results page)
5. Fallback: preserve existing historical data

**What it fetches**:
- Individual investor asset allocation percentages (stocks/bonds/cash)
- Monthly survey data from 1987 to present
- Automatically merges new months into historical dataset

**Run manually**:
```bash
python scripts/fetch_aaii_allocation.py
```

### 3. fetch_cboe_putcall.py
**Status**: ⚠️ Partially Automated (limited public access)

Attempts to fetch CBOE Put/Call Ratio data.

- **Data Source**: CBOE Equity Put/Call Ratio
- **URL**: https://www.cboe.com/tradable_products/sp_500/put-call_ratio/
- **Update Frequency**: Weekly (Monday 6 AM UTC via GitHub Actions)
- **Output**: `public/put_call_data.json`
- **Note**: CBOE doesn't provide a simple public API for historical Put/Call data. Script maintains existing data if fetch fails.

**What it fetches**:
- Monthly S&P 500 Put/Call ratio values
- Historical data from 2006 to present

**Run manually**:
```bash
python scripts/fetch_cboe_putcall.py
```

## Setup

Install required dependencies:

```bash
pip install -r requirements.txt
```

Or install individually:

```bash
pip install pandas openpyxl requests beautifulsoup4
```

## Automation

All scripts run automatically via GitHub Actions:

- **Schedule**: Every Monday at 6:00 AM UTC
- **Workflow File**: `.github/workflows/main.yml`
- **Manual Trigger**: Available via GitHub Actions "workflow_dispatch"

The workflow:
1. Runs all three data fetch scripts
2. Commits any updated data files
3. Rebuilds and deploys the dashboard to GitHub Pages

## Data Formats

All output files follow this JSON structure:

```json
{
  "last_updated": "ISO 8601 timestamp",
  "source": "Data source name",
  "source_url": "Source URL",
  "data": [
    {
      "date": "YYYY-MM-DD or YYYY-MM",
      // ... data-specific fields
    }
  ]
}
```

## Notes

- Scripts are designed to be resilient: if a fetch fails, existing data is preserved
- All scripts include fallback mechanisms and error handling
- The dashboard frontend also attempts live data fetching directly from FINRA as a primary source
- AAII and CBOE data may require manual updates due to access restrictions
