import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const MessageTypeSchema = z.enum([
  'PRIVATE',
  'GROUP',
  'SYSTEM',
  'GUILD_INVITE',
  'GUILD_KICK',
]);
export type MessageType = z.infer<typeof MessageTypeSchema>;

export const ReportReasonSchema = z.enum([
  'SPAM',
  'SCAM',
  'OFFENSIVE',
  'HARASSMENT',
  'OTHER',
]);
export type ReportReason = z.infer<typeof ReportReasonSchema>;

export const ReportStatusSchema = z.enum([
  'PENDING',
  'REVIEWED',
  'DISMISSED',
  'ACTIONED',
]);
export type ReportStatus = z.infer<typeof ReportStatusSchema>;

export const MuteReasonSchema = z.enum([
  'SPAM',
  'OFFENSIVE',
  'SCAM',
  'HARASSMENT',
  'OTHER',
]);
export type MuteReason = z.infer<typeof MuteReasonSchema>;

// ============================================================================
// PARTICIPANT
// ============================================================================

export const ParticipantSchema = z.object({
  userId: z.string().nullable(), // null for system messages
  displayName: z.string(),
});
export type Participant = z.infer<typeof ParticipantSchema>;

// ============================================================================
// MESSAGE
// ============================================================================

export const MessageSchema = z.object({
  id: z.string(),
  senderId: z.string().nullable(),
  senderName: z.string(), // "System" for null senderId
  content: z.string(),
  createdAt: z.string().datetime(),
});
export type Message = z.infer<typeof MessageSchema>;

// ============================================================================
// THREAD SUMMARY (for list view)
// ============================================================================

export const ThreadSummarySchema = z.object({
  id: z.string(),
  subject: z.string(),
  type: MessageTypeSchema,
  lastMessageAt: z.string().datetime(),
  lastMessagePreview: z.string().max(100),
  participants: z.array(ParticipantSchema),
  unreadCount: z.number().int().min(0),
  // For guild invites
  linkedInvitationId: z.string().nullable(),
  linkedInvitationStatus: z.string().nullable(),
  // For group chats
  isGroup: z.boolean(),
  participantCount: z.number().int().min(1),
});
export type ThreadSummary = z.infer<typeof ThreadSummarySchema>;

// ============================================================================
// THREAD DETAIL (full thread with messages)
// ============================================================================

export const ThreadDetailSchema = z.object({
  id: z.string(),
  subject: z.string(),
  type: MessageTypeSchema,
  createdAt: z.string().datetime(),
  creatorId: z.string().nullable(),
  participants: z.array(ParticipantSchema),
  messages: z.array(MessageSchema),
  // For guild invites
  linkedInvitationId: z.string().nullable(),
  canAcceptInvitation: z.boolean(),
  canDeclineInvitation: z.boolean(),
  // For groups
  isGroup: z.boolean(),
  canAddParticipants: z.boolean(),
  canLeave: z.boolean(),
  maxParticipants: z.number().int(),
});
export type ThreadDetail = z.infer<typeof ThreadDetailSchema>;

// ============================================================================
// UNREAD COUNTS
// ============================================================================

export const UnreadCountsSchema = z.object({
  total: z.number().int().min(0),
  private: z.number().int().min(0),
  system: z.number().int().min(0),
  guild: z.number().int().min(0),
});
export type UnreadCounts = z.infer<typeof UnreadCountsSchema>;

// ============================================================================
// REQUESTS
// ============================================================================

export const ThreadsQuerySchema = z.object({
  type: z.enum(['all', 'private', 'system', 'guild']).default('all'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ThreadsQuery = z.infer<typeof ThreadsQuerySchema>;

export const ComposeThreadRequestSchema = z.object({
  recipientUsernames: z.array(z.string().min(1).max(50)).min(1).max(9), // 1-9 recipients (+ sender = 2-10)
  subject: z.string().min(1).max(100),
  content: z.string().min(1).max(2000),
});
export type ComposeThreadRequest = z.infer<typeof ComposeThreadRequestSchema>;

export const ReplyThreadRequestSchema = z.object({
  content: z.string().min(1).max(2000),
});
export type ReplyThreadRequest = z.infer<typeof ReplyThreadRequestSchema>;

export const AddParticipantRequestSchema = z.object({
  username: z.string().min(1).max(50),
});
export type AddParticipantRequest = z.infer<typeof AddParticipantRequestSchema>;

export const SearchUsersQuerySchema = z.object({
  q: z.string().min(2).max(50),
  limit: z.coerce.number().int().min(1).max(10).default(5),
});
export type SearchUsersQuery = z.infer<typeof SearchUsersQuerySchema>;

export const UserSearchResultSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
});
export type UserSearchResult = z.infer<typeof UserSearchResultSchema>;

// ============================================================================
// RESPONSES
// ============================================================================

export const ThreadsResponseSchema = z.object({
  threads: z.array(ThreadSummarySchema),
  total: z.number().int().min(0),
});
export type ThreadsResponse = z.infer<typeof ThreadsResponseSchema>;

export const SearchUsersResponseSchema = z.object({
  users: z.array(UserSearchResultSchema),
});
export type SearchUsersResponse = z.infer<typeof SearchUsersResponseSchema>;

// ============================================================================
// MODERATION - REPORTS
// ============================================================================

export const ReportRequestSchema = z.object({
  messageId: z.string().optional(),
  threadId: z.string().optional(),
  reason: ReportReasonSchema,
  details: z.string().max(500).optional(),
}).refine(
  (data) => data.messageId || data.threadId,
  { message: 'Either messageId or threadId must be provided' }
);
export type ReportRequest = z.infer<typeof ReportRequestSchema>;

export const MessageReportSchema = z.object({
  id: z.string(),
  threadId: z.string().nullable(),
  messageId: z.string().nullable(),
  reporterUsername: z.string(),
  reason: ReportReasonSchema,
  details: z.string().nullable(),
  status: ReportStatusSchema,
  reviewedBy: z.string().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  actionTaken: z.string().nullable(),
  createdAt: z.string().datetime(),
  // Context
  messageContent: z.string().nullable(),
  threadSubject: z.string().nullable(),
  senderUsername: z.string().nullable(),
});
export type MessageReport = z.infer<typeof MessageReportSchema>;

export const ReportsQuerySchema = z.object({
  status: ReportStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ReportsQuery = z.infer<typeof ReportsQuerySchema>;

export const ReportsResponseSchema = z.object({
  reports: z.array(MessageReportSchema),
  total: z.number().int().min(0),
});
export type ReportsResponse = z.infer<typeof ReportsResponseSchema>;

export const ReviewReportRequestSchema = z.object({
  action: z.enum(['dismiss', 'warn', 'mute_24h', 'mute_7d', 'mute_30d', 'mute_permanent']),
  notes: z.string().max(500).optional(),
});
export type ReviewReportRequest = z.infer<typeof ReviewReportRequestSchema>;

// ============================================================================
// MODERATION - BLOCKING
// ============================================================================

export const BlockedUserSchema = z.object({
  id: z.string(),
  userId: z.string(),
  username: z.string(),
  displayName: z.string(),
  blockedAt: z.string().datetime(),
});
export type BlockedUser = z.infer<typeof BlockedUserSchema>;

export const BlockedUsersResponseSchema = z.object({
  blockedUsers: z.array(BlockedUserSchema),
});
export type BlockedUsersResponse = z.infer<typeof BlockedUsersResponseSchema>;

// ============================================================================
// MODERATION - MUTES
// ============================================================================

export const MuteUserRequestSchema = z.object({
  reason: MuteReasonSchema,
  duration: z.enum(['24h', '7d', '30d', 'permanent']),
  details: z.string().max(500).optional(),
});
export type MuteUserRequest = z.infer<typeof MuteUserRequestSchema>;

export const UserMuteSchema = z.object({
  id: z.string(),
  userId: z.string(),
  username: z.string(),
  displayName: z.string(),
  mutedBy: z.string(),
  reason: MuteReasonSchema,
  details: z.string().nullable(),
  expiresAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type UserMute = z.infer<typeof UserMuteSchema>;

export const UserSanctionsResponseSchema = z.object({
  mutes: z.array(UserMuteSchema),
  warnings: z.array(z.object({
    id: z.string(),
    reason: z.string(),
    createdAt: z.string().datetime(),
    issuedBy: z.string(),
  })),
  currentMute: UserMuteSchema.nullable(),
});
export type UserSanctionsResponse = z.infer<typeof UserSanctionsResponseSchema>;

// ============================================================================
// ADMIN - BROADCAST
// ============================================================================

export const BroadcastRequestSchema = z.object({
  subject: z.string().min(1).max(100),
  content: z.string().min(1).max(5000),
  targetUsernames: z.array(z.string()).optional(), // empty = broadcast to all
});
export type BroadcastRequest = z.infer<typeof BroadcastRequestSchema>;

export const BroadcastHistoryItemSchema = z.object({
  id: z.string(),
  subject: z.string(),
  content: z.string(),
  sentBy: z.string(),
  targetCount: z.number().int(),
  createdAt: z.string().datetime(),
});
export type BroadcastHistoryItem = z.infer<typeof BroadcastHistoryItemSchema>;

export const BroadcastHistoryResponseSchema = z.object({
  broadcasts: z.array(BroadcastHistoryItemSchema),
  total: z.number().int().min(0),
});
export type BroadcastHistoryResponse = z.infer<typeof BroadcastHistoryResponseSchema>;
