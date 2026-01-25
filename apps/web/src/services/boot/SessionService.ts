import {
  isAuthenticated as checkAuth,
  isGuestUser,
  getUserId,
  clearTokens,
} from "../../api/auth.js";
import {
  createGuestSession,
  refreshTokensApi,
} from "../../api/client.js";
import {
  getActiveSession,
  clearActiveSession,
  saveActiveSession,
  type ActiveSessionSnapshot,
} from "../../storage/idb.js";
import type {
  AuthResult,
  SessionRestoreResult,
  IAuthService,
  ISessionService,
} from "./types.js";

// =============================================================================
// Constants
// =============================================================================

/** Sessions younger than this will auto-resume without prompting */
const AUTO_RESUME_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// =============================================================================
// Auth Service
// =============================================================================

class AuthService implements IAuthService {
  /**
   * Ensures user is authenticated using the following priority:
   * 1. Check for existing valid auth
   * 2. Try to refresh tokens
   * 3. Create guest session as fallback
   */
  async ensureAuthenticated(): Promise<AuthResult> {
    // 1. Check for existing valid auth
    if (checkAuth()) {
      const isGuest = isGuestUser();
      return {
        type: "existing",
        userId: getUserId() ?? undefined,
        isGuest,
      };
    }

    // 2. Try to refresh tokens
    try {
      const refreshed = await refreshTokensApi();
      if (refreshed) {
        const isGuest = isGuestUser();
        return {
          type: "refreshed",
          userId: getUserId() ?? undefined,
          isGuest,
        };
      }
    } catch (error) {
      console.warn("[AuthService] Token refresh failed:", error);
    }

    // 3. Create guest session as fallback
    try {
      console.log("[AuthService] Creating guest session...");
      const response = await createGuestSession();
      return {
        type: "guest",
        userId: response.userId,
        isGuest: true,
      };
    } catch (error) {
      console.error("[AuthService] Failed to create guest session:", error);
      return {
        type: "failed",
        isGuest: false,
      };
    }
  }

  clearAuth(): void {
    clearTokens();
  }
}

// =============================================================================
// Session Service
// =============================================================================

class SessionService implements ISessionService {
  /**
   * Attempts to restore a saved session from IndexedDB.
   * Returns categorized result to determine appropriate action.
   */
  async tryRestore(userId: string | null): Promise<SessionRestoreResult> {
    try {
      const session = await getActiveSession(userId);

      if (!session) {
        return { type: "none" };
      }

      // Validate session has required data
      if (!session.simulationState || !session.sessionId) {
        console.warn("[SessionService] Session corrupted, clearing");
        await this.clearSavedSession();
        return { type: "corrupted" };
      }

      // Check session age for auto-resume decision
      const sessionAge = Date.now() - session.savedAt;

      if (sessionAge < AUTO_RESUME_THRESHOLD_MS) {
        // Recent session - auto-resume without prompting
        console.log("[SessionService] Recent session found, will auto-resume");
        return { type: "auto_resume", session };
      }

      // Older session - prompt user
      console.log("[SessionService] Older session found, will prompt user");
      return { type: "prompt_user", session };
    } catch (error) {
      console.error("[SessionService] Error restoring session:", error);
      return { type: "none" };
    }
  }

  async clearSavedSession(): Promise<void> {
    await clearActiveSession();
  }

  async saveSnapshot(snapshot: ActiveSessionSnapshot): Promise<void> {
    await saveActiveSession(snapshot);
  }
}

// =============================================================================
// Singleton Exports
// =============================================================================

export const authService = new AuthService();
export const sessionService = new SessionService();

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Runs auth check and session restore in parallel.
 * This is the optimized boot path for returning players.
 */
export async function initializeAuthAndSession(): Promise<{
  auth: AuthResult;
  session: SessionRestoreResult;
}> {
  // Run auth and session check in parallel
  const [auth, session] = await Promise.all([
    authService.ensureAuthenticated(),
    // Note: We pass null for userId since we don't know it yet
    // Session validation will be done after auth completes
    getActiveSession(null).then((s) =>
      s ? { type: "prompt_user" as const, session: s } : { type: "none" as const }
    ),
  ]);

  // If auth succeeded and we found a session, validate userId match
  if (auth.type !== "failed" && session.type !== "none" && session.session) {
    const sessionUserId = session.session.userId;
    if (sessionUserId && auth.userId && sessionUserId !== auth.userId) {
      // Session belongs to different user - clear it
      console.warn("[SessionService] Session userId mismatch, clearing");
      await sessionService.clearSavedSession();
      return { auth, session: { type: "none" } };
    }

    // Determine auto-resume vs prompt based on age
    const sessionAge = Date.now() - session.session.savedAt;
    if (sessionAge < AUTO_RESUME_THRESHOLD_MS) {
      return { auth, session: { type: "auto_resume", session: session.session } };
    }
  }

  return { auth, session };
}
