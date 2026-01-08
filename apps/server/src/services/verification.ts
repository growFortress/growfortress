import type { GameEvent, Checkpoint, RunFinishRequest } from '@arcade/protocol';
import { RUN_REJECTION_REASONS } from '@arcade/protocol';
import { replayRun, getDefaultConfig, SIM_VERSION } from '@arcade/sim-core';
import { RunTokenPayload } from '../lib/tokens.js';
import { applySimConfigSnapshot } from './simConfig.js';

export interface VerificationResult {
  verified: boolean;
  reason?: string;
  score: number;
  summary: {
    wavesCleared: number;
    kills: number;
    eliteKills: number;
    goldEarned: number;
    dustEarned: number;
    timeSurvived: number;
    relicsCollected: string[];
    won: boolean;
  };
}

/**
 * Verify a run submission
 */
export function verifyRunSubmission(
  request: RunFinishRequest,
  tokenPayload: RunTokenPayload
): VerificationResult {
  const { events, checkpoints, finalHash } = request;

  if (tokenPayload.simVersion !== SIM_VERSION) {
    return {
      verified: false,
      reason: RUN_REJECTION_REASONS.SIM_VERSION_MISMATCH,
      score: 0,
      summary: {
        wavesCleared: 0,
        kills: 0,
        eliteKills: 0,
        goldEarned: 0,
        dustEarned: 0,
        timeSurvived: 0,
        relicsCollected: [],
        won: false,
      },
    };
  }

  // Validate event count
  if (events.length > 1000) {
    return {
      verified: false,
      reason: RUN_REJECTION_REASONS.PAYLOAD_TOO_LARGE,
      score: 0,
      summary: {
        wavesCleared: 0,
        kills: 0,
        eliteKills: 0,
        goldEarned: 0,
        dustEarned: 0,
        timeSurvived: 0,
        relicsCollected: [],
        won: false,
      },
    };
  }

  // Validate checkpoint count
  if (checkpoints.length > 500) {
    return {
      verified: false,
      reason: RUN_REJECTION_REASONS.PAYLOAD_TOO_LARGE,
      score: 0,
      summary: {
        wavesCleared: 0,
        kills: 0,
        eliteKills: 0,
        goldEarned: 0,
        dustEarned: 0,
        timeSurvived: 0,
        relicsCollected: [],
        won: false,
      },
    };
  }

  // Validate ticks are monotonic
  let lastTick = -1;
  for (const event of events) {
    if (event.tick < lastTick) {
      return {
        verified: false,
        reason: RUN_REJECTION_REASONS.TICKS_NOT_MONOTONIC,
        score: 0,
        summary: {
          wavesCleared: 0,
          kills: 0,
          eliteKills: 0,
          goldEarned: 0,
          dustEarned: 0,
          timeSurvived: 0,
          relicsCollected: [],
          won: false,
        },
      };
    }
    lastTick = event.tick;
  }

  // Verify audit ticks are present in checkpoints
  for (const auditTick of tokenPayload.auditTicks) {
    const found = checkpoints.some(c => c.tick === auditTick);
    if (!found) {
      return {
        verified: false,
        reason: RUN_REJECTION_REASONS.AUDIT_TICK_MISSING,
        score: 0,
        summary: {
          wavesCleared: 0,
          kills: 0,
          eliteKills: 0,
          goldEarned: 0,
          dustEarned: 0,
          timeSurvived: 0,
          relicsCollected: [],
          won: false,
        },
      };
    }
  }

  // Create config
  const config = getDefaultConfig();
  applySimConfigSnapshot(config, tokenPayload.simConfig);
  config.tickHz = tokenPayload.tickHz;

  // Run replay verification
  const result = replayRun({
    seed: tokenPayload.seed,
    events: events as GameEvent[],
    expectedCheckpoints: checkpoints as Checkpoint[],
    expectedFinalHash: finalHash,
    auditTicks: tokenPayload.auditTicks,
    config,
  });

  if (!result.success) {
    return {
      verified: false,
      reason: result.reason || 'UNKNOWN',
      score: result.score,
      summary: result.summary,
    };
  }

  // Verify score matches
  if (result.score !== request.score) {
    // Allow some tolerance for score differences
    const scoreDiff = Math.abs(result.score - request.score);
    if (scoreDiff > 100) {
      return {
        verified: false,
        reason: 'SCORE_MISMATCH',
        score: result.score,
        summary: result.summary,
      };
    }
  }

  return {
    verified: true,
    score: result.score,
    summary: result.summary,
  };
}
