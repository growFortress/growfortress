import { prisma } from '../lib/prisma.js';
import {
  selectMissionsForWeek,
  getCurrentWeekKey,
  getTimeUntilWeekReset,
  getMissionById,
  type MissionProgress,
  type GetWeeklyMissionsResponse,
  type ClaimMissionRewardResponse,
  type MissionType,
} from '@arcade/protocol';

/**
 * Weekly Missions Service
 *
 * Handles creation, progress tracking, and rewards for weekly missions.
 * 6 missions are randomly selected each week (2 easy, 3 medium, 1 hard).
 */

// ============================================================================
// MISSION CREATION
// ============================================================================

/**
 * Get or create weekly missions for a specific week
 */
export async function getOrCreateWeeklyMissions(weekKey: string): Promise<Array<{
  id: string;
  missionDefId: string;
  targetValue: number;
  rewardGold: number;
  rewardDust: number;
  rewardMaterials: Record<string, number>;
}>> {
  // Check if missions already exist for this week
  const existingMissions = await prisma.weeklyMission.findMany({
    where: { weekKey },
  });

  if (existingMissions.length > 0) {
    return existingMissions.map(m => ({
      id: m.id,
      missionDefId: m.missionDefId,
      targetValue: m.targetValue,
      rewardGold: m.rewardGold,
      rewardDust: m.rewardDust,
      rewardMaterials: m.rewardMaterials as Record<string, number>,
    }));
  }

  // Create new missions for this week
  const selectedMissions = selectMissionsForWeek(weekKey);

  const createdMissions = await prisma.$transaction(
    selectedMissions.map(def =>
      prisma.weeklyMission.create({
        data: {
          weekKey,
          missionDefId: def.id,
          targetValue: def.baseTarget,
          rewardGold: def.goldReward,
          rewardDust: def.dustReward,
          rewardMaterials: def.materials,
        },
      })
    )
  );

  return createdMissions.map(m => ({
    id: m.id,
    missionDefId: m.missionDefId,
    targetValue: m.targetValue,
    rewardGold: m.rewardGold,
    rewardDust: m.rewardDust,
    rewardMaterials: m.rewardMaterials as Record<string, number>,
  }));
}

// ============================================================================
// GET MISSIONS
// ============================================================================

/**
 * Get weekly missions with player progress
 */
export async function getWeeklyMissions(userId: string): Promise<GetWeeklyMissionsResponse | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return null;
  }

  const weekKey = getCurrentWeekKey();
  const missions = await getOrCreateWeeklyMissions(weekKey);

  // Get player progress for all missions
  const progressRecords = await prisma.playerMissionProgress.findMany({
    where: {
      userId,
      missionId: { in: missions.map(m => m.id) },
    },
  });

  const progressMap = new Map(progressRecords.map(p => [p.missionId, p]));

  // Build response
  const missionProgress: MissionProgress[] = missions.map(mission => {
    const def = getMissionById(mission.missionDefId);
    const progress = progressMap.get(mission.id);

    const currentProgress = progress?.currentProgress ?? 0;
    const completed = progress?.completed ?? false;
    const claimed = progress?.claimed ?? false;

    return {
      missionId: mission.id,
      missionDefId: mission.missionDefId,
      definition: def!,
      currentProgress,
      targetValue: mission.targetValue,
      completed,
      completedAt: progress?.completedAt?.toISOString() ?? null,
      claimed,
      claimedAt: progress?.claimedAt?.toISOString() ?? null,
      progressPercent: Math.min(100, Math.floor((currentProgress / mission.targetValue) * 100)),
    };
  });

  const totalCompleted = missionProgress.filter(m => m.completed).length;
  const totalClaimed = missionProgress.filter(m => m.claimed).length;
  const unclaimedCount = missionProgress.filter(m => m.completed && !m.claimed).length;

  return {
    weekKey,
    missions: missionProgress,
    totalCompleted,
    totalClaimed,
    unclaimedCount,
    timeUntilReset: getTimeUntilWeekReset(),
  };
}

// ============================================================================
// UPDATE PROGRESS
// ============================================================================

/**
 * Update mission progress for a specific mission type
 * Called from game session end, PvP battles, etc.
 */
export async function updateMissionProgress(
  userId: string,
  missionType: MissionType,
  amount: number
): Promise<void> {
  if (amount <= 0) return;

  const weekKey = getCurrentWeekKey();

  // Get missions for this week that match the mission type
  const missions = await prisma.weeklyMission.findMany({
    where: { weekKey },
    include: {
      progress: {
        where: { userId },
      },
    },
  });

  // Filter to missions of the matching type
  const matchingMissions = missions.filter(m => {
    const def = getMissionById(m.missionDefId);
    return def?.type === missionType;
  });

  if (matchingMissions.length === 0) return;

  // Update progress for each matching mission
  await prisma.$transaction(
    matchingMissions.map(mission => {
      const existingProgress = mission.progress[0];
      const currentProgress = existingProgress?.currentProgress ?? 0;
      const newProgress = currentProgress + amount;
      const isNowCompleted = newProgress >= mission.targetValue;

      return prisma.playerMissionProgress.upsert({
        where: {
          userId_missionId: {
            userId,
            missionId: mission.id,
          },
        },
        create: {
          userId,
          missionId: mission.id,
          currentProgress: newProgress,
          completed: isNowCompleted,
          completedAt: isNowCompleted ? new Date() : null,
        },
        update: {
          currentProgress: newProgress,
          completed: isNowCompleted || existingProgress?.completed,
          completedAt: isNowCompleted && !existingProgress?.completed ? new Date() : existingProgress?.completedAt,
        },
      });
    })
  );
}

/**
 * Batch update multiple mission types at once
 * Useful when a game session ends and multiple metrics need updating
 */
export async function batchUpdateMissionProgress(
  userId: string,
  updates: Array<{ type: MissionType; amount: number }>
): Promise<void> {
  // Run all updates - they're independent so can be parallelized
  await Promise.all(
    updates
      .filter(u => u.amount > 0)
      .map(u => updateMissionProgress(userId, u.type, u.amount))
  );
}

// ============================================================================
// CLAIM REWARD
// ============================================================================

/**
 * Claim reward for a completed mission
 */
export async function claimMissionReward(
  userId: string,
  missionId: string
): Promise<ClaimMissionRewardResponse> {
  // Get mission and progress
  const mission = await prisma.weeklyMission.findUnique({
    where: { id: missionId },
    include: {
      progress: {
        where: { userId },
      },
    },
  });

  if (!mission) {
    return {
      success: false,
      goldAwarded: 0,
      dustAwarded: 0,
      materialsAwarded: {},
      newInventory: { gold: 0, dust: 0, materials: {} },
      error: 'MISSION_NOT_FOUND',
    };
  }

  // Check if current week
  const currentWeek = getCurrentWeekKey();
  if (mission.weekKey !== currentWeek) {
    return {
      success: false,
      goldAwarded: 0,
      dustAwarded: 0,
      materialsAwarded: {},
      newInventory: { gold: 0, dust: 0, materials: {} },
      error: 'MISSION_EXPIRED',
    };
  }

  const progress = mission.progress[0];

  // Check if completed
  if (!progress?.completed) {
    return {
      success: false,
      goldAwarded: 0,
      dustAwarded: 0,
      materialsAwarded: {},
      newInventory: { gold: 0, dust: 0, materials: {} },
      error: 'MISSION_NOT_COMPLETED',
    };
  }

  // Check if already claimed
  if (progress.claimed) {
    return {
      success: false,
      goldAwarded: 0,
      dustAwarded: 0,
      materialsAwarded: {},
      newInventory: { gold: 0, dust: 0, materials: {} },
      error: 'MISSION_ALREADY_CLAIMED',
    };
  }

  const materialsToAward = mission.rewardMaterials as Record<string, number>;

  // Update database in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Mark as claimed
    await tx.playerMissionProgress.update({
      where: { id: progress.id },
      data: {
        claimed: true,
        claimedAt: new Date(),
      },
    });

    // Get or create inventory
    let inventory = await tx.inventory.findUnique({
      where: { userId },
    });

    if (!inventory) {
      inventory = await tx.inventory.create({
        data: { userId },
      });
    }

    // Merge materials
    const currentMaterials = (inventory.materials as Record<string, number>) ?? {};
    const updatedMaterials = { ...currentMaterials };
    for (const [materialId, amount] of Object.entries(materialsToAward)) {
      updatedMaterials[materialId] = (updatedMaterials[materialId] ?? 0) + amount;
    }

    // Update inventory
    const updatedInventory = await tx.inventory.update({
      where: { userId },
      data: {
        gold: { increment: mission.rewardGold },
        dust: { increment: mission.rewardDust },
        materials: updatedMaterials,
      },
    });

    return {
      gold: updatedInventory.gold,
      dust: updatedInventory.dust,
      materials: updatedMaterials,
    };
  });

  return {
    success: true,
    goldAwarded: mission.rewardGold,
    dustAwarded: mission.rewardDust,
    materialsAwarded: materialsToAward,
    newInventory: result,
  };
}

/**
 * Claim all completed but unclaimed mission rewards
 */
export async function claimAllMissionRewards(userId: string): Promise<{
  success: boolean;
  claimedCount: number;
  totalGoldAwarded: number;
  totalDustAwarded: number;
  materialsAwarded: Record<string, number>;
  newInventory: { gold: number; dust: number; materials: Record<string, number> };
}> {
  const weekKey = getCurrentWeekKey();

  // Get all unclaimed completed missions
  const unclaimedProgress = await prisma.playerMissionProgress.findMany({
    where: {
      userId,
      completed: true,
      claimed: false,
      mission: { weekKey },
    },
    include: {
      mission: true,
    },
  });

  if (unclaimedProgress.length === 0) {
    const inventory = await prisma.inventory.findUnique({ where: { userId } });
    return {
      success: true,
      claimedCount: 0,
      totalGoldAwarded: 0,
      totalDustAwarded: 0,
      materialsAwarded: {},
      newInventory: {
        gold: inventory?.gold ?? 0,
        dust: inventory?.dust ?? 0,
        materials: (inventory?.materials as Record<string, number>) ?? {},
      },
    };
  }

  // Calculate totals
  let totalGold = 0;
  let totalDust = 0;
  const totalMaterials: Record<string, number> = {};

  for (const progress of unclaimedProgress) {
    totalGold += progress.mission.rewardGold;
    totalDust += progress.mission.rewardDust;
    const mats = progress.mission.rewardMaterials as Record<string, number>;
    for (const [materialId, amount] of Object.entries(mats)) {
      totalMaterials[materialId] = (totalMaterials[materialId] ?? 0) + amount;
    }
  }

  // Update database in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Mark all as claimed
    await tx.playerMissionProgress.updateMany({
      where: {
        id: { in: unclaimedProgress.map(p => p.id) },
      },
      data: {
        claimed: true,
        claimedAt: new Date(),
      },
    });

    // Get or create inventory
    let inventory = await tx.inventory.findUnique({
      where: { userId },
    });

    if (!inventory) {
      inventory = await tx.inventory.create({
        data: { userId },
      });
    }

    // Merge materials
    const currentMaterials = (inventory.materials as Record<string, number>) ?? {};
    const updatedMaterials = { ...currentMaterials };
    for (const [materialId, amount] of Object.entries(totalMaterials)) {
      updatedMaterials[materialId] = (updatedMaterials[materialId] ?? 0) + amount;
    }

    // Update inventory
    const updatedInventory = await tx.inventory.update({
      where: { userId },
      data: {
        gold: { increment: totalGold },
        dust: { increment: totalDust },
        materials: updatedMaterials,
      },
    });

    return {
      gold: updatedInventory.gold,
      dust: updatedInventory.dust,
      materials: updatedMaterials,
    };
  });

  return {
    success: true,
    claimedCount: unclaimedProgress.length,
    totalGoldAwarded: totalGold,
    totalDustAwarded: totalDust,
    materialsAwarded: totalMaterials,
    newInventory: result,
  };
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Clean up old mission data (called periodically by cron)
 * Removes missions and progress older than 4 weeks
 */
export async function cleanupOldMissions(): Promise<number> {
  const now = new Date();
  const fourWeeksAgo = new Date(now);
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  // Get old week keys
  const oldMissions = await prisma.weeklyMission.findMany({
    where: {
      createdAt: { lt: fourWeeksAgo },
    },
    select: { id: true },
  });

  if (oldMissions.length === 0) return 0;

  // Delete in cascade (progress deleted automatically)
  const deleted = await prisma.weeklyMission.deleteMany({
    where: {
      id: { in: oldMissions.map(m => m.id) },
    },
  });

  return deleted.count;
}
