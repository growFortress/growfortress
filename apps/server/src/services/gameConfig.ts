import { prisma } from '../lib/prisma.js';

let configCache: Record<string, any> | null = null;
let lastFetch = 0;
const CACHE_TTL = 60000; // 1 minute

export async function getGameConfig() {
  const now = Date.now();
  if (configCache && now - lastFetch < CACHE_TTL) {
    return configCache;
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

  configCache = result;
  lastFetch = now;
  return result;
}

export async function updateConfig(key: string, value: any, description?: string) {
  const stringValue = JSON.stringify(value);
  const config = await prisma.gameConfig.upsert({
    where: { key },
    update: { value: stringValue, description },
    create: { key, value: stringValue, description }
  });

  configCache = null; // Invalidate cache
  return config;
}

// Default values if not in DB
export const DEFAULT_REMOTE_CONFIG = {
  fortressBaseHp: 100,
  fortressBaseDamage: 10,
  waveIntervalTicks: 90,
};
