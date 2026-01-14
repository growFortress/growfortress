/**
 * Guild Preview API
 * Fetches public guild data for viewing other guilds' information
 */

import type { GuildPreviewResponse } from '@arcade/protocol';
import { request, ApiError } from './base.js';

/**
 * Fetch guild preview for a specific guild
 * @param guildId - The guild ID to fetch preview for
 * @returns Guild preview data or null if guild not found
 */
export async function fetchGuildPreview(guildId: string): Promise<GuildPreviewResponse | null> {
  try {
    return await request<GuildPreviewResponse>(`/v1/guilds/${encodeURIComponent(guildId)}/preview`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
