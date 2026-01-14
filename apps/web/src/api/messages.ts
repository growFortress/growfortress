/**
 * Messages API Client
 *
 * Handles all messaging-related API calls.
 */

import type {
  ThreadsQuery,
  ThreadsResponse,
  ThreadDetail,
  ComposeThreadRequest,
  ReplyThreadRequest,
  AddParticipantRequest,
  SearchUsersResponse,
  UnreadCounts,
  Message,
  Participant,
  ReportRequest,
  BlockedUsersResponse,
} from '@arcade/protocol';
import { CONFIG } from '../config.js';
import { getAccessToken } from './auth.js';

// ============================================================================
// TYPES
// ============================================================================

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ============================================================================
// REQUEST HELPER
// ============================================================================

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${CONFIG.API_URL}${path}`;
  const token = getAccessToken();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(response.status, data.error || 'Request failed', data);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// ============================================================================
// THREADS
// ============================================================================

/**
 * Get user's message threads
 */
export async function getThreads(query: Partial<ThreadsQuery> = {}): Promise<ThreadsResponse> {
  const params = new URLSearchParams();
  if (query.type && query.type !== 'all') {
    params.set('type', query.type);
  }
  if (query.limit) {
    params.set('limit', query.limit.toString());
  }
  if (query.offset) {
    params.set('offset', query.offset.toString());
  }

  const queryString = params.toString();
  return request<ThreadsResponse>(`/v1/messages/threads${queryString ? `?${queryString}` : ''}`);
}

/**
 * Get a specific thread with all messages
 */
export async function getThread(threadId: string): Promise<{ thread: ThreadDetail }> {
  return request<{ thread: ThreadDetail }>(`/v1/messages/threads/${encodeURIComponent(threadId)}`);
}

/**
 * Create a new thread
 */
export async function createThread(data: ComposeThreadRequest): Promise<{ thread: ThreadDetail }> {
  return request<{ thread: ThreadDetail }>('/v1/messages/threads', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Reply to a thread
 */
export async function replyToThread(threadId: string, data: ReplyThreadRequest): Promise<{ message: Message }> {
  return request<{ message: Message }>(`/v1/messages/threads/${encodeURIComponent(threadId)}/reply`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Add participant to a group thread
 */
export async function addParticipant(threadId: string, data: AddParticipantRequest): Promise<{ participant: Participant }> {
  return request<{ participant: Participant }>(`/v1/messages/threads/${encodeURIComponent(threadId)}/participants`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Leave a group thread
 */
export async function leaveThread(threadId: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/v1/messages/threads/${encodeURIComponent(threadId)}/leave`, {
    method: 'DELETE',
  });
}

/**
 * Mark thread as read
 */
export async function markThreadRead(threadId: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/v1/messages/threads/${encodeURIComponent(threadId)}/read`, {
    method: 'PATCH',
  });
}

/**
 * Delete a thread (soft delete for user)
 */
export async function deleteThread(threadId: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/v1/messages/threads/${encodeURIComponent(threadId)}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// UNREAD COUNTS
// ============================================================================

/**
 * Get unread message counts
 */
export async function getUnreadCounts(): Promise<UnreadCounts> {
  return request<UnreadCounts>('/v1/messages/unread-count');
}

// ============================================================================
// USER SEARCH
// ============================================================================

/**
 * Search for users to message
 */
export async function searchUsers(query: string, limit = 5): Promise<SearchUsersResponse> {
  const params = new URLSearchParams();
  params.set('q', query);
  params.set('limit', limit.toString());

  return request<SearchUsersResponse>(`/v1/messages/search-users?${params}`);
}

// ============================================================================
// MODERATION
// ============================================================================

/**
 * Report a message or thread
 */
export async function reportContent(data: ReportRequest): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('/v1/moderation/report', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Block a user
 */
export async function blockUser(userId: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/v1/moderation/block/${encodeURIComponent(userId)}`, {
    method: 'POST',
  });
}

/**
 * Unblock a user
 */
export async function unblockUser(userId: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/v1/moderation/block/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

/**
 * Get blocked users
 */
export async function getBlockedUsers(): Promise<BlockedUsersResponse> {
  return request<BlockedUsersResponse>('/v1/moderation/blocked');
}
