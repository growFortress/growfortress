import { signal, batch } from "@preact/signals";
import type { ProfileResponse } from "@arcade/protocol";
import { getProfile } from "../../api/client.js";
import { getUserId } from "../../api/auth.js";
import { isGuestMode, pendingSessionSnapshot, showSessionRecoveryModal } from "../../state/index.js";
import type { ActiveSessionSnapshot } from "../../storage/idb.js";
import { authService, sessionService } from "./SessionService.js";
import { stateHydrator } from "./StateHydrator.js";
import type {
  BootState,
  BootError,
  AuthResult,
  SessionRestoreResult,
} from "./types.js";

// =============================================================================
// Boot Orchestrator
// =============================================================================

/**
 * BootOrchestrator manages the application boot sequence with a simplified
 * state machine. It coordinates auth, profile loading, and session restoration.
 *
 * Boot sequence:
 * 1. splash - Show splash screen while auth runs in parallel via onReady
 * 2. loading_profile - Fetch profile after auth succeeds
 * 3. initializing - Hydrate signals from profile
 * 4. ready - Boot complete
 */
class BootOrchestrator {
  // State machine
  readonly state = signal<BootState>("splash");
  readonly error = signal<BootError | null>(null);

  // Auth status
  readonly authResult = signal<AuthResult | null>(null);
  readonly isAuthenticated = signal(false);

  // Profile
  readonly profile = signal<ProfileResponse | null>(null);

  // Session recovery
  readonly savedSession = signal<ActiveSessionSnapshot | null>(null);
  readonly sessionRestoreResult = signal<SessionRestoreResult | null>(null);

  // Progress tracking
  readonly authComplete = signal(false);
  readonly profileComplete = signal(false);

  /**
   * Performs auth check. Called by SplashScreen's onReady callback
   * so it runs in parallel with the splash animation.
   */
  async performAuthCheck(): Promise<void> {
    try {
      const result = await authService.ensureAuthenticated();

      batch(() => {
        this.authResult.value = result;
        this.isAuthenticated.value = result.type !== "failed";
        this.authComplete.value = true;

        // Set guest mode signal
        if (result.isGuest) {
          isGuestMode.value = true;
        }
      });
    } catch (error) {
      console.error("[BootOrchestrator] Auth check failed:", error);
      batch(() => {
        this.authResult.value = { type: "failed", isGuest: false };
        this.isAuthenticated.value = false;
        this.authComplete.value = true;
      });
    }
  }

  /**
   * Called when splash screen completes.
   * Transitions to next state based on auth result.
   */
  onSplashComplete(): void {
    if (this.isAuthenticated.value) {
      this.state.value = "loading_profile";
      this.loadProfile();
    } else {
      // Auth failed - go to ready state (will show auth screen)
      this.state.value = "ready";
    }
  }

  /**
   * Loads profile data and checks for saved session.
   */
  private async loadProfile(): Promise<void> {
    try {
      // Load profile and check for saved session in parallel
      const [profile, sessionResult] = await Promise.all([
        getProfile(),
        this.checkSavedSession(),
      ]);

      batch(() => {
        this.profile.value = profile;
        this.sessionRestoreResult.value = sessionResult;
        this.profileComplete.value = true;
      });

      // Move to initializing
      this.state.value = "initializing";
      this.initializeState(profile, sessionResult);
    } catch (error) {
      console.error("[BootOrchestrator] Profile load failed:", error);
      this.error.value = {
        code: "PROFILE_FAILED",
        message: error instanceof Error ? error.message : "Failed to load profile",
        retryable: true,
      };
      this.state.value = "error";
    }
  }

  /**
   * Checks for a saved session in IndexedDB.
   */
  private async checkSavedSession(): Promise<SessionRestoreResult> {
    const userId = getUserId();
    const result = await sessionService.tryRestore(userId);

    if (result.session) {
      batch(() => {
        this.savedSession.value = result.session ?? null;

        // Set pending session snapshot for UI
        pendingSessionSnapshot.value = {
          sessionId: result.session!.sessionId,
          savedAt: result.session!.savedAt,
          fortressClass: result.session!.fortressClass,
        };
      });
    }

    return result;
  }

  /**
   * Initializes state from profile and handles session restoration.
   */
  private initializeState(
    profile: ProfileResponse,
    sessionResult: SessionRestoreResult
  ): void {
    // Hydrate signals from profile
    stateHydrator.hydrateProfile(profile);

    // Handle session restoration
    if (sessionResult.type === "prompt_user" && sessionResult.session) {
      // Show recovery modal for older sessions
      showSessionRecoveryModal.value = true;
    }
    // Note: auto_resume is handled by GameContainer after boot completes

    // Boot complete
    this.state.value = "ready";
  }

  /**
   * Retry boot after an error.
   */
  async retry(): Promise<void> {
    batch(() => {
      this.error.value = null;
      this.state.value = "splash";
      this.authComplete.value = false;
      this.profileComplete.value = false;
      this.profile.value = null;
      this.savedSession.value = null;
    });

    // Restart auth check
    await this.performAuthCheck();
    this.onSplashComplete();
  }

  /**
   * Clear saved session (used when user chooses to abandon).
   */
  async clearSavedSession(): Promise<void> {
    await sessionService.clearSavedSession();
    batch(() => {
      this.savedSession.value = null;
      this.sessionRestoreResult.value = { type: "none" };
      pendingSessionSnapshot.value = null;
    });
  }

  /**
   * Reset orchestrator state (for logout).
   */
  reset(): void {
    batch(() => {
      this.state.value = "splash";
      this.error.value = null;
      this.authResult.value = null;
      this.isAuthenticated.value = false;
      this.profile.value = null;
      this.savedSession.value = null;
      this.sessionRestoreResult.value = null;
      this.authComplete.value = false;
      this.profileComplete.value = false;
    });

    stateHydrator.reset();
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const bootOrchestrator = new BootOrchestrator();

// =============================================================================
// Hook-friendly exports
// =============================================================================

export function useBootState() {
  return bootOrchestrator.state;
}

export function useBootError() {
  return bootOrchestrator.error;
}

export function useIsAuthenticated() {
  return bootOrchestrator.isAuthenticated;
}

export function useSavedSession() {
  return bootOrchestrator.savedSession;
}
