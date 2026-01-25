import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import { AuthScreen } from "./auth/AuthScreen.js";
import { Header } from "./layout/Header.js";
import { GameContainer } from "./game/GameContainer.js";
import { Leaderboard } from "./layout/Leaderboard.js";
import { ModalLayer } from "./layout/ModalLayer.js";
import { ToastLayer } from "./layout/ToastLayer.js";
import { ErrorBoundary } from "./shared/ErrorBoundary.js";
import { LoadingScreen } from "./shared/LoadingScreen.js";
import { SplashScreen } from "./shared/SplashScreen.js";
import { ScreenReaderAnnouncer } from "./shared/ScreenReaderAnnouncer.js";
import { MinimumScreenSize } from "./shared/MinimumScreenSize.js";
import { CookieBanner } from "./shared/CookieBanner.js";
import { LegalModal } from "./modals/LegalModal.js";
import { SupportPage } from "./support/SupportPage.js";
import { Analytics } from "@vercel/analytics/react";
import { useTranslation } from "../i18n/useTranslation.js";
import { isAuthenticated as isAuthSignal } from "../state/index.js";
import { captureReferralCodeFromUrl } from "../utils/referral.js";
import { useBootSequence } from "../hooks/useBootSequence.js";
import { useAuth } from "../hooks/useAuth.js";
import { useProfileSync } from "../hooks/useProfileSync.js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: 1,
      staleTime: 1000 * 30,
    },
  },
});

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
  const { t } = useTranslation(["common"]);

  useEffect(() => {
    captureReferralCodeFromUrl();
  }, []);

  // Boot sequence
  const boot = useBootSequence();

  // Auth handlers
  const onAuthSuccess = () => {
    boot.setAuthenticated(true);
    boot.setStage("loading_profile");
  };
  const { handleLogin, handleRegister, handleGuestLogin, handleLogout } = useAuth(onAuthSuccess);

  // Profile sync
  const { refetchProfile } = useProfileSync({
    isAuthenticated: boot.isAuthenticated,
    hasSavedSession: !!boot.savedSession,
    setStage: boot.setStage,
  });

  const loadProfile = async () => {
    try {
      await refetchProfile();
    } catch {
      // Silently fail
    }
  };

  // Render based on boot stage
  let content: ComponentChildren;

  if (boot.stage === "splash") {
    content = (
      <SplashScreen
        minDurationMs={1500}
        onReady={boot.performAuthCheck}
        onComplete={boot.handleSplashComplete}
      />
    );
  } else if (boot.stage !== "ready") {
    content = <LoadingScreen message={LOADING_MESSAGE} />;
  } else if (!isAuthSignal.value) {
    content = (
      <AuthScreen
        onLogin={handleLogin}
        onRegister={handleRegister}
        onGuestLogin={handleGuestLogin}
      />
    );
  } else {
    content = (
      <ErrorBoundary>
        <ScreenReaderAnnouncer />
        <SkipLink label={t("common:app.skipToContent")} />

        <div id="app">
          <Header />
          <main id="main-content" role="main" aria-label={t("common:app.gameAriaLabel")}>
            <GameContainer
              onLoadProfile={loadProfile}
              savedSession={boot.savedSession}
              onSessionResumeFailed={boot.handleSessionAbandon}
              onSessionResumed={boot.handleSessionResumed}
            />
          </main>
          <aside role="complementary" aria-label={t("common:app.leaderboardAriaLabel")}>
            <Leaderboard />
          </aside>
        </div>

        <ToastLayer />
        <ModalLayer
          onLogout={handleLogout}
          onSessionContinue={boot.handleSessionContinue}
          onSessionAbandon={boot.handleSessionAbandon}
        />
      </ErrorBoundary>
    );
  }

  return (
    <>
      {content}
      <LegalModal />
      <SupportPage />
      <CookieBanner />
      <Analytics />
    </>
  );
}

/** Accessibility skip link for keyboard navigation */
function SkipLink({ label }: { label: string }) {
  return (
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
      {label}
    </a>
  );
}
