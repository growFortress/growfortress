/**
 * Messages State
 *
 * Signals for managing messages, threads, and unread counts.
 */

import { signal, computed } from '@preact/signals';
import type {
  ThreadSummary,
  ThreadDetail,
  UnreadCounts,
  Message,
} from '@arcade/protocol';
import {
  getThreads,
  getThread,
  createThread,
  replyToThread,
  markThreadRead,
  deleteThread,
  getUnreadCounts,
} from '../api/messages.js';
import {
  onWebSocketEvent,
  connectWebSocket,
  disconnectWebSocket,
} from '../api/websocket.js';

// ============================================================================
// STATE SIGNALS
// ============================================================================

// Modal state
export const showMessagesModal = signal(false);
export const messagesActiveTab = signal<'all' | 'private' | 'system' | 'guild'>('all');

// Thread list state
export const threads = signal<ThreadSummary[]>([]);
export const threadsLoading = signal(false);
export const threadsTotal = signal(0);

// Selected thread state
export const selectedThreadId = signal<string | null>(null);
export const selectedThread = signal<ThreadDetail | null>(null);
export const selectedThreadLoading = signal(false);

// Compose modal state
export const showComposeModal = signal(false);
export const composeLoading = signal(false);

// Reply state
export const replyLoading = signal(false);

// Unread counts
export const unreadCounts = signal<UnreadCounts>({
  total: 0,
  private: 0,
  system: 0,
  guild: 0,
});

// Error state
export const messagesError = signal<string | null>(null);

// ============================================================================
// COMPUTED VALUES
// ============================================================================

export const hasUnreadMessages = computed(() => unreadCounts.value.total > 0);

export const currentTabUnreadCount = computed(() => {
  const tab = messagesActiveTab.value;
  const counts = unreadCounts.value;

  switch (tab) {
    case 'private':
      return counts.private;
    case 'system':
      return counts.system;
    case 'guild':
      return counts.guild;
    default:
      return counts.total;
  }
});

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Open the messages modal
 */
export function openMessagesModal(): void {
  showMessagesModal.value = true;
  loadThreads();
}

/**
 * Close the messages modal
 */
export function closeMessagesModal(): void {
  showMessagesModal.value = false;
  selectedThreadId.value = null;
  selectedThread.value = null;
}

/**
 * Switch active tab
 */
export function setMessagesTab(tab: 'all' | 'private' | 'system' | 'guild'): void {
  messagesActiveTab.value = tab;
  loadThreads();
}

/**
 * Load threads for current tab
 */
export async function loadThreads(offset = 0): Promise<void> {
  threadsLoading.value = true;
  messagesError.value = null;

  try {
    const response = await getThreads({
      type: messagesActiveTab.value,
      limit: 20,
      offset,
    });

    if (offset === 0) {
      threads.value = response.threads;
    } else {
      threads.value = [...threads.value, ...response.threads];
    }
    threadsTotal.value = response.total;
  } catch (error: any) {
    messagesError.value = error.message || 'Failed to load threads';
    console.error('[Messages] Failed to load threads:', error);
  } finally {
    threadsLoading.value = false;
  }
}

/**
 * Load more threads
 */
export function loadMoreThreads(): void {
  if (threads.value.length < threadsTotal.value) {
    loadThreads(threads.value.length);
  }
}

/**
 * Select a thread to view
 */
export async function selectThread(threadId: string): Promise<void> {
  selectedThreadId.value = threadId;
  selectedThreadLoading.value = true;
  messagesError.value = null;

  try {
    const response = await getThread(threadId);
    selectedThread.value = response.thread;

    // Update unread count in list
    const threadIndex = threads.value.findIndex(t => t.id === threadId);
    if (threadIndex !== -1 && threads.value[threadIndex].unreadCount > 0) {
      const updatedThreads = [...threads.value];
      updatedThreads[threadIndex] = {
        ...updatedThreads[threadIndex],
        unreadCount: 0,
      };
      threads.value = updatedThreads;

      // Refresh unread counts
      refreshUnreadCounts();
    }
  } catch (error: any) {
    messagesError.value = error.message || 'Failed to load thread';
    console.error('[Messages] Failed to load thread:', error);
  } finally {
    selectedThreadLoading.value = false;
  }
}

/**
 * Send a new message (create thread)
 */
export async function sendNewMessage(
  recipientUsernames: string[],
  subject: string,
  content: string
): Promise<boolean> {
  composeLoading.value = true;
  messagesError.value = null;

  try {
    const response = await createThread({
      recipientUsernames,
      subject,
      content,
    });

    // Add to threads list
    const newThreadSummary: ThreadSummary = {
      id: response.thread.id,
      subject: response.thread.subject,
      type: response.thread.type,
      lastMessageAt: response.thread.messages[0]?.createdAt || new Date().toISOString(),
      lastMessagePreview: content.slice(0, 100),
      participants: response.thread.participants.filter(p => p.userId !== null),
      unreadCount: 0,
      linkedInvitationId: response.thread.linkedInvitationId,
      linkedInvitationStatus: null,
      isGroup: response.thread.isGroup,
      participantCount: response.thread.participants.length,
    };

    threads.value = [newThreadSummary, ...threads.value];
    showComposeModal.value = false;

    // Select the new thread
    selectThread(response.thread.id);

    return true;
  } catch (error: any) {
    messagesError.value = error.message || 'Failed to send message';
    console.error('[Messages] Failed to send message:', error);
    return false;
  } finally {
    composeLoading.value = false;
  }
}

/**
 * Reply to current thread
 */
export async function sendReply(content: string): Promise<boolean> {
  if (!selectedThreadId.value) return false;

  replyLoading.value = true;
  messagesError.value = null;

  try {
    const response = await replyToThread(selectedThreadId.value, { content });

    // Add message to current thread
    if (selectedThread.value) {
      selectedThread.value = {
        ...selectedThread.value,
        messages: [...selectedThread.value.messages, response.message],
      };
    }

    // Update thread in list
    const threadIndex = threads.value.findIndex(t => t.id === selectedThreadId.value);
    if (threadIndex !== -1) {
      const updatedThreads = [...threads.value];
      updatedThreads[threadIndex] = {
        ...updatedThreads[threadIndex],
        lastMessageAt: response.message.createdAt,
        lastMessagePreview: content.slice(0, 100),
      };
      // Move to top of list
      const [updatedThread] = updatedThreads.splice(threadIndex, 1);
      threads.value = [updatedThread, ...updatedThreads];
    }

    return true;
  } catch (error: any) {
    messagesError.value = error.message || 'Failed to send reply';
    console.error('[Messages] Failed to send reply:', error);
    return false;
  } finally {
    replyLoading.value = false;
  }
}

/**
 * Delete a thread
 */
export async function removeThread(threadId: string): Promise<boolean> {
  try {
    await deleteThread(threadId);

    // Remove from list
    threads.value = threads.value.filter(t => t.id !== threadId);

    // Clear selection if this was selected
    if (selectedThreadId.value === threadId) {
      selectedThreadId.value = null;
      selectedThread.value = null;
    }

    return true;
  } catch (error: any) {
    messagesError.value = error.message || 'Failed to delete thread';
    console.error('[Messages] Failed to delete thread:', error);
    return false;
  }
}

/**
 * Refresh unread counts
 */
export async function refreshUnreadCounts(): Promise<void> {
  try {
    const counts = await getUnreadCounts();
    unreadCounts.value = counts;
  } catch (error) {
    console.error('[Messages] Failed to refresh unread counts:', error);
  }
}

/**
 * Open compose modal
 */
export function openComposeModal(): void {
  showComposeModal.value = true;
}

/**
 * Close compose modal
 */
export function closeComposeModal(): void {
  showComposeModal.value = false;
}

// ============================================================================
// WEBSOCKET EVENT HANDLERS
// ============================================================================

/**
 * Initialize WebSocket event listeners
 */
export function initMessagesWebSocket(): void {
  // Handle new thread notification
  onWebSocketEvent<{ thread: ThreadSummary }>('thread:new', (data) => {
    // Add to beginning of list
    threads.value = [data.thread, ...threads.value];
  });

  // Handle new message in existing thread
  onWebSocketEvent<{
    threadId: string;
    message: Message;
    threadSubject: string;
    senderName: string;
  }>('message:new', (data) => {
    // Update thread in list
    const threadIndex = threads.value.findIndex(t => t.id === data.threadId);
    if (threadIndex !== -1) {
      const updatedThreads = [...threads.value];
      updatedThreads[threadIndex] = {
        ...updatedThreads[threadIndex],
        lastMessageAt: data.message.createdAt,
        lastMessagePreview: data.message.content.slice(0, 100),
        unreadCount: updatedThreads[threadIndex].unreadCount + 1,
      };
      // Move to top
      const [updatedThread] = updatedThreads.splice(threadIndex, 1);
      threads.value = [updatedThread, ...updatedThreads];
    }

    // If viewing this thread, add message (only if not already added)
    if (selectedThreadId.value === data.threadId && selectedThread.value) {
      // Check if message already exists (prevents duplicates from optimistic updates)
      const messageExists = selectedThread.value.messages.some(m => m.id === data.message.id);
      if (!messageExists) {
        selectedThread.value = {
          ...selectedThread.value,
          messages: [...selectedThread.value.messages, data.message],
        };
      }
      // Mark as read
      markThreadRead(data.threadId).catch(() => {});
    }
  });

  // Handle thread read (from another device)
  onWebSocketEvent<{ threadId: string }>('message:read', (data) => {
    const threadIndex = threads.value.findIndex(t => t.id === data.threadId);
    if (threadIndex !== -1 && threads.value[threadIndex].unreadCount > 0) {
      const updatedThreads = [...threads.value];
      updatedThreads[threadIndex] = {
        ...updatedThreads[threadIndex],
        unreadCount: 0,
      };
      threads.value = updatedThreads;
    }
  });

  // Handle unread counts update
  onWebSocketEvent<UnreadCounts>('unread:update', (data) => {
    unreadCounts.value = data;
  });

  // Handle connected event (includes initial unread counts)
  onWebSocketEvent<{ userId: string; unreadCounts: UnreadCounts }>('connected', (data) => {
    unreadCounts.value = data.unreadCounts;
  });

  // Handle participant added to thread
  onWebSocketEvent<{
    threadId: string;
    userId: string;
    displayName: string;
    addedBy: string;
  }>('thread:participant_added', (data) => {
    // Update selected thread if viewing it
    if (selectedThreadId.value === data.threadId && selectedThread.value) {
      const alreadyExists = selectedThread.value.participants.some(p => p.userId === data.userId);
      if (!alreadyExists) {
        selectedThread.value = {
          ...selectedThread.value,
          participants: [
            ...selectedThread.value.participants,
            { userId: data.userId, displayName: data.displayName },
          ],
        };
      }
    }

    // Update thread in list
    const threadIndex = threads.value.findIndex(t => t.id === data.threadId);
    if (threadIndex !== -1) {
      const updatedThreads = [...threads.value];
      updatedThreads[threadIndex] = {
        ...updatedThreads[threadIndex],
        participantCount: updatedThreads[threadIndex].participantCount + 1,
      };
      threads.value = updatedThreads;
    }
  });

  // Handle participant left thread
  onWebSocketEvent<{
    threadId: string;
    userId: string;
    displayName: string;
  }>('thread:participant_left', (data) => {
    // Update selected thread if viewing it
    if (selectedThreadId.value === data.threadId && selectedThread.value) {
      selectedThread.value = {
        ...selectedThread.value,
        participants: selectedThread.value.participants.filter(p => p.userId !== data.userId),
      };
    }

    // Update thread in list
    const threadIndex = threads.value.findIndex(t => t.id === data.threadId);
    if (threadIndex !== -1) {
      const updatedThreads = [...threads.value];
      updatedThreads[threadIndex] = {
        ...updatedThreads[threadIndex],
        participantCount: Math.max(0, updatedThreads[threadIndex].participantCount - 1),
      };
      threads.value = updatedThreads;
    }
  });

  // Handle guild invitation status change
  onWebSocketEvent<{
    invitationId: string;
    status: string;
  }>('guild:invitation_status', (data) => {
    // Update thread in list if it has this invitation
    const threadIndex = threads.value.findIndex(t => t.linkedInvitationId === data.invitationId);
    if (threadIndex !== -1) {
      const updatedThreads = [...threads.value];
      updatedThreads[threadIndex] = {
        ...updatedThreads[threadIndex],
        linkedInvitationStatus: data.status,
      };
      threads.value = updatedThreads;
    }

    // Update selected thread if it has this invitation
    if (selectedThread.value?.linkedInvitationId === data.invitationId) {
      const isPending = data.status === 'PENDING';
      selectedThread.value = {
        ...selectedThread.value,
        canAcceptInvitation: isPending,
        canDeclineInvitation: isPending,
      };
    }
  });

  // Handle moderation warning
  onWebSocketEvent<{
    reason: string;
    threadId: string;
  }>('moderation:warning', (data) => {
    console.warn('[Moderation] Warning received:', data.reason);
    // The thread:new event will add the warning message to the thread list
    // This event is for additional client-side handling if needed (e.g., showing a toast)
  });

  // Handle being muted
  onWebSocketEvent<{
    reason: string;
    expiresAt: string | null;
  }>('moderation:muted', (data) => {
    console.warn('[Moderation] Account muted:', data.reason, 'Expires:', data.expiresAt);
    // Client can use this to disable message sending UI
  });

  // Handle being unmuted
  onWebSocketEvent<Record<string, never>>('moderation:unmuted', () => {
    console.info('[Moderation] Account unmuted');
    // Client can use this to re-enable message sending UI
  });

  // Connect WebSocket
  connectWebSocket();
}

/**
 * Cleanup WebSocket
 */
export function cleanupMessagesWebSocket(): void {
  disconnectWebSocket();
}

/**
 * Reset all messages state (on logout)
 */
export function resetMessagesState(): void {
  // Disconnect WebSocket first
  disconnectWebSocket();

  // Reset all signals
  showMessagesModal.value = false;
  messagesActiveTab.value = 'all';
  threads.value = [];
  threadsLoading.value = false;
  threadsTotal.value = 0;
  selectedThreadId.value = null;
  selectedThread.value = null;
  selectedThreadLoading.value = false;
  showComposeModal.value = false;
  composeLoading.value = false;
  replyLoading.value = false;
  unreadCounts.value = {
    total: 0,
    private: 0,
    system: 0,
    guild: 0,
  };
  messagesError.value = null;
}
