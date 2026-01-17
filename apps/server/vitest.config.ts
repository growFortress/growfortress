import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/__tests__/helpers/setup.ts'],
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'test-jwt-secret-key-for-testing-purposes-only-minimum-32-chars',
      JWT_ACCESS_EXPIRY: '15m',
      JWT_REFRESH_EXPIRY: '7d',
      RUN_TOKEN_SECRET: 'test-run-token-secret-key-for-testing-minimum-32-chars',
      RUN_TOKEN_EXPIRY_SECONDS: '600',
      NODE_ENV: 'test',
      API_PREFIX: '',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/services/**/*.ts', 'src/lib/**/*.ts'],
    },
  },
});
