# Testing Instructions for Candlestick Chart

## Quick Test Steps

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Open the application** in your browser (usually http://localhost:5173)

3. **Navigate to the Candlestick Chart tab**:
   - Click on the "📈 Candlestick Chart" button in the tab menu

4. **Test with Sample Data**:
   - Use the sample CSV file at `/public/sample-tradingview.csv`
   - Or download it from the public folder
   - Drag and drop it into the upload zone OR click to browse and select it

5. **Verify Chart Displays**:
   - ✅ Chart should render immediately after upload
   - ✅ Green candles for up days
   - ✅ Red candles for down days
   - ✅ Volume bars at the bottom (green/red based on price movement)
   - ✅ Interactive crosshair on hover
   - ✅ Zoom with mouse wheel
   - ✅ Pan by dragging

6. **Test Screenshot Download**:
   - Click the "📸 Download Screenshot" button
   - A PNG file should download automatically
   - Open the PNG to verify the chart is captured correctly

## Expected Behavior

### On Initial Load:
- Empty chart container with message: "Upload a CSV to view the chart"
- File upload area with drag & drop support

### After Uploading CSV:
- Success message: "✓ Loaded X candles with volume data"
- Chart displays immediately with candlesticks
- Time axis shows dates
- Price axis shows values
- Volume histogram at bottom

### Interactive Features:
- Hover: Crosshair appears with price/time info
- Scroll: Zoom in/out
- Click + Drag: Pan left/right
- Mobile: Touch gestures work

## Common Issues & Solutions

### Issue: Chart doesn't appear
**Solution**:
- Check browser console for errors
- Ensure CSV format is correct (Time, Open, High, Low, Close, Volume)
- Try refreshing the page

### Issue: Screenshot doesn't download
**Solution**:
- Make sure you've uploaded data first
- Check browser's download settings
- Try using a different browser

### Issue: CSV parsing error
**Solution**:
- Verify CSV has required columns (case-insensitive):
  - Time or Date
  - Open
  - High
  - Low
  - Close
  - Volume (optional)
- Check for empty rows
- Ensure values are numeric

## Sample CSV Format

```csv
time,open,high,low,close,Volume
2024-01-01T00:00:00,150.25,152.80,149.50,151.75,1250000
2024-01-02T00:00:00,151.75,153.20,150.90,152.40,1100000
```

## Browser Compatibility

Tested and working on:
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Performance Notes

- Handles up to 10,000+ candles smoothly
- Large datasets may take a few seconds to parse
- Screenshot quality matches canvas resolution
- Responsive design adapts to screen size
