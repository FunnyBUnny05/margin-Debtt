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
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'recharts-vendor': ['recharts'],
          'chartjs-vendor': ['chart.js', 'chartjs-adapter-date-fns'],
        }
      }
    }
  }
});
