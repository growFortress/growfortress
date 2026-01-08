import { prisma } from '../lib/prisma.js';
import { MATERIAL_DEFINITIONS, type MaterialDefinition } from '@arcade/sim-core';

/**
 * Idle Rewards Configuration
 * Balance: ~6 materials per 8h at level 1, ~10 at level 50
 */
const IDLE_CONFIG = {
  maxAccrualHours: 8,
  baseDropsPerHour: 0.75,      // ~6 materials at level 1 for 8h
  levelScalingPerLevel: 0.03,  // +0.24/8h per level
  minClaimIntervalMinutes: 5,  // Minimum 5 minutes between claims to prevent abuse

  // Rarity weights for idle drops (no common materials in idle)
  rarityWeights: {
    rare: 0.50,
    epic: 0.35,
    legendary: 0.15,
  } as Record<string, number>,

  // Level bonus for legendary chance (+0.5% per level)
  legendaryLevelBonus: 0.005,
};

export interface PendingIdleRewards {
  hoursOffline: number;
  cappedHours: number;
  pendingMaterials: Record<string, number>;
  pendingDust: number;
  canClaim: boolean;
  minutesUntilNextClaim: number;
}

export interface ClaimResult {
  success: boolean;
  claimed?: {
    materials: Record<string, number>;
    dust: number;
  };
  newInventory?: {
    materials: Record<string, number>;
    dust: number;
  };
  error?: string;
}

/**
 * Get materials grouped by rarity
 */
function getMaterialsByRarity(): Record<string, MaterialDefinition[]> {
  const byRarity: Record<string, MaterialDefinition[]> = {};

  for (const mat of MATERIAL_DEFINITIONS) {
    if (!byRarity[mat.rarity]) {
      byRarity[mat.rarity] = [];
    }
    byRarity[mat.rarity].push(mat);
  }

  return byRarity;
}

/**
 * Calculate expected materials for idle time
 */
function calculateExpectedMaterials(hoursOffline: number, commanderLevel: number): number {
  const cappedHours = Math.min(hoursOffline, IDLE_CONFIG.maxAccrualHours);
  const materialsPerHour = IDLE_CONFIG.baseDropsPerHour + (commanderLevel - 1) * IDLE_CONFIG.levelScalingPerLevel;
  return Math.floor(cappedHours * materialsPerHour);
}

/**
 * Generate idle material drops based on time offline and commander level
 */
function generateIdleDrops(
  hoursOffline: number,
  commanderLevel: number
): Record<string, number> {
  const cappedHours = Math.min(hoursOffline, IDLE_CONFIG.maxAccrualHours);
  const expectedMaterials = calculateExpectedMaterials(cappedHours, commanderLevel);

  if (expectedMaterials <= 0) {
    return {};
  }

  const materialsByRarity = getMaterialsByRarity();
  const drops: Record<string, number> = {};

  // Level affects legendary chance
  const legendaryBonus = commanderLevel * IDLE_CONFIG.legendaryLevelBonus;
  const adjustedWeights = {
    legendary: Math.min(0.40, IDLE_CONFIG.rarityWeights.legendary + legendaryBonus),
    epic: IDLE_CONFIG.rarityWeights.epic,
    rare: 0, // Calculated as remainder
  };
  adjustedWeights.rare = 1 - adjustedWeights.legendary - adjustedWeights.epic;

  for (let i = 0; i < expectedMaterials; i++) {
    const roll = Math.random();

    let selectedRarity: string;
    if (roll < adjustedWeights.legendary && materialsByRarity.legendary?.length) {
      selectedRarity = 'legendary';
    } else if (roll < adjustedWeights.legendary + adjustedWeights.epic && materialsByRarity.epic?.length) {
      selectedRarity = 'epic';
    } else if (materialsByRarity.rare?.length) {
      selectedRarity = 'rare';
    } else {
      // Fallback to any available material
      selectedRarity = Object.keys(materialsByRarity)[0];
    }

    const availableMaterials = materialsByRarity[selectedRarity];
    if (availableMaterials && availableMaterials.length > 0) {
      const selectedMaterial = availableMaterials[Math.floor(Math.random() * availableMaterials.length)];
      drops[selectedMaterial.id] = (drops[selectedMaterial.id] || 0) + 1;
    }
  }

  return drops;
}

/**
 * Calculate pending idle rewards for a user
 */
export async function calculatePendingIdleRewards(userId: string): Promise<PendingIdleRewards | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { progression: true },
  });

  if (!user || !user.progression) {
    return null;
  }

  const now = new Date();
  const lastClaim = user.lastIdleClaimAt;
  const hoursOffline = (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60);
  const minutesSinceLastClaim = hoursOffline * 60;

  const cappedHours = Math.min(hoursOffline, IDLE_CONFIG.maxAccrualHours);
  const canClaim = minutesSinceLastClaim >= IDLE_CONFIG.minClaimIntervalMinutes && cappedHours > 0;
  const minutesUntilNextClaim = Math.max(0, IDLE_CONFIG.minClaimIntervalMinutes - minutesSinceLastClaim);

  // Generate pending materials based on time offline
  const pendingMaterials = generateIdleDrops(cappedHours, user.progression.level);

  // Calculate bonus dust (10 dust per hour)
  const pendingDust = Math.floor(cappedHours * 10);

  return {
    hoursOffline: Math.round(hoursOffline * 100) / 100,
    cappedHours: Math.round(cappedHours * 100) / 100,
    pendingMaterials,
    pendingDust,
    canClaim,
    minutesUntilNextClaim: Math.ceil(minutesUntilNextClaim),
  };
}

/**
 * Claim idle rewards for a user
 */
export async function claimIdleRewards(userId: string): Promise<ClaimResult> {
  const pending = await calculatePendingIdleRewards(userId);

  if (!pending) {
    return { success: false, error: 'User not found' };
  }

  if (!pending.canClaim) {
    return {
      success: false,
      error: `Cannot claim yet. Wait ${pending.minutesUntilNextClaim} more minutes.`,
    };
  }

  const hasMaterials = Object.keys(pending.pendingMaterials).length > 0;
  const hasDust = pending.pendingDust > 0;

  if (!hasMaterials && !hasDust) {
    return { success: false, error: 'No rewards to claim' };
  }

  // Update database in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Update lastIdleClaimAt
    await tx.user.update({
      where: { id: userId },
      data: { lastIdleClaimAt: new Date() },
    });

    // Get current inventory
    const inventory = await tx.inventory.findUnique({
      where: { userId },
    });

    if (!inventory) {
      throw new Error('Inventory not found');
    }

    // Merge materials
    const currentMaterials = (inventory.materials as Record<string, number>) || {};
    const updatedMaterials = { ...currentMaterials };

    for (const [materialId, amount] of Object.entries(pending.pendingMaterials)) {
      updatedMaterials[materialId] = (updatedMaterials[materialId] || 0) + amount;
    }

    // Update inventory
    const updatedInventory = await tx.inventory.update({
      where: { userId },
      data: {
        materials: updatedMaterials,
        dust: { increment: pending.pendingDust },
      },
    });

    return {
      newMaterials: updatedMaterials,
      newDust: updatedInventory.dust,
    };
  });

  return {
    success: true,
    claimed: {
      materials: pending.pendingMaterials,
      dust: pending.pendingDust,
    },
    newInventory: {
      materials: result.newMaterials,
      dust: result.newDust,
    },
  };
}

/**
 * Get idle rewards configuration for display
 */
export function getIdleRewardsConfig(commanderLevel: number): {
  maxAccrualHours: number;
  expectedMaterialsPerHour: number;
  expectedMaterialsMax: number;
  legendaryChance: number;
} {
  const materialsPerHour = IDLE_CONFIG.baseDropsPerHour + (commanderLevel - 1) * IDLE_CONFIG.levelScalingPerLevel;
  const legendaryChance = Math.min(0.40, IDLE_CONFIG.rarityWeights.legendary + commanderLevel * IDLE_CONFIG.legendaryLevelBonus);

  return {
    maxAccrualHours: IDLE_CONFIG.maxAccrualHours,
    expectedMaterialsPerHour: Math.round(materialsPerHour * 100) / 100,
    expectedMaterialsMax: Math.floor(IDLE_CONFIG.maxAccrualHours * materialsPerHour),
    legendaryChance: Math.round(legendaryChance * 100),
  };
}
