/**
 * Guild Preview API
 * Fetches public guild data for viewing other guilds' information
 */

import type { GuildPreviewResponse } from '@arcade/protocol';
import { request, ApiError } from './base.js';

/**
 * Fetch guild preview for a specific guild
 * @param guildId - The guild ID to fetch preview for
 * @param signal - Optional AbortSignal for cancelling the request
 * @returns Guild preview data or null if guild not found
 */
export async function fetchGuildPreview(
  guildId: string,
  signal?: AbortSignal
): Promise<GuildPreviewResponse | null> {
  try {
    return await request<GuildPreviewResponse>(
      `/v1/guilds/${encodeURIComponent(guildId)}/preview`,
      { signal }
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
