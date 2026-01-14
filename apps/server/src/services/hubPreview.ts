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

// Cache configuration
const CACHE_KEY_PREFIX = 'hub:preview:';
const CACHE_TTL = 300; // 5 minutes

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
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as HubPreviewResponse;
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
  const heroUpgradesData = (user.powerUpgrades?.heroUpgrades as HeroUpgradeData[] | null) ?? [];
  const turretUpgradesData = (user.powerUpgrades?.turretUpgrades as TurretUpgradeData[] | null) ?? [];

  // Build heroes array from unlocked heroes
  const heroIds = user.inventory?.unlockedHeroIds ?? [];
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

  // Build turrets array from unlocked turrets
  const turretIds = user.inventory?.unlockedTurretIds ?? [];
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
    guildTag: user.guildMembership?.guild.tag ?? null,
    level: user.progression?.level ?? 1,
    highestWave: user.highestWave,
    totalPower: user.powerUpgrades?.cachedTotalPower ?? 0,
    fortressClass: user.defaultFortressClass ?? 'natural',
    exclusiveItems: user.exclusiveItems ?? [],
    heroes,
    turrets,
  };

  // Cache the result
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(response));

  return response;
}

/**
 * Invalidate hub preview cache for a user
 * Call this when user updates their loadout, artifacts, or power upgrades
 */
export async function invalidateHubPreviewCache(userId: string): Promise<void> {
  await redis.del(`${CACHE_KEY_PREFIX}${userId}`);
}
