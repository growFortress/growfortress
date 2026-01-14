/**
 * IAP Service - Handles in-app purchase dust grants
 *
 * Note: Actual payment verification happens externally (iOS/Android/Steam).
 * This service grants dust after payment is confirmed by the external system.
 */
import { prisma } from '../lib/prisma.js';
import {
  DUST_PACKAGES,
  type Platform,
  type GetPackagesResponse,
  type GrantDustResponse,
} from '@arcade/protocol';

/**
 * Get available dust packages with first-purchase bonus info
 */
export async function getPackages(userId: string): Promise<GetPackagesResponse> {
  // Check which packages have been purchased before (for first-purchase bonus)
  const purchasedPackages = await prisma.iAPTransaction.findMany({
    where: { userId },
    select: { packageId: true },
    distinct: ['packageId'],
  });

  const purchasedSet = new Set(purchasedPackages.map((p: { packageId: string }) => p.packageId));

  const firstPurchaseBonusAvailable: Record<string, boolean> = {};
  for (const pkg of DUST_PACKAGES) {
    firstPurchaseBonusAvailable[pkg.id] = !purchasedSet.has(pkg.id);
  }

  return {
    packages: DUST_PACKAGES,
    firstPurchaseBonusAvailable,
  };
}

/**
 * Grant dust to user after successful IAP
 * This should be called by admin/webhook after payment verification
 */
export async function grantDust(
  userId: string,
  packageId: string,
  transactionId: string,
  platform: Platform,
  _receipt?: string
): Promise<GrantDustResponse> {
  // Find the package
  const pkg = DUST_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) {
    throw new Error(`Unknown package: ${packageId}`);
  }

  // Check if transaction already processed (idempotency)
  const existing = await prisma.iAPTransaction.findUnique({
    where: { transactionId },
  });
  if (existing) {
    throw new Error(`Transaction already processed: ${transactionId}`);
  }

  // Check if first purchase for bonus
  const previousPurchase = await prisma.iAPTransaction.findFirst({
    where: { userId, packageId },
  });
  const isFirstPurchase = !previousPurchase;
  const bonusGranted = isFirstPurchase ? pkg.bonusDust : 0;
  const totalDust = pkg.dustAmount + bonusGranted;

  // Grant dust and record transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create transaction record
    await tx.iAPTransaction.create({
      data: {
        userId,
        packageId,
        dustGranted: pkg.dustAmount,
        bonusGranted,
        transactionId,
        platform: platform as 'ios' | 'android' | 'steam' | 'web',
      },
    });

    // Update inventory
    const inventory = await tx.inventory.update({
      where: { userId },
      data: {
        dust: { increment: totalDust },
      },
    });

    return inventory;
  });

  return {
    success: true,
    dustGranted: pkg.dustAmount,
    bonusGranted,
    newBalance: result.dust,
    isFirstPurchase,
  };
}

/**
 * Get user's IAP transaction history
 */
export async function getTransactions(
  userId: string,
  limit = 50,
  offset = 0
): Promise<{ transactions: Array<{
  id: string;
  userId: string;
  packageId: string;
  dustGranted: number;
  bonusGranted: number;
  transactionId: string;
  platform: string;
  createdAt: string;
}>; total: number }> {
  const [transactions, total] = await Promise.all([
    prisma.iAPTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.iAPTransaction.count({
      where: { userId },
    }),
  ]);

  return {
    transactions: transactions.map((t) => ({
      id: t.id,
      userId: t.userId,
      packageId: t.packageId,
      dustGranted: t.dustGranted,
      bonusGranted: t.bonusGranted,
      transactionId: t.transactionId,
      platform: t.platform,
      createdAt: t.createdAt.toISOString(),
    })),
    total,
  };
}
