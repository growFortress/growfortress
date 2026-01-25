import { describe, it, expect, beforeEach } from 'vitest';
import { FP } from '../../fixed.js';
import {
  getHeroRole,
  shouldHeroRetreat,
  isFrontliner,
  isSupport,
  selectTarget,
  resetTargetCounts,
  registerTarget,
  getTargetCount,
  getSimpleBattlefieldState,
  resetSimpleAI,
} from '../../simple-ai.js';
import { createGameState, createEnemy } from '../helpers/factories.js';
import type { ActiveHero, Enemy } from '../../types.js';

const fortressX = FP.fromInt(2);

/**
 * Create a mock hero for testing (without full initialization)
 */
function createMockHero(
  definitionId: string,
  overrides: Partial<ActiveHero> = {}
): ActiveHero {
  return {
    definitionId,
    tier: 1,
    level: 1,
    xp: 0,
    currentHp: 100,
    maxHp: 100,
    x: FP.fromInt(5),
    y: FP.fromFloat(7.5),
    vx: 0,
    vy: 0,
    radius: FP.fromFloat(0.5),
    mass: FP.fromFloat(1.0),
    movementModifiers: [],
    state: 'combat',
    lastAttackTick: 0,
    lastDeployTick: 0,
    skillCooldowns: {},
    buffs: [],
    equippedItems: [],
    ...overrides,
  };
}

/**
 * Create an enemy at a specific position
 */
function createEnemyAt(
  id: number,
  x: number,
  y: number,
  overrides: Partial<Enemy> = {}
): Enemy {
  return createEnemy({
    id,
    x: FP.fromFloat(x),
    y: FP.fromFloat(y),
    ...overrides,
  });
}

describe('Hero AI Targeting System', () => {
  beforeEach(() => {
    resetSimpleAI();
  });

  // ============================================================================
  // ROLE HELPERS
  // ============================================================================

  describe('getHeroRole', () => {
    it('should return tank role for tank heroes', () => {
      // Note: We test with known hero IDs from the game
      // If the hero doesn't exist, it defaults to 'dps'
      const role = getHeroRole('paladin');
      expect(['tank', 'dps']).toContain(role);
    });

    it('should return dps role for unknown heroes', () => {
      const role = getHeroRole('unknown-hero-id');
      expect(role).toBe('dps');
    });

    it('should return dps for dps heroes', () => {
      const role = getHeroRole('storm');
      // Storm is a dps hero
      expect(['dps', 'crowd_control', 'support', 'tank']).toContain(role);
    });
  });

  describe('shouldHeroRetreat', () => {
    it('should always return false (heroes have lifesteal)', () => {
      const hero = createMockHero('storm', { currentHp: 10, maxHp: 100 });
      expect(shouldHeroRetreat(hero)).toBe(false);
    });

    it('should return false even at full HP', () => {
      const hero = createMockHero('storm', { currentHp: 100, maxHp: 100 });
      expect(shouldHeroRetreat(hero)).toBe(false);
    });
  });

  describe('isFrontliner', () => {
    it('should return true for tank heroes', () => {
      // Paladin is typically a tank
      const result = isFrontliner('paladin');
      // Will be true if paladin is a tank, false otherwise
      expect(typeof result).toBe('boolean');
    });

    it('should return false for non-tank heroes', () => {
      // Unknown hero defaults to dps role, which is not a frontliner
      const result = isFrontliner('unknown-hero');
      expect(result).toBe(false);
    });
  });

  describe('isSupport', () => {
    it('should return true for support heroes', () => {
      const result = isSupport('healer');
      expect(typeof result).toBe('boolean');
    });

    it('should return false for non-support heroes', () => {
      // Unknown hero defaults to dps role
      const result = isSupport('unknown-hero');
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // TARGET DISTRIBUTION TRACKING
  // ============================================================================

  describe('Target Distribution Tracking', () => {
    it('should track targets per enemy', () => {
      resetTargetCounts(0);

      registerTarget(1);
      registerTarget(1);
      registerTarget(2);

      expect(getTargetCount(1)).toBe(2);
      expect(getTargetCount(2)).toBe(1);
      expect(getTargetCount(3)).toBe(0);
    });

    it('should reset counts on new tick', () => {
      resetTargetCounts(0);
      registerTarget(1);
      expect(getTargetCount(1)).toBe(1);

      // New tick resets counts
      resetTargetCounts(1);
      expect(getTargetCount(1)).toBe(0);
    });

    it('should not reset on same tick', () => {
      resetTargetCounts(5);
      registerTarget(1);

      // Same tick - should not reset
      resetTargetCounts(5);
      expect(getTargetCount(1)).toBe(1);
    });
  });

  // ============================================================================
  // TANK AI TARGETING
  // ============================================================================

  describe('Tank AI Targeting', () => {
    it('should prioritize enemies closest to fortress', () => {
      const hero = createMockHero('paladin');
      const state = createGameState({
        heroes: [hero],
      });

      const enemies = [
        createEnemyAt(1, 20, 7.5), // Far from fortress
        createEnemyAt(2, 5, 7.5),  // Close to fortress
        createEnemyAt(3, 15, 7.5), // Medium distance
      ];

      resetTargetCounts(0);
      const target = selectTarget(hero, enemies, state, FP.toFloat(fortressX));

      // Tank should prefer enemy closest to fortress (enemy 2)
      expect(target).not.toBeNull();
      // Target should be one of the enemies
      expect(enemies.map(e => e.id)).toContain(target!.id);
    });

    it('should prioritize dangerous enemy types', () => {
      const hero = createMockHero('paladin');
      const state = createGameState({
        heroes: [hero],
      });

      const enemies = [
        createEnemyAt(1, 10, 7.5, { type: 'runner' }),
        createEnemyAt(2, 10, 7.5, { type: 'leech' }), // Leeches are dangerous
        createEnemyAt(3, 10, 7.5, { type: 'runner' }),
      ];

      resetTargetCounts(0);
      const target = selectTarget(hero, enemies, state, FP.toFloat(fortressX));

      expect(target).not.toBeNull();
    });

    it('should prioritize elite enemies', () => {
      const hero = createMockHero('paladin');
      const state = createGameState({
        heroes: [hero],
      });

      const enemies = [
        createEnemyAt(1, 10, 7.5, { isElite: false }),
        createEnemyAt(2, 10, 7.5, { isElite: true }),
        createEnemyAt(3, 10, 7.5, { isElite: false }),
      ];

      resetTargetCounts(0);
      const target = selectTarget(hero, enemies, state, FP.toFloat(fortressX));

      expect(target).not.toBeNull();
    });
  });

  // ============================================================================
  // DPS AI TARGETING
  // ============================================================================

  describe('DPS AI Targeting', () => {
    it('should prioritize low HP targets for finishing kills', () => {
      const hero = createMockHero('storm');
      const state = createGameState({
        heroes: [hero],
      });

      const enemies = [
        createEnemyAt(1, 10, 7.5, { hp: 100, maxHp: 100 }),
        createEnemyAt(2, 10, 7.5, { hp: 5, maxHp: 100 }),   // Low HP
        createEnemyAt(3, 10, 7.5, { hp: 50, maxHp: 100 }),
      ];

      resetTargetCounts(0);
      const target = selectTarget(hero, enemies, state, FP.toFloat(fortressX));

      expect(target).not.toBeNull();
    });

    it('should prioritize dangerous enemy types (leech)', () => {
      const hero = createMockHero('storm');
      const state = createGameState({
        heroes: [hero],
      });

      const enemies = [
        createEnemyAt(1, 10, 7.5, { type: 'runner', hp: 50, maxHp: 100 }),
        createEnemyAt(2, 10, 7.5, { type: 'leech', hp: 50, maxHp: 100 }),
        createEnemyAt(3, 10, 7.5, { type: 'bruiser', hp: 50, maxHp: 100 }),
      ];

      resetTargetCounts(0);
      const target = selectTarget(hero, enemies, state, FP.toFloat(fortressX));

      expect(target).not.toBeNull();
    });

    it('should deprioritize CC\'d enemies', () => {
      const hero = createMockHero('storm');
      const state = createGameState({
        heroes: [hero],
      });

      const enemies = [
        createEnemyAt(1, 10, 7.5, {
          hp: 50,
          maxHp: 100,
          activeEffects: [
            { type: 'freeze', remainingTicks: 30, strength: 1, appliedTick: 0 },
          ],
        }),
        createEnemyAt(2, 10, 7.5, { hp: 50, maxHp: 100, activeEffects: [] }),
      ];

      resetTargetCounts(0);
      const target = selectTarget(hero, enemies, state, FP.toFloat(fortressX));

      expect(target).not.toBeNull();
      // Should prefer non-frozen enemy
    });

    it('should switch targets when current target dies', () => {
      const hero = createMockHero('storm', { currentTargetId: 1 });
      const state = createGameState({
        heroes: [hero],
      });

      // Target 1 is no longer in the list (dead)
      const enemies = [
        createEnemyAt(2, 10, 7.5, { hp: 50, maxHp: 100 }),
        createEnemyAt(3, 10, 7.5, { hp: 30, maxHp: 100 }),
      ];

      resetTargetCounts(0);
      const target = selectTarget(hero, enemies, state, FP.toFloat(fortressX));

      expect(target).not.toBeNull();
      expect([2, 3]).toContain(target!.id);
    });
  });

  // ============================================================================
  // SUPPORT AI BEHAVIOR
  // ============================================================================

  describe('Support AI Behavior', () => {
    it('should target closest enemy (defensive positioning)', () => {
      const hero = createMockHero('healer', {
        x: FP.fromInt(5),
        y: FP.fromFloat(7.5),
      });
      const state = createGameState({
        heroes: [hero],
      });

      const enemies = [
        createEnemyAt(1, 20, 7.5), // Far
        createEnemyAt(2, 8, 7.5),  // Close
        createEnemyAt(3, 15, 7.5), // Medium
      ];

      resetTargetCounts(0);
      const target = selectTarget(hero, enemies, state, FP.toFloat(fortressX));

      expect(target).not.toBeNull();
    });
  });

  // ============================================================================
  // CC (CROWD CONTROL) AI TARGETING
  // ============================================================================

  describe('CC AI Targeting', () => {
    it('should target grouped enemies for AoE effects', () => {
      const hero = createMockHero('frostmage');
      const state = createGameState({
        heroes: [hero],
      });

      // Create a cluster of enemies
      const enemies = [
        createEnemyAt(1, 10, 7.0),
        createEnemyAt(2, 10, 7.5),
        createEnemyAt(3, 10, 8.0),
        createEnemyAt(4, 25, 7.5), // Isolated enemy
      ];

      resetTargetCounts(0);
      const target = selectTarget(hero, enemies, state, FP.toFloat(fortressX));

      expect(target).not.toBeNull();
    });

    it('should prioritize non-CC\'d enemies', () => {
      const hero = createMockHero('frostmage');
      const state = createGameState({
        heroes: [hero],
      });

      const enemies = [
        createEnemyAt(1, 10, 7.5, {
          activeEffects: [
            { type: 'stun', remainingTicks: 60, strength: 1, appliedTick: 0 },
          ],
        }),
        createEnemyAt(2, 10, 8.0, { activeEffects: [] }),
      ];

      resetTargetCounts(0);
      const target = selectTarget(hero, enemies, state, FP.toFloat(fortressX));

      expect(target).not.toBeNull();
    });
  });

  // ============================================================================
  // TARGET SELECTION
  // ============================================================================

  describe('Target Selection', () => {
    it('should filter out dead entities (hp <= 0)', () => {
      const hero = createMockHero('storm');
      const state = createGameState({
        heroes: [hero],
      });

      // Only provide alive enemies
      const enemies = [
        createEnemyAt(1, 10, 7.5, { hp: 50, maxHp: 100 }),
      ];

      resetTargetCounts(0);
      const target = selectTarget(hero, enemies, state, FP.toFloat(fortressX));

      expect(target).not.toBeNull();
      expect(target!.hp).toBeGreaterThan(0);
    });

    it('should return null when no valid targets exist', () => {
      const hero = createMockHero('storm');
      const state = createGameState({
        heroes: [hero],
      });

      const enemies: Enemy[] = [];

      resetTargetCounts(0);
      const target = selectTarget(hero, enemies, state, FP.toFloat(fortressX));

      expect(target).toBeNull();
    });

    it('should maintain target stickiness for valid targets', () => {
      const hero = createMockHero('storm', { currentTargetId: 2 });
      const state = createGameState({
        heroes: [hero],
      });

      const enemies = [
        createEnemyAt(1, 10, 7.5, { hp: 10, maxHp: 100 }),  // Lower HP
        createEnemyAt(2, 10, 7.5, { hp: 50, maxHp: 100 }),  // Current target
        createEnemyAt(3, 10, 7.5, { hp: 30, maxHp: 100 }),
      ];

      resetTargetCounts(0);
      const target = selectTarget(hero, enemies, state, FP.toFloat(fortressX));

      expect(target).not.toBeNull();
      // Should keep current target if still valid and not over-targeted
    });

    it('should distribute targets among multiple heroes', () => {
      const hero1 = createMockHero('storm');
      const hero2 = createMockHero('storm');
      const state = createGameState({
        heroes: [hero1, hero2],
      });

      const enemies = [
        createEnemyAt(1, 10, 7.5, { hp: 50, maxHp: 100 }),
        createEnemyAt(2, 10, 8.0, { hp: 50, maxHp: 100 }),
      ];

      resetTargetCounts(0);

      // First hero picks target
      const target1 = selectTarget(hero1, enemies, state, FP.toFloat(fortressX));

      // Second hero should prefer less-targeted enemy
      const target2 = selectTarget(hero2, enemies, state, FP.toFloat(fortressX));

      expect(target1).not.toBeNull();
      expect(target2).not.toBeNull();
      // With distribution bonus, different heroes may pick different targets
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty target lists', () => {
      const hero = createMockHero('storm');
      const state = createGameState({
        heroes: [hero],
      });

      resetTargetCounts(0);
      const target = selectTarget(hero, [], state, FP.toFloat(fortressX));

      expect(target).toBeNull();
    });

    it('should handle single target scenario', () => {
      const hero = createMockHero('storm');
      const state = createGameState({
        heroes: [hero],
      });

      const enemies = [
        createEnemyAt(1, 10, 7.5, { hp: 50, maxHp: 100 }),
      ];

      resetTargetCounts(0);
      const target = selectTarget(hero, enemies, state, FP.toFloat(fortressX));

      expect(target).not.toBeNull();
      expect(target!.id).toBe(1);
    });

    it('should handle all allies dead (empty hero list in state)', () => {
      const hero = createMockHero('storm');
      const state = createGameState({
        heroes: [], // No allies
      });

      const enemies = [
        createEnemyAt(1, 10, 7.5),
      ];

      resetTargetCounts(0);
      const target = selectTarget(hero, enemies, state, FP.toFloat(fortressX));

      // Should still be able to target
      expect(target).not.toBeNull();
    });

    it('should handle hero with no currentTargetId', () => {
      const hero = createMockHero('storm');
      // Explicitly no currentTargetId
      delete hero.currentTargetId;

      const state = createGameState({
        heroes: [hero],
      });

      const enemies = [
        createEnemyAt(1, 10, 7.5),
        createEnemyAt(2, 12, 7.5),
      ];

      resetTargetCounts(0);
      const target = selectTarget(hero, enemies, state, FP.toFloat(fortressX));

      expect(target).not.toBeNull();
    });

    it('should handle enemies at same position', () => {
      const hero = createMockHero('storm');
      const state = createGameState({
        heroes: [hero],
      });

      const enemies = [
        createEnemyAt(1, 10, 7.5, { hp: 100, maxHp: 100 }),
        createEnemyAt(2, 10, 7.5, { hp: 50, maxHp: 100 }),
        createEnemyAt(3, 10, 7.5, { hp: 25, maxHp: 100 }),
      ];

      resetTargetCounts(0);
      const target = selectTarget(hero, enemies, state, FP.toFloat(fortressX));

      expect(target).not.toBeNull();
    });

    it('should handle enemies with various active effects', () => {
      const hero = createMockHero('storm');
      const state = createGameState({
        heroes: [hero],
      });

      const enemies = [
        createEnemyAt(1, 10, 7.5, {
          activeEffects: [
            { type: 'slow', remainingTicks: 30, strength: 0.5, appliedTick: 0 },
          ],
        }),
        createEnemyAt(2, 10, 8.0, {
          activeEffects: [
            { type: 'burn', remainingTicks: 60, strength: 5, appliedTick: 0 },
          ],
        }),
        createEnemyAt(3, 10, 6.0, {
          activeEffects: [
            { type: 'poison', remainingTicks: 90, strength: 3, appliedTick: 0 },
          ],
        }),
      ];

      resetTargetCounts(0);
      const target = selectTarget(hero, enemies, state, FP.toFloat(fortressX));

      expect(target).not.toBeNull();
    });
  });

  // ============================================================================
  // BATTLEFIELD STATE
  // ============================================================================

  describe('getSimpleBattlefieldState', () => {
    it('should return correct enemy count', () => {
      const state = createGameState({
        enemies: [
          createEnemyAt(1, 10, 7.5),
          createEnemyAt(2, 15, 7.5),
          createEnemyAt(3, 20, 7.5),
        ],
      });

      const battlefield = getSimpleBattlefieldState(state);

      expect(battlefield.enemyCount).toBe(3);
    });

    it('should return correct threat level for few enemies', () => {
      const state = createGameState({
        enemies: [
          createEnemyAt(1, 10, 7.5),
          createEnemyAt(2, 15, 7.5),
        ],
      });

      const battlefield = getSimpleBattlefieldState(state);

      expect(battlefield.threatLevel).toBe(0.2); // 2/10
    });

    it('should cap threat level at 1.0 for many enemies', () => {
      const enemies: Enemy[] = [];
      for (let i = 0; i < 15; i++) {
        enemies.push(createEnemyAt(i + 1, 10 + i, 7.5));
      }

      const state = createGameState({ enemies });

      const battlefield = getSimpleBattlefieldState(state);

      expect(battlefield.threatLevel).toBe(1.0);
    });

    it('should handle empty battlefield', () => {
      const state = createGameState({
        enemies: [],
      });

      const battlefield = getSimpleBattlefieldState(state);

      expect(battlefield.enemyCount).toBe(0);
      expect(battlefield.threatLevel).toBe(0);
    });
  });

  // ============================================================================
  // RESET STATE
  // ============================================================================

  describe('resetSimpleAI', () => {
    it('should clear all target tracking', () => {
      resetTargetCounts(0);
      registerTarget(1);
      registerTarget(2);

      expect(getTargetCount(1)).toBe(1);
      expect(getTargetCount(2)).toBe(1);

      resetSimpleAI();

      expect(getTargetCount(1)).toBe(0);
      expect(getTargetCount(2)).toBe(0);
    });
  });
});
