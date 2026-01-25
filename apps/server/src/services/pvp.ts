import { randomInt } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { Prisma, PvpChallengeStatus } from "@prisma/client";
import {
  runArenaBattle,
  getProgressionBonuses,
  getMaxHeroSlots,
  isClassUnlockedAtLevel,
  calculateArenaPower,
  ARTIFACT_DEFINITIONS,
  createDefaultStatUpgrades,
  type ArenaBuildConfig,
  type FortressClass,
  type StatUpgrades,
  type ArenaHeroConfig,
} from "@arcade/sim-core";
import {
  PVP_CONSTANTS,
  PVP_ERROR_CODES,
  normalizeHeroId,
  type BuildPreset,
} from "@arcade/protocol";
import { recordWeeklyHonorGain } from "./playerLeaderboard.js";
import { isUserConnected } from "./websocket.js";
import { addArtifact } from "./artifacts.js";
import { updateLifetimeStats } from "./achievements.js";

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
  heroConfigs: ArenaHeroBuildConfig[];
  damageMultiplier: number;
  hpMultiplier: number;
  power: number;
}

type ArenaPowerHeroConfig = ArenaHeroConfig;
type ArenaHeroBuildConfig = NonNullable<ArenaBuildConfig["heroConfigs"]>[number];
type ArenaUserRecord = Prisma.UserGetPayload<{
  include: {
    progression: true;
    powerUpgrades: true;
    inventory: true;
    artifacts: { where: { equippedToHeroId: { not: null } } };
  };
}>;

// ============================================================================
// HONOR CALCULATION (Hybrid system - based on power difference)
// ============================================================================

const HONOR_BASE = 25;
const HONOR_POWER_FACTOR = 0.5;
const HONOR_MIN_GAIN = 5;
const HONOR_MAX_GAIN = 100;
const HONOR_MIN_LOSS = 5;
const HONOR_MAX_LOSS = 50;

const PVP_REWARDS = {
  goldWin: 50,
  goldLoss: 25,
  goldDraw: 35,
  dust: 1,
  artifactChanceWin: 0.05,
  artifactChanceLoss: 0.02,
  artifactChanceDraw: 0.03,
} as const;

const ARENA_ARTIFACT_POOL = ARTIFACT_DEFINITIONS.filter(
  (artifact) => artifact.source?.type === "drop"
);

function rollArtifactDrop(chance: number): string | undefined {
  if (ARENA_ARTIFACT_POOL.length === 0) return undefined;
  if (Math.random() >= chance) return undefined;
  const index = randomInt(ARENA_ARTIFACT_POOL.length);
  return ARENA_ARTIFACT_POOL[index]?.id;
}

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

function normalizeHeroTier(value: unknown): 1 | 2 | 3 {
  if (value === 2 || value === 3) {
    return value;
  }
  return 1;
}

function getActivePreset(user: ArenaUserRecord): BuildPreset | null {
  const presets = Array.isArray(user.buildPresets)
    ? (user.buildPresets as BuildPreset[])
    : [];
  if (!user.activePresetId) return null;
  return presets.find((preset) => preset.id === user.activePresetId) ?? null;
}

function getArenaHeroIds(user: ArenaUserRecord, commanderLevel: number): string[] {
  const preset = getActivePreset(user);
  const presetHeroes = preset?.startingHeroes?.map(normalizeHeroId) ?? [];
  const fallbackHero = user.defaultHeroId
    ? normalizeHeroId(user.defaultHeroId)
    : "vanguard";
  const heroIds = presetHeroes.length > 0 ? presetHeroes : [fallbackHero];
  const maxHeroSlots = getMaxHeroSlots(commanderLevel);
  return heroIds.slice(0, maxHeroSlots);
}

function getArenaFortressClass(
  user: ArenaUserRecord,
  commanderLevel: number
): FortressClass {
  const preset = getActivePreset(user);
  const requestedClass =
    preset?.fortressClass ?? user.defaultFortressClass ?? "natural";
  return isClassUnlockedAtLevel(requestedClass, commanderLevel)
    ? (requestedClass as FortressClass)
    : "natural";
}

function getHeroUpgradesData(
  rawHeroUpgrades: unknown,
): Array<{ heroId: string; statUpgrades: StatUpgrades }> {
  return Array.isArray(rawHeroUpgrades)
    ? (rawHeroUpgrades as Array<{ heroId: string; statUpgrades: StatUpgrades }>)
    : [];
}

function buildArenaHeroConfigs(
  heroIds: string[],
  heroUpgradesData: Array<{ heroId: string; statUpgrades: StatUpgrades }>,
  heroTiers: Record<string, number>,
  artifactMap: Map<string, string>,
): {
  powerHeroes: ArenaPowerHeroConfig[];
  buildHeroes: ArenaHeroBuildConfig[];
} {
  const powerHeroes: ArenaPowerHeroConfig[] = [];
  const buildHeroes: ArenaHeroBuildConfig[] = [];

  for (const heroId of heroIds) {
    const heroUpgrade = heroUpgradesData.find((h) => h.heroId === heroId);
    const statUpgrades =
      heroUpgrade?.statUpgrades ?? createDefaultStatUpgrades();
    const tier = normalizeHeroTier(heroTiers[heroId]);
    const equippedArtifactId = artifactMap.get(heroId);

    powerHeroes.push({
      heroId,
      tier,
      upgrades: statUpgrades,
      equippedArtifactId,
    });

    buildHeroes.push({
      heroId,
      tier,
      statUpgrades,
      equippedArtifactId,
    });
  }

  return { powerHeroes, buildHeroes };
}

function extractArenaDataFromUser(user: ArenaUserRecord): {
  commanderLevel: number;
  heroIds: string[];
  fortressUpgrades: StatUpgrades;
  powerHeroes: ArenaPowerHeroConfig[];
  buildHeroes: ArenaHeroBuildConfig[];
} {
  const commanderLevel = user.progression?.level ?? 1;

  const heroIds = getArenaHeroIds(user, commanderLevel);

  const powerUpgrades = user.powerUpgrades;
  const fortressUpgrades =
    (
      powerUpgrades?.fortressUpgrades as unknown as {
        statUpgrades?: StatUpgrades;
      } | null
    )?.statUpgrades ?? createDefaultStatUpgrades();

  const heroUpgradesData = getHeroUpgradesData(powerUpgrades?.heroUpgrades);
  const heroTiers =
    (powerUpgrades?.heroTiers as Record<string, number> | null) ?? {};

  const artifactMap = new Map(
    (user.artifacts ?? []).map((a) => [
      a.equippedToHeroId as string,
      a.artifactId,
    ]),
  );

  const { powerHeroes, buildHeroes } = buildArenaHeroConfigs(
    heroIds,
    heroUpgradesData,
    heroTiers,
    artifactMap,
  );

  return {
    commanderLevel,
    heroIds,
    fortressUpgrades,
    powerHeroes,
    buildHeroes,
  };
}

function calculateArenaPowerFromUser(user: ArenaUserRecord): number {
  if (!user.progression) {
    return 0;
  }
  const { commanderLevel, fortressUpgrades, powerHeroes } =
    extractArenaDataFromUser(user);
  return calculateArenaPower(fortressUpgrades, commanderLevel, powerHeroes);
}

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

  return calculateArenaPowerFromUser(user);
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
      artifacts: {
        where: { equippedToHeroId: { not: null } },
      },
    },
  });

  if (!user) {
    return null;
  }

  const { commanderLevel, heroIds, fortressUpgrades, powerHeroes, buildHeroes } =
    extractArenaDataFromUser(user);
  const progressionBonuses = getProgressionBonuses(commanderLevel);

  const fortressClass = getArenaFortressClass(user, commanderLevel);

  // Get power multipliers from upgrades
  let damageMultiplier = progressionBonuses.damageMultiplier;
  let hpMultiplier = 1.0;

  // Use same bonus values as main game (from FORTRESS_STAT_UPGRADES)
  // HP: 5% per level, Damage: 4% per level
  const hpLevels = fortressUpgrades?.hp ?? 0;
  const damageLevels = fortressUpgrades?.damage ?? 0;
  hpMultiplier += hpLevels * 0.05; // 5% per level (matches FORTRESS_STAT_UPGRADES)
  damageMultiplier += damageLevels * 0.04; // 4% per level (matches FORTRESS_STAT_UPGRADES)

  const power = calculateArenaPower(
    fortressUpgrades,
    commanderLevel,
    powerHeroes,
  );

  return {
    userId,
    displayName: user.displayName,
    commanderLevel,
    fortressClass,
    heroIds,
    heroConfigs: buildHeroes,
    damageMultiplier,
    hpMultiplier,
    power,
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
    heroConfigs: data.heroConfigs,
    // Convert multipliers to additive bonuses (1.2 multiplier â†’ 0.2 bonus)
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

  const recentChallenges = await prisma.pvpChallenge.findMany({
    where: {
      challengerId,
      challengedId,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: PVP_CONSTANTS.MAX_CHALLENGES_PER_OPPONENT,
  });

  if (recentChallenges.length < PVP_CONSTANTS.MAX_CHALLENGES_PER_OPPONENT) {
    return { canChallenge: true };
  }

  // Calculate when cooldown ends (oldest challenge + 24h)
  // Safe access - we know length >= MAX_CHALLENGES_PER_OPPONENT from above check
  const oldestChallenge = recentChallenges[recentChallenges.length - 1];
  if (!oldestChallenge) {
    return { canChallenge: true };
  }
  const cooldownEndsAt = new Date(
    oldestChallenge.createdAt.getTime() +
      PVP_CONSTANTS.COOLDOWN_HOURS * 60 * 60 * 1000,
  );

  return {
    canChallenge: false,
    cooldownEndsAt,
  };
}

type ClientBattleResult = {
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

function mapArenaResult(
  battleResult: ReturnType<typeof runArenaBattle>,
  challengerId: string,
  challengedId: string
): ClientBattleResult {
  let winnerId: string | null = null;
  if (battleResult.winner === "left") {
    winnerId = challengerId;
  } else if (battleResult.winner === "right") {
    winnerId = challengedId;
  }

  return {
    winnerId,
    winReason: battleResult.winReason,
    challengerStats: {
      finalHp: battleResult.leftStats.finalHp,
      damageDealt: battleResult.leftStats.damageDealt,
      heroesAlive: battleResult.leftStats.heroesAlive ?? 0,
    },
    challengedStats: {
      finalHp: battleResult.rightStats.finalHp,
      damageDealt: battleResult.rightStats.damageDealt,
      heroesAlive: battleResult.rightStats.heroesAlive ?? 0,
    },
    duration: battleResult.duration,
  };
}

function isResultMatch(
  client: ClientBattleResult,
  server: ClientBattleResult
): boolean {
  return (
    client.winnerId === server.winnerId &&
    client.winReason === server.winReason &&
    client.duration === server.duration &&
    client.challengerStats.finalHp === server.challengerStats.finalHp &&
    client.challengerStats.damageDealt === server.challengerStats.damageDealt &&
    client.challengerStats.heroesAlive === server.challengerStats.heroesAlive &&
    client.challengedStats.finalHp === server.challengedStats.finalHp &&
    client.challengedStats.damageDealt === server.challengedStats.damageDealt &&
    client.challengedStats.heroesAlive === server.challengedStats.heroesAlive
  );
}

// ============================================================================
// PUBLIC API
// ============================================================================

// Minimum power range for matchmaking (ensures new players can find opponents)
const MIN_POWER_RANGE = 1000;
const ARENA_OPPONENTS_MAX = 8;
const OPPONENTS_POOL_SIZE = 50;

/** Fisherâ€“Yates shuffle */
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Get list of random opponents for PVP arena.
 * Returns up to 8 random opponents within power range (shuffled from pool).
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
    isOnline?: boolean;
  }>;
  total: number;
  myPower: number;
}> {
  const myPower = await getUserArenaPower(userId);
  const percentMin = Math.floor(
    myPower * (1 - PVP_CONSTANTS.POWER_RANGE_PERCENT),
  );
  const percentMax = Math.ceil(
    myPower * (1 + PVP_CONSTANTS.POWER_RANGE_PERCENT),
  );

  const minPower = Math.max(percentMin, 0);
  const maxPower = Math.max(percentMax, MIN_POWER_RANGE);

  const where: Prisma.UserWhereInput = {
    id: { not: userId },
    banned: false,
    OR: [
      {
        powerUpgrades: {
          cachedTotalPower: { gte: minPower, lte: maxPower },
        },
      },
      { powerUpgrades: null },
    ],
  };

  const totalEligible = await prisma.user.count({ where });
  const poolSize = Math.min(OPPONENTS_POOL_SIZE, totalEligible, 500);
  const maxOffset = Math.max(0, totalEligible - poolSize);
  const requestedOffset = options?.offset;
  const offset = Number.isFinite(requestedOffset)
    ? Math.min(Math.max(requestedOffset ?? 0, 0), maxOffset)
    : maxOffset > 0
      ? randomInt(maxOffset + 1)
      : 0;

  const pool = (await prisma.user.findMany({
    where,
    include: {
      progression: true,
      powerUpgrades: true,
      inventory: true,
      artifacts: {
        where: { equippedToHeroId: { not: null } },
      },
    },
    orderBy: { id: "asc" },
    skip: offset,
    take: poolSize,
  })) as ArenaUserRecord[];

  const candidates = pool
    .map((user) => ({
      user,
      power: calculateArenaPowerFromUser(user),
    }))
    .filter((entry) => entry.power >= minPower && entry.power <= maxPower);

  const shuffled = shuffle(candidates);
  const take = Math.min(
    ARENA_OPPONENTS_MAX,
    options?.limit ?? ARENA_OPPONENTS_MAX,
    shuffled.length,
  );
  const limited = shuffled.slice(0, take);

  // Batch fetch cooldown info for all opponents in a single query (8 queries → 1)
  const opponentIds = limited.map(({ user }) => user.id);
  const since = new Date(Date.now() - PVP_CONSTANTS.COOLDOWN_HOURS * 60 * 60 * 1000);

  const recentChallenges = await prisma.pvpChallenge.findMany({
    where: {
      challengerId: userId,
      challengedId: { in: opponentIds },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
  });

  // Group challenges by challengedId
  const challengesByOpponent = new Map<string, Date[]>();
  for (const challenge of recentChallenges) {
    const dates = challengesByOpponent.get(challenge.challengedId) || [];
    dates.push(challenge.createdAt);
    challengesByOpponent.set(challenge.challengedId, dates);
  }

  const opponents = limited.map(({ user, power }) => {
    const challenges = challengesByOpponent.get(user.id) || [];
    const canChallenge = challenges.length < PVP_CONSTANTS.MAX_CHALLENGES_PER_OPPONENT;

    let cooldownEndsAt: Date | undefined;
    if (!canChallenge && challenges.length > 0) {
      const oldestChallenge = challenges[challenges.length - 1];
      if (oldestChallenge) {
        cooldownEndsAt = new Date(
          oldestChallenge.getTime() + PVP_CONSTANTS.COOLDOWN_HOURS * 60 * 60 * 1000
        );
      }
    }

    return {
      userId: user.id,
      displayName: user.displayName,
      power,
      pvpWins: user.pvpWins,
      pvpLosses: user.pvpLosses,
      canChallenge,
      challengeCooldownEndsAt: cooldownEndsAt?.toISOString(),
      isOnline: isUserConnected(user.id),
    };
  });

  return { opponents, total: candidates.length, myPower };
}

/**
 * Create a new challenge with deterministic seed + build snapshots.
 * Battle is simulated client-side and resolved via /resolve.
 */
export async function createChallenge(
  challengerId: string,
  challengedId: string,
  options?: { enforcePowerRange?: boolean }
): Promise<{
  challenge: {
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
  };
  battleData: {
    seed: number;
    challengerBuild: ArenaBuildConfig;
    challengedBuild: ArenaBuildConfig;
  };
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

  const seed = randomInt(2147483647);
  const challengerConfig = toBuildConfig(challengerBuild);
  const challengedConfig = toBuildConfig(challengedBuild);
  const challengeRecord = await prisma.pvpChallenge.create({
    data: {
      challengerId,
      challengedId,
      challengerPower: challengerBuild.power,
      challengedPower: challengedBuild.power,
      status: "PENDING",
      seed,
      expiresAt,
      challengerBuild:
        challengerConfig as unknown as Parameters<typeof prisma.pvpChallenge.create>[0]["data"]["challengerBuild"],
      challengedBuild:
        challengedConfig as unknown as Parameters<typeof prisma.pvpChallenge.create>[0]["data"]["challengedBuild"],
    },
  });

  return {
    challenge: {
      id: challengeRecord.id,
      challengerId,
      challengerName: challengerBuild.displayName,
      challengerPower: challengeRecord.challengerPower,
      challengedId,
      challengedName: challengedBuild.displayName,
      challengedPower: challengeRecord.challengedPower,
      status: "PENDING" as PvpChallengeStatus,
      createdAt: challengeRecord.createdAt.toISOString(),
      expiresAt: challengeRecord.expiresAt.toISOString(),
    },
    battleData: {
      seed,
      challengerBuild: challengerConfig,
      challengedBuild: challengedConfig,
    },
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
      challengerIsOnline: isUserConnected(c.challengerId),
      challengedId: c.challengedId,
      challengedName: c.challenged.displayName,
      challengedPower: c.challengedPower,
      challengedIsOnline: isUserConnected(c.challengedId),
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
  battleData?: {
    seed: number;
    challengerBuild: ArenaBuildConfig;
    challengedBuild: ArenaBuildConfig;
  };
  rewards?: {
    gold: number;
    dust: number;
    honorChange: number;
    artifactId?: string;
  };
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

  // For PENDING challenges, fetch FRESH builds to reflect current upgrades
  let battleData: {
    seed: number;
    challengerBuild: ArenaBuildConfig;
    challengedBuild: ArenaBuildConfig;
  } | undefined;

  if (challenge.status === "PENDING" && challenge.seed !== null) {
    const [challengerBuild, challengedBuild] = await Promise.all([
      getUserBuildData(challenge.challengerId),
      getUserBuildData(challenge.challengedId),
    ]);

    if (challengerBuild && challengedBuild) {
      battleData = {
        seed: challenge.seed,
        challengerBuild: toBuildConfig(challengerBuild),
        challengedBuild: toBuildConfig(challengedBuild),
      };
    }
  }
  const rewards =
    challenge.result && challenge.result
      ? (challenge.challengerId === userId
          ? (challenge.result
              .challengerRewards as unknown as {
                gold: number;
                dust: number;
                honorChange: number;
                artifactId?: string;
              } | null)
          : (challenge.result
              .challengedRewards as unknown as {
                gold: number;
                dust: number;
                honorChange: number;
                artifactId?: string;
              } | null)) ?? undefined
      : undefined;

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
    battleData,
    rewards,
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
 * Resolve a challenge (client-simulated) with server verification
 */
export async function resolveChallenge(
  challengeId: string,
  userId: string,
  clientResult: ClientBattleResult,
): Promise<{
  challenge: {
    id: string;
    status: PvpChallengeStatus;
    winnerId?: string;
  };
  result: {
    id: string;
    challengeId: string;
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
  rewards?: {
    gold: number;
    dust: number;
    honorChange: number;
    artifactId?: string;
  };
}> {
  const challenge = await prisma.pvpChallenge.findUnique({
    where: { id: challengeId },
  });

  if (!challenge) {
    throw new PvpError("Challenge not found", "CHALLENGE_NOT_FOUND");
  }

  if (challenge.challengerId !== userId && challenge.challengedId !== userId) {
    throw new PvpError(
      "Not authorized to resolve this challenge",
      "CHALLENGE_FORBIDDEN",
    );
  }

  if (challenge.status === "RESOLVED") {
    throw new PvpError(
      "Challenge already resolved",
      "CHALLENGE_ALREADY_RESOLVED",
    );
  }

  if (challenge.status !== "PENDING") {
    throw new PvpError("Challenge is not pending", "CHALLENGE_NOT_PENDING");
  }

  if (challenge.expiresAt < new Date()) {
    await prisma.pvpChallenge.update({
      where: { id: challengeId },
      data: { status: "EXPIRED" },
    });
    throw new PvpError("Challenge has expired", "CHALLENGE_EXPIRED");
  }

  if (!challenge.seed) {
    throw new PvpError("Challenge seed missing", "CHALLENGE_NOT_PENDING");
  }

  // ALWAYS fetch fresh build data at battle time to reflect current upgrades
  const [challengerBuild, challengedBuild] = await Promise.all([
    getUserBuildData(challenge.challengerId),
    getUserBuildData(challenge.challengedId),
  ]);

  if (!challengerBuild || !challengedBuild) {
    throw new PvpError("Could not load player builds", "USER_NOT_FOUND");
  }

  const challengerConfig = toBuildConfig(challengerBuild);
  const challengedConfig = toBuildConfig(challengedBuild);

  const battleResult = runArenaBattle(
    challenge.seed,
    challengerConfig,
    challengedConfig,
  );
  const serverResult = mapArenaResult(
    battleResult,
    challenge.challengerId,
    challenge.challengedId,
  );

  if (!isResultMatch(clientResult, serverResult)) {
    throw new PvpError("Result mismatch", "RESULT_MISMATCH");
  }

  const challengerWon = serverResult.winnerId === challenge.challengerId;
  const isDraw = !serverResult.winnerId;

  let challengerHonorChange = 0;
  let challengedHonorChange = 0;

  if (serverResult.winnerId) {
    const winnerPower =
      serverResult.winnerId === challenge.challengerId
        ? challenge.challengerPower
        : challenge.challengedPower;
    const loserPower =
      serverResult.winnerId === challenge.challengerId
        ? challenge.challengedPower
        : challenge.challengerPower;
    const winnerHonorGain = calculateHonorChange(winnerPower, loserPower, true);
    const loserHonorLoss = calculateHonorChange(loserPower, winnerPower, false);

    if (challengerWon) {
      challengerHonorChange = winnerHonorGain;
      challengedHonorChange = loserHonorLoss;
    } else {
      challengerHonorChange = loserHonorLoss;
      challengedHonorChange = winnerHonorGain;
    }
  }

  const challengerGold = isDraw
    ? PVP_REWARDS.goldDraw
    : challengerWon
      ? PVP_REWARDS.goldWin
      : PVP_REWARDS.goldLoss;
  const challengedGold = isDraw
    ? PVP_REWARDS.goldDraw
    : challengerWon
      ? PVP_REWARDS.goldLoss
      : PVP_REWARDS.goldWin;

  const challengerArtifactId = rollArtifactDrop(
    isDraw
      ? PVP_REWARDS.artifactChanceDraw
      : challengerWon
        ? PVP_REWARDS.artifactChanceWin
        : PVP_REWARDS.artifactChanceLoss,
  );
  const challengedArtifactId = rollArtifactDrop(
    isDraw
      ? PVP_REWARDS.artifactChanceDraw
      : challengerWon
        ? PVP_REWARDS.artifactChanceLoss
        : PVP_REWARDS.artifactChanceWin,
  );

  const now = new Date();

  const [updatedChallenge, createdResult] = await prisma.$transaction([
    prisma.pvpChallenge.update({
      where: { id: challengeId },
      data: {
        status: "RESOLVED",
        seed: challenge.seed,
        acceptedAt: now,
        resolvedAt: now,
        winnerId: serverResult.winnerId ?? undefined,
        challengerBuild:
          challengerConfig as unknown as Parameters<
            typeof prisma.pvpChallenge.update
          >[0]["data"]["challengerBuild"],
        challengedBuild:
          challengedConfig as unknown as Parameters<
            typeof prisma.pvpChallenge.update
          >[0]["data"]["challengedBuild"],
      },
    }),
    prisma.pvpResult.create({
      data: {
        challengeId,
        winnerId: serverResult.winnerId,
        winReason: serverResult.winReason,
        challengerFinalHp: serverResult.challengerStats.finalHp,
        challengerDamageDealt: serverResult.challengerStats.damageDealt,
        challengerHeroesAlive: serverResult.challengerStats.heroesAlive,
        challengedFinalHp: serverResult.challengedStats.finalHp,
        challengedDamageDealt: serverResult.challengedStats.damageDealt,
        challengedHeroesAlive: serverResult.challengedStats.heroesAlive,
        duration: serverResult.duration,
        challengerBuild: challengerConfig as unknown as Parameters<
          typeof prisma.pvpResult.create
        >[0]["data"]["challengerBuild"],
        challengedBuild: challengedConfig as unknown as Parameters<
          typeof prisma.pvpResult.create
        >[0]["data"]["challengedBuild"],
        replayEvents: battleResult.replayEvents as unknown as Parameters<
          typeof prisma.pvpResult.create
        >[0]["data"]["replayEvents"],
        resolvedAt: now,
      },
    }),
    prisma.user.update({
      where: { id: challenge.challengerId },
      data: {
        ...(serverResult.winnerId === challenge.challengerId
          ? { pvpWins: { increment: 1 } }
          : serverResult.winnerId
            ? { pvpLosses: { increment: 1 } }
            : {}),
        honor: { increment: challengerHonorChange },
      },
    }),
    prisma.user.update({
      where: { id: challenge.challengedId },
      data: {
        ...(serverResult.winnerId === challenge.challengedId
          ? { pvpWins: { increment: 1 } }
          : serverResult.winnerId
            ? { pvpLosses: { increment: 1 } }
            : {}),
        honor: { increment: challengedHonorChange },
      },
    }),
    prisma.inventory.update({
      where: { userId: challenge.challengerId },
      data: {
        gold: { increment: challengerGold },
        dust: { increment: PVP_REWARDS.dust },
      },
    }),
    prisma.inventory.update({
      where: { userId: challenge.challengedId },
      data: {
        gold: { increment: challengedGold },
        dust: { increment: PVP_REWARDS.dust },
      },
    }),
  ]);

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

  // Update lifetime stats for achievements
  const challengerIsWinner = serverResult.winnerId === challenge.challengerId;
  const challengedIsWinner = serverResult.winnerId === challenge.challengedId;
  await Promise.all([
    updateLifetimeStats(challenge.challengerId, {
      pvpBattles: 1,
      pvpVictories: challengerIsWinner ? 1 : 0,
    }),
    updateLifetimeStats(challenge.challengedId, {
      pvpBattles: 1,
      pvpVictories: challengedIsWinner ? 1 : 0,
    }),
  ]);

  let challengerRewardArtifactId = challengerArtifactId;
  if (challengerArtifactId) {
    const result = await addArtifact(challenge.challengerId, challengerArtifactId);
    if (!result.success) {
      challengerRewardArtifactId = undefined;
    }
  }

  let challengedRewardArtifactId = challengedArtifactId;
  if (challengedArtifactId) {
    const result = await addArtifact(challenge.challengedId, challengedArtifactId);
    if (!result.success) {
      challengedRewardArtifactId = undefined;
    }
  }

  const challengerRewards = {
    gold: challengerGold,
    dust: PVP_REWARDS.dust,
    honorChange: challengerHonorChange,
    ...(challengerRewardArtifactId
      ? { artifactId: challengerRewardArtifactId }
      : {}),
  };
  const challengedRewards = {
    gold: challengedGold,
    dust: PVP_REWARDS.dust,
    honorChange: challengedHonorChange,
    ...(challengedRewardArtifactId
      ? { artifactId: challengedRewardArtifactId }
      : {}),
  };

  await prisma.pvpResult.update({
    where: { id: createdResult.id },
    data: {
      challengerRewards:
        challengerRewards as unknown as Parameters<
          typeof prisma.pvpResult.update
        >[0]["data"]["challengerRewards"],
      challengedRewards:
        challengedRewards as unknown as Parameters<
          typeof prisma.pvpResult.update
        >[0]["data"]["challengedRewards"],
    },
  });

  const rewards =
    userId === challenge.challengerId
      ? challengerRewards
      : challengedRewards;

  return {
    challenge: {
      id: updatedChallenge.id,
      status: updatedChallenge.status,
      winnerId: updatedChallenge.winnerId ?? undefined,
    },
    result: {
      id: createdResult.id,
      challengeId: createdResult.challengeId,
      winnerId: createdResult.winnerId,
      winReason: createdResult.winReason,
      challengerStats: {
        finalHp: createdResult.challengerFinalHp,
        damageDealt: createdResult.challengerDamageDealt,
        heroesAlive: createdResult.challengerHeroesAlive,
      },
      challengedStats: {
        finalHp: createdResult.challengedFinalHp,
        damageDealt: createdResult.challengedDamageDealt,
        heroesAlive: createdResult.challengedHeroesAlive,
      },
      duration: createdResult.duration,
      resolvedAt: createdResult.resolvedAt.toISOString(),
    },
    rewards,
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

  // Update lifetime stats for achievements
  const challengerIsWinner = winnerId === challenge.challengerId;
  const challengedIsWinner = winnerId === challenge.challengedId;
  await Promise.all([
    updateLifetimeStats(challenge.challengerId, {
      pvpBattles: 1,
      pvpVictories: challengerIsWinner ? 1 : 0,
    }),
    updateLifetimeStats(challenge.challengedId, {
      pvpBattles: 1,
      pvpVictories: challengedIsWinner ? 1 : 0,
    }),
  ]);

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

  if (challenge.status !== "RESOLVED" || !challenge.result || challenge.seed === null) {
    throw new PvpError(
      "Challenge is not resolved yet",
      "CHALLENGE_NOT_RESOLVED",
    );
  }

  return {
    seed: challenge.seed,
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
