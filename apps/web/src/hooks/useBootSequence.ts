import { useState, useCallback, useEffect } from "preact/hooks";
import {
  getActiveSession,
  clearActiveSession,
  type ActiveSessionSnapshot,
} from "../storage/idb.js";
import { getUserId, onAuthInvalidated, isAuthenticated as checkAuth } from "../api/auth.js";
import {
  isAuthenticated as isAuthSignal,
  authError,
  authLoading,
  pendingSessionSnapshot,
  showSessionRecoveryModal,
  forceResetToHub,
  clearGuestMode,
} from "../state/index.js";
import { bootOrchestrator } from "../services/boot/index.js";
import { syncManager } from "../storage/sync.js";
import { syncStatus } from "../state/index.js";

// =============================================================================
// Types
// =============================================================================

export type BootStage =
  | "splash"           // Splash screen + auth check in background
  | "loading_profile"  // Loading player profile
  | "initializing"     // Initializing game system
  | "ready";           // Ready

export interface UseBootSequenceResult {
  /** Current boot stage */
  stage: BootStage;
  /** Set boot stage */
  setStage: (stage: BootStage) => void;
  /** Whether user is authenticated (internal state) */
  isAuthenticated: boolean;
  /** Set auth state */
  setAuthenticated: (value: boolean) => void;
  /** Saved session from IndexedDB */
  savedSession: ActiveSessionSnapshot | null;
  /** Called by splash screen onReady - performs auth check */
  performAuthCheck: () => Promise<void>;
  /** Called when splash screen animation completes */
  handleSplashComplete: () => void;
  /** Called when user chooses to continue saved session */
  handleSessionContinue: () => void;
  /** Called when user chooses to abandon saved session */
  handleSessionAbandon: () => Promise<void>;
  /** Called after session has been successfully resumed */
  handleSessionResumed: () => void;
}

// =============================================================================
// Constants
// =============================================================================

/** Sessions younger than this will auto-resume without prompting */
const AUTO_RESUME_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook for managing the application boot sequence.
 * Encapsulates all boot-related state and logic.
 */
export function useBootSequence(): UseBootSequenceResult {
  const [stage, setStage] = useState<BootStage>("splash");
  const [isAuthenticated, setAuthenticated] = useState(checkAuth());
  const [savedSession, setSavedSession] = useState<ActiveSessionSnapshot | null>(null);

  // Set up sync status listener
  useEffect(() => {
    const unsubscribe = syncManager.addListener((status) => {
      syncStatus.value = status;
    });
    return unsubscribe;
  }, []);

  // Listen for auth invalidation
  useEffect(() => {
    const unsubscribe = onAuthInvalidated(() => {
      isAuthSignal.value = false;
      setAuthenticated(false);
      authLoading.value = false;
      authError.value = null;
      showSessionRecoveryModal.value = false;
      pendingSessionSnapshot.value = null;
      setSavedSession(null);
      clearGuestMode();
      clearActiveSession().catch((err) =>
        console.error("Failed to clear session:", err),
      );
    });
    return unsubscribe;
  }, []);

  // Auth check + session check in parallel (both run during splash)
  const performAuthCheck = useCallback(async (): Promise<void> => {
    // Run auth and session check in parallel
    const [, session] = await Promise.all([
      bootOrchestrator.performAuthCheck(),
      getActiveSession(null), // Check without userId validation first
    ]);

    // Sync internal state from orchestrator
    const isAuth = bootOrchestrator.isAuthenticated.value;
    setAuthenticated(isAuth);

    // If auth succeeded and session exists, set it up
    if (isAuth && session) {
      // Validate userId match now that we have auth
      const userId = getUserId();
      if (!session.userId || !userId || session.userId === userId) {
        setSavedSession(session);
        pendingSessionSnapshot.value = {
          sessionId: session.sessionId,
          savedAt: session.savedAt,
          fortressClass: session.fortressClass,
        };

        // Auto-resume fresh sessions, prompt for older ones
        const sessionAge = Date.now() - session.savedAt;
        if (sessionAge >= AUTO_RESUME_THRESHOLD_MS) {
          showSessionRecoveryModal.value = true;
        }
        // Fresh sessions: modal stays false, GameContainer auto-resumes
      }
    }
  }, []);

  // Handle splash screen completion - auth already done via onReady
  const handleSplashComplete = useCallback(() => {
    if (bootOrchestrator.isAuthenticated.value) {
      setStage("loading_profile");
    } else {
      // Auth failed - show auth screen
      setStage("ready");
    }
  }, []);

  const handleSessionContinue = useCallback(() => {
    // Session data is passed via savedSession state
    // GameContainer will use it to restore the session
  }, []);

  const handleSessionAbandon = useCallback(async () => {
    await clearActiveSession();
    setSavedSession(null);
    pendingSessionSnapshot.value = null;
    forceResetToHub.value = true; // Signal GameContainer to reset to hub
  }, []);

  const handleSessionResumed = useCallback(() => {
    setSavedSession(null);
    pendingSessionSnapshot.value = null;
  }, []);

  return {
    stage,
    setStage,
    isAuthenticated,
    setAuthenticated,
    savedSession,
    performAuthCheck,
    handleSplashComplete,
    handleSessionContinue,
    handleSessionAbandon,
    handleSessionResumed,
  };
}
