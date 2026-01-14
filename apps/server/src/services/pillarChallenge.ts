/**
 * Pillar Challenge Service
 *
 * Handles Pillar Challenge game mode:
 * - Session management (start, submit, abandon)
 * - Crystal fragment tracking (deterministic rewards)
 * - Daily limits and cooldowns
 * - Verification via replay
 */

import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { updateQuestsFromRun } from './dailyQuests.js';
import type {
  PillarId,
  PillarChallengeTier,
  ChallengeLoadout,
  PillarChallengeProgress,
  CrystalProgress,
  StartPillarChallengeResponse,
  SubmitPillarChallengeResponse,
  AchievedBonus,
  PillarChallengeStatusResponse,
  PreviewChallengeRewardsResponse,
  ChallengeLeaderboardEntry,
  GetChallengeLeaderboardResponse,
  CraftCrystalResponse,
  AssembleMatrixResponse,
} from '@arcade/protocol';
import {
  TIER_CONFIGS,
  PERFORMANCE_BONUSES,
  PILLAR_CRYSTAL_REWARDS,
  CHALLENGE_ENTRY_CONFIG,
  TIER_FORTRESS_XP,
  PILLAR_XP_MULTIPLIERS,
  TIER_MATERIAL_REWARDS,
  PILLAR_SPECIFIC_MATERIALS,
  calculateFragmentRewards,
  calculateMaterialRewards,
  isTierUnlocked,
  isCooldownExpired,
  getCooldownRemaining,
  replayPillarChallenge,
  getDefaultPillarChallengeConfig,
  type PillarChallengeSimConfig,
} from '@arcade/sim-core';

// ============================================================================
// CONSTANTS
// ============================================================================

const FRAGMENTS_PER_CRYSTAL = 10;

const TIER_MAP: Record<PillarChallengeTier, number> = {
  normal: 1,
  hard: 2,
  mythic: 3,
};

const TIER_FROM_NUM: Record<number, PillarChallengeTier> = {
  1: 'normal',
  2: 'hard',
  3: 'mythic',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get or create crystal progress for user
 */
async function getOrCreateCrystalProgress(userId: string) {
  let progress = await prisma.crystalProgress.findUnique({
    where: { userId },
  });

  if (!progress) {
    progress = await prisma.crystalProgress.create({
      data: { userId },
    });
  }

  return progress;
}

/**
 * Get or create challenge limits for user
 */
async function getOrCreateChallengeLimits(userId: string) {
  let limits = await prisma.pillarChallengeLimits.findUnique({
    where: { userId },
  });

  const now = new Date();

  if (!limits) {
    limits = await prisma.pillarChallengeLimits.create({
      data: {
        userId,
        dailyResetAt: getNextDailyReset(),
      },
    });
  }

  // Check if daily reset is needed
  if (limits.dailyResetAt <= now) {
    limits = await prisma.pillarChallengeLimits.update({
      where: { userId },
      data: {
        dailyAttempts: 0,
        dailyPaidAttempts: 0,
        dailyResetAt: getNextDailyReset(),
      },
    });
  }

  return limits;
}

/**
 * Get next daily reset time (midnight UTC)
 */
function getNextDailyReset(): Date {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow;
}

/**
 * Get player's challenge progress for all pillars
 */
async function getPlayerProgress(userId: string): Promise<Map<string, {
  normalClears: number;
  hardClears: number;
  mythicClears: number;
  normalPerfect: boolean;
  hardPerfect: boolean;
  mythicPerfect: boolean;
  bestTimeNormal: number | null;
  bestTimeHard: number | null;
  bestTimeMythic: number | null;
}>> {
  const sessions = await prisma.pillarChallengeSession.findMany({
    where: {
      userId,
      verified: true,
    },
    select: {
      pillarId: true,
      tier: true,
      wavesCleared: true,
      bonusesAchieved: true,
      startedAt: true,
      endedAt: true,
    },
  });

  const progressMap = new Map<string, {
    normalClears: number;
    hardClears: number;
    mythicClears: number;
    normalPerfect: boolean;
    hardPerfect: boolean;
    mythicPerfect: boolean;
    bestTimeNormal: number | null;
    bestTimeHard: number | null;
    bestTimeMythic: number | null;
  }>();

  // Initialize all pillars
  const pillars: PillarId[] = ['streets', 'science', 'mutants', 'cosmos', 'magic', 'gods'];
  for (const pillarId of pillars) {
    progressMap.set(pillarId, {
      normalClears: 0,
      hardClears: 0,
      mythicClears: 0,
      normalPerfect: false,
      hardPerfect: false,
      mythicPerfect: false,
      bestTimeNormal: null,
      bestTimeHard: null,
      bestTimeMythic: null,
    });
  }

  // Aggregate data from sessions
  for (const session of sessions) {
    const progress = progressMap.get(session.pillarId);
    if (!progress) continue;

    const tierConfig = TIER_CONFIGS[TIER_FROM_NUM[session.tier]];
    const isComplete = session.wavesCleared >= tierConfig.waveCount;
    const isPerfect = session.bonusesAchieved.includes('perfect_clear');

    const timeElapsed = session.endedAt
      ? (session.endedAt.getTime() - session.startedAt.getTime()) / 1000
      : null;

    if (session.tier === 1 && isComplete) {
      progress.normalClears++;
      if (isPerfect) progress.normalPerfect = true;
      if (timeElapsed !== null && (progress.bestTimeNormal === null || timeElapsed < progress.bestTimeNormal)) {
        progress.bestTimeNormal = timeElapsed;
      }
    } else if (session.tier === 2 && isComplete) {
      progress.hardClears++;
      if (isPerfect) progress.hardPerfect = true;
      if (timeElapsed !== null && (progress.bestTimeHard === null || timeElapsed < progress.bestTimeHard)) {
        progress.bestTimeHard = timeElapsed;
      }
    } else if (session.tier === 3 && isComplete) {
      progress.mythicClears++;
      if (isPerfect) progress.mythicPerfect = true;
      if (timeElapsed !== null && (progress.bestTimeMythic === null || timeElapsed < progress.bestTimeMythic)) {
        progress.bestTimeMythic = timeElapsed;
      }
    }
  }

  return progressMap;
}

/**
 * Check if it's the player's first perfect clear on this tier
 */
async function isFirstPerfectClear(
  userId: string,
  pillarId: string,
  tier: number
): Promise<boolean> {
  const count = await prisma.pillarChallengeSession.count({
    where: {
      userId,
      pillarId,
      tier,
      verified: true,
      bonusesAchieved: { has: 'perfect_clear' },
    },
  });

  return count === 0;
}

// ============================================================================
// START CHALLENGE
// ============================================================================

export async function startPillarChallenge(
  userId: string,
  pillarId: PillarId,
  tier: PillarChallengeTier,
  loadout: ChallengeLoadout,
  usePaidAttempt: boolean
): Promise<StartPillarChallengeResponse> {
  try {
    // Check for active session
    const activeSession = await prisma.pillarChallengeSession.findFirst({
      where: {
        userId,
        endedAt: null,
      },
    });

    if (activeSession) {
      return {
        success: false,
        error: 'Masz już aktywną sesję challenge. Zakończ ją lub porzuć przed rozpoczęciem nowej.',
      };
    }

    // Get limits
    const limits = await getOrCreateChallengeLimits(userId);

    // Check cooldown
    if (limits.lastAttemptAt && !isCooldownExpired(limits.lastAttemptAt.getTime())) {
      const remaining = getCooldownRemaining(limits.lastAttemptAt.getTime());
      return {
        success: false,
        error: `Musisz poczekać ${Math.ceil(remaining / 60)} minut przed następną próbą.`,
      };
    }

    // Check attempts
    const config = CHALLENGE_ENTRY_CONFIG;
    const freeRemaining = config.freeAttemptsPerDay - limits.dailyAttempts;
    const paidRemaining = config.maxPaidAttempts - limits.dailyPaidAttempts;

    if (usePaidAttempt) {
      if (paidRemaining <= 0) {
        return {
          success: false,
          error: 'Wykorzystałeś już wszystkie płatne próby na dziś.',
        };
      }

      // Check gold
      const inventory = await prisma.inventory.findUnique({
        where: { userId },
        select: { gold: true },
      });

      if (!inventory || inventory.gold < config.paidAttemptCost) {
        return {
          success: false,
          error: `Potrzebujesz ${config.paidAttemptCost} złota na płatną próbę.`,
        };
      }
    } else {
      if (freeRemaining <= 0) {
        if (paidRemaining > 0) {
          return {
            success: false,
            error: `Wykorzystałeś darmowe próby. Możesz kupić próbę za ${config.paidAttemptCost} złota.`,
          };
        }
        return {
          success: false,
          error: 'Wykorzystałeś wszystkie próby na dziś. Wróć jutro!',
        };
      }
    }

    // Check tier unlock
    const playerProgress = await getPlayerProgress(userId);
    const pillarProgress = playerProgress.get(pillarId)!;

    if (!isTierUnlocked(tier, pillarId, pillarProgress)) {
      return {
        success: false,
        error: `Tier ${tier} nie jest jeszcze odblokowany dla tego filaru.`,
      };
    }

    // Generate seed
    const seed = Math.floor(Math.random() * 2147483647);

    // Create session
    const tierNum = TIER_MAP[tier];
    const session = await prisma.pillarChallengeSession.create({
      data: {
        userId,
        pillarId,
        tier: tierNum,
        seed,
        loadoutJson: loadout,
      },
    });

    // Update limits
    const updateData: { dailyAttempts?: number; dailyPaidAttempts?: number; lastAttemptAt: Date } = {
      lastAttemptAt: new Date(),
    };

    if (usePaidAttempt) {
      updateData.dailyPaidAttempts = limits.dailyPaidAttempts + 1;

      // Deduct gold
      await prisma.inventory.update({
        where: { userId },
        data: { gold: { decrement: config.paidAttemptCost } },
      });
    } else {
      updateData.dailyAttempts = limits.dailyAttempts + 1;
    }

    await prisma.pillarChallengeLimits.update({
      where: { userId },
      data: updateData,
    });

    const tierConfig = TIER_CONFIGS[tier];
    const crystalReward = PILLAR_CRYSTAL_REWARDS[pillarId];

    return {
      success: true,
      sessionId: session.id,
      seed,
      tierConfig: {
        waveCount: tierConfig.waveCount,
        timeLimit: tierConfig.timeLimit,
        enemyHpMultiplier: tierConfig.enemyHpMultiplier / 16384,
        enemyDmgMultiplier: tierConfig.enemyDmgMultiplier / 16384,
        enemySpeedMultiplier: tierConfig.enemySpeedMultiplier / 16384,
      },
      crystalReward: {
        primaryCrystal: crystalReward.primaryCrystal,
        secondaryCrystal: crystalReward.secondaryCrystal,
        fragmentMultiplier: crystalReward.fragmentMultiplier,
      },
      remainingAttempts: {
        free: usePaidAttempt ? freeRemaining : freeRemaining - 1,
        paid: usePaidAttempt ? paidRemaining - 1 : paidRemaining,
      },
    };
  } catch (error) {
    logger.error('Failed to start pillar challenge', { userId, pillarId, tier, error });
    return {
      success: false,
      error: 'Wystąpił błąd podczas rozpoczynania challenge.',
    };
  }
}

// ============================================================================
// SUBMIT CHALLENGE
// ============================================================================

export async function submitPillarChallenge(
  userId: string,
  sessionId: string,
  events: { tick: number; type: string; payload?: unknown }[],
  checkpoints: { tick: number; wave: number; fortressHp: number; hash: number }[],
  finalHash: number,
  result: {
    victory: boolean;
    wavesCleared: number;
    fortressDamageTaken: number;
    heroesLost: number;
    timeElapsed: number;
  }
): Promise<SubmitPillarChallengeResponse> {
  try {
    // Get session
    const session = await prisma.pillarChallengeSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return { success: false, error: 'Sesja nie istnieje.' };
    }

    if (session.userId !== userId) {
      return { success: false, error: 'Ta sesja nie należy do Ciebie.' };
    }

    if (session.endedAt) {
      return { success: false, error: 'Sesja już zakończona.' };
    }

    const tier = TIER_FROM_NUM[session.tier];
    const pillarId = session.pillarId as PillarId;

    // Verify replay
    const loadout = session.loadoutJson as ChallengeLoadout;
    const firstPerfect = await isFirstPerfectClear(userId, pillarId, session.tier);

    const config: PillarChallengeSimConfig = {
      ...getDefaultPillarChallengeConfig(pillarId, tier),
      fortressClass: loadout.fortressClass,
      startingHeroes: loadout.heroes.map(h => h.heroId),
      startingTurrets: loadout.turrets.map(t => ({
        definitionId: t.turretId,
        slotIndex: t.slotIndex,
        class: loadout.fortressClass, // Turrets inherit fortress class
      })),
      pillarId,
      tier,
      isFirstPerfectClear: firstPerfect,
    };

    // Convert events to proper GameEvent format
    const gameEvents = events.map(e => {
      // Type payload as any to allow dynamic property access
      const payload = (e.payload || {}) as Record<string, unknown>;
      switch (e.type) {
        case 'CHOOSE_RELIC':
          return {
            type: 'CHOOSE_RELIC' as const,
            tick: e.tick,
            wave: (payload.wave as number) ?? 1,
            optionIndex: (payload.optionIndex as number) ?? 0,
          };
        case 'REROLL_RELICS':
          return { type: 'REROLL_RELICS' as const, tick: e.tick };
        case 'ACTIVATE_SNAP':
          return { type: 'ACTIVATE_SNAP' as const, tick: e.tick };
        case 'HERO_COMMAND':
          return {
            type: 'HERO_COMMAND' as const,
            tick: e.tick,
            heroId: (payload.heroId as string) ?? '',
            targetX: (payload.targetX as number) ?? 0,
            targetY: (payload.targetY as number) ?? 0,
          };
        default:
          return { type: 'REROLL_RELICS' as const, tick: e.tick };
      }
    });

    const replayResult = replayPillarChallenge(
      session.seed,
      sessionId,
      userId,
      config,
      gameEvents,
      {
        expectedFinalHash: finalHash,
        checkpoints: checkpoints.map(c => ({ tick: c.tick, hash: c.hash })),
      }
    );

    if (!replayResult.valid) {
      // Mark session as failed verification
      await prisma.pillarChallengeSession.update({
        where: { id: sessionId },
        data: {
          endedAt: new Date(),
          verified: false,
          finalHash,
        },
      });

      logger.warn('Pillar challenge verification failed', {
        userId,
        sessionId,
        error: replayResult.error,
      });

      return {
        success: false,
        verified: false,
        error: replayResult.error || 'Weryfikacja nie powiodła się.',
      };
    }

    // Calculate rewards
    const achievedBonuses = replayResult.state.achievedBonuses;
    const fragmentRewards = calculateFragmentRewards(
      pillarId,
      tier,
      achievedBonuses,
      firstPerfect
    );

    const materialRewards = calculateMaterialRewards(
      pillarId,
      tier,
      session.seed,
      result.wavesCleared,
      TIER_CONFIGS[tier].waveCount
    );

    // XP reward
    const baseXp = TIER_FORTRESS_XP[tier];
    const xpMultiplier = PILLAR_XP_MULTIPLIERS[pillarId];
    const fortressXp = result.victory ? Math.floor(baseXp * xpMultiplier) : 0;

    // Build achieved bonuses list
    const achievedBonusList: AchievedBonus[] = achievedBonuses.map(id => {
      const bonus = PERFORMANCE_BONUSES.find(b => b.id === id)!;
      return {
        id: bonus.id,
        name: bonus.name,
        fragmentReward: bonus.fragmentReward,
      };
    });

    // Update session
    await prisma.pillarChallengeSession.update({
      where: { id: sessionId },
      data: {
        endedAt: new Date(),
        wavesCleared: result.wavesCleared,
        fortressDamageTaken: result.fortressDamageTaken,
        heroesLost: result.heroesLost,
        fragmentsEarned: fragmentRewards.primaryFragments + fragmentRewards.secondaryFragments,
        fullCrystalEarned: fragmentRewards.fullCrystalEarned,
        crystalType: fragmentRewards.fullCrystalType,
        goldEarned: materialRewards.gold,
        materialsEarned: materialRewards.materials,
        bonusesAchieved: achievedBonuses,
        finalHash,
        verified: true,
      },
    });

    // Apply rewards if victory
    if (result.victory) {
      // Update crystal progress
      const crystalReward = PILLAR_CRYSTAL_REWARDS[pillarId];
      const crystalProgress = await getOrCreateCrystalProgress(userId);

      const crystalUpdate: Record<string, unknown> = {};

      // Add primary fragments
      const primaryField = `${crystalReward.primaryCrystal}Fragments` as keyof typeof crystalProgress;
      crystalUpdate[primaryField] = { increment: fragmentRewards.primaryFragments };

      // Add secondary fragments if applicable
      if (crystalReward.secondaryCrystal && fragmentRewards.secondaryFragments > 0) {
        const secondaryField = `${crystalReward.secondaryCrystal}Fragments` as keyof typeof crystalProgress;
        crystalUpdate[secondaryField] = { increment: fragmentRewards.secondaryFragments };
      }

      // Add full crystal if earned
      if (fragmentRewards.fullCrystalEarned && fragmentRewards.fullCrystalType) {
        const currentCrystals = crystalProgress.fullCrystals;
        if (!currentCrystals.includes(fragmentRewards.fullCrystalType)) {
          crystalUpdate.fullCrystals = { push: fragmentRewards.fullCrystalType };
        }
      }

      await prisma.crystalProgress.update({
        where: { userId },
        data: crystalUpdate,
      });

      // Update inventory (gold + materials)
      const materialUpdate: Record<string, number> = {};
      for (const [mat, amount] of Object.entries(materialRewards.materials)) {
        materialUpdate[mat] = amount;
      }

      const inventory = await prisma.inventory.findUnique({
        where: { userId },
        select: { materials: true },
      });

      const currentMaterials = (inventory?.materials as Record<string, number>) || {};
      for (const [mat, amount] of Object.entries(materialRewards.materials)) {
        currentMaterials[mat] = (currentMaterials[mat] || 0) + amount;
      }

      await prisma.inventory.update({
        where: { userId },
        data: {
          gold: { increment: materialRewards.gold },
          materials: currentMaterials,
        },
      });

      // Update progression XP
      if (fortressXp > 0) {
        await prisma.progression.update({
          where: { userId },
          data: {
            xp: { increment: fortressXp },
            totalXp: { increment: fortressXp },
          },
        });
      }

      // Update daily quest progress for pillar_master quest
      await updateQuestsFromRun(userId, {
        pillarsCompleted: 1,
      });
    }

    // Get updated crystal progress
    const newCrystalProgress = await getOrCreateCrystalProgress(userId);

    return {
      success: true,
      verified: true,
      rewards: {
        primaryFragments: fragmentRewards.primaryFragments,
        secondaryFragments: fragmentRewards.secondaryFragments,
        fullCrystalEarned: fragmentRewards.fullCrystalEarned,
        fullCrystalType: fragmentRewards.fullCrystalType,
        gold: materialRewards.gold,
        fortressXp,
        materials: materialRewards.materials,
      },
      achievedBonuses: achievedBonusList,
      newCrystalProgress: {
        powerFragments: newCrystalProgress.powerFragments,
        spaceFragments: newCrystalProgress.spaceFragments,
        timeFragments: newCrystalProgress.timeFragments,
        realityFragments: newCrystalProgress.realityFragments,
        soulFragments: newCrystalProgress.soulFragments,
        mindFragments: newCrystalProgress.mindFragments,
        fullCrystals: newCrystalProgress.fullCrystals as CrystalProgress['fullCrystals'],
        matrixAssembled: newCrystalProgress.matrixAssembled,
      },
    };
  } catch (error) {
    logger.error('Failed to submit pillar challenge', { userId, sessionId, error });
    return {
      success: false,
      error: 'Wystąpił błąd podczas zapisywania wyniku.',
    };
  }
}

// ============================================================================
// GET STATUS
// ============================================================================

export async function getPillarChallengeStatus(
  userId: string
): Promise<PillarChallengeStatusResponse> {
  try {
    const [playerProgress, crystalProgress, limits] = await Promise.all([
      getPlayerProgress(userId),
      getOrCreateCrystalProgress(userId),
      getOrCreateChallengeLimits(userId),
    ]);

    // Build progress array
    const progress: PillarChallengeProgress[] = [];
    const pillars: PillarId[] = ['streets', 'science', 'mutants', 'cosmos', 'magic', 'gods'];

    for (const pillarId of pillars) {
      const p = playerProgress.get(pillarId)!;
      progress.push({
        pillarId,
        normalClears: p.normalClears,
        hardClears: p.hardClears,
        mythicClears: p.mythicClears,
        normalPerfect: p.normalPerfect,
        hardPerfect: p.hardPerfect,
        mythicPerfect: p.mythicPerfect,
        bestTimeNormal: p.bestTimeNormal,
        bestTimeHard: p.bestTimeHard,
        bestTimeMythic: p.bestTimeMythic,
      });
    }

    // Build unlocked tiers map
    const unlockedTiers: Record<PillarId, PillarChallengeTier[]> = {} as Record<PillarId, PillarChallengeTier[]>;
    for (const pillarId of pillars) {
      const p = playerProgress.get(pillarId)!;
      const tiers: PillarChallengeTier[] = ['normal'];

      if (isTierUnlocked('hard', pillarId, p)) {
        tiers.push('hard');
      }
      if (isTierUnlocked('mythic', pillarId, p)) {
        tiers.push('mythic');
      }

      unlockedTiers[pillarId] = tiers;
    }

    return {
      success: true,
      progress,
      crystalProgress: {
        powerFragments: crystalProgress.powerFragments,
        spaceFragments: crystalProgress.spaceFragments,
        timeFragments: crystalProgress.timeFragments,
        realityFragments: crystalProgress.realityFragments,
        soulFragments: crystalProgress.soulFragments,
        mindFragments: crystalProgress.mindFragments,
        fullCrystals: crystalProgress.fullCrystals as CrystalProgress['fullCrystals'],
        matrixAssembled: crystalProgress.matrixAssembled,
      },
      limits: {
        freeAttemptsUsed: limits.dailyAttempts,
        paidAttemptsUsed: limits.dailyPaidAttempts,
        lastAttemptTime: limits.lastAttemptAt?.toISOString() ?? null,
        resetTime: limits.dailyResetAt.toISOString(),
      },
      unlockedTiers,
    };
  } catch (error) {
    logger.error('Failed to get pillar challenge status', { userId, error });
    return {
      success: false,
      error: 'Wystąpił błąd podczas pobierania statusu.',
    };
  }
}

// ============================================================================
// ABANDON CHALLENGE
// ============================================================================

export async function abandonPillarChallenge(
  userId: string,
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await prisma.pillarChallengeSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return { success: false, error: 'Sesja nie istnieje.' };
    }

    if (session.userId !== userId) {
      return { success: false, error: 'Ta sesja nie należy do Ciebie.' };
    }

    if (session.endedAt) {
      return { success: false, error: 'Sesja już zakończona.' };
    }

    await prisma.pillarChallengeSession.update({
      where: { id: sessionId },
      data: {
        endedAt: new Date(),
        verified: false,
      },
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to abandon pillar challenge', { userId, sessionId, error });
    return { success: false, error: 'Wystąpił błąd podczas porzucania challenge.' };
  }
}

// ============================================================================
// PREVIEW REWARDS
// ============================================================================

export async function previewChallengeRewards(
  pillarId: PillarId,
  tier: PillarChallengeTier
): Promise<PreviewChallengeRewardsResponse> {
  try {
    const tierConfig = TIER_CONFIGS[tier];
    const crystalReward = PILLAR_CRYSTAL_REWARDS[pillarId];
    const materialRewards = TIER_MATERIAL_REWARDS[tier];
    const pillarMaterials = PILLAR_SPECIFIC_MATERIALS[pillarId];

    const baseFragments = Math.ceil(tierConfig.baseFragments * crystalReward.fragmentMultiplier);

    return {
      success: true,
      baseFragments,
      maxBonusFragments: tierConfig.maxBonusFragments,
      crystalTypes: {
        primary: crystalReward.primaryCrystal,
        secondary: crystalReward.secondaryCrystal,
      },
      canEarnFullCrystal: tierConfig.canEarnFullCrystal,
      goldRange: materialRewards.gold,
      possibleMaterials: pillarMaterials.map(m => m.material),
      performanceBonuses: PERFORMANCE_BONUSES.map(b => ({
        id: b.id,
        name: b.name,
        description: b.condition.type === 'time_under'
          ? `Ukończ w mniej niż ${b.condition.seconds} sekund`
          : b.condition.type === 'fortress_hp_above'
          ? `Ukończ z HP twierdzy powyżej ${b.condition.percent}%`
          : b.condition.type === 'no_fortress_damage'
          ? 'Ukończ bez obrażeń twierdzy'
          : b.condition.type === 'no_hero_deaths'
          ? 'Żaden bohater nie zginął'
          : 'Warunek specjalny',
        fragmentReward: b.fragmentReward,
      })),
    };
  } catch (error) {
    logger.error('Failed to preview challenge rewards', { pillarId, tier, error });
    return {
      success: false,
      error: 'Wystąpił błąd podczas pobierania podglądu nagród.',
    };
  }
}

// ============================================================================
// CRAFT CRYSTAL
// ============================================================================

export async function craftCrystal(
  userId: string,
  crystalType: CrystalProgress['fullCrystals'][number]
): Promise<CraftCrystalResponse> {
  try {
    const crystalProgress = await getOrCreateCrystalProgress(userId);
    const fragmentField = `${crystalType}Fragments` as keyof typeof crystalProgress;
    const currentFragments = crystalProgress[fragmentField] as number;

    if (currentFragments < FRAGMENTS_PER_CRYSTAL) {
      return {
        success: false,
        error: `Potrzebujesz ${FRAGMENTS_PER_CRYSTAL} fragmentów. Masz ${currentFragments}.`,
      };
    }

    if (crystalProgress.fullCrystals.includes(crystalType)) {
      return {
        success: false,
        error: 'Masz już ten kryształ.',
      };
    }

    // Craft crystal
    const updateData: Record<string, unknown> = {
      [fragmentField]: { decrement: FRAGMENTS_PER_CRYSTAL },
      fullCrystals: { push: crystalType },
    };

    const updated = await prisma.crystalProgress.update({
      where: { userId },
      data: updateData,
    });

    return {
      success: true,
      newCrystalProgress: {
        powerFragments: updated.powerFragments,
        spaceFragments: updated.spaceFragments,
        timeFragments: updated.timeFragments,
        realityFragments: updated.realityFragments,
        soulFragments: updated.soulFragments,
        mindFragments: updated.mindFragments,
        fullCrystals: updated.fullCrystals as CrystalProgress['fullCrystals'],
        matrixAssembled: updated.matrixAssembled,
      },
    };
  } catch (error) {
    logger.error('Failed to craft crystal', { userId, crystalType, error });
    return {
      success: false,
      error: 'Wystąpił błąd podczas craftowania kryształu.',
    };
  }
}

// ============================================================================
// ASSEMBLE MATRIX
// ============================================================================

export async function assembleMatrix(userId: string): Promise<AssembleMatrixResponse> {
  try {
    const crystalProgress = await getOrCreateCrystalProgress(userId);

    if (crystalProgress.matrixAssembled) {
      return {
        success: false,
        error: 'Matryca Kryształów już zmontowana.',
      };
    }

    const requiredCrystals: CrystalProgress['fullCrystals'] = [
      'power',
      'space',
      'time',
      'reality',
      'soul',
      'mind',
    ];

    const missingCrystals = requiredCrystals.filter(
      c => !crystalProgress.fullCrystals.includes(c)
    );

    if (missingCrystals.length > 0) {
      return {
        success: false,
        error: `Brakuje kryształów: ${missingCrystals.join(', ')}`,
      };
    }

    const updated = await prisma.crystalProgress.update({
      where: { userId },
      data: { matrixAssembled: true },
    });

    return {
      success: true,
      newCrystalProgress: {
        powerFragments: updated.powerFragments,
        spaceFragments: updated.spaceFragments,
        timeFragments: updated.timeFragments,
        realityFragments: updated.realityFragments,
        soulFragments: updated.soulFragments,
        mindFragments: updated.mindFragments,
        fullCrystals: updated.fullCrystals as CrystalProgress['fullCrystals'],
        matrixAssembled: updated.matrixAssembled,
      },
      bonusesUnlocked: [
        {
          id: 'matrix_power',
          name: 'Moc Matrycy',
          description: '+200% do wszystkich statystyk gdy matryca jest aktywna',
        },
        {
          id: 'snap_ability',
          name: 'Pstryknięcie',
          description: 'Możliwość natychmiastowego zniszczenia 50% wrogów (raz na sesję)',
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to assemble matrix', { userId, error });
    return {
      success: false,
      error: 'Wystąpił błąd podczas montowania matrycy.',
    };
  }
}

// ============================================================================
// LEADERBOARD
// ============================================================================

export async function getChallengeLeaderboard(
  pillarId: PillarId,
  tier: PillarChallengeTier,
  limit: number,
  offset: number,
  currentUserId?: string
): Promise<GetChallengeLeaderboardResponse> {
  try {
    const tierNum = TIER_MAP[tier];
    const tierConfig = TIER_CONFIGS[tier];

    // Get top entries
    const sessions = await prisma.pillarChallengeSession.findMany({
      where: {
        pillarId,
        tier: tierNum,
        verified: true,
        wavesCleared: tierConfig.waveCount, // Only complete clears
      },
      orderBy: [
        { endedAt: 'asc' }, // Fastest time
      ],
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    // Get total count
    const totalCount = await prisma.pillarChallengeSession.count({
      where: {
        pillarId,
        tier: tierNum,
        verified: true,
        wavesCleared: tierConfig.waveCount,
      },
    });

    const entries: ChallengeLeaderboardEntry[] = sessions.map((s, idx) => ({
      rank: offset + idx + 1,
      playerId: s.user.id,
      playerName: s.user.displayName,
      time: s.endedAt ? (s.endedAt.getTime() - s.startedAt.getTime()) / 1000 : 0,
      wavesCleared: s.wavesCleared,
      fortressHpPercent: 100 - (s.fortressDamageTaken / 100) * 100, // Simplified
      achievedBonuses: s.bonusesAchieved,
      completedAt: s.endedAt?.toISOString() ?? s.startedAt.toISOString(),
    }));

    // Get player's rank if authenticated
    let playerRank: number | null = null;
    let playerBestTime: number | null = null;

    if (currentUserId) {
      const playerBest = await prisma.pillarChallengeSession.findFirst({
        where: {
          userId: currentUserId,
          pillarId,
          tier: tierNum,
          verified: true,
          wavesCleared: tierConfig.waveCount,
        },
        orderBy: { endedAt: 'asc' },
      });

      if (playerBest && playerBest.endedAt) {
        playerBestTime = (playerBest.endedAt.getTime() - playerBest.startedAt.getTime()) / 1000;

        // Count how many are faster
        const fasterCount = await prisma.pillarChallengeSession.count({
          where: {
            pillarId,
            tier: tierNum,
            verified: true,
            wavesCleared: tierConfig.waveCount,
            endedAt: { lt: playerBest.endedAt },
          },
        });

        playerRank = fasterCount + 1;
      }
    }

    return {
      success: true,
      entries,
      totalCount,
      playerRank,
      playerBestTime,
    };
  } catch (error) {
    logger.error('Failed to get challenge leaderboard', { pillarId, tier, error });
    return {
      success: false,
      error: 'Wystąpił błąd podczas pobierania rankingu.',
    };
  }
}
