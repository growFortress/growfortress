import { prisma } from '../lib/prisma.js';
import {
  PILLAR_UNLOCK_REQUIREMENTS,
  PILLAR_UNLOCK_ERROR_CODES,
  type PillarUnlockId,
  type PillarUnlockInfo,
  type GetPillarUnlocksResponse,
  type UnlockPillarResponse,
} from '@arcade/protocol';

/**
 * Get user's pillar unlock status
 */
export async function getPillarUnlocks(userId: string): Promise<GetPillarUnlocksResponse> {
  // Get user's unlocked pillars, progression level, and dust
  const [unlocks, progression, inventory] = await Promise.all([
    prisma.userPillarUnlocks.findUnique({ where: { userId } }),
    prisma.progression.findUnique({ where: { userId } }),
    prisma.inventory.findUnique({ where: { userId } }),
  ]);

  const unlockedPillars = (unlocks?.unlockedPillars ?? ['streets']) as PillarUnlockId[];
  const fortressLevel = progression?.level ?? 1;
  const currentDust = inventory?.dust ?? 0;

  // Build info for all pillars
  const allPillars: PillarUnlockInfo[] = PILLAR_UNLOCK_REQUIREMENTS.map((req) => {
    const isUnlocked = unlockedPillars.includes(req.pillarId);
    const meetsLevel = fortressLevel >= req.fortressLevel;
    const hasDust = currentDust >= req.dustCost;
    const canUnlock = !isUnlocked && meetsLevel && hasDust;

    let reason: string | undefined;
    if (!isUnlocked) {
      if (!meetsLevel) {
        reason = `Wymagany poziom ${req.fortressLevel}`;
      } else if (!hasDust) {
        reason = `Wymagane ${req.dustCost} dust`;
      }
    }

    return {
      pillarId: req.pillarId,
      name: req.name,
      fortressLevel: req.fortressLevel,
      dustCost: req.dustCost,
      isUnlocked,
      canUnlock,
      reason,
    };
  });

  return {
    unlockedPillars,
    allPillars,
    currentFortressLevel: fortressLevel,
    currentDust,
  };
}

/**
 * Unlock a pillar for the user (requires dust and level)
 */
export async function unlockPillar(
  userId: string,
  pillarId: PillarUnlockId
): Promise<UnlockPillarResponse> {
  // Find the requirement for this pillar
  const requirement = PILLAR_UNLOCK_REQUIREMENTS.find((r) => r.pillarId === pillarId);
  if (!requirement) {
    return {
      success: false,
      error: PILLAR_UNLOCK_ERROR_CODES.INVALID_PILLAR,
    };
  }

  // Get user's current state
  const [unlocks, progression, inventory] = await Promise.all([
    prisma.userPillarUnlocks.findUnique({ where: { userId } }),
    prisma.progression.findUnique({ where: { userId } }),
    prisma.inventory.findUnique({ where: { userId } }),
  ]);

  const unlockedPillars = (unlocks?.unlockedPillars ?? ['streets']) as PillarUnlockId[];

  // Check if already unlocked
  if (unlockedPillars.includes(pillarId)) {
    return {
      success: false,
      error: PILLAR_UNLOCK_ERROR_CODES.ALREADY_UNLOCKED,
    };
  }

  // Check level requirement
  const fortressLevel = progression?.level ?? 1;
  if (fortressLevel < requirement.fortressLevel) {
    return {
      success: false,
      error: PILLAR_UNLOCK_ERROR_CODES.INSUFFICIENT_LEVEL,
    };
  }

  // Check dust requirement
  const currentDust = inventory?.dust ?? 0;
  if (currentDust < requirement.dustCost) {
    return {
      success: false,
      error: PILLAR_UNLOCK_ERROR_CODES.INSUFFICIENT_DUST,
    };
  }

  // Transaction: deduct dust and add pillar to unlocked list
  const newUnlockedPillars = [...unlockedPillars, pillarId];

  const result = await prisma.$transaction(async (tx) => {
    // Deduct dust
    const updatedInventory = await tx.inventory.update({
      where: { userId },
      data: { dust: { decrement: requirement.dustCost } },
    });

    // Update or create pillar unlocks record
    await tx.userPillarUnlocks.upsert({
      where: { userId },
      create: {
        userId,
        unlockedPillars: newUnlockedPillars,
      },
      update: {
        unlockedPillars: newUnlockedPillars,
      },
    });

    return updatedInventory;
  });

  return {
    success: true,
    pillarId,
    dustSpent: requirement.dustCost,
    newDust: result.dust,
    unlockedPillars: newUnlockedPillars,
  };
}

/**
 * Check if a specific pillar is unlocked for the user
 */
export async function isPillarUnlockedForUser(
  userId: string,
  pillarId: PillarUnlockId
): Promise<boolean> {
  const unlocks = await prisma.userPillarUnlocks.findUnique({
    where: { userId },
  });

  const unlockedPillars = (unlocks?.unlockedPillars ?? ['streets']) as PillarUnlockId[];
  return unlockedPillars.includes(pillarId);
}

/**
 * Get list of unlocked pillars for user
 */
export async function getUnlockedPillarsForUser(userId: string): Promise<PillarUnlockId[]> {
  const unlocks = await prisma.userPillarUnlocks.findUnique({
    where: { userId },
  });

  return (unlocks?.unlockedPillars ?? ['streets']) as PillarUnlockId[];
}
