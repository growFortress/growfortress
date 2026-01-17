/**
 * Messages Service
 *
 * Handles all messaging operations: threads, messages, notifications.
 */

import { prisma } from '../lib/prisma.js';
import { broadcastToUser, broadcastToUsers } from './websocket.js';
import {
  canUserSendMessage,
  filterMessageContent,
  trackMessageSent,
  areUsersBlocked,
} from './moderation.js';
import { isNewAccount } from '../lib/contentFilter.js';
import type {
  MessageType,
  ThreadSummary,
  ThreadDetail,
  Message,
  UnreadCounts,
  Participant,
} from '@arcade/protocol';
import type { GuildInvitation } from '@prisma/client';

// ============================================================================
// THREAD OPERATIONS
// ============================================================================

/**
 * Get user's message threads
 */
export async function getUserThreads(
  userId: string,
  type: 'all' | 'private' | 'system' | 'guild' = 'all',
  limit = 20,
  offset = 0
): Promise<{ threads: ThreadSummary[]; total: number }> {
  // Build type filter
  const typeFilter = type === 'all'
    ? {}
    : type === 'private'
      ? { type: { in: ['PRIVATE', 'GROUP'] as MessageType[] } }
      : type === 'system'
        ? { type: 'SYSTEM' as MessageType }
        : { type: { in: ['GUILD_INVITE', 'GUILD_KICK'] as MessageType[] } };

  const where = {
    participants: {
      some: {
        userId,
        deletedAt: null, // Not soft-deleted
      },
    },
    ...typeFilter,
  };

  const [threads, total] = await Promise.all([
    prisma.messageThread.findMany({
      where,
      include: {
        participants: {
          include: {
            user: { select: { id: true, displayName: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: { select: { displayName: true } },
          },
        },
        linkedInvitation: {
          select: { status: true },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.messageThread.count({ where }),
  ]);

  return {
    threads: threads.map(thread => {
      const participant = thread.participants.find(p => p.userId === userId);
      const otherParticipants = thread.participants.filter(p => p.userId !== userId);
      const lastMessage = thread.messages[0];

      return {
        id: thread.id,
        subject: thread.subject,
        type: thread.type as MessageType,
        lastMessageAt: thread.lastMessageAt.toISOString(),
        lastMessagePreview: lastMessage
          ? lastMessage.content.slice(0, 100) + (lastMessage.content.length > 100 ? '...' : '')
          : '',
        participants: otherParticipants.map(p => ({
          userId: p.user.id,
          displayName: p.user.displayName,
        })),
        unreadCount: participant?.unreadCount ?? 0,
        linkedInvitationId: thread.linkedInvitationId,
        linkedInvitationStatus: thread.linkedInvitation?.status ?? null,
        isGroup: thread.type === 'GROUP' || thread.participants.length > 2,
        participantCount: thread.participants.length,
      };
    }),
    total,
  };
}

/**
 * Get a specific thread with all messages
 */
export async function getThread(threadId: string, userId: string): Promise<ThreadDetail | null> {
  const thread = await prisma.messageThread.findFirst({
    where: {
      id: threadId,
      participants: {
        some: {
          userId,
          deletedAt: null,
        },
      },
    },
    include: {
      participants: {
        include: {
          user: { select: { id: true, displayName: true } },
        },
      },
      messages: {
        orderBy: { createdAt: 'asc' },
        include: {
          sender: { select: { id: true, displayName: true } },
        },
      },
      linkedInvitation: {
        select: { id: true, status: true },
      },
    },
  });

  if (!thread) {
    return null;
  }

  // Mark as read
  await markThreadRead(threadId, userId);

  const isGroup = thread.type === 'GROUP' || thread.participants.length > 2;
  const isCreator = thread.creatorId === userId;

  return {
    id: thread.id,
    subject: thread.subject,
    type: thread.type as MessageType,
    createdAt: thread.createdAt.toISOString(),
    creatorId: thread.creatorId,
    participants: thread.participants.map(p => ({
      userId: p.user.id,
      displayName: p.user.displayName,
    })),
    messages: thread.messages.map(m => ({
      id: m.id,
      senderId: m.senderId,
      senderName: m.sender?.displayName ?? 'System',
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
    linkedInvitationId: thread.linkedInvitationId,
    canAcceptInvitation: thread.type === 'GUILD_INVITE' && thread.linkedInvitation?.status === 'PENDING',
    canDeclineInvitation: thread.type === 'GUILD_INVITE' && thread.linkedInvitation?.status === 'PENDING',
    isGroup,
    canAddParticipants: isGroup && isCreator && thread.participants.length < thread.maxParticipants,
    canLeave: isGroup && !isCreator,
    maxParticipants: thread.maxParticipants,
  };
}

/**
 * Create a new thread
 */
export async function createThread(
  senderId: string,
  recipientUsernames: string[],
  subject: string,
  content: string
): Promise<ThreadDetail> {
  // Check if user can send
  const canSend = await canUserSendMessage(senderId);
  if (!canSend.allowed) {
    throw new Error(canSend.reason!);
  }

  // Filter content
  const contentCheck = filterMessageContent(content);
  if (!contentCheck.allowed) {
    throw new Error(contentCheck.error!);
  }

  // Get sender
  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { id: true, displayName: true, createdAt: true },
  });

  if (!sender) {
    throw new Error('Użytkownik nie istnieje');
  }

  // Check new account restrictions for group messages
  if (recipientUsernames.length > 1 && isNewAccount(sender.createdAt)) {
    throw new Error('Nowe konta nie mogą tworzyć wiadomości grupowych. Spróbuj ponownie za 24 godziny.');
  }

  // Find recipients
  const recipients = await prisma.user.findMany({
    where: {
      username: { in: recipientUsernames },
    },
    select: { id: true, username: true, displayName: true },
  });

  if (recipients.length === 0) {
    throw new Error('Nie znaleziono odbiorców');
  }

  const notFound = recipientUsernames.filter(
    u => !recipients.find(r => r.username.toLowerCase() === u.toLowerCase())
  );
  if (notFound.length > 0) {
    throw new Error(`Nie znaleziono użytkowników: ${notFound.join(', ')}`);
  }

  // Check blocks
  for (const recipient of recipients) {
    const blocked = await areUsersBlocked(senderId, recipient.id);
    if (blocked) {
      throw new Error(`Nie możesz wysłać wiadomości do ${recipient.username} - jeden z was zablokował drugiego`);
    }
  }

  // Determine thread type
  const type: MessageType = recipients.length > 1 ? 'GROUP' : 'PRIVATE';
  const maxParticipants = type === 'GROUP' ? 10 : 2;

  // Create thread with first message
  const thread = await prisma.$transaction(async (tx) => {
    const newThread = await tx.messageThread.create({
      data: {
        subject,
        type,
        creatorId: type === 'GROUP' ? senderId : null,
        maxParticipants,
        lastMessageAt: new Date(),
        participants: {
          create: [
            { userId: senderId, lastReadAt: new Date() },
            ...recipients.map(r => ({ userId: r.id, unreadCount: 1 })),
          ],
        },
        messages: {
          create: {
            senderId,
            content: contentCheck.filteredContent,
          },
        },
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, displayName: true } },
          },
        },
        messages: {
          include: {
            sender: { select: { id: true, displayName: true } },
          },
        },
      },
    });

    return newThread;
  });

  // Track message sent
  await trackMessageSent(senderId);

  // Send WebSocket notifications to recipients
  const recipientIds = recipients.map(r => r.id);
  broadcastToUsers(recipientIds, {
    type: 'thread:new',
    data: {
      thread: {
        id: thread.id,
        subject: thread.subject,
        type: thread.type as MessageType,
        lastMessageAt: thread.lastMessageAt.toISOString(),
        lastMessagePreview: contentCheck.filteredContent.slice(0, 100),
        participants: [{ userId: sender.id, displayName: sender.displayName }],
        unreadCount: 1,
        linkedInvitationId: null,
        linkedInvitationStatus: null,
        isGroup: type === 'GROUP',
        participantCount: thread.participants.length,
      },
    },
  });

  // Update unread counts for recipients
  for (const recipientId of recipientIds) {
    const counts = await getUnreadCounts(recipientId);
    broadcastToUser(recipientId, {
      type: 'unread:update',
      data: counts,
    });
  }

  return {
    id: thread.id,
    subject: thread.subject,
    type: thread.type as MessageType,
    createdAt: thread.createdAt.toISOString(),
    creatorId: thread.creatorId,
    participants: thread.participants.map(p => ({
      userId: p.user.id,
      displayName: p.user.displayName,
    })),
    messages: thread.messages.map(m => ({
      id: m.id,
      senderId: m.senderId,
      senderName: m.sender?.displayName ?? 'System',
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
    linkedInvitationId: null,
    canAcceptInvitation: false,
    canDeclineInvitation: false,
    isGroup: type === 'GROUP',
    canAddParticipants: type === 'GROUP',
    canLeave: false,
    maxParticipants,
  };
}

/**
 * Reply to a thread
 */
export async function replyToThread(
  threadId: string,
  senderId: string,
  content: string
): Promise<Message> {
  // Check if user can send
  const canSend = await canUserSendMessage(senderId);
  if (!canSend.allowed) {
    throw new Error(canSend.reason!);
  }

  // Filter content
  const contentCheck = filterMessageContent(content);
  if (!contentCheck.allowed) {
    throw new Error(contentCheck.error!);
  }

  // Get thread and verify participation
  const thread = await prisma.messageThread.findFirst({
    where: {
      id: threadId,
      participants: {
        some: {
          userId: senderId,
          deletedAt: null,
        },
      },
    },
    include: {
      participants: {
        where: { deletedAt: null },
        select: { userId: true },
      },
    },
  });

  if (!thread) {
    throw new Error('Wątek nie istnieje lub nie masz do niego dostępu');
  }

  // Check if thread type allows replies (SYSTEM, GUILD_INVITE, GUILD_KICK are non-replyable)
  if (thread.type === 'GUILD_KICK' || thread.type === 'SYSTEM' || thread.type === 'GUILD_INVITE') {
    throw new Error('Nie możesz odpowiadać na powiadomienia systemowe');
  }

  // Check blocks with all other participants
  const otherParticipantIds = thread.participants
    .filter(p => p.userId !== senderId)
    .map(p => p.userId);

  for (const participantId of otherParticipantIds) {
    const blocked = await areUsersBlocked(senderId, participantId);
    if (blocked) {
      throw new Error('Nie możesz wysłać wiadomości - jeden z uczestników został zablokowany');
    }
  }

  // Get sender for display name
  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { displayName: true },
  });

  // Create message and update thread
  const message = await prisma.$transaction(async (tx) => {
    const newMessage = await tx.message.create({
      data: {
        threadId,
        senderId,
        content: contentCheck.filteredContent,
      },
    });

    // Update thread's lastMessageAt
    await tx.messageThread.update({
      where: { id: threadId },
      data: { lastMessageAt: new Date() },
    });

    // Update unread counts for other participants
    await tx.messageParticipant.updateMany({
      where: {
        threadId,
        userId: { not: senderId },
        deletedAt: null,
      },
      data: {
        unreadCount: { increment: 1 },
      },
    });

    // Reset sender's unread count and mark as read
    await tx.messageParticipant.update({
      where: {
        threadId_userId: { threadId, userId: senderId },
      },
      data: {
        unreadCount: 0,
        lastReadAt: new Date(),
      },
    });

    return newMessage;
  });

  // Track message sent
  await trackMessageSent(senderId);

  // Send WebSocket notifications
  broadcastToUsers(otherParticipantIds, {
    type: 'message:new',
    data: {
      threadId,
      message: {
        id: message.id,
        senderId: message.senderId,
        senderName: sender?.displayName ?? 'Unknown',
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      },
      threadSubject: thread.subject,
      senderName: sender?.displayName ?? 'Unknown',
    },
  });

  // Update unread counts for recipients
  for (const recipientId of otherParticipantIds) {
    const counts = await getUnreadCounts(recipientId);
    broadcastToUser(recipientId, {
      type: 'unread:update',
      data: counts,
    });
  }

  return {
    id: message.id,
    senderId: message.senderId,
    senderName: sender?.displayName ?? 'Unknown',
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}

/**
 * Add a participant to a group thread
 */
export async function addParticipant(
  threadId: string,
  username: string,
  addedById: string
): Promise<Participant> {
  const thread = await prisma.messageThread.findFirst({
    where: {
      id: threadId,
      type: 'GROUP',
      creatorId: addedById, // Only creator can add
    },
    include: {
      participants: { where: { deletedAt: null } },
    },
  });

  if (!thread) {
    throw new Error('Wątek nie istnieje lub nie masz uprawnień');
  }

  if (thread.participants.length >= thread.maxParticipants) {
    throw new Error(`Maksymalna liczba uczestników to ${thread.maxParticipants}`);
  }

  const userToAdd = await prisma.user.findUnique({
    where: { username },
    select: { id: true, displayName: true },
  });

  if (!userToAdd) {
    throw new Error('Użytkownik nie istnieje');
  }

  // Check if already a participant
  const existing = thread.participants.find(p => p.userId === userToAdd.id);
  if (existing) {
    throw new Error('Użytkownik jest już uczestnikiem');
  }

  // Check blocks
  const blocked = await areUsersBlocked(addedById, userToAdd.id);
  if (blocked) {
    throw new Error('Nie możesz dodać zablokowanego użytkownika');
  }

  // Add participant
  await prisma.messageParticipant.create({
    data: {
      threadId,
      userId: userToAdd.id,
      unreadCount: 0, // They can see history
    },
  });

  // Get adder's display name
  const adder = await prisma.user.findUnique({
    where: { id: addedById },
    select: { displayName: true },
  });

  // Notify all participants
  const participantIds = thread.participants.map(p => p.userId);
  broadcastToUsers([...participantIds, userToAdd.id], {
    type: 'thread:participant_added',
    data: {
      threadId,
      userId: userToAdd.id,
      displayName: userToAdd.displayName,
      addedBy: adder?.displayName ?? 'Unknown',
    },
  });

  return {
    userId: userToAdd.id,
    displayName: userToAdd.displayName,
  };
}

/**
 * Leave a group thread
 */
export async function leaveThread(threadId: string, userId: string): Promise<void> {
  const thread = await prisma.messageThread.findFirst({
    where: {
      id: threadId,
      type: 'GROUP',
      creatorId: { not: userId }, // Creator cannot leave
      participants: {
        some: {
          userId,
          deletedAt: null,
        },
      },
    },
    include: {
      participants: {
        where: { deletedAt: null },
        select: { userId: true },
      },
    },
  });

  if (!thread) {
    throw new Error('Wątek nie istnieje lub nie możesz go opuścić');
  }

  // Soft delete participation
  await prisma.messageParticipant.update({
    where: {
      threadId_userId: { threadId, userId },
    },
    data: { deletedAt: new Date() },
  });

  // Get leaver's display name
  const leaver = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true },
  });

  // Notify remaining participants
  const remainingIds = thread.participants
    .filter(p => p.userId !== userId)
    .map(p => p.userId);

  broadcastToUsers(remainingIds, {
    type: 'thread:participant_left',
    data: {
      threadId,
      userId,
      displayName: leaver?.displayName ?? 'Unknown',
    },
  });
}

/**
 * Mark a thread as read
 */
export async function markThreadRead(threadId: string, userId: string): Promise<void> {
  await prisma.messageParticipant.updateMany({
    where: {
      threadId,
      userId,
      deletedAt: null,
    },
    data: {
      unreadCount: 0,
      lastReadAt: new Date(),
    },
  });

  // Send update to other devices
  broadcastToUser(userId, {
    type: 'message:read',
    data: { threadId },
  });

  // Update unread counts
  const counts = await getUnreadCounts(userId);
  broadcastToUser(userId, {
    type: 'unread:update',
    data: counts,
  });
}

/**
 * Delete a thread (soft delete for user)
 */
export async function deleteThread(threadId: string, userId: string): Promise<void> {
  // Only delete if not already deleted, and capture result to know if we actually deleted
  const result = await prisma.messageParticipant.updateMany({
    where: {
      threadId,
      userId,
      deletedAt: null, // Guard against repeated deletions
    },
    data: {
      deletedAt: new Date(),
      unreadCount: 0, // Clear unread count for deleted thread
    },
  });

  // Only update unread counts if we actually deleted something
  if (result.count > 0) {
    const counts = await getUnreadCounts(userId);
    broadcastToUser(userId, {
      type: 'unread:update',
      data: counts,
    });
  }
}

// ============================================================================
// UNREAD COUNTS
// ============================================================================

/**
 * Get unread message counts by type
 */
export async function getUnreadCounts(userId: string): Promise<UnreadCounts> {
  const participants = await prisma.messageParticipant.findMany({
    where: {
      userId,
      deletedAt: null,
      unreadCount: { gt: 0 },
    },
    include: {
      thread: {
        select: { type: true },
      },
    },
  });

  let privateCount = 0;
  let systemCount = 0;
  let guildCount = 0;

  for (const p of participants) {
    if (p.thread.type === 'PRIVATE' || p.thread.type === 'GROUP') {
      privateCount += p.unreadCount;
    } else if (p.thread.type === 'SYSTEM') {
      systemCount += p.unreadCount;
    } else {
      guildCount += p.unreadCount;
    }
  }

  return {
    total: privateCount + systemCount + guildCount,
    private: privateCount,
    system: systemCount,
    guild: guildCount,
  };
}

// ============================================================================
// USER SEARCH
// ============================================================================

/**
 * Search for users by username
 */
export async function searchUsers(
  query: string,
  excludeUserId: string,
  limit = 5
): Promise<{ id: string; username: string; displayName: string }[]> {
  const users = await prisma.user.findMany({
    where: {
      id: { not: excludeUserId },
      banned: false,
      OR: [
        { username: { contains: query, mode: 'insensitive' } },
        { displayName: { contains: query, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      username: true,
      displayName: true,
    },
    take: limit,
  });

  return users;
}

// ============================================================================
// SYSTEM MESSAGES
// ============================================================================

/**
 * Create a system message to a single user
 */
export async function createSystemMessage(
  userId: string,
  subject: string,
  content: string
): Promise<string> {
  // Filter content even for system messages (admins may paste unsafe text)
  const contentCheck = filterMessageContent(content);
  const filteredContent = contentCheck.allowed ? contentCheck.filteredContent : content;

  const thread = await prisma.messageThread.create({
    data: {
      subject,
      type: 'SYSTEM',
      lastMessageAt: new Date(),
      participants: {
        create: {
          userId,
          unreadCount: 1,
        },
      },
      messages: {
        create: {
          senderId: null, // System message
          content: filteredContent,
        },
      },
    },
  });

  // Broadcast thread:new first, then fetch and broadcast updated unread counts
  // This ensures counts include the new system message
  broadcastToUser(userId, {
    type: 'thread:new',
    data: {
      thread: {
        id: thread.id,
        subject,
        type: 'SYSTEM',
        lastMessageAt: thread.lastMessageAt.toISOString(),
        lastMessagePreview: filteredContent.slice(0, 100),
        participants: [],
        unreadCount: 1,
        linkedInvitationId: null,
        linkedInvitationStatus: null,
        isGroup: false,
        participantCount: 1,
      },
    },
  });

  // Fetch counts AFTER thread creation and broadcast
  const counts = await getUnreadCounts(userId);
  broadcastToUser(userId, {
    type: 'unread:update',
    data: counts,
  });

  return thread.id;
}

/**
 * Create a system broadcast to all or specific users
 */
export async function createSystemBroadcast(
  subject: string,
  content: string,
  targetUserIds?: string[]
): Promise<number> {
  // Get target users
  const users = targetUserIds
    ? await prisma.user.findMany({
        where: { id: { in: targetUserIds }, banned: false },
        select: { id: true },
      })
    : await prisma.user.findMany({
        where: { banned: false },
        select: { id: true },
      });

  // Create individual threads for each user (or batch if many)
  for (const user of users) {
    await createSystemMessage(user.id, subject, content);
  }

  return users.length;
}

// ============================================================================
// GUILD INTEGRATION
// ============================================================================

/**
 * Create a guild invitation notification thread
 */
export async function createGuildInviteNotification(
  invitation: GuildInvitation & {
    guild: { name: string; tag: string };
    inviter: { displayName: string };
  }
): Promise<string> {
  const content = `**Zaproszenie do gildii**\n\nZostałeś zaproszony do gildii **${invitation.guild.name}** [${invitation.guild.tag}] przez ${invitation.inviter.displayName}.\n\n${invitation.message ? `Wiadomość: ${invitation.message}\n\n` : ''}Możesz zaakceptować lub odrzucić zaproszenie używając przycisków poniżej.`;

  const thread = await prisma.messageThread.create({
    data: {
      subject: `Zaproszenie do gildii ${invitation.guild.name}`,
      type: 'GUILD_INVITE',
      linkedInvitationId: invitation.id,
      lastMessageAt: new Date(),
      participants: {
        create: {
          userId: invitation.inviteeId,
          unreadCount: 1,
        },
      },
      messages: {
        create: {
          senderId: null,
          content,
        },
      },
    },
  });

  // Send WebSocket notification
  broadcastToUser(invitation.inviteeId, {
    type: 'guild:invitation',
    data: {
      invitationId: invitation.id,
      guildId: invitation.guildId,
      guildName: invitation.guild.name,
      guildTag: invitation.guild.tag,
      inviterName: invitation.inviter.displayName,
      message: invitation.message,
      threadId: thread.id,
    },
  });

  const counts = await getUnreadCounts(invitation.inviteeId);
  broadcastToUser(invitation.inviteeId, {
    type: 'unread:update',
    data: counts,
  });

  return thread.id;
}

/**
 * Create a guild kick notification thread
 */
export async function createGuildKickNotification(
  userId: string,
  _guildId: string,
  guildName: string,
  _kickedByUserId: string,
  kickedByDisplayName: string
): Promise<string> {
  const content = `**Wyrzucenie z gildii**\n\nZostałeś usunięty z gildii **${guildName}** przez ${kickedByDisplayName}.`;

  const thread = await prisma.messageThread.create({
    data: {
      subject: `Wyrzucenie z gildii ${guildName}`,
      type: 'GUILD_KICK',
      kickedFromGuildName: guildName,
      kickedByDisplayName,
      lastMessageAt: new Date(),
      participants: {
        create: {
          userId,
          unreadCount: 1,
        },
      },
      messages: {
        create: {
          senderId: null,
          content,
        },
      },
    },
  });

  // Send WebSocket notification
  broadcastToUser(userId, {
    type: 'guild:kicked',
    data: {
      guildId: _guildId,
      guildName,
      kickedBy: kickedByDisplayName,
      threadId: thread.id,
    },
  });

  const counts = await getUnreadCounts(userId);
  broadcastToUser(userId, {
    type: 'unread:update',
    data: counts,
  });

  return thread.id;
}
