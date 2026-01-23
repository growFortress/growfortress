/**
 * Hub Preview API
 * Fetches public hub data for viewing other players' configurations
 */

import { HubPreviewResponseSchema, type HubPreviewResponse } from '@arcade/protocol';
import { request, ApiError } from './base.js';

/**
 * Fetch hub preview for a specific user
 * @param userId - The user ID to fetch hub preview for
 * @param signal - Optional AbortSignal for request cancellation
 * @returns Hub preview data or null if user not found
 */
export async function fetchHubPreview(
  userId: string,
  signal?: AbortSignal
): Promise<HubPreviewResponse | null> {
  try {
    const data = await request<unknown>(`/v1/hub/${encodeURIComponent(userId)}`, { signal });
    // Validate response with Zod schema to ensure data integrity
    return HubPreviewResponseSchema.parse(data);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
