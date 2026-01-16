/**
 * Guild Structures Service
 *
 * Handles the new structure-based guild progression system.
 * Four structures: Kwatera (Barracks), Skarbiec (Treasury), Akademia (Academy), Zbrojownia (Armory)
 */

import { prisma } from '../lib/prisma.js';
import {
  GUILD_CONSTANTS,
  GUILD_ERROR_CODES,
  type GuildStructureType,
  type GuildStructureLevels,
  type GuildStructureInfo,
  type UpgradeStructureResponse,
} from '@arcade/protocol';

// ============================================================================
// COST CALCULATIONS
// ============================================================================

/**
 * Calculate upgrade cost for a structure at given level
 * Cost formula: gold = 500 × (level + 1)², dust = 25 × (level + 1)
 */
export function getUpgradeCost(currentLevel: number): { gold: number; dust: number } | null {
  if (currentLevel >= GUILD_CONSTANTS.STRUCTURE_MAX_LEVEL) {
    return null; // Max level reached
  }

  const nextLevel = currentLevel + 1;
  return {
    gold: GUILD_CONSTANTS.STRUCTURE_UPGRADE_BASE_GOLD * nextLevel * nextLevel,
    dust: GUILD_CONSTANTS.STRUCTURE_UPGRADE_BASE_DUST * nextLevel,
  };
}

// ============================================================================
// BONUS CALCULATIONS
// ============================================================================

/**
 * Get member capacity based on Kwatera level
 * Base: 10, +1 per level, max 30 at level 20
 */
export function getMemberCapacity(kwateraLevel: number): number {
  return GUILD_CONSTANTS.MEMBER_BASE_CAPACITY + kwateraLevel;
}

/**
 * Get gold bonus based on Skarbiec level
 * +1% per level, max 20% at level 20
 */
export function getGoldBonus(skarbiecLevel: number): number {
  return skarbiecLevel * GUILD_CONSTANTS.STRUCTURE_BONUS_PER_LEVEL;
}

/**
 * Get XP bonus based on Akademia level
 * +1% per level, max 20% at level 20
 */
export function getXpBonus(akademiaLevel: number): number {
  return akademiaLevel * GUILD_CONSTANTS.STRUCTURE_BONUS_PER_LEVEL;
}

/**
 * Get stat bonus based on Zbrojownia level
 * +1% per level, max 20% at level 20
 */
export function getStatBonus(zbrojowniaLevel: number): number {
  return zbrojowniaLevel * GUILD_CONSTANTS.STRUCTURE_BONUS_PER_LEVEL;
}

/**
 * Get all bonuses for a guild based on structure levels
 */
export function getGuildBonusesFromStructures(structures: GuildStructureLevels): {
  goldBoost: number;
  statBoost: number;
  xpBoost: number;
} {
  return {
    goldBoost: getGoldBonus(structures.skarbiec),
    statBoost: getStatBonus(structures.zbrojownia),
    xpBoost: getXpBonus(structures.akademia),
  };
}

/**
 * Get bonus value for a specific structure at a given level
 */
function getBonusForStructure(type: GuildStructureType, level: number): number {
  switch (type) {
    case 'kwatera':
      return getMemberCapacity(level);
    case 'skarbiec':
      return getGoldBonus(level);
    case 'akademia':
      return getXpBonus(level);
    case 'zbrojownia':
      return getStatBonus(level);
  }
}

// ============================================================================
// STRUCTURE INFO
// ============================================================================

/**
 * Get structure info for all structures in a guild
 */
export async function getStructuresInfo(guildId: string): Promise<GuildStructureInfo[]> {
  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
    include: { treasury: true },
  });

  if (!guild) return [];

  const structures: GuildStructureType[] = ['kwatera', 'skarbiec', 'akademia', 'zbrojownia'];

  return structures.map((type) => {
    const level = getStructureLevel(guild, type);
    const cost = getUpgradeCost(level);
    const canAfford =
      cost && guild.treasury
        ? guild.treasury.gold >= cost.gold && guild.treasury.dust >= cost.dust
        : false;

    return {
      type,
      level,
      maxLevel: GUILD_CONSTANTS.STRUCTURE_MAX_LEVEL,
      currentBonus: getBonusForStructure(type, level),
      nextBonus: level < GUILD_CONSTANTS.STRUCTURE_MAX_LEVEL ? getBonusForStructure(type, level + 1) : null,
      upgradeCost: cost,
      canAfford,
    };
  });
}

/**
 * Get the level of a specific structure from guild data
 */
function getStructureLevel(
  guild: { structureKwatera: number; structureSkarbiec: number; structureAkademia: number; structureZbrojownia: number },
  type: GuildStructureType
): number {
  switch (type) {
    case 'kwatera':
      return guild.structureKwatera;
    case 'skarbiec':
      return guild.structureSkarbiec;
    case 'akademia':
      return guild.structureAkademia;
    case 'zbrojownia':
      return guild.structureZbrojownia;
  }
}

/**
 * Get the Prisma field name for a structure type
 */
function getStructureFieldName(type: GuildStructureType): string {
  switch (type) {
    case 'kwatera':
      return 'structureKwatera';
    case 'skarbiec':
      return 'structureSkarbiec';
    case 'akademia':
      return 'structureAkademia';
    case 'zbrojownia':
      return 'structureZbrojownia';
  }
}

// ============================================================================
// STRUCTURE UPGRADE
// ============================================================================

/**
 * Upgrade a structure (deducts from treasury)
 * Only guild leader can upgrade structures
 */
export async function upgradeStructure(
  guildId: string,
  userId: string,
  structure: GuildStructureType
): Promise<{ success: boolean; error?: string; result?: UpgradeStructureResponse }> {
  return prisma.$transaction(async (tx) => {
    // Get guild with treasury
    const guild = await tx.guild.findUnique({
      where: { id: guildId },
      include: { treasury: true },
    });

    if (!guild || guild.disbanded) {
      return { success: false, error: GUILD_ERROR_CODES.GUILD_NOT_FOUND };
    }

    // Check permission (only leader can upgrade)
    const membership = await tx.guildMember.findUnique({
      where: { userId },
    });

    if (!membership || membership.guildId !== guildId || membership.role !== 'LEADER') {
      return { success: false, error: GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS };
    }

    // Get current level for this structure
    const currentLevel = getStructureLevel(guild, structure);

    // Calculate cost
    const cost = getUpgradeCost(currentLevel);
    if (!cost) {
      return { success: false, error: GUILD_ERROR_CODES.STRUCTURE_MAX_LEVEL };
    }

    // Check treasury balance
    if (!guild.treasury || guild.treasury.gold < cost.gold || guild.treasury.dust < cost.dust) {
      return { success: false, error: GUILD_ERROR_CODES.TREASURY_INSUFFICIENT };
    }

    // Deduct from treasury
    await tx.guildTreasury.update({
      where: { guildId },
      data: {
        gold: { decrement: cost.gold },
        dust: { decrement: cost.dust },
      },
    });

    // Log transaction
    await tx.guildTreasuryLog.create({
      data: {
        guildId,
        userId,
        transactionType: 'STRUCTURE_UPGRADE',
        goldAmount: -cost.gold,
        dustAmount: -cost.dust,
        description: `Upgrade ${structure} to level ${currentLevel + 1}`,
        balanceAfterGold: guild.treasury.gold - cost.gold,
        balanceAfterDust: guild.treasury.dust - cost.dust,
      },
    });

    // Increment structure level
    const fieldName = getStructureFieldName(structure);
    await tx.guild.update({
      where: { id: guildId },
      data: {
        [fieldName]: currentLevel + 1,
      },
    });

    return {
      success: true,
      result: {
        success: true,
        newLevel: currentLevel + 1,
        goldSpent: cost.gold,
        dustSpent: cost.dust,
        treasuryBalance: {
          gold: guild.treasury.gold - cost.gold,
          dust: guild.treasury.dust - cost.dust,
        },
      },
    };
  });
}
