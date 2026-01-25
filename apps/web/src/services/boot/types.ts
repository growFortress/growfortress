import type { Signal } from "@preact/signals";
import type { ProfileResponse } from "@arcade/protocol";
import type { ActiveSessionSnapshot } from "../../storage/idb.js";

// =============================================================================
// Boot State Machine
// =============================================================================

/**
 * Boot sequence states - simplified from 6 to 4 states
 * Auth check runs in parallel with splash via onReady callback
 */
export type BootState =
  | "splash" // Splash screen + auth check running in parallel
  | "loading_profile" // Fetching profile data
  | "initializing" // Hydrating signals and setting up game
  | "ready" // Boot complete, game ready
  | "error"; // Boot failed

export interface BootError {
  code: "AUTH_FAILED" | "PROFILE_FAILED" | "NETWORK_ERROR" | "UNKNOWN";
  message: string;
  retryable: boolean;
}

// =============================================================================
// Auth Types
// =============================================================================

export type AuthResultType = "existing" | "refreshed" | "guest" | "failed";

export interface AuthResult {
  type: AuthResultType;
  userId?: string;
  isGuest: boolean;
}

// =============================================================================
// Session Types
// =============================================================================

export interface SessionRestoreResult {
  type: "none" | "expired" | "corrupted" | "auto_resume" | "prompt_user";
  session?: ActiveSessionSnapshot;
}

// =============================================================================
// Boot Context
// =============================================================================

export interface BootContext {
  // State
  state: Signal<BootState>;
  error: Signal<BootError | null>;

  // Auth status
  authResult: Signal<AuthResult | null>;
  isAuthenticated: Signal<boolean>;

  // Profile
  profile: Signal<ProfileResponse | null>;

  // Session recovery
  savedSession: Signal<ActiveSessionSnapshot | null>;
  sessionRestoreResult: Signal<SessionRestoreResult | null>;

  // Progress tracking
  authComplete: Signal<boolean>;
  profileComplete: Signal<boolean>;
}

// =============================================================================
// Service Interfaces
// =============================================================================

export interface IAuthService {
  /**
   * Ensures user is authenticated - checks existing auth, refreshes tokens,
   * or creates guest session as fallback.
   */
  ensureAuthenticated(): Promise<AuthResult>;

  /**
   * Clears authentication state
   */
  clearAuth(): void;
}

export interface ISessionService {
  /**
   * Attempts to restore a saved session from IndexedDB
   */
  tryRestore(userId: string | null): Promise<SessionRestoreResult>;

  /**
   * Clears the saved session
   */
  clearSavedSession(): Promise<void>;

  /**
   * Saves a session snapshot
   */
  saveSnapshot(snapshot: ActiveSessionSnapshot): Promise<void>;
}

export interface HydrateProfileOptions {
  /** Skip idle rewards check (e.g., when resuming a session) */
  skipIdleRewards?: boolean;
}

export interface IStateHydrator {
  /**
   * Hydrates all signals from profile data
   */
  hydrateProfile(profile: ProfileResponse, options?: HydrateProfileOptions): void;

  /**
   * Resets all signals to initial state
   */
  reset(): void;
}
