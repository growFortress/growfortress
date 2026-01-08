/**
 * Redis mock for testing
 */
import { vi } from 'vitest';

// In-memory store for mock Redis
let store: Map<string, string> = new Map();
let expirations: Map<string, number> = new Map();

export const mockRedis = {
  // Basic operations
  get: vi.fn(async (key: string): Promise<string | null> => {
    const expiration = expirations.get(key);
    if (expiration && Date.now() > expiration) {
      store.delete(key);
      expirations.delete(key);
      return null;
    }
    return store.get(key) ?? null;
  }),

  set: vi.fn(async (key: string, value: string): Promise<'OK'> => {
    store.set(key, value);
    return 'OK';
  }),

  setex: vi.fn(async (key: string, seconds: number, value: string): Promise<'OK'> => {
    store.set(key, value);
    expirations.set(key, Date.now() + seconds * 1000);
    return 'OK';
  }),

  del: vi.fn(async (...keys: string[]): Promise<number> => {
    let deleted = 0;
    for (const key of keys) {
      if (store.delete(key)) {
        expirations.delete(key);
        deleted++;
      }
    }
    return deleted;
  }),

  exists: vi.fn(async (...keys: string[]): Promise<number> => {
    let count = 0;
    for (const key of keys) {
      if (store.has(key)) {
        const expiration = expirations.get(key);
        if (!expiration || Date.now() <= expiration) {
          count++;
        }
      }
    }
    return count;
  }),

  expire: vi.fn(async (key: string, seconds: number): Promise<number> => {
    if (store.has(key)) {
      expirations.set(key, Date.now() + seconds * 1000);
      return 1;
    }
    return 0;
  }),

  ttl: vi.fn(async (key: string): Promise<number> => {
    const expiration = expirations.get(key);
    if (!expiration) return -1;
    const remaining = Math.ceil((expiration - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }),

  // Hash operations
  hset: vi.fn(async (key: string, field: string, value: string): Promise<number> => {
    const existing = store.get(key);
    const hash = existing ? JSON.parse(existing) : {};
    const isNew = !(field in hash);
    hash[field] = value;
    store.set(key, JSON.stringify(hash));
    return isNew ? 1 : 0;
  }),

  hget: vi.fn(async (key: string, field: string): Promise<string | null> => {
    const existing = store.get(key);
    if (!existing) return null;
    const hash = JSON.parse(existing);
    return hash[field] ?? null;
  }),

  hgetall: vi.fn(async (key: string): Promise<Record<string, string>> => {
    const existing = store.get(key);
    if (!existing) return {};
    return JSON.parse(existing);
  }),

  hdel: vi.fn(async (key: string, ...fields: string[]): Promise<number> => {
    const existing = store.get(key);
    if (!existing) return 0;
    const hash = JSON.parse(existing);
    let deleted = 0;
    for (const field of fields) {
      if (field in hash) {
        delete hash[field];
        deleted++;
      }
    }
    store.set(key, JSON.stringify(hash));
    return deleted;
  }),

  // Sorted set operations (for leaderboard caching)
  zadd: vi.fn(async (key: string, ...args: (string | number)[]): Promise<number> => {
    const existing = store.get(key);
    const zset: [number, string][] = existing ? JSON.parse(existing) : [];
    let added = 0;

    for (let i = 0; i < args.length; i += 2) {
      const score = Number(args[i]);
      const member = String(args[i + 1]);
      const existingIdx = zset.findIndex(([_, m]) => m === member);

      if (existingIdx === -1) {
        zset.push([score, member]);
        added++;
      } else {
        zset[existingIdx] = [score, member];
      }
    }

    zset.sort((a, b) => b[0] - a[0]); // Sort descending by score
    store.set(key, JSON.stringify(zset));
    return added;
  }),

  zrange: vi.fn(async (key: string, start: number, stop: number, options?: { REV?: boolean }): Promise<string[]> => {
    const existing = store.get(key);
    if (!existing) return [];
    const zset: [number, string][] = JSON.parse(existing);
    const result = zset.slice(start, stop === -1 ? undefined : stop + 1);
    return options?.REV ? result.reverse().map(([_, m]) => m) : result.map(([_, m]) => m);
  }),

  zrank: vi.fn(async (key: string, member: string): Promise<number | null> => {
    const existing = store.get(key);
    if (!existing) return null;
    const zset: [number, string][] = JSON.parse(existing);
    const idx = zset.findIndex(([_, m]) => m === member);
    return idx === -1 ? null : idx;
  }),

  zscore: vi.fn(async (key: string, member: string): Promise<string | null> => {
    const existing = store.get(key);
    if (!existing) return null;
    const zset: [number, string][] = JSON.parse(existing);
    const entry = zset.find(([_, m]) => m === member);
    return entry ? String(entry[0]) : null;
  }),

  // Event handlers (for connection events)
  on: vi.fn(),

  // Pipeline support
  pipeline: vi.fn(() => ({
    get: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    setex: vi.fn().mockReturnThis(),
    del: vi.fn().mockReturnThis(),
    exec: vi.fn(async () => []),
  })),

  // Connection
  quit: vi.fn(async () => 'OK'),
  disconnect: vi.fn(),
};

/**
 * Reset all Redis mocks and clear store
 */
export function resetRedisMock(): void {
  store = new Map();
  expirations = new Map();

  // Reset all mock functions
  mockRedis.get.mockClear();
  mockRedis.set.mockClear();
  mockRedis.setex.mockClear();
  mockRedis.del.mockClear();
  mockRedis.exists.mockClear();
  mockRedis.expire.mockClear();
  mockRedis.ttl.mockClear();
  mockRedis.hset.mockClear();
  mockRedis.hget.mockClear();
  mockRedis.hgetall.mockClear();
  mockRedis.hdel.mockClear();
  mockRedis.zadd.mockClear();
  mockRedis.zrange.mockClear();
  mockRedis.zrank.mockClear();
  mockRedis.zscore.mockClear();
  mockRedis.on.mockClear();
  mockRedis.pipeline.mockClear();
  mockRedis.quit.mockClear();
  mockRedis.disconnect.mockClear();

  // Restore default implementations
  mockRedis.get.mockImplementation(async (key: string) => {
    const expiration = expirations.get(key);
    if (expiration && Date.now() > expiration) {
      store.delete(key);
      expirations.delete(key);
      return null;
    }
    return store.get(key) ?? null;
  });

  mockRedis.set.mockImplementation(async (key: string, value: string) => {
    store.set(key, value);
    return 'OK';
  });

  mockRedis.setex.mockImplementation(async (key: string, seconds: number, value: string) => {
    store.set(key, value);
    expirations.set(key, Date.now() + seconds * 1000);
    return 'OK';
  });
}

/**
 * Helper to set a value directly in the mock store (for test setup)
 */
export function setMockRedisValue(key: string, value: string, ttlSeconds?: number): void {
  store.set(key, value);
  if (ttlSeconds) {
    expirations.set(key, Date.now() + ttlSeconds * 1000);
  }
}

/**
 * Helper to get all keys in the mock store (for assertions)
 */
export function getMockRedisKeys(): string[] {
  return Array.from(store.keys());
}

/**
 * Helper to clear the mock store without resetting mock functions
 */
export function clearMockRedisStore(): void {
  store.clear();
  expirations.clear();
}
