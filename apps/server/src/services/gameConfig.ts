import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

const CACHE_KEY = 'game:config';
const CACHE_TTL = 300; // 5 minutes (in seconds for Redis)

export async function getGameConfig() {
  // Try Redis cache first (works across multiple server instances)
  if (redis) {
    try {
      const cached = await redis.get(CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Redis unavailable, fall through to DB
    }
  }

  const configs = await prisma.gameConfig.findMany();
  const result: Record<string, any> = {};
  for (const c of configs) {
    try {
      result[c.key] = JSON.parse(c.value);
    } catch {
      result[c.key] = c.value;
    }
  }

  // Cache in Redis
  if (redis) {
    try {
      await redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(result));
    } catch {
      // Redis unavailable, continue without caching
    }
  }

  return result;
}

export async function updateConfig(key: string, value: any, description?: string) {
  const stringValue = JSON.stringify(value);
  const config = await prisma.gameConfig.upsert({
    where: { key },
    update: { value: stringValue, description },
    create: { key, value: stringValue, description }
  });

  // Invalidate Redis cache
  if (redis) {
    try {
      await redis.del(CACHE_KEY);
    } catch {
      // Redis unavailable, continue
    }
  }

  return config;
}

// Default values if not in DB
export const DEFAULT_REMOTE_CONFIG = {
  fortressBaseHp: 200,
  fortressBaseDamage: 25,  // Increased from 10
  waveIntervalTicks: 90,
};
