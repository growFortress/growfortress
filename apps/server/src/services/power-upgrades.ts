/**
 * Power Upgrades Service
 *
 * Handles permanent meta-progression upgrades:
 * - Fortress stat upgrades (gold-based)
 * - Hero stat upgrades (gold-based)
 * - Turret stat upgrades (gold-based)
 * - Item tier upgrades (gold-based)
 */

import { prisma } from '../lib/prisma.js';
import { refreshBattleHeroPower } from './guildBattleHero.js';
import type {
  PowerUpgradeResponse,
  PowerSummaryResponse,
  FortressUpgradableStat,
  PowerHeroUpgradableStat,
  PowerTurretUpgradableStat,
  PrestigeUpgradeResponse,
  FortressPrestige,
  TurretPrestige,
} from '@arcade/protocol';
import {
  MAX_PRESTIGE_LEVEL,
  PRESTIGE_COSTS,
} from '@arcade/protocol';
import {
  type PlayerPowerData,
  type HeroUpgrades,
  type TurretUpgrades,
  type ItemTierUpgrade,
  type StatUpgradeConfig,
  type HeroStatUpgradeConfig,
  createDefaultPlayerPowerData,
  createDefaultStatUpgrades,
  getNextItemTier,
  isMaxItemTier,
  FORTRESS_STAT_UPGRADES,
  HERO_STAT_UPGRADES,
  TURRET_STAT_UPGRADES,
  ITEM_TIER_CONFIG,
  getUpgradeCost,
  getHeroUpgradeCost,
  calculateTotalPower,
  calculateQuickTotalPower,
  type TierMaps,
} from '@arcade/sim-core';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Default fortress prestige data
 */
const DEFAULT_FORTRESS_PRESTIGE: FortressPrestige = {
  hp: 0,
  damage: 0,
  armor: 0,
};

/**
 * Get or create power upgrades for user
 */
async function getOrCreatePowerUpgrades(userId: string): Promise<{
  id: string;
  powerData: PlayerPowerData;
  cachedTotalPower: number;
  fortressPrestige: FortressPrestige;
  turretPrestige: TurretPrestige[];
}> {
  let powerUpgrades = await prisma.powerUpgrades.findUnique({
    where: { userId },
  });

  if (!powerUpgrades) {
    const defaultData = createDefaultPlayerPowerData();
    // Get commander level to calculate initial power
    const commanderLevel = await getCommanderLevel(userId);
    const initialPower = calculateQuickTotalPower(defaultData, commanderLevel);

    powerUpgrades = await prisma.powerUpgrades.create({
      data: {
        userId,
        fortressUpgrades: JSON.stringify(defaultData.fortressUpgrades),
        heroUpgrades: JSON.stringify(defaultData.heroUpgrades),
        turretUpgrades: JSON.stringify(defaultData.turretUpgrades),
        itemTiers: JSON.stringify(defaultData.itemTiers),
        cachedTotalPower: initialPower,
        fortressPrestige: DEFAULT_FORTRESS_PRESTIGE,
        turretPrestige: [],
      },
    });
  }

  // Parse prestige data from JSON
  const fortressPrestige = (powerUpgrades.fortressPrestige as FortressPrestige | null) || DEFAULT_FORTRESS_PRESTIGE;
  const turretPrestige = (powerUpgrades.turretPrestige as TurretPrestige[] | null) || [];

  return {
    id: powerUpgrades.id,
    powerData: {
      fortressUpgrades: JSON.parse(powerUpgrades.fortressUpgrades as string),
      heroUpgrades: JSON.parse(powerUpgrades.heroUpgrades as string),
      turretUpgrades: JSON.parse(powerUpgrades.turretUpgrades as string),
      itemTiers: JSON.parse(powerUpgrades.itemTiers as string),
    },
    cachedTotalPower: powerUpgrades.cachedTotalPower,
    fortressPrestige,
    turretPrestige,
  };
}

/**
 * Get commander level for power calculations
 */
async function getCommanderLevel(userId: string): Promise<number> {
  const progression = await prisma.progression.findUnique({
    where: { userId },
  });
  return progression?.level ?? 1;
}

/**
 * Find stat config by stat name
 */
function findStatConfig(
  configs: StatUpgradeConfig[],
  stat: string
): StatUpgradeConfig | undefined {
  return configs.find(c => c.stat === stat);
}

/**
 * Find hero stat config by stat name (uses HeroStatUpgradeConfig with exponential cost)
 */
function findHeroStatConfig(
  stat: string
): HeroStatUpgradeConfig | undefined {
  return HERO_STAT_UPGRADES.find(c => c.stat === stat);
}

// ============================================================================
// FORTRESS STAT UPGRADE
// ============================================================================

export async function upgradeFortressStat(
  userId: string,
  stat: FortressUpgradableStat
): Promise<PowerUpgradeResponse> {
  // Find stat config
  const config = findStatConfig(FORTRESS_STAT_UPGRADES, stat);
  if (!config) {
    return {
      success: false,
      goldSpent: 0,
      newGold: 0,
      newTotalPower: 0,
      error: 'Invalid stat',
    };
  }

  // Get power upgrades and inventory
  const [{ powerData }, inventory, commanderLevel] = await Promise.all([
    getOrCreatePowerUpgrades(userId),
    prisma.inventory.findUnique({ where: { userId } }),
    getCommanderLevel(userId),
  ]);

  if (!inventory) {
    return {
      success: false,
      goldSpent: 0,
      newGold: 0,
      newTotalPower: 0,
      error: 'Inventory not found',
    };
  }

  // Get current level
  const currentLevel = powerData.fortressUpgrades.statUpgrades[stat] || 0;

  // Check max level
  if (currentLevel >= config.maxLevel) {
    return {
      success: false,
      newLevel: currentLevel,
      goldSpent: 0,
      newGold: inventory.gold,
      newTotalPower: calculateQuickTotalPower(powerData, commanderLevel),
      error: 'Max level reached',
    };
  }

  // Calculate cost
  const cost = getUpgradeCost(config, currentLevel);

  // Check gold
  if (inventory.gold < cost) {
    return {
      success: false,
      newLevel: currentLevel,
      goldSpent: 0,
      newGold: inventory.gold,
      newTotalPower: calculateQuickTotalPower(powerData, commanderLevel),
      error: 'Not enough gold',
    };
  }

  // Update power data
  const newLevel = currentLevel + 1;
  powerData.fortressUpgrades.statUpgrades[stat] = newLevel;

  // Calculate new total power
  const newTotalPower = calculateQuickTotalPower(powerData, commanderLevel);

  // Persist changes
  await Promise.all([
    prisma.inventory.update({
      where: { userId },
      data: { gold: inventory.gold - cost },
    }),
    prisma.powerUpgrades.upsert({
      where: { userId },
      create: {
        userId,
        fortressUpgrades: JSON.stringify(powerData.fortressUpgrades),
        heroUpgrades: JSON.stringify(powerData.heroUpgrades),
        turretUpgrades: JSON.stringify(powerData.turretUpgrades),
        itemTiers: JSON.stringify(powerData.itemTiers),
        cachedTotalPower: newTotalPower,
      },
      update: {
        fortressUpgrades: JSON.stringify(powerData.fortressUpgrades),
        cachedTotalPower: newTotalPower,
      },
    }),
  ]);

  return {
    success: true,
    newLevel,
    goldSpent: cost,
    newGold: inventory.gold - cost,
    newTotalPower,
  };
}

// ============================================================================
// BATCH FORTRESS STAT UPGRADE
// ============================================================================

export interface BatchUpgradeRequest {
  stat: FortressUpgradableStat;
  targetLevel: number | 'max'; // 'max' = upgrade to max affordable level
}

export interface BatchUpgradeResponse {
  success: boolean;
  levelsGained: number;
  newLevel: number;
  goldSpent: number;
  newGold: number;
  newTotalPower: number;
  error?: string;
}

/**
 * Upgrade fortress stat by multiple levels at once.
 * Can specify targetLevel as a number or 'max' to upgrade as high as possible.
 */
export async function batchUpgradeFortressStat(
  userId: string,
  stat: FortressUpgradableStat,
  targetLevel: number | 'max'
): Promise<BatchUpgradeResponse> {
  const config = findStatConfig(FORTRESS_STAT_UPGRADES, stat);
  if (!config) {
    return {
      success: false,
      levelsGained: 0,
      newLevel: 0,
      goldSpent: 0,
      newGold: 0,
      newTotalPower: 0,
      error: 'Invalid stat',
    };
  }

  const [{ powerData }, inventory, commanderLevel] = await Promise.all([
    getOrCreatePowerUpgrades(userId),
    prisma.inventory.findUnique({ where: { userId } }),
    getCommanderLevel(userId),
  ]);

  if (!inventory) {
    return {
      success: false,
      levelsGained: 0,
      newLevel: 0,
      goldSpent: 0,
      newGold: 0,
      newTotalPower: 0,
      error: 'Inventory not found',
    };
  }

  const currentLevel = powerData.fortressUpgrades.statUpgrades[stat] || 0;

  // Determine actual target level
  let actualTarget: number;
  if (targetLevel === 'max') {
    actualTarget = config.maxLevel;
  } else {
    actualTarget = Math.min(targetLevel, config.maxLevel);
  }

  if (currentLevel >= actualTarget) {
    return {
      success: false,
      levelsGained: 0,
      newLevel: currentLevel,
      goldSpent: 0,
      newGold: inventory.gold,
      newTotalPower: calculateQuickTotalPower(powerData, commanderLevel),
      error: currentLevel >= config.maxLevel ? 'Max level reached' : 'Target level not higher than current',
    };
  }

  // Calculate total cost and find affordable level
  let totalCost = 0;
  let newLevel = currentLevel;
  let availableGold = inventory.gold;

  while (newLevel < actualTarget) {
    const nextLevelCost = getUpgradeCost(config, newLevel);
    if (totalCost + nextLevelCost > availableGold) {
      // Can't afford next level, stop here
      if (targetLevel === 'max') {
        break; // This is fine for 'max' mode
      } else {
        // Explicit target requested but can't afford
        return {
          success: false,
          levelsGained: 0,
          newLevel: currentLevel,
          goldSpent: 0,
          newGold: inventory.gold,
          newTotalPower: calculateQuickTotalPower(powerData, commanderLevel),
          error: 'Not enough gold',
        };
      }
    }
    totalCost += nextLevelCost;
    newLevel++;
  }

  const levelsGained = newLevel - currentLevel;
  if (levelsGained === 0) {
    return {
      success: false,
      levelsGained: 0,
      newLevel: currentLevel,
      goldSpent: 0,
      newGold: inventory.gold,
      newTotalPower: calculateQuickTotalPower(powerData, commanderLevel),
      error: 'Not enough gold for any upgrades',
    };
  }

  // Apply upgrade
  powerData.fortressUpgrades.statUpgrades[stat] = newLevel;
  const newTotalPower = calculateQuickTotalPower(powerData, commanderLevel);

  await Promise.all([
    prisma.inventory.update({
      where: { userId },
      data: { gold: inventory.gold - totalCost },
    }),
    prisma.powerUpgrades.upsert({
      where: { userId },
      create: {
        userId,
        fortressUpgrades: JSON.stringify(powerData.fortressUpgrades),
        heroUpgrades: JSON.stringify(powerData.heroUpgrades),
        turretUpgrades: JSON.stringify(powerData.turretUpgrades),
        itemTiers: JSON.stringify(powerData.itemTiers),
        cachedTotalPower: newTotalPower,
      },
      update: {
        fortressUpgrades: JSON.stringify(powerData.fortressUpgrades),
        cachedTotalPower: newTotalPower,
      },
    }),
  ]);

  return {
    success: true,
    levelsGained,
    newLevel,
    goldSpent: totalCost,
    newGold: inventory.gold - totalCost,
    newTotalPower,
  };
}

// ============================================================================
// HERO STAT UPGRADE
// ============================================================================

export async function upgradeHeroStat(
  userId: string,
  heroId: string,
  stat: PowerHeroUpgradableStat
): Promise<PowerUpgradeResponse> {
  // Find hero stat config (uses exponential cost, no max level)
  const config = findHeroStatConfig(stat);
  if (!config) {
    return {
      success: false,
      goldSpent: 0,
      newGold: 0,
      newTotalPower: 0,
      error: 'Invalid stat',
    };
  }

  // Get power upgrades and inventory
  const [{ powerData }, inventory, commanderLevel] = await Promise.all([
    getOrCreatePowerUpgrades(userId),
    prisma.inventory.findUnique({ where: { userId } }),
    getCommanderLevel(userId),
  ]);

  if (!inventory) {
    return {
      success: false,
      goldSpent: 0,
      newGold: 0,
      newTotalPower: 0,
      error: 'Inventory not found',
    };
  }

  // Find or create hero upgrades
  let heroUpgrade = powerData.heroUpgrades.find((h: HeroUpgrades) => h.heroId === heroId);
  if (!heroUpgrade) {
    heroUpgrade = { heroId, statUpgrades: createDefaultStatUpgrades() };
    powerData.heroUpgrades.push(heroUpgrade);
  }

  // Get current level
  const currentLevel = heroUpgrade.statUpgrades[stat] || 0;

  // No max level check - hero upgrades are unlimited with exponential cost

  // Calculate cost using exponential formula
  const cost = getHeroUpgradeCost(config, currentLevel);

  // Check gold
  if (inventory.gold < cost) {
    return {
      success: false,
      newLevel: currentLevel,
      goldSpent: 0,
      newGold: inventory.gold,
      newTotalPower: calculateQuickTotalPower(powerData, commanderLevel),
      error: 'Not enough gold',
    };
  }

  // Update power data
  const newLevel = currentLevel + 1;
  heroUpgrade.statUpgrades[stat] = newLevel;

  // Calculate new total power
  const newTotalPower = calculateQuickTotalPower(powerData, commanderLevel);

  // Persist changes
  await Promise.all([
    prisma.inventory.update({
      where: { userId },
      data: { gold: inventory.gold - cost },
    }),
    prisma.powerUpgrades.upsert({
      where: { userId },
      create: {
        userId,
        fortressUpgrades: JSON.stringify(powerData.fortressUpgrades),
        heroUpgrades: JSON.stringify(powerData.heroUpgrades),
        turretUpgrades: JSON.stringify(powerData.turretUpgrades),
        itemTiers: JSON.stringify(powerData.itemTiers),
        cachedTotalPower: newTotalPower,
      },
      update: {
        heroUpgrades: JSON.stringify(powerData.heroUpgrades),
        cachedTotalPower: newTotalPower,
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
    newLevel,
    goldSpent: cost,
    newGold: inventory.gold - cost,
    newTotalPower,
  };
}

// ============================================================================
// TURRET STAT UPGRADE
// ============================================================================

export async function upgradeTurretStat(
  userId: string,
  turretType: string,
  stat: PowerTurretUpgradableStat
): Promise<PowerUpgradeResponse> {
  // Find stat config
  const config = findStatConfig(TURRET_STAT_UPGRADES, stat);
  if (!config) {
    return {
      success: false,
      goldSpent: 0,
      newGold: 0,
      newTotalPower: 0,
      error: 'Invalid stat',
    };
  }

  // Get power upgrades and inventory
  const [{ powerData }, inventory, commanderLevel] = await Promise.all([
    getOrCreatePowerUpgrades(userId),
    prisma.inventory.findUnique({ where: { userId } }),
    getCommanderLevel(userId),
  ]);

  if (!inventory) {
    return {
      success: false,
      goldSpent: 0,
      newGold: 0,
      newTotalPower: 0,
      error: 'Inventory not found',
    };
  }

  // Find or create turret upgrades
  let turretUpgrade = powerData.turretUpgrades.find((t: TurretUpgrades) => t.turretType === turretType);
  if (!turretUpgrade) {
    turretUpgrade = { turretType, statUpgrades: createDefaultStatUpgrades() };
    powerData.turretUpgrades.push(turretUpgrade);
  }

  // Get current level
  const currentLevel = turretUpgrade.statUpgrades[stat] || 0;

  // Check max level
  if (currentLevel >= config.maxLevel) {
    return {
      success: false,
      newLevel: currentLevel,
      goldSpent: 0,
      newGold: inventory.gold,
      newTotalPower: calculateQuickTotalPower(powerData, commanderLevel),
      error: 'Max level reached',
    };
  }

  // Calculate cost
  const cost = getUpgradeCost(config, currentLevel);

  // Check gold
  if (inventory.gold < cost) {
    return {
      success: false,
      newLevel: currentLevel,
      goldSpent: 0,
      newGold: inventory.gold,
      newTotalPower: calculateQuickTotalPower(powerData, commanderLevel),
      error: 'Not enough gold',
    };
  }

  // Update power data
  const newLevel = currentLevel + 1;
  turretUpgrade.statUpgrades[stat] = newLevel;

  // Calculate new total power
  const newTotalPower = calculateQuickTotalPower(powerData, commanderLevel);

  // Persist changes
  await Promise.all([
    prisma.inventory.update({
      where: { userId },
      data: { gold: inventory.gold - cost },
    }),
    prisma.powerUpgrades.upsert({
      where: { userId },
      create: {
        userId,
        fortressUpgrades: JSON.stringify(powerData.fortressUpgrades),
        heroUpgrades: JSON.stringify(powerData.heroUpgrades),
        turretUpgrades: JSON.stringify(powerData.turretUpgrades),
        itemTiers: JSON.stringify(powerData.itemTiers),
        cachedTotalPower: newTotalPower,
      },
      update: {
        turretUpgrades: JSON.stringify(powerData.turretUpgrades),
        cachedTotalPower: newTotalPower,
      },
    }),
  ]);

  return {
    success: true,
    newLevel,
    goldSpent: cost,
    newGold: inventory.gold - cost,
    newTotalPower,
  };
}

// ============================================================================
// ITEM TIER UPGRADE
// ============================================================================

export async function upgradeItemTier(
  userId: string,
  itemId: string
): Promise<PowerUpgradeResponse> {
  // Get power upgrades and inventory
  const [{ powerData }, inventory, commanderLevel] = await Promise.all([
    getOrCreatePowerUpgrades(userId),
    prisma.inventory.findUnique({ where: { userId } }),
    getCommanderLevel(userId),
  ]);

  if (!inventory) {
    return {
      success: false,
      goldSpent: 0,
      newGold: 0,
      newTotalPower: 0,
      error: 'Inventory not found',
    };
  }

  // Find or create item tier
  let itemTierUpgrade = powerData.itemTiers.find((i: ItemTierUpgrade) => i.itemId === itemId);
  if (!itemTierUpgrade) {
    itemTierUpgrade = { itemId, tier: 'common' };
    powerData.itemTiers.push(itemTierUpgrade);
  }

  const currentTier = itemTierUpgrade.tier;

  // Check max tier
  if (isMaxItemTier(currentTier)) {
    return {
      success: false,
      newTier: currentTier,
      goldSpent: 0,
      newGold: inventory.gold,
      newTotalPower: calculateQuickTotalPower(powerData, commanderLevel),
      error: 'Max tier reached',
    };
  }

  // Get upgrade cost
  const cost = ITEM_TIER_CONFIG[currentTier].upgradeCost;
  if (cost === null) {
    return {
      success: false,
      newTier: currentTier,
      goldSpent: 0,
      newGold: inventory.gold,
      newTotalPower: calculateQuickTotalPower(powerData, commanderLevel),
      error: 'Max tier reached',
    };
  }

  // Check gold
  if (inventory.gold < cost) {
    return {
      success: false,
      newTier: currentTier,
      goldSpent: 0,
      newGold: inventory.gold,
      newTotalPower: calculateQuickTotalPower(powerData, commanderLevel),
      error: 'Not enough gold',
    };
  }

  // Get next tier
  const nextTier = getNextItemTier(currentTier);
  if (!nextTier) {
    return {
      success: false,
      newTier: currentTier,
      goldSpent: 0,
      newGold: inventory.gold,
      newTotalPower: calculateQuickTotalPower(powerData, commanderLevel),
      error: 'Max tier reached',
    };
  }

  // Update tier
  itemTierUpgrade.tier = nextTier;

  // Calculate new total power
  const newTotalPower = calculateQuickTotalPower(powerData, commanderLevel);

  // Persist changes
  await Promise.all([
    prisma.inventory.update({
      where: { userId },
      data: { gold: inventory.gold - cost },
    }),
    prisma.powerUpgrades.upsert({
      where: { userId },
      create: {
        userId,
        fortressUpgrades: JSON.stringify(powerData.fortressUpgrades),
        heroUpgrades: JSON.stringify(powerData.heroUpgrades),
        turretUpgrades: JSON.stringify(powerData.turretUpgrades),
        itemTiers: JSON.stringify(powerData.itemTiers),
        cachedTotalPower: newTotalPower,
      },
      update: {
        itemTiers: JSON.stringify(powerData.itemTiers),
        cachedTotalPower: newTotalPower,
      },
    }),
  ]);

  return {
    success: true,
    newTier: nextTier,
    goldSpent: cost,
    newGold: inventory.gold - cost,
    newTotalPower,
  };
}

// ============================================================================
// GET POWER SUMMARY
// ============================================================================

export async function getPowerSummary(userId: string): Promise<PowerSummaryResponse> {
  const [{ powerData }, commanderLevel] = await Promise.all([
    getOrCreatePowerUpgrades(userId),
    getCommanderLevel(userId),
  ]);

  // For now, use default tier 1 for all entities (actual tiers would come from game session)
  const tiers: TierMaps = {
    heroTiers: {},
    turretTiers: {},
  };

  const summary = calculateTotalPower(powerData, commanderLevel, tiers);

  return {
    fortressPower: summary.fortressPower,
    heroPower: summary.heroPower,
    turretPower: summary.turretPower,
    itemPower: summary.itemPower,
    totalPower: summary.totalPower,
    fortressUpgrades: powerData.fortressUpgrades.statUpgrades,
    heroUpgrades: powerData.heroUpgrades,
    turretUpgrades: powerData.turretUpgrades,
    itemTiers: powerData.itemTiers,
  };
}

// ============================================================================
// GET CACHED TOTAL POWER
// ============================================================================

export async function getCachedTotalPower(userId: string): Promise<number> {
  const { cachedTotalPower } = await getOrCreatePowerUpgrades(userId);
  return cachedTotalPower;
}

// ============================================================================
// PRESTIGE FORTRESS STAT
// ============================================================================

/**
 * Calculate prestige cost (gold + dust)
 */
function calculatePrestigeCost(currentPrestigeLevel: number): { gold: number; dust: number } {
  const scalingFactor = Math.pow(PRESTIGE_COSTS.scalingMultiplier, currentPrestigeLevel);
  return {
    gold: Math.floor(PRESTIGE_COSTS.baseGold * scalingFactor),
    dust: Math.floor(PRESTIGE_COSTS.baseDust * scalingFactor),
  };
}

/**
 * Prestige a fortress stat
 * - Requires stat to be at max level (20)
 * - Costs gold + dust
 * - Resets stat level to 0
 * - Grants permanent +5% bonus to that stat
 */
export async function prestigeFortressStat(
  userId: string,
  stat: FortressUpgradableStat
): Promise<PrestigeUpgradeResponse> {
  // Get power upgrades and inventory
  const [{ powerData, fortressPrestige }, inventory] = await Promise.all([
    getOrCreatePowerUpgrades(userId),
    prisma.inventory.findUnique({ where: { userId } }),
  ]);

  if (!inventory) {
    return {
      success: false,
      newPrestigeLevel: 0,
      goldSpent: 0,
      dustSpent: 0,
      newGold: 0,
      newDust: 0,
      statReset: false,
      error: 'Inventory not found',
    };
  }

  // Get current stat level
  const currentStatLevel = powerData.fortressUpgrades.statUpgrades[stat] || 0;
  const maxLevel = 20; // Max stat level

  // Check if at max level
  if (currentStatLevel < maxLevel) {
    return {
      success: false,
      newPrestigeLevel: fortressPrestige[stat] || 0,
      goldSpent: 0,
      dustSpent: 0,
      newGold: inventory.gold,
      newDust: inventory.dust,
      statReset: false,
      error: `Stat must be at max level (${maxLevel}) to prestige`,
    };
  }

  // Get current prestige level
  const currentPrestigeLevel = fortressPrestige[stat] || 0;

  // Check max prestige
  if (currentPrestigeLevel >= MAX_PRESTIGE_LEVEL) {
    return {
      success: false,
      newPrestigeLevel: currentPrestigeLevel,
      goldSpent: 0,
      dustSpent: 0,
      newGold: inventory.gold,
      newDust: inventory.dust,
      statReset: false,
      error: `Max prestige level (${MAX_PRESTIGE_LEVEL}) reached`,
    };
  }

  // Calculate cost
  const { gold: goldCost, dust: dustCost } = calculatePrestigeCost(currentPrestigeLevel);

  // Check resources
  if (inventory.gold < goldCost) {
    return {
      success: false,
      newPrestigeLevel: currentPrestigeLevel,
      goldSpent: 0,
      dustSpent: 0,
      newGold: inventory.gold,
      newDust: inventory.dust,
      statReset: false,
      error: `Not enough gold (need ${goldCost})`,
    };
  }

  if (inventory.dust < dustCost) {
    return {
      success: false,
      newPrestigeLevel: currentPrestigeLevel,
      goldSpent: 0,
      dustSpent: 0,
      newGold: inventory.gold,
      newDust: inventory.dust,
      statReset: false,
      error: `Not enough dust (need ${dustCost})`,
    };
  }

  // Apply prestige
  const newPrestigeLevel = currentPrestigeLevel + 1;
  const updatedPrestige: FortressPrestige = {
    ...fortressPrestige,
    [stat]: newPrestigeLevel,
  };

  // Reset stat level to 0
  powerData.fortressUpgrades.statUpgrades[stat] = 0;

  // Calculate new resource amounts
  const newGold = inventory.gold - goldCost;
  const newDust = inventory.dust - dustCost;

  // Persist changes
  await Promise.all([
    prisma.inventory.update({
      where: { userId },
      data: {
        gold: newGold,
        dust: newDust,
      },
    }),
    prisma.powerUpgrades.update({
      where: { userId },
      data: {
        fortressUpgrades: JSON.stringify(powerData.fortressUpgrades),
        fortressPrestige: updatedPrestige,
      },
    }),
  ]);

  return {
    success: true,
    newPrestigeLevel,
    goldSpent: goldCost,
    dustSpent: dustCost,
    newGold,
    newDust,
    statReset: true,
  };
}

// ============================================================================
// PRESTIGE TURRET STAT
// ============================================================================

/**
 * Prestige a turret stat
 * - Requires stat to be at max level (20)
 * - Costs gold + dust
 * - Resets stat level to 0
 * - Grants permanent +5% bonus to that stat for that turret type
 */
export async function prestigeTurretStat(
  userId: string,
  turretType: string,
  stat: PowerTurretUpgradableStat
): Promise<PrestigeUpgradeResponse> {
  // Get power upgrades and inventory
  const [{ powerData, turretPrestige }, inventory] = await Promise.all([
    getOrCreatePowerUpgrades(userId),
    prisma.inventory.findUnique({ where: { userId } }),
  ]);

  if (!inventory) {
    return {
      success: false,
      newPrestigeLevel: 0,
      goldSpent: 0,
      dustSpent: 0,
      newGold: 0,
      newDust: 0,
      statReset: false,
      error: 'Inventory not found',
    };
  }

  // Find turret upgrades
  const turretUpgrade = powerData.turretUpgrades.find((t: TurretUpgrades) => t.turretType === turretType);
  const currentStatLevel = turretUpgrade?.statUpgrades[stat] || 0;
  const maxLevel = 20;

  // Check if at max level
  if (currentStatLevel < maxLevel) {
    return {
      success: false,
      newPrestigeLevel: 0,
      goldSpent: 0,
      dustSpent: 0,
      newGold: inventory.gold,
      newDust: inventory.dust,
      statReset: false,
      error: `Stat must be at max level (${maxLevel}) to prestige`,
    };
  }

  // Find or get current prestige level
  let turretPrestigeData = turretPrestige.find(tp => tp.turretType === turretType);
  const currentPrestigeLevel = turretPrestigeData?.[stat] || 0;

  // Check max prestige
  if (currentPrestigeLevel >= MAX_PRESTIGE_LEVEL) {
    return {
      success: false,
      newPrestigeLevel: currentPrestigeLevel,
      goldSpent: 0,
      dustSpent: 0,
      newGold: inventory.gold,
      newDust: inventory.dust,
      statReset: false,
      error: `Max prestige level (${MAX_PRESTIGE_LEVEL}) reached`,
    };
  }

  // Calculate cost
  const { gold: goldCost, dust: dustCost } = calculatePrestigeCost(currentPrestigeLevel);

  // Check resources
  if (inventory.gold < goldCost) {
    return {
      success: false,
      newPrestigeLevel: currentPrestigeLevel,
      goldSpent: 0,
      dustSpent: 0,
      newGold: inventory.gold,
      newDust: inventory.dust,
      statReset: false,
      error: `Not enough gold (need ${goldCost})`,
    };
  }

  if (inventory.dust < dustCost) {
    return {
      success: false,
      newPrestigeLevel: currentPrestigeLevel,
      goldSpent: 0,
      dustSpent: 0,
      newGold: inventory.gold,
      newDust: inventory.dust,
      statReset: false,
      error: `Not enough dust (need ${dustCost})`,
    };
  }

  // Apply prestige
  const newPrestigeLevel = currentPrestigeLevel + 1;

  // Update turret prestige array
  const updatedTurretPrestige = [...turretPrestige];
  if (!turretPrestigeData) {
    turretPrestigeData = { turretType, damage: 0, attackSpeed: 0 };
    updatedTurretPrestige.push(turretPrestigeData);
  }
  const prestigeIndex = updatedTurretPrestige.findIndex(tp => tp.turretType === turretType);
  updatedTurretPrestige[prestigeIndex] = {
    ...updatedTurretPrestige[prestigeIndex],
    [stat]: newPrestigeLevel,
  };

  // Reset stat level to 0
  if (turretUpgrade) {
    turretUpgrade.statUpgrades[stat] = 0;
  }

  // Calculate new resource amounts
  const newGold = inventory.gold - goldCost;
  const newDust = inventory.dust - dustCost;

  // Persist changes
  await Promise.all([
    prisma.inventory.update({
      where: { userId },
      data: {
        gold: newGold,
        dust: newDust,
      },
    }),
    prisma.powerUpgrades.update({
      where: { userId },
      data: {
        turretUpgrades: JSON.stringify(powerData.turretUpgrades),
        turretPrestige: updatedTurretPrestige,
      },
    }),
  ]);

  return {
    success: true,
    newPrestigeLevel,
    goldSpent: goldCost,
    dustSpent: dustCost,
    newGold,
    newDust,
    statReset: true,
  };
}

// ============================================================================
// GET PRESTIGE STATUS
// ============================================================================

/**
 * Get user's prestige status for all stats
 */
export async function getPrestigeStatus(userId: string): Promise<{
  fortressPrestige: FortressPrestige;
  turretPrestige: TurretPrestige[];
}> {
  const { fortressPrestige, turretPrestige } = await getOrCreatePowerUpgrades(userId);
  return { fortressPrestige, turretPrestige };
}

// ============================================================================
// RECALCULATE CACHED POWER
// ============================================================================

/**
 * Recalculate and update the cached total power for a user
 * Use this to fix users with stale/incorrect cached power values
 */
export async function recalculateCachedPower(userId: string): Promise<number> {
  const [{ powerData }, commanderLevel] = await Promise.all([
    getOrCreatePowerUpgrades(userId),
    getCommanderLevel(userId),
  ]);

  const newTotalPower = calculateQuickTotalPower(powerData, commanderLevel);

  await prisma.powerUpgrades.update({
    where: { userId },
    data: { cachedTotalPower: newTotalPower },
  });

  return newTotalPower;
}

/**
 * Recalculate cached power for all users with cachedTotalPower = 0
 * Returns the number of users updated
 */
export async function recalculateAllZeroPower(): Promise<number> {
  const usersWithZeroPower = await prisma.powerUpgrades.findMany({
    where: { cachedTotalPower: 0 },
    select: { userId: true },
  });

  let updated = 0;
  for (const { userId } of usersWithZeroPower) {
    await recalculateCachedPower(userId);
    updated++;
  }

  return updated;
}
