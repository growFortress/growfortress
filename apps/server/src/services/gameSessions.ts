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
  type PillarId,
} from '@arcade/sim-core';
import {
  GameEventSchema,
  PowerDataSchema,
  normalizeHeroId,
  type PowerData,
  type SessionStartRequest,
} from '@arcade/protocol';
import { getUserProfile } from './auth.js';
import { upsertLeaderboardEntry } from './leaderboard.js';
import { addWaveContribution } from './guildTowerRace.js';
import { incrementTotalWaves } from './playerLeaderboard.js';
import { applySimConfigSnapshot, buildSimConfigSnapshot } from './simConfig.js';
import { getGameConfig } from './gameConfig.js';
import { getActiveMultipliers } from './events.js';
import { getUserGuildBonuses } from './guild.js';
import { consumeEnergy } from './energy.js';
import { ENERGY_ERROR_CODES } from '@arcade/protocol';
import { getUnlockedPillarsForUser } from './pillarUnlocks.js';
import { updateLifetimeStats } from './achievements.js';
import { batchUpdateMissionProgress } from './missions.js';
import { awardWaveStatPoints, awardLevelUpStatPoints } from './stat-points.js';
import { invalidateHubPreviewCache } from './hubPreview.js';

/** Simulation tick rate - 30Hz provides smooth gameplay while being computationally manageable */
const TICK_HZ = 30;
/** Number of waves per segment - 5 waves balances verification frequency with gameplay flow */
const SEGMENT_SIZE = 5;
const MAX_SECONDS_PER_WAVE = 60;

/** Custom error class for game session validation errors */
export class GameSessionError extends Error {
  constructor(
    message: string,
    public readonly code: 'SESSION_NOT_FOUND' | 'USER_NOT_FOUND' | 'SESSION_FORBIDDEN' | 'INVALID_LOADOUT' | 'PROGRESSION_NOT_FOUND' | 'INSUFFICIENT_ENERGY'
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

  // CRITICAL FIX: Instead of rejecting when finalWave exceeds max advance,
  // clamp it to currentWave + MAX_PARTIAL_WAVE_ADVANCE and scale rewards proportionally.
  // This prevents total progress loss when submitSegment fails due to network issues.
  if (finalWave > currentWave + MAX_PARTIAL_WAVE_ADVANCE) {
    const maxAllowedWave = currentWave + MAX_PARTIAL_WAVE_ADVANCE;
    const wavesRequested = finalWave - currentWave;
    const wavesAllowed = maxAllowedWave - currentWave;
    
    // Scale rewards proportionally to the allowed wave advance
    // Example: if user reached wave 34 but only wave 5 is allowed (from wave 0),
    // scale rewards by 5/34
    const rawScale = wavesAllowed > 0 && wavesRequested > 0
      ? wavesAllowed / wavesRequested
      : 0;
    // Clamp defensively to [0, 1] to avoid any FP shenanigans
    const rewardScale = Math.min(1, Math.max(0, rawScale));

    return {
      // Extra safety: ensure we never exceed MAX_PARTIAL_REWARD even after scaling
      gold: Math.min(MAX_PARTIAL_REWARD, Math.floor(gold * rewardScale)),
      dust: Math.min(MAX_PARTIAL_REWARD, Math.floor(dust * rewardScale)),
      xp: Math.min(MAX_PARTIAL_REWARD, Math.floor(xp * rewardScale)),
      finalWave: maxAllowedWave,
    };
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
  startingRelics?: string[];
  currentPillar: PillarId;
  pillarRotation: boolean;
} | null> {
  // Get user profile
  const profile = await getUserProfile(userId);
  if (!profile) {
    return null;
  }

  // Check and consume energy before starting session
  const hasEnergy = await consumeEnergy(userId);
  if (!hasEnergy) {
    throw new GameSessionError(
      'Insufficient energy to start a wave',
      ENERGY_ERROR_CODES.INSUFFICIENT_ENERGY
    );
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

  // Parse power data or use defaults with schema validation
  const defaultPowerData = createDefaultPlayerPowerData();
  const defaultPowerDataWithTiers: PowerData = {
    ...defaultPowerData,
    heroTiers: {},
    turretTiers: {},
  };
  let powerData: PowerData;

  if (powerUpgradesRecord) {
    // Safely parse and validate each JSON field
    let parsedFortressUpgrades: unknown;
    let parsedHeroUpgrades: unknown;
    let parsedTurretUpgrades: unknown;
    let parsedItemTiers: unknown;

    try {
      parsedFortressUpgrades = JSON.parse(powerUpgradesRecord.fortressUpgrades as string);
    } catch (error) {
      console.error('[startGameSession] Failed to parse fortressUpgrades JSON', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      parsedFortressUpgrades = defaultPowerData.fortressUpgrades;
    }

    try {
      parsedHeroUpgrades = JSON.parse(powerUpgradesRecord.heroUpgrades as string);
    } catch (error) {
      console.error('[startGameSession] Failed to parse heroUpgrades JSON', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      parsedHeroUpgrades = defaultPowerData.heroUpgrades;
    }

    try {
      parsedTurretUpgrades = JSON.parse(powerUpgradesRecord.turretUpgrades as string);
    } catch (error) {
      console.error('[startGameSession] Failed to parse turretUpgrades JSON', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      parsedTurretUpgrades = defaultPowerData.turretUpgrades;
    }

    try {
      parsedItemTiers = JSON.parse(powerUpgradesRecord.itemTiers as string);
    } catch (error) {
      console.error('[startGameSession] Failed to parse itemTiers JSON', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      parsedItemTiers = defaultPowerData.itemTiers;
    }

    // Validate parsed data against schema
    const powerDataToValidate = {
      fortressUpgrades: parsedFortressUpgrades,
      heroUpgrades: parsedHeroUpgrades,
      turretUpgrades: parsedTurretUpgrades,
      itemTiers: parsedItemTiers,
      heroTiers: (powerUpgradesRecord.heroTiers as Record<string, number>) || {},
      turretTiers: (powerUpgradesRecord.turretTiers as Record<string, number>) || {},
    };

    const validationResult = PowerDataSchema.safeParse(powerDataToValidate);
    
    if (!validationResult.success) {
      console.error('[startGameSession] Power data schema validation failed', {
        userId,
        errors: validationResult.error.errors,
        data: powerDataToValidate,
      });
      // Fall back to default power data on validation failure
      powerData = defaultPowerDataWithTiers;
    } else {
      powerData = validationResult.data;
    }
  } else {
    powerData = defaultPowerDataWithTiers;
  }

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

  // Fetch guild stat boost for fortress/hero HP and damage
  const guildBonuses = await getUserGuildBonuses(userId);
  const guildStatBoost = guildBonuses?.statBoost;

  // Fetch unlocked pillars for dust-gated progression
  const unlockedPillars = await getUnlockedPillarsForUser(userId);
  const latestUnlockedPillar = unlockedPillars[unlockedPillars.length - 1] ?? 'streets';
  const requestedPillar = options.pillarId;
  const currentPillar =
    requestedPillar && unlockedPillars.includes(requestedPillar)
      ? requestedPillar
      : latestUnlockedPillar;
  const pillarRotation = false;

  // Grant starter synergy relic on first run for immediate "wow" moment
  // Condition: user has never completed any waves (highestWave === 0)
  const isFirstRun = user.highestWave === 0;
  const startingRelics = isFirstRun ? ['team-spirit'] : undefined;

  // Validate loadout: reject if client requests heroes/turrets they haven't unlocked
  const requestedHeroes = (options.startingHeroes ?? []).map(normalizeHeroId);
  const requestedTurrets = options.startingTurrets ?? [];
  if (requestedHeroes.length > 0 || requestedTurrets.length > 0) {
    const unlockedSetH = new Set(profile.unlockedHeroes);
    const unlockedSetT = new Set(profile.unlockedTurrets);
    for (const id of requestedHeroes) {
      if (!unlockedSetH.has(id)) {
        throw new GameSessionError(
          'One or more starting heroes are not unlocked',
          'INVALID_LOADOUT'
        );
      }
    }
    for (const id of requestedTurrets) {
      if (!unlockedSetT.has(id)) {
        throw new GameSessionError(
          'One or more starting turrets are not unlocked',
          'INVALID_LOADOUT'
        );
      }
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
        fortressBaseHp: remoteConfig.fortressBaseHp ?? 200,
        fortressBaseDamage: remoteConfig.fortressBaseDamage ?? 10,
        waveIntervalTicks: remoteConfig.waveIntervalTicks ?? 90,
    },
    guildStatBoost,
    unlockedPillars,
    currentPillar,
    pillarRotation,
    startingRelics,
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
    // Starting relics for first-run synergy showcase
    startingRelics: simConfig.startingRelics,
    currentPillar: simConfig.currentPillar,
    pillarRotation: simConfig.pillarRotation,
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
  sessionToken?: string; // New session token for continued gameplay
  newInventory: { gold: number; dust: number; materials?: Record<string, number> };
  newProgression: { level: number; xp: number; totalXp: number; xpToNextLevel: number };
} | null> {
  const submitStartTime = Date.now();
  
  // Verify session token
  const tokenPayload = await verifySessionToken(sessionToken);
  if (!tokenPayload || tokenPayload.sessionId !== sessionId) {
    console.warn('[submitSegment] Invalid token', { userId, sessionId, tokenValid: !!tokenPayload, tokenSessionId: tokenPayload?.sessionId });
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
    console.warn('[submitSegment] Session not found or ended', { userId, sessionId, sessionExists: !!session, endedAt: session?.endedAt });
    return null;
  }

  if (session.userId !== userId || tokenPayload.userId !== userId) {
    throw new GameSessionError('Session does not belong to user', 'SESSION_FORBIDDEN');
  }

  // Validate required relations exist
  if (!session.user.inventory || !session.user.progression) {
    console.warn('[submitSegment] User data incomplete', { userId, sessionId, hasInventory: !!session.user.inventory, hasProgression: !!session.user.progression });
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
    console.warn('[submitSegment] Invalid segment start wave', {
      userId,
      sessionId,
      startWave,
      lastVerifiedWave: session.lastVerifiedWave,
      expectedStartWave: session.lastVerifiedWave,
    });
    return createRejectionResponse(
      'Invalid segment start wave',
      { gold: inventory.gold, dust: inventory.dust },
      { level: progression.level, xp: progression.xp, totalXp: progression.totalXp }
    );
  }

  if (tokenPayload.simVersion !== SIM_VERSION) {
    console.warn('[submitSegment] SIM_VERSION_MISMATCH', {
      userId,
      sessionId,
      tokenSimVersion: tokenPayload.simVersion,
      currentSimVersion: SIM_VERSION,
    });
    return createRejectionResponse(
      'SIM_VERSION_MISMATCH',
      { gold: inventory.gold, dust: inventory.dust },
      { level: progression.level, xp: progression.xp, totalXp: progression.totalXp }
    );
  }

  // Validate events payload against protocol schema to protect simulation
  const eventsValidation = GameEventSchema.array().safeParse(events);
  if (!eventsValidation.success) {
    console.warn('[submitSegment] Invalid events payload', {
      userId,
      sessionId,
      startWave,
      endWave,
      issues: eventsValidation.error.issues,
    });
    return createRejectionResponse(
      'Invalid events payload',
      { gold: inventory.gold, dust: inventory.dust },
      { level: progression.level, xp: progression.xp, totalXp: progression.totalXp }
    );
  }
  const validatedEvents = eventsValidation.data;

  // Replay and verify segment
  let sim: Simulation;
  const targetWave = startWave + SEGMENT_SIZE;
  const maxTicks = SEGMENT_SIZE * TICK_HZ * MAX_SECONDS_PER_WAVE;
  try {
    const config = getDefaultConfig();
    applySimConfigSnapshot(config, tokenPayload.simConfig);
    
    // Fix: If snapshot doesn't have unlockedPillars (old sessions), use current fortress level
    if (!config.unlockedPillars) {
      config.unlockedPillars = await getUnlockedPillarsForUser(session.userId);
    }
    
    config.startingWave = startWave;
    config.segmentSize = SEGMENT_SIZE;
    config.tickHz = TICK_HZ;

    sim = new Simulation(session.seed, config);
    // Use validated events only
    sim.setEvents(validatedEvents as any[]);
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
    console.error('[submitSegment] Simulation replay failed', {
      userId,
      sessionId,
      startWave,
      endWave,
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return createRejectionResponse(
      `Simulation replay failed: ${message}`,
      { gold: inventory.gold, dust: inventory.dust },
      { level: progression.level, xp: progression.xp, totalXp: progression.totalXp }
    );
  }

  if (sim.state.tick >= maxTicks) {
    console.warn('[submitSegment] SEGMENT_TICK_CAP', {
      userId,
      sessionId,
      startWave,
      endWave,
      tick: sim.state.tick,
      maxTicks,
    });
    return createRejectionResponse(
      'SEGMENT_TICK_CAP',
      { gold: inventory.gold, dust: inventory.dust },
      { level: progression.level, xp: progression.xp, totalXp: progression.totalXp }
    );
  }

  const computedEndWave = sim.state.wave;
  if (computedEndWave !== endWave) {
    console.warn('[submitSegment] END_WAVE_MISMATCH', {
      userId,
      sessionId,
      startWave,
      endWave,
      computedEndWave,
      expectedEndWave: endWave,
    });
    return createRejectionResponse(
      'END_WAVE_MISMATCH',
      { gold: inventory.gold, dust: inventory.dust },
      { level: progression.level, xp: progression.xp, totalXp: progression.totalXp }
    );
  }

  // Verify final hash
  const computedHash = sim.getFinalHash();
  if (computedHash !== finalHash) {
    console.warn('[submitSegment] Hash mismatch', {
      userId,
      sessionId,
      startWave,
      endWave,
      computedHash,
      providedHash: finalHash,
    });
    return createRejectionResponse(
      'Hash mismatch',
      { gold: inventory.gold, dust: inventory.dust },
      { level: progression.level, xp: progression.xp, totalXp: progression.totalXp }
    );
  }

  // Segment verified - apply rewards
  const eventMultipliers = await getActiveMultipliers();
  const guildBonuses = await getUserGuildBonuses(session.userId);

  // Apply event multipliers and guild bonuses (multiplicative)
  const goldMultiplier = eventMultipliers.gold * (1 + (guildBonuses?.goldBoost ?? 0));
  const xpMultiplier = eventMultipliers.xp * (1 + (guildBonuses?.xpBoost ?? 0));

  const goldEarned = Math.floor(sim.state.segmentGoldEarned * goldMultiplier);
  const dustEarned = Math.floor(sim.state.segmentDustEarned * eventMultipliers.dust);
  const xpEarned = Math.floor(sim.state.segmentXpEarned * xpMultiplier);
  const materialsEarned = sim.state.segmentMaterialsEarned || {};

  // Calculate new highest wave before transaction (needed for cache invalidation)
  const newHighestWave = Math.max(session.user.highestWave, computedEndWave);

  // Update inventory and session in transaction
  const dbStartTime = Date.now();
  const result = await prisma.$transaction(
    async (tx) => {
      // Re-fetch session inside transaction to guard against concurrent updates
    const latestSession = await tx.gameSession.findUnique({
      where: { id: sessionId },
      select: {
        lastVerifiedWave: true,
        endedAt: true,
      },
    });

    if (!latestSession || latestSession.endedAt) {
      console.warn('[submitSegment] Session not found or ended during transaction', {
        userId,
        sessionId,
        startWave,
        endWave,
      });
      throw new GameSessionError('Session ended during segment submit', 'SESSION_FORBIDDEN');
    }

    if (latestSession.lastVerifiedWave !== startWave) {
      console.warn('[submitSegment] Concurrent segment update detected', {
        userId,
        sessionId,
        startWave,
        endWave,
        expectedLastVerifiedWave: startWave,
        actualLastVerifiedWave: latestSession.lastVerifiedWave,
      });
      // Treat as forbidden to avoid double-spend of rewards
      throw new GameSessionError('Concurrent segment update', 'SESSION_FORBIDDEN');
    }

    // Create segment record
    await tx.segment.create({
      data: {
        gameSessionId: sessionId,
        startWave,
        endWave: computedEndWave,
        eventsJson: validatedEvents as Prisma.InputJsonValue,
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
    await tx.user.update({
      where: { id: session.userId },
      data: {
        currentWave: computedEndWave,
        highestWave: newHighestWave,
      },
    });

    // Update inventory (gold, dust, and materials in a single write to reduce lock time)
    const hasMaterials = Object.keys(materialsEarned).length > 0;
    let newInventory: { gold: number; dust: number; materials: unknown };

    if (hasMaterials) {
      const currentInv = await tx.inventory.findUnique({
        where: { userId: session.userId },
        select: { materials: true },
      });
      const currentMaterials = (currentInv?.materials as Record<string, number>) || {};
      const updatedMaterials = { ...currentMaterials };
      for (const [materialId, amount] of Object.entries(materialsEarned)) {
        updatedMaterials[materialId] = (updatedMaterials[materialId] || 0) + amount;
      }
      newInventory = await tx.inventory.update({
        where: { userId: session.userId },
        data: {
          gold: { increment: goldEarned },
          dust: { increment: dustEarned },
          materials: updatedMaterials as Prisma.InputJsonValue,
        },
      });
    } else {
      newInventory = await tx.inventory.update({
        where: { userId: session.userId },
        data: {
          gold: { increment: goldEarned },
          dust: { increment: dustEarned },
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
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
  const dbLatency = Date.now() - dbStartTime;
  const totalLatency = Date.now() - submitStartTime;

  // Log successful segment persistence
  console.info('[submitSegment] Segment persisted to DB', {
    userId,
    sessionId,
    startWave,
    endWave: computedEndWave,
    wavesCompleted: computedEndWave - startWave,
    goldEarned,
    dustEarned,
    xpEarned,
    newLevel: result.newProgression.level,
    newGold: result.newInventory.gold,
    newDust: result.newInventory.dust,
    oldHighestWave: session.user.highestWave,
    newHighestWave,
    dbLatency,
    totalLatency,
  });

  // Invalidate hub preview cache after highestWave update
  try {
    await invalidateHubPreviewCache(session.userId);
  } catch (error) {
    console.warn('Failed to invalidate hub preview cache after segment submission', { userId: session.userId, error });
  }

  // Generate next segment audit ticks
  const nextSegmentAuditTicks = generateSegmentAuditTicks(SEGMENT_SIZE, TICK_HZ);

  // Update mission progress (non-blocking, runs in background)
  const wavesCompleted = computedEndWave - startWave;
  const materialsCount = Object.values(materialsEarned).reduce((sum, amt) => sum + amt, 0);
  batchUpdateMissionProgress(userId, [
    { type: 'complete_waves', amount: wavesCompleted },
    { type: 'earn_gold', amount: goldEarned },
    { type: 'collect_materials', amount: materialsCount },
  ]).catch((err) => {
    // Log but don't fail the segment submission
    console.error('Failed to update mission progress:', err);
  });

  // Award stat points for waves completed (non-blocking)
  if (wavesCompleted > 0) {
    awardWaveStatPoints(userId, wavesCompleted).catch((err) => {
      console.error('Failed to award wave stat points:', err);
    });
  }

  // Award stat points for level ups (non-blocking)
  const levelsGained = result.newProgression.level - progression.level;
  if (levelsGained > 0) {
    awardLevelUpStatPoints(userId, levelsGained).catch((err) => {
      console.error('Failed to award level-up stat points:', err);
    });
  }

  // Generate new session token with extended expiry for continued gameplay
  const newSessionToken = await createSessionToken({
    sessionId,
    userId,
    seed: tokenPayload.seed,
    simVersion: tokenPayload.simVersion,
    startingWave: tokenPayload.startingWave,
    segmentAuditTicks: nextSegmentAuditTicks,
    simConfig: tokenPayload.simConfig,
  });

  return {
    verified: true,
    goldEarned,
    dustEarned,
    xpEarned,
    materialsEarned,
    nextSegmentAuditTicks,
    sessionToken: newSessionToken, // Return new token for continued gameplay
    newInventory: {
      gold: result.newInventory.gold,
      dust: result.newInventory.dust,
      materials: (result.newInventory.materials as Record<string, number>) || {},
    },
    newProgression: result.newProgression,
  };
}

/**
 * Refresh session token for an active game session
 * Returns a new session token with extended expiry
 */
export async function refreshSessionToken(
  userId: string,
  sessionId: string,
  currentSessionToken: string,
): Promise<{ sessionToken: string } | null> {
  // Verify current session token
  const tokenPayload = await verifySessionToken(currentSessionToken);
  if (!tokenPayload || tokenPayload.sessionId !== sessionId) {
    return null;
  }

  // Verify session belongs to user and is still active
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      endedAt: true,
      seed: true,
      currentWave: true,
      configJson: true,
    },
  });

  if (!session || session.endedAt || session.userId !== userId) {
    return null;
  }

  // Use the audit ticks from the token payload
  const segmentAuditTicks = tokenPayload.segmentAuditTicks;

  // Create new session token with same payload but extended expiry
  const newSessionToken = await createSessionToken({
    sessionId: session.id,
    userId: session.userId,
    seed: tokenPayload.seed,
    simVersion: tokenPayload.simVersion,
    startingWave: tokenPayload.startingWave,
    segmentAuditTicks,
    simConfig: tokenPayload.simConfig,
  });

  return { sessionToken: newSessionToken };
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

  // Log partial rewards sanitization (critical for debugging wave persistence issues)
  if (partialRewards && (!sanitizedPartialRewards || sanitizedPartialRewards.finalWave !== partialRewards.finalWave)) {
    console.warn('[endGameSession] Partial rewards sanitized/rejected', {
      userId,
      sessionId,
      currentWave: session.currentWave,
      requestedFinalWave: partialRewards.finalWave,
      requestedGold: partialRewards.gold,
      requestedDust: partialRewards.dust,
      requestedXp: partialRewards.xp,
      sanitizedFinalWave: sanitizedPartialRewards?.finalWave ?? null,
      sanitizedGold: sanitizedPartialRewards?.gold ?? null,
      sanitizedDust: sanitizedPartialRewards?.dust ?? null,
      sanitizedXp: sanitizedPartialRewards?.xp ?? null,
      maxAdvance: MAX_PARTIAL_WAVE_ADVANCE,
      reason: !sanitizedPartialRewards
        ? 'rejected (invalid values or exceeds max advance)'
        : sanitizedPartialRewards.finalWave !== partialRewards.finalWave
        ? `finalWave clamped from ${partialRewards.finalWave} to ${sanitizedPartialRewards.finalWave} (max advance: ${MAX_PARTIAL_WAVE_ADVANCE})`
        : 'sanitized',
    });
  }

  // Calculate XP to apply from partial rewards (with multipliers)
  let partialXpToApply = 0;
  let partialGoldToApply = 0;
  let partialDustToApply = 0;

  // Add partial rewards (from incomplete segment)
  if (sanitizedPartialRewards) {
    const eventMultipliers = await getActiveMultipliers();
    const guildBonuses = await getUserGuildBonuses(session.userId);

    // Apply event multipliers and guild bonuses (multiplicative)
    const goldMultiplier = eventMultipliers.gold * (1 + (guildBonuses?.goldBoost ?? 0));
    const xpMultiplier = eventMultipliers.xp * (1 + (guildBonuses?.xpBoost ?? 0));

    partialGoldToApply = Math.floor(sanitizedPartialRewards.gold * goldMultiplier);
    partialDustToApply = Math.floor(sanitizedPartialRewards.dust * eventMultipliers.dust);
    partialXpToApply = Math.floor(sanitizedPartialRewards.xp * xpMultiplier);
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
  const dbStartTime = Date.now();
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

    // Update totalGoldEarned for prestige calculation
    if (totalGoldEarned > 0) {
      await tx.colonyProgress.upsert({
        where: { userId: session.userId },
        create: {
          userId: session.userId,
          colonyLevels: { farm: 0, mine: 0, market: 0, factory: 0 },
          totalGoldEarned: BigInt(totalGoldEarned),
        },
        update: {
          totalGoldEarned: { increment: BigInt(totalGoldEarned) },
        },
      });
    }

    // Fetch updated inventory
    const updatedInventory = await tx.inventory.findUnique({
      where: { userId: session.userId },
      select: { gold: true, dust: true },
    });

    return { updatedInventory, updatedProgression };
  });
  const dbLatency = Date.now() - dbStartTime;

  // Log successful session end persistence
  console.info('[endGameSession] Session ended and persisted to DB', {
    userId,
    sessionId,
    reason,
    startingWave: session.startingWave,
    finalWave,
    wavesCleared: finalWave - session.startingWave,
    oldHighestWave: session.user.highestWave,
    newHighestWave: Math.max(session.user.highestWave, finalWave),
    totalGoldEarned,
    totalDustEarned,
    totalXpEarned,
    newLevel: result.updatedProgression.level,
    newGold: result.updatedInventory?.gold ?? 0,
    newDust: result.updatedInventory?.dust ?? 0,
    partialRewardsApplied: !!sanitizedPartialRewards,
    partialGoldApplied: partialGoldToApply,
    partialDustApplied: partialDustToApply,
    partialXpApplied: partialXpToApply,
    dbLatency,
  });

  // Invalidate hub preview cache after highestWave update
  try {
    await invalidateHubPreviewCache(session.userId);
  } catch (error) {
    console.warn('Failed to invalidate hub preview cache after session end', { userId: session.userId, error });
  }

  // Update leaderboard with final wave as score
  await upsertLeaderboardEntry(session.userId, sessionId, finalWave);

  // Add waves cleared to guild tower race (if user is in a guild)
  const wavesCleared = finalWave - session.startingWave;
  if (wavesCleared > 0) {
    await addWaveContribution(session.userId, wavesCleared);
    // Update player's total waves for permanent leaderboard
    await incrementTotalWaves(session.userId, wavesCleared);
  }

  // Update lifetime stats for achievements
  await updateLifetimeStats(session.userId, {
    runsCompleted: 1,
    wavesCompleted: wavesCleared,
    goldEarned: totalGoldEarned.toString(),
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
