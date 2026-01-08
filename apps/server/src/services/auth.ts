import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
} from '../lib/tokens.js';
import { parseDuration, config } from '../config.js';
import {
  getXpForLevel,
  getProgressionBonuses,
  type ProgressionBonuses,
} from '@arcade/sim-core';
import { FREE_STARTER_HEROES, FREE_STARTER_TURRETS } from '@arcade/protocol';

const SALT_ROUNDS = 12;

interface AuthResult {
  userId: string;
  displayName: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

/**
 * Register a new user
 */
export async function registerUser(
  username: string,
  password: string
): Promise<AuthResult> {
  // Check if username already exists
  const existing = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
  });

  if (existing) {
    throw new Error('USERNAME_TAKEN');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Create user with initial inventory and progression (username = displayName)
  const user = await prisma.user.create({
    data: {
      username: username.toLowerCase(),
      passwordHash,
      displayName: username,
      inventory: {
        create: {
          gold: 0,
          dust: 0,
          sigils: 0,
        },
      },
      progression: {
        create: {
          level: 1,
          xp: 0,
          totalXp: 0,
        },
      },
    },
  });

  // Create session
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken: randomBytes(32).toString('hex'),
      expiresAt: new Date(Date.now() + parseDuration(config.JWT_REFRESH_EXPIRY)),
    },
  });

  // Generate tokens
  const accessToken = await createAccessToken(user.id);
  const refreshToken = await createRefreshToken(user.id, session.id);
  const expiresAt = Date.now() + parseDuration(config.JWT_ACCESS_EXPIRY);

  return {
    userId: user.id,
    displayName: user.displayName,
    accessToken,
    refreshToken,
    expiresAt,
  };
}

/**
 * Login user
 */
export async function loginUser(
  username: string,
  password: string
): Promise<AuthResult | null> {
  // Find user by username
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
  });

  if (!user) {
    return null;
  }

  // Verify password
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return null;
  }

  if (user.banned) {
    throw new Error('USER_BANNED');
  }

  // Create session
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken: randomBytes(32).toString('hex'),
      expiresAt: new Date(Date.now() + parseDuration(config.JWT_REFRESH_EXPIRY)),
    },
  });

  // Generate tokens
  const accessToken = await createAccessToken(user.id);
  const refreshToken = await createRefreshToken(user.id, session.id);
  const expiresAt = Date.now() + parseDuration(config.JWT_ACCESS_EXPIRY);

  return {
    userId: user.id,
    displayName: user.displayName,
    accessToken,
    refreshToken,
    expiresAt,
  };
}

/**
 * Refresh tokens
 */
export async function refreshTokens(refreshTokenStr: string): Promise<{
  accessToken: string;
  refreshToken: string;
  displayName: string;
  expiresAt: number;
} | null> {
  // Verify refresh token
  const payload = await verifyRefreshToken(refreshTokenStr);
  if (!payload) {
    return null;
  }

  // Find session with user
  const session = await prisma.session.findUnique({
    where: { id: payload.sessionId },
    include: { user: true },
  });

  if (!session || session.revoked || session.expiresAt < new Date()) {
    return null;
  }

  // Verify user matches
  if (session.userId !== payload.sub) {
    return null;
  }

  // Revoke old session
  await prisma.session.update({
    where: { id: session.id },
    data: { revoked: true },
  });

  // Create new session
  const newSession = await prisma.session.create({
    data: {
      userId: session.userId,
      refreshToken: randomBytes(32).toString('hex'),
      expiresAt: new Date(Date.now() + parseDuration(config.JWT_REFRESH_EXPIRY)),
    },
  });

  // Generate new tokens
  const accessToken = await createAccessToken(session.userId);
  const refreshToken = await createRefreshToken(session.userId, newSession.id);
  const expiresAt = Date.now() + parseDuration(config.JWT_ACCESS_EXPIRY);

  return {
    accessToken,
    refreshToken,
    displayName: session.user.displayName,
    expiresAt,
  };
}

/**
 * Get user profile
 */
export async function getUserProfile(userId: string): Promise<{
  userId: string;
  displayName: string;
  inventory: { gold: number; dust: number; sigils: number };
  progression: { level: number; xp: number; totalXp: number; xpToNextLevel: number };
  currentWave: number;
  highestWave: number;
  onboardingCompleted: boolean;
  defaultLoadout: {
    fortressClass: string | null;
    heroId: string | null;
    turretType: string | null;
  };
  unlockedHeroes: string[];
  unlockedTurrets: string[];
} | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      inventory: true,
      progression: true,
    },
  });

  if (!user || !user.inventory || !user.progression) {
    return null;
  }

  // Build unlocked heroes list from inventory + free starters + default
  const heroSet = new Set<string>([
    ...FREE_STARTER_HEROES,
    ...(user.inventory.unlockedHeroIds || []),
  ]);
  if (user.defaultHeroId) {
    heroSet.add(user.defaultHeroId);
  }
  const unlockedHeroes = Array.from(heroSet);

  // Build unlocked turrets list from inventory + free starters + default
  const turretSet = new Set<string>([
    ...FREE_STARTER_TURRETS,
    ...(user.inventory.unlockedTurretIds || []),
  ]);
  if (user.defaultTurretType) {
    turretSet.add(user.defaultTurretType);
  }
  const unlockedTurrets = Array.from(turretSet);

  return {
    userId: user.id,
    displayName: user.displayName,
    inventory: {
      gold: user.inventory.gold,
      dust: user.inventory.dust,
      sigils: user.inventory.sigils,
    },
    progression: {
      level: user.progression.level,
      xp: user.progression.xp,
      totalXp: user.progression.totalXp,
      xpToNextLevel: getXpForLevel(user.progression.level) - user.progression.xp,
    },
    currentWave: user.currentWave,
    highestWave: user.highestWave,
    onboardingCompleted: user.onboardingCompleted,
    defaultLoadout: {
      fortressClass: user.defaultFortressClass,
      heroId: user.defaultHeroId,
      turretType: user.defaultTurretType,
    },
    unlockedHeroes,
    unlockedTurrets,
  };
}

/**
 * Complete onboarding - set default loadout
 */
export async function completeOnboarding(
  userId: string,
  fortressClass: string,
  heroId: string,
  turretType: string
): Promise<{
  success: boolean;
  defaultLoadout: {
    fortressClass: string | null;
    heroId: string | null;
    turretType: string | null;
  };
}> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      defaultFortressClass: fortressClass,
      defaultHeroId: heroId,
      defaultTurretType: turretType,
      onboardingCompleted: true,
    },
  });

  return {
    success: true,
    defaultLoadout: {
      fortressClass: user.defaultFortressClass,
      heroId: user.defaultHeroId,
      turretType: user.defaultTurretType,
    },
  };
}

/**
 * Update default loadout and/or display name
 */
export async function updateDefaultLoadout(
  userId: string,
  updates: {
    fortressClass?: string;
    heroId?: string;
    turretType?: string;
    displayName?: string;
  }
): Promise<{
  fortressClass: string | null;
  heroId: string | null;
  turretType: string | null;
  displayName: string | null;
}> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(updates.fortressClass && { defaultFortressClass: updates.fortressClass }),
      ...(updates.heroId && { defaultHeroId: updates.heroId }),
      ...(updates.turretType && { defaultTurretType: updates.turretType }),
      ...(updates.displayName && { displayName: updates.displayName }),
    },
  });

  return {
    fortressClass: user.defaultFortressClass,
    heroId: user.defaultHeroId,
    turretType: user.defaultTurretType,
    displayName: user.displayName,
  };
}

// Re-export progression functions from sim-core for convenience
export { getXpForLevel, getProgressionBonuses, type ProgressionBonuses };
