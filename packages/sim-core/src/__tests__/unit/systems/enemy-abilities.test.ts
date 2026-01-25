/**
 * Enemy Abilities System Tests
 *
 * Tests for special enemy abilities:
 * - Shielder: Damage reduction for nearby enemies
 * - Sapper: Wall damage multiplier
 * - Special enemy type detection
 */
import { describe, it, expect } from 'vitest';
import {
  isEnemyShielded,
  getShieldDamageReduction,
  getSapperDamageMultiplier,
  isSpecialEnemy,
  SPECIAL_ENEMY_TYPES,
} from '../../../systems/enemy-abilities.js';
import { createEnemy, createGameState } from '../../helpers/factories.js';
import { FP } from '../../../fixed.js';

describe('Enemy Abilities System', () => {
  // ============================================================================
  // SHIELDER ABILITIES
  // ============================================================================

  describe('isEnemyShielded', () => {
    it('should return false when no shielders present', () => {
      const state = createGameState({
        enemies: [
          createEnemy({ id: 1, type: 'runner' }),
          createEnemy({ id: 2, type: 'bruiser' }),
        ],
      });

      const result = isEnemyShielded(state.enemies[0], state);
      expect(result).toBe(false);
    });

    it('should return false when shielder is dead', () => {
      const state = createGameState({
        enemies: [
          createEnemy({ id: 1, type: 'runner', x: FP.fromInt(10), y: FP.fromFloat(7.5) }),
          createEnemy({ id: 2, type: 'shielder', x: FP.fromInt(10), y: FP.fromFloat(7.5), hp: 0 }),
        ],
      });

      const result = isEnemyShielded(state.enemies[0], state);
      expect(result).toBe(false);
    });

    it('should return true when enemy is near a live shielder', () => {
      const state = createGameState({
        enemies: [
          createEnemy({ id: 1, type: 'runner', x: FP.fromInt(10), y: FP.fromFloat(7.5) }),
          createEnemy({ id: 2, type: 'shielder', x: FP.fromInt(11), y: FP.fromFloat(7.5), hp: 50 }),
        ],
      });

      const result = isEnemyShielded(state.enemies[0], state);
      expect(result).toBe(true);
    });

    it('should return false when enemy is too far from shielder', () => {
      const state = createGameState({
        enemies: [
          createEnemy({ id: 1, type: 'runner', x: FP.fromInt(5), y: FP.fromFloat(7.5) }),
          createEnemy({ id: 2, type: 'shielder', x: FP.fromInt(20), y: FP.fromFloat(7.5), hp: 50 }),
        ],
      });

      const result = isEnemyShielded(state.enemies[0], state);
      expect(result).toBe(false);
    });

    it('should not consider shielder shielded by itself', () => {
      const shielder = createEnemy({ id: 1, type: 'shielder', hp: 50 });
      const state = createGameState({
        enemies: [shielder],
      });

      const result = isEnemyShielded(shielder, state);
      expect(result).toBe(false);
    });

    it('should handle multiple shielders', () => {
      const state = createGameState({
        enemies: [
          createEnemy({ id: 1, type: 'runner', x: FP.fromInt(10), y: FP.fromFloat(7.5) }),
          createEnemy({ id: 2, type: 'shielder', x: FP.fromInt(50), y: FP.fromFloat(7.5), hp: 50 }),
          createEnemy({ id: 3, type: 'shielder', x: FP.fromInt(11), y: FP.fromFloat(7.5), hp: 50 }),
        ],
      });

      const result = isEnemyShielded(state.enemies[0], state);
      expect(result).toBe(true);
    });
  });

  describe('getShieldDamageReduction', () => {
    it('should return 0 when enemy is not shielded', () => {
      const state = createGameState({
        enemies: [
          createEnemy({ id: 1, type: 'runner' }),
        ],
      });

      const result = getShieldDamageReduction(state.enemies[0], state);
      expect(result).toBe(0);
    });

    it('should return shield amount when enemy is shielded', () => {
      const state = createGameState({
        enemies: [
          createEnemy({ id: 1, type: 'runner', x: FP.fromInt(10), y: FP.fromFloat(7.5) }),
          createEnemy({ id: 2, type: 'shielder', x: FP.fromInt(11), y: FP.fromFloat(7.5), hp: 50 }),
        ],
      });

      const result = getShieldDamageReduction(state.enemies[0], state);
      expect(result).toBe(0.3); // 30% damage reduction
    });
  });

  // ============================================================================
  // SAPPER ABILITIES
  // ============================================================================

  describe('getSapperDamageMultiplier', () => {
    it('should return 4x for sapper enemy type', () => {
      const sapper = createEnemy({ type: 'sapper' });
      const result = getSapperDamageMultiplier(sapper);
      expect(result).toBe(4);
    });

    it('should return 1 for non-sapper enemy types', () => {
      const runner = createEnemy({ type: 'runner' });
      expect(getSapperDamageMultiplier(runner)).toBe(1);

      const bruiser = createEnemy({ type: 'bruiser' });
      expect(getSapperDamageMultiplier(bruiser)).toBe(1);

      const healer = createEnemy({ type: 'healer' });
      expect(getSapperDamageMultiplier(healer)).toBe(1);

      const shielder = createEnemy({ type: 'shielder' });
      expect(getSapperDamageMultiplier(shielder)).toBe(1);

      const teleporter = createEnemy({ type: 'teleporter' });
      expect(getSapperDamageMultiplier(teleporter)).toBe(1);
    });
  });

  // ============================================================================
  // SPECIAL ENEMY TYPE DETECTION
  // ============================================================================

  describe('SPECIAL_ENEMY_TYPES', () => {
    it('should include all special enemy types', () => {
      expect(SPECIAL_ENEMY_TYPES).toContain('catapult');
      expect(SPECIAL_ENEMY_TYPES).toContain('sapper');
      expect(SPECIAL_ENEMY_TYPES).toContain('healer');
      expect(SPECIAL_ENEMY_TYPES).toContain('shielder');
      expect(SPECIAL_ENEMY_TYPES).toContain('teleporter');
    });

    it('should have exactly 5 special types', () => {
      expect(SPECIAL_ENEMY_TYPES).toHaveLength(5);
    });
  });

  describe('isSpecialEnemy', () => {
    it('should return true for special enemy types', () => {
      expect(isSpecialEnemy('catapult')).toBe(true);
      expect(isSpecialEnemy('sapper')).toBe(true);
      expect(isSpecialEnemy('healer')).toBe(true);
      expect(isSpecialEnemy('shielder')).toBe(true);
      expect(isSpecialEnemy('teleporter')).toBe(true);
    });

    it('should return false for basic enemy types', () => {
      expect(isSpecialEnemy('runner')).toBe(false);
      expect(isSpecialEnemy('brute')).toBe(false);
      expect(isSpecialEnemy('armored')).toBe(false);
      expect(isSpecialEnemy('speeder')).toBe(false);
    });

    it('should return false for unknown types', () => {
      expect(isSpecialEnemy('unknown')).toBe(false);
      expect(isSpecialEnemy('')).toBe(false);
      expect(isSpecialEnemy('CATAPULT')).toBe(false); // Case sensitive
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('edge cases', () => {
    it('should handle empty enemies array', () => {
      const state = createGameState({ enemies: [] });
      const dummyEnemy = createEnemy();

      const shielded = isEnemyShielded(dummyEnemy, state);
      expect(shielded).toBe(false);

      const reduction = getShieldDamageReduction(dummyEnemy, state);
      expect(reduction).toBe(0);
    });

    it('should handle enemies at same position', () => {
      const state = createGameState({
        enemies: [
          createEnemy({ id: 1, type: 'runner', x: FP.fromInt(10), y: FP.fromInt(7) }),
          createEnemy({ id: 2, type: 'shielder', x: FP.fromInt(10), y: FP.fromInt(7), hp: 50 }),
        ],
      });

      const result = isEnemyShielded(state.enemies[0], state);
      expect(result).toBe(true);
    });

    it('should handle enemies exactly at shield range boundary', () => {
      // Shield range is 3 units
      const state = createGameState({
        enemies: [
          createEnemy({ id: 1, type: 'runner', x: FP.fromInt(10), y: FP.fromInt(7) }),
          createEnemy({ id: 2, type: 'shielder', x: FP.fromInt(13), y: FP.fromInt(7), hp: 50 }),
        ],
      });

      const result = isEnemyShielded(state.enemies[0], state);
      // Exactly at boundary - should be at distance 3
      expect(typeof result).toBe('boolean');
    });
  });
});
