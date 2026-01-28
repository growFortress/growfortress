import { prisma } from '../lib/prisma.js';

/**
 * Tutorial Service
 *
 * Handles tutorial completion tracking and the associated achievement.
 * The client tracks individual step progress, the server just records
 * when ALL tutorials have been completed.
 */

// Total number of tutorial steps (must match client)
const TOTAL_TUTORIAL_STEPS = 17;

// ============================================================================
// TYPES
// ============================================================================

export interface TutorialStatusResponse {
  completed: boolean;
  completedAt: string | null;
}

export interface CompleteTutorialResponse {
  success: boolean;
  alreadyCompleted: boolean;
  achievementUpdated: boolean;
  error?: string;
}

// ============================================================================
// STATUS
// ============================================================================

/**
 * Get tutorial completion status for a user
 */
export async function getTutorialStatus(userId: string): Promise<TutorialStatusResponse | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      tutorialCompletedAt: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    completed: user.tutorialCompletedAt !== null,
    completedAt: user.tutorialCompletedAt?.toISOString() ?? null,
  };
}

// ============================================================================
// COMPLETION
// ============================================================================

/**
 * Mark tutorial as completed for a user
 * This is called when the client confirms all 17 tutorial steps are done.
 */
export async function completeTutorial(userId: string): Promise<CompleteTutorialResponse> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      tutorialCompletedAt: true,
    },
  });

  if (!user) {
    return {
      success: false,
      alreadyCompleted: false,
      achievementUpdated: false,
      error: 'User not found',
    };
  }

  // Check if already completed
  if (user.tutorialCompletedAt !== null) {
    return {
      success: true,
      alreadyCompleted: true,
      achievementUpdated: false,
    };
  }

  // Mark as completed and update achievement stats
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Update user's tutorial completion timestamp
    await tx.user.update({
      where: { id: userId },
      data: {
        tutorialCompletedAt: now,
      },
    });

    // Update achievement stats for tutorial_complete achievement
    // The tutorialsCompleted stat should be set to TOTAL_TUTORIAL_STEPS
    const achievements = await tx.playerAchievements.findUnique({
      where: { userId },
    });

    const currentStats = (achievements?.lifetimeStats as Record<string, unknown>) ?? {};
    const updatedStats = {
      ...currentStats,
      tutorialsCompleted: TOTAL_TUTORIAL_STEPS,
    };

    await tx.playerAchievements.upsert({
      where: { userId },
      create: {
        userId,
        lifetimeStats: updatedStats,
        achievementProgress: {},
        claimedTiers: {},
        unlockedTitles: [],
        activeTitle: null,
      },
      update: {
        lifetimeStats: updatedStats,
      },
    });
  });

  return {
    success: true,
    alreadyCompleted: false,
    achievementUpdated: true,
  };
}

// ============================================================================
// ADMIN / DEBUG
// ============================================================================

/**
 * Reset tutorial completion status (admin/debug only)
 */
export async function resetTutorialCompletion(userId: string): Promise<boolean> {
  try {
    await prisma.$transaction(async (tx) => {
      // Clear tutorial completion
      await tx.user.update({
        where: { id: userId },
        data: {
          tutorialCompletedAt: null,
        },
      });

      // Reset tutorial achievement stat
      const achievements = await tx.playerAchievements.findUnique({
        where: { userId },
      });

      if (achievements) {
        const currentStats = (achievements.lifetimeStats as Record<string, unknown>) ?? {};
        const updatedStats = {
          ...currentStats,
          tutorialsCompleted: 0,
        };

        await tx.playerAchievements.update({
          where: { userId },
          data: {
            lifetimeStats: updatedStats,
          },
        });
      }
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * Force complete tutorial (admin/debug only)
 * Useful for testing or for users who want to skip
 */
export async function forceCompleteTutorial(userId: string): Promise<boolean> {
  const result = await completeTutorial(userId);
  return result.success;
}
