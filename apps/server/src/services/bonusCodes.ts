import { prisma } from "../lib/prisma.js";

export interface RedeemCodeResult {
  success: boolean;
  error?: string;
  rewards?: {
    gold: number;
    dust: number;
    energy: number;
    materials: Record<string, number>;
  };
}

/**
 * Redeem a bonus code for a user
 */
export async function redeemBonusCode(
  userId: string,
  codeInput: string,
): Promise<RedeemCodeResult> {
  const code = codeInput.trim().toUpperCase();

  if (!code) {
    return { success: false, error: "INVALID_CODE" };
  }

  // Find the bonus code
  const bonusCode = await prisma.bonusCode.findUnique({
    where: { code },
    include: {
      redemptions: {
        where: { userId },
      },
    },
  });

  if (!bonusCode) {
    return { success: false, error: "INVALID_CODE" };
  }

  // Check if code is active
  if (!bonusCode.isActive) {
    return { success: false, error: "CODE_INACTIVE" };
  }

  // Check validity period
  const now = new Date();
  if (bonusCode.validFrom > now) {
    return { success: false, error: "CODE_NOT_YET_VALID" };
  }
  if (bonusCode.validUntil && bonusCode.validUntil < now) {
    return { success: false, error: "CODE_EXPIRED" };
  }

  // Check if user already redeemed
  if (bonusCode.redemptions.length > 0) {
    return { success: false, error: "ALREADY_REDEEMED" };
  }

  // Check max redemptions
  if (
    bonusCode.maxRedemptions !== null &&
    bonusCode.redemptionCount >= bonusCode.maxRedemptions
  ) {
    return { success: false, error: "CODE_EXHAUSTED" };
  }

  // Prepare rewards
  const rewards = {
    gold: bonusCode.rewardGold,
    dust: bonusCode.rewardDust,
    energy: bonusCode.rewardEnergy,
    materials: (bonusCode.rewardMaterials as Record<string, number>) || {},
  };

  // Apply rewards in a transaction
  await prisma.$transaction(async (tx) => {
    // Update inventory (gold, dust)
    if (rewards.gold > 0 || rewards.dust > 0) {
      await tx.inventory.update({
        where: { userId },
        data: {
          gold: { increment: rewards.gold },
          dust: { increment: rewards.dust },
        },
      });
    }

    // Update energy
    if (rewards.energy > 0) {
      await tx.userEnergy.upsert({
        where: { userId },
        create: {
          userId,
          currentEnergy: rewards.energy,
          maxEnergy: 100,
        },
        update: {
          currentEnergy: { increment: rewards.energy },
        },
      });
    }

    // Update materials
    if (Object.keys(rewards.materials).length > 0) {
      const inventory = await tx.inventory.findUnique({
        where: { userId },
        select: { materials: true },
      });

      const currentMaterials =
        (inventory?.materials as Record<string, number>) || {};
      const updatedMaterials = { ...currentMaterials };

      for (const [materialId, amount] of Object.entries(rewards.materials)) {
        updatedMaterials[materialId] =
          (updatedMaterials[materialId] || 0) + amount;
      }

      await tx.inventory.update({
        where: { userId },
        data: { materials: updatedMaterials },
      });
    }

    // Create redemption record
    await tx.bonusCodeRedemption.create({
      data: {
        codeId: bonusCode.id,
        userId,
        rewardsGiven: rewards,
      },
    });

    // Increment redemption count
    await tx.bonusCode.update({
      where: { id: bonusCode.id },
      data: { redemptionCount: { increment: 1 } },
    });
  });

  return { success: true, rewards };
}
