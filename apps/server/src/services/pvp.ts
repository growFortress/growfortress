import { randomInt } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { Prisma, PvpChallengeStatus } from "@prisma/client";
import {
  runArenaBattle,
  getProgressionBonuses,
  getMaxHeroSlots,
  getMaxTurretSlots,
  isClassUnlockedAtLevel,
  calculateArenaPower,
  createDefaultStatUpgrades,
  type ArenaBuildConfig,
  type FortressClass,
  type StatUpgrades,
  type ArenaHeroConfig,
} from "@arcade/sim-core";
import { PVP_CONSTANTS, PVP_ERROR_CODES } from "@arcade/protocol";
import { recordWeeklyHonorGain } from "./playerLeaderboard.js";

// ============================================================================
// ERROR CLASS
// ============================================================================

export class PvpError extends Error {
  constructor(
    message: string,
    public readonly code: keyof typeof PVP_ERROR_CODES,
  ) {
    super(message);
    this.name = "PvpError";
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface UserBuildData {
  userId: string;
  displayName: string;
  commanderLevel: number;
  fortressClass: FortressClass;
  heroIds: string[];
  turretConfigs: Array<{
    definitionId: string;
    slotIndex: number;
    class: FortressClass;
  }>;
  damageMultiplier: number;
  hpMultiplier: number;
  power: number;
}

// ============================================================================
// HONOR CALCULATION (Hybrid system - based on power difference)
// ============================================================================

const HONOR_BASE = 25;
const HONOR_POWER_FACTOR = 0.5;
const HONOR_MIN_GAIN = 5;
const HONOR_MAX_GAIN = 100;
const HONOR_MIN_LOSS = 5;
const HONOR_MAX_LOSS = 50;

/**
 * Calculate honor change for a PvP battle based on power difference.
 * Winners gain more honor for beating stronger opponents.
 * Losers lose less honor when beaten by stronger opponents.
 */
function calculateHonorChange(
  winnerPower: number,
  loserPower: number,
  isWinner: boolean,
): number {
  // Power ratio > 1 means the opponent was stronger
  const powerRatio = loserPower / Math.max(winnerPower, 1);

  if (isWinner) {
    // Winners gain more for beating stronger opponents
    const multiplier = 1 + (powerRatio - 1) * HONOR_POWER_FACTOR;
    const change = Math.round(HONOR_BASE * Math.max(multiplier, 0.5));
    return Math.min(Math.max(change, HONOR_MIN_GAIN), HONOR_MAX_GAIN);
  } else {
    // Losers lose less when beaten by stronger opponents
    // powerRatio < 1 means opponent was weaker (bad loss = more honor lost)
    const multiplier = 1 + (1 - powerRatio) * HONOR_POWER_FACTOR;
    const change = Math.round(HONOR_BASE * Math.max(multiplier, 0.5));
    return -Math.min(Math.max(change, HONOR_MIN_LOSS), HONOR_MAX_LOSS);
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Calculate user's arena-specific power
 * Arena power = fortress + active heroes (with equipped artifacts)
 * Does NOT include turrets (removed from arena)
 */
async function getUserArenaPower(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      progression: true,
      powerUpgrades: true,
      inventory: true,
      artifacts: {
        where: { equippedToHeroId: { not: null } },
      },
    },
  });

  if (!user || !user.progression) {
    return 0;
  }

  const commanderLevel = user.progression.level;

  // Get hero IDs (active loadout)
  const maxHeroSlots = getMaxHeroSlots(commanderLevel);
  const unlockedHeroes = user.inventory?.unlockedHeroIds ?? [];
  const defaultHero = user.defaultHeroId ?? "vanguard";
  const heroIds =
    unlockedHeroes.length > 0
      ? unlockedHeroes.slice(0, maxHeroSlots)
      : [defaultHero];

  // Parse power upgrades
  const powerUpgrades = user.powerUpgrades;
  const fortressUpgrades =
    (
      powerUpgrades?.fortressUpgrades as unknown as {
        statUpgrades?: StatUpgrades;
      } | null
    )?.statUpgrades ?? createDefaultStatUpgrades();

  // heroUpgrades might be an object or array depending on schema version
  const rawHeroUpgrades = powerUpgrades?.heroUpgrades;
  const heroUpgradesData: Array<{ heroId: string; statUpgrades: StatUpgrades }> =
    Array.isArray(rawHeroUpgrades)
      ? (rawHeroUpgrades as unknown as Array<{ heroId: string; statUpgrades: StatUpgrades }>)
      : [];

  // Build hero configs with their upgrades and equipped artifacts
  const artifactMap = new Map(
    user.artifacts.map((a) => [a.equippedToHeroId, a.artifactId]),
  );

  // Hero tiers default to 1 (tier progression not implemented in this schema)
  const activeHeroes: ArenaHeroConfig[] = heroIds.map((heroId) => {
    const heroUpgrade = heroUpgradesData.find((h) => h.heroId === heroId);
    return {
      heroId,
      tier: 1 as const,
      upgrades: heroUpgrade?.statUpgrades ?? createDefaultStatUpgrades(),
      equippedArtifactId: artifactMap.get(heroId),
    };
  });

  return calculateArenaPower(fortressUpgrades, commanderLevel, activeHeroes);
}

/**
 * Get user's build data for arena battle
 */
async function getUserBuildData(userId: string): Promise<UserBuildData | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      progression: true,
      powerUpgrades: true,
      inventory: true,
    },
  });

  if (!user) {
    return null;
  }

  const commanderLevel = user.progression?.level ?? 1;
  const progressionBonuses = getProgressionBonuses(commanderLevel);

  // Get fortress class
  const requestedClass = user.defaultFortressClass ?? "natural";
  const fortressClass = isClassUnlockedAtLevel(requestedClass, commanderLevel)
    ? (requestedClass as FortressClass)
    : "natural";

  // Get hero IDs (use default hero if no specific loadout)
  const maxHeroSlots =
    progressionBonuses.maxHeroSlots || getMaxHeroSlots(commanderLevel);
  const unlockedHeroes = user.inventory?.unlockedHeroIds ?? [];
  const defaultHero = user.defaultHeroId ?? "vanguard";
  const heroIds =
    unlockedHeroes.length > 0
      ? unlockedHeroes.slice(0, maxHeroSlots)
      : [defaultHero];

  // Get turret configs
  const maxTurretSlots =
    progressionBonuses.maxTurretSlots || getMaxTurretSlots(commanderLevel);
  const unlockedTurrets = user.inventory?.unlockedTurretIds ?? [];
  const defaultTurret = user.defaultTurretType ?? "railgun";
  const turretTypes =
    unlockedTurrets.length > 0
      ? unlockedTurrets.slice(0, maxTurretSlots)
      : [defaultTurret];

  const turretConfigs = turretTypes.map((definitionId, index) => ({
    definitionId,
    slotIndex: index,
    class: fortressClass,
  }));

  // Get power multipliers from upgrades
  const powerUpgrades = user.powerUpgrades;
  let damageMultiplier = progressionBonuses.damageMultiplier;
  let hpMultiplier = 1.0;

  if (powerUpgrades) {
    // Parse fortress upgrades for HP/damage bonuses
    const fortressUpgrades = powerUpgrades.fortressUpgrades as {
      statUpgrades?: { hp?: number; damage?: number };
    } | null;

    if (fortressUpgrades?.statUpgrades) {
      // Each upgrade level adds ~2% (0.02 per level)
      const hpLevels = fortressUpgrades.statUpgrades.hp ?? 0;
      const damageLevels = fortressUpgrades.statUpgrades.damage ?? 0;
      hpMultiplier += hpLevels * 0.02;
      damageMultiplier += damageLevels * 0.02;
    }
  }

  return {
    userId,
    displayName: user.displayName,
    commanderLevel,
    fortressClass,
    heroIds,
    turretConfigs,
    damageMultiplier,
    hpMultiplier,
    power: powerUpgrades?.cachedTotalPower ?? 0,
  };
}

/**
 * Convert UserBuildData to ArenaBuildConfig
 */
function toBuildConfig(data: UserBuildData): ArenaBuildConfig {
  return {
    ownerId: data.userId,
    ownerName: data.displayName,
    fortressClass: data.fortressClass,
    commanderLevel: data.commanderLevel,
    heroIds: data.heroIds,
    // Convert multipliers to additive bonuses (1.2 multiplier → 0.2 bonus)
    damageBonus: data.damageMultiplier - 1,
    hpBonus: data.hpMultiplier - 1,
  };
}

/**
 * Check if user can challenge another user (cooldown check)
 */
async function canChallengeUser(
  challengerId: string,
  challengedId: string,
): Promise<{
  canChallenge: boolean;
  cooldownEndsAt?: Date;
}> {
  const since = new Date(
    Date.now() - PVP_CONSTANTS.COOLDOWN_HOURS * 60 * 60 * 1000,
  );

  const recentChallenges = (await prisma.pvpChallenge.findMany({
    where: {
      challengerId,
      challengedId,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: PVP_CONSTANTS.MAX_CHALLENGES_PER_OPPONENT,
  })) ?? [];

  if (recentChallenges.length < PVP_CONSTANTS.MAX_CHALLENGES_PER_OPPONENT) {
    return { canChallenge: true };
  }

  // Calculate when cooldown ends (oldest challenge + 24h)
  const oldestChallenge = recentChallenges[recentChallenges.length - 1];
  const cooldownEndsAt = new Date(
    oldestChallenge.createdAt.getTime() +
      PVP_CONSTANTS.COOLDOWN_HOURS * 60 * 60 * 1000,
  );

  return {
    canChallenge: false,
    cooldownEndsAt,
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

// Minimum power range for matchmaking (ensures new players can find opponents)
const MIN_POWER_RANGE = 1000;
const ARENA_OPPONENTS_COUNT = 6;

/**
 * Get list of random opponents for PVP arena
 * Always returns up to 6 random opponents within power range (minimum 0-1000)
 */
export async function getOpponents(
  userId: string,
  options?: { limit?: number; offset?: number }
): Promise<{
  opponents: Array<{
    userId: string;
    displayName: string;
    power: number;
    pvpWins: number;
    pvpLosses: number;
    canChallenge: boolean;
    challengeCooldownEndsAt?: string;
  }>;
  total: number;
  myPower: number;
}> {
  // Get user's arena power (fortress + active heroes with artifacts)
  const myPower = await getUserArenaPower(userId);

  // Use cached total power for opponent matching (indexed, performant)
  const userPower = await prisma.powerUpgrades.findUnique({
    where: { userId },
    select: { cachedTotalPower: true },
  });

  // Calculate power range with minimum floor of 0-1000
  const matchingPower = userPower?.cachedTotalPower || myPower;
  const percentMin = Math.floor(
    matchingPower * (1 - PVP_CONSTANTS.POWER_RANGE_PERCENT),
  );
  const percentMax = Math.ceil(
    matchingPower * (1 + PVP_CONSTANTS.POWER_RANGE_PERCENT),
  );

  // Ensure minimum range of 0-1000 for new/low power players
  const minPower = Math.min(percentMin, 0);
  const maxPower = Math.max(percentMax, MIN_POWER_RANGE);

  // Find all eligible opponents (including those without powerUpgrades record)
  const totalEligible = await prisma.user.count({
    where: {
      id: { not: userId },
      banned: false,
      OR: [
        // Players with powerUpgrades in range
        {
          powerUpgrades: {
            cachedTotalPower: {
              gte: minPower,
              lte: maxPower,
            },
          },
        },
        // Players without powerUpgrades record (new players, power = 0)
        {
          powerUpgrades: null,
        },
      ],
    },
  });

  const take = options?.limit ?? ARENA_OPPONENTS_COUNT;
  const skip = options?.offset ?? 0;

  const users = await prisma.user.findMany({
    where: {
      id: { not: userId },
      banned: false,
      OR: [
        {
          powerUpgrades: {
            cachedTotalPower: {
              gte: minPower,
              lte: maxPower,
            },
          },
        },
        {
          powerUpgrades: null,
        },
      ],
    },
    include: {
      powerUpgrades: {
        select: { cachedTotalPower: true },
      },
    },
    take,
    skip,
  });

  const limitedUsers = users.slice(0, take);

  // Check cooldowns for each opponent
  const opponents = await Promise.all(
    limitedUsers.map(async (user) => {
      const cooldownInfo = await canChallengeUser(userId, user.id);
      return {
        userId: user.id,
        displayName: user.displayName,
        power: user.powerUpgrades?.cachedTotalPower ?? 0,
        pvpWins: user.pvpWins,
        pvpLosses: user.pvpLosses,
        canChallenge: cooldownInfo.canChallenge,
        challengeCooldownEndsAt: cooldownInfo.cooldownEndsAt?.toISOString(),
      };
    }),
  );

  return { opponents, total: totalEligible, myPower };
}

/**
 * Create a new challenge and immediately run the battle (auto-accept)
 */
export async function createChallenge(
  challengerId: string,
  challengedId: string,
  options?: { enforcePowerRange?: boolean }
): Promise<{
  id: string;
  challengerId: string;
  challengerName: string;
  challengerPower: number;
  challengedId: string;
  challengedName: string;
  challengedPower: number;
  status: PvpChallengeStatus;
  createdAt: string;
  expiresAt: string;
}> {
  // Validate not challenging self
  if (challengerId === challengedId) {
    throw new PvpError("Cannot challenge yourself", "CANNOT_CHALLENGE_SELF");
  }

  // Check cooldown first
  const cooldownInfo = await canChallengeUser(challengerId, challengedId);
  if (!cooldownInfo.canChallenge) {
    throw new PvpError(
      `Challenge cooldown active until ${cooldownInfo.cooldownEndsAt?.toISOString()}`,
      "COOLDOWN_ACTIVE",
    );
  }

  // Get both players' builds for battle
  const [challengerBuild, challengedBuild] = await Promise.all([
    getUserBuildData(challengerId),
    getUserBuildData(challengedId),
  ]);

  if (!challengerBuild) {
    throw new PvpError("Challenger not found", "USER_NOT_FOUND");
  }

  if (!challengedBuild) {
    throw new PvpError("Opponent not found", "OPPONENT_NOT_FOUND");
  }

  if (options?.enforcePowerRange) {
    const lowerBound = Math.floor(
      challengerBuild.power * (1 - PVP_CONSTANTS.POWER_RANGE_PERCENT)
    );
    const upperBound = Math.ceil(
      challengerBuild.power * (1 + PVP_CONSTANTS.POWER_RANGE_PERCENT)
    );
    if (challengedBuild.power < lowerBound || challengedBuild.power > upperBound) {
      throw new PvpError("Opponent power out of range", "POWER_OUT_OF_RANGE");
    }
  }

  const expiresAt = new Date(
    Date.now() + PVP_CONSTANTS.CHALLENGE_EXPIRY_HOURS * 60 * 60 * 1000,
  );

  const challenge = await prisma.pvpChallenge.create({
    data: {
      challengerId,
      challengedId,
      challengerPower: challengerBuild.power,
      challengedPower: challengedBuild.power,
      status: "PENDING",
      expiresAt,
    },
  });

  return {
    id: challenge.id,
    challengerId,
    challengerName: challengerBuild.displayName,
    challengerPower: challenge.challengerPower,
    challengedId,
    challengedName: challengedBuild.displayName,
    challengedPower: challenge.challengedPower,
    status: "PENDING",
    createdAt: challenge.createdAt.toISOString(),
    expiresAt: challenge.expiresAt.toISOString(),
  };
}

/**
 * Get user's challenges
 */
export async function getChallenges(
  userId: string,
  type: "sent" | "received" | "all" = "all",
  status?: PvpChallengeStatus,
  limit: number = 20,
  offset: number = 0,
): Promise<{
  challenges: Array<{
    id: string;
    challengerId: string;
    challengerName: string;
    challengerPower: number;
    challengedId: string;
    challengedName: string;
    challengedPower: number;
    status: PvpChallengeStatus;
    createdAt: string;
    expiresAt: string;
    acceptedAt?: string;
    resolvedAt?: string;
    winnerId?: string;
  }>;
  total: number;
}> {
  const whereClause: Prisma.PvpChallengeWhereInput = {};

  if (type === "sent") {
    whereClause.challengerId = userId;
  } else if (type === "received") {
    whereClause.challengedId = userId;
  } else {
    whereClause.OR = [{ challengerId: userId }, { challengedId: userId }];
  }

  if (status) {
    whereClause.status = status;
  }

  const [challenges, total] = await Promise.all([
    prisma.pvpChallenge.findMany({
      where: whereClause,
      include: {
        challenger: { select: { displayName: true } },
        challenged: { select: { displayName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    }),
    prisma.pvpChallenge.count({ where: whereClause }),
  ]);

  return {
    challenges: challenges.map((c) => ({
      id: c.id,
      challengerId: c.challengerId,
      challengerName: c.challenger.displayName,
      challengerPower: c.challengerPower,
      challengedId: c.challengedId,
      challengedName: c.challenged.displayName,
      challengedPower: c.challengedPower,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      expiresAt: c.expiresAt.toISOString(),
      acceptedAt: c.acceptedAt?.toISOString(),
      resolvedAt: c.resolvedAt?.toISOString(),
      winnerId: c.winnerId ?? undefined,
    })),
    total,
  };
}

/**
 * Get a single challenge by ID
 */
export async function getChallenge(
  challengeId: string,
  userId: string,
): Promise<{
  id: string;
  challengerId: string;
  challengerName: string;
  challengerPower: number;
  challengedId: string;
  challengedName: string;
  challengedPower: number;
  status: PvpChallengeStatus;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
  resolvedAt?: string;
  winnerId?: string;
  result?: {
    id: string;
    winnerId: string | null;
    winReason: string;
    challengerStats: {
      finalHp: number;
      damageDealt: number;
      heroesAlive: number;
    };
    challengedStats: {
      finalHp: number;
      damageDealt: number;
      heroesAlive: number;
    };
    duration: number;
    resolvedAt: string;
  };
}> {
  const challenge = await prisma.pvpChallenge.findUnique({
    where: { id: challengeId },
    include: {
      challenger: { select: { displayName: true } },
      challenged: { select: { displayName: true } },
      result: true,
    },
  });

  if (!challenge) {
    throw new PvpError("Challenge not found", "CHALLENGE_NOT_FOUND");
  }

  // Check if user is part of this challenge
  if (challenge.challengerId !== userId && challenge.challengedId !== userId) {
    throw new PvpError(
      "Not authorized to view this challenge",
      "CHALLENGE_FORBIDDEN",
    );
  }

  return {
    id: challenge.id,
    challengerId: challenge.challengerId,
    challengerName: challenge.challenger.displayName,
    challengerPower: challenge.challengerPower,
    challengedId: challenge.challengedId,
    challengedName: challenge.challenged.displayName,
    challengedPower: challenge.challengedPower,
    status: challenge.status,
    createdAt: challenge.createdAt.toISOString(),
    expiresAt: challenge.expiresAt.toISOString(),
    acceptedAt: challenge.acceptedAt?.toISOString(),
    resolvedAt: challenge.resolvedAt?.toISOString(),
    winnerId: challenge.winnerId ?? undefined,
    result: challenge.result
      ? {
          id: challenge.result.id,
          winnerId: challenge.result.winnerId,
          winReason: challenge.result.winReason,
          challengerStats: {
            finalHp: challenge.result.challengerFinalHp,
            damageDealt: challenge.result.challengerDamageDealt,
            heroesAlive: challenge.result.challengerHeroesAlive,
          },
          challengedStats: {
            finalHp: challenge.result.challengedFinalHp,
            damageDealt: challenge.result.challengedDamageDealt,
            heroesAlive: challenge.result.challengedHeroesAlive,
          },
          duration: challenge.result.duration,
          resolvedAt: challenge.result.resolvedAt.toISOString(),
        }
      : undefined,
  };
}

/**
 * Accept a challenge and run the battle simulation
 */
export async function acceptChallenge(
  challengeId: string,
  userId: string,
): Promise<{
  challenge: {
    id: string;
    status: PvpChallengeStatus;
    winnerId?: string;
  };
  battleData: {
    seed: number;
    challengerBuild: ArenaBuildConfig;
    challengedBuild: ArenaBuildConfig;
  };
  result: {
    winnerId: string | null;
    winReason: string;
    challengerStats: {
      finalHp: number;
      damageDealt: number;
      heroesAlive: number;
    };
    challengedStats: {
      finalHp: number;
      damageDealt: number;
      heroesAlive: number;
    };
    duration: number;
  };
}> {
  // Get challenge
  const challenge = await prisma.pvpChallenge.findUnique({
    where: { id: challengeId },
  });

  if (!challenge) {
    throw new PvpError("Challenge not found", "CHALLENGE_NOT_FOUND");
  }

  // Validate user is the challenged player
  if (challenge.challengedId !== userId) {
    throw new PvpError(
      "Only the challenged player can accept",
      "CHALLENGE_FORBIDDEN",
    );
  }

  // Validate challenge is pending
  if (challenge.status !== "PENDING") {
    throw new PvpError("Challenge is not pending", "CHALLENGE_NOT_PENDING");
  }

  // Check if expired
  if (challenge.expiresAt < new Date()) {
    await prisma.pvpChallenge.update({
      where: { id: challengeId },
      data: { status: "EXPIRED" },
    });
    throw new PvpError("Challenge has expired", "CHALLENGE_EXPIRED");
  }

  // Get both players' builds
  const [challengerBuild, challengedBuild] = await Promise.all([
    getUserBuildData(challenge.challengerId),
    getUserBuildData(challenge.challengedId),
  ]);

  if (!challengerBuild || !challengedBuild) {
    throw new PvpError("Could not load player builds", "USER_NOT_FOUND");
  }

  // Generate cryptographically secure battle seed
  const seed = randomInt(2147483647);

  // Convert to arena build configs
  const challengerConfig = toBuildConfig(challengerBuild);
  const challengedConfig = toBuildConfig(challengedBuild);

  // Run the battle simulation
  const battleResult = runArenaBattle(seed, challengerConfig, challengedConfig);

  // Determine winner ID
  let winnerId: string | null = null;
  if (battleResult.winner === "left") {
    winnerId = challenge.challengerId;
  } else if (battleResult.winner === "right") {
    winnerId = challenge.challengedId;
  }

  // Count alive heroes
  const challengerHeroesAlive = battleResult.leftStats.heroesAlive ?? 0;
  const challengedHeroesAlive = battleResult.rightStats.heroesAlive ?? 0;

  // Calculate honor changes based on power difference
  let challengerHonorChange = 0;
  let challengedHonorChange = 0;

  if (winnerId) {
    const winnerPower =
      winnerId === challenge.challengerId
        ? challengerBuild.power
        : challengedBuild.power;
    const loserPower =
      winnerId === challenge.challengerId
        ? challengedBuild.power
        : challengerBuild.power;

    const winnerHonorGain = calculateHonorChange(winnerPower, loserPower, true);
    const loserHonorLoss = calculateHonorChange(loserPower, winnerPower, false);

    if (winnerId === challenge.challengerId) {
      challengerHonorChange = winnerHonorGain;
      challengedHonorChange = loserHonorLoss;
    } else {
      challengerHonorChange = loserHonorLoss;
      challengedHonorChange = winnerHonorGain;
    }
  }

  // Save result in transaction
  await prisma.$transaction([
    // Update challenge status
    prisma.pvpChallenge.update({
      where: { id: challengeId },
      data: {
        status: "RESOLVED",
        seed,
        acceptedAt: new Date(),
        resolvedAt: new Date(),
        winnerId,
      },
    }),
    // Create result
    prisma.pvpResult.create({
      data: {
        challengeId,
        winnerId,
        winReason: battleResult.winReason,
        challengerFinalHp: battleResult.leftStats.finalHp,
        challengerDamageDealt: battleResult.leftStats.damageDealt,
        challengerHeroesAlive,
        challengedFinalHp: battleResult.rightStats.finalHp,
        challengedDamageDealt: battleResult.rightStats.damageDealt,
        challengedHeroesAlive,
        duration: battleResult.duration,
        challengerBuild: challengerConfig as unknown as Parameters<
          typeof prisma.pvpResult.create
        >[0]["data"]["challengerBuild"],
        challengedBuild: challengedConfig as unknown as Parameters<
          typeof prisma.pvpResult.create
        >[0]["data"]["challengedBuild"],
        replayEvents: battleResult.replayEvents as unknown as Parameters<
          typeof prisma.pvpResult.create
        >[0]["data"]["replayEvents"],
      },
    }),
    // Update challenger stats (wins/losses + honor)
    prisma.user.update({
      where: { id: challenge.challengerId },
      data: {
        ...(winnerId === challenge.challengerId
          ? { pvpWins: { increment: 1 } }
          : winnerId
            ? { pvpLosses: { increment: 1 } }
            : {}),
        honor: { increment: challengerHonorChange },
      },
    }),
    // Update challenged stats (wins/losses + honor)
    prisma.user.update({
      where: { id: challenge.challengedId },
      data: {
        ...(winnerId === challenge.challengedId
          ? { pvpWins: { increment: 1 } }
          : winnerId
            ? { pvpLosses: { increment: 1 } }
            : {}),
        honor: { increment: challengedHonorChange },
      },
    }),
  ]);

  // Record weekly honor gains in leaderboard tracking (fire and forget)
  if (challengerHonorChange > 0) {
    recordWeeklyHonorGain(challenge.challengerId, challengerHonorChange).catch(
      () => {},
    );
  }
  if (challengedHonorChange > 0) {
    recordWeeklyHonorGain(challenge.challengedId, challengedHonorChange).catch(
      () => {},
    );
  }

  return {
    challenge: {
      id: challengeId,
      status: "RESOLVED",
      winnerId: winnerId ?? undefined,
    },
    battleData: {
      seed,
      challengerBuild: challengerConfig,
      challengedBuild: challengedConfig,
    },
    result: {
      winnerId,
      winReason: battleResult.winReason,
      challengerStats: {
        finalHp: battleResult.leftStats.finalHp,
        damageDealt: battleResult.leftStats.damageDealt,
        heroesAlive: challengerHeroesAlive,
      },
      challengedStats: {
        finalHp: battleResult.rightStats.finalHp,
        damageDealt: battleResult.rightStats.damageDealt,
        heroesAlive: challengedHeroesAlive,
      },
      duration: battleResult.duration,
    },
  };
}

/**
 * Decline a challenge
 */
export async function declineChallenge(
  challengeId: string,
  userId: string,
): Promise<{ id: string; status: PvpChallengeStatus }> {
  const challenge = await prisma.pvpChallenge.findUnique({
    where: { id: challengeId },
  });

  if (!challenge) {
    throw new PvpError("Challenge not found", "CHALLENGE_NOT_FOUND");
  }

  if (challenge.challengedId !== userId) {
    throw new PvpError(
      "Only the challenged player can decline",
      "CHALLENGE_FORBIDDEN",
    );
  }

  if (challenge.status !== "PENDING") {
    throw new PvpError("Challenge is not pending", "CHALLENGE_NOT_PENDING");
  }

  const updated = await prisma.pvpChallenge.update({
    where: { id: challengeId },
    data: { status: "DECLINED" },
  });

  return { id: updated.id, status: updated.status };
}

/**
 * Cancel a challenge (by challenger)
 */
export async function cancelChallenge(
  challengeId: string,
  userId: string,
): Promise<{ id: string; status: PvpChallengeStatus }> {
  const challenge = await prisma.pvpChallenge.findUnique({
    where: { id: challengeId },
  });

  if (!challenge) {
    throw new PvpError("Challenge not found", "CHALLENGE_NOT_FOUND");
  }

  if (challenge.challengerId !== userId) {
    throw new PvpError("Only the challenger can cancel", "CHALLENGE_FORBIDDEN");
  }

  if (challenge.status !== "PENDING") {
    throw new PvpError("Challenge is not pending", "CHALLENGE_NOT_PENDING");
  }

  const updated = await prisma.pvpChallenge.update({
    where: { id: challengeId },
    data: { status: "CANCELLED" },
  });

  return { id: updated.id, status: updated.status };
}

/**
 * Get replay data for a resolved challenge
 */
export async function getReplayData(
  challengeId: string,
  userId: string,
): Promise<{
  seed: number;
  challengerBuild: ArenaBuildConfig;
  challengedBuild: ArenaBuildConfig;
  result: {
    winnerId: string | null;
    winReason: string;
    challengerStats: {
      finalHp: number;
      damageDealt: number;
      heroesAlive: number;
    };
    challengedStats: {
      finalHp: number;
      damageDealt: number;
      heroesAlive: number;
    };
    duration: number;
  };
  replayEvents: unknown[];
}> {
  const challenge = await prisma.pvpChallenge.findUnique({
    where: { id: challengeId },
    include: { result: true },
  });

  if (!challenge) {
    throw new PvpError("Challenge not found", "CHALLENGE_NOT_FOUND");
  }

  // Check if user is part of this challenge
  if (challenge.challengerId !== userId && challenge.challengedId !== userId) {
    throw new PvpError(
      "Not authorized to view this replay",
      "CHALLENGE_FORBIDDEN",
    );
  }

  if (challenge.status !== "RESOLVED" || !challenge.result) {
    throw new PvpError(
      "Challenge is not resolved yet",
      "CHALLENGE_NOT_PENDING",
    );
  }

  return {
    seed: challenge.seed!,
    challengerBuild: challenge.result
      .challengerBuild as unknown as ArenaBuildConfig,
    challengedBuild: challenge.result
      .challengedBuild as unknown as ArenaBuildConfig,
    result: {
      winnerId: challenge.result.winnerId,
      winReason: challenge.result.winReason,
      challengerStats: {
        finalHp: challenge.result.challengerFinalHp,
        damageDealt: challenge.result.challengerDamageDealt,
        heroesAlive: challenge.result.challengerHeroesAlive,
      },
      challengedStats: {
        finalHp: challenge.result.challengedFinalHp,
        damageDealt: challenge.result.challengedDamageDealt,
        heroesAlive: challenge.result.challengedHeroesAlive,
      },
      duration: challenge.result.duration,
    },
    replayEvents: (challenge.result.replayEvents as unknown[]) ?? [],
  };
}

/**
 * Get user's PvP stats
 */
export async function getUserPvpStats(userId: string): Promise<{
  wins: number;
  losses: number;
  winRate: number;
  totalBattles: number;
  pendingChallenges: number;
}> {
  const [user, pendingCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { pvpWins: true, pvpLosses: true },
    }),
    prisma.pvpChallenge.count({
      where: {
        challengedId: userId,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
    }),
  ]);

  const wins = user?.pvpWins ?? 0;
  const losses = user?.pvpLosses ?? 0;
  const totalBattles = wins + losses;
  const winRate = totalBattles > 0 ? (wins / totalBattles) * 100 : 0;

  return {
    wins,
    losses,
    winRate: Math.round(winRate * 10) / 10,
    totalBattles,
    pendingChallenges: pendingCount,
  };
}
