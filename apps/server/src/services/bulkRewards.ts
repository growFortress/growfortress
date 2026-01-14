import { prisma } from '../lib/prisma.js';

/**
 * Safely parse an integer from a string, returning the default value on failure
 */
function safeParseInt(value: string | undefined, defaultValue: number = 0): number {
  if (value === undefined || value === '') return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || !isFinite(parsed)) return defaultValue;
  return parsed;
}

export async function createBulkReward(data: {
  title: string;
  description: string;
  type: string;
  value: string;
  expiresAt?: Date;
  targetType?: string;
}) {
  return prisma.bulkReward.create({
    data: {
      ...data,
      targetType: data.targetType || 'ALL',
    },
  });
}

export async function listAvailableRewards(userId: string) {
  const now = new Date();
  
  // Get all rewards that are either not expired or have no expiration
  const rewards = await prisma.bulkReward.findMany({
    where: {
      OR: [
        { expiresAt: null },
        { expiresAt: { gte: now } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  // Get rewards already claimed by this user
  const claimedIds = await prisma.playerRewardClaim.findMany({
    where: { userId },
    select: { rewardId: true },
  });
  const claimedSet = new Set(claimedIds.map(c => c.rewardId));

  // Return rewards the user hasn't claimed yet
  return rewards.filter(r => !claimedSet.has(r.id));
}

export async function claimReward(userId: string, rewardId: string) {
  const now = new Date();
  
  // Find reward
  const reward = await prisma.bulkReward.findUnique({
    where: { id: rewardId },
  });

  if (!reward) throw new Error('Reward not found');

  // Check expiration
  if (reward.expiresAt && reward.expiresAt < now) {
    throw new Error('Reward has expired');
  }

  // Check if already claimed
  const existingClaim = await prisma.playerRewardClaim.findUnique({
    where: { userId_rewardId: { userId, rewardId } },
  });

  if (existingClaim) {
    throw new Error('Reward already claimed');
  }

  // Apply reward in a transaction if possible, or sequential
  // Since some services like addArtifact use their own transactions, 
  // we'll use a local transaction for the claim record and inventory updates for currencies.
  
  await prisma.$transaction(async (tx) => {
    // 1. Create claim record
    await tx.playerRewardClaim.create({
      data: { userId, rewardId },
    });

    // 2. Grant reward based on type
    const val = reward.value;
    
    switch (reward.type) {
      case 'GOLD': {
        const goldAmount = safeParseInt(val, 0);
        if (goldAmount > 0) {
          await tx.inventory.update({
            where: { userId },
            data: { gold: { increment: goldAmount } },
          });
        }
        break;
      }
      case 'DUST': {
        const dustAmount = safeParseInt(val, 0);
        if (dustAmount > 0) {
          await tx.inventory.update({
            where: { userId },
            data: { dust: { increment: dustAmount } },
          });
        }
        break;
      }
      case 'SIGILS': {
        // DEPRECATED: Convert sigils to dust (10:1 ratio)
        const sigilAmount = safeParseInt(val, 0);
        if (sigilAmount > 0) {
          await tx.inventory.update({
            where: { userId },
            data: { dust: { increment: sigilAmount * 10 } },
          });
        }
        break;
      }
      case 'ITEM': {
        // Note: ITEM reward value should be "itemId:amount"
        const parts = val.split(':');
        const itemId = parts[0];
        const amount = safeParseInt(parts[1], 1);
        if (!itemId || amount <= 0) {
          throw new Error('Invalid ITEM reward format');
        }
        const inv = await tx.inventory.findUnique({ where: { userId } });
        if (inv) {
          const items = (inv.items as Record<string, number>) || {};
          items[itemId] = (items[itemId] || 0) + amount;
          await tx.inventory.update({
            where: { userId },
            data: { items },
          });
        }
        break;
      }
      case 'ARTIFACT':
        // ARTIFACT needs to create actual PlayerArtifact
        // We do this by calling the service, but since we are in transaction, we might want to do it manually
        await tx.playerArtifact.create({
          data: { userId, artifactId: val },
        });
        break;
    }
  });

  return { success: true };
}
