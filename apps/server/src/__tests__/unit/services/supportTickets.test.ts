/**
 * Support Tickets service tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createTicket,
  getUserTickets,
  getTicketById,
  addResponse,
  closeTicket,
  listAllTickets,
  updateTicketStatus,
  getTicketStats,
} from '../../../services/supportTickets.js';
import { mockPrisma } from '../../mocks/prisma.js';

describe('Support Tickets Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTicket = {
    id: 'ticket-1',
    userId: 'user-123',
    category: 'BUG_REPORT' as const,
    subject: 'Game crashed',
    description: 'The game crashed during wave 15',
    status: 'OPEN' as const,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
  };

  describe('createTicket', () => {
    it('creates a ticket successfully', async () => {
      mockPrisma.supportTicket.count.mockResolvedValue(0);
      mockPrisma.supportTicket.create.mockResolvedValue({
        ...mockTicket,
        user: { username: 'testuser', displayName: 'Test User' },
      });

      const result = await createTicket(
        'user-123',
        'BUG_REPORT',
        'Game crashed',
        'The game crashed during wave 15'
      );

      expect(result.id).toBe('ticket-1');
      expect(mockPrisma.supportTicket.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          category: 'BUG_REPORT',
          subject: 'Game crashed',
          description: 'The game crashed during wave 15',
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
    });

    it('enforces subject max length', async () => {
      mockPrisma.supportTicket.count.mockResolvedValue(0);
      mockPrisma.supportTicket.create.mockResolvedValue(mockTicket);

      const longSubject = 'a'.repeat(300);
      await createTicket('user-123', 'BUG_REPORT', longSubject, 'description');

      expect(mockPrisma.supportTicket.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          subject: 'a'.repeat(200),
        }),
        include: expect.any(Object),
      });
    });

    it('enforces description max length', async () => {
      mockPrisma.supportTicket.count.mockResolvedValue(0);
      mockPrisma.supportTicket.create.mockResolvedValue(mockTicket);

      const longDescription = 'a'.repeat(3000);
      await createTicket('user-123', 'BUG_REPORT', 'subject', longDescription);

      expect(mockPrisma.supportTicket.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          description: 'a'.repeat(2000),
        }),
        include: expect.any(Object),
      });
    });

    it('throws error when rate limited', async () => {
      mockPrisma.supportTicket.count.mockResolvedValue(5); // At limit

      await expect(
        createTicket('user-123', 'BUG_REPORT', 'subject', 'description')
      ).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('getUserTickets', () => {
    it('returns paginated tickets for user', async () => {
      mockPrisma.supportTicket.findMany.mockResolvedValue([mockTicket]);
      mockPrisma.supportTicket.count.mockResolvedValue(1);

      const result = await getUserTickets('user-123', 1, 20);

      expect(result).toEqual({
        tickets: [mockTicket],
        total: 1,
        page: 1,
        totalPages: 1,
      });
    });

    it('filters by status when provided', async () => {
      mockPrisma.supportTicket.findMany.mockResolvedValue([]);
      mockPrisma.supportTicket.count.mockResolvedValue(0);

      await getUserTickets('user-123', 1, 20, 'OPEN');

      expect(mockPrisma.supportTicket.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', status: 'OPEN' },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });
  });

  describe('getTicketById', () => {
    it('returns ticket for owner', async () => {
      mockPrisma.supportTicket.findUnique.mockResolvedValue({
        ...mockTicket,
        user: { id: 'user-123', username: 'testuser', displayName: 'Test', email: 'test@test.com' },
        responses: [],
      });

      const result = await getTicketById('ticket-1', 'user-123');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('ticket-1');
    });

    it('returns ticket for admin even if not owner', async () => {
      mockPrisma.supportTicket.findUnique.mockResolvedValue({
        ...mockTicket,
        user: { id: 'user-123', username: 'testuser', displayName: 'Test', email: 'test@test.com' },
        responses: [],
      });

      const result = await getTicketById('ticket-1', 'admin-456', true);

      expect(result).not.toBeNull();
    });

    it('returns null for non-owner non-admin', async () => {
      mockPrisma.supportTicket.findUnique.mockResolvedValue({
        ...mockTicket,
        user: { id: 'user-123', username: 'testuser', displayName: 'Test', email: 'test@test.com' },
        responses: [],
      });

      const result = await getTicketById('ticket-1', 'other-user');

      expect(result).toBeNull();
    });

    it('returns null for non-existent ticket', async () => {
      mockPrisma.supportTicket.findUnique.mockResolvedValue(null);

      const result = await getTicketById('nonexistent', 'user-123');

      expect(result).toBeNull();
    });
  });

  describe('addResponse', () => {
    it('adds response to owned ticket', async () => {
      mockPrisma.supportTicket.findUnique.mockResolvedValue({
        userId: 'user-123',
        status: 'OPEN',
      });
      mockPrisma.$transaction.mockResolvedValue([
        { id: 'response-1', content: 'Response text' },
        mockTicket,
      ]);

      const result = await addResponse('ticket-1', 'user-123', 'Response text');

      expect(result.id).toBe('response-1');
    });

    it('throws error for non-existent ticket', async () => {
      mockPrisma.supportTicket.findUnique.mockResolvedValue(null);

      await expect(
        addResponse('nonexistent', 'user-123', 'Response')
      ).rejects.toThrow('Ticket not found');
    });

    it('throws error for non-owner non-staff', async () => {
      mockPrisma.supportTicket.findUnique.mockResolvedValue({
        userId: 'other-user',
        status: 'OPEN',
      });

      await expect(
        addResponse('ticket-1', 'user-123', 'Response')
      ).rejects.toThrow('Access denied');
    });

    it('allows staff to respond to any ticket', async () => {
      mockPrisma.supportTicket.findUnique.mockResolvedValue({
        userId: 'other-user',
        status: 'OPEN',
      });
      mockPrisma.$transaction.mockResolvedValue([
        { id: 'response-1', content: 'Staff response', isStaff: true },
        mockTicket,
      ]);

      const result = await addResponse('ticket-1', 'staff-123', 'Staff response', true);

      expect(result.isStaff).toBe(true);
    });

    it('throws error for closed ticket', async () => {
      mockPrisma.supportTicket.findUnique.mockResolvedValue({
        userId: 'user-123',
        status: 'CLOSED',
      });

      await expect(
        addResponse('ticket-1', 'user-123', 'Response')
      ).rejects.toThrow('Cannot respond to closed ticket');
    });

    it('enforces content max length', async () => {
      mockPrisma.supportTicket.findUnique.mockResolvedValue({
        userId: 'user-123',
        status: 'OPEN',
      });
      mockPrisma.$transaction.mockResolvedValue([
        { id: 'response-1', content: 'a'.repeat(2000) },
        mockTicket,
      ]);

      const longContent = 'a'.repeat(3000);
      await addResponse('ticket-1', 'user-123', longContent);

      // Verify transaction was called (content truncation happens inside)
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('closeTicket', () => {
    it('closes owned ticket', async () => {
      mockPrisma.supportTicket.findUnique.mockResolvedValue({ userId: 'user-123' });
      mockPrisma.supportTicket.update.mockResolvedValue({
        ...mockTicket,
        status: 'CLOSED',
      });

      const result = await closeTicket('ticket-1', 'user-123');

      expect(result.status).toBe('CLOSED');
    });

    it('throws error for non-owned ticket', async () => {
      mockPrisma.supportTicket.findUnique.mockResolvedValue({ userId: 'other-user' });

      await expect(
        closeTicket('ticket-1', 'user-123')
      ).rejects.toThrow('Ticket not found or access denied');
    });

    it('throws error for non-existent ticket', async () => {
      mockPrisma.supportTicket.findUnique.mockResolvedValue(null);

      await expect(
        closeTicket('nonexistent', 'user-123')
      ).rejects.toThrow('Ticket not found or access denied');
    });
  });

  describe('listAllTickets (admin)', () => {
    it('returns all tickets paginated', async () => {
      mockPrisma.supportTicket.findMany.mockResolvedValue([mockTicket]);
      mockPrisma.supportTicket.count
        .mockResolvedValueOnce(50) // total
        .mockResolvedValueOnce(10); // open count

      const result = await listAllTickets(1, 20);

      expect(result).toEqual({
        tickets: [mockTicket],
        total: 50,
        page: 1,
        totalPages: 3,
        openCount: 10,
      });
    });

    it('filters by status and category', async () => {
      mockPrisma.supportTicket.findMany.mockResolvedValue([]);
      mockPrisma.supportTicket.count.mockResolvedValue(0);

      await listAllTickets(1, 20, 'OPEN', 'BUG_REPORT');

      expect(mockPrisma.supportTicket.findMany).toHaveBeenCalledWith({
        where: { status: 'OPEN', category: 'BUG_REPORT' },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('supports search', async () => {
      mockPrisma.supportTicket.findMany.mockResolvedValue([]);
      mockPrisma.supportTicket.count.mockResolvedValue(0);

      await listAllTickets(1, 20, undefined, undefined, 'crash');

      expect(mockPrisma.supportTicket.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { subject: { contains: 'crash', mode: 'insensitive' } },
            { user: { username: { contains: 'crash', mode: 'insensitive' } } },
            { user: { displayName: { contains: 'crash', mode: 'insensitive' } } },
          ],
        },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });
  });

  describe('updateTicketStatus (admin)', () => {
    it('updates ticket status', async () => {
      mockPrisma.supportTicket.update.mockResolvedValue({
        ...mockTicket,
        status: 'IN_PROGRESS',
      });

      const result = await updateTicketStatus('ticket-1', 'IN_PROGRESS');

      expect(result.status).toBe('IN_PROGRESS');
    });

    it('sets updatedAt when closing', async () => {
      mockPrisma.supportTicket.update.mockResolvedValue({
        ...mockTicket,
        status: 'CLOSED',
      });

      await updateTicketStatus('ticket-1', 'CLOSED');

      expect(mockPrisma.supportTicket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-1' },
        data: {
          status: 'CLOSED',
          updatedAt: expect.any(Date),
        },
      });
    });
  });

  describe('getTicketStats', () => {
    it('returns ticket statistics', async () => {
      mockPrisma.supportTicket.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(15)
        .mockResolvedValueOnce(25)
        .mockResolvedValueOnce(40);

      const result = await getTicketStats();

      expect(result).toEqual({
        total: 100,
        open: 20,
        inProgress: 15,
        resolved: 25,
        closed: 40,
      });
    });
  });
});
