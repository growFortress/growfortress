/**
 * Hub Preview API
 * Fetches public hub data for viewing other players' configurations
 */

import type { HubPreviewResponse } from '@arcade/protocol';
import { request, ApiError } from './base.js';

/**
 * Fetch hub preview for a specific user
 * @param userId - The user ID to fetch hub preview for
 * @returns Hub preview data or null if user not found
 */
export async function fetchHubPreview(userId: string): Promise<HubPreviewResponse | null> {
  try {
    return await request<HubPreviewResponse>(`/v1/hub/${encodeURIComponent(userId)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
