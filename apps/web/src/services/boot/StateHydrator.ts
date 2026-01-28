import type {
  ProfileResponse,
  LeaderboardEntry,
  PowerSummaryResponse,
  PlayerArtifact,
  PlayerItem,
} from "@arcade/protocol";
import { batch } from "@preact/signals";
import { setDisplayName } from "../../api/auth.js";
import {
  updateFromProfile,
  resetAllState,
  initializeHubFromLoadout,
} from "../../state/actions.js";
import {
  isAuthenticated as isAuthSignal,
  setGuestMode,
  updateLeaderboard,
  setPowerSummary,
  updateArtifacts,
  updateItems,
} from "../../state/index.js";
import { fetchEnergy } from "../../state/energy.signals.js";
import { fetchPillarUnlocks } from "../../state/pillarUnlocks.signals.js";
import { checkIdleRewards } from "../../state/idle.signals.js";
import { isFirstSession } from "../../state/game.signals.js";
import { getStatPointsSummary } from "../../api/stat-points.js";
import type { IStateHydrator, HydrateProfileOptions } from "./types.js";

// =============================================================================
// State Hydrator
// =============================================================================

/**
 * StateHydrator provides a clean interface for hydrating application state
 * from API responses. It consolidates all signal updates in one place.
 */
class StateHydrator implements IStateHydrator {
  /**
   * Hydrates all signals from profile data.
   * This is the main entry point after successful auth and profile fetch.
   */
  hydrateProfile(profile: ProfileResponse, options: HydrateProfileOptions = {}): void {
    batch(() => {
      // Core profile data → signals
      updateFromProfile(profile);

      // Auth signals
      setDisplayName(profile.displayName);
      isAuthSignal.value = true;

      // Guest mode sync
      setGuestMode(profile.isGuest ?? false);
    });

    // Initialize hub if onboarding is complete
    // For new players, GameContainer will auto-start the game and show onboarding after 5 seconds
    if (profile.onboardingCompleted) {
      initializeHubFromLoadout();
    }

    // Trigger async fetches (non-blocking)
    this.fetchDeferredData(profile, options);
  }

  /**
   * Hydrates leaderboard data into signals.
   */
  hydrateLeaderboard(entries: LeaderboardEntry[]): void {
    updateLeaderboard(entries);
  }

  /**
   * Hydrates power summary data into signals.
   */
  hydratePowerSummary(powerData: PowerSummaryResponse): void {
    setPowerSummary(powerData);
  }

  /**
   * Hydrates artifacts and items data into signals.
   */
  hydrateArtifacts(artifacts: PlayerArtifact[], items: PlayerItem[]): void {
    updateArtifacts(artifacts);
    updateItems(items);
  }

  /**
   * Fetch deferred/async data after profile hydration.
   * These requests run in parallel and don't block boot.
   */
  private fetchDeferredData(profile: ProfileResponse, options: HydrateProfileOptions): void {
    // Fetch energy for gameplay
    fetchEnergy();

    // Fetch pillar unlocks
    fetchPillarUnlocks();

    // Check for idle rewards (only for returning players, skip on session resume and first session)
    if (profile.onboardingCompleted && !options.skipIdleRewards && !isFirstSession.value) {
      checkIdleRewards();
    }

    // Fetch stat points (free points earned from waves/levels)
    getStatPointsSummary().catch((err) => {
      console.error('[StatPoints] Failed to fetch stat points:', err);
    });
  }

  /**
   * Resets all state to initial values.
   * Used on logout or when starting fresh.
   */
  reset(): void {
    resetAllState();
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const stateHydrator = new StateHydrator();
