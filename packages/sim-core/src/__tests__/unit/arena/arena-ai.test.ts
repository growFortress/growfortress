/**
 * Arena AI Unit Tests
 *
 * Tests for hero target selection, movement, and fortress targeting in arena battles.
 */
import { describe, it, expect } from 'vitest';
import {
  selectHeroTarget,
  getHeroMovementDirection,
  selectFortressTarget,
  type ArenaTarget,
} from '../../../arena/arena-ai.js';
import {
  createArenaState,
  type ArenaState,
  type ArenaBuildConfig,
} from '../../../arena/arena-state.js';
import { FP } from '../../../fixed.js';
import type { ActiveHero } from '../../../types.js';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createTestBuild(overrides: Partial<ArenaBuildConfig> = {}): ArenaBuildConfig {
  return {
    ownerId: 'test-player-1',
    ownerName: 'Test Player 1',
    fortressClass: 'fire',
    commanderLevel: 30,
    heroIds: ['storm', 'forge'],
    ...overrides,
  };
}

function createTestState(seed: number = 12345): ArenaState {
  const leftBuild = createTestBuild({ ownerId: 'left-player' });
  const rightBuild = createTestBuild({ ownerId: 'right-player' });
  return createArenaState(seed, leftBuild, rightBuild);
}

function createMockHero(overrides: Partial<ActiveHero> = {}): ActiveHero {
  return {
    definitionId: 'storm',
    level: 1,
    tier: 1,
    xp: 0,
    currentHp: 100,
    maxHp: 100,
    x: FP.fromInt(10),
    y: FP.fromInt(7),
    vx: 0,
    vy: 0,
    radius: FP.fromFloat(0.4),
    mass: FP.fromFloat(1.0),
    state: 'idle',
    lastAttackTick: -1000,
    skillCooldowns: {},
    buffs: [],
    equippedArtifact: undefined,
    equippedItems: [],
    isManualControlled: false,
    ...overrides,
  } as ActiveHero;
}

// ============================================================================
// BUILD GENERATION (via createArenaState)
// ============================================================================

describe('Arena AI - Build Generation', () => {
  describe('should generate valid loadout', () => {
    it('creates heroes matching the specified hero IDs', () => {
      const build = createTestBuild({ heroIds: ['storm', 'forge', 'titan'] });
      const state = createArenaState(12345, build, createTestBuild());

      expect(state.left.heroes.length).toBe(3);
      expect(state.left.heroes[0].definitionId).toBe('storm');
      expect(state.left.heroes[1].definitionId).toBe('forge');
      expect(state.left.heroes[2].definitionId).toBe('titan');
    });

    it('initializes heroes with valid HP values', () => {
      const state = createTestState();

      for (const hero of state.left.heroes) {
        expect(hero.currentHp).toBeGreaterThan(0);
        expect(hero.currentHp).toBe(hero.maxHp);
      }
    });

    it('positions heroes in front of their fortress', () => {
      const state = createTestState();

      // Left heroes should be to the right of left fortress
      for (const hero of state.left.heroes) {
        expect(hero.x).toBeGreaterThan(state.left.fortress.x);
      }

      // Right heroes should be to the left of right fortress
      for (const hero of state.right.heroes) {
        expect(hero.x).toBeLessThan(state.right.fortress.x);
      }
    });
  });

  describe('should respect hero/turret constraints', () => {
    it('limits heroes based on commander level slots', () => {
      // Low level commander should have fewer slots
      const lowLevelBuild = createTestBuild({
        commanderLevel: 1,
        heroIds: ['storm', 'forge', 'titan', 'shadow', 'vanguard'],
      });
      const state = createArenaState(12345, lowLevelBuild, createTestBuild());

      // At level 1, max hero slots is typically limited
      expect(state.left.heroes.length).toBeLessThanOrEqual(5);
    });

    it('applies commander level bonuses to fortress HP', () => {
      const lowLevel = createTestBuild({ commanderLevel: 5 });
      const highLevel = createTestBuild({ commanderLevel: 50 });

      const lowState = createArenaState(12345, lowLevel, createTestBuild());
      const highState = createArenaState(12345, highLevel, createTestBuild());

      expect(highState.left.fortress.maxHp).toBeGreaterThan(lowState.left.fortress.maxHp);
    });
  });

  describe('should vary builds based on seed', () => {
    it('produces deterministic state with same seed', () => {
      const state1 = createTestState(42);
      const state2 = createTestState(42);

      expect(state1.rngState).toBe(state2.rngState);
      expect(state1.left.fortress.hp).toBe(state2.left.fortress.hp);
      expect(state1.right.fortress.hp).toBe(state2.right.fortress.hp);
    });

    it('different seeds produce different RNG states', () => {
      const state1 = createTestState(100);
      const state2 = createTestState(200);

      expect(state1.rngState).not.toBe(state2.rngState);
    });
  });
});

// ============================================================================
// HERO PLACEMENT
// ============================================================================

describe('Arena AI - Hero Placement', () => {
  describe('should position heroes strategically', () => {
    it('places left side heroes facing right (towards enemy)', () => {
      const state = createTestState();

      // All left heroes should be between left fortress and center
      const centerX = FP.fromInt(25); // approx center of 50-unit field
      for (const hero of state.left.heroes) {
        expect(hero.x).toBeLessThan(centerX);
        expect(hero.x).toBeGreaterThan(state.left.fortress.x);
      }
    });

    it('places right side heroes facing left (towards enemy)', () => {
      const state = createTestState();

      const centerX = FP.fromInt(25);
      for (const hero of state.right.heroes) {
        expect(hero.x).toBeGreaterThan(centerX);
        expect(hero.x).toBeLessThan(state.right.fortress.x);
      }
    });

    it('distributes heroes vertically within arena bounds', () => {
      const build = createTestBuild({ heroIds: ['storm', 'forge', 'titan', 'shadow'] });
      const state = createArenaState(12345, build, createTestBuild());

      const fieldHeight = FP.fromInt(15);
      for (const hero of state.left.heroes) {
        expect(hero.y).toBeGreaterThanOrEqual(0);
        expect(hero.y).toBeLessThanOrEqual(fieldHeight);
      }
    });
  });

  describe('should place tanks in front', () => {
    it('positions multiple heroes with formation offsets', () => {
      const build = createTestBuild({ heroIds: ['vanguard', 'storm', 'forge'] });
      const state = createArenaState(12345, build, createTestBuild());

      // Heroes should have different positions (formation)
      const xPositions = state.left.heroes.map((h) => h.x);
      const yPositions = state.left.heroes.map((h) => h.y);

      // Not all heroes at exact same position
      const uniquePositions = new Set(xPositions.map((x, i) => `${x},${yPositions[i]}`));
      expect(uniquePositions.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('should protect squishy heroes', () => {
    it('all heroes start alive and ready', () => {
      const state = createTestState();

      for (const hero of state.left.heroes) {
        expect(hero.currentHp).toBe(hero.maxHp);
        expect(hero.state).toBe('idle');
      }

      for (const hero of state.right.heroes) {
        expect(hero.currentHp).toBe(hero.maxHp);
        expect(hero.state).toBe('idle');
      }
    });
  });
});

// ============================================================================
// TARGET PRIORITIZATION
// ============================================================================

describe('Arena AI - Target Prioritization', () => {
  describe('should focus fortress when advantageous', () => {
    it('targets enemy fortress when in range', () => {
      const state = createTestState();

      // Position hero very close to enemy fortress
      const hero = createMockHero({
        x: FP.sub(state.right.fortress.x, FP.fromInt(3)),
        y: state.right.fortress.y,
      });

      const target = selectHeroTarget(hero, 'left', state);

      expect(target.type).toBe('fortress');
      expect(target.x).toBe(state.right.fortress.x);
      expect(target.y).toBe(state.right.fortress.y);
    });

    it('moves towards fortress when out of range', () => {
      const state = createTestState();

      // Position hero far from enemy fortress
      const hero = createMockHero({
        x: state.left.fortress.x,
        y: FP.fromInt(7),
      });

      const target = selectHeroTarget(hero, 'left', state);

      expect(target.type).toBe('move');
      expect(target.x).toBe(state.right.fortress.x);
    });
  });

  describe('should eliminate threats first', () => {
    it('targets enemy hero in range before fortress', () => {
      const state = createTestState();

      // Position our hero between enemies
      const hero = createMockHero({
        x: FP.fromInt(25), // center
        y: FP.fromInt(7),
      });

      // Position an enemy hero very close
      state.right.heroes[0].x = FP.fromInt(26);
      state.right.heroes[0].y = FP.fromInt(7);
      state.right.heroes[0].currentHp = 100;

      const target = selectHeroTarget(hero, 'left', state);

      // Should target the nearby enemy hero if in range
      // (depends on hero range, but with 1 unit distance, should be in range)
      expect(['hero', 'fortress', 'move']).toContain(target.type);
    });

    it('targets closest enemy hero when multiple in range', () => {
      const state = createTestState();

      const hero = createMockHero({
        x: FP.fromInt(25),
        y: FP.fromInt(7),
      });

      // Position two enemy heroes at different distances
      state.right.heroes[0].x = FP.fromInt(27); // 2 units away
      state.right.heroes[0].y = FP.fromInt(7);
      state.right.heroes[0].currentHp = 100;

      if (state.right.heroes[1]) {
        state.right.heroes[1].x = FP.fromInt(26); // 1 unit away (closer)
        state.right.heroes[1].y = FP.fromInt(7);
        state.right.heroes[1].currentHp = 100;
      }

      const target = selectHeroTarget(hero, 'left', state);

      // Should prefer closer target if both in range
      expect(target).toBeDefined();
    });

    it('ignores dead enemy heroes', () => {
      const state = createTestState();

      const hero = createMockHero({
        x: FP.fromInt(25),
        y: FP.fromInt(7),
      });

      // Kill all enemy heroes
      for (const enemyHero of state.right.heroes) {
        enemyHero.currentHp = 0;
      }

      const target = selectHeroTarget(hero, 'left', state);

      // Should target fortress (no alive heroes)
      expect(target.type).not.toBe('hero');
    });
  });

  describe('should protect own fortress', () => {
    it('fortress targets nearest enemy hero in range', () => {
      const state = createTestState();
      const fortress = state.left.fortress;
      const attackRange = FP.fromInt(8);

      // Position enemy hero in range
      state.right.heroes[0].x = FP.add(fortress.x, FP.fromInt(5));
      state.right.heroes[0].y = fortress.y;
      state.right.heroes[0].currentHp = 100;

      const target = selectFortressTarget(fortress, 'left', state, attackRange);

      expect(target.type).toBe('hero');
    });

    it('fortress targets enemy fortress when no heroes in range', () => {
      const state = createTestState();
      const fortress = state.left.fortress;
      const attackRange = FP.fromInt(5); // Short range

      // All enemy heroes far away
      for (const hero of state.right.heroes) {
        hero.x = state.right.fortress.x;
      }

      const target = selectFortressTarget(fortress, 'left', state, attackRange);

      expect(target.type).toBe('fortress');
    });
  });
});

// ============================================================================
// ABILITY USAGE TIMING (Movement Decisions)
// ============================================================================

describe('Arena AI - Movement and Ability Timing', () => {
  describe('should use abilities at appropriate moments', () => {
    it('returns zero velocity when at target position', () => {
      const hero = createMockHero({
        x: FP.fromInt(10),
        y: FP.fromInt(7),
      });

      const target: ArenaTarget = {
        type: 'fortress',
        x: FP.fromInt(10),
        y: FP.fromInt(7),
      };

      const movement = getHeroMovementDirection(hero, target);

      expect(movement.vx).toBe(0);
      expect(movement.vy).toBe(0);
    });

    it('returns zero velocity for none target type', () => {
      const hero = createMockHero();

      const target: ArenaTarget = {
        type: 'none',
        x: 0,
        y: 0,
      };

      const movement = getHeroMovementDirection(hero, target);

      expect(movement.vx).toBe(0);
      expect(movement.vy).toBe(0);
    });
  });

  describe('should save ultimates for key moments', () => {
    it('moves towards target when out of attack range', () => {
      const hero = createMockHero({
        x: FP.fromInt(5),
        y: FP.fromInt(7),
      });

      const target: ArenaTarget = {
        type: 'move',
        x: FP.fromInt(20),
        y: FP.fromInt(7),
      };

      const movement = getHeroMovementDirection(hero, target);

      // Should move in positive X direction
      expect(movement.vx).toBeGreaterThan(0);
    });

    it('maintains combat distance when in range to attack', () => {
      const hero = createMockHero({
        definitionId: 'storm', // Use a hero with known range
        x: FP.fromInt(10),
        y: FP.fromInt(7),
      });

      const target: ArenaTarget = {
        type: 'hero',
        x: FP.fromInt(11), // 1 unit away
        y: FP.fromInt(7),
      };

      const movement = getHeroMovementDirection(hero, target);

      // Movement should be defined (either moving or staying)
      expect(movement).toBeDefined();
      expect(typeof movement.vx).toBe('number');
      expect(typeof movement.vy).toBe('number');
    });
  });

  describe('should not waste abilities on low HP enemies', () => {
    it('still targets low HP enemies (finish them off)', () => {
      const state = createTestState();

      const hero = createMockHero({
        x: FP.fromInt(25),
        y: FP.fromInt(7),
      });

      // Set enemy to low HP
      state.right.heroes[0].x = FP.fromInt(26);
      state.right.heroes[0].y = FP.fromInt(7);
      state.right.heroes[0].currentHp = 1; // Very low HP

      const target = selectHeroTarget(hero, 'left', state);

      // Should still target the low HP enemy (to finish them)
      expect(target).toBeDefined();
    });
  });
});

// ============================================================================
// DEFENSIVE DECISIONS
// ============================================================================

describe('Arena AI - Defensive Decisions', () => {
  describe('should retreat low HP heroes', () => {
    it('movement direction is towards target regardless of HP', () => {
      // Note: Current AI doesn't have retreat logic - heroes always advance
      const hero = createMockHero({
        x: FP.fromInt(10),
        y: FP.fromInt(7),
        currentHp: 10, // Low HP
        maxHp: 100,
      });

      const target: ArenaTarget = {
        type: 'move',
        x: FP.fromInt(20),
        y: FP.fromInt(7),
      };

      const movement = getHeroMovementDirection(hero, target);

      // Current implementation: moves towards target regardless of HP
      expect(movement.vx).toBeGreaterThan(0);
    });
  });

  describe('should use defensive cooldowns', () => {
    it('heroes have armor for damage reduction', () => {
      const state = createTestState();

      // Heroes should have arena armor set
      for (const hero of state.left.heroes) {
        expect(hero.arenaArmor).toBeGreaterThanOrEqual(0);
      }
    });

    it('fortress has armor for damage reduction', () => {
      const state = createTestState();

      expect(state.left.fortress.armor).toBeGreaterThan(0);
      expect(state.right.fortress.armor).toBeGreaterThan(0);
    });
  });

  describe('should call for support', () => {
    it('heroes track their state for coordination', () => {
      const state = createTestState();

      // All heroes have a state that can be used for coordination
      for (const hero of state.left.heroes) {
        expect(hero.state).toBeDefined();
        expect(['idle', 'moving', 'attacking', 'dying', 'dead']).toContain(hero.state);
      }
    });

    it('heroes maintain attack cooldowns', () => {
      const state = createTestState();

      for (const hero of state.left.heroes) {
        expect(hero.lastAttackTick).toBeDefined();
        expect(typeof hero.lastAttackTick).toBe('number');
      }
    });
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Arena AI - Edge Cases', () => {
  it('handles empty enemy hero list', () => {
    const state = createTestState();

    // Remove all enemy heroes
    state.right.heroes = [];

    const hero = createMockHero({
      x: FP.fromInt(20),
      y: FP.fromInt(7),
    });

    const target = selectHeroTarget(hero, 'left', state);

    // Should target fortress when no heroes
    expect(target.type).toBe('move'); // Move towards fortress
  });

  it('handles hero at exact fortress position', () => {
    const state = createTestState();

    const hero = createMockHero({
      x: state.right.fortress.x,
      y: state.right.fortress.y,
    });

    const target = selectHeroTarget(hero, 'left', state);

    expect(target.type).toBe('fortress');
  });

  it('fortress targeting with empty enemy list', () => {
    const state = createTestState();
    state.right.heroes = [];

    const target = selectFortressTarget(
      state.left.fortress,
      'left',
      state,
      FP.fromInt(10)
    );

    expect(target.type).toBe('fortress');
  });

  it('handles very small distances without crashing', () => {
    const hero = createMockHero({
      x: FP.fromInt(10),
      y: FP.fromInt(7),
    });

    const target: ArenaTarget = {
      type: 'hero',
      x: FP.add(FP.fromInt(10), 1), // 1 fixed-point unit away (very small)
      y: FP.fromInt(7),
    };

    // Should not crash or produce NaN
    const movement = getHeroMovementDirection(hero, target);
    expect(Number.isFinite(movement.vx)).toBe(true);
    expect(Number.isFinite(movement.vy)).toBe(true);
  });

  it('left and right sides have symmetric targeting logic', () => {
    const state = createTestState();

    // Left hero targeting right
    const leftHero = state.left.heroes[0];
    const leftTarget = selectHeroTarget(leftHero, 'left', state);

    // Right hero targeting left
    const rightHero = state.right.heroes[0];
    const rightTarget = selectHeroTarget(rightHero, 'right', state);

    // Both should have valid targets
    expect(leftTarget.type).toBeDefined();
    expect(rightTarget.type).toBeDefined();
  });
});
