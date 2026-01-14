/**
 * Guild Battle Hero Service
 *
 * Handles Battle Hero system - each member selects one hero for guild battles.
 */

import { prisma } from '../lib/prisma.js';
import { GUILD_ERROR_CODES, FREE_STARTER_HEROES } from '@arcade/protocol';
import {
  calculateHeroPower,
  getHeroById,
  type PlayerPowerData,
  createDefaultStatUpgrades,
} from '@arcade/sim-core';

// ============================================================================
// TYPES
// ============================================================================

export interface BattleHeroInfo {
  heroId: string;
  tier: 1 | 2 | 3;
  power: number;
}

export interface BattleHeroSnapshot {
  userId: string;
  displayName: string;
  heroId: string;
  tier: 1 | 2 | 3;
  power: number;
  equippedArtifactId: string | null;
}

export interface BattleRosterMember {
  userId: string;
  displayName: string;
  role: string;
  battleHero: BattleHeroInfo | null;
  // Extended stats for Leader roster view
  totalPower: number;
  highestWave: number;
  unlockedHeroCount: number;
  lastActiveAt: Date | null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get player's power upgrades data for a specific hero
 */
async function getHeroPowerData(userId: string, heroId: string): Promise<{
  statUpgrades: ReturnType<typeof createDefaultStatUpgrades>;
  tier: 1 | 2 | 3;
}> {
  const powerUpgrades = await prisma.powerUpgrades.findUnique({
    where: { userId },
  });

  if (!powerUpgrades) {
    return {
      statUpgrades: createDefaultStatUpgrades(),
      tier: 1,
    };
  }

  // Parse hero upgrades with error handling for corrupted data
  let heroUpgrades: PlayerPowerData['heroUpgrades'] = [];
  let itemTiers: PlayerPowerData['itemTiers'] = [];

  try {
    heroUpgrades = JSON.parse(powerUpgrades.heroUpgrades as string) as PlayerPowerData['heroUpgrades'];
  } catch {
    // Corrupted data - use empty array
    heroUpgrades = [];
  }

  try {
    itemTiers = JSON.parse(powerUpgrades.itemTiers as string) as PlayerPowerData['itemTiers'];
  } catch {
    // Corrupted data - use empty array
    itemTiers = [];
  }

  const heroUpgrade = heroUpgrades.find(h => h.heroId === heroId);
  const heroTierItem = itemTiers.find(i => i.itemId === heroId);

  // Map item tier to hero tier (1-3)
  // common/uncommon = 1, rare/epic = 2, legendary = 3
  let tier: 1 | 2 | 3 = 1;
  if (heroTierItem) {
    switch (heroTierItem.tier) {
      case 'rare':
      case 'epic':
        tier = 2;
        break;
      case 'legendary':
        tier = 3;
        break;
      default:
        tier = 1;
    }
  }

  return {
    statUpgrades: heroUpgrade?.statUpgrades ?? createDefaultStatUpgrades(),
    tier,
  };
}

/**
 * Calculate hero power for a user's hero
 */
async function calculateUserHeroPower(userId: string, heroId: string): Promise<number> {
  const { statUpgrades, tier } = await getHeroPowerData(userId, heroId);
  const powerBreakdown = calculateHeroPower(heroId, statUpgrades, tier);
  return powerBreakdown.totalPower;
}

/**
 * Get user's hero tier
 */
async function getUserHeroTier(userId: string, heroId: string): Promise<1 | 2 | 3> {
  const { tier } = await getHeroPowerData(userId, heroId);
  return tier;
}

/**
 * Check if user has hero unlocked
 */
async function isHeroUnlocked(userId: string, heroId: string): Promise<boolean> {
  // Check if it's a free starter hero
  if ((FREE_STARTER_HEROES as readonly string[]).includes(heroId)) {
    return true;
  }

  const inventory = await prisma.inventory.findUnique({
    where: { userId },
    select: { unlockedHeroIds: true },
  });

  return inventory?.unlockedHeroIds?.includes(heroId) ?? false;
}

// ============================================================================
// BATTLE HERO OPERATIONS
// ============================================================================

/**
 * Set a member's Battle Hero
 */
export async function setBattleHero(
  userId: string,
  heroId: string
): Promise<{
  success: boolean;
  battleHero?: BattleHeroInfo;
  error?: string;
}> {
  // Validate hero exists
  const heroDef = getHeroById(heroId);
  if (!heroDef) {
    return {
      success: false,
      error: 'Hero not found',
    };
  }

  // Check if user has hero unlocked
  const unlocked = await isHeroUnlocked(userId, heroId);
  if (!unlocked) {
    return {
      success: false,
      error: GUILD_ERROR_CODES.HERO_NOT_UNLOCKED,
    };
  }

  // Get user's guild membership
  const member = await prisma.guildMember.findUnique({
    where: { userId },
  });

  if (!member) {
    return {
      success: false,
      error: GUILD_ERROR_CODES.NOT_IN_GUILD,
    };
  }

  // Calculate hero power and tier
  const tier = await getUserHeroTier(userId, heroId);
  const power = await calculateUserHeroPower(userId, heroId);

  // Update Battle Hero
  await prisma.guildMember.update({
    where: { id: member.id },
    data: {
      battleHeroId: heroId,
      battleHeroTier: tier,
      battleHeroPower: power,
      battleHeroUpdatedAt: new Date(),
    },
  });

  return {
    success: true,
    battleHero: {
      heroId,
      tier,
      power,
    },
  };
}

/**
 * Get a member's Battle Hero
 */
export async function getBattleHero(userId: string): Promise<BattleHeroInfo | null> {
  const member = await prisma.guildMember.findUnique({
    where: { userId },
    select: {
      battleHeroId: true,
      battleHeroTier: true,
      battleHeroPower: true,
    },
  });

  if (!member || !member.battleHeroId) {
    return null;
  }

  return {
    heroId: member.battleHeroId,
    tier: (member.battleHeroTier ?? 1) as 1 | 2 | 3,
    power: member.battleHeroPower ?? 0,
  };
}

/**
 * Clear a member's Battle Hero
 */
export async function clearBattleHero(userId: string): Promise<{ success: boolean; error?: string }> {
  const member = await prisma.guildMember.findUnique({
    where: { userId },
  });

  if (!member) {
    return {
      success: false,
      error: GUILD_ERROR_CODES.NOT_IN_GUILD,
    };
  }

  await prisma.guildMember.update({
    where: { id: member.id },
    data: {
      battleHeroId: null,
      battleHeroTier: null,
      battleHeroPower: null,
      battleHeroUpdatedAt: null,
    },
  });

  return { success: true };
}

/**
 * Get battle roster for a guild (members with Battle Heroes)
 * For Leader/Officer to see who can participate in battles
 * Includes extended stats for roster view (totalPower, highestWave, etc.)
 */
export async function getGuildBattleRoster(guildId: string): Promise<BattleRosterMember[]> {
  const members = await prisma.guildMember.findMany({
    where: { guildId },
    include: {
      user: {
        select: {
          displayName: true,
          highestWave: true,
          lastIdleClaimAt: true, // Better activity indicator than createdAt
          powerUpgrades: {
            select: {
              cachedTotalPower: true,
            },
          },
          inventory: {
            select: {
              unlockedHeroIds: true,
            },
          },
        },
      },
    },
    orderBy: [
      { battleHeroPower: 'desc' },
      { role: 'asc' },
    ],
  });

  return members.map(m => ({
    userId: m.userId,
    displayName: m.user.displayName,
    role: m.role,
    battleHero: m.battleHeroId
      ? {
          heroId: m.battleHeroId,
          tier: (m.battleHeroTier ?? 1) as 1 | 2 | 3,
          power: m.battleHeroPower ?? 0,
        }
      : null,
    totalPower: m.user.powerUpgrades?.cachedTotalPower ?? 0,
    highestWave: m.user.highestWave,
    unlockedHeroCount: m.user.inventory?.unlockedHeroIds.length ?? 0,
    lastActiveAt: m.user.lastIdleClaimAt, // Use idle claim time as activity indicator
  }));
}

/**
 * Get members who have Battle Heroes set (for battle selection)
 */
export async function getMembersWithBattleHeroes(guildId: string): Promise<BattleRosterMember[]> {
  const members = await prisma.guildMember.findMany({
    where: {
      guildId,
      battleHeroId: { not: null },
    },
    include: {
      user: {
        select: {
          displayName: true,
          highestWave: true,
          createdAt: true,
          powerUpgrades: {
            select: {
              cachedTotalPower: true,
            },
          },
          inventory: {
            select: {
              unlockedHeroIds: true,
            },
          },
        },
      },
    },
    orderBy: { battleHeroPower: 'desc' },
  });

  return members.map(m => ({
    userId: m.userId,
    displayName: m.user.displayName,
    role: m.role,
    battleHero: {
      heroId: m.battleHeroId!,
      tier: (m.battleHeroTier ?? 1) as 1 | 2 | 3,
      power: m.battleHeroPower ?? 0,
    },
    totalPower: m.user.powerUpgrades?.cachedTotalPower ?? 0,
    highestWave: m.user.highestWave,
    unlockedHeroCount: m.user.inventory?.unlockedHeroIds.length ?? 0,
    lastActiveAt: m.user.createdAt,
  }));
}

/**
 * Create Battle Hero snapshots for a battle
 */
export async function createBattleHeroSnapshots(
  memberIds: string[]
): Promise<BattleHeroSnapshot[]> {
  const members = await prisma.guildMember.findMany({
    where: {
      userId: { in: memberIds },
      battleHeroId: { not: null },
    },
    include: {
      user: {
        select: {
          displayName: true,
        },
      },
    },
  });

  // Get equipped artifacts for each hero
  const artifactPromises = members.map(async m => {
    const artifact = await prisma.playerArtifact.findFirst({
      where: {
        userId: m.userId,
        equippedToHeroId: m.battleHeroId,
      },
      select: { artifactId: true },
    });
    return { userId: m.userId, artifactId: artifact?.artifactId ?? null };
  });

  const artifacts = await Promise.all(artifactPromises);
  const artifactMap = new Map(artifacts.map(a => [a.userId, a.artifactId]));

  return members.map(m => ({
    userId: m.userId,
    displayName: m.user.displayName,
    heroId: m.battleHeroId!,
    tier: (m.battleHeroTier ?? 1) as 1 | 2 | 3,
    power: m.battleHeroPower ?? 0,
    equippedArtifactId: artifactMap.get(m.userId) ?? null,
  }));
}

/**
 * Refresh Battle Hero power (recalculate based on current upgrades)
 * Should be called when player upgrades their hero
 */
export async function refreshBattleHeroPower(userId: string): Promise<void> {
  const member = await prisma.guildMember.findUnique({
    where: { userId },
    select: { id: true, battleHeroId: true },
  });

  if (!member || !member.battleHeroId) {
    return;
  }

  const tier = await getUserHeroTier(userId, member.battleHeroId);
  const power = await calculateUserHeroPower(userId, member.battleHeroId);

  await prisma.guildMember.update({
    where: { id: member.id },
    data: {
      battleHeroTier: tier,
      battleHeroPower: power,
      battleHeroUpdatedAt: new Date(),
    },
  });
}

/**
 * Count members with Battle Heroes in a guild
 */
export async function countMembersWithBattleHeroes(guildId: string): Promise<number> {
  return prisma.guildMember.count({
    where: {
      guildId,
      battleHeroId: { not: null },
    },
  });
}
