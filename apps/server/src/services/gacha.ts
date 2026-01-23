import { GachaType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getHeroById, HEROES } from "@arcade/sim-core";
import {
  HERO_GACHA_CONFIG,
  type GachaRarity,
  type HeroGachaPullResult,
} from "@arcade/protocol";
import { getActiveBanners } from "./banners.js";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Weighted random selection based on rarity rates
 */
function rollRarity(
  rates: Record<GachaRarity, number>,
  pityCount: number,
  pityThreshold: number,
): GachaRarity {
  // Check pity - guarantee epic+ if threshold reached
  if (pityCount >= pityThreshold) {
    // 80% epic, 20% legendary when pity triggers
    return Math.random() < 0.8 ? "epic" : "legendary";
  }

  const roll = Math.random() * 100;
  let cumulative = 0;

  for (const [rarity, rate] of Object.entries(rates) as [GachaRarity, number][]) {
    cumulative += rate;
    if (roll < cumulative) {
      return rarity;
    }
  }

  return "common";
}

/**
 * Select a random hero of the given rarity, with rate-up for featured items
 */
async function selectHero(
  rarity: GachaRarity,
  bannerId?: string,
): Promise<{ heroId: string; heroName: string }> {
  // Get heroes of this rarity
  const heroesOfRarity = HEROES.filter((h) => h.rarity === rarity);

  if (heroesOfRarity.length === 0) {
    // Fallback to any hero if no heroes of this rarity
    const fallback = HEROES[Math.floor(Math.random() * HEROES.length)];
    return { heroId: fallback.id, heroName: fallback.name };
  }

  // Check for banner rate-up
  if (bannerId) {
    const activeBanners = await getActiveBanners(GachaType.HERO);
    const banner = activeBanners.find((b) => b.id === bannerId);

    if (banner && banner.featuredItems.length > 0) {
      // Check if any featured heroes are of this rarity
      const featuredOfRarity = heroesOfRarity.filter((h) =>
        banner.featuredItems.includes(h.id),
      );

      if (featuredOfRarity.length > 0) {
        // Rate-up: higher chance for featured heroes
        // rateUpMultiplier of 2.0 means featured hero is 2x more likely
        const totalWeight =
          heroesOfRarity.length +
          featuredOfRarity.length * (banner.rateUpMultiplier - 1);
        const roll = Math.random() * totalWeight;

        let cumulative = 0;
        for (const hero of heroesOfRarity) {
          const weight = banner.featuredItems.includes(hero.id)
            ? banner.rateUpMultiplier
            : 1;
          cumulative += weight;
          if (roll < cumulative) {
            return { heroId: hero.id, heroName: hero.name };
          }
        }
      }
    }
  }

  // No banner or no featured heroes of this rarity - uniform random
  const selected = heroesOfRarity[Math.floor(Math.random() * heroesOfRarity.length)];
  return { heroId: selected.id, heroName: selected.name };
}

// ============================================================================
// GACHA PROGRESS MANAGEMENT
// ============================================================================

/**
 * Get or create gacha progress for a user
 */
async function getOrCreateGachaProgress(userId: string) {
  let progress = await prisma.gachaProgress.findUnique({
    where: { userId },
  });

  if (!progress) {
    progress = await prisma.gachaProgress.create({
      data: {
        userId,
        heroPityCount: 0,
        heroSparkCount: 0,
        heroShards: 0,
        artifactPity: {},
      },
    });
  }

  return progress;
}

/**
 * Get user's gacha status
 */
export async function getGachaStatus(userId: string) {
  const progress = await getOrCreateGachaProgress(userId);

  const lastHeroPull = await prisma.gachaPull.findFirst({
    where: { userId, gachaType: GachaType.HERO },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  const lastArtifactPull = await prisma.gachaPull.findFirst({
    where: { userId, gachaType: GachaType.ARTIFACT },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  return {
    heroPityCount: progress.heroPityCount,
    heroSparkCount: progress.heroSparkCount,
    heroShards: progress.heroShards,
    artifactPityCount: progress.artifactPity as Record<string, number>,
    lastHeroPull: lastHeroPull?.createdAt.toISOString(),
    lastArtifactPull: lastArtifactPull?.createdAt.toISOString(),
  };
}

// ============================================================================
// HERO GACHA
// ============================================================================

/**
 * Perform hero gacha pulls
 */
export async function pullHeroGacha(
  userId: string,
  pullCount: "single" | "ten",
  bannerId?: string,
): Promise<{
  success: boolean;
  results: HeroGachaPullResult[];
  dustSpent: number;
  newDustBalance: number;
  pityCount: number;
  sparkCount: number;
  totalShards: number;
  error?: string;
}> {
  const numPulls = pullCount === "single" ? 1 : 10;
  const dustCost =
    pullCount === "single"
      ? HERO_GACHA_CONFIG.singlePullCost
      : HERO_GACHA_CONFIG.tenPullCost;

  // Get user inventory
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
  });

  if (!inventory) {
    return {
      success: false,
      results: [],
      dustSpent: 0,
      newDustBalance: 0,
      pityCount: 0,
      sparkCount: 0,
      totalShards: 0,
      error: "INVENTORY_NOT_FOUND",
    };
  }

  if (inventory.dust < dustCost) {
    return {
      success: false,
      results: [],
      dustSpent: 0,
      newDustBalance: inventory.dust,
      pityCount: 0,
      sparkCount: 0,
      totalShards: 0,
      error: "INSUFFICIENT_DUST",
    };
  }

  // Get gacha progress
  const progress = await getOrCreateGachaProgress(userId);

  // Perform pulls
  const results: HeroGachaPullResult[] = [];
  let currentPity = progress.heroPityCount;
  let shardsGained = 0;

  for (let i = 0; i < numPulls; i++) {
    // Roll rarity
    const rarity = rollRarity(
      HERO_GACHA_CONFIG.rates as Record<GachaRarity, number>,
      currentPity,
      HERO_GACHA_CONFIG.pityThreshold,
    );

    // Reset pity on epic+ pull
    if (rarity === "epic" || rarity === "legendary") {
      currentPity = 0;
    } else {
      currentPity++;
    }

    // Select hero
    const { heroId, heroName } = await selectHero(rarity, bannerId);

    // Check if new or duplicate
    const isNew = !inventory.unlockedHeroIds.includes(heroId);
    let shardsGranted: number | undefined;

    if (!isNew) {
      // Duplicate - grant shards
      shardsGranted =
        HERO_GACHA_CONFIG.shardConversion[rarity as keyof typeof HERO_GACHA_CONFIG.shardConversion] || 50;
      shardsGained += shardsGranted;
    }

    results.push({
      heroId,
      heroName,
      rarity,
      isNew,
      shardsGranted,
    });
  }

  // Calculate new spark count
  const newSparkCount = progress.heroSparkCount + numPulls;

  // Update inventory and progress in transaction
  const [updatedInventory, updatedProgress] = await prisma.$transaction([
    // Deduct dust and add new heroes
    prisma.inventory.update({
      where: { userId },
      data: {
        dust: inventory.dust - dustCost,
        unlockedHeroIds: {
          push: results.filter((r) => r.isNew).map((r) => r.heroId),
        },
      },
    }),
    // Update gacha progress
    prisma.gachaProgress.update({
      where: { userId },
      data: {
        heroPityCount: currentPity,
        heroSparkCount: newSparkCount,
        heroShards: progress.heroShards + shardsGained,
      },
    }),
    // Record pull history
    ...results.map((r) =>
      prisma.gachaPull.create({
        data: {
          userId,
          gachaType: GachaType.HERO,
          rarity: r.rarity,
          itemId: r.heroId,
          itemName: r.heroName,
          isNew: r.isNew,
          dustSpent: Math.floor(dustCost / numPulls),
          pityCount: currentPity,
        },
      }),
    ),
  ]);

  return {
    success: true,
    results,
    dustSpent: dustCost,
    newDustBalance: updatedInventory.dust,
    pityCount: updatedProgress.heroPityCount,
    sparkCount: updatedProgress.heroSparkCount,
    totalShards: updatedProgress.heroShards,
  };
}

// ============================================================================
// SPARK REDEMPTION
// ============================================================================

/**
 * Redeem spark points for a guaranteed hero
 */
export async function redeemSpark(
  userId: string,
  heroId: string,
): Promise<{
  success: boolean;
  heroId?: string;
  heroName?: string;
  sparkSpent?: number;
  remainingSpark?: number;
  error?: string;
}> {
  const hero = getHeroById(heroId);
  if (!hero) {
    return { success: false, error: "HERO_NOT_FOUND" };
  }

  const progress = await getOrCreateGachaProgress(userId);

  if (progress.heroSparkCount < HERO_GACHA_CONFIG.sparkThreshold) {
    return {
      success: false,
      error: "INSUFFICIENT_SPARK",
      remainingSpark: progress.heroSparkCount,
    };
  }

  const inventory = await prisma.inventory.findUnique({
    where: { userId },
  });

  if (!inventory) {
    return { success: false, error: "INVENTORY_NOT_FOUND" };
  }

  // Check if already owned
  if (inventory.unlockedHeroIds.includes(heroId)) {
    return { success: false, error: "HERO_ALREADY_OWNED" };
  }

  // Deduct spark and add hero
  await prisma.$transaction([
    prisma.gachaProgress.update({
      where: { userId },
      data: {
        heroSparkCount: progress.heroSparkCount - HERO_GACHA_CONFIG.sparkThreshold,
      },
    }),
    prisma.inventory.update({
      where: { userId },
      data: {
        unlockedHeroIds: { push: heroId },
      },
    }),
  ]);

  return {
    success: true,
    heroId,
    heroName: hero.name,
    sparkSpent: HERO_GACHA_CONFIG.sparkThreshold,
    remainingSpark: progress.heroSparkCount - HERO_GACHA_CONFIG.sparkThreshold,
  };
}

// ============================================================================
// GACHA HISTORY
// ============================================================================

/**
 * Get gacha pull history
 */
export async function getGachaHistory(
  userId: string,
  gachaType?: GachaType,
  limit = 50,
  offset = 0,
) {
  const where = {
    userId,
    ...(gachaType && { gachaType }),
  };

  const [pulls, total] = await Promise.all([
    prisma.gachaPull.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.gachaPull.count({ where }),
  ]);

  return {
    pulls: pulls.map((p) => ({
      id: p.id,
      gachaType: p.gachaType.toLowerCase() as "hero" | "artifact",
      itemId: p.itemId,
      itemName: p.itemName,
      rarity: p.rarity as GachaRarity,
      isNew: p.isNew,
      dustSpent: p.dustSpent,
      createdAt: p.createdAt.toISOString(),
    })),
    total,
    hasMore: offset + pulls.length < total,
  };
}
