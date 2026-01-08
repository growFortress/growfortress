import { useEffect, useState } from 'preact/hooks';
import { AuthScreen } from './auth/AuthScreen.js';
import { Header } from './layout/Header.js';
import { GameContainer } from './game/GameContainer.js';
import { Leaderboard } from './layout/Leaderboard.js';
import { SyncStatus } from './toasts/SyncStatus.js';
import { RewardsToast } from './toasts/RewardsToast.js';
import { ErrorToast } from './toasts/ErrorToast.js';
import { UnlockNotificationQueue } from './game/UnlockNotification.js';
import { OnboardingModal } from './modals/OnboardingModal.js';
import { SessionRecoveryModal } from './modals/SessionRecoveryModal.js';
import { PowerUpgradeModal } from './modals/PowerUpgradeModal.js';
import { RewardsModal } from './modals/RewardsModal.js';
import { SettingsMenu } from './modals/SettingsMenu.js';
import { PvpPanel, PvpBattleResult, PvpReplayViewer } from './pvp/index.js';
import { ErrorBoundary } from './shared/ErrorBoundary.js';
import { LoadingScreen } from './shared/LoadingScreen.js';
import { syncManager } from '../storage/sync.js';
import { getActiveSession, clearActiveSession, type ActiveSessionSnapshot } from '../storage/idb.js';
import { login, register, getProfile, getLeaderboard, getPowerSummary, refreshTokensApi } from '../api/client.js';
import {
  isAuthenticated as isAuthSignal,
  authLoading,
  authError,
  updateFromProfile,
  updateLeaderboard,
  syncStatus,
  showOnboardingModal,
  showSessionRecoveryModal,
  pendingSessionSnapshot,
  initializeHubFromLoadout,
  setPowerSummary,
  checkIdleRewards,
  unlockNotifications,
  dismissUnlockNotification,
} from '../state/index.js';
import {
  isAuthenticated as checkAuth,
  clearTokens,
  setDisplayName,
  getRefreshToken,
  onAuthInvalidated,
} from '../api/auth.js';
import { useQuery, QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: 1,
      staleTime: 1000 * 30, // 30 seconds
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

function AppContent() {
  const [appReady, setAppReady] = useState(false);
  const [savedSession, setSavedSession] = useState<ActiveSessionSnapshot | null>(null);

  // Core Authentication State
  const [internalAuth, setInternalAuth] = useState(checkAuth());

  // Profile Query
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
    enabled: internalAuth,
  });

  // Leaderboard Query
  const { data: leaderboardData } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => getLeaderboard(),
    enabled: internalAuth,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Power Summary Query
  const { data: powerData } = useQuery({
    queryKey: ['power-summary'],
    queryFn: getPowerSummary,
    enabled: internalAuth,
  });

  // Sync Profile to Signals
  useEffect(() => {
    if (profile) {
      updateFromProfile(profile);
      setDisplayName(profile.displayName);
      isAuthSignal.value = true;

      if (!profile.onboardingCompleted) {
        showOnboardingModal.value = true;
      } else {
        initializeHubFromLoadout();
      }
    }
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

  // Check for session recovery when auth is confirmed
  useEffect(() => {
    if (internalAuth) {
      getActiveSession().then(session => {
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
      clearActiveSession().catch(err => console.error('Failed to clear session:', err));
    });
    return unsubscribe;
  }, []);

  // Initial Auth Check
  useEffect(() => {
    const init = async () => {
      try {
        if (!checkAuth()) {
          const refreshToken = getRefreshToken();
          if (refreshToken) {
            const refreshed = await refreshTokensApi(refreshToken);
            if (refreshed) {
              setInternalAuth(true);
            }
          } else {
            await clearActiveSession();
            setSavedSession(null);
            pendingSessionSnapshot.value = null;
          }
        }
      } catch {
        clearTokens();
        isAuthSignal.value = false;
        setInternalAuth(false);
      } finally {
        setAppReady(true);
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
    } catch (error) {
      if (error instanceof Error && 'status' in error) {
        const status = (error as { status: number }).status;
        if (status === 401) {
          authError.value = 'Nieprawidłowa nazwa użytkownika lub hasło';
        } else if (status === 400) {
          authError.value = 'Sprawdź poprawność danych (max 20 znaków, tylko litery, cyfry i _)';
        } else {
          authError.value = 'Nie udało się połączyć z serwerem. Spróbuj ponownie.';
        }
      } else {
        authError.value = 'Nie udało się połączyć z serwerem. Spróbuj ponownie.';
      }
    } finally {
      authLoading.value = false;
    }
  };

  const handleRegister = async (username: string, password: string) => {
    authLoading.value = true;
    authError.value = null;

    try {
      await register({ username, password });
      setInternalAuth(true);
    } catch (error) {
      if (error instanceof Error && 'status' in error && (error as { status: number }).status === 409) {
        authError.value = 'Ta nazwa jest już zajęta';
      } else if (error instanceof Error && error.message.includes('Validation')) {
        authError.value = 'Sprawdź poprawność wprowadzonych danych';
      } else {
        authError.value = 'Nie udało się połączyć z serwerem. Spróbuj ponownie.';
      }
    } finally {
      authLoading.value = false;
    }
  };

  const handleLogout = () => {
    clearTokens();
    isAuthSignal.value = false;
    setInternalAuth(false);
  };

  const loadProfile = async () => {
    try {
      const profile = await getProfile();
      updateFromProfile(profile);

      // Check for idle rewards after profile loads
      checkIdleRewards();
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
  };

  const handleSessionResumed = () => {
    setSavedSession(null);
    pendingSessionSnapshot.value = null;
  };

  // Don't render until we've checked auth
  if (!appReady) {
    return <LoadingScreen message="Connecting to server..." />;
  }

  if (!isAuthSignal.value) {
    return <AuthScreen onLogin={handleLogin} onRegister={handleRegister} />;
  }

  return (
    <ErrorBoundary>
      <div id="app">
        <Header />
        <GameContainer
          onLoadProfile={loadProfile}
          savedSession={savedSession}
          onSessionResumeFailed={handleSessionAbandon}
          onSessionResumed={handleSessionResumed}
        />
        <Leaderboard />
      </div>
      <SyncStatus />
      <RewardsToast />
      <ErrorToast />
      <UnlockNotificationQueue
        notifications={unlockNotifications.value}
        onDismiss={dismissUnlockNotification}
      />
      <OnboardingModal />
      <PowerUpgradeModal />
      <RewardsModal />
      <SessionRecoveryModal
        onContinue={handleSessionContinue}
        onAbandon={handleSessionAbandon}
      />
      <SettingsMenu onLogout={handleLogout} />
      <PvpPanel />
      <PvpBattleResult />
      <PvpReplayViewer />
    </ErrorBoundary>
  );
}
