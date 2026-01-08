import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'react': 'preact/compat',
      'react-dom': 'preact/compat',
      'react/jsx-runtime': 'preact/jsx-runtime',
    },
  },
  server: {
    port: 5173,
    hmr: {
      overlay: true,
      timeout: 30000, // Increased timeout to prevent reconnection spam
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;
          if (
            id.includes('pixi.js') ||
            id.includes('pixi-filters') ||
            id.includes('@pixi/particle-emitter')
          ) {
            return 'pixi';
          }
          if (id.includes('preact') || id.includes('@preact/signals')) {
            return 'preact';
          }
          if (id.includes('@fontsource')) {
            return 'fonts';
          }
          return 'vendor';
        },
      },
    },
  },
});
