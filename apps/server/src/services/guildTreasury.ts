import { prisma } from '../lib/prisma.js';
import {
  GUILD_CONSTANTS,
  GUILD_ERROR_CODES,
  type GuildRole,
} from '@arcade/protocol';
import { hasPermission } from './guild.js';
import type { GuildTreasury, GuildTreasuryLog, TreasuryTransactionType as PrismaTxType } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

export interface TreasuryAmounts {
  gold?: number;
  dust?: number;
}

export interface TreasuryLogWithUser extends GuildTreasuryLog {
  user: {
    displayName: string;
  };
}

export interface WithdrawStatus {
  allowed: boolean;
  reason?: string;
  nextAllowedAt?: Date;
}

// ============================================================================
// TREASURY OPERATIONS
// ============================================================================

/**
 * Get guild treasury
 */
export async function getTreasury(guildId: string): Promise<GuildTreasury | null> {
  return prisma.guildTreasury.findUnique({
    where: { guildId },
  });
}

/**
 * Check if user can withdraw from treasury
 */
export async function canWithdraw(
  guildId: string,
  userId: string
): Promise<WithdrawStatus> {
  // Check membership and role
  const membership = await prisma.guildMember.findUnique({
    where: { userId },
  });

  if (!membership || membership.guildId !== guildId) {
    return { allowed: false, reason: GUILD_ERROR_CODES.NOT_IN_GUILD };
  }

  if (!hasPermission(membership.role as GuildRole, 'withdraw')) {
    return { allowed: false, reason: GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS };
  }

  // Check cooldown - find last withdrawal
  const lastWithdrawal = await prisma.guildTreasuryLog.findFirst({
    where: {
      guildId,
      userId,
      transactionType: { in: ['WITHDRAW_GOLD', 'WITHDRAW_DUST'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (lastWithdrawal) {
    const cooldownEnd = new Date(lastWithdrawal.createdAt);
    cooldownEnd.setHours(cooldownEnd.getHours() + GUILD_CONSTANTS.WITHDRAWAL_COOLDOWN_HOURS);

    if (cooldownEnd > new Date()) {
      return {
        allowed: false,
        reason: GUILD_ERROR_CODES.WITHDRAWAL_COOLDOWN,
        nextAllowedAt: cooldownEnd,
      };
    }
  }

  return { allowed: true };
}

/**
 * Deposit resources to treasury
 */
export async function deposit(
  guildId: string,
  userId: string,
  amounts: TreasuryAmounts
): Promise<GuildTreasury> {
  // Validate amounts
  const goldAmount = amounts.gold || 0;
  const dustAmount = amounts.dust || 0;

  if (goldAmount <= 0 && dustAmount <= 0) {
    throw new Error(GUILD_ERROR_CODES.INVALID_AMOUNT);
  }

  // Check membership
  const membership = await prisma.guildMember.findUnique({
    where: { userId },
  });

  if (!membership || membership.guildId !== guildId) {
    throw new Error(GUILD_ERROR_CODES.NOT_IN_GUILD);
  }

  // Check user has enough resources
  const userInventory = await prisma.inventory.findUnique({
    where: { userId },
  });

  if (!userInventory) {
    throw new Error(GUILD_ERROR_CODES.INSUFFICIENT_PERSONAL_FUNDS);
  }

  if (goldAmount > userInventory.gold) {
    throw new Error(GUILD_ERROR_CODES.INSUFFICIENT_PERSONAL_FUNDS);
  }
  if (dustAmount > userInventory.dust) {
    throw new Error(GUILD_ERROR_CODES.INSUFFICIENT_PERSONAL_FUNDS);
  }

  // Perform deposit in transaction
  return prisma.$transaction(async (tx) => {
    // Deduct from user inventory
    await tx.inventory.update({
      where: { userId },
      data: {
        gold: { decrement: goldAmount },
        dust: { decrement: dustAmount },
      },
    });

    // Add to treasury
    const treasury = await tx.guildTreasury.update({
      where: { guildId },
      data: {
        gold: { increment: goldAmount },
        dust: { increment: dustAmount },
        totalGoldDeposited: { increment: goldAmount },
        totalDustDeposited: { increment: dustAmount },
        version: { increment: 1 },
      },
    });

    // Update member donation tracking
    await tx.guildMember.update({
      where: { userId },
      data: {
        totalGoldDonated: { increment: goldAmount },
        totalDustDonated: { increment: dustAmount },
      },
    });

    // Create audit logs
    const logs: { type: PrismaTxType; amount: number }[] = [];
    if (goldAmount > 0) logs.push({ type: 'DEPOSIT_GOLD', amount: goldAmount });
    if (dustAmount > 0) logs.push({ type: 'DEPOSIT_DUST', amount: dustAmount });

    for (const log of logs) {
      await tx.guildTreasuryLog.create({
        data: {
          guildId,
          userId,
          transactionType: log.type,
          goldAmount: log.type === 'DEPOSIT_GOLD' ? log.amount : 0,
          dustAmount: log.type === 'DEPOSIT_DUST' ? log.amount : 0,
          description: `Donation from member`,
          balanceAfterGold: treasury.gold,
          balanceAfterDust: treasury.dust,
        },
      });
    }

    return treasury;
  });
}

/**
 * Withdraw resources from treasury (leader only)
 */
export async function withdraw(
  guildId: string,
  userId: string,
  amounts: TreasuryAmounts,
  reason: string
): Promise<GuildTreasury> {
  // Validate amounts
  const goldAmount = amounts.gold || 0;
  const dustAmount = amounts.dust || 0;

  if (goldAmount <= 0 && dustAmount <= 0) {
    throw new Error(GUILD_ERROR_CODES.INVALID_AMOUNT);
  }

  // Check can withdraw
  const withdrawStatus = await canWithdraw(guildId, userId);
  if (!withdrawStatus.allowed) {
    throw new Error(withdrawStatus.reason || GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

  // Get treasury
  const treasury = await prisma.guildTreasury.findUnique({
    where: { guildId },
  });

  if (!treasury) {
    throw new Error(GUILD_ERROR_CODES.GUILD_NOT_FOUND);
  }

  // Check amounts don't exceed balance
  if (goldAmount > treasury.gold) {
    throw new Error(GUILD_ERROR_CODES.TREASURY_INSUFFICIENT);
  }
  if (dustAmount > treasury.dust) {
    throw new Error(GUILD_ERROR_CODES.TREASURY_INSUFFICIENT);
  }

  // Check withdrawal limit (max 20% of each resource)
  const maxGold = Math.floor(treasury.gold * GUILD_CONSTANTS.MAX_WITHDRAWAL_PERCENT);
  const maxDust = Math.floor(treasury.dust * GUILD_CONSTANTS.MAX_WITHDRAWAL_PERCENT);

  if (goldAmount > maxGold || dustAmount > maxDust) {
    throw new Error(GUILD_ERROR_CODES.WITHDRAWAL_LIMIT_EXCEEDED);
  }

  // Perform withdrawal in transaction
  return prisma.$transaction(async (tx) => {
    // Deduct from treasury
    const updatedTreasury = await tx.guildTreasury.update({
      where: { guildId },
      data: {
        gold: { decrement: goldAmount },
        dust: { decrement: dustAmount },
        version: { increment: 1 },
      },
    });

    // Add to user inventory
    await tx.inventory.update({
      where: { userId },
      data: {
        gold: { increment: goldAmount },
        dust: { increment: dustAmount },
      },
    });

    // Create audit logs
    const logs: { type: PrismaTxType; amount: number }[] = [];
    if (goldAmount > 0) logs.push({ type: 'WITHDRAW_GOLD', amount: -goldAmount });
    if (dustAmount > 0) logs.push({ type: 'WITHDRAW_DUST', amount: -dustAmount });

    for (const log of logs) {
      await tx.guildTreasuryLog.create({
        data: {
          guildId,
          userId,
          transactionType: log.type,
          goldAmount: log.type === 'WITHDRAW_GOLD' ? log.amount : 0,
          dustAmount: log.type === 'WITHDRAW_DUST' ? log.amount : 0,
          description: reason,
          balanceAfterGold: updatedTreasury.gold,
          balanceAfterDust: updatedTreasury.dust,
        },
      });
    }

    return updatedTreasury;
  });
}

/**
 * Pay battle cost from treasury
 */
export async function payBattleCost(
  guildId: string,
  userId: string,
  amount: number,
  battleId: string
): Promise<void> {
  const treasury = await prisma.guildTreasury.findUnique({
    where: { guildId },
  });

  if (!treasury || treasury.gold < amount) {
    throw new Error(GUILD_ERROR_CODES.TREASURY_INSUFFICIENT);
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.guildTreasury.update({
      where: { guildId },
      data: {
        gold: { decrement: amount },
        version: { increment: 1 },
      },
    });

    await tx.guildTreasuryLog.create({
      data: {
        guildId,
        userId,
        transactionType: 'BATTLE_COST',
        goldAmount: -amount,
        dustAmount: 0,
        description: 'Guild battle initiation cost',
        referenceId: battleId,
        balanceAfterGold: updated.gold,
        balanceAfterDust: updated.dust,
      },
    });
  });
}

/**
 * Distribute rewards to treasury
 */
export async function distributeRewards(
  guildId: string,
  amounts: TreasuryAmounts,
  description: string
): Promise<void> {
  const goldAmount = amounts.gold || 0;
  const dustAmount = amounts.dust || 0;

  await prisma.$transaction(async (tx) => {
    const treasury = await tx.guildTreasury.update({
      where: { guildId },
      data: {
        gold: { increment: goldAmount },
        dust: { increment: dustAmount },
        version: { increment: 1 },
      },
    });

    // Get guild leader for audit log
    const leader = await tx.guildMember.findFirst({
      where: { guildId, role: 'LEADER' },
    });

    if (leader) {
      await tx.guildTreasuryLog.create({
        data: {
          guildId,
          userId: leader.userId,
          transactionType: 'REWARD_DISTRIBUTION',
          goldAmount,
          dustAmount,
          description,
          balanceAfterGold: treasury.gold,
          balanceAfterDust: treasury.dust,
        },
      });
    }
  });
}

/**
 * Get treasury logs
 */
export async function getTreasuryLogs(
  guildId: string,
  limit = 50,
  offset = 0
): Promise<{ logs: TreasuryLogWithUser[]; total: number }> {
  const [logs, total] = await Promise.all([
    prisma.guildTreasuryLog.findMany({
      where: { guildId },
      include: {
        user: {
          select: { displayName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.guildTreasuryLog.count({ where: { guildId } }),
  ]);

  return { logs, total };
}
