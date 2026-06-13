import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // For GitHub Pages deployment
  build: {
    outDir: 'dist',
    // Increase the chunk size warning threshold (charts are large by nature)
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split vendor libraries into separate chunks for better caching
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            if (id.includes('recharts')) {
              return 'recharts-vendor';
            }
            if (id.includes('chart.js') || id.includes('chartjs-adapter-date-fns')) {
              return 'chartjs-vendor';
            }
          }
        }
      }
    }
  }
});
