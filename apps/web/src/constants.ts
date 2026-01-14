/**
 * Game constants - extracted magic numbers for maintainability.
 * XP values synced with sim-core/data/fortress-progression.ts
 */

// Score calculation
export const WAVE_SCORE_MULTIPLIER = 1000;
export const KILL_SCORE_MULTIPLIER = 10;

// XP calculation (synced with sim-core XP_SOURCES)
// These are base values - actual XP scales with wave number
export const WAVE_XP_BASE = 7;           // XP_SOURCES.wave_complete.baseXp
export const WAVE_XP_PER_WAVE = 1.5;     // XP_SOURCES.wave_complete.scaling.perWave
export const KILL_XP_BASE = 0.75;        // XP_SOURCES.enemy_kill.baseXp
export const KILL_XP_PER_WAVE = 0.075;   // XP_SOURCES.enemy_kill.scaling.perWave
export const ELITE_KILL_XP_BASE = 3;     // XP_SOURCES.elite_enemy_kill.baseXp
export const ELITE_KILL_XP_PER_WAVE = 0.3; // XP_SOURCES.elite_enemy_kill.scaling.perWave
export const BOSS_KILL_XP_BASE = 35;     // XP_SOURCES.boss_kill.baseXp
export const BOSS_KILL_XP_PER_WAVE = 1.5; // XP_SOURCES.boss_kill.scaling.perWave

// Legacy aliases for backward compatibility
export const WAVE_XP_MULTIPLIER = WAVE_XP_BASE;
export const KILL_XP_MULTIPLIER = KILL_XP_BASE;
export const ELITE_KILL_XP_BONUS = ELITE_KILL_XP_BASE;

// UI timing
export const TOAST_DURATION_MS = 3000;
