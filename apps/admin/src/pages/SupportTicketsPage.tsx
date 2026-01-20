import { useState } from 'preact/hooks';
import { useQuery } from '@tanstack/react-query';
import { adminApi, TicketStatus, TicketCategory } from '../api/adminClient.js';

const STATUS_LABELS: Record<TicketStatus, { label: string; color: string; bg: string }> = {
  OPEN: { label: 'Open', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
  IN_PROGRESS: { label: 'In Progress', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  RESOLVED: { label: 'Resolved', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' },
  CLOSED: { label: 'Closed', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.15)' },
};

const CATEGORY_LABELS: Record<TicketCategory, { label: string; icon: string }> = {
  BUG_REPORT: { label: 'Bug', icon: '🐛' },
  ACCOUNT_ISSUE: { label: 'Account', icon: '👤' },
  PAYMENT: { label: 'Payment', icon: '💳' },
  OTHER: { label: 'Other', icon: '💬' },
};

export function SupportTicketsPage(_: { path?: string }) {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<TicketCategory | ''>('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const { data: statsData } = useQuery({
    queryKey: ['support-tickets-stats'],
    queryFn: () => adminApi.getSupportTicketStats(),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['support-tickets', page, statusFilter, categoryFilter, search],
    queryFn: () => adminApi.getSupportTickets({
      page,
      limit: 20,
      status: statusFilter || undefined,
      category: categoryFilter || undefined,
      search: search || undefined,
    }),
    placeholderData: (previousData) => previousData,
  });

  const tickets = data?.tickets || [];
  const totalPages = data?.totalPages || 1;

  const handleSearch = (e: Event) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  if (isLoading && !data) return <div class="p-6">Loading support tickets...</div>;
  if (error) return <div class="p-6 text-red-500">Error: {(error as Error).message}</div>;

  return (
    <div class="p-6">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold">Support Tickets</h1>
        {statsData && (
          <div class="flex gap-4 text-sm">
            <span class="px-3 py-1 rounded" style={{ background: STATUS_LABELS.OPEN.bg, color: STATUS_LABELS.OPEN.color }}>
              Open: {statsData.open}
            </span>
            <span class="px-3 py-1 rounded" style={{ background: STATUS_LABELS.IN_PROGRESS.bg, color: STATUS_LABELS.IN_PROGRESS.color }}>
              In Progress: {statsData.inProgress}
            </span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div class="flex gap-4 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter((e.target as HTMLSelectElement).value as TicketStatus | '');
            setPage(1);
          }}
          class="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter((e.target as HTMLSelectElement).value as TicketCategory | '');
            setPage(1);
          }}
          class="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
        >
          <option value="">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([key, { label, icon }]) => (
            <option key={key} value={key}>{icon} {label}</option>
          ))}
        </select>

        <form onSubmit={handleSearch} class="flex-1 flex gap-2">
          <input
            type="text"
            value={searchInput}
            onInput={(e) => setSearchInput((e.target as HTMLInputElement).value)}
            placeholder="Search by user or subject..."
            class="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400"
          />
          <button type="submit" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded">
            Search
          </button>
        </form>
      </div>

      {/* Table */}
      <div class="bg-gray-800 rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-700">
          <thead class="bg-gray-700">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Category</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Subject</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">User</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Created</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-700">
            {tickets.map((ticket) => {
              const status = STATUS_LABELS[ticket.status];
              const category = CATEGORY_LABELS[ticket.category];
              return (
                <tr key={ticket.id} class="hover:bg-gray-750 transition-colors">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span
                      class="px-2 py-1 rounded text-xs font-medium"
                      style={{ background: status.bg, color: status.color }}
                    >
                      {status.label}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    <span title={category.label}>{category.icon} {category.label}</span>
                  </td>
                  <td class="px-6 py-4 text-sm text-white max-w-xs truncate">
                    {ticket.subject}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-white">{ticket.user.displayName}</div>
                    <div class="text-xs text-gray-400">@{ticket.user.username}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {formatDate(ticket.createdAt)}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <a
                      href={`/support-tickets/${ticket.id}`}
                      class="text-indigo-400 hover:text-indigo-300"
                    >
                      View
                    </a>
                  </td>
                </tr>
              );
            })}
            {tickets.length === 0 && !isLoading && (
              <tr>
                <td colspan={6} class="px-6 py-10 text-center text-gray-500">
                  No support tickets found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
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
