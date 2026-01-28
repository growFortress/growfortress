import { randomInt } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import {
  MATERIAL_DEFINITIONS,
  type MaterialDefinition,
  // Colony imports
  COLONY_DEFINITIONS,
  getColonyById,
  calculateColonyGoldPerHour,
  calculateTotalGoldPerHour,
  calculateColonyUpgradeCost,
  type ActiveColony,
  // Prestige imports
  calculateStellarPoints,
  getPrestigeBonus,
  getPrestigeUnlocks,
  canPrestige,
  PRESTIGE_MINIMUM_GOLD,
  // Milestone imports
  COLONY_MILESTONES,
  getColonyMilestoneById,
  getNextColonyMilestone,
  getColonyMilestoneProgress,
} from '@arcade/sim-core';

/**
 * Generate a cryptographically secure random float between 0 and 1
 */
function secureRandomFloat(): number {
  return randomInt(0, 1_000_000_000) / 1_000_000_000;
}

/**
 * Idle Rewards Configuration
 * Balance: ~6 materials per 8h at level 1, ~10 at level 50
 * Dust: Premium currency - reduced rates (only with active colonies)
 */
const IDLE_CONFIG = {
  maxAccrualHours: 8,
  minClaimIntervalMinutes: 5,  // Minimum 5 minutes between claims to prevent abuse

  // Material drops
  baseDropsPerHour: 0.75,      // ~6 materials at level 1 for 8h
  levelScalingPerLevel: 0.03,  // +0.24/8h per level

  // Dust rewards (premium currency - heavily reduced, requires active colonies)
  baseDustPerHour: 0.25,       // 2 dust for full 8h at level 1 (premium)
  dustLevelScaling: 0.02,      // +0.02 dust/hour per level (premium)

  // Rarity weights for idle drops (no common materials in idle)
  rarityWeights: {
    rare: 0.50,
    epic: 0.35,
    legendary: 0.15,
  } as Record<string, number>,

  // Level bonus for legendary chance (+0.5% per level)
  legendaryLevelBonus: 0.005,
};

export interface ColonyStatus {
  id: string;
  name: string;
  level: number;
  maxLevel: number;
  goldPerHour: number;
  upgradeCost: number;
  canUpgrade: boolean;
  unlocked: boolean;
  unlockLevel: number;
  icon: string;
}

export interface PendingIdleRewards {
  hoursOffline: number;
  cappedHours: number;
  pendingMaterials: Record<string, number>;
  pendingDust: number;
  pendingGold: number;  // NEW: Gold from colonies
  colonies: ColonyStatus[];  // NEW: Colony status for UI
  totalGoldPerHour: number;  // NEW: Total colony gold production
  canClaim: boolean;
  minutesUntilNextClaim: number;
}

export interface ClaimResult {
  success: boolean;
  claimed?: {
    materials: Record<string, number>;
    dust: number;
    gold: number;  // NEW: Gold from colonies
  };
  newInventory?: {
    materials: Record<string, number>;
    dust: number;
    gold: number;  // NEW: Total gold after claim
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
  const legendaryWeight = Math.min(0.40, IDLE_CONFIG.rarityWeights.legendary + legendaryBonus);
  const epicWeight = IDLE_CONFIG.rarityWeights.epic;
  // Ensure rare weight is non-negative (defensive validation)
  const rareWeight = Math.max(0, 1 - legendaryWeight - epicWeight);
  const adjustedWeights = {
    legendary: legendaryWeight,
    epic: epicWeight,
    rare: rareWeight,
  };

  for (let i = 0; i < expectedMaterials; i++) {
    const roll = secureRandomFloat();

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
      const selectedMaterial = availableMaterials[randomInt(0, availableMaterials.length)];
      drops[selectedMaterial.id] = (drops[selectedMaterial.id] || 0) + 1;
    }
  }

  return drops;
}

/**
 * Parse colony levels from database JSON with safe validation
 */
function parseColonyLevels(json: unknown): Record<string, number> {
  const defaults = { farm: 0, mine: 0, market: 0, factory: 0 };
  if (typeof json !== 'object' || json === null) return defaults;

  const result = { ...defaults };
  for (const [key, val] of Object.entries(json)) {
    // Only allow known colony keys with valid non-negative number values
    if (key in defaults && typeof val === 'number' && val >= 0 && Number.isFinite(val)) {
      result[key as keyof typeof defaults] = Math.floor(val);
    }
  }
  return result;
}

/**
 * Convert colony levels to ActiveColony array
 */
function toActiveColonies(colonyLevels: Record<string, number>): ActiveColony[] {
  return COLONY_DEFINITIONS.map(def => ({
    id: def.id,
    level: colonyLevels[def.id] || 0,
    pendingGold: 0,  // Calculated separately
  }));
}

/**
 * Get colony status for display
 */
function getColonyStatusList(
  colonyLevels: Record<string, number>,
  commanderLevel: number,
  fortressLevel: number,
  availableGold: number
): ColonyStatus[] {
  return COLONY_DEFINITIONS.map(def => {
    const level = colonyLevels[def.id] || 0;
    const unlocked = commanderLevel >= def.unlockLevel;
    const goldPerHour = level > 0 ? calculateColonyGoldPerHour(def.id, level, fortressLevel) : def.baseGoldPerHour;
    const upgradeCost = level > 0 ? calculateColonyUpgradeCost(def.id, level) : def.baseUpgradeCost;
    const canUpgrade = unlocked && level < def.maxLevel && availableGold >= upgradeCost;

    return {
      id: def.id,
      name: def.name,
      level,
      maxLevel: def.maxLevel,
      goldPerHour,
      upgradeCost: upgradeCost === Infinity ? 0 : upgradeCost,
      canUpgrade,
      unlocked,
      unlockLevel: def.unlockLevel,
      icon: def.icon,
    };
  });
}

/**
 * Calculate gold from colonies for time offline
 */
function calculateColonyGold(
  colonies: ActiveColony[],
  hoursOffline: number,
  fortressLevel: number
): number {
  const cappedHours = Math.min(hoursOffline, IDLE_CONFIG.maxAccrualHours);
  const goldPerHour = calculateTotalGoldPerHour(colonies, fortressLevel);
  return Math.floor(goldPerHour * cappedHours);
}

/**
 * Calculate pending idle rewards for a user
 */
export async function calculatePendingIdleRewards(userId: string): Promise<PendingIdleRewards | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      progression: true,
      inventory: true,
      colonyProgress: true,
    },
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

  // Colony gold calculation
  const colonyLevels = user.colonyProgress
    ? parseColonyLevels(user.colonyProgress.colonyLevels)
    : { farm: 0, mine: 0, market: 0, factory: 0 };
  const colonies = toActiveColonies(colonyLevels);
  const fortressLevel = user.progression.level;  // Use commander level as fortress level
  const pendingGold = calculateColonyGold(colonies, cappedHours, fortressLevel);
  const totalGoldPerHour = calculateTotalGoldPerHour(colonies, fortressLevel);

  // Check if player has at least one active (unlocked AND level > 0) colony
  const hasActiveColony = COLONY_DEFINITIONS.some(def => {
    const level = colonyLevels[def.id] || 0;
    const unlocked = user.progression!.level >= def.unlockLevel;
    return unlocked && level > 0;
  });

  // Materials and dust ONLY awarded if player has active colonies
  // This prevents rewards when all buildings are locked or at level 0
  let pendingMaterials: Record<string, number> = {};
  let pendingDust = 0;

  if (hasActiveColony) {
    // Generate pending materials based on time offline
    pendingMaterials = generateIdleDrops(cappedHours, user.progression.level);

    // Calculate bonus dust (scales with level)
    const dustPerHour = IDLE_CONFIG.baseDustPerHour + (user.progression.level - 1) * IDLE_CONFIG.dustLevelScaling;
    pendingDust = Math.floor(cappedHours * dustPerHour);
  }

  // Get available gold for canUpgrade calculations
  const availableGold = (user.inventory?.gold || 0) + pendingGold;

  // Build colony status list for UI
  const colonyStatusList = getColonyStatusList(
    colonyLevels,
    user.progression.level,
    fortressLevel,
    availableGold
  );

  return {
    hoursOffline: Math.round(hoursOffline * 100) / 100,
    cappedHours: Math.round(cappedHours * 100) / 100,
    pendingMaterials,
    pendingDust,
    pendingGold,
    colonies: colonyStatusList,
    totalGoldPerHour,
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
  const hasGold = pending.pendingGold > 0;

  if (!hasMaterials && !hasDust && !hasGold) {
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

    // Update inventory with materials, dust, AND gold
    const updatedInventory = await tx.inventory.update({
      where: { userId },
      data: {
        materials: updatedMaterials,
        dust: { increment: pending.pendingDust },
        gold: { increment: pending.pendingGold },
      },
    });

    // Update colony progress lastClaimAt and totalGoldEarned for prestige
    await tx.colonyProgress.upsert({
      where: { userId },
      create: {
        userId,
        colonyLevels: { farm: 0, mine: 0, market: 0, factory: 0 },
        lastClaimAt: new Date(),
        pendingGold: 0,
        totalGoldEarned: BigInt(pending.pendingGold),
      },
      update: {
        lastClaimAt: new Date(),
        pendingGold: 0,
        totalGoldEarned: { increment: BigInt(pending.pendingGold) },
      },
    });

    return {
      newMaterials: updatedMaterials,
      newDust: updatedInventory.dust,
      newGold: updatedInventory.gold,
    };
  });

  return {
    success: true,
    claimed: {
      materials: pending.pendingMaterials,
      dust: pending.pendingDust,
      gold: pending.pendingGold,
    },
    newInventory: {
      materials: result.newMaterials,
      dust: result.newDust,
      gold: result.newGold,
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
  expectedDustPerHour: number;
  expectedDustMax: number;
  legendaryChance: number;
} {
  const materialsPerHour = IDLE_CONFIG.baseDropsPerHour + (commanderLevel - 1) * IDLE_CONFIG.levelScalingPerLevel;
  const dustPerHour = IDLE_CONFIG.baseDustPerHour + (commanderLevel - 1) * IDLE_CONFIG.dustLevelScaling;
  const legendaryChance = Math.min(0.40, IDLE_CONFIG.rarityWeights.legendary + commanderLevel * IDLE_CONFIG.legendaryLevelBonus);

  return {
    maxAccrualHours: IDLE_CONFIG.maxAccrualHours,
    expectedMaterialsPerHour: Math.round(materialsPerHour * 100) / 100,
    expectedMaterialsMax: Math.floor(IDLE_CONFIG.maxAccrualHours * materialsPerHour),
    expectedDustPerHour: Math.round(dustPerHour * 100) / 100,
    expectedDustMax: Math.floor(IDLE_CONFIG.maxAccrualHours * dustPerHour),
    legendaryChance: Math.round(legendaryChance * 100),
  };
}

/**
 * Colony upgrade result
 */
export interface ColonyUpgradeResult {
  success: boolean;
  colony?: ColonyStatus;
  goldSpent?: number;
  remainingGold?: number;
  error?: string;
}

/**
 * Upgrade a colony
 */
export async function upgradeColony(userId: string, colonyId: string): Promise<ColonyUpgradeResult> {
  // Validate colony exists
  const colonyDef = getColonyById(colonyId);
  if (!colonyDef) {
    return { success: false, error: 'Invalid colony ID' };
  }

  // Get user data
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      progression: true,
      inventory: true,
      colonyProgress: true,
    },
  });

  if (!user || !user.progression || !user.inventory) {
    return { success: false, error: 'User not found' };
  }

  // Check if colony is unlocked
  if (user.progression.level < colonyDef.unlockLevel) {
    return { success: false, error: `Colony requires commander level ${colonyDef.unlockLevel}` };
  }

  // Get current colony levels
  const colonyLevels = user.colonyProgress
    ? parseColonyLevels(user.colonyProgress.colonyLevels)
    : { farm: 0, mine: 0, market: 0, factory: 0 };

  const currentLevel = colonyLevels[colonyId] || 0;

  // Check if at max level
  if (currentLevel >= colonyDef.maxLevel) {
    return { success: false, error: 'Colony is at maximum level' };
  }

  // Calculate upgrade cost
  const upgradeCost = calculateColonyUpgradeCost(colonyId, currentLevel);

  // Check if user has enough gold
  if (user.inventory.gold < upgradeCost) {
    return { success: false, error: 'Not enough gold' };
  }

  // Perform upgrade in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Deduct gold
    const updatedInventory = await tx.inventory.update({
      where: { userId },
      data: {
        gold: { decrement: upgradeCost },
      },
    });

    // Update colony level
    const newLevel = currentLevel + 1;
    const updatedLevels = { ...colonyLevels, [colonyId]: newLevel };

    await tx.colonyProgress.upsert({
      where: { userId },
      create: {
        userId,
        colonyLevels: updatedLevels,
        lastClaimAt: new Date(),
        pendingGold: 0,
      },
      update: {
        colonyLevels: updatedLevels,
      },
    });

    return {
      newLevel,
      remainingGold: updatedInventory.gold,
    };
  });

  // Calculate new colony status
  const fortressLevel = user.progression.level;
  const newGoldPerHour = calculateColonyGoldPerHour(colonyId, result.newLevel, fortressLevel);
  const newUpgradeCost = result.newLevel < colonyDef.maxLevel
    ? calculateColonyUpgradeCost(colonyId, result.newLevel)
    : 0;

  return {
    success: true,
    colony: {
      id: colonyId,
      name: colonyDef.name,
      level: result.newLevel,
      maxLevel: colonyDef.maxLevel,
      goldPerHour: newGoldPerHour,
      upgradeCost: newUpgradeCost,
      canUpgrade: result.newLevel < colonyDef.maxLevel && result.remainingGold >= newUpgradeCost,
      unlocked: true,
      unlockLevel: colonyDef.unlockLevel,
      icon: colonyDef.icon,
    },
    goldSpent: upgradeCost,
    remainingGold: result.remainingGold,
  };
}

// ============================================================================
// PRESTIGE SYSTEM
// ============================================================================

export interface PrestigeStatusResult {
  stellarPoints: number;
  totalGoldEarned: string;
  prestigeCount: number;
  canPrestige: boolean;
  pendingStellarPoints: number;
  currentBonus: number;
  unlocks: string[];
}

/**
 * Get prestige status for a user
 */
export async function getPrestigeStatus(userId: string): Promise<PrestigeStatusResult | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      colonyProgress: true,
    },
  });

  if (!user) {
    return null;
  }

  const stellarPoints = user.colonyProgress?.stellarPoints ?? 0;
  const totalGoldEarned = user.colonyProgress?.totalGoldEarned ?? 0n;
  const prestigeCount = user.colonyProgress?.prestigeCount ?? 0;

  const pendingStellarPoints = calculateStellarPoints(totalGoldEarned) - stellarPoints;
  const currentBonus = getPrestigeBonus(stellarPoints);
  const unlocks = getPrestigeUnlocks(stellarPoints);

  return {
    stellarPoints,
    totalGoldEarned: totalGoldEarned.toString(),
    prestigeCount,
    canPrestige: canPrestige(totalGoldEarned) && pendingStellarPoints > 0,
    pendingStellarPoints: Math.max(0, pendingStellarPoints),
    currentBonus,
    unlocks,
  };
}

export interface PrestigeResult {
  success: boolean;
  error?: string;
  newStellarPoints?: number;
  newBonus?: number;
  newUnlocks?: string[];
}

/**
 * Perform prestige (stellar rebirth)
 */
export async function performPrestige(userId: string): Promise<PrestigeResult> {
  const colonyProgress = await prisma.colonyProgress.findUnique({
    where: { userId },
  });

  if (!colonyProgress) {
    return { success: false, error: 'Colony progress not found' };
  }

  const totalGoldEarned = colonyProgress.totalGoldEarned;

  if (!canPrestige(totalGoldEarned)) {
    return { success: false, error: `Requires at least ${PRESTIGE_MINIMUM_GOLD.toString()} total gold earned` };
  }

  const newStellarPoints = calculateStellarPoints(totalGoldEarned);
  const pointsToAdd = newStellarPoints - colonyProgress.stellarPoints;

  if (pointsToAdd <= 0) {
    return { success: false, error: 'No stellar points to earn' };
  }

  // Perform prestige in transaction
  await prisma.$transaction(async (tx) => {
    // Reset colony levels but keep stellar points and total gold earned
    await tx.colonyProgress.update({
      where: { userId },
      data: {
        colonyLevels: { farm: 0, mine: 0, market: 0, factory: 0 },
        stellarPoints: newStellarPoints,
        prestigeCount: { increment: 1 },
        lastPrestigeAt: new Date(),
        pendingGold: 0,
      },
    });
  });

  const newBonus = getPrestigeBonus(newStellarPoints);
  const newUnlocks = getPrestigeUnlocks(newStellarPoints);

  return {
    success: true,
    newStellarPoints,
    newBonus,
    newUnlocks,
  };
}

// ============================================================================
// MILESTONES
// ============================================================================

export interface MilestoneStatusResult {
  milestones: Array<{
    id: string;
    name: string;
    description: string;
    requirement: number;
    claimed: boolean;
    canClaim: boolean;
    reward: {
      gold?: number;
      dust?: number;
      material?: string;
      unlock?: string;
    };
  }>;
  currentGoldPerHour: number;
  nextMilestone: {
    id: string;
    name: string;
    description: string;
    requirement: number;
    claimed: boolean;
    canClaim: boolean;
    reward: {
      gold?: number;
      dust?: number;
      material?: string;
      unlock?: string;
    };
  } | null;
  progress: number | null;
}

/**
 * Get milestone status for a user
 */
export async function getMilestoneStatus(userId: string): Promise<MilestoneStatusResult | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      progression: true,
      colonyProgress: {
        include: {
          milestones: true,
        },
      },
    },
  });

  if (!user || !user.progression) {
    return null;
  }

  // Get colony levels and calculate gold per hour
  const colonyLevels = user.colonyProgress
    ? parseColonyLevels(user.colonyProgress.colonyLevels)
    : { farm: 0, mine: 0, market: 0, factory: 0 };
  const colonies = toActiveColonies(colonyLevels);
  const fortressLevel = user.progression.level;
  const goldPerHour = calculateTotalGoldPerHour(colonies, fortressLevel);

  // Get claimed milestone IDs
  const claimedIds = user.colonyProgress?.milestones.map(m => m.milestoneId) ?? [];

  // Build milestone status list
  const milestones = COLONY_MILESTONES.map(m => ({
    id: m.id,
    name: m.name,
    description: m.description,
    requirement: m.requirement,
    claimed: claimedIds.includes(m.id),
    canClaim: goldPerHour >= m.requirement && !claimedIds.includes(m.id),
    reward: m.reward,
  }));

  // Get next milestone
  const next = getNextColonyMilestone(goldPerHour);
  const nextMilestone = next ? {
    id: next.id,
    name: next.name,
    description: next.description,
    requirement: next.requirement,
    claimed: false,
    canClaim: false,
    reward: next.reward,
  } : null;

  // Get progress
  const progressData = getColonyMilestoneProgress(goldPerHour);
  const progress = progressData?.progress ?? null;

  return {
    milestones,
    currentGoldPerHour: goldPerHour,
    nextMilestone,
    progress,
  };
}

export interface ClaimMilestoneResult {
  success: boolean;
  error?: string;
  reward?: {
    gold?: number;
    dust?: number;
    materialId?: string;
    materialAmount?: number;
  };
  newInventory?: {
    gold: number;
    dust: number;
    materials: Record<string, number>;
  };
}

/**
 * Claim a milestone reward
 */
export async function claimMilestone(userId: string, milestoneId: string): Promise<ClaimMilestoneResult> {
  const milestone = getColonyMilestoneById(milestoneId);
  if (!milestone) {
    return { success: false, error: 'Invalid milestone ID' };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      progression: true,
      inventory: true,
      colonyProgress: {
        include: {
          milestones: true,
        },
      },
    },
  });

  if (!user || !user.progression || !user.inventory) {
    return { success: false, error: 'User not found' };
  }

  // Check if already claimed
  const alreadyClaimed = user.colonyProgress?.milestones.some(m => m.milestoneId === milestoneId);
  if (alreadyClaimed) {
    return { success: false, error: 'Milestone already claimed' };
  }

  // Check if milestone requirements are met
  const colonyLevels = user.colonyProgress
    ? parseColonyLevels(user.colonyProgress.colonyLevels)
    : { farm: 0, mine: 0, market: 0, factory: 0 };
  const colonies = toActiveColonies(colonyLevels);
  const fortressLevel = user.progression.level;
  const goldPerHour = calculateTotalGoldPerHour(colonies, fortressLevel);

  if (goldPerHour < milestone.requirement) {
    return { success: false, error: `Requires ${milestone.requirement} gold/hour production` };
  }

  // Ensure colonyProgress exists
  let colonyProgressId = user.colonyProgress?.id;
  if (!colonyProgressId) {
    const newProgress = await prisma.colonyProgress.create({
      data: {
        userId,
        colonyLevels: { farm: 0, mine: 0, market: 0, factory: 0 },
      },
    });
    colonyProgressId = newProgress.id;
  }

  // Claim reward in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create milestone claim record
    await tx.colonyMilestone.create({
      data: {
        colonyProgressId,
        milestoneId,
      },
    });

    // Apply rewards
    const goldReward = milestone.reward.gold ?? 0;
    const dustReward = milestone.reward.dust ?? 0;

    // Update inventory with gold and dust
    const updatedInventory = await tx.inventory.update({
      where: { userId },
      data: {
        gold: { increment: goldReward },
        dust: { increment: dustReward },
      },
    });

    // Handle material reward if present
    let materialId: string | undefined;
    let materialAmount = 0;
    if (milestone.reward.material) {
      // Find a random material of the specified rarity
      const materialsOfRarity = MATERIAL_DEFINITIONS.filter(
        m => m.rarity === milestone.reward.material
      );
      if (materialsOfRarity.length > 0) {
        const selected = materialsOfRarity[randomInt(0, materialsOfRarity.length)];
        materialId = selected.id;
        materialAmount = 1;

        // Add material to inventory
        const currentMaterials = (updatedInventory.materials as Record<string, number>) || {};
        const newMaterials = { ...currentMaterials };
        newMaterials[materialId] = (newMaterials[materialId] || 0) + materialAmount;

        await tx.inventory.update({
          where: { userId },
          data: { materials: newMaterials },
        });
      }
    }

    return {
      goldReward,
      dustReward,
      materialId,
      materialAmount,
      newGold: updatedInventory.gold + goldReward, // Already incremented above
      newDust: updatedInventory.dust + dustReward,
      newMaterials: updatedInventory.materials as Record<string, number>,
    };
  });

  return {
    success: true,
    reward: {
      gold: result.goldReward > 0 ? result.goldReward : undefined,
      dust: result.dustReward > 0 ? result.dustReward : undefined,
      materialId: result.materialId,
      materialAmount: result.materialAmount > 0 ? result.materialAmount : undefined,
    },
    newInventory: {
      gold: result.newGold,
      dust: result.newDust,
      materials: result.newMaterials,
    },
  };
}
