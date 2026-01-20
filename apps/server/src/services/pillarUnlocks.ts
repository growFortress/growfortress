import { prisma } from '../lib/prisma.js';
import {
  PILLAR_LEVEL_REQUIREMENTS,
  getUnlockedPillarsAtLevel,
  type PillarId,
} from '@arcade/sim-core';
import type { PillarUnlockId } from '@arcade/protocol';

/**
 * Get user's pillar unlock status based on fortress level
 * Level-gated system - no manual unlock needed
 */
export async function getPillarUnlocks(userId: string) {
  const progression = await prisma.progression.findUnique({
    where: { userId },
    select: { level: true },
  });

  const fortressLevel = progression?.level ?? 1;
  const unlockedPillars = getUnlockedPillarsAtLevel(fortressLevel) as PillarUnlockId[];

  // Build info for all pillars
  const allPillars = (Object.entries(PILLAR_LEVEL_REQUIREMENTS) as [PillarId, number][]).map(
    ([pillarId, requiredLevel]) => ({
      pillarId: pillarId as PillarUnlockId,
      requiredLevel,
      isUnlocked: fortressLevel >= requiredLevel,
    })
  );

  return {
    unlockedPillars,
    allPillars,
    currentFortressLevel: fortressLevel,
  };
}

/**
 * Check if a specific pillar is unlocked for the user (level-based)
 */
export async function isPillarUnlockedForUser(
  userId: string,
  pillarId: PillarUnlockId
): Promise<boolean> {
  const progression = await prisma.progression.findUnique({
    where: { userId },
    select: { level: true },
  });

  const fortressLevel = progression?.level ?? 1;
  const requiredLevel = PILLAR_LEVEL_REQUIREMENTS[pillarId as PillarId];
  return requiredLevel !== undefined && fortressLevel >= requiredLevel;
}

/**
 * Get list of unlocked pillars for user (level-based)
 */
export async function getUnlockedPillarsForUser(userId: string): Promise<PillarUnlockId[]> {
  const progression = await prisma.progression.findUnique({
    where: { userId },
    select: { level: true },
  });

  const fortressLevel = progression?.level ?? 1;
  return getUnlockedPillarsAtLevel(fortressLevel) as PillarUnlockId[];
}
