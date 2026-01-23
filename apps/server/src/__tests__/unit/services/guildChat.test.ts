/**
 * Unit tests for guild chat service
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  mockPrisma,
  createMockGuildMember,
  createMockChatMessage,
  createMockUser,
  createMockGuild,
} from '../../mocks/prisma.js';

// Import test setup
import '../../helpers/setup.js';

// Mock the websocket service
vi.mock('../../../services/websocket.js', () => ({
  broadcastToUsers: vi.fn(),
}));

// Mock the moderation service
vi.mock('../../../services/moderation.js', () => ({
  filterMessageContent: vi.fn().mockReturnValue({
    allowed: true,
    filteredContent: 'Hello',
    warnings: [],
  }),
  trackMessageSent: vi.fn(),
}));

// Import services after mocks
import { sendGuildMessage, getGuildMessages } from '../../../services/guildChat.js';
import { broadcastToUsers } from '../../../services/websocket.js';
import { filterMessageContent, trackMessageSent } from '../../../services/moderation.js';
import { GUILD_ERROR_CODES, GUILD_CONSTANTS } from '@arcade/protocol';

describe('GuildChat Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset filterMessageContent mock to default behavior
    (filterMessageContent as ReturnType<typeof vi.fn>).mockReturnValue({
      allowed: true,
      filteredContent: 'Hello',
      warnings: [],
    });
  });

  describe('sendGuildMessage', () => {
    const guildId = 'guild-123';
    const userId = 'user-123';
    const content = 'Hello, guild!';

    it('should throw NOT_IN_GUILD if user not in guild', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);

      await expect(sendGuildMessage(guildId, userId, content)).rejects.toThrow(
        GUILD_ERROR_CODES.NOT_IN_GUILD
      );

      expect(mockPrisma.guildMember.findUnique).toHaveBeenCalledWith({
        where: { userId },
        include: {
          guild: {
            select: { disbanded: true },
          },
        },
      });
    });

    it('should throw NOT_IN_GUILD if user in different guild', async () => {
      const mockMember = createMockGuildMember({
        userId,
        guildId: 'different-guild-456', // Different guild
        guild: { disbanded: false },
      });
      mockPrisma.guildMember.findUnique.mockResolvedValue(mockMember);

      await expect(sendGuildMessage(guildId, userId, content)).rejects.toThrow(
        GUILD_ERROR_CODES.NOT_IN_GUILD
      );
    });

    it('should throw GUILD_DISBANDED if guild is disbanded', async () => {
      const mockMember = createMockGuildMember({
        userId,
        guildId,
        guild: { disbanded: true },
      });
      mockPrisma.guildMember.findUnique.mockResolvedValue(mockMember);

      await expect(sendGuildMessage(guildId, userId, content)).rejects.toThrow(
        GUILD_ERROR_CODES.GUILD_DISBANDED
      );
    });

    it('should throw CHAT_RATE_LIMIT if rate limited', async () => {
      const mockMember = createMockGuildMember({
        userId,
        guildId,
        guild: { disbanded: false },
      });
      mockPrisma.guildMember.findUnique.mockResolvedValue(mockMember);

      // Send 10 messages to hit the rate limit
      const mockSender = createMockUser({ id: userId });
      mockPrisma.user.findUnique.mockResolvedValue(mockSender);
      mockPrisma.chatMessage.create.mockResolvedValue(createMockChatMessage());
      mockPrisma.guildMember.findMany.mockResolvedValue([{ userId }]);

      // Send 10 messages (rate limit is 10 per minute)
      for (let i = 0; i < 10; i++) {
        await sendGuildMessage(guildId, userId, content);
      }

      // 11th message should be rate limited
      await expect(sendGuildMessage(guildId, userId, content)).rejects.toThrow(
        GUILD_ERROR_CODES.CHAT_RATE_LIMIT
      );
    });

    it('should throw CHAT_MESSAGE_TOO_LONG if exceeds limit', async () => {
      const mockMember = createMockGuildMember({
        userId: 'rate-limit-user-2', // Use different user to avoid rate limit
        guildId,
        guild: { disbanded: false },
      });
      mockPrisma.guildMember.findUnique.mockResolvedValue(mockMember);

      const longContent = 'a'.repeat(GUILD_CONSTANTS.MAX_CHAT_MESSAGE_LENGTH + 1);

      await expect(
        sendGuildMessage(guildId, 'rate-limit-user-2', longContent)
      ).rejects.toThrow(GUILD_ERROR_CODES.CHAT_MESSAGE_TOO_LONG);
    });

    it('should filter content and create message', async () => {
      const filteredUserId = 'filtered-user-123';
      const mockMember = createMockGuildMember({
        userId: filteredUserId,
        guildId,
        guild: { disbanded: false },
      });
      const mockSender = createMockUser({ id: filteredUserId, displayName: 'TestSender' });
      const mockMessage = createMockChatMessage({
        id: 'msg-new',
        senderId: filteredUserId,
        content: 'Hello',
        createdAt: new Date(),
      });

      mockPrisma.guildMember.findUnique.mockResolvedValue(mockMember);
      mockPrisma.user.findUnique.mockResolvedValue(mockSender);
      mockPrisma.chatMessage.create.mockResolvedValue(mockMessage);
      mockPrisma.guildMember.findMany.mockResolvedValue([{ userId: filteredUserId }]);

      (filterMessageContent as ReturnType<typeof vi.fn>).mockReturnValue({
        allowed: true,
        filteredContent: 'Filtered Hello',
        warnings: [],
      });

      const result = await sendGuildMessage(guildId, filteredUserId, content);

      expect(filterMessageContent).toHaveBeenCalledWith(content);
      expect(mockPrisma.chatMessage.create).toHaveBeenCalledWith({
        data: {
          scope: 'GUILD',
          guildId,
          senderId: filteredUserId,
          content: 'Filtered Hello',
        },
      });
      expect(trackMessageSent).toHaveBeenCalledWith(filteredUserId);
      expect(result.id).toBe('msg-new');
    });

    it('should broadcast to all guild members', async () => {
      const broadcastUserId = 'broadcast-user-123';
      const mockMember = createMockGuildMember({
        userId: broadcastUserId,
        guildId,
        guild: { disbanded: false },
      });
      const mockSender = createMockUser({ id: broadcastUserId, displayName: 'Broadcaster' });
      const mockMessage = createMockChatMessage({
        id: 'msg-broadcast',
        senderId: broadcastUserId,
        content: 'Hello',
        createdAt: new Date(),
      });
      const mockMembers = [
        { userId: broadcastUserId },
        { userId: 'member-2' },
        { userId: 'member-3' },
      ];

      mockPrisma.guildMember.findUnique.mockResolvedValue(mockMember);
      mockPrisma.user.findUnique.mockResolvedValue(mockSender);
      mockPrisma.chatMessage.create.mockResolvedValue(mockMessage);
      mockPrisma.guildMember.findMany.mockResolvedValue(mockMembers);

      await sendGuildMessage(guildId, broadcastUserId, content);

      expect(mockPrisma.guildMember.findMany).toHaveBeenCalledWith({
        where: { guildId },
        select: { userId: true },
      });
      expect(broadcastToUsers).toHaveBeenCalledWith(
        [broadcastUserId, 'member-2', 'member-3'],
        expect.objectContaining({
          type: 'guild:chat:message',
          data: expect.objectContaining({
            guildId,
            message: expect.objectContaining({
              id: 'msg-broadcast',
              senderId: broadcastUserId,
              senderName: 'Broadcaster',
            }),
          }),
        })
      );
    });
  });

  describe('getGuildMessages', () => {
    const guildId = 'guild-123';
    const userId = 'user-get-messages';

    it('should throw NOT_IN_GUILD if user not in guild', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);

      await expect(getGuildMessages(guildId, userId)).rejects.toThrow(
        GUILD_ERROR_CODES.NOT_IN_GUILD
      );
    });

    it('should throw GUILD_DISBANDED if guild is disbanded', async () => {
      const mockMember = createMockGuildMember({
        userId,
        guildId,
        guild: { disbanded: true },
      });
      mockPrisma.guildMember.findUnique.mockResolvedValue(mockMember);

      await expect(getGuildMessages(guildId, userId)).rejects.toThrow(
        GUILD_ERROR_CODES.GUILD_DISBANDED
      );
    });

    it('should return paginated messages', async () => {
      const mockMember = createMockGuildMember({
        userId,
        guildId,
        guild: { disbanded: false },
      });
      const mockMessages = [
        createMockChatMessage({ id: 'msg-1', content: 'Message 1', createdAt: new Date('2026-01-23T10:00:00Z') }),
        createMockChatMessage({ id: 'msg-2', content: 'Message 2', createdAt: new Date('2026-01-23T09:00:00Z') }),
      ];

      mockPrisma.guildMember.findUnique.mockResolvedValue(mockMember);
      mockPrisma.chatMessage.findMany.mockResolvedValue(mockMessages);
      mockPrisma.chatMessage.count.mockResolvedValue(2);

      const result = await getGuildMessages(guildId, userId, 50, 0);

      expect(mockPrisma.chatMessage.findMany).toHaveBeenCalledWith({
        where: {
          scope: 'GUILD',
          guildId,
        },
        include: {
          sender: {
            select: { displayName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
      expect(result.messages).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should return messages in chronological order (reversed)', async () => {
      const mockMember = createMockGuildMember({
        userId,
        guildId,
        guild: { disbanded: false },
      });
      // Messages come from DB in desc order (newest first)
      const mockMessages = [
        createMockChatMessage({ id: 'msg-3', content: 'Newest', createdAt: new Date('2026-01-23T12:00:00Z') }),
        createMockChatMessage({ id: 'msg-2', content: 'Middle', createdAt: new Date('2026-01-23T11:00:00Z') }),
        createMockChatMessage({ id: 'msg-1', content: 'Oldest', createdAt: new Date('2026-01-23T10:00:00Z') }),
      ];

      mockPrisma.guildMember.findUnique.mockResolvedValue(mockMember);
      mockPrisma.chatMessage.findMany.mockResolvedValue(mockMessages);
      mockPrisma.chatMessage.count.mockResolvedValue(3);

      const result = await getGuildMessages(guildId, userId);

      // Should be reversed to chronological order (oldest first)
      expect(result.messages[0].id).toBe('msg-1');
      expect(result.messages[0].content).toBe('Oldest');
      expect(result.messages[1].id).toBe('msg-2');
      expect(result.messages[1].content).toBe('Middle');
      expect(result.messages[2].id).toBe('msg-3');
      expect(result.messages[2].content).toBe('Newest');
    });

    it('should include hasMore flag correctly', async () => {
      const mockMember = createMockGuildMember({
        userId,
        guildId,
        guild: { disbanded: false },
      });
      const mockMessages = [
        createMockChatMessage({ id: 'msg-1' }),
        createMockChatMessage({ id: 'msg-2' }),
      ];

      mockPrisma.guildMember.findUnique.mockResolvedValue(mockMember);
      mockPrisma.chatMessage.findMany.mockResolvedValue(mockMessages);
      mockPrisma.chatMessage.count.mockResolvedValue(100); // 100 total messages

      // Request first 2 messages (limit=2, offset=0)
      const result = await getGuildMessages(guildId, userId, 2, 0);

      // offset(0) + limit(2) = 2 < total(100), so hasMore = true
      expect(result.hasMore).toBe(true);

      // Now request with offset at the end
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);
      mockPrisma.chatMessage.count.mockResolvedValue(100);

      const resultEnd = await getGuildMessages(guildId, userId, 50, 100);

      // offset(100) + limit(50) = 150 >= total(100), so hasMore = false
      expect(resultEnd.hasMore).toBe(false);
    });
  });
});
