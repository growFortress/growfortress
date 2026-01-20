import { prisma } from '../lib/prisma.js';
import type { TicketCategory, TicketStatus } from '@prisma/client';

// Rate limiting: max 5 tickets per hour per user
const TICKET_RATE_LIMIT = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Check if user has exceeded ticket rate limit
 */
async function checkRateLimit(userId: string): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const recentTickets = await prisma.supportTicket.count({
    where: {
      userId,
      createdAt: { gte: oneHourAgo },
    },
  });
  return recentTickets >= TICKET_RATE_LIMIT;
}

/**
 * Create a new support ticket
 */
export async function createTicket(
  userId: string,
  category: TicketCategory,
  subject: string,
  description: string
) {
  // Check rate limit
  const isRateLimited = await checkRateLimit(userId);
  if (isRateLimited) {
    throw new Error('Rate limit exceeded. Please wait before submitting another ticket.');
  }

  return await prisma.supportTicket.create({
    data: {
      userId,
      category,
      subject: subject.slice(0, 200), // Enforce max length
      description: description.slice(0, 2000), // Enforce max length
    },
    include: {
      user: {
        select: {
          username: true,
          displayName: true,
        },
      },
    },
  });
}

/**
 * Get tickets for a specific user (paginated)
 */
export async function getUserTickets(
  userId: string,
  page = 1,
  limit = 20,
  status?: TicketStatus
) {
  const skip = (page - 1) * limit;
  const where = {
    userId,
    ...(status && { status }),
  };

  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        responses: {
          orderBy: { createdAt: 'asc' },
          take: 1, // Just get latest response for preview
        },
        _count: {
          select: { responses: true },
        },
      },
    }),
    prisma.supportTicket.count({ where }),
  ]);

  return {
    tickets,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get a single ticket by ID with all responses
 * Only returns if user owns the ticket or is admin
 */
export async function getTicketById(ticketId: string, userId: string, isAdmin = false) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          email: true,
        },
      },
      responses: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  // Check ownership (unless admin)
  if (!ticket || (!isAdmin && ticket.userId !== userId)) {
    return null;
  }

  return ticket;
}

/**
 * Add a response to a ticket
 */
export async function addResponse(
  ticketId: string,
  userId: string,
  content: string,
  isStaff = false
) {
  // Verify ticket exists and user has access
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { userId: true, status: true },
  });

  if (!ticket) {
    throw new Error('Ticket not found');
  }

  // Non-staff can only respond to their own tickets
  if (!isStaff && ticket.userId !== userId) {
    throw new Error('Access denied');
  }

  // Can't respond to closed tickets
  if (ticket.status === 'CLOSED') {
    throw new Error('Cannot respond to closed ticket');
  }

  // Create response and update ticket
  const [response] = await prisma.$transaction([
    prisma.ticketResponse.create({
      data: {
        ticketId,
        userId,
        content: content.slice(0, 2000), // Enforce max length
        isStaff,
      },
    }),
    prisma.supportTicket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() },
    }),
  ]);

  return response;
}

/**
 * Close a ticket (user action)
 */
export async function closeTicket(ticketId: string, userId: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { userId: true },
  });

  if (!ticket || ticket.userId !== userId) {
    throw new Error('Ticket not found or access denied');
  }

  return await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status: 'CLOSED' },
  });
}

// ============================================================================
// ADMIN FUNCTIONS
// ============================================================================

/**
 * List all tickets (admin only)
 */
export async function listAllTickets(
  page = 1,
  limit = 20,
  status?: TicketStatus,
  category?: TicketCategory,
  search?: string
) {
  const skip = (page - 1) * limit;
  const where: any = {};

  if (status) {
    where.status = status;
  }
  if (category) {
    where.category = category;
  }
  if (search) {
    where.OR = [
      { subject: { contains: search, mode: 'insensitive' } },
      { user: { username: { contains: search, mode: 'insensitive' } } },
      { user: { displayName: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [tickets, total, openCount] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            username: true,
            displayName: true,
          },
        },
        _count: {
          select: { responses: true },
        },
      },
    }),
    prisma.supportTicket.count({ where }),
    prisma.supportTicket.count({ where: { status: 'OPEN' } }),
  ]);

  return {
    tickets,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    openCount,
  };
}

/**
 * Update ticket status (admin only)
 */
export async function updateTicketStatus(ticketId: string, status: TicketStatus) {
  return await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      status,
      ...(status === 'CLOSED' && { updatedAt: new Date() }),
    },
  });
}

/**
 * Get ticket statistics (admin dashboard)
 */
export async function getTicketStats() {
  const [total, open, inProgress, resolved, closed] = await Promise.all([
    prisma.supportTicket.count(),
    prisma.supportTicket.count({ where: { status: 'OPEN' } }),
    prisma.supportTicket.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.supportTicket.count({ where: { status: 'RESOLVED' } }),
    prisma.supportTicket.count({ where: { status: 'CLOSED' } }),
  ]);

  return { total, open, inProgress, resolved, closed };
}
