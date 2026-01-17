/**
 * Messages service tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUserThreads, getThread, getUnreadCounts, markThreadRead } from '../../../services/messages.js';
import { mockPrisma } from '../../mocks/prisma.js';

// Mock dependencies
vi.mock('../../../services/websocket.js', () => ({
  broadcastToUser: vi.fn(),
  broadcastToUsers: vi.fn(),
}));

vi.mock('../../../services/moderation.js', () => ({
  canUserSendMessage: vi.fn(() => ({ allowed: true })),
  filterMessageContent: vi.fn((content: string) => ({ allowed: true, filteredContent: content, warnings: [] })),
  trackMessageSent: vi.fn(),
  areUsersBlocked: vi.fn(() => false),
}));

vi.mock('../../../lib/contentFilter.js', () => ({
  isNewAccount: vi.fn(() => false),
}));

describe('Messages Service', () => {
  describe('getUserThreads', () => {
    beforeEach(() => {
      mockPrisma.messageThread.findMany.mockResolvedValue([]);
      mockPrisma.messageThread.count.mockResolvedValue(0);
    });

    it('returns empty list for user with no threads', async () => {
      const result = await getUserThreads('user-123');

      expect(result.threads).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('returns threads for user', async () => {
      const now = new Date();
      mockPrisma.messageThread.findMany.mockResolvedValue([
        {
          id: 'thread-1',
          subject: 'Test Thread',
          type: 'PRIVATE',
          lastMessageAt: now,
          linkedInvitationId: null,
          participants: [
            { userId: 'user-123', unreadCount: 0, deletedAt: null, user: { id: 'user-123', displayName: 'User' } },
            { userId: 'user-456', unreadCount: 0, deletedAt: null, user: { id: 'user-456', displayName: 'Other User' } },
          ],
          messages: [
            { content: 'Hello world', sender: { displayName: 'Other User' } },
          ],
          linkedInvitation: null,
        },
      ]);
      mockPrisma.messageThread.count.mockResolvedValue(1);

      const result = await getUserThreads('user-123');

      expect(result.threads.length).toBe(1);
      expect(result.threads[0].subject).toBe('Test Thread');
      expect(result.threads[0].type).toBe('PRIVATE');
      expect(result.total).toBe(1);
    });

    it('filters by thread type', async () => {
      mockPrisma.messageThread.findMany.mockResolvedValue([]);
      mockPrisma.messageThread.count.mockResolvedValue(0);

      await getUserThreads('user-123', 'private');

      expect(mockPrisma.messageThread.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: { in: ['PRIVATE', 'GROUP'] },
          }),
        })
      );
    });

    it('filters by system type', async () => {
      await getUserThreads('user-123', 'system');

      expect(mockPrisma.messageThread.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'SYSTEM',
          }),
        })
      );
    });

    it('excludes deleted threads', async () => {
      await getUserThreads('user-123');

      expect(mockPrisma.messageThread.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            participants: {
              some: {
                userId: 'user-123',
                deletedAt: null,
              },
            },
          }),
        })
      );
    });

    it('respects limit and offset', async () => {
      await getUserThreads('user-123', 'all', 10, 5);

      expect(mockPrisma.messageThread.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 5,
        })
      );
    });

    it('orders by lastMessageAt descending', async () => {
      await getUserThreads('user-123');

      expect(mockPrisma.messageThread.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { lastMessageAt: 'desc' },
        })
      );
    });

    it('includes unread count', async () => {
      const now = new Date();
      mockPrisma.messageThread.findMany.mockResolvedValue([
        {
          id: 'thread-1',
          subject: 'Unread Thread',
          type: 'PRIVATE',
          lastMessageAt: now,
          linkedInvitationId: null,
          participants: [
            { userId: 'user-123', unreadCount: 5, deletedAt: null, user: { id: 'user-123', displayName: 'User' } },
            { userId: 'user-456', unreadCount: 0, deletedAt: null, user: { id: 'user-456', displayName: 'Other' } },
          ],
          messages: [{ content: 'New message', sender: { displayName: 'Other' } }],
          linkedInvitation: null,
        },
      ]);
      mockPrisma.messageThread.count.mockResolvedValue(1);

      const result = await getUserThreads('user-123');

      expect(result.threads[0].unreadCount).toBe(5);
    });

    it('truncates message preview', async () => {
      const now = new Date();
      const longContent = 'A'.repeat(150);
      mockPrisma.messageThread.findMany.mockResolvedValue([
        {
          id: 'thread-1',
          subject: 'Long Thread',
          type: 'PRIVATE',
          lastMessageAt: now,
          linkedInvitationId: null,
          participants: [
            { userId: 'user-123', unreadCount: 0, deletedAt: null, user: { id: 'user-123', displayName: 'User' } },
          ],
          messages: [{ content: longContent, sender: { displayName: 'User' } }],
          linkedInvitation: null,
        },
      ]);
      mockPrisma.messageThread.count.mockResolvedValue(1);

      const result = await getUserThreads('user-123');

      expect(result.threads[0].lastMessagePreview.length).toBeLessThanOrEqual(103); // 100 + '...'
      expect(result.threads[0].lastMessagePreview.endsWith('...')).toBe(true);
    });
  });

  describe('getThread', () => {
    beforeEach(() => {
      mockPrisma.messageParticipant.update.mockResolvedValue({});
      mockPrisma.messageParticipant.updateMany.mockResolvedValue({ count: 1 });
      // Mock for getUnreadCounts called within markThreadRead
      mockPrisma.messageParticipant.findMany.mockResolvedValue([]);
    });

    it('returns null if thread not found', async () => {
      mockPrisma.messageThread.findFirst.mockResolvedValue(null);

      const result = await getThread('nonexistent', 'user-123');

      expect(result).toBeNull();
    });

    it('returns null if user not participant', async () => {
      mockPrisma.messageThread.findFirst.mockResolvedValue(null);

      const result = await getThread('thread-123', 'not-participant');

      expect(result).toBeNull();
    });

    it('returns thread with messages', async () => {
      const now = new Date();
      mockPrisma.messageThread.findFirst.mockResolvedValue({
        id: 'thread-1',
        subject: 'Test Thread',
        type: 'PRIVATE',
        createdAt: now,
        creatorId: 'user-456',
        linkedInvitationId: null,
        maxParticipants: 10,
        participants: [
          { userId: 'user-123', user: { id: 'user-123', displayName: 'User' } },
          { userId: 'user-456', user: { id: 'user-456', displayName: 'Creator' } },
        ],
        messages: [
          { id: 'msg-1', senderId: 'user-456', content: 'Hello', createdAt: now, sender: { id: 'user-456', displayName: 'Creator' } },
        ],
        linkedInvitation: null,
      });

      const result = await getThread('thread-1', 'user-123');

      expect(result).not.toBeNull();
      expect(result!.subject).toBe('Test Thread');
      expect(result!.messages.length).toBe(1);
      expect(result!.messages[0].content).toBe('Hello');
    });

    it('marks thread as read', async () => {
      const now = new Date();
      mockPrisma.messageThread.findFirst.mockResolvedValue({
        id: 'thread-1',
        subject: 'Test',
        type: 'PRIVATE',
        createdAt: now,
        creatorId: 'user-456',
        linkedInvitationId: null,
        maxParticipants: 10,
        participants: [
          { userId: 'user-123', user: { id: 'user-123', displayName: 'User' } },
        ],
        messages: [],
        linkedInvitation: null,
      });

      await getThread('thread-1', 'user-123');

      // markThreadRead uses updateMany to reset unread count
      expect(mockPrisma.messageParticipant.updateMany).toHaveBeenCalledWith({
        where: {
          threadId: 'thread-1',
          userId: 'user-123',
          deletedAt: null,
        },
        data: {
          unreadCount: 0,
          lastReadAt: expect.any(Date),
        },
      });
    });

    it('identifies group threads', async () => {
      const now = new Date();
      mockPrisma.messageThread.findFirst.mockResolvedValue({
        id: 'thread-1',
        subject: 'Group Chat',
        type: 'GROUP',
        createdAt: now,
        creatorId: 'user-123',
        linkedInvitationId: null,
        maxParticipants: 10,
        participants: [
          { userId: 'user-123', user: { id: 'user-123', displayName: 'Creator' } },
          { userId: 'user-456', user: { id: 'user-456', displayName: 'User 2' } },
          { userId: 'user-789', user: { id: 'user-789', displayName: 'User 3' } },
        ],
        messages: [],
        linkedInvitation: null,
      });

      const result = await getThread('thread-1', 'user-123');

      expect(result!.isGroup).toBe(true);
      expect(result!.canAddParticipants).toBe(true);
      expect(result!.canLeave).toBe(false); // Creator cannot leave
    });

    it('handles guild invitation threads', async () => {
      const now = new Date();
      mockPrisma.messageThread.findFirst.mockResolvedValue({
        id: 'thread-1',
        subject: 'Guild Invitation',
        type: 'GUILD_INVITE',
        createdAt: now,
        creatorId: 'user-456',
        linkedInvitationId: 'inv-123',
        maxParticipants: 2,
        participants: [
          { userId: 'user-123', user: { id: 'user-123', displayName: 'Invitee' } },
        ],
        messages: [],
        linkedInvitation: { id: 'inv-123', status: 'PENDING' },
      });

      const result = await getThread('thread-1', 'user-123');

      expect(result!.canAcceptInvitation).toBe(true);
      expect(result!.canDeclineInvitation).toBe(true);
    });
  });

  describe('getUnreadCounts', () => {
    it('returns unread counts by type', async () => {
      mockPrisma.messageParticipant.findMany.mockResolvedValue([
        { thread: { type: 'PRIVATE' }, unreadCount: 3 },
        { thread: { type: 'PRIVATE' }, unreadCount: 2 },
        { thread: { type: 'SYSTEM' }, unreadCount: 5 },
        { thread: { type: 'GUILD_INVITE' }, unreadCount: 1 },
      ]);

      const result = await getUnreadCounts('user-123');

      expect(result.private).toBe(5);
      expect(result.system).toBe(5);
      expect(result.guild).toBe(1);
      expect(result.total).toBe(11);
    });

    it('returns zero counts for user with no unread', async () => {
      mockPrisma.messageParticipant.findMany.mockResolvedValue([]);

      const result = await getUnreadCounts('user-123');

      expect(result.private).toBe(0);
      expect(result.system).toBe(0);
      expect(result.guild).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe('markThreadRead', () => {
    beforeEach(() => {
      mockPrisma.messageParticipant.updateMany.mockResolvedValue({ count: 1 });
      // Mock for getUnreadCounts called within markThreadRead
      mockPrisma.messageParticipant.findMany.mockResolvedValue([]);
    });

    it('sets unread count to 0', async () => {
      await markThreadRead('thread-123', 'user-123');

      expect(mockPrisma.messageParticipant.updateMany).toHaveBeenCalledWith({
        where: {
          threadId: 'thread-123',
          userId: 'user-123',
          deletedAt: null,
        },
        data: {
          unreadCount: 0,
          lastReadAt: expect.any(Date),
        },
      });
    });
  });
});
