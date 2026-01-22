/**
 * Guild Chat Service
 * Handles guild chat messages (visible only to guild members)
 */

import { prisma } from '../lib/prisma.js';
import { broadcastToUsers } from './websocket.js';
import { filterMessageContent, trackMessageSent } from './moderation.js';
import { GUILD_ERROR_CODES, GUILD_CONSTANTS } from '@arcade/protocol';
import type { GuildChatMessage } from '@arcade/protocol';

// Rate limiting: max 10 messages per minute per user
const RATE_LIMIT_MESSAGES = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

// Simple in-memory rate limit tracker (in production, use Redis)
const rateLimitMap = new Map<string, number[]>();

/**
 * Check if user can send message (rate limit)
 */
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userMessages = rateLimitMap.get(userId) || [];
  
  // Remove old messages outside the window
  const recentMessages = userMessages.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS);
  
  if (recentMessages.length >= RATE_LIMIT_MESSAGES) {
    return false;
  }
  
  // Add current message timestamp
  recentMessages.push(now);
  rateLimitMap.set(userId, recentMessages);
  
  return true;
}

/**
 * Send a guild chat message
 */
export async function sendGuildMessage(
  guildId: string,
  userId: string,
  content: string
): Promise<GuildChatMessage> {
  // Check membership
  const membership = await prisma.guildMember.findUnique({
    where: { userId },
    include: {
      guild: {
        select: { disbanded: true },
      },
    },
  });

  if (!membership || membership.guildId !== guildId) {
    throw new Error(GUILD_ERROR_CODES.NOT_IN_GUILD);
  }

  if (membership.guild.disbanded) {
    throw new Error(GUILD_ERROR_CODES.GUILD_DISBANDED);
  }

  // Check rate limit
  if (!checkRateLimit(userId)) {
    throw new Error(GUILD_ERROR_CODES.CHAT_RATE_LIMIT);
  }

  // Validate length
  if (content.length > GUILD_CONSTANTS.MAX_CHAT_MESSAGE_LENGTH) {
    throw new Error(GUILD_ERROR_CODES.CHAT_MESSAGE_TOO_LONG);
  }

  // Filter content
  const contentCheck = filterMessageContent(content);
  if (!contentCheck.allowed) {
    throw new Error(contentCheck.error || 'Invalid message content');
  }

  // Get sender info
  const sender = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true },
  });

  if (!sender) {
    throw new Error(GUILD_ERROR_CODES.USER_NOT_FOUND);
  }

  // Create message
  const message = await prisma.chatMessage.create({
    data: {
      scope: 'GUILD',
      guildId,
      senderId: userId,
      content: contentCheck.filteredContent,
    },
  });

  // Track message sent
  await trackMessageSent(userId);

  // Get all guild member IDs for broadcast
  const guildMembers = await prisma.guildMember.findMany({
    where: { guildId },
    select: { userId: true },
  });

  const memberIds = guildMembers.map(m => m.userId);

  // Broadcast to all guild members
  broadcastToUsers(memberIds, {
    type: 'guild:chat:message',
    data: {
      guildId,
      message: {
        id: message.id,
        senderId: message.senderId,
        senderName: sender.displayName,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      },
    },
  });

  return {
    id: message.id,
    senderId: message.senderId,
    senderName: sender.displayName,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}

/**
 * Get guild chat messages
 */
export async function getGuildMessages(
  guildId: string,
  userId: string,
  limit = 50,
  offset = 0
): Promise<{ messages: GuildChatMessage[]; total: number; hasMore: boolean }> {
  // Check membership
  const membership = await prisma.guildMember.findUnique({
    where: { userId },
    include: {
      guild: {
        select: { disbanded: true },
      },
    },
  });

  if (!membership || membership.guildId !== guildId) {
    throw new Error(GUILD_ERROR_CODES.NOT_IN_GUILD);
  }

  if (membership.guild.disbanded) {
    throw new Error(GUILD_ERROR_CODES.GUILD_DISBANDED);
  }

  // Get messages with pagination
  const [messages, total] = await Promise.all([
    prisma.chatMessage.findMany({
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
      take: limit,
      skip: offset,
    }),
    prisma.chatMessage.count({
      where: {
        scope: 'GUILD',
        guildId,
      },
    }),
  ]);

  // Reverse to show oldest first (for display)
  const reversedMessages = [...messages].reverse();

  return {
    messages: reversedMessages.map(m => ({
      id: m.id,
      senderId: m.senderId,
      senderName: m.sender.displayName,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
    total,
    hasMore: offset + limit < total,
  };
}
