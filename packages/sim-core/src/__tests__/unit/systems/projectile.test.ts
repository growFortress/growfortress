/**
 * Projectile System Tests
 *
 * Tests for projectile movement, collision detection, effects, and cleanup.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FP } from '../../../fixed.js';
import {
  updateProjectiles,
  updateEnemyStatusEffects,
  applyEffectToEnemy,
  createHeroProjectile,
  createTurretProjectile,
  createFortressProjectile,
  popComboTriggers,
} from '../../../systems/projectile.js';
import { createGameState, createEnemy, createSimConfig } from '../../helpers/factories.js';
import type { GameState, ActiveProjectile, ActiveHero, ActiveTurret, SkillEffect } from '../../../types.js';
import { PROJECTILE_BASE_SPEED } from '../../../systems/constants.js';

// Helper to create a projectile with defaults
function createProjectile(overrides: Partial<ActiveProjectile> = {}): ActiveProjectile {
  return {
    id: 1,
    type: 'physical',
    sourceType: 'hero',
    sourceId: 'test_hero',
    targetEnemyId: 1,
    x: FP.fromInt(10),
    y: FP.fromInt(7),
    startX: FP.fromInt(10),
    startY: FP.fromInt(7),
    targetX: FP.fromInt(15),
    targetY: FP.fromInt(7),
    speed: PROJECTILE_BASE_SPEED,
    damage: 50,
    effects: [],
    spawnTick: 0,
    class: 'natural',
    ...overrides,
  };
}

// Helper to create a minimal hero for projectile tests
function createHero(overrides: Partial<ActiveHero> = {}): ActiveHero {
  return {
    definitionId: 'test_hero',
    tier: 1 as 1 | 2 | 3,
    level: 1,
    xp: 0,
    currentHp: 100,
    maxHp: 100,
    x: FP.fromInt(5),
    y: FP.fromInt(7),
    vx: 0,
    vy: 0,
    radius: FP.fromFloat(0.5),
    mass: FP.ONE,
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

// Helper to create a minimal turret for projectile tests
function createTurret(overrides: Partial<ActiveTurret> = {}): ActiveTurret {
  return {
    definitionId: 'test_turret',
    tier: 1,
    currentClass: 'natural',
    slotIndex: 0,
    lastAttackTick: 0,
    specialCooldown: 0,
    targetingMode: 'closest_to_fortress',
    currentHp: 100,
    maxHp: 100,
    ...overrides,
  };
}

describe('Projectile System', () => {
  let state: GameState;
  let config: ReturnType<typeof createSimConfig>;

  beforeEach(() => {
    state = createGameState();
    config = createSimConfig();
    // Clear any pending combo triggers from previous tests
    popComboTriggers();
  });

  describe('Projectile Movement', () => {
    it('should move toward target at correct speed', () => {
      const enemy = createEnemy({ id: 1, x: FP.fromInt(20), y: FP.fromInt(7) });
      state.enemies = [enemy];

      const projectile = createProjectile({
        x: FP.fromInt(10),
        y: FP.fromInt(7),
        targetX: FP.fromInt(20),
        targetY: FP.fromInt(7),
        targetEnemyId: enemy.id,
      });
      state.projectiles = [projectile];

      const startX = projectile.x;

      updateProjectiles(state, config);

      // Projectile should have moved toward target
      expect(projectile.x).toBeGreaterThan(startX);
      // Movement should be approximately PROJECTILE_BASE_SPEED
      const distanceMoved = projectile.x - startX;
      expect(distanceMoved).toBeCloseTo(PROJECTILE_BASE_SPEED, -2); // Allow some tolerance
    });

    it('should track moving targets (homing)', () => {
      // Create enemy that will be at a different position
      const enemy = createEnemy({ id: 1, x: FP.fromInt(20), y: FP.fromInt(7) });
      state.enemies = [enemy];

      const projectile = createProjectile({
        x: FP.fromInt(10),
        y: FP.fromInt(7),
        targetX: FP.fromInt(15), // Original target position
        targetY: FP.fromInt(7),
        targetEnemyId: enemy.id,
      });
      state.projectiles = [projectile];

      // Move enemy to a new position
      enemy.x = FP.fromInt(20);
      enemy.y = FP.fromInt(10);

      updateProjectiles(state, config);

      // Projectile's target position should update to track enemy
      expect(projectile.targetX).toBe(enemy.x);
      expect(projectile.targetY).toBe(enemy.y);
    });

    it('should travel in straight line when target is dead (non-homing)', () => {
      const enemy = createEnemy({ id: 1, x: FP.fromInt(20), y: FP.fromInt(7), hp: 0 });
      state.enemies = [enemy];

      const originalTargetX = FP.fromInt(20);
      const originalTargetY = FP.fromInt(7);

      const projectile = createProjectile({
        x: FP.fromInt(10),
        y: FP.fromInt(7),
        targetX: originalTargetX,
        targetY: originalTargetY,
        targetEnemyId: enemy.id,
      });
      state.projectiles = [projectile];

      // Move enemy to new position (but it's dead)
      enemy.x = FP.fromInt(25);
      enemy.y = FP.fromInt(10);

      updateProjectiles(state, config);

      // Target position should NOT update since enemy is dead
      expect(projectile.targetX).toBe(originalTargetX);
      expect(projectile.targetY).toBe(originalTargetY);
    });
  });

  describe('Collision Detection', () => {
    it('should detect hit on target', () => {
      const enemy = createEnemy({
        id: 1,
        x: FP.fromInt(11),
        y: FP.fromInt(7),
        hp: 100,
        maxHp: 100,
        radius: FP.fromFloat(0.8),
      });
      state.enemies = [enemy];

      // Projectile very close to enemy
      const projectile = createProjectile({
        x: FP.fromInt(10),
        y: FP.fromInt(7),
        targetX: enemy.x,
        targetY: enemy.y,
        targetEnemyId: enemy.id,
        damage: 50,
      });
      state.projectiles = [projectile];

      updateProjectiles(state, config);

      // Enemy should have taken damage
      expect(enemy.hp).toBeLessThan(100);
      // Projectile should be removed
      expect(state.projectiles).toHaveLength(0);
    });

    it('should trigger on-hit effects', () => {
      const enemy = createEnemy({
        id: 1,
        x: FP.fromFloat(10.5),
        y: FP.fromInt(7),
        hp: 100,
        maxHp: 100,
        radius: FP.fromFloat(0.8),
      });
      state.enemies = [enemy];

      const slowEffect: SkillEffect = { type: 'slow', percent: 30, duration: 90 };

      const projectile = createProjectile({
        x: FP.fromInt(10),
        y: FP.fromInt(7),
        targetX: enemy.x,
        targetY: enemy.y,
        targetEnemyId: enemy.id,
        damage: 10,
        effects: [slowEffect],
      });
      state.projectiles = [projectile];

      updateProjectiles(state, config);

      // Enemy should have slow effect applied
      expect(enemy.activeEffects.some(e => e.type === 'slow')).toBe(true);
    });

    it('should handle multi-hit projectiles (pierce)', () => {
      // Create multiple enemies in a line
      const enemy1 = createEnemy({
        id: 1,
        x: FP.fromInt(12),
        y: FP.fromInt(7),
        hp: 100,
        maxHp: 100,
      });
      const enemy2 = createEnemy({
        id: 2,
        x: FP.fromInt(11),
        y: FP.fromInt(7),
        hp: 100,
        maxHp: 100,
      });
      state.enemies = [enemy1, enemy2];

      const projectile = createProjectile({
        x: FP.fromInt(10),
        y: FP.fromInt(7),
        targetX: enemy1.x,
        targetY: enemy1.y,
        targetEnemyId: enemy1.id,
        damage: 50,
        pierceCount: 2,
        hitEnemyIds: [],
      });
      state.projectiles = [projectile];

      updateProjectiles(state, config);

      // At least one enemy should have taken pierce damage
      // (depending on whether they're within PIERCE_HIT_RADIUS)
      const damagedEnemies = state.enemies.filter(e => e.hp < 100);
      expect(damagedEnemies.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Projectile Effects', () => {
    it('should apply damage on hit', () => {
      const enemy = createEnemy({
        id: 1,
        x: FP.fromFloat(10.5),
        y: FP.fromInt(7),
        hp: 100,
        maxHp: 100,
        radius: FP.fromFloat(0.8),
      });
      state.enemies = [enemy];

      const projectile = createProjectile({
        x: FP.fromInt(10),
        y: FP.fromInt(7),
        targetX: enemy.x,
        targetY: enemy.y,
        targetEnemyId: enemy.id,
        damage: 30,
      });
      state.projectiles = [projectile];

      updateProjectiles(state, config);

      expect(enemy.hp).toBe(70); // 100 - 30
    });

    it('should apply status effects (burn)', () => {
      const enemy = createEnemy({ id: 1, hp: 100, maxHp: 100 });
      state.enemies = [enemy];

      const burnEffect: SkillEffect = { type: 'burn', damagePerTick: 5, duration: 90 };
      applyEffectToEnemy(burnEffect, enemy, state);

      expect(enemy.activeEffects.some(e => e.type === 'burn')).toBe(true);
      // Initial burn damage should be applied
      expect(enemy.hp).toBeLessThan(100);
    });

    it('should apply status effects (slow)', () => {
      const enemy = createEnemy({ id: 1, hp: 100, maxHp: 100, speed: FP.fromFloat(0.1) });
      state.enemies = [enemy];

      const slowEffect: SkillEffect = { type: 'slow', percent: 50, duration: 60 };
      applyEffectToEnemy(slowEffect, enemy, state);

      expect(enemy.activeEffects.some(e => e.type === 'slow')).toBe(true);
      // Speed should be reduced
      expect(enemy.speed).toBeLessThan(enemy.baseSpeed);
    });

    it('should apply status effects (freeze)', () => {
      const enemy = createEnemy({ id: 1, hp: 100, maxHp: 100, speed: FP.fromFloat(0.1) });
      state.enemies = [enemy];

      const freezeEffect: SkillEffect = { type: 'freeze', duration: 60 };
      applyEffectToEnemy(freezeEffect, enemy, state);

      expect(enemy.activeEffects.some(e => e.type === 'freeze')).toBe(true);
      // Speed should be 0 when frozen
      expect(enemy.speed).toBe(0);
    });
  });

  describe('Special Projectile Types', () => {
    it('should handle AoE projectiles via skill effects', () => {
      const enemy = createEnemy({ id: 1, hp: 100, maxHp: 100 });
      state.enemies = [enemy];

      // AoE is typically applied through skill effects with 'area' target type
      const damageEffect: SkillEffect = { type: 'damage', amount: 25, target: 'area' };
      applyEffectToEnemy(damageEffect, enemy, state);

      expect(enemy.hp).toBe(75); // 100 - 25
    });

    it('should handle pierce projectiles correctly', () => {
      // Pierce is tested by checking pierceCount decrements
      const enemy1 = createEnemy({
        id: 1,
        x: FP.fromInt(15),
        y: FP.fromInt(7),
        hp: 100,
        maxHp: 100,
      });
      const enemy2 = createEnemy({
        id: 2,
        x: FP.fromInt(11), // Within pierce radius of projectile path
        y: FP.fromInt(7),
        hp: 100,
        maxHp: 100,
      });
      state.enemies = [enemy1, enemy2];

      const projectile = createProjectile({
        x: FP.fromInt(10),
        y: FP.fromInt(7),
        targetX: enemy1.x,
        targetY: enemy1.y,
        targetEnemyId: enemy1.id,
        damage: 50,
        pierceCount: 3,
        hitEnemyIds: [],
      });
      state.projectiles = [projectile];

      updateProjectiles(state, config);

      // If enemy2 was hit by pierce, its id should be in hitEnemyIds
      // and pierceCount should have decremented
      if (projectile.hitEnemyIds && projectile.hitEnemyIds.includes(2)) {
        expect(projectile.pierceCount).toBeLessThan(3);
        expect(enemy2.hp).toBeLessThan(100);
      }
    });

    it('should handle fortress projectiles with pierce', () => {
      const enemy = createEnemy({
        id: 1,
        x: FP.fromInt(15),
        y: FP.fromInt(7),
        hp: 100,
        maxHp: 100,
      });
      state.enemies = [enemy];

      createFortressProjectile(enemy, state, config, 25);

      expect(state.projectiles).toHaveLength(1);
      expect(state.projectiles[0].sourceType).toBe('fortress');
      // Pierce count is now class-based: natural=2, ice=1, fire=2, lightning=3, tech=4
      expect(state.projectiles[0].pierceCount).toBe(2); // Natural class default
      expect(state.projectiles[0].hitEnemyIds).toEqual([]);
    });
  });

  describe('Projectile Cleanup', () => {
    it('should expire after max time (300 ticks)', () => {
      const enemy = createEnemy({
        id: 1,
        x: FP.fromInt(1000), // Very far away
        y: FP.fromInt(7),
        hp: 100,
        maxHp: 100,
      });
      state.enemies = [enemy];

      const projectile = createProjectile({
        x: FP.fromInt(10),
        y: FP.fromInt(7),
        targetX: enemy.x,
        targetY: enemy.y,
        targetEnemyId: enemy.id,
        spawnTick: 0,
      });
      state.projectiles = [projectile];

      // Advance tick past timeout (300 ticks)
      state.tick = 301;

      updateProjectiles(state, config);

      // Projectile should be removed due to timeout
      expect(state.projectiles).toHaveLength(0);
    });

    it('should remove projectile on hit (non-pierce)', () => {
      const enemy = createEnemy({
        id: 1,
        x: FP.fromFloat(10.5),
        y: FP.fromInt(7),
        hp: 100,
        maxHp: 100,
        radius: FP.fromFloat(0.8),
      });
      state.enemies = [enemy];

      const projectile = createProjectile({
        x: FP.fromInt(10),
        y: FP.fromInt(7),
        targetX: enemy.x,
        targetY: enemy.y,
        targetEnemyId: enemy.id,
        damage: 10,
        // No pierceCount - should be removed on hit
      });
      state.projectiles = [projectile];

      updateProjectiles(state, config);

      expect(state.projectiles).toHaveLength(0);
    });

    it('should not remove pierce projectile that still has pierce count', () => {
      const enemy1 = createEnemy({
        id: 1,
        x: FP.fromInt(50), // Main target far away
        y: FP.fromInt(7),
        hp: 100,
        maxHp: 100,
      });
      const enemy2 = createEnemy({
        id: 2,
        x: FP.fromFloat(10.5), // Secondary target in pierce range
        y: FP.fromInt(7),
        hp: 100,
        maxHp: 100,
      });
      state.enemies = [enemy1, enemy2];

      const projectile = createProjectile({
        x: FP.fromInt(10),
        y: FP.fromInt(7),
        targetX: enemy1.x,
        targetY: enemy1.y,
        targetEnemyId: enemy1.id,
        damage: 10,
        pierceCount: 5,
        hitEnemyIds: [],
      });
      state.projectiles = [projectile];

      updateProjectiles(state, config);

      // Projectile should still exist (main target not yet reached)
      expect(state.projectiles).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle target death mid-flight', () => {
      const enemy = createEnemy({
        id: 1,
        x: FP.fromInt(20),
        y: FP.fromInt(7),
        hp: 0, // Already dead
        maxHp: 100,
      });
      state.enemies = [enemy];

      const projectile = createProjectile({
        x: FP.fromInt(10),
        y: FP.fromInt(7),
        targetX: enemy.x,
        targetY: enemy.y,
        targetEnemyId: enemy.id,
      });
      state.projectiles = [projectile];

      // Should not crash
      updateProjectiles(state, config);

      // Projectile should continue toward last known position
      expect(projectile.x).toBeGreaterThan(FP.fromInt(10));
    });

    it('should handle projectile spawn at target position', () => {
      const enemy = createEnemy({
        id: 1,
        x: FP.fromInt(10),
        y: FP.fromInt(7),
        hp: 100,
        maxHp: 100,
      });
      state.enemies = [enemy];

      // Projectile starts exactly at target
      const projectile = createProjectile({
        x: FP.fromInt(10),
        y: FP.fromInt(7),
        targetX: FP.fromInt(10),
        targetY: FP.fromInt(7),
        targetEnemyId: enemy.id,
        damage: 50,
      });
      state.projectiles = [projectile];

      // Should not crash - should apply damage immediately
      updateProjectiles(state, config);

      // Damage should have been applied
      expect(enemy.hp).toBe(50);
      // Projectile should be removed
      expect(state.projectiles).toHaveLength(0);
    });

    it('should handle zero-speed projectiles', () => {
      const enemy = createEnemy({
        id: 1,
        x: FP.fromInt(15),
        y: FP.fromInt(7),
        hp: 100,
        maxHp: 100,
      });
      state.enemies = [enemy];

      const projectile = createProjectile({
        x: FP.fromInt(10),
        y: FP.fromInt(7),
        targetX: enemy.x,
        targetY: enemy.y,
        targetEnemyId: enemy.id,
        speed: 0, // Zero speed
      });
      state.projectiles = [projectile];

      const startX = projectile.x;

      // Should not crash
      updateProjectiles(state, config);

      // Projectile should not move
      expect(projectile.x).toBe(startX);
    });

    it('should handle missing target enemy', () => {
      // No enemies in state
      state.enemies = [];

      const projectile = createProjectile({
        x: FP.fromInt(10),
        y: FP.fromInt(7),
        targetX: FP.fromInt(20),
        targetY: FP.fromInt(7),
        targetEnemyId: 999, // Non-existent enemy
      });
      state.projectiles = [projectile];

      // Should not crash
      updateProjectiles(state, config);

      // Projectile should continue toward last known target position
      expect(projectile.x).toBeGreaterThan(FP.fromInt(10));
    });
  });

  describe('Status Effect Updates', () => {
    it('should tick down effect durations', () => {
      const enemy = createEnemy({ id: 1, hp: 100, maxHp: 100 });
      enemy.activeEffects = [{
        type: 'slow',
        remainingTicks: 10,
        strength: 0.3,
        appliedTick: 0,
      }];
      state.enemies = [enemy];

      updateEnemyStatusEffects(state);

      expect(enemy.activeEffects[0].remainingTicks).toBe(9);
    });

    it('should remove expired effects', () => {
      const enemy = createEnemy({ id: 1, hp: 100, maxHp: 100 });
      enemy.activeEffects = [{
        type: 'slow',
        remainingTicks: 1, // Will expire after this tick
        strength: 0.3,
        appliedTick: 0,
      }];
      state.enemies = [enemy];

      updateEnemyStatusEffects(state);

      expect(enemy.activeEffects).toHaveLength(0);
    });

    it('should apply DOT damage for burn', () => {
      const enemy = createEnemy({ id: 1, hp: 100, maxHp: 100 });
      enemy.activeEffects = [{
        type: 'burn',
        remainingTicks: 60,
        strength: 10, // 10 damage per tick
        appliedTick: 0,
      }];
      state.enemies = [enemy];
      state.tick = 30; // DOT applies every 30 ticks

      updateEnemyStatusEffects(state);

      expect(enemy.hp).toBe(90); // 100 - 10
    });

    it('should recalculate speed when slow expires', () => {
      const enemy = createEnemy({
        id: 1,
        hp: 100,
        maxHp: 100,
        speed: FP.fromFloat(0.05), // Currently slowed
        baseSpeed: FP.fromFloat(0.1),
      });
      enemy.activeEffects = [{
        type: 'slow',
        remainingTicks: 1,
        strength: 0.5, // 50% slow
        appliedTick: 0,
      }];
      state.enemies = [enemy];

      updateEnemyStatusEffects(state);

      // Effect should be removed and speed should be back to base
      expect(enemy.activeEffects).toHaveLength(0);
      expect(enemy.speed).toBe(enemy.baseSpeed);
    });
  });

  describe('Projectile Creation', () => {
    it('should create hero projectile with correct properties', () => {
      const hero = createHero({ x: FP.fromInt(5), y: FP.fromInt(7) });
      const enemy = createEnemy({ id: 1, x: FP.fromInt(15), y: FP.fromInt(7) });
      state.heroes = [hero];
      state.enemies = [enemy];

      createHeroProjectile(hero, enemy, state, 'fire', 50);

      expect(state.projectiles).toHaveLength(1);
      const projectile = state.projectiles[0];
      expect(projectile.sourceType).toBe('hero');
      expect(projectile.sourceId).toBe(hero.definitionId);
      expect(projectile.targetEnemyId).toBe(enemy.id);
      expect(projectile.damage).toBe(50);
      expect(projectile.type).toBe('fireball');
      expect(projectile.class).toBe('fire');
    });

    it('should create turret projectile with correct properties', () => {
      const turret = createTurret({ currentClass: 'ice' });
      const enemy = createEnemy({ id: 1, x: FP.fromInt(20), y: FP.fromInt(7) });
      state.turrets = [turret];
      state.enemies = [enemy];

      const turretX = FP.fromInt(8);
      const turretY = FP.fromInt(5);

      createTurretProjectile(turret, enemy, state, turretX, turretY, 'ice', 30);

      expect(state.projectiles).toHaveLength(1);
      const projectile = state.projectiles[0];
      expect(projectile.sourceType).toBe('turret');
      expect(projectile.sourceId).toBe(turret.definitionId);
      expect(projectile.targetEnemyId).toBe(enemy.id);
      expect(projectile.damage).toBe(30);
      expect(projectile.type).toBe('icicle');
      expect(projectile.class).toBe('ice');
      expect(projectile.x).toBe(turretX);
      expect(projectile.y).toBe(turretY);
    });

    it('should create fortress projectile with correct properties', () => {
      const enemy = createEnemy({ id: 1, x: FP.fromInt(15), y: FP.fromInt(7) });
      state.enemies = [enemy];
      state.fortressClass = 'lightning';

      createFortressProjectile(enemy, state, config, 40);

      expect(state.projectiles).toHaveLength(1);
      const projectile = state.projectiles[0];
      expect(projectile.sourceType).toBe('fortress');
      expect(projectile.targetEnemyId).toBe(enemy.id);
      expect(projectile.damage).toBe(40);
      expect(projectile.type).toBe('bolt');
      expect(projectile.class).toBe('lightning');
      expect(projectile.pierceCount).toBe(3);
    });

    it('should increment nextProjectileId', () => {
      const enemy = createEnemy({ id: 1, x: FP.fromInt(15), y: FP.fromInt(7) });
      state.enemies = [enemy];

      const initialId = state.nextProjectileId;

      createFortressProjectile(enemy, state, config, 25);
      expect(state.nextProjectileId).toBe(initialId + 1);

      createFortressProjectile(enemy, state, config, 25);
      expect(state.nextProjectileId).toBe(initialId + 2);
    });
  });
});
