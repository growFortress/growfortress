/**
 * Battle Pass Service - Handles season progress, rewards, and premium upgrades
 */
import { prisma } from '../lib/prisma.js';
import {
  createCheckoutSession,
  isStripeConfigured,
} from '../lib/stripe.js';
import {
  BATTLE_PASS_CONFIG,
  BATTLE_PASS_FREE_TRACK,
  BATTLE_PASS_PREMIUM_TRACK,
  BP_POINT_VALUES,
  BATTLE_PASS_ERROR_CODES,
  type BattlePassPointSource,
  type BattlePassReward,
  type GetBattlePassResponse,
  type ClaimBattlePassRewardResponse,
  type ClaimAllBattlePassRewardsResponse,
  type BuyBattlePassTiersResponse,
  type PurchaseBattlePassResponse,
} from '@arcade/protocol';
import { MATERIAL_DEFINITIONS } from '@arcade/sim-core';

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
 * Calculate time remaining until season ends
 */
function getTimeRemaining(endsAt: Date): { days: number; hours: number; minutes: number } {
  const now = new Date();
  const diff = Math.max(0, endsAt.getTime() - now.getTime());

  const totalMinutes = Math.floor(diff / (1000 * 60));
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  return { days, hours, minutes };
}

// ============================================================================
// CORE SERVICE FUNCTIONS
// ============================================================================

/**
 * Get the currently active battle pass season
 */
export async function getActiveSeason() {
  const now = new Date();

  return prisma.battlePassSeason.findFirst({
    where: {
      isActive: true,
      startsAt: { lte: now },
      endsAt: { gt: now },
    },
  });
}

/**
 * Get user's battle pass progress for the active season
 * Creates a new progress record if none exists
 */
export async function getUserProgress(userId: string): Promise<GetBattlePassResponse | null> {
  const season = await getActiveSeason();

  if (!season) {
    return null;
  }

  // Get or create user progress
  let progress = await prisma.battlePassProgress.findUnique({
    where: {
      userId_seasonId: {
        userId,
        seasonId: season.id,
      },
    },
  });

  if (!progress) {
    progress = await prisma.battlePassProgress.create({
      data: {
        userId,
        seasonId: season.id,
        currentTier: 0,
        currentPoints: 0,
        isPremium: false,
        claimedFreeTiers: [],
        claimedPremiumTiers: [],
      },
    });
  }

  const pointsToNextTier = progress.currentTier >= BATTLE_PASS_CONFIG.maxTier
    ? 0
    : BATTLE_PASS_CONFIG.pointsPerTier - progress.currentPoints;

  return {
    season: {
      id: season.id,
      name: season.name,
      description: season.description,
      seasonNumber: season.seasonNumber,
      startsAt: season.startsAt.toISOString(),
      endsAt: season.endsAt.toISOString(),
      isActive: season.isActive,
      featuredReward: season.featuredReward ?? 'Exclusive Season Rewards',
    },
    progress: {
      seasonId: season.id,
      currentTier: progress.currentTier,
      currentPoints: progress.currentPoints,
      pointsToNextTier,
      isPremium: progress.isPremium,
      claimedFreeTiers: progress.claimedFreeTiers,
      claimedPremiumTiers: progress.claimedPremiumTiers,
      purchasedAt: progress.purchasedAt?.toISOString(),
    },
    freeRewards: BATTLE_PASS_FREE_TRACK,
    premiumRewards: BATTLE_PASS_PREMIUM_TRACK,
    timeRemaining: getTimeRemaining(season.endsAt),
  };
}

/**
 * Add battle pass points to user's progress
 */
export async function addPoints(
  userId: string,
  source: BattlePassPointSource,
  multiplier: number = 1
): Promise<{
  success: boolean;
  pointsAdded: number;
  newTotalPoints: number;
  newTier: number;
  tieredUp: boolean;
  tiersGained: number;
} | null> {
  const season = await getActiveSeason();

  if (!season) {
    return null;
  }

  const pointsToAdd = BP_POINT_VALUES[source] * multiplier;

  // Get or create progress
  let progress = await prisma.battlePassProgress.findUnique({
    where: {
      userId_seasonId: {
        userId,
        seasonId: season.id,
      },
    },
  });

  if (!progress) {
    progress = await prisma.battlePassProgress.create({
      data: {
        userId,
        seasonId: season.id,
        currentTier: 0,
        currentPoints: 0,
        isPremium: false,
        claimedFreeTiers: [],
        claimedPremiumTiers: [],
      },
    });
  }

  // Calculate new tier and points
  const oldTier = progress.currentTier;

  // If already at max tier, no points added
  if (oldTier >= BATTLE_PASS_CONFIG.maxTier) {
    return {
      success: true,
      pointsAdded: 0,
      newTotalPoints: 0,
      newTier: BATTLE_PASS_CONFIG.maxTier,
      tieredUp: false,
      tiersGained: 0,
    };
  }

  const totalPoints = progress.currentPoints + pointsToAdd;
  const tiersGained = Math.floor(totalPoints / BATTLE_PASS_CONFIG.pointsPerTier);
  const newTier = Math.min(oldTier + tiersGained, BATTLE_PASS_CONFIG.maxTier);
  const remainingPoints = newTier >= BATTLE_PASS_CONFIG.maxTier
    ? 0
    : totalPoints % BATTLE_PASS_CONFIG.pointsPerTier;

  // Update progress
  await prisma.battlePassProgress.update({
    where: { id: progress.id },
    data: {
      currentTier: newTier,
      currentPoints: remainingPoints,
    },
  });

  return {
    success: true,
    pointsAdded: pointsToAdd,
    newTotalPoints: remainingPoints,
    newTier,
    tieredUp: newTier > oldTier,
    tiersGained: newTier - oldTier,
  };
}

/**
 * Claim a single tier reward
 */
export async function claimTierReward(
  userId: string,
  tier: number,
  track: 'free' | 'premium'
): Promise<ClaimBattlePassRewardResponse> {
  const season = await getActiveSeason();

  if (!season) {
    return {
      success: false,
      rewardType: 'dust',
      rewardDescription: '',
      error: BATTLE_PASS_ERROR_CODES.NO_ACTIVE_SEASON,
    };
  }

  // Get progress
  const progress = await prisma.battlePassProgress.findUnique({
    where: {
      userId_seasonId: {
        userId,
        seasonId: season.id,
      },
    },
  });

  if (!progress) {
    return {
      success: false,
      rewardType: 'dust',
      rewardDescription: '',
      error: BATTLE_PASS_ERROR_CODES.TIER_NOT_REACHED,
    };
  }

  // Check if tier is reached
  if (progress.currentTier < tier) {
    return {
      success: false,
      rewardType: 'dust',
      rewardDescription: '',
      error: BATTLE_PASS_ERROR_CODES.TIER_NOT_REACHED,
    };
  }

  // Check premium for premium track
  if (track === 'premium' && !progress.isPremium) {
    return {
      success: false,
      rewardType: 'dust',
      rewardDescription: '',
      error: BATTLE_PASS_ERROR_CODES.NOT_PREMIUM,
    };
  }

  // Check if already claimed
  const claimedTiers = track === 'free' ? progress.claimedFreeTiers : progress.claimedPremiumTiers;
  if (claimedTiers.includes(tier)) {
    return {
      success: false,
      rewardType: 'dust',
      rewardDescription: '',
      error: BATTLE_PASS_ERROR_CODES.ALREADY_CLAIMED,
    };
  }

  // Find the reward
  const rewards = track === 'free' ? BATTLE_PASS_FREE_TRACK : BATTLE_PASS_PREMIUM_TRACK;
  const reward = rewards.find(r => r.tier === tier);

  if (!reward) {
    return {
      success: false,
      rewardType: 'dust',
      rewardDescription: '',
      error: BATTLE_PASS_ERROR_CODES.TIER_NOT_REACHED,
    };
  }

  // Grant reward and update claimed tiers in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Update claimed tiers
    const updateData = track === 'free'
      ? { claimedFreeTiers: { push: tier } }
      : { claimedPremiumTiers: { push: tier } };

    await tx.battlePassProgress.update({
      where: { id: progress.id },
      data: updateData,
    });

    // Grant reward based on type
    return grantReward(tx, userId, reward);
  });

  return {
    success: true,
    rewardType: reward.rewardType,
    rewardDescription: reward.description,
    amount: reward.amount,
    itemId: reward.itemId,
    newDustBalance: result.dust,
    newGoldBalance: result.gold,
  };
}

/**
 * Claim all available rewards
 */
export async function claimAllRewards(userId: string): Promise<ClaimAllBattlePassRewardsResponse> {
  const season = await getActiveSeason();

  if (!season) {
    return {
      claimedRewards: [],
      totalDustGained: 0,
      totalGoldGained: 0,
      newDustBalance: 0,
      newGoldBalance: 0,
    };
  }

  const progress = await prisma.battlePassProgress.findUnique({
    where: {
      userId_seasonId: {
        userId,
        seasonId: season.id,
      },
    },
  });

  if (!progress) {
    return {
      claimedRewards: [],
      totalDustGained: 0,
      totalGoldGained: 0,
      newDustBalance: 0,
      newGoldBalance: 0,
    };
  }

  // Find all unclaimed rewards for reached tiers
  const unclaimedFree = BATTLE_PASS_FREE_TRACK.filter(
    r => r.tier <= progress.currentTier && !progress.claimedFreeTiers.includes(r.tier)
  );

  const unclaimedPremium = progress.isPremium
    ? BATTLE_PASS_PREMIUM_TRACK.filter(
        r => r.tier <= progress.currentTier && !progress.claimedPremiumTiers.includes(r.tier)
      )
    : [];

  const allUnclaimed = [...unclaimedFree, ...unclaimedPremium];

  if (allUnclaimed.length === 0) {
    const inventory = await prisma.inventory.findUnique({
      where: { userId },
    });
    return {
      claimedRewards: [],
      totalDustGained: 0,
      totalGoldGained: 0,
      newDustBalance: inventory?.dust ?? 0,
      newGoldBalance: inventory?.gold ?? 0,
    };
  }

  // Grant all rewards in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Update claimed tiers
    const newClaimedFree = [...progress.claimedFreeTiers, ...unclaimedFree.map(r => r.tier)];
    const newClaimedPremium = [...progress.claimedPremiumTiers, ...unclaimedPremium.map(r => r.tier)];

    await tx.battlePassProgress.update({
      where: { id: progress.id },
      data: {
        claimedFreeTiers: newClaimedFree,
        claimedPremiumTiers: newClaimedPremium,
      },
    });

    // Grant all rewards
    let totalDust = 0;
    let totalGold = 0;

    for (const reward of allUnclaimed) {
      await grantReward(tx, userId, reward);
      if (reward.rewardType === 'dust' && reward.amount) {
        totalDust += reward.amount;
      }
      if (reward.rewardType === 'gold' && reward.amount) {
        totalGold += reward.amount;
      }
    }

    const inventory = await tx.inventory.findUnique({
      where: { userId },
    });

    return {
      totalDust,
      totalGold,
      newDustBalance: inventory?.dust ?? 0,
      newGoldBalance: inventory?.gold ?? 0,
    };
  });

  return {
    claimedRewards: allUnclaimed.map(r => ({
      tier: r.tier,
      track: r.track,
      rewardType: r.rewardType,
      description: r.description,
    })),
    totalDustGained: result.totalDust,
    totalGoldGained: result.totalGold,
    newDustBalance: result.newDustBalance,
    newGoldBalance: result.newGoldBalance,
  };
}

/**
 * Purchase tiers with dust
 */
export async function purchaseTiers(
  userId: string,
  tierCount: number
): Promise<BuyBattlePassTiersResponse> {
  const season = await getActiveSeason();

  if (!season) {
    return {
      success: false,
      tiersGained: 0,
      dustSpent: 0,
      newTier: 0,
      newDustBalance: 0,
      error: BATTLE_PASS_ERROR_CODES.NO_ACTIVE_SEASON,
    };
  }

  const progress = await prisma.battlePassProgress.findUnique({
    where: {
      userId_seasonId: {
        userId,
        seasonId: season.id,
      },
    },
  });

  if (!progress) {
    return {
      success: false,
      tiersGained: 0,
      dustSpent: 0,
      newTier: 0,
      newDustBalance: 0,
      error: BATTLE_PASS_ERROR_CODES.NO_ACTIVE_SEASON,
    };
  }

  // Check if already at max tier
  if (progress.currentTier >= BATTLE_PASS_CONFIG.maxTier) {
    return {
      success: false,
      tiersGained: 0,
      dustSpent: 0,
      newTier: progress.currentTier,
      newDustBalance: 0,
      error: BATTLE_PASS_ERROR_CODES.MAX_TIER_REACHED,
    };
  }

  // Calculate actual tiers that can be purchased
  const maxPurchasableTiers = BATTLE_PASS_CONFIG.maxTier - progress.currentTier;
  const actualTierCount = Math.min(tierCount, maxPurchasableTiers);
  const dustCost = actualTierCount * BATTLE_PASS_CONFIG.tierPurchaseDustCost;

  // Check dust balance
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
  });

  if (!inventory || inventory.dust < dustCost) {
    return {
      success: false,
      tiersGained: 0,
      dustSpent: 0,
      newTier: progress.currentTier,
      newDustBalance: inventory?.dust ?? 0,
      error: BATTLE_PASS_ERROR_CODES.INSUFFICIENT_DUST,
    };
  }

  // Purchase tiers in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Deduct dust
    const updatedInventory = await tx.inventory.update({
      where: { userId },
      data: { dust: { decrement: dustCost } },
    });

    // Update tier
    const newTier = progress.currentTier + actualTierCount;
    await tx.battlePassProgress.update({
      where: { id: progress.id },
      data: {
        currentTier: newTier,
        currentPoints: 0, // Reset points when buying tiers
      },
    });

    return {
      newTier,
      newDustBalance: updatedInventory.dust,
    };
  });

  return {
    success: true,
    tiersGained: actualTierCount,
    dustSpent: dustCost,
    newTier: result.newTier,
    newDustBalance: result.newDustBalance,
  };
}

/**
 * Upgrade to premium battle pass (creates Stripe checkout)
 */
export async function upgradeToPremium(
  userId: string,
  successUrl?: string,
  cancelUrl?: string
): Promise<PurchaseBattlePassResponse> {
  if (!isStripeConfigured()) {
    return {
      success: false,
      error: 'Stripe is not configured',
    };
  }

  const season = await getActiveSeason();

  if (!season) {
    return {
      success: false,
      error: BATTLE_PASS_ERROR_CODES.NO_ACTIVE_SEASON,
    };
  }

  // Check if already premium
  const progress = await prisma.battlePassProgress.findUnique({
    where: {
      userId_seasonId: {
        userId,
        seasonId: season.id,
      },
    },
  });

  if (progress?.isPremium) {
    return {
      success: false,
      error: BATTLE_PASS_ERROR_CODES.ALREADY_PREMIUM,
    };
  }

  // Create Stripe checkout session
  const productId = `battle_pass_s${season.seasonNumber}`;
  const session = await createCheckoutSession({
    userId,
    productId,
    productName: `${season.name} - Premium Battle Pass`,
    productDescription: `Unlock premium rewards track with exclusive heroes, skins, and 5,000+ Dust value!`,
    priceGrosze: BATTLE_PASS_CONFIG.premiumPriceGrosze,
    successUrl,
    cancelUrl,
  });

  // Create pending purchase record
  await prisma.shopPurchase.create({
    data: {
      userId,
      productId,
      productType: 'BATTLE_PASS',
      productName: `${season.name} - Premium Battle Pass`,
      pricePLN: BATTLE_PASS_CONFIG.premiumPriceGrosze,
      status: 'PENDING',
      stripeSessionId: session.id,
    },
  });

  return {
    success: true,
    checkoutUrl: session.url!,
    sessionId: session.id,
  };
}

/**
 * Grant premium status to user (called from Stripe webhook)
 */
export async function grantPremiumStatus(userId: string, seasonId?: string): Promise<boolean> {
  const season = seasonId
    ? await prisma.battlePassSeason.findUnique({ where: { id: seasonId } })
    : await getActiveSeason();

  if (!season) {
    return false;
  }

  await prisma.battlePassProgress.upsert({
    where: {
      userId_seasonId: {
        userId,
        seasonId: season.id,
      },
    },
    create: {
      userId,
      seasonId: season.id,
      currentTier: 0,
      currentPoints: 0,
      isPremium: true,
      claimedFreeTiers: [],
      claimedPremiumTiers: [],
      purchasedAt: new Date(),
    },
    update: {
      isPremium: true,
      purchasedAt: new Date(),
    },
  });

  return true;
}

// ============================================================================
// REWARD GRANTING
// ============================================================================

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function grantReward(
  tx: TransactionClient,
  userId: string,
  reward: BattlePassReward
): Promise<{ dust: number; gold: number }> {
  const inventory = await tx.inventory.findUnique({
    where: { userId },
  });

  if (!inventory) {
    throw new Error('Inventory not found');
  }

  switch (reward.rewardType) {
    case 'dust': {
      const updated = await tx.inventory.update({
        where: { userId },
        data: { dust: { increment: reward.amount ?? 0 } },
      });
      return { dust: updated.dust, gold: updated.gold };
    }

    case 'gold': {
      const updated = await tx.inventory.update({
        where: { userId },
        data: { gold: { increment: reward.amount ?? 0 } },
      });
      return { dust: updated.dust, gold: updated.gold };
    }

    case 'material': {
      const materialId = getRandomMaterial('rare');
      const currentMaterials = (inventory.materials as Record<string, number>) ?? {};
      const newMaterials = {
        ...currentMaterials,
        [materialId]: (currentMaterials[materialId] ?? 0) + (reward.amount ?? 1),
      };
      await tx.inventory.update({
        where: { userId },
        data: { materials: newMaterials },
      });
      return { dust: inventory.dust, gold: inventory.gold };
    }

    case 'legendary_material': {
      const materialId = getRandomMaterial('legendary');
      const currentMaterials = (inventory.materials as Record<string, number>) ?? {};
      const newMaterials = {
        ...currentMaterials,
        [materialId]: (currentMaterials[materialId] ?? 0) + (reward.amount ?? 1),
      };
      await tx.inventory.update({
        where: { userId },
        data: { materials: newMaterials },
      });
      return { dust: inventory.dust, gold: inventory.gold };
    }

    case 'artifact': {
      // For now, grant dust equivalent (artifact system can be added later)
      const dustValue = (reward.amount ?? 1) * 100;
      const updated = await tx.inventory.update({
        where: { userId },
        data: { dust: { increment: dustValue } },
      });
      return { dust: updated.dust, gold: updated.gold };
    }

    case 'hero_summon': {
      // Grant gacha pulls (add to pull count or grant directly)
      // For now, grant dust equivalent
      const dustValue = (reward.amount ?? 1) * 50;
      const updated = await tx.inventory.update({
        where: { userId },
        data: { dust: { increment: dustValue } },
      });
      return { dust: updated.dust, gold: updated.gold };
    }

    case 'cosmetic': {
      if (reward.itemId) {
        await tx.userCosmetic.upsert({
          where: { userId_cosmeticId: { userId, cosmeticId: reward.itemId } },
          create: { userId, cosmeticId: reward.itemId },
          update: {},
        });
      }
      return { dust: inventory.dust, gold: inventory.gold };
    }

    case 'hero': {
      if (reward.itemId) {
        await tx.inventory.update({
          where: { userId },
          data: {
            unlockedHeroIds: { push: reward.itemId },
          },
        });
      }
      return { dust: inventory.dust, gold: inventory.gold };
    }

    default:
      return { dust: inventory.dust, gold: inventory.gold };
  }
}
