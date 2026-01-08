import type { GameEvent } from '@arcade/protocol';
import { GameState, SimConfig, ActiveRelic } from './types.js';
import { getRelicById } from './data/relics.js';
import { computeModifiers } from './modifiers.js';

/**
 * Event validation result
 */
export interface EventValidation {
  valid: boolean;
  reason?: string;
}

/**
 * Validate a game event against current state
 */
export function validateEvent(
  event: GameEvent,
  state: GameState,
  _config: SimConfig
): EventValidation {
  // Check tick is not in the past
  if (event.tick < state.tick) {
    return { valid: false, reason: 'Event tick is in the past' };
  }

  switch (event.type) {
    case 'CHOOSE_RELIC':
      return validateChooseRelic(event, state);

    case 'REROLL_RELICS':
      return validateRerollRelics(event, state);

    case 'ACTIVATE_SNAP':
      return validateActivateSnap(event, state);

    case 'HERO_COMMAND':
      return validateHeroCommand(event, state);

    default:
      return { valid: false, reason: 'Unknown event type' };
  }
}

function validateChooseRelic(
  event: { type: 'CHOOSE_RELIC'; tick: number; wave: number; optionIndex: number },
  state: GameState
): EventValidation {
  // Must be in choice mode
  if (!state.inChoice || !state.pendingChoice) {
    return { valid: false, reason: 'Not in choice mode' };
  }

  // Check wave matches
  if (event.wave !== state.pendingChoice.wave) {
    return { valid: false, reason: 'Wave mismatch' };
  }

  // Check option index is valid
  if (event.optionIndex < 0 || event.optionIndex >= state.pendingChoice.options.length) {
    return { valid: false, reason: 'Invalid option index' };
  }

  // Event must happen at or after choice was offered
  if (event.tick < state.pendingChoiceTick) {
    return { valid: false, reason: 'Event tick before choice was offered' };
  }

  return { valid: true };
}

function validateRerollRelics(
  _event: { type: 'REROLL_RELICS'; tick: number },
  state: GameState
): EventValidation {
  // Must be in choice mode
  if (!state.inChoice || !state.pendingChoice) {
    return { valid: false, reason: 'Not in choice mode' };
  }

  // Must have enough gold (reroll costs 10 gold)
  const REROLL_COST = 10;
  if (state.gold < REROLL_COST) {
    return { valid: false, reason: 'Not enough gold for reroll' };
  }

  return { valid: true };
}

function validateActivateSnap(
  _event: { type: 'ACTIVATE_SNAP'; tick: number },
  state: GameState
): EventValidation {
  // Must have Infinity Gauntlet assembled
  if (!state.gauntletState?.isAssembled) {
    return { valid: false, reason: 'Infinity Gauntlet not assembled' };
  }

  // Must not be on cooldown
  if (state.gauntletState.snapCooldown > 0) {
    return { valid: false, reason: 'SNAP is on cooldown' };
  }

  // Game must not be ended
  if (state.ended) {
    return { valid: false, reason: 'Game has ended' };
  }

  // Must have enemies to snap
  if (state.enemies.length === 0) {
    return { valid: false, reason: 'No enemies to snap' };
  }

  return { valid: true };
}

function validateHeroCommand(
  event: { type: 'HERO_COMMAND'; tick: number; heroId: string; targetX: number; targetY: number },
  state: GameState
): EventValidation {
  // Game must not be ended
  if (state.ended) {
    return { valid: false, reason: 'Game has ended' };
  }

  // Hero must exist
  const hero = state.heroes.find(h => h.definitionId === event.heroId);
  if (!hero) {
    return { valid: false, reason: 'Hero not found' };
  }

  // Hero must be alive and not on cooldown
  if (hero.state === 'dead') {
    return { valid: false, reason: 'Hero is dead' };
  }

  if (hero.state === 'cooldown') {
    return { valid: false, reason: 'Hero is on cooldown' };
  }

  return { valid: true };
}

/**
 * Apply a game event to state
 * Returns true if event was applied successfully
 */
export function applyEvent(
  event: GameEvent,
  state: GameState,
  config: SimConfig,
  getNewRelicOptions: () => string[]
): boolean {
  const validation = validateEvent(event, state, config);
  if (!validation.valid) {
    return false;
  }

  switch (event.type) {
    case 'CHOOSE_RELIC':
      return applyChooseRelic(event, state);

    case 'REROLL_RELICS':
      return applyRerollRelics(event, state, getNewRelicOptions);

    case 'ACTIVATE_SNAP':
      return applyActivateSnap(event, state);

    case 'HERO_COMMAND':
      return applyHeroCommand(event, state);

    default:
      return false;
  }
}

function applyChooseRelic(
  event: { type: 'CHOOSE_RELIC'; tick: number; wave: number; optionIndex: number },
  state: GameState
): boolean {
  if (!state.pendingChoice) return false;

  const relicId = state.pendingChoice.options[event.optionIndex];
  const relicDef = getRelicById(relicId);
  if (!relicDef) return false;

  // Add relic
  const activeRelic: ActiveRelic = {
    id: relicId,
    acquiredWave: event.wave,
    acquiredTick: event.tick,
  };
  state.relics.push(activeRelic);

  // Recompute modifiers
  const prevMaxHpMultiplier = state.modifiers.maxHpMultiplier || 1;
  state.modifiers = computeModifiers(state.relics);

  // Update max HP if changed
  const safePrevMultiplier = prevMaxHpMultiplier > 0 ? prevMaxHpMultiplier : 1;
  const baseHp = Math.floor(state.fortressMaxHp / safePrevMultiplier);
  const newMaxHp = Math.floor(
    baseHp * (state.modifiers.maxHpMultiplier || 1)
  );
  if (newMaxHp > state.fortressMaxHp) {
    const hpGain = newMaxHp - state.fortressMaxHp;
    state.fortressMaxHp = newMaxHp;
    state.fortressHp = Math.min(state.fortressHp + hpGain, state.fortressMaxHp);
  }

  // Clear choice state
  state.inChoice = false;
  state.pendingChoice = null;
  state.pendingChoiceTick = 0;

  return true;
}

function applyRerollRelics(
  _event: { type: 'REROLL_RELICS'; tick: number },
  state: GameState,
  getNewRelicOptions: () => string[]
): boolean {
  if (!state.pendingChoice) return false;

  const REROLL_COST = 10;
  state.gold -= REROLL_COST;

  // Generate new options
  state.pendingChoice.options = getNewRelicOptions();

  return true;
}

function applyActivateSnap(
  _event: { type: 'ACTIVATE_SNAP'; tick: number },
  _state: GameState
): boolean {
  // SNAP execution happens in simulation.processEvents() after this event is applied
  // This is similar to how ACTIVATE_SKILL works
  return true;
}

function applyHeroCommand(
  event: { type: 'HERO_COMMAND'; tick: number; heroId: string; targetX: number; targetY: number },
  state: GameState
): boolean {
  const hero = state.heroes.find(h => h.definitionId === event.heroId);
  if (!hero) return false;

  // Can only command heroes that are alive and not on cooldown
  if (hero.state === 'dead' || hero.state === 'cooldown') {
    return false;
  }

  // Set command target and switch to commanded state
  hero.commandTarget = { x: event.targetX, y: event.targetY };
  hero.isCommanded = true;
  hero.state = 'commanded';

  return true;
}
