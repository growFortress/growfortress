/**
 * Hub Preview Service
 * Fetches public hub data for viewing other players' configurations
 */

import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import type {
  HubPreviewResponse,
  HubPreviewHero,
  HubPreviewTurret,
  HubPreviewArtifact,
} from '@arcade/protocol';
import { FREE_STARTER_HEROES, FREE_STARTER_TURRETS } from '@arcade/protocol';

// Cache configuration
const CACHE_KEY_PREFIX = 'hub:preview:';
const CACHE_TTL = 300; // 5 minutes

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }

  return [];
}

// Types for parsing JSON fields
interface HeroUpgradeData {
  heroId: string;
  statUpgrades: {
    hp?: number;
    damage?: number;
    attackSpeed?: number;
    range?: number;
    critChance?: number;
    critMultiplier?: number;
    armor?: number;
    dodge?: number;
  };
}

interface TurretUpgradeData {
  turretType: string;
  statUpgrades: {
    damage?: number;
    attackSpeed?: number;
    range?: number;
    critChance?: number;
    critMultiplier?: number;
  };
}

/**
 * Get hub preview for a specific user
 * Returns null if user doesn't exist or is banned
 */
export async function getHubPreview(userId: string): Promise<HubPreviewResponse | null> {
  // Check cache first
  const cacheKey = `${CACHE_KEY_PREFIX}${userId}`;
  let cached: string | null = null;
  try {
    cached = await redis.get(cacheKey);
  } catch (error) {
    console.warn('Failed to read hub preview cache', { userId, error });
  }
  if (cached) {
    try {
      return JSON.parse(cached) as HubPreviewResponse;
    } catch (error) {
      console.warn('Invalid hub preview cache payload', { userId, error });
      await redis.del(cacheKey).catch(() => {});
    }
  }

  // Fetch user with all related data in a single query
  const user = await prisma.user.findUnique({
    where: { id: userId, banned: false },
    select: {
      id: true,
      displayName: true,
      description: true,
      highestWave: true,
      defaultFortressClass: true,
      exclusiveItems: true,
      progression: {
        select: { level: true },
      },
      powerUpgrades: {
        select: {
          heroUpgrades: true,
          turretUpgrades: true,
          cachedTotalPower: true,
        },
      },
      inventory: {
        select: {
          unlockedHeroIds: true,
          unlockedTurretIds: true,
        },
      },
      artifacts: {
        where: { equippedToHeroId: { not: null } },
        select: {
          artifactId: true,
          level: true,
          equippedSlot: true,
          equippedToHeroId: true,
        },
      },
      guildMembership: {
        select: {
          guildId: true,
          guild: {
            select: { tag: true },
          },
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  // Parse power upgrades JSON
  const heroUpgradesData = parseJsonArray<HeroUpgradeData>(
    user.powerUpgrades?.heroUpgrades
  );
  const turretUpgradesData = parseJsonArray<TurretUpgradeData>(
    user.powerUpgrades?.turretUpgrades
  );
  const unlockedHeroIds = parseJsonArray<string>(user.inventory?.unlockedHeroIds);
  const unlockedTurretIds = parseJsonArray<string>(user.inventory?.unlockedTurretIds);

  // Build heroes array from unlocked heroes + starter heroes
  const heroSet = new Set<string>([
    ...FREE_STARTER_HEROES,
    ...unlockedHeroIds,
  ]);
  const heroIds = Array.from(heroSet);
  const heroes: HubPreviewHero[] = heroIds.map((heroId) => {
    // Find upgrade data for this hero
    const upgrades = heroUpgradesData.find((h) => h.heroId === heroId);
    const statUpgrades = upgrades?.statUpgrades ?? {};

    // Calculate total level as sum of stat upgrades
    const level = (statUpgrades.hp ?? 0) + (statUpgrades.damage ?? 0);

    // Get equipped artifacts for this hero
    const equippedArtifacts: HubPreviewArtifact[] = user.artifacts
      .filter((a) => a.equippedToHeroId === heroId && a.equippedSlot)
      .map((a) => ({
        artifactId: a.artifactId,
        slotType: a.equippedSlot as 'weapon' | 'armor' | 'accessory',
        level: a.level,
      }));

    return {
      heroId,
      tier: 1, // Default tier (tier progression would need additional tracking)
      level,
      equippedArtifacts,
    };
  });

  // Build turrets array from unlocked turrets + starter turrets
  const turretSet = new Set<string>([
    ...FREE_STARTER_TURRETS,
    ...unlockedTurretIds,
  ]);
  const turretIds = Array.from(turretSet);
  const turrets: HubPreviewTurret[] = turretIds.map((turretType, index) => {
    // Find upgrade data for this turret
    const upgrades = turretUpgradesData.find((t) => t.turretType === turretType);
    const statUpgrades = upgrades?.statUpgrades ?? {};

    // Calculate total level as sum of stat upgrades
    const level = (statUpgrades.damage ?? 0) + (statUpgrades.attackSpeed ?? 0);

    return {
      turretType,
      tier: 1, // Default tier
      level,
      slotIndex: index, // Sequential slot assignment
    };
  });

  // Build response
  const response: HubPreviewResponse = {
    userId: user.id,
    displayName: user.displayName,
    description: user.description ?? null,
    guildId: user.guildMembership?.guildId ?? null,
    guildTag: user.guildMembership?.guild?.tag ?? null,
    level: user.progression?.level ?? 1,
    highestWave: user.highestWave,
    totalPower: user.powerUpgrades?.cachedTotalPower ?? 0,
    fortressClass: user.defaultFortressClass ?? 'natural',
    exclusiveItems: parseJsonArray<string>(user.exclusiveItems),
    heroes,
    turrets,
  };

  // Cache the result
  try {
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(response));
  } catch (error) {
    console.warn('Failed to write hub preview cache', { userId, error });
  }

  return response;
}

/**
 * Invalidate hub preview cache for a user
 * Call this when user updates their loadout, artifacts, or power upgrades
 */
export async function invalidateHubPreviewCache(userId: string): Promise<void> {
  await redis.del(`${CACHE_KEY_PREFIX}${userId}`);
}
