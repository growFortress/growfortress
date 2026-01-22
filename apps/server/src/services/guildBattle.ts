/**
 * Guild Battle Service - Instant Attack System (Arena 5v5)
 *
 * Handles instant guild battles with Arena 5v5 format.
 * - No pending/accept system - attacks are resolved immediately
 * - Shield protection system
 * - Daily attack limits
 * - Cooldowns per target guild
 */

import { randomInt } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { GUILD_CONSTANTS, GUILD_ERROR_CODES, type BattleReward } from '@arcade/protocol';
import type { GuildBattle, GuildBattleResult, GuildShield } from '@prisma/client';
import { hasPermission } from './guild.js';
import {
  createBattleHeroSnapshots,
  getMembersWithBattleHeroes,
  type BattleHeroSnapshot,
} from './guildBattleHero.js';
import { payBattleCost } from './guildTreasury.js';
import { runGuildArena, type GuildBattleHero } from '@arcade/sim-core';
import { getCurrentWeekKey, getWeekKeyForDate } from '../lib/weekUtils.js';
import {
  checkAndAwardTrophies,
  updateBattleStreak,
  calculateBattleRewards,
  type BattleOutcome,
} from './guildBattleTrophies.js';

// ============================================================================
// TYPES
// ============================================================================

export interface GuildBattleWithDetails extends GuildBattle {
  attackerGuild: {
    name: string;
    tag: string;
  };
  defenderGuild: {
    name: string;
    tag: string;
  };
  result?: GuildBattleResult | null;
}

export interface HonorChange {
  winnerGain: number;
  loserLoss: number;
}

export interface InstantAttackResult {
  battle: GuildBattleWithDetails;
  attackerHonorChange: number;
  defenderHonorChange: number;
  attackerReward: BattleReward;
  defenderReward: BattleReward;
}

export interface ShieldStatus {
  isActive: boolean;
  shield: GuildShield | null;
  canActivate: boolean;
  activationCost: number;
  weeklyUsed: number;
  maxWeekly: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get start of today (UTC midnight)
 */
function getStartOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Calculate honor changes using ELO-like system
 */
export function calculateHonorChange(
  winnerHonor: number,
  loserHonor: number,
  winnerPower: number,
  loserPower: number
): HonorChange {
  const expectedWin = 1 / (1 + Math.pow(10, (loserHonor - winnerHonor) / 400));
  const powerRatio = winnerPower / Math.max(loserPower, 1);
  const underdogBonus = powerRatio < 1 ? 1.2 : 1; // Bonus for beating stronger guild

  const winnerGain = Math.round(GUILD_CONSTANTS.HONOR_K_FACTOR * (1 - expectedWin) * underdogBonus);
  const loserLoss = Math.min(
    Math.round(GUILD_CONSTANTS.HONOR_K_FACTOR * expectedWin),
    loserHonor - GUILD_CONSTANTS.MIN_HONOR // Don't go below minimum
  );

  return { winnerGain, loserLoss };
}

/**
 * Generate cryptographically secure seed for arena simulation
 */
function generateBattleSeed(): number {
  return randomInt(2147483647);
}

/**
 * Convert BattleHeroSnapshot to GuildBattleHero for arena simulation
 */
function snapshotToGuildHero(snapshot: BattleHeroSnapshot): GuildBattleHero {
  return {
    ownerId: snapshot.userId,
    ownerName: snapshot.displayName,
    heroId: snapshot.heroId,
    tier: snapshot.tier,
    power: snapshot.power,
  };
}

// ============================================================================
// SHIELD SYSTEM
// ============================================================================

/**
 * Get shield status for a guild
 */
export async function getShieldStatus(guildId: string): Promise<ShieldStatus> {
  const weekKey = getCurrentWeekKey();
  const now = new Date();

  // Get current shield (if any)
  const shield = await prisma.guildShield.findUnique({
    where: { guildId },
  });

  const isActive = shield !== null && shield.expiresAt > now;

  // Count shields used this week (use activation date when weekKey is unreliable)
  const activatedWeekKey = shield ? getWeekKeyForDate(shield.activatedAt) : null;
  const weeklyUsed =
    shield && (shield.weekKey === weekKey || activatedWeekKey === weekKey)
      ? shield.weeklyCount
      : 0;

  const canActivate = !isActive && weeklyUsed < GUILD_CONSTANTS.MAX_SHIELDS_PER_WEEK;

  return {
    isActive,
    shield: isActive ? shield : null,
    canActivate,
    activationCost: GUILD_CONSTANTS.SHIELD_GOLD_COST,
    weeklyUsed,
    maxWeekly: GUILD_CONSTANTS.MAX_SHIELDS_PER_WEEK,
  };
}

/**
 * Activate shield for a guild (24h protection)
 */
export async function activateShield(
  guildId: string,
  userId: string
): Promise<{ success: boolean; shield?: GuildShield; error?: string }> {
  // Check membership and permissions
  const membership = await prisma.guildMember.findUnique({
    where: { userId },
  });

  if (!membership || membership.guildId !== guildId) {
    return { success: false, error: GUILD_ERROR_CODES.NOT_IN_GUILD };
  }

  if (!hasPermission(membership.role as any, 'battle')) {
    return { success: false, error: GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS };
  }

  // Check current shield status
  const status = await getShieldStatus(guildId);

  if (status.isActive) {
    return { success: false, error: GUILD_ERROR_CODES.SHIELD_ALREADY_ACTIVE };
  }

  if (!status.canActivate) {
    return { success: false, error: GUILD_ERROR_CODES.SHIELD_WEEKLY_LIMIT };
  }

  // Pay the cost from treasury with correct transaction type
  try {
    await payBattleCost(guildId, userId, GUILD_CONSTANTS.SHIELD_GOLD_COST, 'shield', 'SHIELD_PURCHASE');
  } catch {
    return { success: false, error: GUILD_ERROR_CODES.TREASURY_INSUFFICIENT };
  }

  const weekKey = getCurrentWeekKey();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + GUILD_CONSTANTS.SHIELD_DURATION_HOURS * 60 * 60 * 1000);

  // Check existing shield to determine if we need to reset week counter
  const existingShield = await prisma.guildShield.findUnique({
    where: { guildId },
  });

  // Determine new weekly count - reset if week changed, otherwise increment
  const newWeeklyCount = existingShield && existingShield.weekKey === weekKey
    ? existingShield.weeklyCount + 1
    : 1;

  // Create or update shield with correct weekly count
  const shield = await prisma.guildShield.upsert({
    where: { guildId },
    create: {
      guildId,
      activatedAt: now,
      expiresAt,
      activatedBy: userId,
      weekKey,
      weeklyCount: 1,
      goldCost: GUILD_CONSTANTS.SHIELD_GOLD_COST,
    },
    update: {
      activatedAt: now,
      expiresAt,
      activatedBy: userId,
      weekKey,
      weeklyCount: newWeeklyCount,
      goldCost: GUILD_CONSTANTS.SHIELD_GOLD_COST,
    },
  });

  return { success: true, shield };
}

// ============================================================================
// ATTACK LIMITS
// ============================================================================

/**
 * Get number of attacks made by a guild today
 */
export async function getDailyAttackCount(guildId: string): Promise<number> {
  const startOfToday = getStartOfToday();

  return prisma.guildBattle.count({
    where: {
      attackerGuildId: guildId,
      createdAt: { gte: startOfToday },
    },
  });
}

/**
 * Get number of times a guild has been attacked today
 */
export async function getDailyDefenseCount(guildId: string): Promise<number> {
  const startOfToday = getStartOfToday();

  return prisma.guildBattle.count({
    where: {
      defenderGuildId: guildId,
      createdAt: { gte: startOfToday },
    },
  });
}

/**
 * Check if guild can attack a specific target (cooldown check)
 */
export async function canAttackGuild(
  attackerGuildId: string,
  defenderGuildId: string
): Promise<{ canAttack: boolean; cooldownEndsAt?: Date }> {
  if (attackerGuildId === defenderGuildId) {
    return { canAttack: false };
  }

  const cooldownHours = GUILD_CONSTANTS.ATTACK_COOLDOWN_SAME_GUILD_HOURS;
  const cooldownStart = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);

  const recentBattle = await prisma.guildBattle.findFirst({
    where: {
      attackerGuildId,
      defenderGuildId,
      createdAt: { gte: cooldownStart },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (recentBattle) {
    const cooldownEndsAt = new Date(
      recentBattle.createdAt.getTime() + cooldownHours * 60 * 60 * 1000
    );
    return { canAttack: false, cooldownEndsAt };
  }

  return { canAttack: true };
}

// ============================================================================
// INSTANT ATTACK
// ============================================================================

/**
 * Execute an instant attack (Arena 5v5)
 */
export async function instantAttack(
  attackerGuildId: string,
  defenderGuildId: string,
  attackerUserId: string,
  selectedMemberIds: string[]
): Promise<{ success: boolean; result?: InstantAttackResult; error?: string }> {
  if (attackerGuildId === defenderGuildId) {
    return { success: false, error: GUILD_ERROR_CODES.CANNOT_ATTACK_SELF };
  }

  // Validate 5 members selected
  if (selectedMemberIds.length !== GUILD_CONSTANTS.ARENA_PARTICIPANTS) {
    return { success: false, error: GUILD_ERROR_CODES.INVALID_MEMBER_SELECTION };
  }

  // Check attacker membership and permissions
  const attackerMembership = await prisma.guildMember.findUnique({
    where: { userId: attackerUserId },
  });

  if (!attackerMembership || attackerMembership.guildId !== attackerGuildId) {
    return { success: false, error: GUILD_ERROR_CODES.NOT_IN_GUILD };
  }

  if (!hasPermission(attackerMembership.role as any, 'battle')) {
    return { success: false, error: GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS };
  }

  // Check attacker shield (can't attack while shielded)
  const attackerShieldStatus = await getShieldStatus(attackerGuildId);
  if (attackerShieldStatus.isActive) {
    return { success: false, error: GUILD_ERROR_CODES.ATTACKER_SHIELD_ACTIVE };
  }

  // Check defender shield
  const defenderShieldStatus = await getShieldStatus(defenderGuildId);
  if (defenderShieldStatus.isActive) {
    return { success: false, error: GUILD_ERROR_CODES.DEFENDER_SHIELD_ACTIVE };
  }

  // Check daily attack limit
  const dailyAttacks = await getDailyAttackCount(attackerGuildId);
  if (dailyAttacks >= GUILD_CONSTANTS.MAX_DAILY_ATTACKS) {
    return { success: false, error: GUILD_ERROR_CODES.DAILY_ATTACK_LIMIT };
  }

  // Check defender daily defense limit
  const defenderDailyDefenses = await getDailyDefenseCount(defenderGuildId);
  if (defenderDailyDefenses >= GUILD_CONSTANTS.MAX_ATTACKS_RECEIVED_PER_DAY) {
    return { success: false, error: GUILD_ERROR_CODES.DEFENDER_MAX_ATTACKS_RECEIVED };
  }

  // Check cooldown on this specific guild
  const cooldownCheck = await canAttackGuild(attackerGuildId, defenderGuildId);
  if (!cooldownCheck.canAttack) {
    return { success: false, error: GUILD_ERROR_CODES.BATTLE_COOLDOWN };
  }

  // Validate selected members belong to attacker guild and have Battle Heroes
  // Use efficient count query instead of loading all members (N+1 optimization)
  const validMemberCount = await prisma.guildMember.count({
    where: {
      guildId: attackerGuildId,
      userId: { in: selectedMemberIds },
      battleHeroId: { not: null },
    },
  });

  if (validMemberCount !== selectedMemberIds.length) {
    return { success: false, error: GUILD_ERROR_CODES.INVALID_MEMBER_SELECTION };
  }

  // Get defender members with Battle Heroes
  const defenderMembers = await getMembersWithBattleHeroes(defenderGuildId);

  if (defenderMembers.length < GUILD_CONSTANTS.ARENA_PARTICIPANTS) {
    return { success: false, error: GUILD_ERROR_CODES.NOT_ENOUGH_BATTLE_HEROES };
  }

  // Select top 5 defenders by battle hero power
  const selectedDefenderIds = defenderMembers
    .slice(0, GUILD_CONSTANTS.ARENA_PARTICIPANTS)
    .map(m => m.userId);

  // Create battle hero snapshots
  const [attackerSnapshots, defenderSnapshots] = await Promise.all([
    createBattleHeroSnapshots(selectedMemberIds),
    createBattleHeroSnapshots(selectedDefenderIds),
  ]);

  // Get guild data
  const [attackerGuild, defenderGuild] = await Promise.all([
    prisma.guild.findUnique({ where: { id: attackerGuildId } }),
    prisma.guild.findUnique({ where: { id: defenderGuildId } }),
  ]);

  if (!attackerGuild || !defenderGuild) {
    return { success: false, error: GUILD_ERROR_CODES.GUILD_NOT_FOUND };
  }

  // Calculate total power for each side
  const attackerTotalPower = attackerSnapshots.reduce((sum, s) => sum + s.power, 0);
  const defenderTotalPower = defenderSnapshots.reduce((sum, s) => sum + s.power, 0);

  // Generate seed for deterministic simulation
  const seed = generateBattleSeed();

  // Run actual Arena 5v5 simulation
  const attackerGuildHeroes = attackerSnapshots.map(snapshotToGuildHero);
  const defenderGuildHeroes = defenderSnapshots.map(snapshotToGuildHero);
  const arenaResult = runGuildArena(attackerGuildHeroes, defenderGuildHeroes, seed);

  // Determine winner
  const winnerGuildId = arenaResult.winnerSide === 'attacker'
    ? attackerGuildId
    : arenaResult.winnerSide === 'defender'
      ? defenderGuildId
      : null;

  // Calculate honor changes
  let attackerHonorChange = 0;
  let defenderHonorChange = 0;

  if (winnerGuildId === attackerGuildId) {
    const change = calculateHonorChange(
      attackerGuild.honor,
      defenderGuild.honor,
      attackerTotalPower,
      defenderTotalPower
    );
    attackerHonorChange = change.winnerGain;
    defenderHonorChange = -change.loserLoss;
  } else if (winnerGuildId === defenderGuildId) {
    const change = calculateHonorChange(
      defenderGuild.honor,
      attackerGuild.honor,
      defenderTotalPower,
      attackerTotalPower
    );
    attackerHonorChange = -change.loserLoss;
    defenderHonorChange = change.winnerGain;
  }
  // For draw, honor changes stay at 0

  // Execute battle in transaction with atomic checks
  const now = new Date();
  const cooldownHours = GUILD_CONSTANTS.ATTACK_COOLDOWN_SAME_GUILD_HOURS;
  const cooldownStart = new Date(now.getTime() - cooldownHours * 60 * 60 * 1000);
  const startOfToday = getStartOfToday();

  try {
  const battle = await prisma.$transaction(async (tx) => {
    // Re-check cooldown atomically within transaction to prevent race conditions
    const recentBattle = await tx.guildBattle.findFirst({
      where: {
        attackerGuildId,
        defenderGuildId,
        createdAt: { gte: cooldownStart },
      },
    });

    if (recentBattle) {
      throw new Error(GUILD_ERROR_CODES.BATTLE_COOLDOWN);
    }

    // Re-check daily attack limit atomically
    const dailyAttackCount = await tx.guildBattle.count({
      where: {
        attackerGuildId,
        createdAt: { gte: startOfToday },
      },
    });

    if (dailyAttackCount >= GUILD_CONSTANTS.MAX_DAILY_ATTACKS) {
      throw new Error(GUILD_ERROR_CODES.DAILY_ATTACK_LIMIT);
    }

    // Update guild honors
    if (attackerHonorChange !== 0) {
      await tx.guild.update({
        where: { id: attackerGuildId },
        data: { honor: { increment: attackerHonorChange } },
      });
    }

    if (defenderHonorChange !== 0) {
      await tx.guild.update({
        where: { id: defenderGuildId },
        data: { honor: { increment: defenderHonorChange } },
      });
    }

    // Create battle record
    const battleRecord = await tx.guildBattle.create({
      data: {
        attackerGuildId,
        defenderGuildId,
        attackerUserId,
        attackerMemberIds: selectedMemberIds,
        defenderMemberIds: selectedDefenderIds,
        attackerHeroes: JSON.stringify(attackerSnapshots),
        defenderHeroes: JSON.stringify(defenderSnapshots),
        seed,
        status: 'RESOLVED',
        createdAt: now,
        resolvedAt: now,
        winnerGuildId,
        isRevenge: false,
      },
      include: {
        attackerGuild: { select: { name: true, tag: true } },
        defenderGuild: { select: { name: true, tag: true } },
      },
    });

    // Create battle result
    const result = await tx.guildBattleResult.create({
      data: {
        battleId: battleRecord.id,
        winnerGuildId,
        winnerSide: arenaResult.winnerSide,
        winReason: arenaResult.winReason,
        attackerHonorChange,
        defenderHonorChange,
        attackerSurvivors: arenaResult.attackerSurvivors,
        defenderSurvivors: arenaResult.defenderSurvivors,
        attackerTotalDamage: BigInt(arenaResult.attackerTotalDamage),
        defenderTotalDamage: BigInt(arenaResult.defenderTotalDamage),
        mvpUserId: arenaResult.mvp?.ownerId ?? null,
        mvpHeroId: arenaResult.mvp?.heroId ?? null,
        mvpDamage: BigInt(arenaResult.mvp?.damage ?? 0),
        mvpKills: arenaResult.mvp?.kills ?? 0,
        keyMoments: JSON.stringify(arenaResult.keyMoments),
        killLog: JSON.stringify(arenaResult.killLog),
        duration: arenaResult.duration,
        resolvedAt: now,
      },
    });

    // Update member battle stats
    const allMemberIds = [...selectedMemberIds, ...selectedDefenderIds];

    for (const memberId of allMemberIds) {
      const isAttacker = selectedMemberIds.includes(memberId);
      const won = (isAttacker && winnerGuildId === attackerGuildId) ||
                  (!isAttacker && winnerGuildId === defenderGuildId);

      await tx.guildMember.updateMany({
        where: { userId: memberId },
        data: {
          battlesParticipated: { increment: 1 },
          battlesWon: { increment: won ? 1 : 0 },
        },
      });
    }

    return { ...battleRecord, result };
  });

  // Process trophies and rewards after successful battle transaction
  const attackerWon = winnerGuildId === attackerGuildId;
  const defenderWon = winnerGuildId === defenderGuildId;

  // Calculate heroes lost during battle
  const attackerHeroesLost = GUILD_CONSTANTS.ARENA_PARTICIPANTS - arenaResult.attackerSurvivors;
  const defenderHeroesLost = GUILD_CONSTANTS.ARENA_PARTICIPANTS - arenaResult.defenderSurvivors;

  // Prepare outcomes for both guilds
  const attackerOutcome: BattleOutcome = {
    guildId: attackerGuildId,
    opponentGuildId: defenderGuildId,
    opponentHonor: defenderGuild.honor,
    guildHonor: attackerGuild.honor,
    won: attackerWon,
    survivors: arenaResult.attackerSurvivors,
    totalHeroes: GUILD_CONSTANTS.ARENA_PARTICIPANTS,
    heroesLost: attackerHeroesLost,
  };

  const defenderOutcome: BattleOutcome = {
    guildId: defenderGuildId,
    opponentGuildId: attackerGuildId,
    opponentHonor: attackerGuild.honor,
    guildHonor: defenderGuild.honor,
    won: defenderWon,
    survivors: arenaResult.defenderSurvivors,
    totalHeroes: GUILD_CONSTANTS.ARENA_PARTICIPANTS,
    heroesLost: defenderHeroesLost,
  };

  // Process trophies and streaks for both guilds (in parallel)
  const [attackerNewTrophies, defenderNewTrophies] = await Promise.all([
    checkAndAwardTrophies(attackerOutcome),
    checkAndAwardTrophies(defenderOutcome),
  ]);

  // Update streaks for both guilds
  await Promise.all([
    updateBattleStreak(attackerGuildId, defenderGuildId, attackerWon),
    updateBattleStreak(defenderGuildId, attackerGuildId, defenderWon),
  ]);

  // Calculate rewards for both guilds
  const [attackerReward, defenderReward] = await Promise.all([
    calculateBattleRewards(
      attackerGuildId,
      attackerWon,
      arenaResult.attackerSurvivors,
      attackerNewTrophies
    ),
    calculateBattleRewards(
      defenderGuildId,
      defenderWon,
      arenaResult.defenderSurvivors,
      defenderNewTrophies
    ),
  ]);

  // Award Guild Coins to treasuries
  await Promise.all([
    prisma.$transaction(async (tx) => {
      const treasury = await tx.guildTreasury.update({
        where: { guildId: attackerGuildId },
        data: { guildCoins: { increment: attackerReward.totalCoins } },
      });
      await tx.guildTreasuryLog.create({
        data: {
          guildId: attackerGuildId,
          userId: attackerUserId,
          transactionType: 'BATTLE_REWARD',
          guildCoinsAmount: attackerReward.totalCoins,
          description: `Arena 5v5 ${attackerWon ? 'victory' : 'participation'} vs ${defenderGuild.name}`,
          referenceId: battle.id,
          balanceAfterGold: treasury.gold,
          balanceAfterDust: treasury.dust,
          balanceAfterGuildCoins: treasury.guildCoins,
        },
      });
    }),
    prisma.$transaction(async (tx) => {
      const treasury = await tx.guildTreasury.update({
        where: { guildId: defenderGuildId },
        data: { guildCoins: { increment: defenderReward.totalCoins } },
      });
      // For defender, use a system user or the defender guild leader
      // For simplicity, we'll use the attacker's userId as the log entry initiator
      await tx.guildTreasuryLog.create({
        data: {
          guildId: defenderGuildId,
          userId: attackerUserId, // Battle initiated by attacker
          transactionType: 'BATTLE_REWARD',
          guildCoinsAmount: defenderReward.totalCoins,
          description: `Arena 5v5 ${defenderWon ? 'victory' : 'defense'} vs ${attackerGuild.name}`,
          referenceId: battle.id,
          balanceAfterGold: treasury.gold,
          balanceAfterDust: treasury.dust,
          balanceAfterGuildCoins: treasury.guildCoins,
        },
      });
    }),
  ]);

  return {
    success: true,
    result: {
      battle: battle as GuildBattleWithDetails,
      attackerHonorChange,
      defenderHonorChange,
      attackerReward,
      defenderReward,
    },
  };
  } catch (error) {
    // Handle race condition errors from atomic checks
    if (error instanceof Error) {
      if (error.message === GUILD_ERROR_CODES.BATTLE_COOLDOWN) {
        return { success: false, error: GUILD_ERROR_CODES.BATTLE_COOLDOWN };
      }
      if (error.message === GUILD_ERROR_CODES.DAILY_ATTACK_LIMIT) {
        return { success: false, error: GUILD_ERROR_CODES.DAILY_ATTACK_LIMIT };
      }
    }
    throw error; // Re-throw unexpected errors
  }
}

// ============================================================================
// BATTLE QUERIES (READ-ONLY)
// ============================================================================

/**
 * Get guild battles (history of resolved battles)
 */
export async function getGuildBattles(
  guildId: string,
  type: 'sent' | 'received' | 'all' = 'all',
  limit = 20,
  offset = 0
): Promise<{ battles: GuildBattleWithDetails[]; total: number }> {
  const whereConditions: any[] = [];

  if (type === 'sent' || type === 'all') {
    whereConditions.push({ attackerGuildId: guildId });
  }
  if (type === 'received' || type === 'all') {
    whereConditions.push({ defenderGuildId: guildId });
  }

  const where: any = {
    OR: whereConditions,
  };

  const [battles, total] = await Promise.all([
    prisma.guildBattle.findMany({
      where,
      include: {
        attackerGuild: {
          select: { name: true, tag: true },
        },
        defenderGuild: {
          select: { name: true, tag: true },
        },
        result: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.guildBattle.count({ where }),
  ]);

  return { battles, total };
}

/**
 * Get battle by ID
 */
export async function getBattle(battleId: string): Promise<GuildBattleWithDetails | null> {
  return prisma.guildBattle.findUnique({
    where: { id: battleId },
    include: {
      attackerGuild: {
        select: { name: true, tag: true },
      },
      defenderGuild: {
        select: { name: true, tag: true },
      },
      result: true,
    },
  });
}

/**
 * Get attack status for a guild
 */
export async function getAttackStatus(guildId: string): Promise<{
  dailyAttacks: number;
  maxDailyAttacks: number;
  canAttack: boolean;
  nextResetAt: Date;
}> {
  const dailyAttacks = await getDailyAttackCount(guildId);
  const shieldStatus = await getShieldStatus(guildId);

  // Calculate next reset (next UTC midnight)
  const now = new Date();
  const nextReset = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1
  ));

  return {
    dailyAttacks,
    maxDailyAttacks: GUILD_CONSTANTS.MAX_DAILY_ATTACKS,
    canAttack: dailyAttacks < GUILD_CONSTANTS.MAX_DAILY_ATTACKS && !shieldStatus.isActive,
    nextResetAt: nextReset,
  };
}
