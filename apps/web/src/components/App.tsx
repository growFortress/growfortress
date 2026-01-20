import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { AuthScreen } from "./auth/AuthScreen.js";
import { Header } from "./layout/Header.js";
import { GameContainer } from "./game/GameContainer.js";
import { Leaderboard } from "./layout/Leaderboard.js";
import { SyncStatus } from "./toasts/SyncStatus.js";
import { RewardsToast } from "./toasts/RewardsToast.js";
import { ErrorToast } from "./toasts/ErrorToast.js";
import { UnlockNotificationQueue } from "./game/UnlockNotification.js";
import { OnboardingModal } from "./modals/OnboardingModal.js";
import { SessionRecoveryModal } from "./modals/SessionRecoveryModal.js";
import { RewardsModal } from "./modals/RewardsModal.js";
import { SettingsMenu } from "./modals/SettingsMenu.js";
import { PvpPanel, PvpBattleResult, PvpReplayViewer } from "./pvp/index.js";
import {
  GuildPanel,
  GuildCreateModal,
  GuildSearchModal,
} from "./guild/index.js";
import { MessagesModal } from "./messages/MessagesModal.js";
import { LeaderboardModal } from "./modals/LeaderboardModal.js";
import { HubPreviewModal } from "./modals/HubPreviewModal.js";
import { GuildPreviewModal } from "./modals/GuildPreviewModal.js";
import { DailyQuestsModal } from "./modals/DailyQuestsModal.js";
import { BattlePassModal } from "./modals/BattlePassModal.js";
import { ShopModal } from "./modals/ShopModal.js";
import { LegalModal } from "./modals/LegalModal.js";
import { SupportPage } from "./support/SupportPage.js";
import { ArtifactsModal } from "./modals/ArtifactsModal.js";
import { IdleRewardsModal } from "./modals/IdleRewardsModal.js";
import { PillarUnlockModal } from "./modals/PillarUnlockModal.js";
import { AdminBroadcastPanel, AdminModerationPanel } from "./admin/index.js";
import { ErrorBoundary } from "./shared/ErrorBoundary.js";
import { LoadingScreen } from "./shared/LoadingScreen.js";
import { ScreenReaderAnnouncer } from "./shared/ScreenReaderAnnouncer.js";
import { MinimumScreenSize } from "./shared/MinimumScreenSize.js";
import { CookieBanner } from "./shared/CookieBanner.js";
import { syncManager } from "../storage/sync.js";
import {
  getActiveSession,
  clearActiveSession,
  type ActiveSessionSnapshot,
} from "../storage/idb.js";
import {
  login,
  register,
  getProfile,
  getLeaderboard,
  getPowerSummary,
  refreshTokensApi,
  getArtifacts,
  logout,
} from "../api/client.js";
import {
  isAuthenticated as checkAuth,
  clearTokens,
  setDisplayName,
  onAuthInvalidated,
} from "../api/auth.js";
import { useTranslation } from "../i18n/useTranslation.js";
import {
  authError,
  authLoading,
  checkIdleRewards,
  cleanupMessagesWebSocket,
  dismissUnlockNotification,
  fetchDailyQuests,
  forceResetToHub,
  initMessagesWebSocket,
  initializeHubFromLoadout,
  isAuthenticated as isAuthSignal,
  pendingSessionSnapshot,
  refreshUnreadCounts,
  setPowerSummary,
  showOnboardingModal,
  showSessionRecoveryModal,
  syncStatus,
  unlockNotifications,
  updateArtifacts,
  updateFromProfile,
  updateItems,
  updateLeaderboard,
  pillarUnlockModalVisible,
  closePillarUnlockModal,
} from "../state/index.js";
import { fetchEnergy } from "../state/energy.signals.js";
import { fetchPillarUnlocks } from "../state/pillarUnlocks.signals.js";

import {
  useQuery,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: 1,
      staleTime: 1000 * 30, // 30 seconds
    },
  },
});

// Loading stages for the app initialization
type LoadingStage =
  | "checking_session" // Sprawdzanie lokalnej sesji
  | "verifying_tokens" // Weryfikacja/odświeżanie tokenów
  | "loading_profile" // Ładowanie profilu gracza
  | "initializing" // Inicjalizacja systemu gry
  | "ready"; // Gotowe

// Single consistent loading message - no stage changes for seamless UX
const LOADING_MESSAGE = "Ładowanie...";

export function App() {
  return (
    <MinimumScreenSize>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </MinimumScreenSize>
  );
}

function AppContent() {
  const [loadingStage, setLoadingStage] =
    useState<LoadingStage>("checking_session");
  const [savedSession, setSavedSession] =
    useState<ActiveSessionSnapshot | null>(null);

  // Core Authentication State
  const [internalAuth, setInternalAuth] = useState(checkAuth());
  const { t } = useTranslation("auth");

  // Profile Query
  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
    enabled: internalAuth,
  });

  // Leaderboard Query
  const { data: leaderboardData } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => getLeaderboard(),
    enabled: internalAuth,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Power Summary Query
  const { data: powerData } = useQuery({
    queryKey: ["power-summary"],
    queryFn: getPowerSummary,
    enabled: internalAuth,
  });

  // Artifacts Query
  const { data: artifactsData } = useQuery({
    queryKey: ["artifacts"],
    queryFn: getArtifacts,
    enabled: internalAuth,
  });

  // Sync Profile to Signals
  useEffect(() => {
    if (profile) {
      // Przejdź do etapu inicjalizacji
      setLoadingStage("initializing");

      updateFromProfile(profile);
      setDisplayName(profile.displayName);
      isAuthSignal.value = true;

      if (!profile.onboardingCompleted) {
        showOnboardingModal.value = true;
      } else {
        initializeHubFromLoadout();
      }

      // Check for idle rewards and daily quests after profile loads
      checkIdleRewards();
      fetchDailyQuests();
      fetchEnergy();
      fetchPillarUnlocks();

      // Po krótkiej chwili na inicjalizację - gotowe
      const timer = setTimeout(() => {
        setLoadingStage("ready");
        authLoading.value = false; // Clear loading state after profile is loaded
      }, 150);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [profile]);

  // Sync Leaderboard to Signals
  useEffect(() => {
    if (leaderboardData) {
      updateLeaderboard(leaderboardData.entries);
    }
  }, [leaderboardData]);

  // Sync Power Summary to Signals
  useEffect(() => {
    if (powerData) {
      setPowerSummary(powerData);
    }
  }, [powerData]);

  // Sync Artifacts to Signals
  useEffect(() => {
    if (artifactsData) {
      updateArtifacts(artifactsData.artifacts);
      updateItems(artifactsData.items);
    }
  }, [artifactsData]);

  // Initialize WebSocket for real-time messaging when authenticated
  useEffect(() => {
    if (internalAuth && profile) {
      initMessagesWebSocket();
      refreshUnreadCounts();
    }

    return () => {
      if (internalAuth && profile) {
        cleanupMessagesWebSocket();
      }
    };
  }, [internalAuth, profile]);

  // Check for session recovery when auth is confirmed
  useEffect(() => {
    if (internalAuth) {
      getActiveSession().then((session) => {
        if (session) {
          setSavedSession(session);
          pendingSessionSnapshot.value = {
            sessionId: session.sessionId,
            savedAt: session.savedAt,
            fortressClass: session.fortressClass,
          };
          showSessionRecoveryModal.value = true;
        }
      });
    }
  }, [internalAuth]);

  // Set up sync status listener
  useEffect(() => {
    const unsubscribe = syncManager.addListener((status) => {
      syncStatus.value = status;
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthInvalidated(() => {
      isAuthSignal.value = false;
      setInternalAuth(false);
      authLoading.value = false;
      authError.value = null;
      showSessionRecoveryModal.value = false;
      pendingSessionSnapshot.value = null;
      setSavedSession(null);
      clearActiveSession().catch((err) =>
        console.error("Failed to clear session:", err),
      );
    });
    return unsubscribe;
  }, []);

  // Initial Auth Check
  useEffect(() => {
    const init = async () => {
      try {
        if (checkAuth()) {
          setLoadingStage("loading_profile");
          return;
        }

        setLoadingStage("verifying_tokens");
        const refreshed = await refreshTokensApi();

        if (refreshed) {
          setInternalAuth(true);
          setLoadingStage("loading_profile");
        } else {
          await clearActiveSession();
          setSavedSession(null);
          pendingSessionSnapshot.value = null;
          setLoadingStage("ready");
        }
      } catch {
        clearTokens();
        isAuthSignal.value = false;
        setInternalAuth(false);
        setLoadingStage("ready");
      }
    };
    init();
  }, []);

  const handleLogin = async (username: string, password: string) => {
    authLoading.value = true;
    authError.value = null;

    try {
      await login({ username, password });
      setInternalAuth(true);
      setLoadingStage("loading_profile");
      // Force refetch profile immediately after successful login
      await refetchProfile();
    } catch (error) {
      if (error instanceof Error && "status" in error) {
        const status = (error as { status: number }).status;
        if (status === 401) {
          authError.value = t("errors.invalidCredentials");
        } else if (status === 403) {
          authError.value = t("errors.accountBanned");
        } else if (status === 400) {
          authError.value =
            t("errors.invalidUsernameFormat");
        } else {
          authError.value =
            t("errors.connectionFailed");
        }
      } else {
        authError.value =
          t("errors.connectionFailed");
      }
      authLoading.value = false;
    }
  };

  const handleRegister = async (username: string, password: string) => {
    authLoading.value = true;
    authError.value = null;

    try {
      await register({ username, password });
      setInternalAuth(true);
      setLoadingStage("loading_profile");
      // Force refetch profile immediately after successful registration
      await refetchProfile();
    } catch (error) {
      if (
        error instanceof Error &&
        "status" in error &&
        (error as { status: number }).status === 400
      ) {
        authError.value =
          t("errors.registrationFailed");
      } else if (
        error instanceof Error &&
        error.message.includes("Validation")
      ) {
        authError.value = t("errors.validationError");
      } else {
        authError.value =
          t("errors.connectionFailed");
      }
      authLoading.value = false;
    }
  };

  const handleLogout = async () => {
    await logout();
    isAuthSignal.value = false;
    setInternalAuth(false);
  };

  const loadProfile = async () => {
    try {
      const profile = await getProfile();
      updateFromProfile(profile);

      // Check for idle rewards after profile loads
      checkIdleRewards();

      // Fetch daily quests status
      fetchDailyQuests();
      fetchEnergy();
      fetchPillarUnlocks();
    } catch {
      // Silently fail
    }
  };

  const handleSessionContinue = () => {
    // Session data is passed via savedSession state
    // GameContainer will use it to restore the session
  };

  const handleSessionAbandon = async () => {
    await clearActiveSession();
    setSavedSession(null);
    pendingSessionSnapshot.value = null;
    forceResetToHub.value = true; // Signal GameContainer to reset to hub
  };

  const handleSessionResumed = () => {
    setSavedSession(null);
    pendingSessionSnapshot.value = null;
  };

  let content: ComponentChildren;

  // Pokaż ekran ładowania podczas inicjalizacji
  if (loadingStage !== "ready") {
    // Pokaż AuthScreen gdy nie ma uwierzytelnienia i zakończyliśmy sprawdzanie
    if (loadingStage !== "checking_session" && !internalAuth) {
      content = (
        <AuthScreen onLogin={handleLogin} onRegister={handleRegister} />
      );
    } else {
      // Jeden spójny ekran ładowania - identyczny jak HTML loader
      content = <LoadingScreen message={LOADING_MESSAGE} />;
    }
  } else if (!isAuthSignal.value) {
    content = <AuthScreen onLogin={handleLogin} onRegister={handleRegister} />;
  } else {
    content = (
      <ErrorBoundary>
        {/* Screen reader announcer for live updates */}
        <ScreenReaderAnnouncer />

        {/* Skip links for keyboard navigation */}
        <a
          href="#main-content"
          class="skip-link"
          style={{
            position: "absolute",
            top: "-40px",
            left: 0,
            background: "var(--color-primary)",
            color: "var(--color-bg)",
            padding: "8px 16px",
            zIndex: 9999,
            textDecoration: "none",
            fontWeight: "bold",
          }}
          onFocus={(e) => {
            (e.target as HTMLElement).style.top = "0";
          }}
          onBlur={(e) => {
            (e.target as HTMLElement).style.top = "-40px";
          }}
        >
          Przejdź do głównej zawartości
        </a>

        <div id="app">
          <Header />
          <main id="main-content" role="main" aria-label="Gra Grow Fortress">
            <GameContainer
              onLoadProfile={loadProfile}
              savedSession={savedSession}
              onSessionResumeFailed={handleSessionAbandon}
              onSessionResumed={handleSessionResumed}
            />
          </main>
          <aside role="complementary" aria-label="Ranking graczy">
            <Leaderboard />
          </aside>
        </div>

        {/* Toast notifications */}
        <div role="region" aria-label="Powiadomienia" aria-live="polite">
          <SyncStatus />
          <RewardsToast />
          <ErrorToast />
          <UnlockNotificationQueue
            notifications={unlockNotifications.value}
            onDismiss={dismissUnlockNotification}
          />
        </div>

        {/* Modal dialogs */}
        <OnboardingModal />
        <RewardsModal />
        <SessionRecoveryModal
          onContinue={handleSessionContinue}
          onAbandon={handleSessionAbandon}
        />
        <SettingsMenu onLogout={handleLogout} />
        <PvpPanel />
        <PvpBattleResult />
        <PvpReplayViewer />
        <GuildPanel />
        <GuildCreateModal onSuccess={() => {}} />
        <GuildSearchModal onSuccess={() => {}} />
        <MessagesModal />
        <LeaderboardModal />
        <HubPreviewModal />
        <GuildPreviewModal />
        <DailyQuestsModal />
        <BattlePassModal />
        <ShopModal />
        <ArtifactsModal />
        <IdleRewardsModal />
        <PillarUnlockModal
          visible={pillarUnlockModalVisible.value}
          onClose={closePillarUnlockModal}
        />
        <AdminBroadcastPanel />
        <AdminModerationPanel />
      </ErrorBoundary>
    );
  }

  return (
    <>
      {content}
      <LegalModal />
      <SupportPage />
      <CookieBanner />
    </>
  );
}
