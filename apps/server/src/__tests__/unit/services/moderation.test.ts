/**
 * Moderation service tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockPrisma, createMockUser } from '../../mocks/prisma.js';
import '../../helpers/setup.js';

// Mock websocket service
vi.mock('../../../services/websocket.js', () => ({
  broadcastToUser: vi.fn(),
}));

// Mock contentFilter
vi.mock('../../../lib/contentFilter.js', () => ({
  validateAndFilterContent: vi.fn(),
  RATE_LIMITS: { MESSAGE_COOLDOWN_SECONDS: 2 },
}));

// Mock messages service (for muteUser/unmuteUser/warnUser)
vi.mock('../../../services/messages.js', () => ({
  createSystemMessage: vi.fn().mockResolvedValue('thread-123'),
}));

// Import service functions after mocks
import {
  canUserSendMessage,
  filterMessageContent,
  blockUser,
  unblockUser,
  getBlockedUsers,
  areUsersBlocked,
  reportMessage,
  muteUser,
  unmuteUser,
  isUserMuted,
} from '../../../services/moderation.js';
import { broadcastToUser } from '../../../services/websocket.js';
import { validateAndFilterContent } from '../../../lib/contentFilter.js';

describe('Moderation Service', () => {
  // ============================================================================
  // canUserSendMessage
  // ============================================================================
  describe('canUserSendMessage', () => {
    it('should return not allowed if user is muted (permanent)', async () => {
      mockPrisma.userMute.findFirst.mockResolvedValue({
        id: 'mute-123',
        userId: 'user-123',
        reason: 'Spam',
        expiresAt: null, // Permanent mute
        createdAt: new Date(),
      });

      const result = await canUserSendMessage('user-123');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('na stałe');
      expect(result.reason).toContain('Spam');
    });

    it('should return not allowed if user is muted (temporary, not expired)', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
      mockPrisma.userMute.findFirst.mockResolvedValue({
        id: 'mute-123',
        userId: 'user-123',
        reason: 'Harassment',
        expiresAt: futureDate,
        createdAt: new Date(),
      });

      const result = await canUserSendMessage('user-123');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('do');
      expect(result.reason).toContain('Harassment');
    });

    it('should return allowed if mute has expired', async () => {
      // No active mute found (query filters expired mutes)
      mockPrisma.userMute.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(
        createMockUser({
          lastMessageAt: new Date(Date.now() - 10000), // 10 seconds ago
          messagesToday: 5,
        })
      );

      const result = await canUserSendMessage('user-123');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return not allowed if rate limited (cooldown)', async () => {
      mockPrisma.userMute.findFirst.mockResolvedValue(null);
      // Last message was 1 second ago, cooldown is 2 seconds
      mockPrisma.user.findUnique.mockResolvedValue(
        createMockUser({
          lastMessageAt: new Date(Date.now() - 1000), // 1 second ago
          messagesToday: 5,
        })
      );

      const result = await canUserSendMessage('user-123');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('sekund');
    });

    it('should return allowed for valid user with no restrictions', async () => {
      mockPrisma.userMute.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(
        createMockUser({
          lastMessageAt: new Date(Date.now() - 10000), // 10 seconds ago
          messagesToday: 5,
        })
      );

      const result = await canUserSendMessage('user-123');

      expect(result.allowed).toBe(true);
    });
  });

  // ============================================================================
  // filterMessageContent
  // ============================================================================
  describe('filterMessageContent', () => {
    it('should return allowed with filtered content', () => {
      vi.mocked(validateAndFilterContent).mockReturnValue({
        isValid: true,
        filteredContent: 'Hello world!',
        errors: [],
        warnings: [],
      });

      const result = filterMessageContent('Hello world!');

      expect(result.allowed).toBe(true);
      expect(result.filteredContent).toBe('Hello world!');
      expect(result.warnings).toEqual([]);
    });

    it('should return not allowed with error message', () => {
      vi.mocked(validateAndFilterContent).mockReturnValue({
        isValid: false,
        filteredContent: 'Test content',
        errors: ['Contains phishing link'],
        warnings: [],
      });

      const result = filterMessageContent('Test content with bad link');

      expect(result.allowed).toBe(false);
      expect(result.error).toBe('Contains phishing link');
    });

    it('should include warnings in result', () => {
      vi.mocked(validateAndFilterContent).mockReturnValue({
        isValid: true,
        filteredContent: 'Hello ****!',
        errors: [],
        warnings: ['Some words were censored'],
      });

      const result = filterMessageContent('Hello bad-word!');

      expect(result.allowed).toBe(true);
      expect(result.warnings).toContain('Some words were censored');
    });
  });

  // ============================================================================
  // blockUser
  // ============================================================================
  describe('blockUser', () => {
    it('should throw error when blocking self', async () => {
      await expect(blockUser('user-123', 'user-123')).rejects.toThrow(
        'Nie możesz zablokować samego siebie'
      );
    });

    it('should throw error if blocked user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(blockUser('user-123', 'user-456')).rejects.toThrow(
        'Użytkownik nie istnieje'
      );
    });

    it('should create block record via upsert', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ id: 'user-456' }));
      mockPrisma.userBlock.upsert.mockResolvedValue({
        id: 'block-123',
        blockerId: 'user-123',
        blockedId: 'user-456',
        createdAt: new Date(),
      });

      await blockUser('user-123', 'user-456');

      expect(mockPrisma.userBlock.upsert).toHaveBeenCalledWith({
        where: {
          blockerId_blockedId: { blockerId: 'user-123', blockedId: 'user-456' },
        },
        create: { blockerId: 'user-123', blockedId: 'user-456' },
        update: {},
      });
    });

    it('should handle duplicate blocks gracefully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ id: 'user-456' }));
      mockPrisma.userBlock.upsert.mockResolvedValue({
        id: 'block-123',
        blockerId: 'user-123',
        blockedId: 'user-456',
        createdAt: new Date(),
      });

      // Should not throw even if block already exists
      await expect(blockUser('user-123', 'user-456')).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // unblockUser
  // ============================================================================
  describe('unblockUser', () => {
    it('should delete block record', async () => {
      mockPrisma.userBlock.deleteMany.mockResolvedValue({ count: 1 });

      await unblockUser('user-123', 'user-456');

      expect(mockPrisma.userBlock.deleteMany).toHaveBeenCalledWith({
        where: { blockerId: 'user-123', blockedId: 'user-456' },
      });
    });

    it('should handle non-existent block gracefully', async () => {
      mockPrisma.userBlock.deleteMany.mockResolvedValue({ count: 0 });

      // Should not throw even if no block exists
      await expect(unblockUser('user-123', 'user-456')).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // getBlockedUsers
  // ============================================================================
  describe('getBlockedUsers', () => {
    it('should return empty array if no blocks', async () => {
      mockPrisma.userBlock.findMany.mockResolvedValue([]);

      const result = await getBlockedUsers('user-123');

      expect(result).toEqual([]);
    });

    it('should return blocked users with details', async () => {
      const createdAt = new Date();
      mockPrisma.userBlock.findMany.mockResolvedValue([
        {
          id: 'block-1',
          blockerId: 'user-123',
          blockedId: 'user-456',
          createdAt,
          blocked: {
            id: 'user-456',
            username: 'blockeduser',
            displayName: 'Blocked User',
          },
        },
        {
          id: 'block-2',
          blockerId: 'user-123',
          blockedId: 'user-789',
          createdAt,
          blocked: {
            id: 'user-789',
            username: 'anotheruser',
            displayName: 'Another User',
          },
        },
      ]);

      const result = await getBlockedUsers('user-123');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'block-1',
        userId: 'user-456',
        username: 'blockeduser',
        displayName: 'Blocked User',
        blockedAt: createdAt.toISOString(),
      });
      expect(result[1].userId).toBe('user-789');
    });
  });

  // ============================================================================
  // areUsersBlocked
  // ============================================================================
  describe('areUsersBlocked', () => {
    it('should return true if user1 blocked user2', async () => {
      mockPrisma.userBlock.findFirst.mockResolvedValue({
        id: 'block-123',
        blockerId: 'user-123',
        blockedId: 'user-456',
        createdAt: new Date(),
      });

      const result = await areUsersBlocked('user-123', 'user-456');

      expect(result).toBe(true);
    });

    it('should return true if user2 blocked user1 (mutual check)', async () => {
      mockPrisma.userBlock.findFirst.mockResolvedValue({
        id: 'block-123',
        blockerId: 'user-456',
        blockedId: 'user-123',
        createdAt: new Date(),
      });

      const result = await areUsersBlocked('user-123', 'user-456');

      expect(result).toBe(true);
      // Verify the query checks both directions
      expect(mockPrisma.userBlock.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { blockerId: 'user-123', blockedId: 'user-456' },
            { blockerId: 'user-456', blockedId: 'user-123' },
          ],
        },
      });
    });

    it('should return false if no blocks exist', async () => {
      mockPrisma.userBlock.findFirst.mockResolvedValue(null);

      const result = await areUsersBlocked('user-123', 'user-456');

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // reportMessage
  // ============================================================================
  describe('reportMessage', () => {
    it('should throw error if message does not exist', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(null);

      await expect(
        reportMessage('user-123', 'msg-123', 'SPAM')
      ).rejects.toThrow('Wiadomość nie istnieje');
    });

    it('should throw error if already reported', async () => {
      mockPrisma.message.findUnique.mockResolvedValue({
        id: 'msg-123',
        threadId: 'thread-123',
        senderId: 'user-456',
        content: 'Test message',
        thread: { id: 'thread-123' },
      });
      mockPrisma.messageReport.findFirst.mockResolvedValue({
        id: 'report-123',
        reporterId: 'user-123',
        messageId: 'msg-123',
      });

      await expect(
        reportMessage('user-123', 'msg-123', 'SPAM')
      ).rejects.toThrow('Już zgłosiłeś tę wiadomość');
    });

    it('should create report with correct data', async () => {
      mockPrisma.message.findUnique.mockResolvedValue({
        id: 'msg-123',
        threadId: 'thread-123',
        senderId: 'user-456',
        content: 'Spam message',
        thread: { id: 'thread-123' },
      });
      mockPrisma.messageReport.findFirst.mockResolvedValue(null);
      mockPrisma.messageReport.create.mockResolvedValue({
        id: 'report-123',
        reporterId: 'user-123',
        messageId: 'msg-123',
        threadId: 'thread-123',
        reason: 'SPAM',
        details: 'This is spam',
      });

      await reportMessage('user-123', 'msg-123', 'SPAM', 'This is spam');

      expect(mockPrisma.messageReport.create).toHaveBeenCalledWith({
        data: {
          reporterId: 'user-123',
          messageId: 'msg-123',
          threadId: 'thread-123',
          reason: 'SPAM',
          details: 'This is spam',
        },
      });
    });

    it('should include threadId from message', async () => {
      mockPrisma.message.findUnique.mockResolvedValue({
        id: 'msg-123',
        threadId: 'thread-specific-456',
        senderId: 'user-456',
        content: 'Test',
        thread: { id: 'thread-specific-456' },
      });
      mockPrisma.messageReport.findFirst.mockResolvedValue(null);
      mockPrisma.messageReport.create.mockResolvedValue({
        id: 'report-123',
      });

      await reportMessage('user-123', 'msg-123', 'HARASSMENT');

      expect(mockPrisma.messageReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            threadId: 'thread-specific-456',
          }),
        })
      );
    });
  });

  // ============================================================================
  // muteUser
  // ============================================================================
  describe('muteUser', () => {
    beforeEach(() => {
      mockPrisma.userMute.create.mockResolvedValue({
        id: 'mute-123',
        userId: 'user-456',
        mutedBy: 'admin-123',
        reason: 'SPAM',
        details: 'Repeated spamming',
        expiresAt: null,
        createdAt: new Date(),
      });
    });

    it('should create mute record with expiry for duration', async () => {
      await muteUser('user-456', '24h', 'SPAM', 'admin-123', 'Repeated spamming');

      expect(mockPrisma.userMute.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-456',
          mutedBy: 'admin-123',
          reason: 'SPAM',
          details: 'Repeated spamming',
          expiresAt: expect.any(Date),
        },
      });

      // Verify expiry is approximately 24 hours from now
      const callArgs = mockPrisma.userMute.create.mock.calls[0][0];
      const expiresAt = callArgs.data.expiresAt as Date;
      const expectedExpiry = Date.now() + 24 * 60 * 60 * 1000;
      expect(expiresAt.getTime()).toBeCloseTo(expectedExpiry, -3); // Within 1 second
    });

    it('should create permanent mute when duration is null', async () => {
      await muteUser('user-456', null, 'HARASSMENT', 'admin-123');

      expect(mockPrisma.userMute.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt: null,
        }),
      });
    });

    it('should send system message to muted user', async () => {
      const { createSystemMessage } = await import('../../../services/messages.js');

      await muteUser('user-456', '7d', 'SPAM', 'admin-123');

      expect(createSystemMessage).toHaveBeenCalledWith(
        'user-456',
        'Wyciszenie konta',
        expect.stringContaining('7d')
      );
    });

    it('should broadcast WebSocket notification', async () => {
      await muteUser('user-456', '24h', 'SPAM', 'admin-123');

      expect(broadcastToUser).toHaveBeenCalledWith('user-456', {
        type: 'moderation:muted',
        data: {
          reason: 'SPAM',
          expiresAt: expect.any(String),
        },
      });
    });
  });

  // ============================================================================
  // unmuteUser
  // ============================================================================
  describe('unmuteUser', () => {
    beforeEach(() => {
      mockPrisma.userMute.deleteMany.mockResolvedValue({ count: 1 });
    });

    it('should delete active mutes', async () => {
      await unmuteUser('user-456', 'admin-123');

      expect(mockPrisma.userMute.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-456',
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: expect.any(Date) } },
          ],
        },
      });
    });

    it('should broadcast WebSocket notification', async () => {
      await unmuteUser('user-456', 'admin-123');

      expect(broadcastToUser).toHaveBeenCalledWith('user-456', {
        type: 'moderation:unmuted',
        data: {},
      });
    });
  });

  // ============================================================================
  // isUserMuted
  // ============================================================================
  describe('isUserMuted', () => {
    it('should return true for permanent mute', async () => {
      mockPrisma.userMute.findFirst.mockResolvedValue({
        id: 'mute-123',
        userId: 'user-123',
        expiresAt: null, // Permanent
        reason: 'SPAM',
        createdAt: new Date(),
      });

      const result = await isUserMuted('user-123');

      expect(result).toBe(true);
    });

    it('should return true for active temporary mute', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      mockPrisma.userMute.findFirst.mockResolvedValue({
        id: 'mute-123',
        userId: 'user-123',
        expiresAt: futureDate,
        reason: 'HARASSMENT',
        createdAt: new Date(),
      });

      const result = await isUserMuted('user-123');

      expect(result).toBe(true);
    });

    it('should return false for expired mute', async () => {
      // The query filters out expired mutes, so findFirst returns null
      mockPrisma.userMute.findFirst.mockResolvedValue(null);

      const result = await isUserMuted('user-123');

      expect(result).toBe(false);
    });
  });
});
