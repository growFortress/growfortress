/**
 * Achievement Service - Handles permanent progression tracking (Hero Zero style)
 */
import { prisma } from '../lib/prisma.js';
import {
  ACHIEVEMENT_DEFINITIONS,
  ACHIEVEMENT_ERROR_CODES,
  type AchievementId,
  type LifetimeStats,
  type GetAchievementsResponse,
  type ClaimAchievementRewardResponse,
  type ClaimAllAchievementsResponse,
  type AchievementProgress,
  type AchievementCategory,
} from '@arcade/protocol';
import { MATERIAL_DEFINITIONS } from '@arcade/sim-core';
import { addPoints as addBattlePassPoints } from './battlepass.js';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get a random material of the specified rarity
 */
function getRandomMaterial(rarity: 'rare' | 'epic' | 'legendary' = 'rare'): string {
  const materials = MATERIAL_DEFINITIONS.filter(m => m.rarity === rarity);
  if (materials.length === 0) {
    const rareMaterials = MATERIAL_DEFINITIONS.filter(m => m.rarity === 'rare');
    return rareMaterials[Math.floor(Math.random() * rareMaterials.length)]?.id ?? 'cosmic_dust';
  }
  return materials[Math.floor(Math.random() * materials.length)].id;
}

/**
 * Create default lifetime stats object
 */
function createDefaultLifetimeStats(): LifetimeStats {
  return {
    totalKills: 0,
    eliteKills: 0,
    bossKills: 0,
    wavesCompleted: 0,
    runsCompleted: 0,
    goldEarned: '0',
    dustSpent: 0,
    heroesUnlocked: 0,
    turretsUnlocked: 0,
    artifactsObtained: 0,
    pvpBattles: 0,
    pvpVictories: 0,
    guildBattles: 0,
    bossRushCycles: 0,
    pillarChallengesCompleted: 0,
    materialsCollected: 0,
    relicsChosen: 0,
    skillsActivated: 0,
    damageDealt: '0',
    criticalHits: 0,
    guildDonations: 0,
    towerRaceWaves: 0,
    crystalFragments: 0,
    masteryPoints: 0,
    synergiesTriggered: 0,
    commanderLevel: 1,
    prestigeCount: 0,
  };
}

/**
 * Get stat value, handling BigInt strings
 */
function getStatValue(stats: LifetimeStats, statKey: string): number {
  const value = (stats as Record<string, unknown>)[statKey];
  if (typeof value === 'string') {
    // Handle BigInt strings (goldEarned, damageDealt)
    const bigVal = BigInt(value);
    // Cap at Number.MAX_SAFE_INTEGER for comparison
    if (bigVal > BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number.MAX_SAFE_INTEGER;
    }
    return Number(bigVal);
  }
  return (value as number) ?? 0;
}

// ============================================================================
// CORE SERVICE FUNCTIONS
// ============================================================================

/**
 * Get or create player achievements record
 */
export async function getOrCreateAchievements(userId: string) {
  let achievements = await prisma.playerAchievements.findUnique({
    where: { userId },
  });

  if (!achievements) {
    achievements = await prisma.playerAchievements.create({
      data: {
        userId,
        lifetimeStats: createDefaultLifetimeStats(),
        achievementProgress: {},
        claimedTiers: {},
        unlockedTitles: [],
        activeTitle: null,
      },
    });
  }

  return achievements;
}

/**
 * Get full achievements data for a user
 */
export async function getAchievements(userId: string): Promise<GetAchievementsResponse> {
  const achievements = await getOrCreateAchievements(userId);
  const lifetimeStats = achievements.lifetimeStats as LifetimeStats;
  const claimedTiers = achievements.claimedTiers as Record<string, number[]>;

  // Also pull in stats from User model that we track elsewhere
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      highestWave: true,
      totalWaves: true,
      pvpWins: true,
      pvpLosses: true,
      progression: { select: { level: true } },
      colonyProgress: { select: { prestigeCount: true } },
      inventory: { select: { unlockedHeroIds: true, unlockedTurretIds: true } },
    },
  });

  // Merge User model stats into lifetimeStats for achievement checking
  const mergedStats: LifetimeStats = {
    ...lifetimeStats,
    wavesCompleted: Math.max(lifetimeStats.wavesCompleted, user?.totalWaves ?? 0),
    pvpVictories: Math.max(lifetimeStats.pvpVictories, user?.pvpWins ?? 0),
    pvpBattles: Math.max(lifetimeStats.pvpBattles, (user?.pvpWins ?? 0) + (user?.pvpLosses ?? 0)),
    heroesUnlocked: Math.max(lifetimeStats.heroesUnlocked, user?.inventory?.unlockedHeroIds?.length ?? 0),
    turretsUnlocked: Math.max(lifetimeStats.turretsUnlocked, user?.inventory?.unlockedTurretIds?.length ?? 0),
    prestigeCount: Math.max(lifetimeStats.prestigeCount ?? 0, user?.colonyProgress?.prestigeCount ?? 0),
    commanderLevel: user?.progression?.level ?? 1,
  };

  // Calculate progress for each achievement
  const achievementsWithProgress = ACHIEVEMENT_DEFINITIONS.map(def => {
    const statValue = getStatValue(mergedStats, def.statKey);
    const claimed = claimedTiers[def.id] || [];

    // Find current tier (highest tier where target is reached)
    let currentTier = 0;
    let currentTarget = def.tiers[0]?.target ?? 0;
    let nextTier: number | null = 1;

    for (const tier of def.tiers) {
      if (statValue >= tier.target) {
        currentTier = tier.tier;
      } else {
        nextTier = tier.tier;
        currentTarget = tier.target;
        break;
      }
    }

    // If all tiers completed
    if (currentTier === def.tiers.length) {
      nextTier = null;
      currentTarget = def.tiers[def.tiers.length - 1].target;
    }

    const hasUnclaimedReward = def.tiers.some(
      t => statValue >= t.target && !claimed.includes(t.tier)
    );

    const progress: AchievementProgress = {
      achievementId: def.id as AchievementId,
      currentTier,
      currentProgress: statValue,
      currentTarget,
      nextTier,
      claimedTiers: claimed,
      hasUnclaimedReward,
    };

    return {
      definition: def,
      progress,
    };
  });

  // Calculate category progress
  const categoryProgress: Record<AchievementCategory, { completed: number; total: number }> = {
    combat: { completed: 0, total: 0 },
    progression: { completed: 0, total: 0 },
    collection: { completed: 0, total: 0 },
    economy: { completed: 0, total: 0 },
    pvp: { completed: 0, total: 0 },
    guild: { completed: 0, total: 0 },
    challenge: { completed: 0, total: 0 },
    mastery: { completed: 0, total: 0 },
  };

  for (const ach of achievementsWithProgress) {
    const cat = ach.definition.category;
    categoryProgress[cat].total += ach.definition.tiers.length;
    categoryProgress[cat].completed += ach.progress.claimedTiers.length;
  }

  return {
    achievements: achievementsWithProgress,
    lifetimeStats: mergedStats,
    unlockedTitles: achievements.unlockedTitles,
    activeTitle: achievements.activeTitle,
    totalUnclaimedRewards: achievementsWithProgress.filter(a => a.progress.hasUnclaimedReward).length,
    categoryProgress,
  };
}

/**
 * Claim a specific tier reward
 */
export async function claimAchievementReward(
  userId: string,
  achievementId: AchievementId,
  tier: number
): Promise<ClaimAchievementRewardResponse> {
  const definition = ACHIEVEMENT_DEFINITIONS.find(d => d.id === achievementId);
  if (!definition) {
    return {
      success: false,
      dustAwarded: 0,
      goldAwarded: 0,
      materialsAwarded: {},
      titleUnlocked: null,
      newInventory: { dust: 0, gold: 0, materials: {} },
      error: ACHIEVEMENT_ERROR_CODES.ACHIEVEMENT_NOT_FOUND,
    };
  }

  const tierDef = definition.tiers.find(t => t.tier === tier);
  if (!tierDef) {
    return {
      success: false,
      dustAwarded: 0,
      goldAwarded: 0,
      materialsAwarded: {},
      titleUnlocked: null,
      newInventory: { dust: 0, gold: 0, materials: {} },
      error: ACHIEVEMENT_ERROR_CODES.TIER_NOT_REACHED,
    };
  }

  const achievements = await getOrCreateAchievements(userId);
  const lifetimeStats = achievements.lifetimeStats as LifetimeStats;
  const claimedTiers = achievements.claimedTiers as Record<string, number[]>;

  // Check if already claimed
  const claimed = claimedTiers[achievementId] || [];
  if (claimed.includes(tier)) {
    return {
      success: false,
      dustAwarded: 0,
      goldAwarded: 0,
      materialsAwarded: {},
      titleUnlocked: null,
      newInventory: { dust: 0, gold: 0, materials: {} },
      error: ACHIEVEMENT_ERROR_CODES.TIER_ALREADY_CLAIMED,
    };
  }

  // Get merged stats to check tier eligibility
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      totalWaves: true,
      pvpWins: true,
      pvpLosses: true,
      progression: { select: { level: true } },
      colonyProgress: { select: { prestigeCount: true } },
      inventory: { select: { unlockedHeroIds: true, unlockedTurretIds: true } },
    },
  });

  const mergedStats: LifetimeStats = {
    ...lifetimeStats,
    wavesCompleted: Math.max(lifetimeStats.wavesCompleted, user?.totalWaves ?? 0),
    pvpVictories: Math.max(lifetimeStats.pvpVictories, user?.pvpWins ?? 0),
    pvpBattles: Math.max(lifetimeStats.pvpBattles, (user?.pvpWins ?? 0) + (user?.pvpLosses ?? 0)),
    heroesUnlocked: Math.max(lifetimeStats.heroesUnlocked, user?.inventory?.unlockedHeroIds?.length ?? 0),
    turretsUnlocked: Math.max(lifetimeStats.turretsUnlocked, user?.inventory?.unlockedTurretIds?.length ?? 0),
    prestigeCount: Math.max(lifetimeStats.prestigeCount ?? 0, user?.colonyProgress?.prestigeCount ?? 0),
    commanderLevel: user?.progression?.level ?? 1,
  };

  // Check if tier is reached
  const statValue = getStatValue(mergedStats, definition.statKey);
  if (statValue < tierDef.target) {
    return {
      success: false,
      dustAwarded: 0,
      goldAwarded: 0,
      materialsAwarded: {},
      titleUnlocked: null,
      newInventory: { dust: 0, gold: 0, materials: {} },
      error: ACHIEVEMENT_ERROR_CODES.TIER_NOT_REACHED,
    };
  }

  // Calculate material rewards
  const materialsAwarded: Record<string, number> = {};
  if (tierDef.materialReward) {
    const materialId = getRandomMaterial(tierDef.materialReward.rarity);
    materialsAwarded[materialId] = tierDef.materialReward.count;
  }

  // Grant rewards in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Update claimed tiers
    const newClaimed = [...claimed, tier];
    const newClaimedTiers = { ...claimedTiers, [achievementId]: newClaimed };

    // Handle title unlock
    const newTitles = tierDef.titleReward
      ? [...achievements.unlockedTitles, tierDef.titleReward]
      : achievements.unlockedTitles;

    await tx.playerAchievements.update({
      where: { userId },
      data: {
        claimedTiers: newClaimedTiers,
        unlockedTitles: newTitles,
      },
    });

    // Update inventory
    const inventory = await tx.inventory.findUnique({ where: { userId } });
    if (!inventory) throw new Error('Inventory not found');

    const currentMaterials = (inventory.materials as Record<string, number>) ?? {};
    const newMaterials = { ...currentMaterials };
    for (const [matId, amount] of Object.entries(materialsAwarded)) {
      newMaterials[matId] = (newMaterials[matId] ?? 0) + amount;
    }

    const updatedInventory = await tx.inventory.update({
      where: { userId },
      data: {
        dust: { increment: tierDef.dustReward },
        gold: { increment: tierDef.goldReward },
        materials: newMaterials,
      },
    });

    return {
      dust: updatedInventory.dust,
      gold: updatedInventory.gold,
      materials: updatedInventory.materials as Record<string, number>,
    };
  });

  // Grant battle pass points
  await addBattlePassPoints(userId, 'achievement_claimed');

  return {
    success: true,
    dustAwarded: tierDef.dustReward,
    goldAwarded: tierDef.goldReward,
    materialsAwarded,
    titleUnlocked: tierDef.titleReward,
    newInventory: result,
  };
}

/**
 * Claim all unclaimed achievement rewards
 */
export async function claimAllAchievementRewards(userId: string): Promise<ClaimAllAchievementsResponse> {
  const achievementsData = await getAchievements(userId);

  // Find all unclaimed tiers
  const toClaim: { achievementId: AchievementId; tier: number }[] = [];

  for (const ach of achievementsData.achievements) {
    for (const tierDef of ach.definition.tiers) {
      if (
        ach.progress.currentProgress >= tierDef.target &&
        !ach.progress.claimedTiers.includes(tierDef.tier)
      ) {
        toClaim.push({ achievementId: ach.definition.id as AchievementId, tier: tierDef.tier });
      }
    }
  }

  if (toClaim.length === 0) {
    const inventory = await prisma.inventory.findUnique({ where: { userId } });
    return {
      success: false,
      claimedCount: 0,
      totalDustAwarded: 0,
      totalGoldAwarded: 0,
      materialsAwarded: {},
      titlesUnlocked: [],
      newInventory: {
        dust: inventory?.dust ?? 0,
        gold: inventory?.gold ?? 0,
        materials: (inventory?.materials as Record<string, number>) ?? {},
      },
      error: ACHIEVEMENT_ERROR_CODES.NO_UNCLAIMED_REWARDS,
    };
  }

  // Calculate total rewards
  let totalDust = 0;
  let totalGold = 0;
  const allMaterials: Record<string, number> = {};
  const titlesUnlocked: string[] = [];

  for (const { achievementId, tier } of toClaim) {
    const def = ACHIEVEMENT_DEFINITIONS.find(d => d.id === achievementId);
    const tierDef = def?.tiers.find(t => t.tier === tier);
    if (!tierDef) continue;

    totalDust += tierDef.dustReward;
    totalGold += tierDef.goldReward;

    if (tierDef.materialReward) {
      const materialId = getRandomMaterial(tierDef.materialReward.rarity);
      allMaterials[materialId] = (allMaterials[materialId] ?? 0) + tierDef.materialReward.count;
    }

    if (tierDef.titleReward) {
      titlesUnlocked.push(tierDef.titleReward);
    }
  }

  // Grant all rewards in transaction
  const result = await prisma.$transaction(async (tx) => {
    const achievements = await tx.playerAchievements.findUnique({ where: { userId } });
    if (!achievements) throw new Error('Achievements not found');

    const claimedTiers = achievements.claimedTiers as Record<string, number[]>;
    const newClaimedTiers = { ...claimedTiers };

    for (const { achievementId, tier } of toClaim) {
      if (!newClaimedTiers[achievementId]) {
        newClaimedTiers[achievementId] = [];
      }
      newClaimedTiers[achievementId].push(tier);
    }

    const newTitles = [...achievements.unlockedTitles, ...titlesUnlocked];

    await tx.playerAchievements.update({
      where: { userId },
      data: {
        claimedTiers: newClaimedTiers,
        unlockedTitles: newTitles,
      },
    });

    const inventory = await tx.inventory.findUnique({ where: { userId } });
    if (!inventory) throw new Error('Inventory not found');

    const currentMaterials = (inventory.materials as Record<string, number>) ?? {};
    const newMaterials = { ...currentMaterials };
    for (const [matId, amount] of Object.entries(allMaterials)) {
      newMaterials[matId] = (newMaterials[matId] ?? 0) + amount;
    }

    const updatedInventory = await tx.inventory.update({
      where: { userId },
      data: {
        dust: { increment: totalDust },
        gold: { increment: totalGold },
        materials: newMaterials,
      },
    });

    return {
      dust: updatedInventory.dust,
      gold: updatedInventory.gold,
      materials: updatedInventory.materials as Record<string, number>,
    };
  });

  // Grant battle pass points for each claimed achievement
  if (toClaim.length > 0) {
    await addBattlePassPoints(userId, 'achievement_claimed', toClaim.length);
  }

  return {
    success: true,
    claimedCount: toClaim.length,
    totalDustAwarded: totalDust,
    totalGoldAwarded: totalGold,
    materialsAwarded: allMaterials,
    titlesUnlocked,
    newInventory: result,
  };
}

/**
 * Update lifetime stats (called from various game events)
 */
export async function updateLifetimeStats(
  userId: string,
  updates: Partial<LifetimeStats>
): Promise<void> {
  const achievements = await getOrCreateAchievements(userId);
  const currentStats = achievements.lifetimeStats as LifetimeStats;

  const newStats: LifetimeStats = { ...currentStats };

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null) continue;

    if (typeof value === 'number') {
      (newStats as Record<string, unknown>)[key] = ((currentStats as Record<string, unknown>)[key] as number ?? 0) + value;
    } else if (typeof value === 'string') {
      // Handle BigInt strings (goldEarned, damageDealt)
      const current = BigInt((currentStats as Record<string, unknown>)[key] as string ?? '0');
      const delta = BigInt(value);
      (newStats as Record<string, unknown>)[key] = (current + delta).toString();
    }
  }

  await prisma.playerAchievements.update({
    where: { userId },
    data: { lifetimeStats: newStats },
  });
}

/**
 * Set active title
 */
export async function setActiveTitle(userId: string, title: string | null): Promise<boolean> {
  const achievements = await getOrCreateAchievements(userId);

  if (title && !achievements.unlockedTitles.includes(title)) {
    return false;
  }

  await prisma.playerAchievements.update({
    where: { userId },
    data: { activeTitle: title },
  });

  return true;
}

/**
 * Get user's active title
 */
export async function getActiveTitle(userId: string): Promise<string | null> {
  const achievements = await prisma.playerAchievements.findUnique({
    where: { userId },
    select: { activeTitle: true },
  });
  return achievements?.activeTitle ?? null;
}
