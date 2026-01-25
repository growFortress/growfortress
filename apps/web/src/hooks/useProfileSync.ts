import { useEffect, useState } from "preact/hooks";
import { useQuery } from "@tanstack/react-query";
import type { ProfileResponse } from "@arcade/protocol";
import {
  getProfile,
  getLeaderboard,
  getPowerSummary,
  getArtifacts,
} from "../api/client.js";
import { stateHydrator } from "../services/boot/index.js";
import { authLoading } from "../state/index.js";
import {
  initMessagesWebSocket,
  cleanupMessagesWebSocket,
  refreshUnreadCounts,
} from "../state/index.js";
import type { BootStage } from "./useBootSequence.js";

export interface UseProfileSyncOptions {
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Whether there's a saved session (to skip idle rewards) */
  hasSavedSession: boolean;
  /** Callback to set boot stage */
  setStage: (stage: BootStage) => void;
}

export interface UseProfileSyncResult {
  /** Profile data from server */
  profile: ProfileResponse | undefined;
  /** Refetch profile data */
  refetchProfile: () => Promise<unknown>;
  /** Whether profile has loaded */
  isProfileLoaded: boolean;
}

/**
 * Hook for syncing profile and related data to signals.
 * Handles deferred queries for new players to optimize boot time.
 */
export function useProfileSync({
  isAuthenticated,
  hasSavedSession,
  setStage,
}: UseProfileSyncOptions): UseProfileSyncResult {
  // Profile Query
  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
    enabled: isAuthenticated,
  });

  // Deferred queries - enabled after game ready or 10 seconds
  const [deferredQueriesEnabled, setDeferredQueriesEnabled] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    // For returning players with completed onboarding, enable immediately
    if (profile?.onboardingCompleted) {
      setDeferredQueriesEnabled(true);
      return;
    }

    // For new players, defer for 10 seconds to prioritize game start
    const timer = setTimeout(() => {
      setDeferredQueriesEnabled(true);
    }, 10000);

    return () => clearTimeout(timer);
  }, [isAuthenticated, profile?.onboardingCompleted]);

  // Deferred queries
  const { data: leaderboardData } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => getLeaderboard(),
    enabled: isAuthenticated && deferredQueriesEnabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: powerData } = useQuery({
    queryKey: ["power-summary"],
    queryFn: getPowerSummary,
    enabled: isAuthenticated && deferredQueriesEnabled,
  });

  const { data: artifactsData } = useQuery({
    queryKey: ["artifacts"],
    queryFn: getArtifacts,
    enabled: isAuthenticated && deferredQueriesEnabled,
  });

  // Sync Profile to Signals using StateHydrator
  useEffect(() => {
    if (profile) {
      setStage("initializing");
      stateHydrator.hydrateProfile(profile, {
        skipIdleRewards: hasSavedSession,
      });
      setStage("ready");
      authLoading.value = false;
    }
  }, [profile, hasSavedSession, setStage]);

  // Sync deferred data to signals
  useEffect(() => {
    if (leaderboardData) {
      stateHydrator.hydrateLeaderboard(leaderboardData.entries);
    }
  }, [leaderboardData]);

  useEffect(() => {
    if (powerData) {
      stateHydrator.hydratePowerSummary(powerData);
    }
  }, [powerData]);

  useEffect(() => {
    if (artifactsData) {
      stateHydrator.hydrateArtifacts(artifactsData.artifacts, artifactsData.items);
    }
  }, [artifactsData]);

  // Initialize WebSocket for real-time messaging
  useEffect(() => {
    if (isAuthenticated && profile) {
      initMessagesWebSocket();
      refreshUnreadCounts();
    }
    return () => {
      if (isAuthenticated && profile) {
        cleanupMessagesWebSocket();
      }
    };
  }, [isAuthenticated, profile]);

  return {
    profile,
    refetchProfile,
    isProfileLoaded: !!profile,
  };
}
