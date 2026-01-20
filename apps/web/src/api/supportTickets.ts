/**
 * Support Tickets API Client
 *
 * Handles all support ticket-related API calls.
 */

import { CONFIG } from '../config.js';
import { getAccessToken } from './auth.js';

// ============================================================================
// TYPES
// ============================================================================

export type TicketCategory = 'BUG_REPORT' | 'ACCOUNT_ISSUE' | 'PAYMENT' | 'OTHER';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface TicketUser {
  id: string;
  username: string;
  displayName: string | null;
  email?: string;
}

export interface TicketResponse {
  id: string;
  ticketId: string;
  userId: string | null;
  content: string;
  isStaff: boolean;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  category: TicketCategory;
  subject: string;
  description: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  user?: TicketUser;
  responses?: TicketResponse[];
  _count?: { responses: number };
}

export interface CreateTicketRequest {
  category: TicketCategory;
  subject: string;
  description: string;
}

export interface TicketsResponse {
  tickets: SupportTicket[];
  total: number;
  page: number;
  totalPages: number;
}

export interface TicketsQuery {
  page?: number;
  limit?: number;
  status?: TicketStatus;
}

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
// TICKETS
// ============================================================================

/**
 * Create a new support ticket
 */
export async function createTicket(data: CreateTicketRequest): Promise<SupportTicket> {
  return request<SupportTicket>('/support-tickets', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get user's support tickets
 */
export async function getTickets(query: TicketsQuery = {}): Promise<TicketsResponse> {
  const params = new URLSearchParams();
  if (query.page) {
    params.set('page', query.page.toString());
  }
  if (query.limit) {
    params.set('limit', query.limit.toString());
  }
  if (query.status) {
    params.set('status', query.status);
  }

  const queryString = params.toString();
  return request<TicketsResponse>(`/support-tickets${queryString ? `?${queryString}` : ''}`);
}

/**
 * Get a specific ticket with all responses
 */
export async function getTicket(ticketId: string): Promise<SupportTicket> {
  return request<SupportTicket>(`/support-tickets/${encodeURIComponent(ticketId)}`);
}

/**
 * Add a response to a ticket
 */
export async function addTicketResponse(
  ticketId: string,
  content: string
): Promise<TicketResponse> {
  return request<TicketResponse>(`/support-tickets/${encodeURIComponent(ticketId)}/responses`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

/**
 * Close a ticket
 */
export async function closeTicket(ticketId: string): Promise<SupportTicket> {
  return request<SupportTicket>(`/support-tickets/${encodeURIComponent(ticketId)}/close`, {
    method: 'PATCH',
  });
}
