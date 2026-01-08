import Router from 'preact-router';
import { Login } from './pages/Login';
import { PlayersPage } from './pages/PlayersPage.js';
import { PlayerDetailsPage } from './pages/PlayerDetailsPage.js';
import { ConfigPage } from './pages/ConfigPage.js';
import { ReplayPage } from './pages/ReplayPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { EventsPage } from './pages/EventsPage.js';
import { BulkRewardsPage } from './pages/BulkRewardsPage.js';
import { BugReportsPage } from './pages/BugReportsPage.js';
import { SessionDebuggerPage } from './pages/SessionDebuggerPage.js';
import { useAuth } from './hooks/useAuth';
import { DashboardLayout } from './layouts/DashboardLayout';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
  const { isAuthenticated } = useAuth();

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
          <BulkRewardsPage path="/rewards" />
          <BugReportsPage path="/bug-reports" />
          <SessionDebuggerPage path="/debug/:sessionId" />
          <PlayerDetailsPage path="/players/:id" />
          <ConfigPage path="/config" />
          <ReplayPage path="/replay/:id" />
        </Router>
      </DashboardLayout>
    </QueryClientProvider>
  );
}