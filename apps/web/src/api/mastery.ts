/**
 * Mastery System API Client
 */

import type {
  GetMasteryProgressResponse,
  UnlockMasteryNodeRequest,
  UnlockMasteryNodeResponse,
  RespecMasteryTreeRequest,
  RespecMasteryTreeResponse,
  GetMasteryTreesResponse,
  GetClassProgressSummariesResponse,
} from '@arcade/protocol';
import type { FortressClass, MasteryTreeDefinition } from '@arcade/sim-core';
import { request } from './base.js';

// ============================================================================
// MASTERY PROGRESS API
// ============================================================================

/**
 * Get player's mastery progress
 */
export async function getMasteryProgress(): Promise<GetMasteryProgressResponse> {
  return request<GetMasteryProgressResponse>('/v1/mastery');
}

/**
 * Unlock a mastery node
 */
export async function unlockMasteryNode(
  nodeId: string
): Promise<UnlockMasteryNodeResponse> {
  const body: UnlockMasteryNodeRequest = { nodeId };
  return request<UnlockMasteryNodeResponse>('/v1/mastery/unlock', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Respec (reset) a class mastery tree
 * Note: This has a penalty - player loses some points
 */
export async function respecMasteryTree(
  classId: FortressClass
): Promise<RespecMasteryTreeResponse> {
  const body: RespecMasteryTreeRequest = { class: classId };
  return request<RespecMasteryTreeResponse>('/v1/mastery/respec', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Get all mastery tree definitions
 * This is static data and can be cached
 */
export async function getMasteryTrees(): Promise<GetMasteryTreesResponse> {
  return request<GetMasteryTreesResponse>('/v1/mastery/trees');
}

/**
 * Get class progress summaries for UI display
 */
export async function getClassProgressSummaries(): Promise<GetClassProgressSummariesResponse> {
  return request<GetClassProgressSummariesResponse>('/v1/mastery/summaries');
}

// ============================================================================
// MASTERY ACTIONS (combining API calls with state updates)
// ============================================================================

import {
  setMasteryLoading,
  setMasteryError,
  updateMasteryProgress,
  updateMasteryTrees,
  updateMasterySummaries,
} from '../state/mastery.signals.js';

/**
 * Load mastery progress and trees
 */
export async function loadMasteryData(): Promise<void> {
  setMasteryLoading(true);

  try {
    // Load progress and trees in parallel
    const [progressResponse, treesResponse] = await Promise.all([
      getMasteryProgress(),
      getMasteryTrees(),
    ]);

    updateMasteryProgress(progressResponse.progress);
    // Cast to full Record since the API always returns all trees
    updateMasteryTrees(treesResponse.trees as Record<FortressClass, MasteryTreeDefinition>);

    // Also load summaries
    const summariesResponse = await getClassProgressSummaries();
    updateMasterySummaries(summariesResponse.summaries);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Błąd ładowania danych mastery';
    setMasteryError(message);
    throw error;
  }
}

/**
 * Unlock a node and update state
 */
export async function unlockNodeAndRefresh(nodeId: string): Promise<UnlockMasteryNodeResponse> {
  setMasteryLoading(true);

  try {
    const response = await unlockMasteryNode(nodeId);

    if (response.success) {
      updateMasteryProgress(response.progress);

      // Refresh summaries
      const summariesResponse = await getClassProgressSummaries();
      updateMasterySummaries(summariesResponse.summaries);
    } else {
      setMasteryError(response.message ?? 'Nie można odblokować węzła');
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Błąd odblokowania węzła';
    setMasteryError(message);
    throw error;
  }
}

/**
 * Respec a class and update state
 */
export async function respecClassAndRefresh(
  classId: FortressClass
): Promise<RespecMasteryTreeResponse> {
  setMasteryLoading(true);

  try {
    const response = await respecMasteryTree(classId);

    if (response.success) {
      updateMasteryProgress(response.progress);

      // Refresh summaries
      const summariesResponse = await getClassProgressSummaries();
      updateMasterySummaries(summariesResponse.summaries);
    } else {
      setMasteryError(response.message ?? 'Nie można zresetować drzewka');
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Błąd resetowania drzewka';
    setMasteryError(message);
    throw error;
  }
}
