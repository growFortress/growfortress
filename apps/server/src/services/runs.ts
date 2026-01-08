import { prisma, Prisma } from '../lib/prisma.js';
import { createRunToken } from '../lib/tokens.js';
import { SIM_VERSION } from '@arcade/sim-core';
import { getUserProfile, getProgressionBonuses } from './auth.js';
import { buildSimConfigSnapshot } from './simConfig.js';
import { getGameConfig } from './gameConfig.js';

const TICK_HZ = 30;
const MAX_WAVES = 10;

/**
 * Generate random audit ticks
 */
function generateAuditTicks(maxWaves: number, tickHz: number): number[] {
  const maxTicks = maxWaves * 10 * tickHz; // ~10 sec per wave estimate
  const count = 3 + Math.floor(Math.random() * 3); // 3-5 ticks

  const ticks: number[] = [];
  for (let i = 0; i < count; i++) {
    ticks.push(Math.floor(Math.random() * maxTicks));
  }

  return ticks.sort((a, b) => a - b);
}

/**
 * Start a new run
 */
export async function startRun(userId: string): Promise<{
  runId: string;
  runToken: string;
  seed: number;
  simVersion: number;
  tickHz: number;
  maxWaves: number;
  auditTicks: number[];
  progressionBonuses: {
    damageMultiplier: number;
    goldMultiplier: number;
    startingGold: number;
    maxHeroSlots: number;
    maxTurretSlots: number;
  };
} | null> {
  // Get user profile for unlocks and progression
  const profile = await getUserProfile(userId);
  if (!profile) {
    return null;
  }

  // Generate seed (deterministic for the run) - use signed 32-bit range for PostgreSQL INT4
  const seed = Math.floor(Math.random() * 0x7FFFFFFF);

  // Generate audit ticks
  const auditTicks = generateAuditTicks(MAX_WAVES, TICK_HZ);

  // Get remote config
  const remoteConfig = await getGameConfig();

  // Get progression bonuses
  const bonuses = getProgressionBonuses(profile.progression.level);
  const progressionBonuses = {
    damageMultiplier: bonuses.damageMultiplier,
    goldMultiplier: bonuses.goldMultiplier,
    startingGold: bonuses.startingGold,
    maxHeroSlots: bonuses.maxHeroSlots,
    maxTurretSlots: bonuses.maxTurretSlots,
  };

  const { simConfig } = buildSimConfigSnapshot({
    commanderLevel: profile.progression.level,
    progressionBonuses: bonuses,
    unlockedHeroes: profile.unlockedHeroes,
    unlockedTurrets: profile.unlockedTurrets,
    defaults: profile.defaultLoadout,
    remoteConfig: {
        fortressBaseHp: remoteConfig.fortressBaseHp ?? 100,
        fortressBaseDamage: remoteConfig.fortressBaseDamage ?? 10,
        waveIntervalTicks: remoteConfig.waveIntervalTicks ?? 90,
    }
  });

  // Create run in database
  const run = await prisma.run.create({
    data: {
      userId,
      seed,
      simVersion: SIM_VERSION,
      tickHz: TICK_HZ,
      maxWaves: MAX_WAVES,
      auditTicks,
      configJson: simConfig as any,
    },
  });

  // Create run token
  const runToken = await createRunToken({
    runId: run.id,
    userId,
    seed,
    simVersion: SIM_VERSION,
    tickHz: TICK_HZ,
    maxWaves: MAX_WAVES,
    auditTicks,
    simConfig,
  });

  return {
    runId: run.id,
    runToken,
    seed,
    simVersion: SIM_VERSION,
    tickHz: TICK_HZ,
    maxWaves: MAX_WAVES,
    auditTicks,
    progressionBonuses,
  };
}

/**
 * Get run by ID
 */
export async function getRun(runId: string): Promise<{
  id: string;
  userId: string;
  seed: number;
  simVersion: number;
  tickHz: number;
  maxWaves: number;
  auditTicks: number[];
  issuedAt: Date;
  endedAt: Date | null;
  verified: boolean | null;
} | null> {
  const run = await prisma.run.findUnique({
    where: { id: runId },
  });

  if (!run) return null;

  return {
    id: run.id,
    userId: run.userId,
    seed: run.seed,
    simVersion: run.simVersion,
    tickHz: run.tickHz,
    maxWaves: run.maxWaves,
    auditTicks: run.auditTicks,
    issuedAt: run.issuedAt,
    endedAt: run.endedAt,
    verified: run.verified,
  };
}

/**
 * Check if run is within TTL
 */
export function isRunWithinTTL(issuedAt: Date, ttlSeconds: number = 600): boolean {
  const now = Date.now();
  const issuedAtMs = issuedAt.getTime();
  return now - issuedAtMs < ttlSeconds * 1000;
}

/**
 * Mark run as finished
 */
export async function finishRun(
  runId: string,
  verified: boolean,
  rejectReason: string | null,
  finalHash: number,
  score: number,
  summary: Record<string, unknown>
): Promise<void> {
  await prisma.run.update({
    where: { id: runId },
    data: {
      endedAt: new Date(),
      verified,
      rejectReason,
      finalHash,
      score,
      summaryJson: summary as Prisma.InputJsonValue,
    },
  });
}

/**
 * Save run events
 */
export async function saveRunEvents(
  runId: string,
  events: unknown[]
): Promise<void> {
  await prisma.runEvent.create({
    data: {
      runId,
      data: events as Prisma.InputJsonValue,
    },
  });
}

/**
 * Get run history for a user
 */
export async function getRunHistory(
  userId: string,
  limit = 20,
  offset = 0
): Promise<{
  runs: Array<{
    id: string;
    seed: number;
    score: number | null;
    verified: boolean | null;
    startedAt: Date;
    endedAt: Date | null;
    finalWave: number | null;
  }>;
  total: number;
}> {
  const [runs, total] = await Promise.all([
    prisma.run.findMany({
      where: { userId },
      orderBy: { issuedAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        seed: true,
        score: true,
        verified: true,
        issuedAt: true,
        endedAt: true,
        summaryJson: true,
      },
    }),
    prisma.run.count({ where: { userId } }),
  ]);

  return {
    runs: runs.map(run => ({
      id: run.id,
      seed: run.seed,
      score: run.score,
      verified: run.verified,
      startedAt: run.issuedAt,
      endedAt: run.endedAt,
      finalWave: run.summaryJson && typeof run.summaryJson === 'object' && 'finalWave' in run.summaryJson
        ? (run.summaryJson as { finalWave: number }).finalWave
        : null,
    })),
    total,
  };
}

/**
 * Get run details by ID
 */
export async function getRunDetails(
  runId: string,
  userId: string
): Promise<{
  id: string;
  seed: number;
  simVersion: number;
  tickHz: number;
  maxWaves: number;
  auditTicks: number[];
  startedAt: Date;
  endedAt: Date | null;
  verified: boolean | null;
  rejectReason: string | null;
  score: number | null;
  summary: Record<string, unknown> | null;
} | null> {
  const run = await prisma.run.findFirst({
    where: { id: runId, userId },
  });

  if (!run) return null;

  return {
    id: run.id,
    seed: run.seed,
    simVersion: run.simVersion,
    tickHz: run.tickHz,
    maxWaves: run.maxWaves,
    auditTicks: run.auditTicks,
    startedAt: run.issuedAt,
    endedAt: run.endedAt,
    verified: run.verified,
    rejectReason: run.rejectReason,
    score: run.score,
    summary: run.summaryJson as Record<string, unknown> | null,
  };
}

/**
 * Get player stats
 */
export async function getPlayerStats(userId: string): Promise<{
  totalRuns: number;
  verifiedRuns: number;
  highestScore: number;
  highestWave: number;
  totalGoldEarned: number;
  totalDustEarned: number;
  totalKills: number;
  averageScore: number;
} | null> {
  const runs = await prisma.run.findMany({
    where: { userId, verified: true },
    select: {
      score: true,
      summaryJson: true,
    },
  });

  if (runs.length === 0) {
    return {
      totalRuns: 0,
      verifiedRuns: 0,
      highestScore: 0,
      highestWave: 0,
      totalGoldEarned: 0,
      totalDustEarned: 0,
      totalKills: 0,
      averageScore: 0,
    };
  }

  let highestScore = 0;
  let highestWave = 0;
  let totalGold = 0;
  let totalDust = 0;
  let totalKills = 0;
  let totalScore = 0;

  for (const run of runs) {
    if (run.score && run.score > highestScore) {
      highestScore = run.score;
    }
    totalScore += run.score || 0;

    if (run.summaryJson && typeof run.summaryJson === 'object') {
      const summary = run.summaryJson as Record<string, number>;
      if (summary.finalWave && summary.finalWave > highestWave) {
        highestWave = summary.finalWave;
      }
      totalGold += summary.goldEarned || 0;
      totalDust += summary.dustEarned || 0;
      totalKills += summary.totalKills || 0;
    }
  }

  const totalRuns = await prisma.run.count({ where: { userId } });

  return {
    totalRuns,
    verifiedRuns: runs.length,
    highestScore,
    highestWave,
    totalGoldEarned: totalGold,
    totalDustEarned: totalDust,
    totalKills,
    averageScore: runs.length > 0 ? Math.round(totalScore / runs.length) : 0,
  };
}
