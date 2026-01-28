/**
 * Tutorial API client
 *
 * Provides functions to interact with the tutorial system:
 * - Get tutorial completion status
 * - Mark tutorial as completed
 */

import { request } from './base.js';

/**
 * Response from tutorial status endpoint
 */
export interface TutorialStatusResponse {
  tutorialCompleted: boolean;
  tutorialCompletedAt: string | null;
}

/**
 * Response from tutorial complete endpoint
 */
export interface CompleteTutorialResponse {
  success: boolean;
  error?: string;
  tutorialCompletedAt?: string;
  achievementUnlocked?: boolean;
}

/**
 * Get tutorial completion status
 */
export async function getTutorialStatus(): Promise<TutorialStatusResponse> {
  return request<TutorialStatusResponse>('/v1/tutorial/status', {
    method: 'GET',
  });
}

/**
 * Mark tutorial as completed (called when all 17 steps are done)
 */
export async function completeTutorial(): Promise<CompleteTutorialResponse> {
  return request<CompleteTutorialResponse>('/v1/tutorial/complete', {
    method: 'POST',
  });
}
