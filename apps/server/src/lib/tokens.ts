import * as jose from 'jose';
import type { SimConfig } from '@arcade/sim-core';
import { config } from '../config.js';

// JWT for access/refresh tokens
const jwtSecret = new TextEncoder().encode(config.JWT_SECRET);

export interface AccessTokenPayload {
  sub: string; // userId
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string; // userId
  sessionId: string;
  type: 'refresh';
}

/**
 * Create access token
 */
export async function createAccessToken(userId: string): Promise<string> {
  const token = await new jose.SignJWT({ type: 'access' } as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(config.JWT_ACCESS_EXPIRY)
    .sign(jwtSecret);

  return token;
}

/**
 * Create refresh token
 */
export async function createRefreshToken(userId: string, sessionId: string): Promise<string> {
  const token = await new jose.SignJWT({ type: 'refresh', sessionId } as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(config.JWT_REFRESH_EXPIRY)
    .sign(jwtSecret);

  return token;
}

/**
 * Verify access token
 */
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, jwtSecret);
    if (payload.type !== 'access') return null;
    return {
      sub: payload.sub as string,
      type: 'access',
    };
  } catch {
    return null;
  }
}

/**
 * Verify refresh token
 */
export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, jwtSecret);
    if (payload.type !== 'refresh') return null;
    return {
      sub: payload.sub as string,
      sessionId: payload.sessionId as string,
      type: 'refresh',
    };
  } catch {
    return null;
  }
}

// Run Token (HMAC for run verification)
const runTokenSecret = new TextEncoder().encode(config.RUN_TOKEN_SECRET);       

export type SimConfigSnapshot = Pick<
  SimConfig,
  | 'fortressClass'
  | 'startingHeroes'
  | 'startingTurrets'
  | 'commanderLevel'
  | 'progressionDamageBonus'
  | 'progressionGoldBonus'
  | 'startingGold'
  | 'maxHeroSlots'
  | 'fortressBaseHp'
  | 'fortressBaseDamage'
  | 'waveIntervalTicks'
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
export async function createRunToken(payload: Omit<RunTokenPayload, 'issuedAt' | 'exp'>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: RunTokenPayload = {
    ...payload,
    issuedAt: now,
    exp: now + config.RUN_TOKEN_EXPIRY_SECONDS,
  };

  const token = await new jose.SignJWT(fullPayload as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .sign(runTokenSecret);

  return token;
}

/**
 * Verify run token
 */
export async function verifyRunToken(token: string): Promise<RunTokenPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, runTokenSecret);

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
export async function createSessionToken(payload: Omit<SessionTokenPayload, 'issuedAt' | 'exp'>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: SessionTokenPayload = {
    ...payload,
    issuedAt: now,
    exp: now + config.RUN_TOKEN_EXPIRY_SECONDS, // Same TTL as run token
  };

  const token = await new jose.SignJWT(fullPayload as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .sign(runTokenSecret);

  return token;
}

/**
 * Verify session token
 */
export async function verifySessionToken(token: string): Promise<SessionTokenPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, runTokenSecret);

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
  mode: 'boss_rush';
  issuedAt: number;
  exp: number;
}

/**
 * Create Boss Rush session token (HMAC signed)
 */
export async function createBossRushToken(payload: Omit<BossRushTokenPayload, 'issuedAt' | 'exp'>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: BossRushTokenPayload = {
    ...payload,
    issuedAt: now,
    exp: now + config.RUN_TOKEN_EXPIRY_SECONDS,
  };

  const token = await new jose.SignJWT(fullPayload as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .sign(runTokenSecret);

  return token;
}

/**
 * Verify Boss Rush session token
 */
export async function verifyBossRushToken(token: string): Promise<BossRushTokenPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, runTokenSecret);

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    // Verify it's a boss rush token
    if (payload.mode !== 'boss_rush') {
      return null;
    }

    return payload as unknown as BossRushTokenPayload;
  } catch {
    return null;
  }
}
