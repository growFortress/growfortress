import { prisma } from '../lib/prisma.js';
import { HERO_UPGRADE_COSTS, TURRET_UPGRADE_COSTS } from '@arcade/protocol';
import { refreshBattleHeroPower } from './guildBattleHero.js';

/**
 * Get hero tiers from power upgrades
 */
async function getHeroTiers(userId: string): Promise<Record<string, number>> {
  const powerUpgrades = await prisma.powerUpgrades.findUnique({
    where: { userId },
    select: { heroTiers: true },
  });
  return (powerUpgrades?.heroTiers as Record<string, number>) || {};
}

/**
 * Get turret tiers from power upgrades
 */
async function getTurretTiers(userId: string): Promise<Record<string, number>> {
  const powerUpgrades = await prisma.powerUpgrades.findUnique({
    where: { userId },
    select: { turretTiers: true },
  });
  return (powerUpgrades?.turretTiers as Record<string, number>) || {};
}

/**
 * Upgrade a hero to the next tier
 */
export async function upgradeHero(
  userId: string,
  heroId: string,
  currentTier: number
): Promise<{ success: boolean; newTier: number; newInventory: { gold: number; dust: number }; error?: string }> {
  // Validate tier
  if (currentTier < 1 || currentTier > 2) {
    return { success: false, newTier: currentTier, newInventory: { gold: 0, dust: 0 }, error: 'Invalid current tier' };
  }

  // Get upgrade cost
  const costKey = `${currentTier}_to_${currentTier + 1}` as keyof typeof HERO_UPGRADE_COSTS;
  const cost = HERO_UPGRADE_COSTS[costKey];

  if (!cost) {
    return { success: false, newTier: currentTier, newInventory: { gold: 0, dust: 0 }, error: 'Already at max tier' };
  }

  // Get user inventory
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
  });

  if (!inventory) {
    return { success: false, newTier: currentTier, newInventory: { gold: 0, dust: 0 }, error: 'Inventory not found' };
  }

  // Check if user can afford
  if (inventory.gold < cost.gold || inventory.dust < cost.dust) {
    return {
      success: false,
      newTier: currentTier,
      newInventory: { gold: inventory.gold, dust: inventory.dust },
      error: 'Not enough resources',
    };
  }

  // Get current hero tiers
  const heroTiers = await getHeroTiers(userId);

  // Verify current tier matches what's stored (or default to 1)
  const storedTier = heroTiers[heroId] || 1;
  if (storedTier !== currentTier) {
    return {
      success: false,
      newTier: storedTier,
      newInventory: { gold: inventory.gold, dust: inventory.dust },
      error: 'Tier mismatch - please refresh',
    };
  }

  const newTier = currentTier + 1;

  // Deduct cost and save new tier in a transaction
  const [updatedInventory] = await prisma.$transaction([
    prisma.inventory.update({
      where: { userId },
      data: {
        gold: inventory.gold - cost.gold,
        dust: inventory.dust - cost.dust,
      },
    }),
    prisma.powerUpgrades.upsert({
      where: { userId },
      create: {
        userId,
        heroTiers: { [heroId]: newTier },
      },
      update: {
        heroTiers: { ...heroTiers, [heroId]: newTier },
      },
    }),
  ]);

  // Auto-refresh Battle Hero power if this hero is set as Battle Hero
  // Use fire-and-forget to avoid blocking the response
  refreshBattleHeroPower(userId).catch((err) => {
    // Log error but don't fail the upgrade
    console.error(`Failed to refresh Battle Hero power for user ${userId}:`, err);
  });

  return {
    success: true,
    newTier,
    newInventory: {
      gold: updatedInventory.gold,
      dust: updatedInventory.dust,
    },
  };
}

/**
 * Upgrade a turret to the next tier
 */
export async function upgradeTurret(
  userId: string,
  turretType: string,
  _slotIndex: number,
  currentTier: number
): Promise<{ success: boolean; newTier: number; newInventory: { gold: number; dust: number }; error?: string }> {
  // Validate tier
  if (currentTier < 1 || currentTier > 2) {
    return { success: false, newTier: currentTier, newInventory: { gold: 0, dust: 0 }, error: 'Invalid current tier' };
  }

  // Get upgrade cost
  const costKey = `${currentTier}_to_${currentTier + 1}` as keyof typeof TURRET_UPGRADE_COSTS;
  const cost = TURRET_UPGRADE_COSTS[costKey];

  if (!cost) {
    return { success: false, newTier: currentTier, newInventory: { gold: 0, dust: 0 }, error: 'Already at max tier' };
  }

  // Get user inventory
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
  });

  if (!inventory) {
    return { success: false, newTier: currentTier, newInventory: { gold: 0, dust: 0 }, error: 'Inventory not found' };
  }

  // Check if user can afford
  if (inventory.gold < cost.gold || inventory.dust < cost.dust) {
    return {
      success: false,
      newTier: currentTier,
      newInventory: { gold: inventory.gold, dust: inventory.dust },
      error: 'Not enough resources',
    };
  }

  // Get current turret tiers
  const turretTiers = await getTurretTiers(userId);

  // Verify current tier matches what's stored (or default to 1)
  const storedTier = turretTiers[turretType] || 1;
  if (storedTier !== currentTier) {
    return {
      success: false,
      newTier: storedTier,
      newInventory: { gold: inventory.gold, dust: inventory.dust },
      error: 'Tier mismatch - please refresh',
    };
  }

  const newTier = currentTier + 1;

  // Deduct cost and save new tier in a transaction
  const [updatedInventory] = await prisma.$transaction([
    prisma.inventory.update({
      where: { userId },
      data: {
        gold: inventory.gold - cost.gold,
        dust: inventory.dust - cost.dust,
      },
    }),
    prisma.powerUpgrades.upsert({
      where: { userId },
      create: {
        userId,
        turretTiers: { [turretType]: newTier },
      },
      update: {
        turretTiers: { ...turretTiers, [turretType]: newTier },
      },
    }),
  ]);

  return {
    success: true,
    newTier,
    newInventory: {
      gold: updatedInventory.gold,
      dust: updatedInventory.dust,
    },
  };
}

/**
 * Get all hero tiers for a user (exported for session start)
 */
export async function getUserHeroTiers(userId: string): Promise<Record<string, number>> {
  return getHeroTiers(userId);
}

/**
 * Get all turret tiers for a user (exported for session start)
 */
export async function getUserTurretTiers(userId: string): Promise<Record<string, number>> {
  return getTurretTiers(userId);
}
