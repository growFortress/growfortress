import { prisma } from '../lib/prisma.js';
import { HERO_UPGRADE_COSTS, TURRET_UPGRADE_COSTS } from '@arcade/protocol';

/**
 * Upgrade a hero to the next tier
 */
export async function upgradeHero(
  userId: string,
  _heroId: string,  // Reserved for future: track individual hero upgrades
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

  // Deduct cost from inventory
  const updatedInventory = await prisma.inventory.update({
    where: { userId },
    data: {
      gold: inventory.gold - cost.gold,
      dust: inventory.dust - cost.dust,
    },
  });

  return {
    success: true,
    newTier: currentTier + 1,
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
  _turretType: string,
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

  // Deduct cost from inventory
  const updatedInventory = await prisma.inventory.update({
    where: { userId },
    data: {
      gold: inventory.gold - cost.gold,
      dust: inventory.dust - cost.dust,
    },
  });

  return {
    success: true,
    newTier: currentTier + 1,
    newInventory: {
      gold: updatedInventory.gold,
      dust: updatedInventory.dust,
    },
  };
}
