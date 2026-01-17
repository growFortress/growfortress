import * as jose from "jose";
import type { SimConfig } from "@arcade/sim-core";
import { config } from "../config.js";

// JWT for access/refresh tokens - lazy initialized for test mocking compatibility
let _jwtSecret: Uint8Array | null = null;
function getJwtSecret(): Uint8Array {
  if (!_jwtSecret) {
    _jwtSecret = new TextEncoder().encode(config.JWT_SECRET);
  }
  return _jwtSecret;
}

/**
 * Reset cached secrets - used for testing to ensure mocks are picked up
 */
export function resetTokenSecrets(): void {
  _jwtSecret = null;
  _runTokenSecret = null;
}

// Forward declaration for resetTokenSecrets
let _runTokenSecret: Uint8Array | null = null;

export interface AccessTokenPayload {
  sub: string; // userId
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string; // userId
  sessionId: string;
  type: "refresh";
}

export interface AdminAccessTokenPayload {
  sub: string; // userId
  type: "admin_access";
}

export interface AdminRefreshTokenPayload {
  sub: string; // userId
  sessionId: string;
  type: "admin_refresh";
}

/**
 * Create access token
 */
export async function createAccessToken(userId: string): Promise<string> {
  const token = await new jose.SignJWT({
    type: "access",
  } as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(config.JWT_ACCESS_EXPIRY)
    .sign(getJwtSecret());

  return token;
}

/**
 * Create refresh token
 */
export async function createRefreshToken(
  userId: string,
  sessionId: string,
): Promise<string> {
  const token = await new jose.SignJWT({
    type: "refresh",
    sessionId,
  } as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(config.JWT_REFRESH_EXPIRY)
    .sign(getJwtSecret());

  return token;
}

/**
 * Create admin access token
 */
export async function createAdminAccessToken(userId: string): Promise<string> {
  const token = await new jose.SignJWT({
    type: "admin_access",
  } as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(config.JWT_ACCESS_EXPIRY)
    .sign(getJwtSecret());

  return token;
}

/**
 * Create admin refresh token
 */
export async function createAdminRefreshToken(
  userId: string,
  sessionId: string,
): Promise<string> {
  const token = await new jose.SignJWT({
    type: "admin_refresh",
    sessionId,
  } as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(config.JWT_REFRESH_EXPIRY)
    .sign(getJwtSecret());

  return token;
}

/**
 * Verify access token
 */
export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getJwtSecret());
    if (payload.type !== "access") return null;
    return {
      sub: payload.sub as string,
      type: "access",
    };
  } catch {
    return null;
  }
}

/**
 * Verify refresh token
 */
export async function verifyRefreshToken(
  token: string,
): Promise<RefreshTokenPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getJwtSecret());
    if (payload.type !== "refresh") return null;
    return {
      sub: payload.sub as string,
      sessionId: payload.sessionId as string,
      type: "refresh",
    };
  } catch {
    return null;
  }
}

/**
 * Verify admin access token
 */
export async function verifyAdminAccessToken(
  token: string,
): Promise<AdminAccessTokenPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getJwtSecret());
    if (payload.type !== "admin_access") return null;
    return {
      sub: payload.sub as string,
      type: "admin_access",
    };
  } catch {
    return null;
  }
}

/**
 * Verify admin refresh token
 */
export async function verifyAdminRefreshToken(
  token: string,
): Promise<AdminRefreshTokenPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getJwtSecret());
    if (payload.type !== "admin_refresh") return null;
    return {
      sub: payload.sub as string,
      sessionId: payload.sessionId as string,
      type: "admin_refresh",
    };
  } catch {
    return null;
  }
}

// Run Token (HMAC for run verification) - lazy initialized for test mocking compatibility
function getRunTokenSecret(): Uint8Array {
  if (!_runTokenSecret) {
    _runTokenSecret = new TextEncoder().encode(config.RUN_TOKEN_SECRET);
  }
  return _runTokenSecret;
}

export type SimConfigSnapshot = Pick<
  SimConfig,
  | "fortressClass"
  | "startingHeroes"
  | "startingTurrets"
  | "commanderLevel"
  | "progressionDamageBonus"
  | "progressionGoldBonus"
  | "startingGold"
  | "maxHeroSlots"
  | "fortressBaseHp"
  | "fortressBaseDamage"
  | "waveIntervalTicks"
  | "equippedArtifacts"
  | "guildStatBoost"
>;

export interface RunTokenPayload {
  runId: string;
  userId: string;
  seed: number;
  simVersion: number;
  issuedAt: number;
  exp: number;
  tickHz: number;
  maxWaves: number;
  auditTicks: number[];
  simConfig: SimConfigSnapshot;
}

/**
 * Create run token (HMAC signed)
 */
export async function createRunToken(
  payload: Omit<RunTokenPayload, "issuedAt" | "exp">,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: RunTokenPayload = {
    ...payload,
    issuedAt: now,
    exp: now + config.RUN_TOKEN_EXPIRY_SECONDS,
  };

  const token = await new jose.SignJWT(
    fullPayload as unknown as jose.JWTPayload,
  )
    .setProtectedHeader({ alg: "HS256" })
    .sign(getRunTokenSecret());

  return token;
}

/**
 * Verify run token
 */
export async function verifyRunToken(
  token: string,
): Promise<RunTokenPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getRunTokenSecret());

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload as unknown as RunTokenPayload;
  } catch {
    return null;
  }
}

// Session Token (for endless mode game sessions)
export interface SessionTokenPayload {
  sessionId: string;
  userId: string;
  seed: number;
  simVersion: number;
  startingWave: number;
  segmentAuditTicks: number[];
  issuedAt: number;
  exp: number;
  simConfig: SimConfigSnapshot;
}

/**
 * Create session token (HMAC signed)
 */
export async function createSessionToken(
  payload: Omit<SessionTokenPayload, "issuedAt" | "exp">,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: SessionTokenPayload = {
    ...payload,
    issuedAt: now,
    exp: now + config.RUN_TOKEN_EXPIRY_SECONDS, // Same TTL as run token
  };

  const token = await new jose.SignJWT(
    fullPayload as unknown as jose.JWTPayload,
  )
    .setProtectedHeader({ alg: "HS256" })
    .sign(getRunTokenSecret());

  return token;
}

/**
 * Verify session token
 */
export async function verifySessionToken(
  token: string,
): Promise<SessionTokenPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getRunTokenSecret());

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload as unknown as SessionTokenPayload;
  } catch {
    return null;
  }
}

// ============================================================================
// BOSS RUSH SESSION TOKENS
// ============================================================================

export interface BossRushTokenPayload {
  sessionId: string;
  simVersion: number;
  mode: "boss_rush";
  issuedAt: number;
  exp: number;
}

/**
 * Create Boss Rush session token (HMAC signed)
 */
export async function createBossRushToken(
  payload: Omit<BossRushTokenPayload, "issuedAt" | "exp">,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: BossRushTokenPayload = {
    ...payload,
    issuedAt: now,
    exp: now + config.RUN_TOKEN_EXPIRY_SECONDS,
  };

  const token = await new jose.SignJWT(
    fullPayload as unknown as jose.JWTPayload,
  )
    .setProtectedHeader({ alg: "HS256" })
    .sign(getRunTokenSecret());

  return token;
}

/**
 * Verify Boss Rush session token
 */
export async function verifyBossRushToken(
  token: string,
): Promise<BossRushTokenPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getRunTokenSecret());

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    // Verify it's a boss rush token
    if (payload.mode !== "boss_rush") {
      return null;
    }

    return payload as unknown as BossRushTokenPayload;
  } catch {
    return null;
  }
}
