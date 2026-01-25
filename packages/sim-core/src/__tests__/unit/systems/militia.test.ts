/**
 * Militia System Tests
 *
 * Tests for militia units:
 * - Spawning and limits
 * - Squad spawning
 * - Damage and death
 * - Helper functions (getById, getByType, count)
 */
import { describe, it, expect } from 'vitest';
import {
  spawnMilitia,
  spawnMilitiaSquad,
  applyDamageToMilitia,
  getMilitiaById,
  getMilitiaByType,
  countActiveMilitia,
} from '../../../systems/militia.js';
import { createGameState } from '../../helpers/factories.js';
import { FP } from '../../../fixed.js';
import type { Militia, MilitiaType } from '../../../types.js';

// Helper to create a basic militia unit
function createMilitia(overrides: Partial<Militia> = {}): Militia {
  return {
    id: 1,
    type: 'infantry',
    x: FP.fromInt(10),
    y: FP.fromInt(7),
    vx: 0,
    vy: 0,
    radius: FP.fromFloat(0.5),
    mass: FP.fromFloat(1.0),
    currentHp: 50,
    maxHp: 50,
    damage: 10,
    attackRange: FP.fromFloat(2.0),
    attackInterval: 30,
    lastAttackTick: 0,
    spawnTick: 0,
    expirationTick: 300,
    state: 'moving',
    targetEnemyId: null,
    ...overrides,
  };
}

describe('Militia System', () => {
  // ============================================================================
  // SPAWN MILITIA
  // ============================================================================

  describe('spawnMilitia', () => {
    it('should spawn militia unit at specified position', () => {
      const state = createGameState({
        militia: [],
        nextMilitiaId: 1,
        maxMilitiaCount: 8,
        tick: 0,
        militiaSpawnCooldowns: { infantry: 0, archer: 0, shield_bearer: 0 },
      });

      const militia = spawnMilitia(state, 'infantry', FP.fromInt(10), FP.fromInt(7));

      expect(militia).not.toBeNull();
      expect(militia!.type).toBe('infantry');
      expect(FP.toInt(militia!.x)).toBe(10);
      expect(state.militia).toHaveLength(1);
    });

    it('should increment nextMilitiaId', () => {
      const state = createGameState({
        militia: [],
        nextMilitiaId: 5,
        maxMilitiaCount: 8,
        tick: 0,
        militiaSpawnCooldowns: { infantry: 0, archer: 0, shield_bearer: 0 },
      });

      spawnMilitia(state, 'infantry', FP.fromInt(10), FP.fromInt(7));

      expect(state.nextMilitiaId).toBe(6);
    });

    it('should return null when at max militia count', () => {
      const state = createGameState({
        militia: [createMilitia(), createMilitia({ id: 2 })],
        nextMilitiaId: 3,
        maxMilitiaCount: 2, // Already at max
        tick: 0,
        militiaSpawnCooldowns: { infantry: 0, archer: 0, shield_bearer: 0 },
      });

      const militia = spawnMilitia(state, 'infantry', FP.fromInt(10), FP.fromInt(7));

      expect(militia).toBeNull();
      expect(state.militia).toHaveLength(2);
    });

    it('should return null when type is on cooldown', () => {
      const state = createGameState({
        militia: [],
        nextMilitiaId: 1,
        maxMilitiaCount: 8,
        tick: 100,
        militiaSpawnCooldowns: { infantry: 200, archer: 0, shield_bearer: 0 }, // Infantry on cooldown
      });

      const militia = spawnMilitia(state, 'infantry', FP.fromInt(10), FP.fromInt(7));

      expect(militia).toBeNull();
    });

    it('should spawn different militia types', () => {
      const types: MilitiaType[] = ['infantry', 'archer', 'shield_bearer'];

      for (const type of types) {
        const state = createGameState({
          militia: [],
          nextMilitiaId: 1,
          maxMilitiaCount: 8,
          tick: 0,
          militiaSpawnCooldowns: { infantry: 0, archer: 0, shield_bearer: 0 },
        });

        const militia = spawnMilitia(state, type, FP.fromInt(10), FP.fromInt(7));
        expect(militia).not.toBeNull();
        expect(militia!.type).toBe(type);
      }
    });

    it('should set correct spawn and expiration ticks', () => {
      const state = createGameState({
        militia: [],
        nextMilitiaId: 1,
        maxMilitiaCount: 8,
        tick: 100,
        militiaSpawnCooldowns: { infantry: 0, archer: 0, shield_bearer: 0 },
      });

      const militia = spawnMilitia(state, 'infantry', FP.fromInt(10), FP.fromInt(7));

      expect(militia!.spawnTick).toBe(100);
      expect(militia!.expirationTick).toBeGreaterThan(100);
    });
  });

  // ============================================================================
  // SPAWN MILITIA SQUAD
  // ============================================================================

  describe('spawnMilitiaSquad', () => {
    it('should spawn multiple militia units', () => {
      const state = createGameState({
        militia: [],
        nextMilitiaId: 1,
        maxMilitiaCount: 8,
        tick: 0,
        militiaSpawnCooldowns: { infantry: 0, archer: 0, shield_bearer: 0 },
      });

      const squad = spawnMilitiaSquad(state, 'infantry', FP.fromInt(10), FP.fromInt(7), 3);

      expect(squad).toHaveLength(3);
      expect(state.militia).toHaveLength(3);
    });

    it('should spread units in a line formation', () => {
      const state = createGameState({
        militia: [],
        nextMilitiaId: 1,
        maxMilitiaCount: 8,
        tick: 0,
        militiaSpawnCooldowns: { infantry: 0, archer: 0, shield_bearer: 0 },
      });

      const squad = spawnMilitiaSquad(state, 'infantry', FP.fromInt(10), FP.fromInt(7), 3);

      // Units should be spread out
      const xPositions = squad.map(m => FP.toFloat(m.x));
      const uniqueX = new Set(xPositions);
      expect(uniqueX.size).toBe(3); // All different X positions
    });

    it('should respect max militia count', () => {
      const state = createGameState({
        militia: [createMilitia(), createMilitia({ id: 2 })],
        nextMilitiaId: 3,
        maxMilitiaCount: 3, // Can only spawn 1 more
        tick: 0,
        militiaSpawnCooldowns: { infantry: 0, archer: 0, shield_bearer: 0 },
      });

      const squad = spawnMilitiaSquad(state, 'infantry', FP.fromInt(10), FP.fromInt(7), 5);

      expect(squad).toHaveLength(1); // Only 1 could spawn
      expect(state.militia).toHaveLength(3);
    });

    it('should return empty array when at max count', () => {
      const state = createGameState({
        militia: [createMilitia(), createMilitia({ id: 2 })],
        nextMilitiaId: 3,
        maxMilitiaCount: 2, // Already at max
        tick: 0,
        militiaSpawnCooldowns: { infantry: 0, archer: 0, shield_bearer: 0 },
      });

      const squad = spawnMilitiaSquad(state, 'infantry', FP.fromInt(10), FP.fromInt(7), 3);

      expect(squad).toHaveLength(0);
    });
  });

  // ============================================================================
  // APPLY DAMAGE
  // ============================================================================

  describe('applyDamageToMilitia', () => {
    it('should reduce militia HP', () => {
      const militia = createMilitia({ currentHp: 50, maxHp: 50 });

      applyDamageToMilitia(militia, 20);

      expect(militia.currentHp).toBe(30);
    });

    it('should set state to dead when HP reaches 0', () => {
      const militia = createMilitia({ currentHp: 50, maxHp: 50 });

      applyDamageToMilitia(militia, 50);

      expect(militia.currentHp).toBe(0);
      expect(militia.state).toBe('dead');
    });

    it('should set state to dead when HP goes negative', () => {
      const militia = createMilitia({ currentHp: 50, maxHp: 50 });

      applyDamageToMilitia(militia, 100); // Overkill

      expect(militia.currentHp).toBe(-50);
      expect(militia.state).toBe('dead');
    });

    it('should not change state if HP stays positive', () => {
      const militia = createMilitia({ currentHp: 50, maxHp: 50, state: 'attacking' });

      applyDamageToMilitia(militia, 10);

      expect(militia.state).toBe('attacking'); // State preserved
    });
  });

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  describe('getMilitiaById', () => {
    it('should find militia by ID', () => {
      const state = createGameState({
        militia: [
          createMilitia({ id: 1 }),
          createMilitia({ id: 2 }),
          createMilitia({ id: 3 }),
        ],
      });

      const found = getMilitiaById(state, 2);

      expect(found).toBeDefined();
      expect(found!.id).toBe(2);
    });

    it('should return undefined for non-existent ID', () => {
      const state = createGameState({
        militia: [createMilitia({ id: 1 })],
      });

      const found = getMilitiaById(state, 999);

      expect(found).toBeUndefined();
    });

    it('should return undefined for empty militia array', () => {
      const state = createGameState({ militia: [] });

      const found = getMilitiaById(state, 1);

      expect(found).toBeUndefined();
    });
  });

  describe('getMilitiaByType', () => {
    it('should find all militia of a type', () => {
      const state = createGameState({
        militia: [
          createMilitia({ id: 1, type: 'infantry' }),
          createMilitia({ id: 2, type: 'archer' }),
          createMilitia({ id: 3, type: 'infantry' }),
          createMilitia({ id: 4, type: 'shield_bearer' }),
        ],
      });

      const infantry = getMilitiaByType(state, 'infantry');

      expect(infantry).toHaveLength(2);
      expect(infantry.every(m => m.type === 'infantry')).toBe(true);
    });

    it('should return empty array for non-existent type', () => {
      const state = createGameState({
        militia: [createMilitia({ id: 1, type: 'infantry' })],
      });

      const archers = getMilitiaByType(state, 'archer');

      expect(archers).toHaveLength(0);
    });

    it('should return empty array for empty militia array', () => {
      const state = createGameState({ militia: [] });

      const result = getMilitiaByType(state, 'infantry');

      expect(result).toHaveLength(0);
    });
  });

  describe('countActiveMilitia', () => {
    it('should count all non-dead militia', () => {
      const state = createGameState({
        militia: [
          createMilitia({ id: 1, state: 'moving' }),
          createMilitia({ id: 2, state: 'attacking' }),
          createMilitia({ id: 3, state: 'dead' }),
          createMilitia({ id: 4, state: 'moving' }),
        ],
      });

      const count = countActiveMilitia(state);

      expect(count).toBe(3);
    });

    it('should return 0 when all militia are dead', () => {
      const state = createGameState({
        militia: [
          createMilitia({ id: 1, state: 'dead' }),
          createMilitia({ id: 2, state: 'dead' }),
        ],
      });

      const count = countActiveMilitia(state);

      expect(count).toBe(0);
    });

    it('should return 0 for empty militia array', () => {
      const state = createGameState({ militia: [] });

      const count = countActiveMilitia(state);

      expect(count).toBe(0);
    });

    it('should count all militia when none are dead', () => {
      const state = createGameState({
        militia: [
          createMilitia({ id: 1, state: 'moving' }),
          createMilitia({ id: 2, state: 'attacking' }),
          createMilitia({ id: 3, state: 'moving' }),
        ],
      });

      const count = countActiveMilitia(state);

      expect(count).toBe(3);
    });
  });
});
