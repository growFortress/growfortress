import { randomInt } from 'node:crypto';
import { prisma, Prisma } from '../lib/prisma.js';
import { createSessionToken, verifySessionToken } from '../lib/tokens.js';
import {
  SIM_VERSION,
  Simulation,
  getDefaultConfig,
  getXpForLevel,
  getProgressionBonuses,
  createDefaultPlayerPowerData,
} from '@arcade/sim-core';
import type { SessionStartRequest } from '@arcade/protocol';
import { getUserProfile } from './auth.js';
import { upsertLeaderboardEntry } from './leaderboard.js';
import { addWaveContribution } from './guildTowerRace.js';
import { incrementTotalWaves } from './playerLeaderboard.js';
import { applySimConfigSnapshot, buildSimConfigSnapshot } from './simConfig.js';
import { getGameConfig } from './gameConfig.js';
import { getActiveMultipliers } from './events.js';
import { updateQuestsFromRun } from './dailyQuests.js';

/** Simulation tick rate - 30Hz provides smooth gameplay while being computationally manageable */
const TICK_HZ = 30;
/** Number of waves per segment - 5 waves balances verification frequency with gameplay flow */
const SEGMENT_SIZE = 5;
const MAX_SECONDS_PER_WAVE = 60;

/** Custom error class for game session validation errors */
export class GameSessionError extends Error {
  constructor(
    message: string,
    public readonly code: 'SESSION_NOT_FOUND' | 'USER_NOT_FOUND' | 'SESSION_FORBIDDEN' | 'INVALID_LOADOUT' | 'PROGRESSION_NOT_FOUND'
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
  const count = randomInt(2, 4); // 2 or 3 checkpoints

  const ticks: number[] = [];
  for (let i = 0; i < count; i++) {
    ticks.push(randomInt(0, maxTicks));
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
  fortressBaseHp: number;
  fortressBaseDamage: number;
  waveIntervalTicks: number;
  powerData: {
    fortressUpgrades: {
      statUpgrades: {
        hp: number;
        damage: number;
        attackSpeed: number;
        range: number;
        critChance: number;
        critMultiplier: number;
        armor: number;
        dodge: number;
      };
    };
    heroUpgrades: Array<{
      heroId: string;
      statUpgrades: {
        hp: number;
        damage: number;
        attackSpeed: number;
        range: number;
        critChance: number;
        critMultiplier: number;
        armor: number;
        dodge: number;
      };
    }>;
    turretUpgrades: Array<{
      turretType: string;
      statUpgrades: {
        hp: number;
        damage: number;
        attackSpeed: number;
        range: number;
        critChance: number;
        critMultiplier: number;
        armor: number;
        dodge: number;
      };
    }>;
    itemTiers: Array<{
      itemId: string;
      tier: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    }>;
  };
} | null> {
  // Get user profile
  const profile = await getUserProfile(userId);
  if (!profile) {
    return null;
  }

  // Get user's current wave progress (optimized: select only needed fields)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      currentWave: true,
      highestWave: true,
      inventory: {
        select: {
          gold: true,
          dust: true,
        },
      },
    },
  });
  if (!user || !user.inventory) {
    return null;
  }

  // Generate cryptographically secure seed
  const seed = randomInt(0x7FFFFFFF);

  // Get progression bonuses based on commander level
  const commanderLevel = profile.progression.level;
  const bonuses = getProgressionBonuses(commanderLevel);

  // Override slot counts with purchased slots (new system)
  bonuses.maxHeroSlots = profile.progression.purchasedHeroSlots;
  bonuses.maxTurretSlots = profile.progression.purchasedTurretSlots;

  // Get remote config
  const remoteConfig = await getGameConfig();

  // Get power upgrades for the user
  const powerUpgradesRecord = await prisma.powerUpgrades.findUnique({
    where: { userId },
  });

  // Parse power data or use defaults
  const defaultPowerData = createDefaultPlayerPowerData();
  const powerData = powerUpgradesRecord ? {
    fortressUpgrades: JSON.parse(powerUpgradesRecord.fortressUpgrades as string),
    heroUpgrades: JSON.parse(powerUpgradesRecord.heroUpgrades as string),
    turretUpgrades: JSON.parse(powerUpgradesRecord.turretUpgrades as string),
    itemTiers: JSON.parse(powerUpgradesRecord.itemTiers as string),
    // Hero/Turret tier progression (1-3)
    heroTiers: (powerUpgradesRecord.heroTiers as Record<string, number>) || {},
    turretTiers: (powerUpgradesRecord.turretTiers as Record<string, number>) || {},
  } : { ...defaultPowerData, heroTiers: {}, turretTiers: {} };

  // Get equipped artifacts (heroId -> artifactId mapping)
  const equippedArtifactsArray = await prisma.playerArtifact.findMany({
    where: {
      userId,
      equippedToHeroId: { not: null },
    },
    select: {
      artifactId: true,
      equippedToHeroId: true,
    },
  });
  const equippedArtifacts: Record<string, string> = {};
  for (const artifact of equippedArtifactsArray) {
    if (artifact.equippedToHeroId) {
      equippedArtifacts[artifact.equippedToHeroId] = artifact.artifactId;
    }
  }

  const { simConfig } = buildSimConfigSnapshot({
    commanderLevel,
    progressionBonuses: bonuses,
    unlockedHeroes: profile.unlockedHeroes,
    unlockedTurrets: profile.unlockedTurrets,
    equippedArtifacts,
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

  // Atomic session creation - check for existing, end it, and create new in one transaction
  const gameSession = await prisma.$transaction(async (tx) => {
    // Re-fetch user within transaction to get accurate activeGameSessionId
    const currentUser = await tx.user.findUnique({
      where: { id: userId },
      select: { activeGameSessionId: true, currentWave: true },
    });

    // End any existing active session within the transaction
    if (currentUser?.activeGameSessionId) {
      await tx.gameSession.update({
        where: { id: currentUser.activeGameSessionId },
        data: {
          endedAt: new Date(),
          endReason: 'new_session_started',
        },
      });
    }

    // Create new game session
    const session = await tx.gameSession.create({
      data: {
        userId,
        seed,
        startingWave: currentUser?.currentWave ?? user.currentWave,
        currentWave: currentUser?.currentWave ?? user.currentWave,
        configJson: simConfig as any,
      },
    });

    // Update user's active session
    await tx.user.update({
      where: { id: userId },
      data: { activeGameSessionId: session.id },
    });

    return session;
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
    // Power upgrades data for permanent stat bonuses
    powerData,
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

  // Get session (optimized: select only needed fields for verification)
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      seed: true,
      lastVerifiedWave: true,
      endedAt: true,
      user: {
        select: {
          id: true,
          highestWave: true,
          inventory: {
            select: { gold: true, dust: true, materials: true },
          },
          progression: {
            select: { level: true, xp: true, totalXp: true },
          },
        },
      },
    },
  });

  if (!session || session.endedAt) {
    return null;
  }

  if (session.userId !== userId || tokenPayload.userId !== userId) {
    throw new GameSessionError('Session does not belong to user', 'SESSION_FORBIDDEN');
  }

  // Validate required relations exist
  if (!session.user.inventory || !session.user.progression) {
    return createRejectionResponse(
      'User data incomplete',
      { gold: 0, dust: 0 },
      { level: 1, xp: 0, totalXp: 0 }
    );
  }

  // Extract validated references for type safety
  const inventory = session.user.inventory;
  const progression = session.user.progression;

  // Validate segment boundaries
  if (startWave !== session.lastVerifiedWave) {
    return createRejectionResponse(
      'Invalid segment start wave',
      { gold: inventory.gold, dust: inventory.dust },
      { level: progression.level, xp: progression.xp, totalXp: progression.totalXp }
    );
  }

  if (tokenPayload.simVersion !== SIM_VERSION) {
    return createRejectionResponse(
      'SIM_VERSION_MISMATCH',
      { gold: inventory.gold, dust: inventory.dust },
      { level: progression.level, xp: progression.xp, totalXp: progression.totalXp }
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
      { gold: inventory.gold, dust: inventory.dust },
      { level: progression.level, xp: progression.xp, totalXp: progression.totalXp }
    );
  }

  if (sim.state.tick >= maxTicks) {
    return createRejectionResponse(
      'SEGMENT_TICK_CAP',
      { gold: inventory.gold, dust: inventory.dust },
      { level: progression.level, xp: progression.xp, totalXp: progression.totalXp }
    );
  }

  const computedEndWave = sim.state.wave;
  if (computedEndWave !== endWave) {
    return createRejectionResponse(
      'END_WAVE_MISMATCH',
      { gold: inventory.gold, dust: inventory.dust },
      { level: progression.level, xp: progression.xp, totalXp: progression.totalXp }
    );
  }

  // Verify final hash
  const computedHash = sim.getFinalHash();
  if (computedHash !== finalHash) {
    return createRejectionResponse(
      'Hash mismatch',
      { gold: inventory.gold, dust: inventory.dust },
      { level: progression.level, xp: progression.xp, totalXp: progression.totalXp }
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
        materialsJson: materialsEarned as Prisma.InputJsonValue,
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
    let newXp = progression.xp + xpEarned;
    let newLevel = progression.level;
    const newTotalXp = progression.totalXp + xpEarned;

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
  newInventory: { gold: number; dust: number };
  newProgression: { level: number; xp: number; totalXp: number; xpToNextLevel: number };
} | null> {
  // Optimized: select only needed fields for session end
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      currentWave: true,
      startingWave: true,
      segments: {
        select: { goldEarned: true, dustEarned: true, xpEarned: true },
      },
      user: {
        select: { id: true, highestWave: true },
      },
    },
  });

  if (!session) {
    return null;
  }

  if (session.userId !== userId) {
    throw new GameSessionError('Session does not belong to user', 'SESSION_FORBIDDEN');
  }

  // Fetch current progression for level-up calculation
  const currentProgression = await prisma.progression.findUnique({
    where: { userId: session.userId },
    select: { level: true, xp: true, totalXp: true },
  });

  if (!currentProgression) {
    throw new GameSessionError('User progression not found', 'PROGRESSION_NOT_FOUND');
  }

  // Calculate totals from verified segments
  let totalGoldEarned = session.segments.reduce((sum, s) => sum + s.goldEarned, 0);
  let totalDustEarned = session.segments.reduce((sum, s) => sum + s.dustEarned, 0);
  let totalXpEarned = session.segments.reduce((sum, s) => sum + s.xpEarned, 0);
  let finalWave = session.currentWave;

  const sanitizedPartialRewards = sanitizePartialRewards(partialRewards, session.currentWave);

  // Calculate XP to apply from partial rewards (with multipliers)
  let partialXpToApply = 0;
  let partialGoldToApply = 0;
  let partialDustToApply = 0;

  // Add partial rewards (from incomplete segment)
  if (sanitizedPartialRewards) {
    const eventMultipliers = await getActiveMultipliers();
    partialGoldToApply = Math.floor(sanitizedPartialRewards.gold * eventMultipliers.gold);
    partialDustToApply = Math.floor(sanitizedPartialRewards.dust * eventMultipliers.dust);
    partialXpToApply = Math.floor(sanitizedPartialRewards.xp * eventMultipliers.xp);
    totalGoldEarned += partialGoldToApply;
    totalDustEarned += partialDustToApply;
    totalXpEarned += partialXpToApply;
    finalWave = Math.max(finalWave, sanitizedPartialRewards.finalWave);
  }

  // Calculate new progression with level-ups
  let newXp = currentProgression.xp + partialXpToApply;
  let newLevel = currentProgression.level;
  const newTotalXp = currentProgression.totalXp + partialXpToApply;

  // Level up while we have enough XP
  while (newXp >= getXpForLevel(newLevel)) {
    newXp -= getXpForLevel(newLevel);
    newLevel++;
  }

  // Update session, user wave progress, inventory, progression, and clear active session
  const result = await prisma.$transaction(async (tx) => {
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
    if (partialGoldToApply > 0 || partialDustToApply > 0) {
      await tx.inventory.update({
        where: { userId: session.userId },
        data: {
          gold: { increment: partialGoldToApply },
          dust: { increment: partialDustToApply },
        },
      });
    }

    // Update progression with level-up calculation
    const updatedProgression = await tx.progression.update({
      where: { userId: session.userId },
      data: {
        level: newLevel,
        xp: newXp,
        totalXp: newTotalXp,
      },
    });

    // Fetch updated inventory
    const updatedInventory = await tx.inventory.findUnique({
      where: { userId: session.userId },
      select: { gold: true, dust: true },
    });

    return { updatedInventory, updatedProgression };
  });

  // Update leaderboard with final wave as score
  await upsertLeaderboardEntry(session.userId, sessionId, finalWave);

  // Add waves cleared to guild tower race (if user is in a guild)
  const wavesCleared = finalWave - session.startingWave;
  if (wavesCleared > 0) {
    await addWaveContribution(session.userId, wavesCleared);
    // Update player's total waves for permanent leaderboard
    await incrementTotalWaves(session.userId, wavesCleared);
  }

  // Update daily quest progress
  // Note: Run completed counts for 'first_blood' quest
  // Wave count approximated from waves cleared for 'wave_hunter' quest
  // (actual enemy kills would require simulation state tracking)
  await updateQuestsFromRun(session.userId, {
    runsCompleted: 1,
    enemiesKilled: wavesCleared * 15, // Approximate: ~15 enemies per wave
    elitesKilled: Math.floor(wavesCleared / 5), // Approximate: ~1 elite per 5 waves
  });

  return {
    finalWave,
    totalGoldEarned,
    totalDustEarned,
    totalXpEarned,
    newInventory: {
      gold: result.updatedInventory?.gold ?? 0,
      dust: result.updatedInventory?.dust ?? 0,
    },
    newProgression: {
      level: result.updatedProgression.level,
      xp: result.updatedProgression.xp,
      totalXp: result.updatedProgression.totalXp,
      xpToNextLevel: getXpForLevel(result.updatedProgression.level) - result.updatedProgression.xp,
    },
  };
}

/**
 * Get active session for user
 */
export async function getActiveSession(userId: string): Promise<{
  sessionId: string;
  currentWave: number;
  startedAt: string;
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
    startedAt: session.startedAt.toISOString(),
  };
}
