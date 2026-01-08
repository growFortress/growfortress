import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../api/adminClient.js';
import { LineChart } from '../components/LineChart.js';

export function DashboardPage(_: { path?: string }) {
  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ['dashboard', 'stats-and-charts'],
    queryFn: async () => {
      const [stats, charts] = await Promise.all([
        adminApi.getDashboardStats(),
        adminApi.getDashboardCharts()
      ]);
      return { stats, charts };
    },
    refetchInterval: 30000,
  });

  const stats = dashboardData?.stats;
  const charts = dashboardData?.charts || [];

  if (isLoading && !dashboardData) {
    return <div class="p-8 text-center text-gray-500">Loading dashboard...</div>;
  }

  if (error) {
    return <div class="p-8 text-center text-red-500">Error loading dashboard: {(error as Error).message}</div>;
  }

  return (
    <div class="p-4 md:p-8 space-y-8">
      <header class="flex justify-between items-center">
        <h1 class="text-3xl font-bold text-gray-900 font-outfit">Real-time Dashboard</h1>
        <div class="text-xs text-gray-400">Last updated: {new Date().toLocaleTimeString()}</div>
      </header>

      {/* Metric Cards */}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div class="text-sm font-medium text-gray-500 mb-1">Concurrent Users (CCU)</div>
          <div class="text-3xl font-bold text-indigo-600">{stats?.ccu || 0}</div>
          <div class="mt-4 h-24">
            <LineChart 
              data={charts.map(c => ({ timestamp: c.timestamp, value: c.ccu }))} 
              color="#6366f1" 
              height={100}
            />
          </div>
        </div>

        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div class="text-sm font-medium text-gray-500 mb-1">Active Game Sessions</div>
          <div class="text-3xl font-bold text-emerald-600">{stats?.activeSessions || 0}</div>
          <div class="mt-4 h-24">
            <LineChart 
              data={charts.map(c => ({ timestamp: c.timestamp, value: c.activeSessions }))} 
              color="#10b981" 
              height={100}
            />
          </div>
        </div>

        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div class="text-sm font-medium text-gray-500 mb-1">API Errors (Last Hour)</div>
          <div class="text-3xl font-bold text-rose-600">{stats?.errorCount || 0}</div>
          <div class="mt-4 h-24">
            <LineChart 
              data={charts.map(c => ({ timestamp: c.timestamp, value: c.errorCount }))} 
              color="#f43f5e" 
              height={100}
            />
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-6">
        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 class="text-lg font-semibold mb-4 text-gray-700">System Activity (24h)</h2>
          <div class="h-64">
            <LineChart 
              data={charts.map(c => ({ timestamp: c.timestamp, value: c.ccu }))} 
              color="#6366f1" 
              height={250}
            />
          </div>
          <div class="mt-4 flex justify-between items-center text-xs text-gray-400">
            <span>24 hours ago</span>
            <span>Now</span>
          </div>
        </div>
      </div>
    </div>
  );
}
