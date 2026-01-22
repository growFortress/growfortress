import { z } from "zod";

// ============================================================================
// ENUMS
// ============================================================================

export const ChatScopeSchema = z.enum(["GLOBAL", "GUILD"]);
export type ChatScope = z.infer<typeof ChatScopeSchema>;

// ============================================================================
// MESSAGE
// ============================================================================

export const ChatMessageSchema = z.object({
  id: z.string(),
  scope: ChatScopeSchema,
  guildId: z.string().nullable(),
  senderId: z.string(),
  senderName: z.string(),
  content: z.string(),
  createdAt: z.string().datetime(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// ============================================================================
// REQUESTS
// ============================================================================

export const ChatHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().datetime().optional(),
});
export type ChatHistoryQuery = z.infer<typeof ChatHistoryQuerySchema>;

export const ChatSendRequestSchema = z.object({
  content: z.string().min(1).max(500),
});
export type ChatSendRequest = z.infer<typeof ChatSendRequestSchema>;

// ============================================================================
// RESPONSES
// ============================================================================

export const ChatHistoryResponseSchema = z.object({
  messages: z.array(ChatMessageSchema),
});
export type ChatHistoryResponse = z.infer<typeof ChatHistoryResponseSchema>;

export const ChatSendResponseSchema = z.object({
  message: ChatMessageSchema,
});
export type ChatSendResponse = z.infer<typeof ChatSendResponseSchema>;
