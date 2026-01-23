import Router from "preact-router";
import { useEffect, useState } from "preact/hooks";
import { Login } from "./pages/Login";
import { PlayersPage } from "./pages/PlayersPage.js";
import { PlayerDetailsPage } from "./pages/PlayerDetailsPage.js";
import { ConfigPage } from "./pages/ConfigPage.js";
import { ReplayPage } from "./pages/ReplayPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { EventsPage } from "./pages/EventsPage.js";
import { BannersPage } from "./pages/BannersPage.js";
import { BulkRewardsPage } from "./pages/BulkRewardsPage.js";
import { BugReportsPage } from "./pages/BugReportsPage.js";
import { SupportTicketsPage } from "./pages/SupportTicketsPage.js";
import { SupportTicketDetailPage } from "./pages/SupportTicketDetailPage.js";
import { SessionDebuggerPage } from "./pages/SessionDebuggerPage.js";
import { useAuth } from "./hooks/useAuth";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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
  const { isAuthenticated, refreshSession } = useAuth();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    refreshSession().finally(() => setCheckingAuth(false));
  }, [refreshSession]);

  if (checkingAuth) {
    return (
      <div style={{ padding: "40px", color: "#fff" }}>Checking session...</div>
    );
  }

  if (!isAuthenticated.value) {
    return <Login />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <DashboardLayout>
        <Router>
          <DashboardPage path="/" />
          <PlayersPage path="/players" />
          <EventsPage path="/events" />
          <BannersPage path="/banners" />
          <BulkRewardsPage path="/rewards" />
          <BugReportsPage path="/bug-reports" />
          <SupportTicketsPage path="/support-tickets" />
          <SupportTicketDetailPage path="/support-tickets/:id" />
          <SessionDebuggerPage path="/debug/:sessionId" />
          <PlayerDetailsPage path="/players/:id" />
          <ConfigPage path="/config" />
          <ReplayPage path="/replay/:id" />
        </Router>
      </DashboardLayout>
    </QueryClientProvider>
  );
}
