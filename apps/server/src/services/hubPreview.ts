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
  BuildPreset,
} from '@arcade/protocol';
import { FREE_STARTER_HEROES, FREE_STARTER_TURRETS } from '@arcade/protocol';
import { isClassUnlockedAtLevel } from '@arcade/sim-core';

// Cache configuration
const CACHE_KEY_PREFIX = 'hub:preview:';
const CACHE_TTL = 120; // 2 minutes

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
      defaultHeroId: true,
      defaultTurretType: true,
      exclusiveItems: true,
      buildPresets: true,
      activePresetId: true,
      progression: {
        select: { level: true },
      },
      powerUpgrades: {
        select: {
          heroUpgrades: true,
          turretUpgrades: true,
          heroTiers: true,
          turretTiers: true,
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
  
  // Parse tier data
  let heroTiers: Record<string, number> = {};
  let turretTiers: Record<string, number> = {};
  try {
    if (user.powerUpgrades?.heroTiers) {
      heroTiers = typeof user.powerUpgrades.heroTiers === 'string'
        ? JSON.parse(user.powerUpgrades.heroTiers)
        : (user.powerUpgrades.heroTiers as Record<string, number>);
    }
  } catch (error) {
    console.warn('Failed to parse heroTiers', { userId, error });
  }
  try {
    if (user.powerUpgrades?.turretTiers) {
      turretTiers = typeof user.powerUpgrades.turretTiers === 'string'
        ? JSON.parse(user.powerUpgrades.turretTiers)
        : (user.powerUpgrades.turretTiers as Record<string, number>);
    }
  } catch (error) {
    console.warn('Failed to parse turretTiers', { userId, error });
  }
  
  const unlockedHeroIds = parseJsonArray<string>(user.inventory?.unlockedHeroIds);
  const unlockedTurretIds = parseJsonArray<string>(user.inventory?.unlockedTurretIds);
  const commanderLevel = user.progression?.level ?? 1;

  // Get active preset loadout
  const buildPresets = Array.isArray(user.buildPresets)
    ? (user.buildPresets as BuildPreset[])
    : [];
  const activePreset = user.activePresetId
    ? buildPresets.find((p) => p.id === user.activePresetId)
    : null;

  // Build list of all unlocked heroes (starters + purchased)
  // Use Set to deduplicate since some heroes might be in both lists
  const allUnlockedHeroes = new Set<string>([...FREE_STARTER_HEROES, ...unlockedHeroIds]);
  const allUnlockedTurrets = new Set<string>([...FREE_STARTER_TURRETS, ...unlockedTurretIds]);

  // Show all unlocked heroes and turrets for hub preview
  const heroIds = Array.from(allUnlockedHeroes);
  const turretIds = Array.from(allUnlockedTurrets);

  // Get fortress class from active preset or default
  const requestedClass = activePreset?.fortressClass ?? user.defaultFortressClass ?? 'natural';
  const fortressClass = isClassUnlockedAtLevel(requestedClass, commanderLevel)
    ? requestedClass
    : 'natural';
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

    // Get tier from heroTiers, default to 1 if not found
    const tier = (heroTiers[heroId] ?? 1) as 1 | 2 | 3;
    
    return {
      heroId,
      tier,
      level,
      equippedArtifacts,
    };
  });

  // Build turrets array from all unlocked turrets
  const turrets: HubPreviewTurret[] = turretIds.map((turretType, index) => {
    // Find upgrade data for this turret
    const upgrades = turretUpgradesData.find((t) => t.turretType === turretType);
    const statUpgrades = upgrades?.statUpgrades ?? {};

    // Calculate total level as sum of stat upgrades
    const level = (statUpgrades.damage ?? 0) + (statUpgrades.attackSpeed ?? 0);

    // Get tier from turretTiers, default to 1 if not found
    const tier = (turretTiers[turretType] ?? 1) as 1 | 2 | 3;

    return {
      turretType,
      tier,
      level,
      // Slot index is 0-based in the API response (matches protocol schema)
      // Frontend will convert to 1-based for rendering
      slotIndex: index,
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
    fortressClass,
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
