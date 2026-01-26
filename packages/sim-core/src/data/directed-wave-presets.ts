/**
 * Directed Wave 1 Presets
 *
 * Pre-designed wave compositions and relic pools for the tutorial/showcase experience.
 * These create a curated first impression for new players.
 */

import type { DirectedWave1Config, DirectedWave1EnemyEntry, ScriptedEvent } from '../types.js';
import type { Xorshift32 } from '../rng.js';

// ============================================================================
// TUTORIAL RELIC POOL
// ============================================================================

/**
 * Relics that are safe and easy to understand for new players.
 * These avoid complex mechanics and provide clear, immediate benefits.
 */
export const TUTORIAL_RELIC_POOL = [
  'iron_hide',        // +15% HP - simple defensive boost
  'sharpened_blades', // +10% DMG - straightforward damage increase
  'swift_strikes',    // +10% attack speed - easy to feel the difference
  'critical_eye',     // +5% crit chance - introduces crit concept gently
  'gold_rush',        // +15% gold - economy boost, always useful
] as const;

/**
 * Get tutorial-friendly relic options for the early choice
 * @param rng - RNG instance for deterministic selection
 * @param count - Number of options to return (default: 3)
 */
export function getTutorialRelicOptions(rng: Xorshift32, count: number = 3): string[] {
  const pool = [...TUTORIAL_RELIC_POOL];
  const selected: string[] = [];

  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = rng.nextInt(0, pool.length - 1);
    selected.push(pool[idx]);
    pool.splice(idx, 1);
  }

  return selected;
}

// ============================================================================
// DIRECTED WAVE 1 ENEMY SEQUENCE
// ============================================================================

/**
 * The scripted enemy sequence for wave 1.
 * Designed for ~45-60 second wave duration with dramatic pacing.
 *
 * Structure:
 * - Phase 1 (0-5s): Easy start with runners - lets player get comfortable
 * - Phase 2 (5-15s): Introduce thugs - slightly tankier enemies
 * - Phase 3 (15-30s): Mix + first elite - "wow moment" with elite spawn
 * - Phase 4 (30-45s): Final push - ramp up then finish strong
 */
export const DIRECTED_WAVE_1_ENEMIES: DirectedWave1EnemyEntry[] = [
  // Phase 1: Easy start (0-5s) - let player orient
  { type: 'runner', isElite: false, delayTicks: 90 },   // 3s after wave starts
  { type: 'runner', isElite: false, delayTicks: 20 },   // Quick succession
  { type: 'runner', isElite: false, delayTicks: 20 },

  // Phase 2: Introduce thugs (5-15s) - slightly tankier
  { type: 'thug', isElite: false, delayTicks: 45 },     // Brief pause before thugs
  { type: 'thug', isElite: false, delayTicks: 20 },
  { type: 'runner', isElite: false, delayTicks: 15 },   // Mix in runners
  { type: 'runner', isElite: false, delayTicks: 15 },

  // Phase 3: Mix + first elite (15-30s) - "wow moment"
  { type: 'gangster', isElite: false, delayTicks: 30 }, // Introduce gangster
  { type: 'thug', isElite: true, delayTicks: 25 },      // ELITE - dramatic moment
  { type: 'runner', isElite: false, delayTicks: 15 },
  { type: 'runner', isElite: false, delayTicks: 15 },

  // Phase 4: Final push (30-45s) - build to finish
  { type: 'gangster', isElite: false, delayTicks: 20 },
  { type: 'thug', isElite: false, delayTicks: 15 },
  { type: 'runner', isElite: false, delayTicks: 10 },   // Speed up at end
  { type: 'runner', isElite: false, delayTicks: 10 },   // Last enemy
];

// ============================================================================
// SCRIPTED EVENTS
// ============================================================================

/**
 * Scripted events that trigger during wave 1 for dramatic effect.
 * These create "wow moments" that showcase the game's juice.
 */
export const DIRECTED_WAVE_1_EVENTS: ScriptedEvent[] = [
  // First kill celebration
  {
    id: 'first_kill_celebration',
    triggerType: 'kill_count',
    triggerValue: 1,
    event: 'vfx_burst',
    data: {
      intensity: 2.0,
      confetti: true,
    },
  },

  // Synergy highlight at 5 kills
  {
    id: 'synergy_highlight_5_kills',
    triggerType: 'kill_count',
    triggerValue: 5,
    event: 'synergy_highlight',
    data: {
      duration: 2000,
      pulseHUD: true,
    },
  },

  // Slow motion for elite spawn (around tick 450 = ~15s)
  {
    id: 'elite_spawn_slowmo',
    triggerType: 'tick',
    triggerValue: 450,
    event: 'slow_motion',
    data: {
      duration: 45,  // ~1.5s of slow-mo
      factor: 0.3,   // 30% speed
    },
  },

  // Dramatic finish for last enemy
  {
    id: 'last_enemy_dramatic',
    triggerType: 'enemies_remaining',
    triggerValue: 1,
    event: 'vfx_burst',
    data: {
      intensity: 3.0,
      screenShake: true,
    },
  },
];

// ============================================================================
// WAVE 2 ADJUSTMENT
// ============================================================================

/**
 * Adjustments for wave 2 to ensure smooth transition from directed wave 1.
 * Slightly reduces difficulty so the "drop" to normal gameplay isn't jarring.
 */
export const DIRECTED_WAVE_2_ADJUSTMENT = {
  enemyCountMultiplier: 0.9,    // 10% fewer enemies
  eliteChanceMultiplier: 0.8,   // 20% lower elite chance
};

// ============================================================================
// DEFAULT DIRECTED WAVE 1 CONFIG
// ============================================================================

/**
 * The default DirectedWave1Config used for new players.
 * This is the complete configuration for the tutorial/showcase experience.
 */
export const DEFAULT_DIRECTED_WAVE_1_CONFIG: DirectedWave1Config = {
  enabled: true,
  enemies: DIRECTED_WAVE_1_ENEMIES,
  offerRelicAtStart: true,
  forcedRelicOptions: undefined, // Will use getTutorialRelicOptions() at runtime
  scriptedEvents: DIRECTED_WAVE_1_EVENTS,
  wave2Adjustment: DIRECTED_WAVE_2_ADJUSTMENT,
};

/**
 * Get the DirectedWave1Config with tutorial relics populated
 * @param rng - RNG instance for deterministic relic selection
 */
export function getDirectedWave1ConfigWithRelics(rng: Xorshift32): DirectedWave1Config {
  return {
    ...DEFAULT_DIRECTED_WAVE_1_CONFIG,
    forcedRelicOptions: getTutorialRelicOptions(rng, 3),
  };
}
