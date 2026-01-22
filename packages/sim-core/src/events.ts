import type { GameEvent } from '@arcade/protocol';
import { GameState, SimConfig, ActiveRelic, WallType, MilitiaType, TurretTargetingMode } from './types.js';
import { getRelicById } from './data/relics.js';
import { computeModifiers } from './modifiers.js';
import { placeWall, removeWall, isValidWallPosition } from './systems/walls.js';
import { spawnMilitia, spawnMilitiaSquad } from './systems/militia.js';
import { activateTurretOvercharge, setTurretTargetingMode } from './systems/turret.js';
import { getWallDefinition } from './data/walls.js';
import { FP } from './fixed.js';

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

    case 'HERO_CONTROL':
      return validateHeroControl(event, state);

    case 'ACTIVATE_SKILL':
      return validateActivateSkill(event, state);

    case 'PLACE_WALL':
      return validatePlaceWall(event, state, _config);

    case 'REMOVE_WALL':
      return validateRemoveWall(event, state);

    case 'SET_TURRET_TARGETING':
      return validateSetTurretTargeting(event, state);

    case 'ACTIVATE_OVERCHARGE':
      return validateActivateOvercharge(event, state);

    case 'SPAWN_MILITIA':
      return validateSpawnMilitia(event, state);

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
  // Must have Crystal Matrix assembled
  if (!state.matrixState?.isAssembled) {
    return { valid: false, reason: 'Crystal Matrix not assembled' };
  }

  // Must not be on cooldown
  if (state.matrixState.annihilationCooldown > 0) {
    return { valid: false, reason: 'Annihilation Wave is on cooldown' };
  }

  // Game must not be ended
  if (state.ended) {
    return { valid: false, reason: 'Game has ended' };
  }

  // Must have enemies to annihilate
  if (state.enemies.length === 0) {
    return { valid: false, reason: 'No enemies to annihilate' };
  }

  return { valid: true };
}

function validateHeroCommand(
  event: {
    type: 'HERO_COMMAND';
    tick: number;
    heroId?: string;
    targetX?: number;
    targetY?: number;
    commandType?: 'move' | 'focus' | 'retreat';
    targetEnemyId?: number;
  },
  state: GameState
): EventValidation {
  // Game must not be ended
  if (state.ended) {
    return { valid: false, reason: 'Game has ended' };
  }

  const commandType = event.commandType || 'move';

  // For 'move' command, hero must be specified and valid
  if (commandType === 'move') {
    if (!event.heroId) {
      return { valid: false, reason: 'Hero ID required for move command' };
    }
    const hero = state.heroes.find(h => h.definitionId === event.heroId);
    if (!hero) {
      return { valid: false, reason: 'Hero not found' };
    }
  }

  // For 'focus' command, target enemy must exist
  if (commandType === 'focus') {
    if (event.targetEnemyId === undefined) {
      return { valid: false, reason: 'Target enemy ID required for focus command' };
    }
    const enemy = state.enemies.find(e => e.id === event.targetEnemyId);
    if (!enemy) {
      return { valid: false, reason: 'Target enemy not found' };
    }

    if (event.heroId) {
      const hero = state.heroes.find(h => h.definitionId === event.heroId);
      if (!hero) {
        return { valid: false, reason: 'Hero not found' };
      }
    }
  }

  // 'retreat' command has no special requirements

  return { valid: true };
}

function validateHeroControl(
  event: { type: 'HERO_CONTROL'; tick: number; heroId: string; active: boolean },
  state: GameState
): EventValidation {
  if (state.ended) {
    return { valid: false, reason: 'Game has ended' };
  }

  const hero = state.heroes.find(h => h.definitionId === event.heroId);
  if (!hero) {
    return { valid: false, reason: 'Hero not found' };
  }

  return { valid: true };
}

function validateActivateSkill(
  event: { type: 'ACTIVATE_SKILL'; tick: number; skillId: string; targetX: number; targetY: number },
  state: GameState
): EventValidation {
  // Game must not be ended
  if (state.ended) {
    return { valid: false, reason: 'Game has ended' };
  }

  // Skill must be unlocked
  if (!state.activeSkills.includes(event.skillId)) {
    return { valid: false, reason: 'Skill not unlocked' };
  }

  // Skill must not be on cooldown
  if ((state.skillCooldowns[event.skillId] ?? 0) > 0) {
    return { valid: false, reason: 'Skill is on cooldown' };
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

    case 'HERO_CONTROL':
      return applyHeroControl(event, state);

    case 'ACTIVATE_SKILL':
      // Skill execution happens in simulation.processEvents() after this event is applied
      return true;

    case 'PLACE_WALL':
      return applyPlaceWall(event, state);

    case 'REMOVE_WALL':
      return applyRemoveWall(event, state);

    case 'SET_TURRET_TARGETING':
      return applySetTurretTargeting(event, state);

    case 'ACTIVATE_OVERCHARGE':
      return applyActivateOvercharge(event, state);

    case 'SPAWN_MILITIA':
      return applySpawnMilitia(event, state);

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
  const prevMaxHpBonus = state.modifiers.maxHpBonus ?? 0;
  state.modifiers = computeModifiers(state.relics);

  // Update max HP if changed (using additive bonus system)
  const prevMultiplier = 1 + prevMaxHpBonus;
  const baseHp = Math.floor(state.fortressMaxHp / (prevMultiplier > 0 ? prevMultiplier : 1));
  const newMaxHp = Math.floor(baseHp * (1 + (state.modifiers.maxHpBonus ?? 0)));
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
  event: {
    type: 'HERO_COMMAND';
    tick: number;
    heroId?: string;
    targetX?: number;
    targetY?: number;
    commandType?: 'move' | 'focus' | 'retreat';
    targetEnemyId?: number;
  },
  state: GameState
): boolean {
  const commandType = event.commandType || 'move';

  switch (commandType) {
    case 'move': {
      // Single hero move command
      if (!event.heroId) return false;
      const hero = state.heroes.find(h => h.definitionId === event.heroId);
      if (!hero) return false;
      if (event.targetX === undefined || event.targetY === undefined) return false;

      hero.commandTarget = { x: event.targetX, y: event.targetY };
      hero.isCommanded = true;
      hero.state = 'commanded';
      return true;
    }

    case 'focus': {
      // All heroes focus fire on target enemy
      if (event.targetEnemyId === undefined) return false;
      const enemy = state.enemies.find(e => e.id === event.targetEnemyId);
      if (!enemy) return false;

      if (event.heroId) {
        const hero = state.heroes.find(h => h.definitionId === event.heroId);
        if (!hero) return false;
        hero.focusTargetId = event.targetEnemyId;
        return true;
      }

      // Set focus target on all heroes
      for (const hero of state.heroes) {
        hero.focusTargetId = event.targetEnemyId;
      }
      return true;
    }

    default:
      return false;
  }
}

function applyHeroControl(
  event: { type: 'HERO_CONTROL'; tick: number; heroId: string; active: boolean },
  state: GameState
): boolean {
  const hero = state.heroes.find(h => h.definitionId === event.heroId);
  if (!hero) return false;

  hero.isManualControlled = event.active;

  if (event.active) {
    hero.isCommanded = true;
    hero.state = 'commanded';
    if (!hero.commandTarget) {
      hero.commandTarget = { x: hero.x, y: hero.y };
    }
    return true;
  }

  hero.isCommanded = false;
  hero.focusTargetId = undefined;
  hero.commandTarget = undefined;
  hero.state = state.enemies.length > 0 ? 'combat' : 'idle';
  return true;
}

// ============================================================================
// WALL EVENT HANDLERS
// ============================================================================

function validatePlaceWall(
  event: { type: 'PLACE_WALL'; tick: number; wallType: string; x: number; y: number },
  state: GameState,
  config: SimConfig
): EventValidation {
  if (state.ended) {
    return { valid: false, reason: 'Game has ended' };
  }

  const wallDef = getWallDefinition(event.wallType as WallType);
  if (!wallDef) {
    return { valid: false, reason: 'Invalid wall type' };
  }

  // Check gold
  if (state.gold < wallDef.goldCost) {
    return { valid: false, reason: 'Not enough gold' };
  }

  // Check position is valid
  if (!isValidWallPosition(state, config, FP.toFloat(event.x), FP.toFloat(event.y), wallDef.width, wallDef.height)) {
    return { valid: false, reason: 'Invalid wall position' };
  }

  return { valid: true };
}

function validateRemoveWall(
  event: { type: 'REMOVE_WALL'; tick: number; wallId: number },
  state: GameState
): EventValidation {
  if (state.ended) {
    return { valid: false, reason: 'Game has ended' };
  }

  const wall = state.walls.find(w => w.id === event.wallId);
  if (!wall) {
    return { valid: false, reason: 'Wall not found' };
  }

  return { valid: true };
}

function applyPlaceWall(
  event: { type: 'PLACE_WALL'; tick: number; wallType: string; x: number; y: number },
  state: GameState
): boolean {
  const wall = placeWall(state, event.wallType as WallType, event.x, event.y);
  return wall !== null;
}

function applyRemoveWall(
  event: { type: 'REMOVE_WALL'; tick: number; wallId: number },
  state: GameState
): boolean {
  return removeWall(state, event.wallId);
}

// ============================================================================
// TURRET EVENT HANDLERS
// ============================================================================

function validateSetTurretTargeting(
  event: { type: 'SET_TURRET_TARGETING'; tick: number; slotIndex: number; targetingMode: string },
  state: GameState
): EventValidation {
  if (state.ended) {
    return { valid: false, reason: 'Game has ended' };
  }

  const turret = state.turrets.find(t => t.slotIndex === event.slotIndex);
  if (!turret) {
    return { valid: false, reason: 'Turret not found in slot' };
  }

  const validModes = ['closest_to_fortress', 'weakest', 'strongest', 'nearest_to_turret', 'fastest'];
  if (!validModes.includes(event.targetingMode)) {
    return { valid: false, reason: 'Invalid targeting mode' };
  }

  return { valid: true };
}

function validateActivateOvercharge(
  event: { type: 'ACTIVATE_OVERCHARGE'; tick: number; slotIndex: number },
  state: GameState
): EventValidation {
  if (state.ended) {
    return { valid: false, reason: 'Game has ended' };
  }

  const turret = state.turrets.find(t => t.slotIndex === event.slotIndex);
  if (!turret) {
    return { valid: false, reason: 'Turret not found in slot' };
  }

  // Check if overcharge is on cooldown
  if (turret.overchargeCooldownTick && turret.overchargeCooldownTick > 0) {
    return { valid: false, reason: 'Overcharge is on cooldown' };
  }

  // Check if already overcharged
  if (turret.overchargeActive) {
    return { valid: false, reason: 'Overcharge already active' };
  }

  return { valid: true };
}

function applySetTurretTargeting(
  event: { type: 'SET_TURRET_TARGETING'; tick: number; slotIndex: number; targetingMode: string },
  state: GameState
): boolean {
  return setTurretTargetingMode(state, event.slotIndex, event.targetingMode as TurretTargetingMode);
}

function applyActivateOvercharge(
  event: { type: 'ACTIVATE_OVERCHARGE'; tick: number; slotIndex: number },
  state: GameState
): boolean {
  return activateTurretOvercharge(state, event.slotIndex);
}

// ============================================================================
// MILITIA EVENT HANDLERS
// ============================================================================

function validateSpawnMilitia(
  event: { type: 'SPAWN_MILITIA'; tick: number; militiaType: string; x: number; y: number; count?: number },
  state: GameState
): EventValidation {
  if (state.ended) {
    return { valid: false, reason: 'Game has ended' };
  }

  const validTypes = ['infantry', 'archer', 'shield_bearer'];
  if (!validTypes.includes(event.militiaType)) {
    return { valid: false, reason: 'Invalid militia type' };
  }

  const type = event.militiaType as MilitiaType;

  // Check if at max militia count
  if (state.militia.length >= state.maxMilitiaCount) {
    return { valid: false, reason: 'Max militia count reached' };
  }

  // Check if this type is on cooldown
  if (state.militiaSpawnCooldowns[type] > state.tick) {
    return { valid: false, reason: 'Militia type on cooldown' };
  }

  return { valid: true };
}

function applySpawnMilitia(
  event: { type: 'SPAWN_MILITIA'; tick: number; militiaType: string; x: number; y: number; count?: number },
  state: GameState
): boolean {
  const count = event.count ?? 1;
  const type = event.militiaType as MilitiaType;
  const x = FP.toFloat(event.x);
  const y = FP.toFloat(event.y);

  if (count === 1) {
    const militia = spawnMilitia(state, type, x, y);
    return militia !== null;
  } else {
    const squad = spawnMilitiaSquad(state, type, x, y, count);
    return squad.length > 0;
  }
}
