/**
 * Arena PvP Module
 *
 * Exports all arena-related types and functions for 1v1 PvP battles.
 */

// State types and initialization
export {
  createArenaState,
  getEnemySide,
  getOwnSide,
  DEFAULT_ARENA_CONFIG,
  FORTRESS_EXCLUSION_RADIUS,
  ARENA_DAMAGE_MULTIPLIER,
  type ArenaState,
  type ArenaSide,
  type ArenaFortress,
  type ArenaStats,
  type ArenaConfig,
  type ArenaBuildConfig,
  type ArenaHeroConfig,
  type ArenaWinReason,
} from './arena-state.js';

// AI targeting
export {
  selectHeroTarget,
  selectFortressTarget,
  getHeroMovementDirection,
  type ArenaTarget,
  type ArenaTargetType,
} from './arena-ai.js';

// Simulation
export {
  ArenaSimulation,
  runArenaBattle,
  type ArenaResult,
  type ArenaReplayEvent,
} from './arena-simulation.js';

// Guild Arena 5v5
export {
  runGuildArena,
  type GuildBattleHero,
  type GuildArenaResult,
  type GuildArenaKeyMoment,
  type GuildArenaKillLog,
  type GuildArenaMvp,
} from './guild-arena.js';
