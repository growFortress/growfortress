import "@fastify/cookie";
import { FastifyPluginAsync, FastifyReply } from "fastify";
import {
  AuthRegisterRequestSchema,
  AuthLoginRequestSchema,
  AuthRefreshRequestSchema,
  CompleteOnboardingRequestSchema,
  ForgotPasswordRequestSchema,
  ResetPasswordRequestSchema,
  BuildPresetsUpdateRequestSchema,
  UpdateCurrencyRequestSchema,
} from "@arcade/protocol";
import {
  registerUser,
  loginUser,
  loginAdmin,
  refreshTokens,
  refreshAdminTokens,
  getUserProfile,
  completeOnboarding,
  updateDefaultLoadout,
  updateBuildPresets,
  updatePreferredCurrency,
  logoutUser,
  logoutAdmin,
  requestPasswordReset,
  resetPassword,
  deleteAccount,
  updateEmail,
  changePassword,
  getUserEmail,
  createGuestUser,
  convertGuestToUser,
  checkUsernameAvailability,
} from "../services/auth.js";
import { resolveLocaleDefaults } from "../services/geoip.js";
import { withRateLimit } from "../plugins/rateLimit.js";
import { config, parseDuration } from "../config.js";
import { redis } from "../lib/redis.js";

const USER_REFRESH_COOKIE = "arcade_refresh";
const ADMIN_REFRESH_COOKIE = "arcade_admin_refresh";
const REFRESH_MAX_AGE_SECONDS = Math.floor(
  parseDuration(config.JWT_REFRESH_EXPIRY) / 1000,
);

function buildCookiePath(prefix: string, path: string) {
  const trimmedPrefix = prefix.trim();
  if (!trimmedPrefix || trimmedPrefix === "/") {
    return path;
  }
  const withLeadingSlash = trimmedPrefix.startsWith("/")
    ? trimmedPrefix
    : `/${trimmedPrefix}`;
  const withoutTrailingSlash = withLeadingSlash.endsWith("/")
    ? withLeadingSlash.slice(0, -1)
    : withLeadingSlash;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${withoutTrailingSlash}${normalizedPath}`;
}

const USER_REFRESH_COOKIE_PATH = buildCookiePath(config.API_PREFIX, "/v1/auth");
const ADMIN_REFRESH_COOKIE_PATH = buildCookiePath(
  config.API_PREFIX,
  "/v1/admin/auth",
);

const LOGIN_ATTEMPT_LIMIT = 5;
const LOGIN_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_BLOCK_DURATION_MS = 10 * 60 * 1000;

function baseCookieOptions(path: string) {
  return {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: "lax" as const,
    path,
  };
}

function setRefreshCookie(
  reply: FastifyReply,
  name: string,
  token: string,
  path: string,
) {
  reply.setCookie(name, token, {
    ...baseCookieOptions(path),
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });
}

function clearRefreshCookie(reply: FastifyReply, name: string, path: string) {
  reply.clearCookie(name, baseCookieOptions(path));
}

function loginKey(scope: string, username: string, ip: string) {
  return `auth:${scope}:login:${username}:${ip}`;
}

function blockKey(scope: string, username: string, ip: string) {
  return `auth:${scope}:block:${username}:${ip}`;
}

async function isLoginBlocked(scope: string, username: string, ip: string) {
  if (config.NODE_ENV === "test") {
    return false;
  }
  try {
    const key = blockKey(scope, username, ip);
    return (await redis.get(key)) !== null;
  } catch {
    return false;
  }
}

async function recordLoginFailure(scope: string, username: string, ip: string) {
  if (config.NODE_ENV === "test") {
    return;
  }
  try {
    const attemptsKey = loginKey(scope, username, ip);
    const attempts = await redis.incr(attemptsKey);

    if (attempts === 1) {
      await redis.pexpire(attemptsKey, LOGIN_ATTEMPT_WINDOW_MS);
    }

    if (attempts >= LOGIN_ATTEMPT_LIMIT) {
      await redis.set(
        blockKey(scope, username, ip),
        "1",
        "PX",
        LOGIN_BLOCK_DURATION_MS,
      );
      await redis.del(attemptsKey);
    }
  } catch {
    // Ignore redis failures to avoid blocking auth
  }
}

async function clearLoginFailures(scope: string, username: string, ip: string) {
  if (config.NODE_ENV === "test") {
    return;
  }
  try {
    await redis.del(
      loginKey(scope, username, ip),
      blockKey(scope, username, ip),
    );
  } catch {
    // Ignore redis failures
  }
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Register new account (strict rate limit to prevent abuse)
  fastify.post(
    "/v1/auth/register",
    withRateLimit("auth", { config: { public: true } }),
    async (request, reply) => {
      const body = AuthRegisterRequestSchema.parse(request.body);

      try {
        const localeDefaults = resolveLocaleDefaults(request);
        const result = await registerUser(
          body.username,
          body.password,
          body.email,
          {
            country: localeDefaults.country,
            preferredCurrency: localeDefaults.currency,
          },
          body.referralCode,
        );

        setRefreshCookie(
          reply,
          USER_REFRESH_COOKIE,
          result.refreshToken,
          USER_REFRESH_COOKIE_PATH,
        );

        return reply.status(201).send({
          accessToken: result.accessToken,
          userId: result.userId,
          displayName: result.displayName,
          expiresAt: result.expiresAt,
        });
      } catch (error) {
        if (error instanceof Error) {
          if (
            error.message === "USERNAME_TAKEN" ||
            error.message === "EMAIL_TAKEN"
          ) {
            return reply.status(400).send({ error: "Registration failed" });
          }
        }
        throw error;
      }
    },
  );

  // Check username availability (public, rate limited)
  fastify.get(
    "/v1/auth/check-username/:username",
    withRateLimit("auth", { config: { public: true } }),
    async (request, reply) => {
      const { username } = request.params as { username: string };

      if (!username || typeof username !== "string") {
        return reply.status(400).send({ error: "Username required" });
      }

      const result = await checkUsernameAvailability(username);
      return reply.send(result);
    },
  );

  // Create guest session (rate limited to prevent abuse)
  fastify.post(
    "/v1/auth/guest",
    withRateLimit("auth", { config: { public: true } }),
    async (request, reply) => {
      try {
        const localeDefaults = resolveLocaleDefaults(request);
        const result = await createGuestUser({
          country: localeDefaults.country,
          preferredCurrency: localeDefaults.currency,
        });

        setRefreshCookie(
          reply,
          USER_REFRESH_COOKIE,
          result.refreshToken,
          USER_REFRESH_COOKIE_PATH,
        );

        return reply.status(201).send({
          accessToken: result.accessToken,
          userId: result.userId,
          displayName: result.displayName,
          expiresAt: result.expiresAt,
          isGuest: true,
        });
      } catch (error) {
        console.error("[Auth] Guest creation failed:", error);
        return reply.status(500).send({ error: "Failed to create guest session" });
      }
    },
  );

  // Convert guest to registered user
  fastify.post(
    "/v1/auth/convert-guest",
    withRateLimit("auth"),
    async (request, reply) => {
      if (!request.userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      if (!request.isGuest) {
        return reply.status(400).send({ error: "Not a guest user" });
      }

      const body = request.body as {
        username?: string;
        password?: string;
        email?: string;
        referralCode?: string;
      };

      if (!body.username || body.username.length < 3 || body.username.length > 20) {
        return reply.status(400).send({ error: "Username must be 3-20 characters" });
      }

      if (!/^[a-zA-Z0-9_]+$/.test(body.username)) {
        return reply.status(400).send({ error: "Username can only contain letters, numbers, and underscores" });
      }

      if (!body.password || body.password.length < 8) {
        return reply.status(400).send({ error: "Password must be at least 8 characters" });
      }

      if (body.email && !body.email.includes("@")) {
        return reply.status(400).send({ error: "Invalid email address" });
      }

      try {
        const result = await convertGuestToUser(
          request.userId,
          body.username,
          body.password,
          body.email,
          body.referralCode,
        );

        setRefreshCookie(
          reply,
          USER_REFRESH_COOKIE,
          result.refreshToken,
          USER_REFRESH_COOKIE_PATH,
        );

        return reply.send({
          accessToken: result.accessToken,
          userId: result.userId,
          displayName: result.displayName,
          expiresAt: result.expiresAt,
          isGuest: false,
        });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === "USERNAME_TAKEN") {
            return reply.status(400).send({ error: "Username is already taken" });
          }
          if (error.message === "EMAIL_TAKEN") {
            return reply.status(400).send({ error: "Email is already in use" });
          }
          if (error.message === "NOT_A_GUEST") {
            return reply.status(400).send({ error: "Not a guest user" });
          }
        }
        console.error("[Auth] Guest conversion failed:", error);
        return reply.status(500).send({ error: "Failed to convert guest account" });
      }
    },
  );

  // Login (strict rate limit to prevent brute force)
  fastify.post(
    "/v1/auth/login",
    withRateLimit("auth", { config: { public: true } }),
    async (request, reply) => {
      const body = AuthLoginRequestSchema.parse(request.body);
      const normalizedUsername = body.username.toLowerCase();

      if (await isLoginBlocked("user", normalizedUsername, request.ip)) {
        return reply
          .status(429)
          .send({ error: "Too many login attempts. Try again later." });
      }

      try {
        const result = await loginUser(body.username, body.password);

        if (!result) {
          await recordLoginFailure("user", normalizedUsername, request.ip);
          return reply
            .status(401)
            .send({ error: "Invalid username or password" });
        }

        await clearLoginFailures("user", normalizedUsername, request.ip);

        setRefreshCookie(
          reply,
          USER_REFRESH_COOKIE,
          result.refreshToken,
          USER_REFRESH_COOKIE_PATH,
        );

        return reply.send({
          accessToken: result.accessToken,
          userId: result.userId,
          displayName: result.displayName,
          expiresAt: result.expiresAt,
        });
      } catch (error) {
        if (error instanceof Error && error.message === "USER_BANNED") {
          return reply.status(403).send({ error: "User is banned" });
        }
        throw error;
      }
    },
  );

  // Refresh tokens (rate limited to prevent token cycling attacks)
  fastify.post(
    "/v1/auth/refresh",
    withRateLimit("auth", { config: { public: true } }),
    async (request, reply) => {
      const body = AuthRefreshRequestSchema.parse(request.body ?? {});
      const refreshToken =
        request.cookies?.[USER_REFRESH_COOKIE] || body.refreshToken;

      if (!refreshToken) {
        return reply
          .status(401)
          .send({ error: "Invalid or expired refresh token" });
      }

      try {
        const result = await refreshTokens(refreshToken);

        if (!result) {
          return reply
            .status(401)
            .send({ error: "Invalid or expired refresh token" });
        }

        setRefreshCookie(
          reply,
          USER_REFRESH_COOKIE,
          result.refreshToken,
          USER_REFRESH_COOKIE_PATH,
        );

        return reply.send({
          accessToken: result.accessToken,
          displayName: result.displayName,
          expiresAt: result.expiresAt,
        });
      } catch (error) {
        if (error instanceof Error && error.message === "USER_BANNED") {
          return reply.status(403).send({ error: "User is banned" });
        }
        throw error;
      }
    },
  );

  // Get user profile
  fastify.get(
    "/v1/profile",
    withRateLimit("profile"),
    async (request, reply) => {
      if (!request.userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const profile = await getUserProfile(request.userId);

      if (!profile) {
        return reply.status(404).send({ error: "User not found" });
      }

      return reply.send(profile);
    },
  );

  // Complete onboarding - set default loadout
  fastify.post("/v1/onboarding/complete", async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const body = CompleteOnboardingRequestSchema.parse(request.body);

    const result = await completeOnboarding(
      request.userId,
      body.fortressClass,
      body.heroId,
      body.turretType,
    );

    return reply.send(result);
  });

  // Update default loadout (for changing defaults later)
  fastify.patch("/v1/profile/loadout", async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const body = request.body as {
      fortressClass?: string;
      heroId?: string;
      turretType?: string;
    };

    const result = await updateDefaultLoadout(request.userId, body);

    return reply.send({ defaultLoadout: result });
  });

  // Update build presets
  fastify.patch("/v1/profile/build-presets", async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const body = BuildPresetsUpdateRequestSchema.parse(request.body);
    const result = await updateBuildPresets(request.userId, body);

    return reply.send(result);
  });

  // Update profile (display name)
  fastify.patch("/v1/profile", async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const body = request.body as { displayName?: string };

    if (
      !body.displayName ||
      body.displayName.length < 1 ||
      body.displayName.length > 30
    ) {
      return reply
        .status(400)
        .send({ error: "Display name must be between 1 and 30 characters" });
    }

    // Update display name in database
    const result = await updateDefaultLoadout(request.userId, {
      displayName: body.displayName,
    });

    return reply.send({ displayName: result.displayName || body.displayName });
  });

  // Update player description
  fastify.patch("/v1/profile/description", async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const body = request.body as { description?: string };

    // Allow empty string to clear description
    const description = body.description ?? "";

    if (description.length > 500) {
      return reply
        .status(400)
        .send({ error: "Description must be 500 characters or less" });
    }

    const result = await updateDefaultLoadout(request.userId, { description });

    return reply.send({ description: result.description || "" });
  });

  // Update preferred currency
  fastify.patch(
    "/v1/profile/currency",
    withRateLimit("profile"),
    async (request, reply) => {
      if (!request.userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const body = UpdateCurrencyRequestSchema.parse(request.body);
      const preferredCurrency = await updatePreferredCurrency(
        request.userId,
        body.currency,
      );

      return reply.send({ preferredCurrency });
    },
  );

  // Get user email
  fastify.get("/v1/profile/email", async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const email = await getUserEmail(request.userId);
    return reply.send({ email });
  });

  // Update user email
  fastify.patch(
    "/v1/profile/email",
    withRateLimit("profile"),
    async (request, reply) => {
      if (!request.userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const body = request.body as { email?: string };

      if (!body.email || !body.email.includes("@")) {
        return reply.status(400).send({ error: "Invalid email address" });
      }

      const result = await updateEmail(request.userId, body.email);

      if (!result.success) {
        if (result.error === "EMAIL_TAKEN") {
          return reply
            .status(400)
            .send({ error: "This email is already in use" });
        }
        return reply.status(500).send({ error: "Failed to update email" });
      }

      return reply.send({ email: body.email.toLowerCase() });
    },
  );

  // Change password
  fastify.post(
    "/v1/auth/change-password",
    withRateLimit("auth"),
    async (request, reply) => {
      if (!request.userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const body = request.body as {
        currentPassword?: string;
        newPassword?: string;
      };

      if (!body.currentPassword || !body.newPassword) {
        return reply
          .status(400)
          .send({ error: "Current password and new password are required" });
      }

      if (body.newPassword.length < 8) {
        return reply
          .status(400)
          .send({ error: "New password must be at least 8 characters" });
      }

      const result = await changePassword(
        request.userId,
        body.currentPassword,
        body.newPassword,
      );

      if (!result.success) {
        if (result.error === "INVALID_PASSWORD") {
          return reply
            .status(400)
            .send({ error: "Current password is incorrect" });
        }
        return reply.status(500).send({ error: "Failed to change password" });
      }

      // Clear refresh cookie since all sessions are revoked
      clearRefreshCookie(reply, USER_REFRESH_COOKIE, USER_REFRESH_COOKIE_PATH);

      return reply.send({ message: "Password changed successfully" });
    },
  );

  // Logout (invalidate refresh token by revoking session)
  fastify.post(
    "/v1/auth/logout",
    withRateLimit("auth", { config: { public: true } }),
    async (request, reply) => {
      const body = request.body as { refreshToken?: string };
      const refreshToken =
        request.cookies?.[USER_REFRESH_COOKIE] || body.refreshToken;

      clearRefreshCookie(reply, USER_REFRESH_COOKIE, USER_REFRESH_COOKIE_PATH);

      if (refreshToken) {
        await logoutUser(refreshToken);
      }

      return reply.status(204).send();
    },
  );

  // Delete account (permanently remove all user data)
  fastify.delete(
    "/v1/auth/account",
    withRateLimit("auth"),
    async (request, reply) => {
      if (!request.userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const success = await deleteAccount(request.userId);

      if (!success) {
        return reply.status(500).send({ error: "Failed to delete account" });
      }

      clearRefreshCookie(reply, USER_REFRESH_COOKIE, USER_REFRESH_COOKIE_PATH);

      return reply.status(204).send();
    },
  );

  // Redeem bonus code
  fastify.post(
    "/v1/bonus-code/redeem",
    withRateLimit("auth"),
    async (request, reply) => {
      if (!request.userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const body = request.body as { code?: string };

      if (!body.code) {
        return reply.status(400).send({ error: "Code is required" });
      }

      const { redeemBonusCode } = await import("../services/bonusCodes.js");
      const result = await redeemBonusCode(request.userId, body.code);

      if (!result.success) {
        const errorMessages: Record<string, string> = {
          INVALID_CODE: "Invalid code",
          CODE_INACTIVE: "This code is no longer active",
          CODE_NOT_YET_VALID: "This code is not yet valid",
          CODE_EXPIRED: "This code has expired",
          ALREADY_REDEEMED: "You have already redeemed this code",
          CODE_EXHAUSTED: "This code has reached its redemption limit",
        };

        return reply
          .status(400)
          .send({ error: errorMessages[result.error!] || "Failed to redeem code" });
      }

      return reply.send({
        message: "Code redeemed successfully",
        rewards: result.rewards,
      });
    },
  );

  // Forgot password (request reset email)
  fastify.post(
    "/v1/auth/forgot-password",
    withRateLimit("passwordReset", { config: { public: true } }),
    async (request, reply) => {
      const body = ForgotPasswordRequestSchema.parse(request.body);

      await requestPasswordReset(body.email);

      // Always return success to prevent email enumeration
      return reply.status(200).send({
        message:
          "If an account exists with this email, a reset link has been sent.",
      });
    },
  );

  // Reset password (submit new password)
  fastify.post(
    "/v1/auth/reset-password",
    withRateLimit("passwordReset", { config: { public: true } }),
    async (request, reply) => {
      const body = ResetPasswordRequestSchema.parse(request.body);

      const success = await resetPassword(body.token, body.password);

      if (!success) {
        return reply
          .status(400)
          .send({ error: "Invalid or expired reset token" });
      }

      return reply
        .status(200)
        .send({ message: "Password has been reset successfully" });
    },
  );

  // Admin login (separate auth flow)
  fastify.post(
    "/v1/admin/auth/login",
    withRateLimit("auth", { config: { public: true } }),
    async (request, reply) => {
      const body = AuthLoginRequestSchema.parse(request.body);
      const normalizedUsername = body.username.toLowerCase();

      if (await isLoginBlocked("admin", normalizedUsername, request.ip)) {
        return reply
          .status(429)
          .send({ error: "Too many login attempts. Try again later." });
      }

      try {
        const result = await loginAdmin(body.username, body.password);

        if (!result) {
          await recordLoginFailure("admin", normalizedUsername, request.ip);
          return reply.status(401).send({ error: "Invalid credentials" });
        }

        await clearLoginFailures("admin", normalizedUsername, request.ip);

        setRefreshCookie(
          reply,
          ADMIN_REFRESH_COOKIE,
          result.refreshToken,
          ADMIN_REFRESH_COOKIE_PATH,
        );

        return reply.send({
          accessToken: result.accessToken,
          displayName: result.displayName,
          expiresAt: result.expiresAt,
        });
      } catch (error) {
        if (error instanceof Error && error.message === "USER_BANNED") {
          return reply.status(403).send({ error: "User is banned" });
        }
        throw error;
      }
    },
  );

  // Admin refresh
  fastify.post(
    "/v1/admin/auth/refresh",
    withRateLimit("auth", { config: { public: true } }),
    async (request, reply) => {
      const body = AuthRefreshRequestSchema.parse(request.body ?? {});
      const refreshToken =
        request.cookies?.[ADMIN_REFRESH_COOKIE] || body.refreshToken;

      if (!refreshToken) {
        return reply
          .status(401)
          .send({ error: "Invalid or expired refresh token" });
      }

      try {
        const result = await refreshAdminTokens(refreshToken);

        if (!result) {
          return reply
            .status(401)
            .send({ error: "Invalid or expired refresh token" });
        }

        setRefreshCookie(
          reply,
          ADMIN_REFRESH_COOKIE,
          result.refreshToken,
          ADMIN_REFRESH_COOKIE_PATH,
        );

        return reply.send({
          accessToken: result.accessToken,
          displayName: result.displayName,
          expiresAt: result.expiresAt,
        });
      } catch (error) {
        if (error instanceof Error && error.message === "USER_BANNED") {
          return reply.status(403).send({ error: "User is banned" });
        }
        throw error;
      }
    },
  );

  // Admin logout
  fastify.post(
    "/v1/admin/auth/logout",
    withRateLimit("auth", { config: { public: true } }),
    async (request, reply) => {
      const body = request.body as { refreshToken?: string };
      const refreshToken =
        request.cookies?.[ADMIN_REFRESH_COOKIE] || body.refreshToken;

      clearRefreshCookie(
        reply,
        ADMIN_REFRESH_COOKIE,
        ADMIN_REFRESH_COOKIE_PATH,
      );

      if (refreshToken) {
        await logoutAdmin(refreshToken);
      }

      return reply.status(204).send();
    },
  );
};

export default authRoutes;
