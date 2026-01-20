import { useState } from 'preact/hooks';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, TicketStatus, TicketCategory } from '../api/adminClient.js';
import { Button } from '../components/ui/Button.js';

interface Props {
  path?: string;
  id?: string;
}

const STATUS_LABELS: Record<TicketStatus, { label: string; color: string; bg: string }> = {
  OPEN: { label: 'Open', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
  IN_PROGRESS: { label: 'In Progress', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  RESOLVED: { label: 'Resolved', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' },
  CLOSED: { label: 'Closed', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.15)' },
};

const CATEGORY_LABELS: Record<TicketCategory, { label: string; icon: string }> = {
  BUG_REPORT: { label: 'Bug Report', icon: '🐛' },
  ACCOUNT_ISSUE: { label: 'Account Issue', icon: '👤' },
  PAYMENT: { label: 'Payment', icon: '💳' },
  OTHER: { label: 'Other', icon: '💬' },
};

export function SupportTicketDetailPage({ id }: Props) {
  const queryClient = useQueryClient();
  const [responseContent, setResponseContent] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus | ''>('');

  const { data: ticket, isLoading, error } = useQuery({
    queryKey: ['support-ticket', id],
    queryFn: () => adminApi.getSupportTicket(id!),
    enabled: !!id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: TicketStatus) => adminApi.updateSupportTicketStatus(id!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-ticket', id] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets-stats'] });
      setSelectedStatus('');
    },
  });

  const addResponseMutation = useMutation({
    mutationFn: (content: string) => adminApi.addSupportTicketResponse(id!, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-ticket', id] });
      setResponseContent('');
    },
  });

  const handleSubmitResponse = (e: Event) => {
    e.preventDefault();
    if (!responseContent.trim()) return;
    addResponseMutation.mutate(responseContent);
  };

  const handleStatusChange = () => {
    if (!selectedStatus) return;
    updateStatusMutation.mutate(selectedStatus);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) return <div class="p-6">Loading ticket...</div>;
  if (error) return <div class="p-6 text-red-500">Error: {(error as Error).message}</div>;
  if (!ticket) return <div class="p-6">Ticket not found</div>;

  const status = STATUS_LABELS[ticket.status];
  const category = CATEGORY_LABELS[ticket.category];

  return (
    <div class="p-6 max-w-4xl mx-auto">
      {/* Back link */}
      <a href="/support-tickets" class="text-indigo-400 hover:text-indigo-300 mb-4 inline-block">
        &larr; Back to list
      </a>

      {/* Ticket header */}
      <div class="bg-gray-800 rounded-lg p-6 mb-6">
        <div class="flex justify-between items-start mb-4">
          <div>
            <h1 class="text-xl font-bold text-white mb-2">Ticket #{ticket.id.substring(0, 8)}</h1>
            <div class="flex gap-4 text-sm text-gray-400">
              <span>Created: {formatDate(ticket.createdAt)}</span>
              <span>Updated: {formatDate(ticket.updatedAt)}</span>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <span
              class="px-3 py-1 rounded text-sm font-medium"
              style={{ background: status.bg, color: status.color }}
            >
              {status.label}
            </span>
            <span class="text-sm text-gray-300">
              {category.icon} {category.label}
            </span>
          </div>
        </div>

        {/* User info */}
        <div class="mb-4 p-3 bg-gray-700 rounded">
          <span class="text-gray-400 text-sm">Submitted by: </span>
          <a href={`/players/${ticket.userId}`} class="text-indigo-400 hover:text-indigo-300">
            {ticket.user.displayName} (@{ticket.user.username})
          </a>
        </div>

        {/* Subject and description */}
        <h2 class="text-lg font-semibold text-white mb-2">{ticket.subject}</h2>
        <div class="text-gray-300 whitespace-pre-wrap bg-gray-700 p-4 rounded">
          {ticket.description}
        </div>
      </div>

      {/* Status change */}
      <div class="bg-gray-800 rounded-lg p-4 mb-6 flex items-center gap-4">
        <span class="text-gray-400">Change status:</span>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus((e.target as HTMLSelectElement).value as TicketStatus | '')}
          class="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
        >
          <option value="">Select status...</option>
          {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
            <option key={key} value={key} disabled={key === ticket.status}>
              {label} {key === ticket.status ? '(current)' : ''}
            </option>
          ))}
        </select>
        <Button
          onClick={handleStatusChange}
          disabled={!selectedStatus || updateStatusMutation.isPending}
        >
          {updateStatusMutation.isPending ? 'Updating...' : 'Update Status'}
        </Button>
      </div>

      {/* Conversation */}
      <div class="bg-gray-800 rounded-lg p-6 mb-6">
        <h3 class="text-lg font-semibold text-white mb-4">Conversation ({ticket.responses.length})</h3>

        {ticket.responses.length === 0 ? (
          <p class="text-gray-500 text-center py-4">No responses yet</p>
        ) : (
          <div class="space-y-4">
            {ticket.responses.map((response) => (
              <div
                key={response.id}
                class={`p-4 rounded ${response.isStaff ? 'bg-indigo-900/30 border-l-4 border-indigo-500' : 'bg-gray-700'}`}
              >
                <div class="flex justify-between items-center mb-2">
                  <span class={`text-sm font-medium ${response.isStaff ? 'text-indigo-400' : 'text-gray-300'}`}>
                    {response.isStaff ? '🛡️ Support Staff' : `👤 ${ticket.user.displayName}`}
                  </span>
                  <span class="text-xs text-gray-500">{formatDate(response.createdAt)}</span>
                </div>
                <p class="text-gray-200 whitespace-pre-wrap">{response.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reply form */}
      {ticket.status !== 'CLOSED' && (
        <div class="bg-gray-800 rounded-lg p-6">
          <h3 class="text-lg font-semibold text-white mb-4">Send Response</h3>
          <form onSubmit={handleSubmitResponse}>
            <textarea
              value={responseContent}
              onInput={(e) => setResponseContent((e.target as HTMLTextAreaElement).value)}
              placeholder="Write your response..."
              rows={4}
              class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 resize-none mb-4"
            />
            <div class="flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setSelectedStatus('RESOLVED');
                  if (responseContent.trim()) {
                    addResponseMutation.mutate(responseContent);
                  }
                  setTimeout(() => updateStatusMutation.mutate('RESOLVED'), 500);
                }}
                disabled={addResponseMutation.isPending || updateStatusMutation.isPending}
              >
                Mark Resolved
              </Button>
              <Button
                type="submit"
                disabled={!responseContent.trim() || addResponseMutation.isPending}
              >
                {addResponseMutation.isPending ? 'Sending...' : 'Send Response'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {ticket.status === 'CLOSED' && (
        <div class="bg-gray-800 rounded-lg p-6 text-center text-gray-500">
          This ticket is closed. No more responses can be added.
        </div>
      )}
    </div>
  );
}
