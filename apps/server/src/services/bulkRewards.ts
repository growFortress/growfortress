import { prisma } from '../lib/prisma.js';

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
      case 'GOLD':
        await tx.inventory.update({
          where: { userId },
          data: { gold: { increment: parseInt(val) } },
        });
        break;
      case 'DUST':
        await tx.inventory.update({
          where: { userId },
          data: { dust: { increment: parseInt(val) } },
        });
        break;
      case 'SIGILS':
        await tx.inventory.update({
          where: { userId },
          data: { sigils: { increment: parseInt(val) } },
        });
        break;
      case 'ITEM':
        // Note: ITEM reward value should be "itemId:amount"
        const [itemId, amount] = val.split(':');
        // Since addItems handles its own prisma call, we'll call it outside or inside if we can
        // But for safety within transaction, we'll manually update inventory here if needed
        // or just accept the risk of non-atomic if we use service.
        // Let's manually do it for consistency with currencies.
        const inv = await tx.inventory.findUnique({ where: { userId } });
        if (inv) {
          const items = (inv.items as Record<string, number>) || {};
          items[itemId] = (items[itemId] || 0) + parseInt(amount || '1');
          await tx.inventory.update({
            where: { userId },
            data: { items },
          });
        }
        break;
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
