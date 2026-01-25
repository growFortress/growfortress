import { describe, it, expect } from 'vitest';
import { FP } from '../../../fixed.js';
import {
  updateTurrets,
  activateTurretOvercharge,
  setTurretTargetingMode,
  initializeTurrets,
  getTurretSynergyBonus,
  calculateTurretAdjacencyBonuses,
} from '../../../systems.js';
import {
  getTurretById,
  calculateTurretStats,
  calculateTurretCost,
  calculateTurretHp,
  TURRET_SLOTS,
} from '../../../data/turrets.js';
import { createGameState, createEnemy, createSimConfig } from '../../helpers/factories.js';
import type { ActiveTurret, Enemy } from '../../../types.js';
import { Xorshift32 } from '../../../rng.js';

// Turret stats use scale 16384 = 1.0 (not 65536 like FP.toFloat)
const TURRET_STAT_BASE = 16384;
const toStatFloat = (value: number) => value / TURRET_STAT_BASE;

// Helper to create a turret for testing
function createTestTurret(overrides: Partial<ActiveTurret> = {}): ActiveTurret {
  return {
    definitionId: 'railgun',
    tier: 1,
    currentClass: 'natural',
    slotIndex: 1,
    lastAttackTick: -1000,
    specialCooldown: 0,
    targetingMode: 'closest_to_fortress',
    currentHp: 150,
    maxHp: 150,
    ...overrides,
  };
}

// Helper to create an enemy at specific position
function createEnemyAtPosition(id: number, x: number, y: number, hp: number = 100): Enemy {
  return createEnemy({
    id,
    x: FP.fromFloat(x),
    y: FP.fromFloat(y),
    hp,
    maxHp: hp,
    speed: FP.fromFloat(0.1),
    baseSpeed: FP.fromFloat(0.1),
  });
}

// ============================================================================
// TEST 1: TARGETING MODES
// ============================================================================

describe('Turret Targeting Modes', () => {
  it('should target closest to fortress (lowest X) by default', () => {
    const config = createSimConfig();
    const state = createGameState({
      turrets: [createTestTurret({ slotIndex: 1, lastAttackTick: -100 })],
      enemies: [
        createEnemyAtPosition(1, 20, 7), // Far from fortress
        createEnemyAtPosition(2, 10, 7), // Closest to fortress (lowest X)
        createEnemyAtPosition(3, 15, 7), // Middle distance
      ],
    });

    const rng = new Xorshift32(12345);
    updateTurrets(state, config, rng);

    // Check that a projectile was created targeting closest enemy
    expect(state.projectiles.length).toBeGreaterThan(0);
    const projectile = state.projectiles[0];
    expect(projectile.targetEnemyId).toBe(2); // Enemy at x=10 is closest to fortress
  });

  it('should target weakest enemy when mode is weakest', () => {
    const config = createSimConfig();
    const state = createGameState({
      turrets: [createTestTurret({ slotIndex: 1, targetingMode: 'weakest', lastAttackTick: -100 })],
      enemies: [
        createEnemyAtPosition(1, 12, 7, 100), // High HP
        createEnemyAtPosition(2, 12, 6, 25),  // Lowest HP (weakest)
        createEnemyAtPosition(3, 12, 8, 50),  // Medium HP
      ],
    });

    const rng = new Xorshift32(12345);
    updateTurrets(state, config, rng);

    expect(state.projectiles.length).toBeGreaterThan(0);
    const projectile = state.projectiles[0];
    expect(projectile.targetEnemyId).toBe(2); // Enemy with 25 HP is weakest
  });

  it('should target strongest enemy when mode is strongest', () => {
    const config = createSimConfig();
    const state = createGameState({
      turrets: [createTestTurret({ slotIndex: 1, targetingMode: 'strongest', lastAttackTick: -100 })],
      enemies: [
        createEnemyAtPosition(1, 12, 7, 50),  // Medium HP
        createEnemyAtPosition(2, 12, 6, 200), // Highest HP (strongest)
        createEnemyAtPosition(3, 12, 8, 75),  // Lower HP
      ],
    });

    const rng = new Xorshift32(12345);
    updateTurrets(state, config, rng);

    expect(state.projectiles.length).toBeGreaterThan(0);
    const projectile = state.projectiles[0];
    expect(projectile.targetEnemyId).toBe(2); // Enemy with 200 HP is strongest
  });

  it('should target nearest to turret when mode is nearest_to_turret', () => {
    const config = createSimConfig();
    // Turret slot 1 is at offsetX: 4, offsetY: -3 from fortress
    // Fortress is at x=2, so turret is around x=6, y=4
    const state = createGameState({
      turrets: [createTestTurret({ slotIndex: 1, targetingMode: 'nearest_to_turret', lastAttackTick: -100 })],
      enemies: [
        createEnemyAtPosition(1, 20, 7, 100), // Far from turret
        createEnemyAtPosition(2, 8, 5, 100),  // Closer to turret position
        createEnemyAtPosition(3, 15, 10, 100), // Far from turret
      ],
    });

    const rng = new Xorshift32(12345);
    updateTurrets(state, config, rng);

    expect(state.projectiles.length).toBeGreaterThan(0);
    const projectile = state.projectiles[0];
    expect(projectile.targetEnemyId).toBe(2); // Enemy at (8,5) is closest to turret at ~(6,4)
  });

  it('should target fastest enemy when mode is fastest', () => {
    const config = createSimConfig();
    const state = createGameState({
      turrets: [createTestTurret({ slotIndex: 1, targetingMode: 'fastest', lastAttackTick: -100 })],
      enemies: [
        createEnemy({ id: 1, x: FP.fromFloat(12), y: FP.fromFloat(7), baseSpeed: FP.fromFloat(0.1) }),
        createEnemy({ id: 2, x: FP.fromFloat(12), y: FP.fromFloat(6), baseSpeed: FP.fromFloat(0.5) }), // Fastest
        createEnemy({ id: 3, x: FP.fromFloat(12), y: FP.fromFloat(8), baseSpeed: FP.fromFloat(0.2) }),
      ],
    });

    const rng = new Xorshift32(12345);
    updateTurrets(state, config, rng);

    expect(state.projectiles.length).toBeGreaterThan(0);
    const projectile = state.projectiles[0];
    expect(projectile.targetEnemyId).toBe(2); // Enemy with speed 0.5 is fastest
  });

  it('should change targeting mode via setTurretTargetingMode', () => {
    const state = createGameState({
      turrets: [createTestTurret({ slotIndex: 1, targetingMode: 'closest_to_fortress' })],
    });

    const result = setTurretTargetingMode(state, 1, 'weakest');
    expect(result).toBe(true);
    expect(state.turrets[0].targetingMode).toBe('weakest');
  });

  it('should return false when setting targeting mode on non-existent turret', () => {
    const state = createGameState({
      turrets: [createTestTurret({ slotIndex: 1 })],
    });

    const result = setTurretTargetingMode(state, 99, 'weakest');
    expect(result).toBe(false);
  });
});

// ============================================================================
// TEST 2: TURRET ABILITIES
// ============================================================================

describe('Turret Abilities', () => {
  it('should trigger ability when cooldown reaches zero', () => {
    const config = createSimConfig();
    const state = createGameState({
      turrets: [createTestTurret({
        slotIndex: 1,
        specialCooldown: 1, // About to be ready
        lastAttackTick: -100,
      })],
      enemies: [createEnemyAtPosition(1, 10, 7, 100)],
    });

    const rng = new Xorshift32(12345);

    // First tick - cooldown decreases to 0
    updateTurrets(state, config, rng);
    expect(state.turrets[0].specialCooldown).toBe(0);

    // Ability should trigger on next update when cooldown is 0
    updateTurrets(state, config, rng);

    // Cooldown should be reset to ability cooldown value
    const turretDef = getTurretById('railgun');
    expect(state.turrets[0].specialCooldown).toBe(turretDef!.ability.cooldown);
  });

  it('should apply damage boost ability effect (railgun)', () => {
    const config = createSimConfig();
    const state = createGameState({
      tick: 100,
      turrets: [createTestTurret({
        slotIndex: 1,
        definitionId: 'railgun',
        specialCooldown: 0, // Ready to use ability
        lastAttackTick: -100,
      })],
      enemies: [createEnemyAtPosition(1, 10, 7, 100)],
    });

    const rng = new Xorshift32(12345);
    updateTurrets(state, config, rng);

    // Railgun's ability is damage_boost, should set damageBoostMultiplier
    expect(state.turrets[0].damageBoostMultiplier).toBeDefined();
    expect(state.turrets[0].damageBoostExpiresTick).toBeGreaterThan(state.tick);
  });

  it('should respect turret range limits', () => {
    const config = createSimConfig();
    // Railgun has range of 10 units
    const state = createGameState({
      turrets: [createTestTurret({ slotIndex: 1, lastAttackTick: -100 })],
      enemies: [
        createEnemyAtPosition(1, 50, 7, 100), // Way out of range (50 units from fortress)
      ],
    });

    const rng = new Xorshift32(12345);
    updateTurrets(state, config, rng);

    // No projectiles should be created since enemy is out of range
    expect(state.projectiles.length).toBe(0);
  });

  it('should attack enemies within range', () => {
    const config = createSimConfig();
    const state = createGameState({
      turrets: [createTestTurret({ slotIndex: 1, lastAttackTick: -100 })],
      enemies: [
        createEnemyAtPosition(1, 10, 7, 100), // Within range
      ],
    });

    const rng = new Xorshift32(12345);
    updateTurrets(state, config, rng);

    // Projectile should be created
    expect(state.projectiles.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// TEST 3: TURRET STATS
// ============================================================================

describe('Turret Stats', () => {
  it('should calculate DPS correctly for railgun', () => {
    const railgun = getTurretById('railgun')!;
    const stats = calculateTurretStats(railgun, 'natural', 1);

    // Railgun: damage 8.0, attackSpeed 2.5 = 20 DPS
    const damage = toStatFloat(stats.damage);
    const attackSpeed = toStatFloat(stats.attackSpeed);
    const dps = damage * attackSpeed;

    expect(dps).toBeCloseTo(20, 0); // 8 damage * 2.5 attacks/sec = 20 DPS
  });

  it('should calculate DPS correctly for artillery', () => {
    const artillery = getTurretById('artillery')!;
    const stats = calculateTurretStats(artillery, 'natural', 1);

    // Artillery: damage 45.0, attackSpeed 0.5 = 22.5 DPS
    const damage = toStatFloat(stats.damage);
    const attackSpeed = toStatFloat(stats.attackSpeed);
    const dps = damage * attackSpeed;

    expect(dps).toBeCloseTo(22.5, 0); // 45 damage * 0.5 attacks/sec = 22.5 DPS
  });

  it('should apply tier bonuses to stats (tier 1, 2, 3)', () => {
    const railgun = getTurretById('railgun')!;

    const tier1Stats = calculateTurretStats(railgun, 'natural', 1);
    const tier2Stats = calculateTurretStats(railgun, 'natural', 2);
    const tier3Stats = calculateTurretStats(railgun, 'natural', 3);

    // Tier scaling: 1.0, 1.25, 1.5
    expect(toStatFloat(tier2Stats.damage)).toBeCloseTo(toStatFloat(tier1Stats.damage) * 1.25, 0);
    expect(toStatFloat(tier3Stats.damage)).toBeCloseTo(toStatFloat(tier1Stats.damage) * 1.5, 0);
  });

  it('should apply fire class damage bonus', () => {
    const railgun = getTurretById('railgun')!;

    const naturalStats = calculateTurretStats(railgun, 'natural', 1);
    const fireStats = calculateTurretStats(railgun, 'fire', 1);

    // Fire class has 1.2x damage multiplier
    expect(toStatFloat(fireStats.damage)).toBeCloseTo(toStatFloat(naturalStats.damage) * 1.2, 0);
  });

  it('should apply lightning class attack speed bonus', () => {
    const railgun = getTurretById('railgun')!;

    const naturalStats = calculateTurretStats(railgun, 'natural', 1);
    const lightningStats = calculateTurretStats(railgun, 'lightning', 1);

    // Lightning class has 1.3x attack speed multiplier
    expect(toStatFloat(lightningStats.attackSpeed)).toBeCloseTo(toStatFloat(naturalStats.attackSpeed) * 1.3, 0);
  });

  it('should apply tech class range bonus', () => {
    const railgun = getTurretById('railgun')!;

    const naturalStats = calculateTurretStats(railgun, 'natural', 1);
    const techStats = calculateTurretStats(railgun, 'tech', 1);

    // Tech class has 1.2x range multiplier
    expect(toStatFloat(techStats.range)).toBeCloseTo(toStatFloat(naturalStats.range) * 1.2, 0);
  });

  it('should calculate HP based on tier', () => {
    const railgun = getTurretById('railgun')!;

    const tier1Hp = calculateTurretHp(railgun, 1);
    const tier2Hp = calculateTurretHp(railgun, 2);
    const tier3Hp = calculateTurretHp(railgun, 3);

    expect(tier1Hp).toBe(150); // Base HP
    expect(tier2Hp).toBe(Math.floor(150 * 1.25)); // 1.25x
    expect(tier3Hp).toBe(Math.floor(150 * 1.5)); // 1.5x
  });
});

// ============================================================================
// TEST 4: TURRET SYNERGIES
// ============================================================================

describe('Turret Synergies', () => {
  it('should detect adjacent turrets of same type', () => {
    const state = createGameState({
      turrets: initializeTurrets([
        { definitionId: 'railgun', slotIndex: 0, class: 'natural' }, // Top-left
        { definitionId: 'railgun', slotIndex: 1, class: 'natural' }, // Top-center (adjacent to 0)
      ]),
    });

    const bonuses = calculateTurretAdjacencyBonuses(state);

    // Slot 0 should have 1 adjacent same-type (slot 1)
    const slot0Bonus = bonuses.find(b => b.slotIndex === 0);
    expect(slot0Bonus?.adjacentSameType).toBe(1);

    // Slot 1 should have 1 adjacent same-type (slot 0)
    const slot1Bonus = bonuses.find(b => b.slotIndex === 1);
    expect(slot1Bonus?.adjacentSameType).toBe(1);
  });

  it('should apply synergy damage bonus for adjacent same-type turrets', () => {
    const state = createGameState({
      turrets: initializeTurrets([
        { definitionId: 'railgun', slotIndex: 0, class: 'natural' },
        { definitionId: 'railgun', slotIndex: 1, class: 'natural' },
      ]),
    });

    const bonus = getTurretSynergyBonus(state, 0);

    // +15% damage per adjacent same-type
    expect(bonus?.damageBonus).toBeCloseTo(0.15, 5);
    expect(bonus?.attackSpeedBonus).toBeCloseTo(0.10, 5);
  });

  it('should stack synergy bonuses for multiple adjacent same-type turrets', () => {
    const state = createGameState({
      turrets: initializeTurrets([
        { definitionId: 'railgun', slotIndex: 0, class: 'natural' }, // Adjacent to slot 1 and 3
        { definitionId: 'railgun', slotIndex: 1, class: 'natural' }, // Adjacent to slot 0
        { definitionId: 'railgun', slotIndex: 3, class: 'natural' }, // Adjacent to slot 0
      ]),
    });

    const bonus = getTurretSynergyBonus(state, 0);

    // Slot 0 is adjacent to both slot 1 and slot 3
    expect(bonus?.adjacentSameType).toBe(2);
    expect(bonus?.damageBonus).toBeCloseTo(0.30, 5); // 2 * 0.15
    expect(bonus?.attackSpeedBonus).toBeCloseTo(0.20, 5); // 2 * 0.10
  });

  it('should not give synergy bonus for different turret types', () => {
    const state = createGameState({
      turrets: initializeTurrets([
        { definitionId: 'railgun', slotIndex: 0, class: 'natural' },
        { definitionId: 'artillery', slotIndex: 1, class: 'natural' }, // Different type
      ]),
    });

    const bonus = getTurretSynergyBonus(state, 0);

    expect(bonus?.adjacentSameType).toBe(0);
    expect(bonus?.damageBonus).toBe(0);
  });

  it('should return undefined for non-existent turret slot', () => {
    const state = createGameState({
      turrets: initializeTurrets([
        { definitionId: 'railgun', slotIndex: 0, class: 'natural' },
      ]),
    });

    const bonus = getTurretSynergyBonus(state, 99);
    expect(bonus).toBeUndefined();
  });
});

// ============================================================================
// TEST 5: SPECIAL TURRET TYPES
// ============================================================================

describe('Special Turret Types', () => {
  it('artillery should have splash damage', () => {
    const artillery = getTurretById('artillery')!;

    expect(artillery.specialEffects?.splash).toBe(true);
    expect(artillery.specialEffects?.splashRadius).toBeDefined();
    expect(artillery.specialEffects?.splashRadius).toBeGreaterThan(0);
  });

  it('cryo should have slow effect (DoT equivalent)', () => {
    const cryo = getTurretById('cryo')!;

    expect(cryo.specialEffects?.slowAmount).toBeDefined();
    expect(cryo.specialEffects?.slowDuration).toBeDefined();
    expect(cryo.specialEffects?.slowDuration).toBeGreaterThan(0);
  });

  it('arc should have chain lightning', () => {
    const arc = getTurretById('arc')!;

    expect(arc.specialEffects?.chainTargets).toBeDefined();
    expect(arc.specialEffects?.chainTargets).toBe(3);
    expect(arc.specialEffects?.chainDamageReduction).toBeDefined();
  });

  it('cryo should be crowd_control role (support turret)', () => {
    const cryo = getTurretById('cryo')!;

    expect(cryo.role).toBe('crowd_control');
  });

  it('railgun should be dps role', () => {
    const railgun = getTurretById('railgun')!;

    expect(railgun.role).toBe('dps');
  });

  it('artillery and arc should be aoe role', () => {
    const artillery = getTurretById('artillery')!;
    const arc = getTurretById('arc')!;

    expect(artillery.role).toBe('aoe');
    expect(arc.role).toBe('aoe');
  });
});

// ============================================================================
// TEST 6: EDGE CASES
// ============================================================================

describe('Turret Edge Cases', () => {
  it('should handle no targets in range gracefully', () => {
    const config = createSimConfig();
    const state = createGameState({
      turrets: [createTestTurret({ slotIndex: 1, lastAttackTick: -100 })],
      enemies: [], // No enemies
    });

    const rng = new Xorshift32(12345);

    // Should not throw and no projectiles created
    expect(() => updateTurrets(state, config, rng)).not.toThrow();
    expect(state.projectiles.length).toBe(0);
  });

  it('should handle multiple valid targets', () => {
    const config = createSimConfig();
    const state = createGameState({
      turrets: [createTestTurret({ slotIndex: 1, lastAttackTick: -100 })],
      enemies: [
        createEnemyAtPosition(1, 10, 7, 100),
        createEnemyAtPosition(2, 10, 8, 100),
        createEnemyAtPosition(3, 10, 6, 100),
      ],
    });

    const rng = new Xorshift32(12345);
    updateTurrets(state, config, rng);

    // Should create exactly one projectile per attack
    expect(state.projectiles.length).toBe(1);
  });

  it('should not target dead enemies (hp <= 0)', () => {
    const config = createSimConfig();
    const state = createGameState({
      turrets: [createTestTurret({ slotIndex: 1, lastAttackTick: -100 })],
      enemies: [
        createEnemy({ id: 1, x: FP.fromFloat(10), y: FP.fromFloat(7), hp: 0 }), // Dead
        createEnemyAtPosition(2, 12, 7, 50), // Alive but further
      ],
    });

    const rng = new Xorshift32(12345);
    updateTurrets(state, config, rng);

    if (state.projectiles.length > 0) {
      expect(state.projectiles[0].targetEnemyId).toBe(2); // Should target alive enemy
    }
  });

  it('should not target enemies beyond field width', () => {
    const config = createSimConfig({ fieldWidth: FP.fromInt(40) });
    const state = createGameState({
      turrets: [createTestTurret({ slotIndex: 1, lastAttackTick: -100 })],
      enemies: [
        createEnemy({ id: 1, x: FP.fromInt(45), y: FP.fromFloat(7), hp: 100 }), // Beyond field
        createEnemyAtPosition(2, 10, 7, 100), // Within field
      ],
    });

    const rng = new Xorshift32(12345);
    updateTurrets(state, config, rng);

    if (state.projectiles.length > 0) {
      expect(state.projectiles[0].targetEnemyId).toBe(2); // Should target in-field enemy
    }
  });

  it('should clear current target when no enemies in range', () => {
    const config = createSimConfig();
    const state = createGameState({
      turrets: [createTestTurret({ slotIndex: 1, currentTargetId: 5 })],
      enemies: [], // No enemies in range
    });

    const rng = new Xorshift32(12345);
    updateTurrets(state, config, rng);

    expect(state.turrets[0].currentTargetId).toBeUndefined();
  });

  it('should maintain target persistence when target is still valid', () => {
    const config = createSimConfig();
    const state = createGameState({
      turrets: [createTestTurret({ slotIndex: 1, currentTargetId: 2, lastAttackTick: -100 })],
      enemies: [
        createEnemyAtPosition(1, 8, 7, 100),  // Closer to fortress
        createEnemyAtPosition(2, 10, 7, 100), // Current target, further
      ],
    });

    const rng = new Xorshift32(12345);
    updateTurrets(state, config, rng);

    // Should maintain target on enemy 2 even though enemy 1 is closer
    expect(state.projectiles.length).toBeGreaterThan(0);
    expect(state.projectiles[0].targetEnemyId).toBe(2);
  });
});

// ============================================================================
// TEST 7: OVERCHARGE SYSTEM
// ============================================================================

describe('Turret Overcharge', () => {
  it('should activate overcharge successfully', () => {
    const state = createGameState({
      tick: 100,
      turrets: [createTestTurret({ slotIndex: 1 })],
    });

    const result = activateTurretOvercharge(state, 1);

    expect(result).toBe(true);
    expect(state.turrets[0].overchargeActive).toBe(true);
    expect(state.turrets[0].overchargeExpiresTick).toBeGreaterThan(state.tick);
  });

  it('should fail to activate overcharge when on cooldown', () => {
    const state = createGameState({
      tick: 100,
      turrets: [createTestTurret({
        slotIndex: 1,
        overchargeCooldownTick: 200, // Cooldown not expired
      })],
    });

    const result = activateTurretOvercharge(state, 1);

    expect(result).toBe(false);
    expect(state.turrets[0].overchargeActive).toBeFalsy();
  });

  it('should return false for non-existent turret slot', () => {
    const state = createGameState({
      turrets: [createTestTurret({ slotIndex: 1 })],
    });

    const result = activateTurretOvercharge(state, 99);

    expect(result).toBe(false);
  });

  it('should set cooldown after overcharge expires', () => {
    const state = createGameState({
      tick: 100,
      turrets: [createTestTurret({ slotIndex: 1 })],
    });

    activateTurretOvercharge(state, 1);

    // Overcharge cooldown should be set
    expect(state.turrets[0].overchargeCooldownTick).toBeGreaterThan(state.turrets[0].overchargeExpiresTick!);
  });
});

// ============================================================================
// TEST 8: TURRET INITIALIZATION
// ============================================================================

describe('Turret Initialization', () => {
  it('should initialize turrets with correct default values', () => {
    const turrets = initializeTurrets([
      { definitionId: 'railgun', slotIndex: 1, class: 'natural' },
    ]);

    expect(turrets.length).toBe(1);
    expect(turrets[0].definitionId).toBe('railgun');
    expect(turrets[0].tier).toBe(1);
    expect(turrets[0].currentClass).toBe('natural');
    expect(turrets[0].slotIndex).toBe(1);
    expect(turrets[0].targetingMode).toBe('closest_to_fortress');
  });

  it('should initialize turrets with specified tier', () => {
    const turrets = initializeTurrets([
      { definitionId: 'railgun', slotIndex: 1, class: 'fire', tier: 3 },
    ]);

    expect(turrets[0].tier).toBe(3);
    expect(turrets[0].currentClass).toBe('fire');
  });

  it('should apply guild stat boost to turret HP', () => {
    const turretsNoBoost = initializeTurrets([
      { definitionId: 'railgun', slotIndex: 1, class: 'natural' },
    ]);

    const turretsWithBoost = initializeTurrets([
      { definitionId: 'railgun', slotIndex: 1, class: 'natural' },
    ], 0.20); // 20% guild boost

    expect(turretsWithBoost[0].maxHp).toBe(Math.floor(turretsNoBoost[0].maxHp * 1.20));
  });

  it('should initialize multiple turrets correctly', () => {
    const turrets = initializeTurrets([
      { definitionId: 'railgun', slotIndex: 1, class: 'natural' },
      { definitionId: 'artillery', slotIndex: 2, class: 'fire' },
      { definitionId: 'cryo', slotIndex: 3, class: 'ice' },
    ]);

    expect(turrets.length).toBe(3);
    expect(turrets[0].definitionId).toBe('railgun');
    expect(turrets[1].definitionId).toBe('artillery');
    expect(turrets[2].definitionId).toBe('cryo');
  });
});

// ============================================================================
// TEST 9: TURRET COST CALCULATION
// ============================================================================

describe('Turret Cost Calculation', () => {
  it('should return base cost for tier 1', () => {
    const railgun = getTurretById('railgun')!;
    const cost = calculateTurretCost(railgun, 1);

    expect(cost).toBe(railgun.baseCost.gold);
  });

  it('should double cost for tier 2 (2.0x multiplier)', () => {
    const railgun = getTurretById('railgun')!;
    const tier1Cost = calculateTurretCost(railgun, 1);
    const tier2Cost = calculateTurretCost(railgun, 2);

    expect(tier2Cost).toBe(tier1Cost * 2);
  });

  it('should quadruple cost for tier 3 (2.0^2 multiplier)', () => {
    const railgun = getTurretById('railgun')!;
    const tier1Cost = calculateTurretCost(railgun, 1);
    const tier3Cost = calculateTurretCost(railgun, 3);

    expect(tier3Cost).toBe(tier1Cost * 4);
  });
});

// ============================================================================
// TEST 10: TURRET SLOT LAYOUT
// ============================================================================

describe('Turret Slot Layout', () => {
  it('should have 6 base turret slots', () => {
    expect(TURRET_SLOTS.length).toBe(6);
  });

  it('should have 3 top and 3 bottom slots', () => {
    const topSlots = TURRET_SLOTS.filter(s => s.position === 'top');
    const bottomSlots = TURRET_SLOTS.filter(s => s.position === 'bottom');

    expect(topSlots.length).toBe(3);
    expect(bottomSlots.length).toBe(3);
  });

  it('top slots should have negative Y offset', () => {
    const topSlots = TURRET_SLOTS.filter(s => s.position === 'top');
    for (const slot of topSlots) {
      expect(slot.offsetY).toBeLessThan(0);
    }
  });

  it('bottom slots should have positive Y offset', () => {
    const bottomSlots = TURRET_SLOTS.filter(s => s.position === 'bottom');
    for (const slot of bottomSlots) {
      expect(slot.offsetY).toBeGreaterThan(0);
    }
  });
});
