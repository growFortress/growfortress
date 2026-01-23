import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Setup file to disable WASM before any imports
    setupFiles: ['./vitest.setup.ts'],
  },
});
