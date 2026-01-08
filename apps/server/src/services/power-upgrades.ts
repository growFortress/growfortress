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
import type {
  PowerUpgradeResponse,
  PowerSummaryResponse,
  FortressUpgradableStat,
  PowerHeroUpgradableStat,
  PowerTurretUpgradableStat,
} from '@arcade/protocol';
import {
  type PlayerPowerData,
  type HeroUpgrades,
  type TurretUpgrades,
  type ItemTierUpgrade,
  type StatUpgradeConfig,
  createDefaultPlayerPowerData,
  createDefaultStatUpgrades,
  getNextItemTier,
  isMaxItemTier,
  FORTRESS_STAT_UPGRADES,
  HERO_STAT_UPGRADES,
  TURRET_STAT_UPGRADES,
  ITEM_TIER_CONFIG,
  getUpgradeCost,
  calculateTotalPower,
  calculateQuickTotalPower,
  type TierMaps,
} from '@arcade/sim-core';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get or create power upgrades for user
 */
async function getOrCreatePowerUpgrades(userId: string): Promise<{
  id: string;
  powerData: PlayerPowerData;
  cachedTotalPower: number;
}> {
  let powerUpgrades = await prisma.powerUpgrades.findUnique({
    where: { userId },
  });

  if (!powerUpgrades) {
    const defaultData = createDefaultPlayerPowerData();
    powerUpgrades = await prisma.powerUpgrades.create({
      data: {
        userId,
        fortressUpgrades: JSON.stringify(defaultData.fortressUpgrades),
        heroUpgrades: JSON.stringify(defaultData.heroUpgrades),
        turretUpgrades: JSON.stringify(defaultData.turretUpgrades),
        itemTiers: JSON.stringify(defaultData.itemTiers),
        cachedTotalPower: 0,
      },
    });
  }

  return {
    id: powerUpgrades.id,
    powerData: {
      fortressUpgrades: JSON.parse(powerUpgrades.fortressUpgrades as string),
      heroUpgrades: JSON.parse(powerUpgrades.heroUpgrades as string),
      turretUpgrades: JSON.parse(powerUpgrades.turretUpgrades as string),
      itemTiers: JSON.parse(powerUpgrades.itemTiers as string),
    },
    cachedTotalPower: powerUpgrades.cachedTotalPower,
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
// HERO STAT UPGRADE
// ============================================================================

export async function upgradeHeroStat(
  userId: string,
  heroId: string,
  stat: PowerHeroUpgradableStat
): Promise<PowerUpgradeResponse> {
  // Find stat config
  const config = findStatConfig(HERO_STAT_UPGRADES, stat);
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
