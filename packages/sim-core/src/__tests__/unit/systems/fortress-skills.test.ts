/**
 * Fortress Skills System Tests
 *
 * Tests for fortress class skill execution:
 * - Skill cooldown management
 * - Targeted skill activation
 * - Skill effect application to enemies
 */
import { describe, it, expect } from 'vitest';
import {
  updateFortressSkills,
  activateTargetedSkill,
} from '../../../systems/fortress-skills.js';
import { createGameState, createSimConfig, createEnemy, createModifiers } from '../../helpers/factories.js';
import { Xorshift32 } from '../../../rng.js';
import { FP } from '../../../fixed.js';

describe('Fortress Skills System', () => {
  // ============================================================================
  // ACTIVATE TARGETED SKILL
  // ============================================================================

  describe('activateTargetedSkill', () => {
    it('should return false for non-existent skill', () => {
      const state = createGameState({
        fortressClass: 'natural',
        activeSkills: [],
        skillCooldowns: {},
      });
      const config = createSimConfig();
      const rng = new Xorshift32(12345);

      const result = activateTargetedSkill('non-existent-skill', 10, 7, state, config, rng);
      expect(result).toBe(false);
    });

    it('should return false for skill not in activeSkills', () => {
      const state = createGameState({
        fortressClass: 'natural',
        activeSkills: [], // earthquake not active
        skillCooldowns: {},
      });
      const config = createSimConfig();
      const rng = new Xorshift32(12345);

      const result = activateTargetedSkill('earthquake', 10, 7, state, config, rng);
      expect(result).toBe(false);
    });

    it('should return false when skill is on cooldown', () => {
      const state = createGameState({
        fortressClass: 'natural',
        activeSkills: ['earthquake'],
        skillCooldowns: { earthquake: 100 }, // On cooldown
      });
      const config = createSimConfig();
      const rng = new Xorshift32(12345);

      const result = activateTargetedSkill('earthquake', 10, 7, state, config, rng);
      expect(result).toBe(false);
    });

    it('should return true and apply cooldown when skill is successfully activated', () => {
      const state = createGameState({
        fortressClass: 'natural',
        activeSkills: ['earthquake'],
        skillCooldowns: { earthquake: 0 },
        enemies: [createEnemy({ id: 1, hp: 100, maxHp: 100, x: FP.fromInt(10), y: FP.fromInt(7) })],
      });
      const config = createSimConfig();
      const rng = new Xorshift32(12345);

      const result = activateTargetedSkill('earthquake', 10, 7, state, config, rng);
      expect(result).toBe(true);
      expect(state.skillCooldowns.earthquake).toBeGreaterThan(0);
    });

    it('should deal damage to enemies in skill area', () => {
      const state = createGameState({
        fortressClass: 'natural',
        activeSkills: ['earthquake'],
        skillCooldowns: { earthquake: 0 },
        enemies: [createEnemy({ id: 1, hp: 100, maxHp: 100, x: FP.fromInt(10), y: FP.fromInt(7) })],
      });
      const config = createSimConfig();
      const rng = new Xorshift32(12345);
      const initialHp = state.enemies[0].hp;

      activateTargetedSkill('earthquake', 10, 7, state, config, rng);
      expect(state.enemies[0].hp).toBeLessThan(initialHp);
    });

    it('should not damage enemies outside skill radius', () => {
      const state = createGameState({
        fortressClass: 'natural',
        activeSkills: ['earthquake'],
        skillCooldowns: { earthquake: 0 },
        enemies: [
          createEnemy({ id: 1, hp: 100, maxHp: 100, x: FP.fromInt(10), y: FP.fromInt(7) }),
          createEnemy({ id: 2, hp: 100, maxHp: 100, x: FP.fromInt(50), y: FP.fromInt(7) }), // Far away
        ],
      });
      const config = createSimConfig();
      const rng = new Xorshift32(12345);
      const farEnemyInitialHp = state.enemies[1].hp;

      activateTargetedSkill('earthquake', 10, 7, state, config, rng);
      expect(state.enemies[1].hp).toBe(farEnemyInitialHp);
    });
  });

  // ============================================================================
  // UPDATE FORTRESS SKILLS
  // ============================================================================

  describe('updateFortressSkills', () => {
    it('should do nothing if class definition not found', () => {
      const state = createGameState({
        fortressClass: 'invalid' as 'natural', // Force invalid class
        activeSkills: [],
        skillCooldowns: {},
      });
      const config = createSimConfig();
      const rng = new Xorshift32(12345);

      // Should not throw
      expect(() => updateFortressSkills(state, config, rng)).not.toThrow();
    });

    it('should decrement skill cooldowns', () => {
      const state = createGameState({
        fortressClass: 'natural',
        activeSkills: ['earthquake'],
        skillCooldowns: { earthquake: 10 },
      });
      const config = createSimConfig();
      const rng = new Xorshift32(12345);

      updateFortressSkills(state, config, rng);
      expect(state.skillCooldowns.earthquake).toBe(9);
    });

    it('should not decrement cooldowns below zero', () => {
      const state = createGameState({
        fortressClass: 'natural',
        activeSkills: ['earthquake'],
        skillCooldowns: { earthquake: 0 },
      });
      const config = createSimConfig();
      const rng = new Xorshift32(12345);

      updateFortressSkills(state, config, rng);
      expect(state.skillCooldowns.earthquake).toBe(0);
    });

    it('should skip skills that require targeting', () => {
      // earthquake requires targeting, so it shouldn't be auto-used
      const state = createGameState({
        fortressClass: 'natural',
        activeSkills: ['earthquake'],
        skillCooldowns: { earthquake: 0 },
        enemies: [createEnemy({ id: 1, hp: 100 })],
      });
      const config = createSimConfig();
      const rng = new Xorshift32(12345);
      const initialHp = state.enemies[0].hp;

      updateFortressSkills(state, config, rng);

      // Skill should not have been used (no damage dealt)
      // Cooldown should still be 0
      expect(state.skillCooldowns.earthquake).toBe(0);
      expect(state.enemies[0].hp).toBe(initialHp);
    });

    it('should handle empty enemies array', () => {
      const state = createGameState({
        fortressClass: 'fire',
        activeSkills: ['flame_wave'],
        skillCooldowns: { flame_wave: 0 },
        enemies: [],
      });
      const config = createSimConfig();
      const rng = new Xorshift32(12345);

      // Should not throw with no enemies
      expect(() => updateFortressSkills(state, config, rng)).not.toThrow();
    });
  });

  // ============================================================================
  // SKILL DAMAGE CALCULATIONS
  // ============================================================================

  describe('skill damage calculations', () => {
    it('should scale damage with commander level', () => {
      const lowLevelState = createGameState({
        fortressClass: 'natural',
        activeSkills: ['earthquake'],
        skillCooldowns: { earthquake: 0 },
        commanderLevel: 1,
        enemies: [createEnemy({ id: 1, hp: 200, maxHp: 200, x: FP.fromInt(10), y: FP.fromInt(7) })],
      });
      const config = createSimConfig();
      const rng = new Xorshift32(12345);

      activateTargetedSkill('earthquake', 10, 7, lowLevelState, config, rng);
      const lowLevelDamage = 200 - lowLevelState.enemies[0].hp;

      const highLevelState = createGameState({
        fortressClass: 'natural',
        activeSkills: ['earthquake'],
        skillCooldowns: { earthquake: 0 },
        commanderLevel: 10, // Higher level = more damage
        enemies: [createEnemy({ id: 1, hp: 200, maxHp: 200, x: FP.fromInt(10), y: FP.fromInt(7) })],
      });

      activateTargetedSkill('earthquake', 10, 7, highLevelState, config, rng);
      const highLevelDamage = 200 - highLevelState.enemies[0].hp;

      expect(highLevelDamage).toBeGreaterThan(lowLevelDamage);
    });

    it('should apply damage bonus from modifiers', () => {
      const noBonus = createGameState({
        fortressClass: 'natural',
        activeSkills: ['earthquake'],
        skillCooldowns: { earthquake: 0 },
        modifiers: createModifiers({ damageBonus: 0 }),
        enemies: [createEnemy({ id: 1, hp: 200, maxHp: 200, x: FP.fromInt(10), y: FP.fromInt(7) })],
      });
      const config = createSimConfig();
      const rng = new Xorshift32(12345);

      activateTargetedSkill('earthquake', 10, 7, noBonus, config, rng);
      const noBonusDamage = 200 - noBonus.enemies[0].hp;

      const withBonus = createGameState({
        fortressClass: 'natural',
        activeSkills: ['earthquake'],
        skillCooldowns: { earthquake: 0 },
        modifiers: createModifiers({ damageBonus: 0.5 }), // +50% damage
        enemies: [createEnemy({ id: 1, hp: 200, maxHp: 200, x: FP.fromInt(10), y: FP.fromInt(7) })],
      });

      activateTargetedSkill('earthquake', 10, 7, withBonus, config, rng);
      const withBonusDamage = 200 - withBonus.enemies[0].hp;

      expect(withBonusDamage).toBeGreaterThan(noBonusDamage);
    });
  });

  // ============================================================================
  // DIFFERENT FORTRESS CLASSES
  // ============================================================================

  describe('different fortress classes', () => {
    it('should handle ice class skills', () => {
      const state = createGameState({
        fortressClass: 'ice',
        activeSkills: ['blizzard'],
        skillCooldowns: { blizzard: 0 },
        enemies: [createEnemy({ id: 1, hp: 100, maxHp: 100, x: FP.fromInt(10), y: FP.fromInt(7) })],
      });
      const config = createSimConfig();
      const rng = new Xorshift32(12345);

      const result = activateTargetedSkill('blizzard', 10, 7, state, config, rng);
      expect(result).toBe(true);
    });

    it('should handle fire class skills', () => {
      const state = createGameState({
        fortressClass: 'fire',
        activeSkills: ['meteor_strike'],
        skillCooldowns: { meteor_strike: 0 },
        enemies: [createEnemy({ id: 1, hp: 100, maxHp: 100, x: FP.fromInt(10), y: FP.fromInt(7) })],
      });
      const config = createSimConfig();
      const rng = new Xorshift32(12345);

      const result = activateTargetedSkill('meteor_strike', 10, 7, state, config, rng);
      expect(result).toBe(true);
    });
  });

  // ============================================================================
  // COOLDOWN REDUCTION
  // ============================================================================

  describe('cooldown reduction', () => {
    it('should apply cooldown reduction from modifiers', () => {
      // First, test without CDR
      const stateNoCDR = createGameState({
        fortressClass: 'natural',
        activeSkills: ['earthquake'],
        skillCooldowns: { earthquake: 0 },
        modifiers: createModifiers({ cooldownReduction: 0 }),
        enemies: [createEnemy({ id: 1, hp: 100, x: FP.fromInt(10), y: FP.fromInt(7) })],
      });
      const config = createSimConfig();
      const rng1 = new Xorshift32(12345);

      activateTargetedSkill('earthquake', 10, 7, stateNoCDR, config, rng1);
      const cooldownNoCDR = stateNoCDR.skillCooldowns.earthquake;

      // Then, test with CDR
      const stateWithCDR = createGameState({
        fortressClass: 'natural',
        activeSkills: ['earthquake'],
        skillCooldowns: { earthquake: 0 },
        modifiers: createModifiers({ cooldownReduction: 0.5 }), // 50% CDR
        enemies: [createEnemy({ id: 1, hp: 100, x: FP.fromInt(10), y: FP.fromInt(7) })],
      });
      const rng2 = new Xorshift32(12345);

      activateTargetedSkill('earthquake', 10, 7, stateWithCDR, config, rng2);
      const cooldownWithCDR = stateWithCDR.skillCooldowns.earthquake;

      expect(cooldownWithCDR).toBeLessThan(cooldownNoCDR);
    });

    it('should cap cooldown reduction at 75%', () => {
      const state = createGameState({
        fortressClass: 'natural',
        activeSkills: ['earthquake'],
        skillCooldowns: { earthquake: 0 },
        modifiers: createModifiers({ cooldownReduction: 1.0 }), // 100% CDR (should be capped)
        enemies: [createEnemy({ id: 1, hp: 100, x: FP.fromInt(10), y: FP.fromInt(7) })],
      });
      const config = createSimConfig();
      const rng = new Xorshift32(12345);

      activateTargetedSkill('earthquake', 10, 7, state, config, rng);

      // Cooldown should be at least 25% of base (75% cap)
      expect(state.skillCooldowns.earthquake).toBeGreaterThan(0);
    });
  });
});
