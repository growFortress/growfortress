/**
 * Support State
 *
 * Signals for managing support page, tickets, and navigation.
 */

import { signal, computed } from '@preact/signals';
import type {
  SupportTicket,
  TicketCategory,
} from '../api/supportTickets.js';
import {
  getTickets,
  getTicket,
  createTicket,
  addTicketResponse,
  closeTicket as apiCloseTicket,
} from '../api/supportTickets.js';

// ============================================================================
// TYPES
// ============================================================================

export type SupportSection = 'tickets' | 'legal' | 'about';
export type LegalTab = 'terms' | 'privacy' | 'cookies' | 'payment';

// ============================================================================
// STATE SIGNALS
// ============================================================================

// Page visibility
export const showSupportPage = signal(false);

// Navigation
export const activeSupportSection = signal<SupportSection>('tickets');
export const activeLegalTab = signal<LegalTab>('terms');

// Tickets list state
export const tickets = signal<SupportTicket[]>([]);
export const ticketsLoading = signal(false);
export const ticketsTotal = signal(0);
export const ticketsPage = signal(1);

// Selected ticket state
export const selectedTicketId = signal<string | null>(null);
export const selectedTicket = signal<SupportTicket | null>(null);
export const selectedTicketLoading = signal(false);

// Create ticket form state
export const createTicketLoading = signal(false);

// Reply state
export const replyLoading = signal(false);

// Error state
export const supportError = signal<string | null>(null);

// Success message
export const supportSuccess = signal<string | null>(null);

// ============================================================================
// COMPUTED VALUES
// ============================================================================

export const hasMoreTickets = computed(() => {
  return tickets.value.length < ticketsTotal.value;
});

export const openTicketsCount = computed(() => {
  return tickets.value.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length;
});

// ============================================================================
// ACTIONS - PAGE NAVIGATION
// ============================================================================

/**
 * Open the support page
 */
export function openSupportPage(): void {
  showSupportPage.value = true;
  activeSupportSection.value = 'tickets';
  loadTickets();
}

/**
 * Close the support page
 */
export function closeSupportPage(): void {
  showSupportPage.value = false;
  selectedTicketId.value = null;
  selectedTicket.value = null;
  supportError.value = null;
  supportSuccess.value = null;
}

/**
 * Set active section
 */
export function setSupportSection(section: SupportSection): void {
  activeSupportSection.value = section;
  supportError.value = null;
  supportSuccess.value = null;

  // Load tickets when switching to tickets section
  if (section === 'tickets' && tickets.value.length === 0) {
    loadTickets();
  }
}

/**
 * Set active legal tab
 */
export function setLegalTab(tab: LegalTab): void {
  activeLegalTab.value = tab;
}

// ============================================================================
// ACTIONS - TICKETS
// ============================================================================

/**
 * Load tickets for current user
 */
export async function loadTickets(page = 1): Promise<void> {
  ticketsLoading.value = true;
  supportError.value = null;

  try {
    const response = await getTickets({ page, limit: 20 });

    if (page === 1) {
      tickets.value = response.tickets;
    } else {
      tickets.value = [...tickets.value, ...response.tickets];
    }
    ticketsTotal.value = response.total;
    ticketsPage.value = page;
  } catch (error: any) {
    supportError.value = error.message || 'Failed to load tickets';
    console.error('[Support] Failed to load tickets:', error);
  } finally {
    ticketsLoading.value = false;
  }
}

/**
 * Load more tickets
 */
export function loadMoreTickets(): void {
  if (hasMoreTickets.value && !ticketsLoading.value) {
    loadTickets(ticketsPage.value + 1);
  }
}

/**
 * Select a ticket to view details
 */
export async function selectTicket(ticketId: string): Promise<void> {
  selectedTicketId.value = ticketId;
  selectedTicketLoading.value = true;
  supportError.value = null;

  try {
    const ticket = await getTicket(ticketId);
    selectedTicket.value = ticket;
  } catch (error: any) {
    supportError.value = error.message || 'Failed to load ticket';
    console.error('[Support] Failed to load ticket:', error);
  } finally {
    selectedTicketLoading.value = false;
  }
}

/**
 * Clear selected ticket
 */
export function clearSelectedTicket(): void {
  selectedTicketId.value = null;
  selectedTicket.value = null;
}

/**
 * Create a new support ticket
 */
export async function submitTicket(
  category: TicketCategory,
  subject: string,
  description: string
): Promise<boolean> {
  createTicketLoading.value = true;
  supportError.value = null;
  supportSuccess.value = null;

  try {
    const ticket = await createTicket({ category, subject, description });

    // Add to beginning of list
    tickets.value = [ticket, ...tickets.value];
    ticketsTotal.value = ticketsTotal.value + 1;

    // Show success message
    supportSuccess.value = 'Ticket created successfully';

    // Select the new ticket
    selectedTicketId.value = ticket.id;
    selectedTicket.value = ticket;

    return true;
  } catch (error: any) {
    supportError.value = error.message || 'Failed to create ticket';
    console.error('[Support] Failed to create ticket:', error);
    return false;
  } finally {
    createTicketLoading.value = false;
  }
}

/**
 * Add a response to the selected ticket
 */
export async function sendTicketResponse(content: string): Promise<boolean> {
  if (!selectedTicketId.value) return false;

  replyLoading.value = true;
  supportError.value = null;

  try {
    const response = await addTicketResponse(selectedTicketId.value, content);

    // Update selected ticket with new response
    if (selectedTicket.value) {
      selectedTicket.value = {
        ...selectedTicket.value,
        responses: [...(selectedTicket.value.responses || []), response],
        updatedAt: new Date().toISOString(),
      };
    }

    // Update ticket in list
    const ticketIndex = tickets.value.findIndex(t => t.id === selectedTicketId.value);
    if (ticketIndex !== -1) {
      const updatedTickets = [...tickets.value];
      updatedTickets[ticketIndex] = {
        ...updatedTickets[ticketIndex],
        updatedAt: new Date().toISOString(),
        _count: {
          responses: (updatedTickets[ticketIndex]._count?.responses || 0) + 1,
        },
      };
      tickets.value = updatedTickets;
    }

    return true;
  } catch (error: any) {
    supportError.value = error.message || 'Failed to send response';
    console.error('[Support] Failed to send response:', error);
    return false;
  } finally {
    replyLoading.value = false;
  }
}

/**
 * Close the selected ticket
 */
export async function closeSelectedTicket(): Promise<boolean> {
  if (!selectedTicketId.value) return false;

  try {
    await apiCloseTicket(selectedTicketId.value);

    // Update selected ticket
    if (selectedTicket.value) {
      selectedTicket.value = {
        ...selectedTicket.value,
        status: 'CLOSED',
      };
    }

    // Update ticket in list
    const ticketIndex = tickets.value.findIndex(t => t.id === selectedTicketId.value);
    if (ticketIndex !== -1) {
      const updatedTickets = [...tickets.value];
      updatedTickets[ticketIndex] = {
        ...updatedTickets[ticketIndex],
        status: 'CLOSED',
      };
      tickets.value = updatedTickets;
    }

    supportSuccess.value = 'Ticket closed successfully';
    return true;
  } catch (error: any) {
    supportError.value = error.message || 'Failed to close ticket';
    console.error('[Support] Failed to close ticket:', error);
    return false;
  }
}

/**
 * Clear error message
 */
export function clearSupportError(): void {
  supportError.value = null;
}

/**
 * Clear success message
 */
export function clearSupportSuccess(): void {
  supportSuccess.value = null;
}

/**
 * Reset all support state (on logout)
 */
export function resetSupportState(): void {
  showSupportPage.value = false;
  activeSupportSection.value = 'tickets';
  activeLegalTab.value = 'terms';
  tickets.value = [];
  ticketsLoading.value = false;
  ticketsTotal.value = 0;
  ticketsPage.value = 1;
  selectedTicketId.value = null;
  selectedTicket.value = null;
  selectedTicketLoading.value = false;
  createTicketLoading.value = false;
  replyLoading.value = false;
  supportError.value = null;
  supportSuccess.value = null;
}
