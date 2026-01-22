import { z } from "zod";
import {
  UnreadCountsSchema,
  ThreadSummarySchema,
  MessageSchema,
} from "./messages.js";
import { ChatMessageSchema } from "./chat.js";
import { GuildInvitationStatusSchema, GuildChatMessageSchema } from "./guild.js";

// ============================================================================
// SERVER -> CLIENT EVENTS
// ============================================================================

/**
 * New message received in a thread
 */
export const MessageNewEventSchema = z.object({
  type: z.literal("message:new"),
  data: z.object({
    threadId: z.string(),
    message: MessageSchema,
    threadSubject: z.string(),
    senderName: z.string(),
  }),
});
export type MessageNewEvent = z.infer<typeof MessageNewEventSchema>;

/**
 * Thread marked as read (by another device)
 */
export const MessageReadEventSchema = z.object({
  type: z.literal("message:read"),
  data: z.object({
    threadId: z.string(),
  }),
});
export type MessageReadEvent = z.infer<typeof MessageReadEventSchema>;

/**
 * New thread created (e.g., someone started a conversation with you)
 */
export const ThreadNewEventSchema = z.object({
  type: z.literal("thread:new"),
  data: z.object({
    thread: ThreadSummarySchema,
  }),
});
export type ThreadNewEvent = z.infer<typeof ThreadNewEventSchema>;

/**
 * Participant added to a group thread
 */
export const ThreadParticipantAddedEventSchema = z.object({
  type: z.literal("thread:participant_added"),
  data: z.object({
    threadId: z.string(),
    userId: z.string(),
    displayName: z.string(),
    addedBy: z.string(),
  }),
});
export type ThreadParticipantAddedEvent = z.infer<
  typeof ThreadParticipantAddedEventSchema
>;

/**
 * Participant left a group thread
 */
export const ThreadParticipantLeftEventSchema = z.object({
  type: z.literal("thread:participant_left"),
  data: z.object({
    threadId: z.string(),
    userId: z.string(),
    displayName: z.string(),
  }),
});
export type ThreadParticipantLeftEvent = z.infer<
  typeof ThreadParticipantLeftEventSchema
>;

/**
 * Global chat message received
 */
export const ChatGlobalMessageEventSchema = z.object({
  type: z.literal("chat:global"),
  data: z.object({
    message: ChatMessageSchema,
  }),
});
export type ChatGlobalMessageEvent = z.infer<
  typeof ChatGlobalMessageEventSchema
>;

/**
 * Guild chat message received
 */
export const ChatGuildMessageEventSchema = z.object({
  type: z.literal("chat:guild"),
  data: z.object({
    message: ChatMessageSchema,
  }),
});
export type ChatGuildMessageEvent = z.infer<typeof ChatGuildMessageEventSchema>;

/**
 * Guild chat message (new event for guild chat system)
 */
export const GuildChatMessageEventSchema = z.object({
  type: z.literal("guild:chat:message"),
  data: z.object({
    guildId: z.string(),
    message: GuildChatMessageSchema,
  }),
});
export type GuildChatMessageEvent = z.infer<typeof GuildChatMessageEventSchema>;

/**
 * Guild invitation received
 */
export const GuildInvitationEventSchema = z.object({
  type: z.literal("guild:invitation"),
  data: z.object({
    invitationId: z.string(),
    guildId: z.string(),
    guildName: z.string(),
    guildTag: z.string(),
    inviterName: z.string(),
    message: z.string().nullable(),
    threadId: z.string(), // Link to message thread
  }),
});
export type GuildInvitationEvent = z.infer<typeof GuildInvitationEventSchema>;

/**
 * Guild invitation status changed (accepted/declined by you on another device)
 */
export const GuildInvitationStatusEventSchema = z.object({
  type: z.literal("guild:invitation_status"),
  data: z.object({
    invitationId: z.string(),
    status: GuildInvitationStatusSchema,
  }),
});
export type GuildInvitationStatusEvent = z.infer<
  typeof GuildInvitationStatusEventSchema
>;

/**
 * Kicked from guild
 */
export const GuildKickedEventSchema = z.object({
  type: z.literal("guild:kicked"),
  data: z.object({
    guildId: z.string(),
    guildName: z.string(),
    kickedBy: z.string(),
    threadId: z.string(), // Link to message thread
  }),
});
export type GuildKickedEvent = z.infer<typeof GuildKickedEventSchema>;

/**
 * Unread counts updated
 */
export const UnreadUpdateEventSchema = z.object({
  type: z.literal("unread:update"),
  data: UnreadCountsSchema,
});
export type UnreadUpdateEvent = z.infer<typeof UnreadUpdateEventSchema>;

/**
 * User was muted (cannot send messages)
 */
export const MutedEventSchema = z.object({
  type: z.literal("moderation:muted"),
  data: z.object({
    reason: z.string(),
    expiresAt: z.string().datetime().nullable(), // null = permanent
  }),
});
export type MutedEvent = z.infer<typeof MutedEventSchema>;

/**
 * User was unmuted (can send messages again)
 */
export const UnmutedEventSchema = z.object({
  type: z.literal("moderation:unmuted"),
  data: z.object({}),
});
export type UnmutedEvent = z.infer<typeof UnmutedEventSchema>;

/**
 * User received a warning
 */
export const WarningEventSchema = z.object({
  type: z.literal("moderation:warning"),
  data: z.object({
    reason: z.string(),
    threadId: z.string(), // Warning is also sent as a system message
  }),
});
export type WarningEvent = z.infer<typeof WarningEventSchema>;

/**
 * Pong response to client ping
 */
export const PongEventSchema = z.object({
  type: z.literal("pong"),
  data: z.object({
    timestamp: z.number(),
  }),
});
export type PongEvent = z.infer<typeof PongEventSchema>;

/**
 * Error event
 */
export const ErrorEventSchema = z.object({
  type: z.literal("error"),
  data: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
export type ErrorEvent = z.infer<typeof ErrorEventSchema>;

/**
 * Connection established successfully
 */
export const ConnectedEventSchema = z.object({
  type: z.literal("connected"),
  data: z.object({
    userId: z.string(),
    unreadCounts: UnreadCountsSchema,
  }),
});
export type ConnectedEvent = z.infer<typeof ConnectedEventSchema>;

// Union of all server events
export const ServerEventSchema = z.discriminatedUnion("type", [
  MessageNewEventSchema,
  MessageReadEventSchema,
  ThreadNewEventSchema,
  ThreadParticipantAddedEventSchema,
  ThreadParticipantLeftEventSchema,
  ChatGlobalMessageEventSchema,
  ChatGuildMessageEventSchema,
  GuildChatMessageEventSchema,
  GuildInvitationEventSchema,
  GuildInvitationStatusEventSchema,
  GuildKickedEventSchema,
  UnreadUpdateEventSchema,
  MutedEventSchema,
  UnmutedEventSchema,
  WarningEventSchema,
  PongEventSchema,
  ErrorEventSchema,
  ConnectedEventSchema,
]);
export type ServerEvent = z.infer<typeof ServerEventSchema>;

// ============================================================================
// CLIENT -> SERVER EVENTS
// ============================================================================

/**
 * Ping to keep connection alive
 */
export const PingEventSchema = z.object({
  type: z.literal("ping"),
});
export type PingEvent = z.infer<typeof PingEventSchema>;

/**
 * Subscribe to specific channels (for future use)
 */
export const SubscribeEventSchema = z.object({
  type: z.literal("subscribe"),
  channels: z.array(z.string()),
});
export type SubscribeEvent = z.infer<typeof SubscribeEventSchema>;

/**
 * Unsubscribe from channels
 */
export const UnsubscribeEventSchema = z.object({
  type: z.literal("unsubscribe"),
  channels: z.array(z.string()),
});
export type UnsubscribeEvent = z.infer<typeof UnsubscribeEventSchema>;

// Union of all client events
export const ClientEventSchema = z.discriminatedUnion("type", [
  PingEventSchema,
  SubscribeEventSchema,
  UnsubscribeEventSchema,
]);
export type ClientEvent = z.infer<typeof ClientEventSchema>;

// ============================================================================
// WEBSOCKET CONNECTION
// ============================================================================

/**
 * Query parameters for WebSocket connection
 */
export const WebSocketConnectQuerySchema = z.object({
  token: z.string().min(1), // JWT access token
});
export type WebSocketConnectQuery = z.infer<typeof WebSocketConnectQuerySchema>;
