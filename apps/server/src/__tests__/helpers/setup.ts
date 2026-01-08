/**
 * Test setup file for server tests
 */
import { vi, beforeEach, afterEach } from 'vitest';
import { mockPrisma, resetPrismaMock } from '../mocks/prisma.js';
import { mockRedis, resetRedisMock } from '../mocks/redis.js';

// Mock the prisma module
vi.mock('../../lib/prisma.js', () => ({
  prisma: mockPrisma,
  Prisma: {},
}));

// Mock the redis module
vi.mock('../../lib/redis.js', () => ({
  redis: mockRedis,
}));

// Mock the config module
vi.mock('../../config.js', () => ({
  config: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-key-for-testing-purposes-only-minimum-32-chars',
    JWT_ACCESS_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '7d',
    PORT: 3000,
    NODE_ENV: 'test',
    RUN_TOKEN_SECRET: 'test-run-token-secret-key-for-testing-minimum-32-chars',
    RUN_TOKEN_EXPIRY_SECONDS: 600,
    RATE_LIMIT_MAX: 100,
    RATE_LIMIT_WINDOW_MS: 60000,
  },
  parseDuration: (duration: string): number => {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 0;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 0;
    }
  },
}));

// Reset all mocks before each test
beforeEach(() => {
  resetPrismaMock();
  resetRedisMock();
  vi.clearAllMocks();
});

// Cleanup after each test
afterEach(() => {
  vi.restoreAllMocks();
});
