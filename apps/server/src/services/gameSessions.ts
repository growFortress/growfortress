import { prisma, Prisma } from '../lib/prisma.js';
import { createSessionToken, verifySessionToken } from '../lib/tokens.js';
import {
  SIM_VERSION,
  Simulation,
  getDefaultConfig,
  getXpForLevel,
  getProgressionBonuses,
} from '@arcade/sim-core';
import type { SessionStartRequest } from '@arcade/protocol';
import { getUserProfile } from './auth.js';
import { upsertLeaderboardEntry } from './leaderboard.js';
import { applySimConfigSnapshot, buildSimConfigSnapshot } from './simConfig.js';
import { getGameConfig } from './gameConfig.js';
import { getActiveMultipliers } from './events.js';

/** Simulation tick rate - 30Hz provides smooth gameplay while being computationally manageable */
const TICK_HZ = 30;
/** Number of waves per segment - 5 waves balances verification frequency with gameplay flow */
const SEGMENT_SIZE = 5;
const MAX_SECONDS_PER_WAVE = 60;

/** Custom error class for game session validation errors */
export class GameSessionError extends Error {
  constructor(
    message: string,
    public readonly code: 'SESSION_NOT_FOUND' | 'USER_NOT_FOUND' | 'SESSION_FORBIDDEN' | 'INVALID_LOADOUT'
  ) {
    super(message);
    this.name = 'GameSessionError';
  }
}

/** Creates a standardized segment rejection response */
function createRejectionResponse(
  reason: string,
  inventory: { gold: number; dust: number } = { gold: 0, dust: 0 },
  progression: { level: number; xp: number; totalXp: number } = { level: 1, xp: 0, totalXp: 0 }
) {
  return {
    verified: false,
    rejectReason: reason,
    goldEarned: 0,
    dustEarned: 0,
    xpEarned: 0,
    nextSegmentAuditTicks: [] as number[],
    newInventory: inventory,
    newProgression: {
      level: progression.level,
      xp: progression.xp,
      totalXp: progression.totalXp,
      xpToNextLevel: getXpForLevel(progression.level) - progression.xp,
    },
  };
}

const MAX_PARTIAL_REWARD = 1_000_000;
const MAX_PARTIAL_WAVE_ADVANCE = SEGMENT_SIZE;

function isValidRewardNumber(value: number): boolean {
  return Number.isFinite(value) && Number.isSafeInteger(value) && value >= 0;
}

function sanitizePartialRewards(
  partialRewards: { gold: number; dust: number; xp: number; finalWave: number } | undefined,
  currentWave: number
): { gold: number; dust: number; xp: number; finalWave: number } | undefined {
  if (!partialRewards) return undefined;

  const { gold, dust, xp, finalWave } = partialRewards;

  if (
    !isValidRewardNumber(gold) ||
    !isValidRewardNumber(dust) ||
    !isValidRewardNumber(xp) ||
    !isValidRewardNumber(finalWave)
  ) {
    return undefined;
  }

  if (
    gold > MAX_PARTIAL_REWARD ||
    dust > MAX_PARTIAL_REWARD ||
    xp > MAX_PARTIAL_REWARD
  ) {
    return undefined;
  }

  if (finalWave > currentWave + MAX_PARTIAL_WAVE_ADVANCE) {
    return undefined;
  }

  return partialRewards;
}

/**
 * Generate random audit ticks for a segment
 */
function generateSegmentAuditTicks(segmentSize: number, tickHz: number): number[] {
  // Estimate max ticks: ~10 seconds per wave × waves per segment × tick rate
  const maxTicks = segmentSize * 10 * tickHz;
  // Generate 2-3 random audit checkpoints per segment for cheat detection
  const count = 2 + Math.floor(Math.random() * 2);

  const ticks: number[] = [];
  for (let i = 0; i < count; i++) {
    ticks.push(Math.floor(Math.random() * maxTicks));
  }

  return ticks.sort((a, b) => a - b);
}

/**
 * Start a new endless game session or resume existing one
 */
export async function startGameSession(
  userId: string,
  options: SessionStartRequest = {}
): Promise<{
  sessionId: string;
  sessionToken: string;
  seed: number;
  simVersion: number;
  tickHz: number;
  startingWave: number;
  segmentAuditTicks: number[];
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

  // Get user's current wave progress
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { inventory: true },
  });
  if (!user || !user.inventory) {
    return null;
  }

  // Check for existing active session
  if (user.activeGameSessionId) {
    // End the previous session first
    await endGameSession(user.activeGameSessionId, userId, 'new_session_started');
  }

  // Generate seed
  const seed = Math.floor(Math.random() * 0x7FFFFFFF);

  // Get progression bonuses based on commander level
  const commanderLevel = profile.progression.level;
  const bonuses = getProgressionBonuses(commanderLevel);

  // Get remote config
  const remoteConfig = await getGameConfig();

  const { simConfig } = buildSimConfigSnapshot({
    commanderLevel,
    progressionBonuses: bonuses,
    unlockedHeroes: profile.unlockedHeroes,
    unlockedTurrets: profile.unlockedTurrets,
    requested: {
      fortressClass: options.fortressClass,
      startingHeroes: options.startingHeroes,
      startingTurrets: options.startingTurrets,
    },
    defaults: profile.defaultLoadout,
    remoteConfig: {
        fortressBaseHp: remoteConfig.fortressBaseHp ?? 100,
        fortressBaseDamage: remoteConfig.fortressBaseDamage ?? 10,
        waveIntervalTicks: remoteConfig.waveIntervalTicks ?? 90,
    }
  });

  // Create game session
  const gameSession = await prisma.gameSession.create({
    data: {
      userId,
      seed,
      startingWave: user.currentWave,
      currentWave: user.currentWave,
      configJson: simConfig as any,
    },
  });

  // Update user's active session
  await prisma.user.update({
    where: { id: userId },
    data: { activeGameSessionId: gameSession.id },
  });

  // Generate audit ticks for first segment
  const segmentAuditTicks = generateSegmentAuditTicks(SEGMENT_SIZE, TICK_HZ);

  // Create session token
  const sessionToken = await createSessionToken({
    sessionId: gameSession.id,
    userId,
    seed,
    simVersion: SIM_VERSION,
    startingWave: user.currentWave,
    segmentAuditTicks,
    simConfig,
  });

  return {
    sessionId: gameSession.id,
    sessionToken,
    seed,
    simVersion: SIM_VERSION,
    tickHz: TICK_HZ,
    startingWave: user.currentWave,
    segmentAuditTicks,
    inventory: {
      gold: user.inventory.gold,
      dust: user.inventory.dust,
    },
    commanderLevel,
    progressionBonuses: {
      damageMultiplier: bonuses.damageMultiplier,
      goldMultiplier: bonuses.goldMultiplier,
      startingGold: bonuses.startingGold,
      maxHeroSlots: bonuses.maxHeroSlots,
      maxTurretSlots: bonuses.maxTurretSlots,
    },
    // Remote config values for simulation determinism
    fortressBaseHp: simConfig.fortressBaseHp,
    fortressBaseDamage: simConfig.fortressBaseDamage,
    waveIntervalTicks: simConfig.waveIntervalTicks,
  };
}

/**
 * Submit a segment for verification
 */
export async function submitSegment(
  userId: string,
  sessionId: string,
  sessionToken: string,
  startWave: number,
  endWave: number,
  events: unknown[],
  checkpoints: unknown[],
  finalHash: number
): Promise<{
  verified: boolean;
  rejectReason?: string;
  goldEarned: number;
  dustEarned: number;
  xpEarned: number;
  materialsEarned?: Record<string, number>;
  nextSegmentAuditTicks: number[];
  newInventory: { gold: number; dust: number; materials?: Record<string, number> };
  newProgression: { level: number; xp: number; totalXp: number; xpToNextLevel: number };
} | null> {
  // Verify session token
  const tokenPayload = await verifySessionToken(sessionToken);
  if (!tokenPayload || tokenPayload.sessionId !== sessionId) {
    return null;
  }

  // Get session
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { user: { include: { inventory: true, progression: true } } },
  });

  if (!session || session.endedAt) {
    return null;
  }

  if (session.userId !== userId || tokenPayload.userId !== userId) {
    throw new GameSessionError('Session does not belong to user', 'SESSION_FORBIDDEN');
  }

  // Validate segment boundaries
  if (startWave !== session.lastVerifiedWave) {
    return createRejectionResponse(
      'Invalid segment start wave',
      { gold: session.user.inventory!.gold, dust: session.user.inventory!.dust },
      { level: session.user.progression!.level, xp: session.user.progression!.xp, totalXp: session.user.progression!.totalXp }
    );
  }

  if (tokenPayload.simVersion !== SIM_VERSION) {
    return createRejectionResponse(
      'SIM_VERSION_MISMATCH',
      { gold: session.user.inventory!.gold, dust: session.user.inventory!.dust },
      { level: session.user.progression!.level, xp: session.user.progression!.xp, totalXp: session.user.progression!.totalXp }
    );
  }

  // Replay and verify segment
  let sim: Simulation;
  const targetWave = startWave + SEGMENT_SIZE;
  const maxTicks = SEGMENT_SIZE * TICK_HZ * MAX_SECONDS_PER_WAVE;
  try {
    const config = getDefaultConfig();
    applySimConfigSnapshot(config, tokenPayload.simConfig);
    config.startingWave = startWave;
    config.segmentSize = SEGMENT_SIZE;
    config.tickHz = TICK_HZ;

    sim = new Simulation(session.seed, config);
    sim.setEvents(events as any[]);
    sim.setAuditTicks(tokenPayload.segmentAuditTicks);

    // Run simulation until we reach end wave or game ends
    while (
      !sim.state.ended &&
      sim.state.wave < targetWave &&
      sim.state.tick < maxTicks
    ) {
      sim.step();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown simulation error';
    return createRejectionResponse(
      `Simulation replay failed: ${message}`,
      { gold: session.user.inventory!.gold, dust: session.user.inventory!.dust },
      { level: session.user.progression!.level, xp: session.user.progression!.xp, totalXp: session.user.progression!.totalXp }
    );
  }

  if (sim.state.tick >= maxTicks) {
    return createRejectionResponse(
      'SEGMENT_TICK_CAP',
      { gold: session.user.inventory!.gold, dust: session.user.inventory!.dust },
      { level: session.user.progression!.level, xp: session.user.progression!.xp, totalXp: session.user.progression!.totalXp }
    );
  }

  const computedEndWave = sim.state.wave;
  if (computedEndWave !== endWave) {
    return createRejectionResponse(
      'END_WAVE_MISMATCH',
      { gold: session.user.inventory!.gold, dust: session.user.inventory!.dust },
      { level: session.user.progression!.level, xp: session.user.progression!.xp, totalXp: session.user.progression!.totalXp }
    );
  }

  // Verify final hash
  const computedHash = sim.getFinalHash();
  if (computedHash !== finalHash) {
    return createRejectionResponse(
      'Hash mismatch',
      { gold: session.user.inventory!.gold, dust: session.user.inventory!.dust },
      { level: session.user.progression!.level, xp: session.user.progression!.xp, totalXp: session.user.progression!.totalXp }
    );
  }

  // Segment verified - apply rewards
  const eventMultipliers = await getActiveMultipliers();
  
  const goldEarned = Math.floor(sim.state.segmentGoldEarned * eventMultipliers.gold);
  const dustEarned = Math.floor(sim.state.segmentDustEarned * eventMultipliers.dust);
  const xpEarned = Math.floor(sim.state.segmentXpEarned * eventMultipliers.xp);
  const materialsEarned = sim.state.segmentMaterialsEarned || {};

  // Update inventory and session in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create segment record
    await tx.segment.create({
      data: {
        gameSessionId: sessionId,
        startWave,
        endWave: computedEndWave,
        eventsJson: events as Prisma.InputJsonValue,
        checkpointsJson: checkpoints as Prisma.InputJsonValue,
        finalHash,
        verified: true,
        verifiedAt: new Date(),
        goldEarned,
        dustEarned,
        xpEarned,
      },
    });

    // Update session
    await tx.gameSession.update({
      where: { id: sessionId },
      data: {
        currentWave: computedEndWave,
        lastVerifiedWave: computedEndWave,
        lastSegmentHash: finalHash,
        lastActivityAt: new Date(),
      },
    });

    // Update user's wave progress
    const newHighestWave = Math.max(session.user.highestWave, computedEndWave);
    await tx.user.update({
      where: { id: session.userId },
      data: {
        currentWave: computedEndWave,
        highestWave: newHighestWave,
      },
    });

    // Update inventory (gold & dust)
    let newInventory = await tx.inventory.update({
      where: { userId: session.userId },
      data: {
        gold: { increment: goldEarned },
        dust: { increment: dustEarned },
      },
    });

    // Merge materials if any were earned
    if (Object.keys(materialsEarned).length > 0) {
      const currentMaterials = (newInventory.materials as Record<string, number>) || {};
      const updatedMaterials = { ...currentMaterials };

      for (const [materialId, amount] of Object.entries(materialsEarned)) {
        updatedMaterials[materialId] = (updatedMaterials[materialId] || 0) + amount;
      }

      newInventory = await tx.inventory.update({
        where: { userId: session.userId },
        data: {
          materials: updatedMaterials,
        },
      });
    }

    // Calculate new progression with level-ups
    let newXp = session.user.progression!.xp + xpEarned;
    let newLevel = session.user.progression!.level;
    const newTotalXp = session.user.progression!.totalXp + xpEarned;

    // Level up while we have enough XP (XP needed is for current level, not next)
    while (newXp >= getXpForLevel(newLevel)) {
      newXp -= getXpForLevel(newLevel);
      newLevel++;
    }

    // Update progression
    const newProgression = await tx.progression.update({
      where: { userId: session.userId },
      data: {
        level: newLevel,
        xp: newXp,
        totalXp: newTotalXp,
      },
    });

    return {
      newInventory,
      newProgression: {
        level: newProgression.level,
        xp: newProgression.xp,
        totalXp: newProgression.totalXp,
        xpToNextLevel: getXpForLevel(newProgression.level) - newProgression.xp,
      },
    };
  });

  // Generate next segment audit ticks
  const nextSegmentAuditTicks = generateSegmentAuditTicks(SEGMENT_SIZE, TICK_HZ);

  return {
    verified: true,
    goldEarned,
    dustEarned,
    xpEarned,
    materialsEarned,
    nextSegmentAuditTicks,
    newInventory: {
      gold: result.newInventory.gold,
      dust: result.newInventory.dust,
      materials: (result.newInventory.materials as Record<string, number>) || {},
    },
    newProgression: result.newProgression,
  };
}

/**
 * End a game session with partial rewards
 */
export async function endGameSession(
  sessionId: string,
  userId: string,
  reason: string = 'manual',
  partialRewards?: { gold: number; dust: number; xp: number; finalWave: number }
): Promise<{
  finalWave: number;
  totalGoldEarned: number;
  totalDustEarned: number;
  totalXpEarned: number;
} | null> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: {
      segments: true,
      user: true,
    },
  });

  if (!session) {
    return null;
  }

  if (session.userId !== userId) {
    throw new GameSessionError('Session does not belong to user', 'SESSION_FORBIDDEN');
  }

  // Calculate totals from verified segments
  let totalGoldEarned = session.segments.reduce((sum, s) => sum + s.goldEarned, 0);
  let totalDustEarned = session.segments.reduce((sum, s) => sum + s.dustEarned, 0);
  let totalXpEarned = session.segments.reduce((sum, s) => sum + s.xpEarned, 0);
  let finalWave = session.currentWave;

  const sanitizedPartialRewards = sanitizePartialRewards(partialRewards, session.currentWave);

  // Add partial rewards (from incomplete segment)
  if (sanitizedPartialRewards) {
    const eventMultipliers = await getActiveMultipliers();
    totalGoldEarned += Math.floor(sanitizedPartialRewards.gold * eventMultipliers.gold);
    totalDustEarned += Math.floor(sanitizedPartialRewards.dust * eventMultipliers.dust);
    totalXpEarned += Math.floor(sanitizedPartialRewards.xp * eventMultipliers.xp);
    finalWave = Math.max(finalWave, sanitizedPartialRewards.finalWave);
  }

  // Update session, user wave progress, inventory, and clear active session
  await prisma.$transaction(async (tx) => {
    // Update session
    await tx.gameSession.update({
      where: { id: sessionId },
      data: {
        endedAt: new Date(),
        endReason: reason,
        currentWave: finalWave,
      },
    });

    // Update user's wave progress and clear active session
    const newHighestWave = Math.max(session.user.highestWave, finalWave);
    await tx.user.update({
      where: { id: session.userId },
      data: {
        activeGameSessionId: null,
        currentWave: finalWave,
        highestWave: newHighestWave,
      },
    });

    // Apply partial rewards to inventory
    if (sanitizedPartialRewards && (sanitizedPartialRewards.gold > 0 || sanitizedPartialRewards.dust > 0)) {
      await tx.inventory.update({
        where: { userId: session.userId },
        data: {
          gold: { increment: sanitizedPartialRewards.gold },
          dust: { increment: sanitizedPartialRewards.dust },
        },
      });
    }

    // Apply XP to progression
    if (sanitizedPartialRewards && sanitizedPartialRewards.xp > 0) {
      await tx.progression.update({
        where: { userId: session.userId },
        data: {
          xp: { increment: sanitizedPartialRewards.xp },
          totalXp: { increment: sanitizedPartialRewards.xp },
        },
      });
    }
  });

  // Update leaderboard with final wave as score
  await upsertLeaderboardEntry(session.userId, sessionId, finalWave);

  return {
    finalWave,
    totalGoldEarned,
    totalDustEarned,
    totalXpEarned,
  };
}

/**
 * Get active session for user
 */
export async function getActiveSession(userId: string): Promise<{
  sessionId: string;
  currentWave: number;
  startedAt: Date;
} | null> {
  // Get user and their active session in optimized fashion
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { activeGameSessionId: true },
  });

  if (!user?.activeGameSessionId) {
    return null;
  }

  const session = await prisma.gameSession.findUnique({
    where: { id: user.activeGameSessionId },
  });
  if (!session || session.endedAt) {
    return null;
  }

  return {
    sessionId: session.id,
    currentWave: session.currentWave,
    startedAt: session.startedAt,
  };
}
