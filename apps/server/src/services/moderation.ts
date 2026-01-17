/**
 * Moderation Service
 *
 * Handles user blocking, reporting messages, and muting users.
 */

import { prisma } from '../lib/prisma.js';
import { broadcastToUser } from './websocket.js';
import {
  validateAndFilterContent,
  RATE_LIMITS,
} from '../lib/contentFilter.js';
import type {
  ReportReason,
  ReportStatus,
  MuteReason,
  MessageReport,
  BlockedUser,
  UserMute,
} from '@arcade/protocol';

// ============================================================================
// CONTENT FILTERING
// ============================================================================

export interface ContentCheckResult {
  allowed: boolean;
  filteredContent: string;
  error?: string;
  warnings: string[];
}

/**
 * Check if user can send a message (not muted, rate limits ok)
 */
export async function canUserSendMessage(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  // Check if user is muted
  const activeMute = await prisma.userMute.findFirst({
    where: {
      userId,
      OR: [
        { expiresAt: null }, // Permanent
        { expiresAt: { gt: new Date() } }, // Not yet expired
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  if (activeMute) {
    const expiresText = activeMute.expiresAt
      ? `do ${activeMute.expiresAt.toLocaleDateString('pl-PL')}`
      : 'na stałe';
    return {
      allowed: false,
      reason: `Twoje konto jest wyciszone ${expiresText}. Powód: ${activeMute.reason}`,
    };
  }

  // Check rate limits
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      createdAt: true,
      lastMessageAt: true,
      messagesToday: true,
      messagesResetAt: true,
    },
  });

  if (!user) {
    return { allowed: false, reason: 'Użytkownik nie istnieje' };
  }

  // Check cooldown
  if (user.lastMessageAt) {
    const secondsSinceLastMessage = (Date.now() - user.lastMessageAt.getTime()) / 1000;
    if (secondsSinceLastMessage < RATE_LIMITS.MESSAGE_COOLDOWN_SECONDS) {
      return {
        allowed: false,
        reason: `Poczekaj ${Math.ceil(RATE_LIMITS.MESSAGE_COOLDOWN_SECONDS - secondsSinceLastMessage)} sekund przed wysłaniem kolejnej wiadomości`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Filter and validate message content
 */
export function filterMessageContent(content: string): ContentCheckResult {
  const result = validateAndFilterContent(content);

  if (!result.isValid) {
    return {
      allowed: false,
      filteredContent: content,
      error: result.errors[0],
      warnings: result.warnings,
    };
  }

  return {
    allowed: true,
    filteredContent: result.filteredContent,
    warnings: result.warnings,
  };
}

/**
 * Update user's message tracking after sending
 */
export async function trackMessageSent(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      lastMessageAt: new Date(),
      messagesToday: { increment: 1 },
    },
  });
}

// ============================================================================
// BLOCKING
// ============================================================================

/**
 * Block a user
 */
export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  if (blockerId === blockedId) {
    throw new Error('Nie możesz zablokować samego siebie');
  }

  // Check if blocked user exists
  const blockedUser = await prisma.user.findUnique({
    where: { id: blockedId },
  });

  if (!blockedUser) {
    throw new Error('Użytkownik nie istnieje');
  }

  // Create block (upsert to handle duplicates)
  await prisma.userBlock.upsert({
    where: {
      blockerId_blockedId: { blockerId, blockedId },
    },
    create: { blockerId, blockedId },
    update: {}, // No update needed
  });
}

/**
 * Unblock a user
 */
export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  await prisma.userBlock.deleteMany({
    where: { blockerId, blockedId },
  });
}

/**
 * Get list of blocked users
 */
export async function getBlockedUsers(userId: string): Promise<BlockedUser[]> {
  const blocks = await prisma.userBlock.findMany({
    where: { blockerId: userId },
    include: {
      blocked: {
        select: { id: true, username: true, displayName: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return blocks.map(block => ({
    id: block.id,
    userId: block.blocked.id,
    username: block.blocked.username,
    displayName: block.blocked.displayName,
    blockedAt: block.createdAt.toISOString(),
  }));
}

/**
 * Check if two users have blocked each other (mutual block check)
 */
export async function areUsersBlocked(userId1: string, userId2: string): Promise<boolean> {
  const block = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: userId1, blockedId: userId2 },
        { blockerId: userId2, blockedId: userId1 },
      ],
    },
  });

  return block !== null;
}

// ============================================================================
// REPORTS
// ============================================================================

/**
 * Report a message
 */
export async function reportMessage(
  reporterId: string,
  messageId: string,
  reason: ReportReason,
  details?: string
): Promise<void> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { thread: true },
  });

  if (!message) {
    throw new Error('Wiadomość nie istnieje');
  }

  // Check if already reported by this user
  const existingReport = await prisma.messageReport.findFirst({
    where: {
      reporterId,
      messageId,
    },
  });

  if (existingReport) {
    throw new Error('Już zgłosiłeś tę wiadomość');
  }

  await prisma.messageReport.create({
    data: {
      reporterId,
      messageId,
      threadId: message.threadId,
      reason,
      details,
    },
  });

  // TODO: Check for auto-hide threshold (3 unique reporters)
  // This could be implemented by adding a 'hidden' field to Message model
  // const reportCount = await prisma.messageReport.count({
  //   where: { messageId, status: 'PENDING' },
  // });
  // If reportCount >= 3, auto-hide the message
}

/**
 * Report a thread
 */
export async function reportThread(
  reporterId: string,
  threadId: string,
  reason: ReportReason,
  details?: string
): Promise<void> {
  const thread = await prisma.messageThread.findUnique({
    where: { id: threadId },
  });

  if (!thread) {
    throw new Error('Wątek nie istnieje');
  }

  // Check if already reported by this user
  const existingReport = await prisma.messageReport.findFirst({
    where: {
      reporterId,
      threadId,
      messageId: null,
    },
  });

  if (existingReport) {
    throw new Error('Już zgłosiłeś ten wątek');
  }

  await prisma.messageReport.create({
    data: {
      reporterId,
      threadId,
      reason,
      details,
    },
  });
}

/**
 * Get pending reports (admin only)
 */
export async function getPendingReports(
  status?: ReportStatus,
  limit = 20,
  offset = 0
): Promise<{ reports: MessageReport[]; total: number }> {
  const where = status ? { status } : {};

  const [reports, total] = await Promise.all([
    prisma.messageReport.findMany({
      where,
      include: {
        reporter: { select: { username: true } },
        reviewer: { select: { username: true } },
        message: {
          select: {
            content: true,
            sender: { select: { username: true } },
          },
        },
        thread: { select: { subject: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.messageReport.count({ where }),
  ]);

  return {
    reports: reports.map(r => ({
      id: r.id,
      threadId: r.threadId,
      messageId: r.messageId,
      reporterUsername: r.reporter.username,
      reason: r.reason as ReportReason,
      details: r.details,
      status: r.status as ReportStatus,
      reviewedBy: r.reviewer?.username ?? null,
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      actionTaken: r.actionTaken,
      createdAt: r.createdAt.toISOString(),
      messageContent: r.message?.content ?? null,
      threadSubject: r.thread?.subject ?? null,
      senderUsername: r.message?.sender?.username ?? null,
    })),
    total,
  };
}

/**
 * Review a report (admin only)
 */
export async function reviewReport(
  reportId: string,
  adminId: string,
  action: 'dismiss' | 'warn' | 'mute_24h' | 'mute_7d' | 'mute_30d' | 'mute_permanent',
  notes?: string
): Promise<void> {
  const report = await prisma.messageReport.findUnique({
    where: { id: reportId },
    include: {
      message: { select: { senderId: true } },
    },
  });

  if (!report) {
    throw new Error('Zgłoszenie nie istnieje');
  }

  if (report.status !== 'PENDING') {
    throw new Error('To zgłoszenie zostało już rozpatrzone');
  }

  const targetUserId = report.message?.senderId;

  // Apply action
  if (action !== 'dismiss' && targetUserId) {
    if (action === 'warn') {
      await warnUser(targetUserId, report.reason, adminId, notes);
    } else {
      const durations: Record<string, string | null> = {
        'mute_24h': '24h',
        'mute_7d': '7d',
        'mute_30d': '30d',
        'mute_permanent': null,
      };
      await muteUser(targetUserId, durations[action] as '24h' | '7d' | '30d' | null, report.reason as MuteReason, adminId, notes);
    }
  }

  // Update report status
  await prisma.messageReport.update({
    where: { id: reportId },
    data: {
      status: action === 'dismiss' ? 'DISMISSED' : 'ACTIONED',
      reviewedBy: adminId,
      reviewedAt: new Date(),
      actionTaken: action === 'dismiss' ? 'Zgłoszenie odrzucone' : `Zastosowano: ${action}`,
    },
  });
}

// ============================================================================
// WARNINGS & MUTES
// ============================================================================

/**
 * Warn a user (sends system message)
 */
export async function warnUser(
  userId: string,
  reason: string,
  _adminId: string,
  details?: string
): Promise<void> {
  // Import here to avoid circular dependency
  const { createSystemMessage } = await import('./messages.js');

  const content = `**Ostrzeżenie**\n\nOtrzymałeś ostrzeżenie za naruszenie regulaminu.\n\nPowód: ${reason}${details ? `\n\nSzczegóły: ${details}` : ''}\n\nPamiętaj, że kolejne naruszenia mogą skutkować czasowym lub stałym wyciszeniem.`;

  const threadId = await createSystemMessage(userId, 'Ostrzeżenie od moderacji', content);

  // Send WebSocket notification with the created thread ID for deep-linking
  broadcastToUser(userId, {
    type: 'moderation:warning',
    data: {
      reason,
      threadId,
    },
  });
}

/**
 * Mute a user
 */
export async function muteUser(
  userId: string,
  duration: '24h' | '7d' | '30d' | null, // null = permanent
  reason: MuteReason,
  adminId: string,
  details?: string
): Promise<void> {
  // Calculate expiry
  let expiresAt: Date | null = null;
  if (duration) {
    const hours = duration === '24h' ? 24 : duration === '7d' ? 168 : 720;
    expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  // Create mute record
  await prisma.userMute.create({
    data: {
      userId,
      mutedBy: adminId,
      reason,
      details,
      expiresAt,
    },
  });

  // Send system message
  const { createSystemMessage } = await import('./messages.js');
  const content = `**Wyciszenie**\n\nTwoje konto zostało wyciszone ${duration ? `na ${duration}` : 'na stałe'}.\n\nPowód: ${reason}${details ? `\n\nSzczegóły: ${details}` : ''}\n\nW czasie wyciszenia nie możesz wysyłać wiadomości.`;

  await createSystemMessage(userId, 'Wyciszenie konta', content);

  // Send WebSocket notification
  broadcastToUser(userId, {
    type: 'moderation:muted',
    data: {
      reason,
      expiresAt: expiresAt?.toISOString() ?? null,
    },
  });
}

/**
 * Unmute a user
 */
export async function unmuteUser(userId: string, _adminId: string): Promise<void> {
  // Delete all active mutes
  await prisma.userMute.deleteMany({
    where: {
      userId,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
  });

  // Send system message
  const { createSystemMessage } = await import('./messages.js');
  await createSystemMessage(userId, 'Wyciszenie zakończone', 'Twoje wyciszenie zostało zdjęte. Możesz ponownie wysyłać wiadomości.');

  // Send WebSocket notification
  broadcastToUser(userId, {
    type: 'moderation:unmuted',
    data: {},
  });
}

/**
 * Get user's sanction history
 */
export async function getUserSanctions(userId: string): Promise<{
  mutes: UserMute[];
  currentMute: UserMute | null;
}> {
  const mutes = await prisma.userMute.findMany({
    where: { userId },
    include: {
      moderator: { select: { username: true, displayName: true } },
      user: { select: { username: true, displayName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const now = new Date();
  const currentMute = mutes.find(m => !m.expiresAt || m.expiresAt > now) ?? null;

  return {
    mutes: mutes.map(m => ({
      id: m.id,
      userId: m.userId,
      username: m.user.username,
      displayName: m.user.displayName,
      mutedBy: m.moderator.username,
      reason: m.reason as MuteReason,
      details: m.details,
      expiresAt: m.expiresAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
    })),
    currentMute: currentMute ? {
      id: currentMute.id,
      userId: currentMute.userId,
      username: currentMute.user.username,
      displayName: currentMute.user.displayName,
      mutedBy: currentMute.moderator.username,
      reason: currentMute.reason as MuteReason,
      details: currentMute.details,
      expiresAt: currentMute.expiresAt?.toISOString() ?? null,
      createdAt: currentMute.createdAt.toISOString(),
    } : null,
  };
}

/**
 * Check if user is currently muted
 */
export async function isUserMuted(userId: string): Promise<boolean> {
  const mute = await prisma.userMute.findFirst({
    where: {
      userId,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
  });

  return mute !== null;
}
