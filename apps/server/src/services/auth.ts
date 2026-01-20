import { randomBytes, createHash } from "crypto";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import {
  createAccessToken,
  createRefreshToken,
  createAdminAccessToken,
  createAdminRefreshToken,
  verifyRefreshToken,
  verifyAdminRefreshToken,
} from "../lib/tokens.js";
import { parseDuration, config } from "../config.js";
import {
  getXpForLevel,
  getProgressionBonuses,
  type ProgressionBonuses,
  createDefaultPlayerPowerData,
} from "@arcade/sim-core";
import {
  FREE_STARTER_HEROES,
  FREE_STARTER_TURRETS,
  type BuildPreset,
} from "@arcade/protocol";
import { sendPasswordResetEmail } from "./email.js";
import { createSystemMessage } from "./messages.js";
import { recalculateCachedPower } from "./power-upgrades.js";
import { DEFAULT_REMOTE_CONFIG } from "./gameConfig.js";

const SALT_ROUNDS = 12;

// Map legacy hero IDs to new canonical IDs
const LEGACY_HERO_ID_MAP: Record<string, string> = {
  shield_captain: "vanguard",
  thunderlord: "storm",
  scarlet_mage: "rift",
  iron_sentinel: "forge",
  jade_titan: "titan",
  frost_archer: "frost_unit",
};

/**
 * Normalize a hero ID, mapping legacy IDs to their canonical versions
 */
function normalizeHeroId(heroId: string): string {
  return LEGACY_HERO_ID_MAP[heroId] ?? heroId;
}

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

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
  password: string,
  email?: string,
): Promise<AuthResult> {
  // Check if username already exists
  const existingUsername = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
  });

  if (existingUsername) {
    throw new Error("USERNAME_TAKEN");
  }

  // Check if email already exists (if provided)
  if (email) {
    const existingEmail = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingEmail) {
      throw new Error("EMAIL_TAKEN");
    }
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Starter pack for new players
  const STARTER_PACK = {
    gold: 1000, // Enough for early power upgrades
    dust: 100, // Premium currency - reduced starting amount
  };

  // Create user with initial inventory and progression (username = displayName)
  const user = await prisma.user.create({
    data: {
      username: username.toLowerCase(),
      email: email?.toLowerCase(),
      passwordHash,
      displayName: username,
      inventory: {
        create: {
          gold: STARTER_PACK.gold,
          dust: STARTER_PACK.dust,
        },
      },
      progression: {
        create: {
          level: 1,
          xp: 0,
          totalXp: 0,
        },
      },
      powerUpgrades: {
        create: {
          fortressUpgrades: JSON.stringify(
            createDefaultPlayerPowerData().fortressUpgrades,
          ),
          heroUpgrades: "[]",
          turretUpgrades: "[]",
          itemTiers: "[]",
          cachedTotalPower: 0,
          fortressPrestige: { level: 0, xp: 0 },
          turretPrestige: [],
        },
      },
    },
  });

  // Create session
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken: randomBytes(32).toString("hex"),
      expiresAt: new Date(
        Date.now() + parseDuration(config.JWT_REFRESH_EXPIRY),
      ),
    },
  });

  // Calculate initial power for PvP matching
  try {
    await recalculateCachedPower(user.id);
  } catch (error) {
    console.error(`[Auth] Failed to calculate initial power for user ${user.id}:`, error);
  }

  // =========================================================================
  // WELCOME PACKAGE - Launch promotion
  // =========================================================================

  // Grant Founders Medal artifact (special launch artifact)
  try {
    const artifact = await prisma.playerArtifact.create({
      data: {
        userId: user.id,
        artifactId: "founders_medal",
        level: 1,
      },
    });
    console.log(
      `[Auth] Granted founders_medal to user ${user.id}, artifact id: ${artifact.id}`,
    );
  } catch (error) {
    console.error(
      `[Auth] Failed to grant founders_medal to user ${user.id}:`,
      error,
    );
  }

  // Send welcome message with gift info
  const welcomeMessage = `🎉 Witaj w Grow Fortress, ${username}!

Dziękujemy za dołączenie do naszej społeczności obrońców!

🎁 **Twój Pakiet Powitalny:**
• 💰 ${STARTER_PACK.gold} złota na start
• 💎 ${STARTER_PACK.dust} dust (waluta premium)
• 🏅 **Medal Założyciela** - ekskluzywny legendarny artefakt!

Medal Założyciela to specjalny artefakt dostępny tylko dla graczy, którzy dołączyli w okresie premiery. Daje +10% do obrażeń i zdrowia oraz bonus XP z każdej fali!

Powodzenia w obronie Fortecy! 🏰⚔️

— Zespół Grow Fortress`;

  try {
    await createSystemMessage(
      user.id,
      "🎉 Witaj w Grow Fortress!",
      welcomeMessage,
    );
  } catch {
    // Ignore if message creation fails (non-critical)
  }

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
  password: string,
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
    throw new Error("USER_BANNED");
  }

  // Create session
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken: randomBytes(32).toString("hex"),
      expiresAt: new Date(
        Date.now() + parseDuration(config.JWT_REFRESH_EXPIRY),
      ),
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
 * Login admin user
 */
export async function loginAdmin(
  username: string,
  password: string,
): Promise<AuthResult | null> {
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
  });

  if (!user || user.role !== "ADMIN") {
    return null;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return null;
  }

  if (user.banned) {
    throw new Error("USER_BANNED");
  }

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken: randomBytes(32).toString("hex"),
      expiresAt: new Date(
        Date.now() + parseDuration(config.JWT_REFRESH_EXPIRY),
      ),
    },
  });

  const accessToken = await createAdminAccessToken(user.id);
  const refreshToken = await createAdminRefreshToken(user.id, session.id);
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

  if (session.user.banned) {
    throw new Error("USER_BANNED");
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
      refreshToken: randomBytes(32).toString("hex"),
      expiresAt: new Date(
        Date.now() + parseDuration(config.JWT_REFRESH_EXPIRY),
      ),
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
 * Refresh admin tokens
 */
export async function refreshAdminTokens(refreshTokenStr: string): Promise<{
  accessToken: string;
  refreshToken: string;
  displayName: string;
  expiresAt: number;
} | null> {
  const payload = await verifyAdminRefreshToken(refreshTokenStr);
  if (!payload) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { id: payload.sessionId },
    include: { user: true },
  });

  if (!session || session.revoked || session.expiresAt < new Date()) {
    return null;
  }

  if (session.userId !== payload.sub || session.user.role !== "ADMIN") {
    return null;
  }

  if (session.user.banned) {
    throw new Error("USER_BANNED");
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { revoked: true },
  });

  const newSession = await prisma.session.create({
    data: {
      userId: session.userId,
      refreshToken: randomBytes(32).toString("hex"),
      expiresAt: new Date(
        Date.now() + parseDuration(config.JWT_REFRESH_EXPIRY),
      ),
    },
  });

  const accessToken = await createAdminAccessToken(session.userId);
  const refreshToken = await createAdminRefreshToken(
    session.userId,
    newSession.id,
  );
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
  description: string;
  role: "USER" | "ADMIN";
  inventory: { gold: number; dust: number; materials?: Record<string, number> };
  progression: {
    level: number;
    xp: number;
    totalXp: number;
    xpToNextLevel: number;
    purchasedHeroSlots: number;
    purchasedTurretSlots: number;
  };
  currentWave: number;
  highestWave: number;
  onboardingCompleted: boolean;
  defaultLoadout: {
    fortressClass: string | null;
    heroId: string | null;
    turretType: string | null;
  };
  buildPresets: BuildPreset[];
  activePresetId: string | null;
  unlockedHeroes: string[];
  unlockedTurrets: string[];
  gameConfig: {
    fortressBaseHp: number;
    fortressBaseDamage: number;
  };
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

  // Fix any level inconsistency (XP exceeds level threshold)
  let { level, xp } = user.progression;
  const xpThreshold = getXpForLevel(level);

  if (xp >= xpThreshold) {
    // Calculate correct level from accumulated XP
    while (xp >= getXpForLevel(level)) {
      xp -= getXpForLevel(level);
      level++;
    }

    // Update database with corrected values
    await prisma.progression.update({
      where: { userId },
      data: { level, xp },
    });

    // Update local reference
    user.progression.level = level;
    user.progression.xp = xp;
  }

  // Build unlocked heroes list from inventory + free starters + default
  // Normalize all hero IDs to canonical versions (legacy -> new)
  const heroSet = new Set<string>([
    ...FREE_STARTER_HEROES,
    ...(user.inventory.unlockedHeroIds || []).map(normalizeHeroId),
  ]);
  if (user.defaultHeroId) {
    heroSet.add(normalizeHeroId(user.defaultHeroId));
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

  const buildPresets = Array.isArray(user.buildPresets)
    ? (user.buildPresets as BuildPreset[])
    : [];
  const activePresetId = user.activePresetId ?? null;

  return {
    userId: user.id,
    displayName: user.displayName,
    description: user.description || "",
    role: user.role,
    inventory: {
      gold: user.inventory.gold,
      dust: user.inventory.dust,
      materials: (user.inventory.materials as Record<string, number>) || {},
    },
    progression: {
      level: user.progression.level,
      xp: user.progression.xp,
      totalXp: user.progression.totalXp,
      xpToNextLevel:
        getXpForLevel(user.progression.level) - user.progression.xp,
      purchasedHeroSlots: user.progression.purchasedHeroSlots,
      purchasedTurretSlots: user.progression.purchasedTurretSlots,
    },
    currentWave: user.currentWave,
    highestWave: user.highestWave,
    onboardingCompleted: user.onboardingCompleted,
    defaultLoadout: {
      fortressClass: user.defaultFortressClass,
      heroId: user.defaultHeroId,
      turretType: user.defaultTurretType,
    },
    buildPresets,
    activePresetId,
    unlockedHeroes,
    unlockedTurrets,
    gameConfig: {
      fortressBaseHp: DEFAULT_REMOTE_CONFIG.fortressBaseHp,
      fortressBaseDamage: DEFAULT_REMOTE_CONFIG.fortressBaseDamage,
    },
  };
}

/**
 * Complete onboarding - set default loadout
 */
export async function completeOnboarding(
  userId: string,
  fortressClass: string,
  heroId: string,
  turretType: string,
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
    description?: string;
  },
): Promise<{
  fortressClass: string | null;
  heroId: string | null;
  turretType: string | null;
  displayName: string | null;
  description: string | null;
}> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(updates.fortressClass && {
        defaultFortressClass: updates.fortressClass,
      }),
      ...(updates.heroId && { defaultHeroId: updates.heroId }),
      ...(updates.turretType && { defaultTurretType: updates.turretType }),
      ...(updates.displayName && { displayName: updates.displayName }),
      ...(updates.description !== undefined && {
        description: updates.description,
      }),
    },
  });

  return {
    fortressClass: user.defaultFortressClass,
    heroId: user.defaultHeroId,
    turretType: user.defaultTurretType,
    displayName: user.displayName,
    description: user.description,
  };
}

/**
 * Update build presets and active preset.
 */
export async function updateBuildPresets(
  userId: string,
  updates: {
    buildPresets: BuildPreset[];
    activePresetId: string | null;
  },
): Promise<{ buildPresets: BuildPreset[]; activePresetId: string | null }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      inventory: true,
      progression: true,
    },
  });

  if (!user || !user.inventory || !user.progression) {
    throw new Error("USER_NOT_FOUND");
  }

  // Build unlocked heroes list from inventory + free starters + default
  const heroSet = new Set<string>([
    ...FREE_STARTER_HEROES,
    ...(user.inventory.unlockedHeroIds || []).map(normalizeHeroId),
  ]);
  if (user.defaultHeroId) {
    heroSet.add(normalizeHeroId(user.defaultHeroId));
  }

  // Build unlocked turrets list from inventory + free starters + default
  const turretSet = new Set<string>([
    ...FREE_STARTER_TURRETS,
    ...(user.inventory.unlockedTurretIds || []),
  ]);
  if (user.defaultTurretType) {
    turretSet.add(user.defaultTurretType);
  }

  const sanitizedPresets: BuildPreset[] = updates.buildPresets.map((preset) => ({
    id: preset.id,
    name: preset.name.trim(),
    fortressClass: preset.fortressClass,
    startingHeroes: preset.startingHeroes
      .map(normalizeHeroId)
      .filter((id) => heroSet.has(id))
      .slice(0, 6),
    startingTurrets: preset.startingTurrets
      .filter((id) => turretSet.has(id))
      .slice(0, 6),
  }));

  const activePresetId =
    updates.activePresetId &&
    sanitizedPresets.some((preset) => preset.id === updates.activePresetId)
      ? updates.activePresetId
      : null;

  await prisma.user.update({
    where: { id: userId },
    data: {
      buildPresets: sanitizedPresets,
      activePresetId,
    },
  });

  return {
    buildPresets: sanitizedPresets,
    activePresetId,
  };
}

/**
 * Update user email
 */
export async function updateEmail(
  userId: string,
  newEmail: string,
): Promise<{ success: boolean; error?: string }> {
  const normalizedEmail = newEmail.toLowerCase();

  // Check if email is already taken
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser && existingUser.id !== userId) {
    return { success: false, error: "EMAIL_TAKEN" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { email: normalizedEmail },
  });

  return { success: true };
}

/**
 * Change user password
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return { success: false, error: "USER_NOT_FOUND" };
  }

  // Verify current password
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return { success: false, error: "INVALID_PASSWORD" };
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  // Update password and revoke all sessions for security
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    }),
    prisma.session.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    }),
  ]);

  return { success: true };
}

/**
 * Get user email (for displaying in settings)
 */
export async function getUserEmail(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  return user?.email || null;
}

/**
 * Logout user - revoke refresh token
 */
export async function logoutUser(refreshTokenStr: string): Promise<boolean> {
  // Verify refresh token to get session ID
  const payload = await verifyRefreshToken(refreshTokenStr);
  if (!payload) {
    return false;
  }

  // Revoke the session
  try {
    await prisma.session.update({
      where: { id: payload.sessionId },
      data: { revoked: true },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Logout admin - revoke refresh token
 */
export async function logoutAdmin(refreshTokenStr: string): Promise<boolean> {
  const payload = await verifyAdminRefreshToken(refreshTokenStr);
  if (!payload) {
    return false;
  }

  try {
    await prisma.session.update({
      where: { id: payload.sessionId },
      data: { revoked: true },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Revoke all sessions for a user (force logout everywhere)
 */
export async function revokeAllUserSessions(userId: string): Promise<number> {
  const result = await prisma.session.updateMany({
    where: {
      userId,
      revoked: false,
    },
    data: { revoked: true },
  });
  return result.count;
}

/**
 * Delete user account and all associated data
 */
export async function deleteAccount(userId: string): Promise<boolean> {
  try {
    // Delete all user data in a transaction
    await prisma.$transaction([
      // Delete sessions
      prisma.session.deleteMany({ where: { userId } }),
      // Delete password reset tokens
      prisma.passwordResetToken.deleteMany({ where: { userId } }),
      // Delete messages
      prisma.message.deleteMany({ where: { senderId: userId } }),
      // Delete support tickets and responses
      prisma.ticketResponse.deleteMany({
        where: { ticket: { userId } },
      }),
      prisma.supportTicket.deleteMany({ where: { userId } }),
      // Delete PvP challenges
      prisma.pvpChallenge.deleteMany({
        where: { OR: [{ challengerId: userId }, { challengedId: userId }] },
      }),
      // Delete guild membership
      prisma.guildMember.deleteMany({ where: { userId } }),
      // Delete player artifacts
      prisma.playerArtifact.deleteMany({ where: { userId } }),
      // Delete battlepass progress
      prisma.battlePassProgress.deleteMany({ where: { userId } }),
      // Delete daily quests
      prisma.dailyQuestProgress.deleteMany({ where: { userId } }),
      // Delete mastery progress
      prisma.masteryProgress.deleteMany({ where: { userId } }),
      // Delete power upgrades
      prisma.powerUpgrades.deleteMany({ where: { userId } }),
      // Delete progression
      prisma.progression.deleteMany({ where: { userId } }),
      // Delete inventory
      prisma.inventory.deleteMany({ where: { userId } }),
      // Finally delete the user
      prisma.user.delete({ where: { id: userId } }),
    ]);
    return true;
  } catch (error) {
    console.error(`[Auth] Failed to delete account for user ${userId}:`, error);
    return false;
  }
}

/**
 * Request a password reset
 */
export async function requestPasswordReset(email: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  // Always return true to prevent email enumeration
  if (!user) {
    return true;
  }

  // Generate a random token
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + 3600000); // 1 hour

  // Store the token hash
  await prisma.passwordResetToken.create({
    data: {
      token: tokenHash,
      userId: user.id,
      expiresAt,
    },
  });

  // Send the email
  await sendPasswordResetEmail(user.email!, token);

  return true;
}

/**
 * Reset password using a token
 */
export async function resetPassword(
  token: string,
  password: string,
): Promise<boolean> {
  const tokenHash = hashResetToken(token);
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token: tokenHash },
    include: { user: true },
  });

  if (!resetToken || resetToken.expiresAt < new Date()) {
    return false;
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Update user password and delete the token
  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.delete({
      where: { id: resetToken.id },
    }),
    // Revoke all existing sessions for security
    prisma.session.updateMany({
      where: { userId: resetToken.userId, revoked: false },
      data: { revoked: true },
    }),
  ]);

  return true;
}

// Re-export progression functions from sim-core for convenience
export { getXpForLevel, getProgressionBonuses, type ProgressionBonuses };
