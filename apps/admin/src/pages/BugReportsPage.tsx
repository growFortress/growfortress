import { useState } from 'preact/hooks';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../api/adminClient.js';

export function BugReportsPage(_: { path?: string }) {
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['bug-reports', page],
    queryFn: () => adminApi.getBugReports(page),
    placeholderData: (previousData) => previousData,
  });

  const reports = data?.reports || [];
  const totalPages = data?.totalPages || 1;

  if (isLoading && !data) return <div class="p-6">Loading bug reports...</div>;
  if (error) return <div class="p-6 text-red-500">Error: {(error as Error).message}</div>;

  return (
    <div class="p-6">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold">Bug Reports</h1>
      </div>

      <div class="bg-gray-800 rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-700">
          <thead class="bg-gray-700">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">User</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Session</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Tick</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Description</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Date</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-700">
            {reports.map((report) => (
              <tr key={report.id} class="hover:bg-gray-750 transition-colors">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm font-medium text-white">{report.user.displayName}</div>
                  <div class="text-xs text-gray-400">@{report.user.username}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  <span class="font-mono">{report.sessionId.substring(0, 8)}...</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {report.tick}
                </td>
                <td class="px-6 py-4 text-sm text-gray-300 max-w-xs truncate">
                  {report.description}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {new Date(report.createdAt).toLocaleString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <a 
                    href={`/debug/${report.sessionId}?tick=${report.tick}&reportId=${report.id}`}
                    class="text-indigo-400 hover:text-indigo-300"
                  >
                    Debug
                  </a>
                </td>
              </tr>
            ))}
            {reports.length === 0 && !isLoading && (
              <tr>
                <td colspan={6} class="px-6 py-10 text-center text-gray-500">
                  No bug reports found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div class="mt-4 flex justify-center gap-2">
          <button 
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            class="px-4 py-2 bg-gray-700 rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span class="px-4 py-2">Page {page} of {totalPages}</span>
          <button 
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
            class="px-4 py-2 bg-gray-700 rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
