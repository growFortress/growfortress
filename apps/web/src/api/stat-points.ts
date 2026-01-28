/**
 * Stat Points API Client
 *
 * API client for the free stat points system.
 * Handles fetching, allocating, and resetting stat point allocations.
 */

import { request } from './base.js';
import type {
  StatPointsSummaryResponse,
  AllocateStatPointsRequest,
  AllocateStatPointsResponse,
  ResetStatPointsRequest,
  ResetStatPointsResponse,
} from '@arcade/protocol';
import {
  updateStatPointsFromServer,
  optimisticAllocateFortress,
  optimisticAllocateHero,
} from '../state/stat-points.signals.js';

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Fetch stat points summary from server
 */
export async function getStatPointsSummary(): Promise<StatPointsSummaryResponse> {
  const response = await request<StatPointsSummaryResponse>('/v1/stat-points', {
    method: 'GET',
  });

  // Update state
  updateStatPointsFromServer(response);

  return response;
}

/**
 * Allocate stat points to fortress or hero
 */
export async function allocateStatPoints(
  requestData: AllocateStatPointsRequest
): Promise<AllocateStatPointsResponse> {
  const { targetType, heroId, stat, pointsToAllocate } = requestData;

  // Optimistic update
  if (targetType === 'fortress') {
    optimisticAllocateFortress(stat, pointsToAllocate);
  } else if (targetType === 'hero' && heroId) {
    optimisticAllocateHero(heroId, stat, pointsToAllocate);
  }

  try {
    const response = await request<AllocateStatPointsResponse>('/v1/stat-points/allocate', {
      method: 'POST',
      body: JSON.stringify(requestData),
    });

    // Sync with server - refetch full state to ensure consistency
    await getStatPointsSummary();

    return response;
  } catch (error) {
    // Rollback optimistic update by refetching
    await getStatPointsSummary();
    throw error;
  }
}

/**
 * Allocate points to fortress stat (convenience wrapper)
 */
export async function allocateFortressStatPoints(
  stat: string,
  pointsToAllocate: number
): Promise<AllocateStatPointsResponse> {
  return allocateStatPoints({
    targetType: 'fortress',
    stat,
    pointsToAllocate,
  });
}

/**
 * Allocate points to hero stat (convenience wrapper)
 */
export async function allocateHeroStatPoints(
  heroId: string,
  stat: string,
  pointsToAllocate: number
): Promise<AllocateStatPointsResponse> {
  return allocateStatPoints({
    targetType: 'hero',
    heroId,
    stat,
    pointsToAllocate,
  });
}

/**
 * Reset stat point allocations (refund points)
 */
export async function resetStatPointAllocations(
  targetType: 'fortress' | 'hero',
  heroId?: string
): Promise<ResetStatPointsResponse> {
  const requestData: ResetStatPointsRequest = { targetType, heroId };

  const response = await request<ResetStatPointsResponse>('/v1/stat-points/reset', {
    method: 'POST',
    body: JSON.stringify(requestData),
  });

  // Sync with server
  await getStatPointsSummary();

  return response;
}

/**
 * Reset fortress allocations (convenience wrapper)
 */
export async function resetFortressAllocations(): Promise<ResetStatPointsResponse> {
  return resetStatPointAllocations('fortress');
}

/**
 * Reset hero allocations (convenience wrapper)
 */
export async function resetHeroAllocations(
  heroId?: string
): Promise<ResetStatPointsResponse> {
  return resetStatPointAllocations('hero', heroId);
}
