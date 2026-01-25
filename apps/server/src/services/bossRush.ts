import { randomInt } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { createBossRushToken, verifyBossRushToken } from '../lib/tokens.js';
import {
  SIM_VERSION,
  getProgressionBonuses,
  getXpForLevel,
  computeChainHash,
  replayBossRush,
  type BossRushTurretConfig,
  type FortressClass,
} from '@arcade/sim-core';
import type { BossRushStartRequest, BossRushFinishRequest, Checkpoint, GameEvent } from '@arcade/protocol';
import { BOSS_RUSH_REJECTION_REASONS, GameEventSchema } from '@arcade/protocol';
import { getUserProfile } from './auth.js';
import { upsertBossRushLeaderboardEntry, getUserBossRushRank } from './bossRushLeaderboard.js';
import { getCurrentWeekKey } from '../lib/queue.js';
import { addPoints as addBattlePassPoints } from './battlepass.js';
import { updateLifetimeStats } from './achievements.js';

/** Simulation tick rate */
const TICK_HZ = 30;

/** Maximum events allowed per Boss Rush submission */
const MAX_EVENTS = 5000;

/** Maximum checkpoints allowed per Boss Rush submission */
const MAX_CHECKPOINTS = 500;

/** Maximum realistic damage per boss (prevent obviously hacked values) */
const MAX_DAMAGE_PER_BOSS = 10_000_000;

/** Maximum realistic total damage (prevent obviously hacked values) */
const MAX_TOTAL_DAMAGE = 1_000_000_000;

/**
 * Verify Boss Rush submission data
 * Returns null if valid, or rejection reason if invalid
 */
function verifyBossRushSubmission(
  data: BossRushFinishRequest,
  _session: { seed: number; loadoutJson: unknown }
): string | null {
  const { events, checkpoints, summary } = data;

  // Validate event count
  if (events.length > MAX_EVENTS) {
    return BOSS_RUSH_REJECTION_REASONS.PAYLOAD_TOO_LARGE;
  }

  // Validate checkpoint count
  if (checkpoints.length > MAX_CHECKPOINTS) {
    return BOSS_RUSH_REJECTION_REASONS.PAYLOAD_TOO_LARGE;
  }

  // Validate ticks are monotonic in events
  let lastTick = -1;
  for (const event of events as Array<{ tick?: number }>) {
    if (typeof event.tick === 'number') {
      if (event.tick < lastTick) {
        return BOSS_RUSH_REJECTION_REASONS.TICKS_NOT_MONOTONIC;
      }
      lastTick = event.tick;
    }
  }

  // Validate checkpoint chain hash integrity
  if (checkpoints.length > 0) {
    let prevChainHash = 0;
    for (const checkpoint of checkpoints as Checkpoint[]) {
      const expectedChainHash = computeChainHash(prevChainHash, checkpoint.tick, checkpoint.hash32);
      if (checkpoint.chainHash32 !== expectedChainHash) {
        return BOSS_RUSH_REJECTION_REASONS.CHECKPOINT_HASH_MISMATCH;
      }
      prevChainHash = checkpoint.chainHash32;
    }
  }

  // Validate summary values are within reasonable bounds
  if (summary.totalDamageDealt < 0 || summary.totalDamageDealt > MAX_TOTAL_DAMAGE) {
    return BOSS_RUSH_REJECTION_REASONS.INVALID_SUMMARY_DATA;
  }

  if (summary.bossesKilled < 0 || summary.bossesKilled > 100) {
    return BOSS_RUSH_REJECTION_REASONS.INVALID_SUMMARY_DATA;
  }

  // Verify damage is reasonable per boss (average)
  if (summary.bossesKilled > 0) {
    const avgDamagePerBoss = summary.totalDamageDealt / (summary.bossesKilled + 1);
    if (avgDamagePerBoss > MAX_DAMAGE_PER_BOSS) {
      return BOSS_RUSH_REJECTION_REASONS.INVALID_SUMMARY_DATA;
    }
  }

  // Validate time survived is reasonable (max 2 hours at 30Hz)
  const maxTicks = 2 * 60 * 60 * TICK_HZ;
  if (summary.timeSurvived < 0 || summary.timeSurvived > maxTicks) {
    return BOSS_RUSH_REJECTION_REASONS.INVALID_SUMMARY_DATA;
  }

  // Validate rewards are non-negative
  if (summary.goldEarned < 0 || summary.dustEarned < 0) {
    return BOSS_RUSH_REJECTION_REASONS.INVALID_SUMMARY_DATA;
  }

  // Full server-side replay verification
  // Parse and validate events
  const parsedEvents: GameEvent[] = [];
  for (const event of events) {
    const result = GameEventSchema.safeParse(event);
    if (!result.success) {
      // Skip invalid events - could be older client version
      continue;
    }
    parsedEvents.push(result.data);
  }

  // Build loadout config from session
  const loadout = _session.loadoutJson as {
    fortressClass?: string;
    heroIds?: string[];
    turretTypes?: string[];
  };

  // Convert turret types to turret configs
  const fortressClass = (loadout.fortressClass || 'natural') as FortressClass;
  const turretConfigs: BossRushTurretConfig[] = (loadout.turretTypes || []).map(
    (type, index) => ({
      definitionId: type,
      slotIndex: index,
      class: fortressClass,
    })
  );

  // Run replay verification
  const replayResult = replayBossRush({
    seed: _session.seed,
    events: parsedEvents,
    expectedCheckpoints: checkpoints as Checkpoint[],
    expectedFinalHash: data.finalHash,
    loadout: {
      fortressClass,
      heroIds: loadout.heroIds || ['vanguard'],
      turrets: turretConfigs,
    },
  });

  if (!replayResult.success) {
    // Map replay failure reasons to protocol rejection reasons
    switch (replayResult.reason) {
      case 'TICKS_NOT_MONOTONIC':
        return BOSS_RUSH_REJECTION_REASONS.TICKS_NOT_MONOTONIC;
      case 'CHECKPOINT_MISMATCH':
      case 'CHECKPOINT_CHAIN_MISMATCH':
        return BOSS_RUSH_REJECTION_REASONS.CHECKPOINT_HASH_MISMATCH;
      case 'FINAL_HASH_MISMATCH':
        return BOSS_RUSH_REJECTION_REASONS.FINAL_HASH_MISMATCH;
      default:
        return BOSS_RUSH_REJECTION_REASONS.SIMULATION_MISMATCH;
    }
  }

  // Verify summary matches replay result
  const replaySummary = replayResult.summary;
  if (
    Math.abs(replaySummary.totalDamageDealt - summary.totalDamageDealt) > 1000 ||
    replaySummary.bossesKilled !== summary.bossesKilled
  ) {
    return BOSS_RUSH_REJECTION_REASONS.SIMULATION_MISMATCH;
  }

  return null;
}

/** Custom error class for boss rush validation errors */
export class BossRushError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'SESSION_NOT_FOUND'
      | 'USER_NOT_FOUND'
      | 'SESSION_FORBIDDEN'
      | 'INVALID_LOADOUT'
      | 'SESSION_ALREADY_FINISHED'
      | 'TOKEN_INVALID'
  ) {
    super(message);
    this.name = 'BossRushError';
  }
}

/**
 * Start a new Boss Rush session
 */
export async function startBossRushSession(
  userId: string,
  options: BossRushStartRequest = {}
): Promise<{
  sessionId: string;
  sessionToken: string;
  seed: number;
  simVersion: number;
  tickHz: number;
  inventory: { gold: number; dust: number };
  commanderLevel: number;
  progressionBonuses: {
    damageMultiplier: number;
    goldMultiplier: number;
    startingGold: number;
    maxHeroSlots: number;
    maxTurretSlots: number;
  };
} | null> {
  // Get user profile
  const profile = await getUserProfile(userId);
  if (!profile) {
    return null;
  }

  // Get user with inventory
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { inventory: true, progression: true },
  });
  if (!user || !user.inventory) {
    return null;
  }

  const commanderLevel = user.progression?.level ?? 1;
  const progressionBonuses = getProgressionBonuses(commanderLevel);

  // Generate cryptographically secure seed
  const seed = randomInt(2147483647);

  // Build loadout snapshot
  const loadoutJson = {
    fortressClass: options.fortressClass ?? user.defaultFortressClass ?? 'natural',
    heroIds: options.heroIds ?? (user.defaultHeroId ? [user.defaultHeroId] : ['vanguard']),
    turretTypes: options.turretTypes ?? (user.defaultTurretType ? [user.defaultTurretType] : ['railgun']),
  };

  // Create session
  const session = await prisma.bossRushSession.create({
    data: {
      userId,
      seed,
      loadoutJson,
    },
  });

  // Create session token
  const sessionToken = await createBossRushToken({
    sessionId: session.id,
    simVersion: SIM_VERSION,
    mode: 'boss_rush',
  });

  return {
    sessionId: session.id,
    sessionToken,
    seed,
    simVersion: SIM_VERSION,
    tickHz: TICK_HZ,
    inventory: {
      gold: user.inventory.gold,
      dust: user.inventory.dust,
    },
    commanderLevel,
    progressionBonuses,
  };
}

/**
 * Finish a Boss Rush session and calculate rewards
 */
export async function finishBossRushSession(
  sessionId: string,
  userId: string,
  data: BossRushFinishRequest
): Promise<{
  verified: boolean;
  rewards?: {
    gold: number;
    dust: number;
    xp: number;
    materials: Record<string, number>;
    levelUp: boolean;
    newLevel?: number;
  };
  rejectReason?: string;
  newInventory?: { gold: number; dust: number };
  newProgression?: {
    level: number;
    xp: number;
    totalXp: number;
    xpToNextLevel: number;
  };
  leaderboardRank?: number;
}> {
  // Verify token
  const tokenData = await verifyBossRushToken(data.sessionToken);
  if (!tokenData || tokenData.sessionId !== sessionId) {
    return { verified: false, rejectReason: 'TOKEN_INVALID' };
  }

  // Get session
  const session = await prisma.bossRushSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    return { verified: false, rejectReason: 'SESSION_NOT_FOUND' };
  }

  if (session.userId !== userId) {
    return { verified: false, rejectReason: 'SESSION_FORBIDDEN' };
  }

  if (session.endedAt) {
    return { verified: false, rejectReason: 'SESSION_ALREADY_FINISHED' };
  }

  // Get user with inventory and progression
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { inventory: true, progression: true },
  });

  if (!user || !user.inventory || !user.progression) {
    return { verified: false, rejectReason: 'USER_NOT_FOUND' };
  }

  // Server-side verification
  const rejectReason = verifyBossRushSubmission(data, {
    seed: session.seed,
    loadoutJson: session.loadoutJson,
  });

  if (rejectReason) {
    await prisma.bossRushSession.update({
      where: { id: sessionId },
      data: {
        endedAt: new Date(),
        verified: false,
        rejectReason,
      },
    });
    return { verified: false, rejectReason };
  }

  // Calculate rewards from summary
  const { summary } = data;
  const rewards = {
    gold: summary.goldEarned,
    dust: Math.floor(summary.dustEarned * 0.25), // Premium currency - 25% of earned dust
    xp: Math.floor(summary.bossesKilled * 30 + summary.totalDamageDealt / 1000),
    materials: summary.materialsEarned,
    levelUp: false,
    newLevel: undefined as number | undefined,
  };

  // Apply rewards
  const newGold = user.inventory.gold + rewards.gold;
  const newDust = user.inventory.dust + rewards.dust;
  const newTotalXp = user.progression.totalXp + rewards.xp;

  // Check for level up
  let newLevel = user.progression.level;
  let xpInCurrentLevel = user.progression.xp + rewards.xp;
  let xpNeeded = getXpForLevel(newLevel);

  while (xpInCurrentLevel >= xpNeeded && newLevel < 100) {
    xpInCurrentLevel -= xpNeeded;
    newLevel++;
    xpNeeded = getXpForLevel(newLevel);
    rewards.levelUp = true;
    rewards.newLevel = newLevel;
  }

  // Update materials in inventory
  const currentMaterials = (user.inventory.materials as Record<string, number>) || {};
  for (const [materialId, amount] of Object.entries(rewards.materials)) {
    currentMaterials[materialId] = (currentMaterials[materialId] || 0) + amount;
  }

  // Update database
  await prisma.$transaction([
    // Update session
    prisma.bossRushSession.update({
      where: { id: sessionId },
      data: {
        endedAt: new Date(),
        verified: true,
        bossesKilled: summary.bossesKilled,
        totalDamageDealt: BigInt(Math.floor(summary.totalDamageDealt)),
        goldEarned: rewards.gold,
        dustEarned: rewards.dust,
        xpEarned: rewards.xp,
        materialsEarned: rewards.materials,
        finalHash: data.finalHash,
      },
    }),
    // Update inventory
    prisma.inventory.update({
      where: { userId },
      data: {
        gold: newGold,
        dust: newDust,
        materials: currentMaterials,
      },
    }),
    // Update progression
    prisma.progression.update({
      where: { userId },
      data: {
        level: newLevel,
        xp: xpInCurrentLevel,
        totalXp: newTotalXp,
      },
    }),
  ]);

  // Update leaderboard
  const weekKey = getCurrentWeekKey();
  await upsertBossRushLeaderboardEntry(
    userId,
    sessionId,
    BigInt(Math.floor(summary.totalDamageDealt)),
    summary.bossesKilled,
    weekKey
  );

  // Get user's rank
  const rankInfo = await getUserBossRushRank(userId, weekKey);

  // Grant Battle Pass points for each boss killed
  if (summary.bossesKilled > 0) {
    await addBattlePassPoints(userId, 'boss_rush', summary.bossesKilled);
  }

  // Update lifetime stats for achievements
  await updateLifetimeStats(userId, {
    bossKills: summary.bossesKilled,
    bossRushCycles: 1,
    damageDealt: Math.floor(summary.totalDamageDealt).toString(),
  });

  return {
    verified: true,
    rewards,
    newInventory: { gold: newGold, dust: newDust },
    newProgression: {
      level: newLevel,
      xp: xpInCurrentLevel,
      totalXp: newTotalXp,
      xpToNextLevel: getXpForLevel(newLevel) - xpInCurrentLevel,
    },
    leaderboardRank: rankInfo?.rank,
  };
}

/**
 * Get boss rush session by ID
 */
export async function getBossRushSession(sessionId: string, userId: string) {
  const session = await prisma.bossRushSession.findUnique({
    where: { id: sessionId },
  });

  if (!session || session.userId !== userId) {
    return null;
  }

  return {
    sessionId: session.id,
    totalDamageDealt: Number(session.totalDamageDealt),
    bossesKilled: session.bossesKilled,
    goldEarned: session.goldEarned,
    dustEarned: session.dustEarned,
    verified: session.verified,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString(),
  };
}

/**
 * Get user's boss rush history
 */
export async function getBossRushHistory(
  userId: string,
  limit: number = 10,
  offset: number = 0
): Promise<{
  sessions: Array<{
    sessionId: string;
    totalDamageDealt: number;
    bossesKilled: number;
    goldEarned: number;
    dustEarned: number;
    verified: boolean;
    startedAt: string;
    endedAt?: string;
  }>;
  total: number;
}> {
  const [sessions, total] = await Promise.all([
    prisma.bossRushSession.findMany({
      where: { userId, endedAt: { not: null } },
      orderBy: { startedAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.bossRushSession.count({
      where: { userId, endedAt: { not: null } },
    }),
  ]);

  return {
    sessions: sessions.map(s => ({
      sessionId: s.id,
      totalDamageDealt: Number(s.totalDamageDealt),
      bossesKilled: s.bossesKilled,
      goldEarned: s.goldEarned,
      dustEarned: s.dustEarned,
      verified: s.verified,
      startedAt: s.startedAt.toISOString(),
      endedAt: s.endedAt?.toISOString(),
    })),
    total,
  };
}
