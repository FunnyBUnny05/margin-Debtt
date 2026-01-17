# Candlestick Chart Component

Interactive candlestick chart viewer for TradingView CSV exports.

## Features

- 📂 **File Upload**: Drag & drop or click to upload CSV files
- 📊 **Auto-mapping**: Automatically detects TradingView CSV headers (Time, Open, High, Low, Close, Volume)
- 🎨 **Professional Styling**: Dark-themed chart with green/red candlesticks and distinct wicks
- 📸 **Screenshot Export**: Download chart as PNG for AI vision analysis
- 📈 **Volume Histogram**: Optional volume bars displayed below price action
- 🔍 **Interactive Controls**: Zoom, pan, and hover for details
- 📱 **Responsive Design**: Works on mobile and desktop

## CSV Format

The component accepts CSV files with the following columns (case-insensitive):

- **Time/Date** (required): Timestamp in ISO format, Unix timestamp, or common date formats
- **Open** (required): Opening price
- **High** (required): Highest price
- **Low** (required): Lowest price
- **Close** (required): Closing price
- **Volume** (optional): Trading volume

### Example CSV

```csv
time,open,high,low,close,Volume
2024-01-01T00:00:00,150.25,152.80,149.50,151.75,1250000
2024-01-02T00:00:00,151.75,153.20,150.90,152.40,1100000
```

## Usage

1. Navigate to the "Candlestick Chart" tab in the application
2. Upload your TradingView CSV export
3. The chart will automatically render
4. Use mouse wheel to zoom, drag to pan
5. Click "Download Screenshot" to save as PNG

## Technical Details

- **Chart Library**: `lightweight-charts` by TradingView
- **CSV Parser**: `papaparse`
- **Styling**: Custom CSS matching the application's glassmorphism theme

## Color Scheme

- **Up Candles**: Green (#51cf66)
- **Down Candles**: Red (#ff6b6b)
- **Volume (Up)**: Green with transparency
- **Volume (Down)**: Red with transparency
- **Background**: Transparent (inherits from app theme)
- **Grid**: Subtle gray lines
- **Crosshair**: Cyan (#22d3ee)

## Sample File

A sample CSV file is available at `/public/sample-tradingview.csv` for testing.
