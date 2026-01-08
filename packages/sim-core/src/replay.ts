import type { GameEvent, Checkpoint } from '@arcade/protocol';
import { Simulation, getDefaultConfig } from './simulation.js';
import { SimConfig } from './types.js';

/**
 * Result of replay verification
 */
export interface ReplayResult {
  success: boolean;
  reason?: string;
  finalHash: number;
  checkpoints: Checkpoint[];
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
 * Verification options
 */
export interface VerifyOptions {
  seed: number;
  events: GameEvent[];
  expectedCheckpoints: Checkpoint[];
  expectedFinalHash: number;
  auditTicks: number[];
  config?: Partial<SimConfig>;
}

/**
 * Replay a run and verify checkpoints
 */
export function replayRun(options: VerifyOptions): ReplayResult {
  const {
    seed,
    events,
    expectedCheckpoints,
    expectedFinalHash,
    auditTicks,
    config: configOverrides,
  } = options;

  // Create simulation with config
  const baseConfig = getDefaultConfig();
  const config: SimConfig = { ...baseConfig, ...configOverrides };
  const sim = new Simulation(seed, config);

  // Set events to apply
  sim.setEvents(events);

  // Set checkpoint ticks (every 300 ticks + wave ends + audit ticks)
  const checkpointTicks: number[] = [];
  const maxTicks = 100 * 15 * config.tickHz; // Estimate max ticks for replay (100 waves worth)

  // Every 300 ticks
  for (let t = 300; t < maxTicks; t += 300) {
    checkpointTicks.push(t);
  }

  // Audit ticks
  sim.setCheckpointTicks(checkpointTicks);
  sim.setAuditTicks(auditTicks);

  // Validate event ticks are monotonic
  let lastTick = -1;
  for (const event of events) {
    if (event.tick < lastTick) {
      return {
        success: false,
        reason: 'TICKS_NOT_MONOTONIC',
        finalHash: 0,
        checkpoints: [],
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

  // Run simulation until ended or max ticks
  while (!sim.state.ended && sim.state.tick < maxTicks) {
    sim.step();
  }

  // Get generated checkpoints
  const generatedCheckpoints = sim.getCheckpoints();

  // Verify audit tick checkpoints are present in expected
  for (const auditTick of auditTicks) {
    const expected = expectedCheckpoints.find(c => c.tick === auditTick);
    if (!expected) {
      return {
        success: false,
        reason: 'AUDIT_TICK_MISSING',
        finalHash: sim.getFinalHash(),
        checkpoints: generatedCheckpoints,
        score: sim.calculateScore(),
        summary: buildSummary(sim),
      };
    }
  }

  // Verify checkpoint chain
  for (const expected of expectedCheckpoints) {
    // Find matching generated checkpoint
    const generated = generatedCheckpoints.find(c => c.tick === expected.tick);

    if (!generated) {
      // Missing checkpoint - not necessarily an error if it's not at a required tick
      continue;
    }

    if (generated.hash32 !== expected.hash32) {
      return {
        success: false,
        reason: 'CHECKPOINT_MISMATCH',
        finalHash: sim.getFinalHash(),
        checkpoints: generatedCheckpoints,
        score: sim.calculateScore(),
        summary: buildSummary(sim),
      };
    }

    if (generated.chainHash32 !== expected.chainHash32) {
      return {
        success: false,
        reason: 'CHECKPOINT_MISMATCH',
        finalHash: sim.getFinalHash(),
        checkpoints: generatedCheckpoints,
        score: sim.calculateScore(),
        summary: buildSummary(sim),
      };
    }

  }

  // Verify final hash
  const finalHash = sim.getFinalHash();
  if (finalHash !== expectedFinalHash) {
    return {
      success: false,
      reason: 'FINAL_HASH_MISMATCH',
      finalHash,
      checkpoints: generatedCheckpoints,
      score: sim.calculateScore(),
      summary: buildSummary(sim),
    };
  }

  return {
    success: true,
    finalHash,
    checkpoints: generatedCheckpoints,
    score: sim.calculateScore(),
    summary: buildSummary(sim),
  };
}

/**
 * Build summary from simulation state
 */
function buildSummary(sim: Simulation): ReplayResult['summary'] {
  return {
    wavesCleared: sim.state.wavesCleared,
    kills: sim.state.kills,
    eliteKills: sim.state.eliteKills,
    goldEarned: sim.state.goldEarned,
    dustEarned: sim.state.dustEarned,
    timeSurvived: sim.state.tick,
    relicsCollected: sim.state.relics.map(r => r.id),
    won: sim.state.won,
  };
}

/**
 * Run a simulation without verification (for client-side)
 * Returns simulation instance for manual control
 */
export function createClientSimulation(
  seed: number,
  config?: Partial<SimConfig>
): Simulation {
  const baseConfig = getDefaultConfig();
  const fullConfig: SimConfig = { ...baseConfig, ...config };
  return new Simulation(seed, fullConfig);
}
