import { describe, it, expect } from 'vitest';
import { Simulation, getDefaultConfig, FP } from '../../index.js';
import {
  TURRET_DEFINITIONS,
  TURRET_SLOTS,
  EXTRA_TURRET_SLOTS,
  TURRET_CLASS_MODIFIERS,
  getTurretById,
  getTurretsByRole,
  calculateTurretCost,
  getTurretClassModifier,
  calculateTurretStats,
} from '../../data/turrets.js';
import {
  FORTRESS_CLASSES,
  getClassById,
} from '../../data/classes.js';

// Turret stats use scale 16384 = 1.0 (not 65536 like FP.toFloat)
const TURRET_STAT_BASE = 16384;
const toStatFloat = (value: number) => value / TURRET_STAT_BASE;

// ============================================================================
// TEST 1: TURRET DEFINITIONS (4 core types)
// ============================================================================

describe('Turret Definitions', () => {
  it('should have exactly 4 turret types', () => {
    expect(TURRET_DEFINITIONS.length).toBe(4);
  });

  it('should have all expected turret types', () => {
    const expectedTypes = ['railgun', 'cryo', 'artillery', 'arc'];
    const actualTypes = TURRET_DEFINITIONS.map(t => t.id);

    for (const type of expectedTypes) {
      expect(actualTypes).toContain(type);
    }
  });

  it.each(TURRET_DEFINITIONS.map(t => t.id))('turret %s should have valid base stats', (turretId) => {
    const turret = getTurretById(turretId);
    expect(turret).toBeDefined();

    // Check all required base stats
    expect(turret!.baseStats.damage).toBeGreaterThan(0);
    expect(turret!.baseStats.attackSpeed).toBeGreaterThan(0);
    expect(turret!.baseStats.range).toBeGreaterThan(0);
    expect(turret!.baseStats.critChance).toBeGreaterThanOrEqual(0);
    expect(turret!.baseStats.critMultiplier).toBeGreaterThan(0);
    expect(turret!.baseStats.hp).toBeGreaterThan(0);
  });

  it.each(TURRET_DEFINITIONS.map(t => t.id))('turret %s should have valid ability', (turretId) => {
    const turret = getTurretById(turretId);

    expect(turret!.ability).toBeDefined();
    expect(turret!.ability.id).toBeDefined();
    expect(turret!.ability.name).toBeDefined();
    expect(turret!.ability.cooldown).toBeGreaterThan(0);
    expect(turret!.ability.effect).toBeDefined();
  });

  it.each(TURRET_DEFINITIONS.map(t => t.id))('turret %s should have valid role', (turretId) => {
    const turret = getTurretById(turretId);
    const validRoles = ['dps', 'aoe', 'crowd_control'];

    expect(validRoles).toContain(turret!.role);
  });

  describe('Arrow Tower', () => {
    const arrow = getTurretById('arrow')!;

    it('has correct base stats', () => {
      expect(toStatFloat(arrow.baseStats.damage)).toBeCloseTo(8.0, 1);
      expect(toStatFloat(arrow.baseStats.attackSpeed)).toBeCloseTo(2.5, 1);
      expect(toStatFloat(arrow.baseStats.range)).toBeCloseTo(10, 1);
      expect(arrow.baseStats.hp).toBe(150);
    });

    it('has Rapid Fire ability', () => {
      expect(arrow.ability.id).toBe('rapid_fire');
      expect(arrow.ability.cooldown).toBe(900); // 30 seconds
    });

    it('is dps role', () => {
      expect(arrow.role).toBe('dps');
    });
  });

  describe('Cannon Tower', () => {
    const cannon = getTurretById('cannon')!;

    it('has high damage, slow attack speed', () => {
      expect(toStatFloat(cannon.baseStats.damage)).toBeCloseTo(45.0, 1);
      expect(toStatFloat(cannon.baseStats.attackSpeed)).toBeCloseTo(0.5, 1);
    });

    it('has splash damage', () => {
      expect(cannon.specialEffects?.splash).toBe(true);
      expect(cannon.specialEffects?.splashRadius).toBeDefined();
    });

    it('is aoe role', () => {
      expect(cannon.role).toBe('aoe');
    });
  });

  describe('Tesla Tower', () => {
    const tesla = getTurretById('tesla')!;

    it('has chain lightning', () => {
      expect(tesla.specialEffects?.chainTargets).toBe(3);
      expect(tesla.specialEffects?.chainDamageReduction).toBeDefined();
    });

    it('is aoe role', () => {
      expect(tesla.role).toBe('aoe');
    });
  });

  describe('Frost Tower', () => {
    const frost = getTurretById('frost')!;

    it('has slow effect', () => {
      expect(frost.specialEffects?.slowAmount).toBeDefined();
      expect(frost.specialEffects?.slowDuration).toBeGreaterThan(0);
    });

    it('is crowd_control role', () => {
      expect(frost.role).toBe('crowd_control');
    });
  });

});

// ============================================================================
// TEST 2: TURRET SLOTS AND POSITIONING
// ============================================================================

describe('Turret Slots', () => {
  it('should have 6 base turret slots', () => {
    expect(TURRET_SLOTS.length).toBe(6);
  });

  it('should have 2 extra turret slots', () => {
    expect(EXTRA_TURRET_SLOTS.length).toBe(2);
  });

  it('base slots should have IDs 1-6', () => {
    const ids = TURRET_SLOTS.map(s => s.id);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('extra slots should have IDs 7-8', () => {
    const ids = EXTRA_TURRET_SLOTS.map(s => s.id);
    expect(ids).toEqual([7, 8]);
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

  it('all slots should have positive X offset (in front of fortress)', () => {
    const allSlots = [...TURRET_SLOTS, ...EXTRA_TURRET_SLOTS];
    for (const slot of allSlots) {
      expect(slot.offsetX).toBeGreaterThan(0);
    }
  });

  it('slots should be positioned in increasing X order within each row', () => {
    const topSlots = TURRET_SLOTS.filter(s => s.position === 'top').sort((a, b) => a.index - b.index);
    const bottomSlots = TURRET_SLOTS.filter(s => s.position === 'bottom').sort((a, b) => a.index - b.index);

    for (let i = 1; i < topSlots.length; i++) {
      expect(topSlots[i].offsetX).toBeGreaterThanOrEqual(topSlots[i - 1].offsetX);
    }

    for (let i = 1; i < bottomSlots.length; i++) {
      expect(bottomSlots[i].offsetX).toBeGreaterThanOrEqual(bottomSlots[i - 1].offsetX);
    }
  });
});

// ============================================================================
// TEST 3: TURRET CLASS MODIFIERS
// ============================================================================

describe('Turret Class Modifiers', () => {
  it('should have 5 class modifiers', () => {
    expect(TURRET_CLASS_MODIFIERS.length).toBe(5);
  });

  it('should have all fortress classes', () => {
    const expectedClasses = ['natural', 'ice', 'fire', 'lightning', 'tech'];
    const actualClasses = TURRET_CLASS_MODIFIERS.map(m => m.class);

    for (const cls of expectedClasses) {
      expect(actualClasses).toContain(cls);
    }
  });

  it('natural class should have 1.0x multipliers (baseline)', () => {
    const natural = getTurretClassModifier('natural');
    expect(natural).toBeDefined();
    expect(toStatFloat(natural!.damageMultiplier)).toBeCloseTo(1.0, 2);
    expect(toStatFloat(natural!.attackSpeedMultiplier)).toBeCloseTo(1.0, 2);
    expect(toStatFloat(natural!.rangeMultiplier)).toBeCloseTo(1.0, 2);
  });

  it('fire class should have higher damage multiplier', () => {
    const fire = getTurretClassModifier('fire');
    expect(toStatFloat(fire!.damageMultiplier)).toBeCloseTo(1.2, 2);
  });

  it('lightning class should have higher attack speed multiplier', () => {
    const lightning = getTurretClassModifier('lightning');
    expect(toStatFloat(lightning!.attackSpeedMultiplier)).toBeCloseTo(1.3, 2);
  });

  it('tech class should have higher range multiplier', () => {
    const tech = getTurretClassModifier('tech');
    expect(toStatFloat(tech!.rangeMultiplier)).toBeCloseTo(1.2, 2);
  });

  it('ice should have lower damage multiplier (trade-off for CC)', () => {
    const ice = getTurretClassModifier('ice');
    expect(toStatFloat(ice!.damageMultiplier)).toBeLessThan(1.0);
  });
});

// ============================================================================
// TEST 4: TURRET COST CALCULATION
// ============================================================================

describe('Turret Cost Calculation', () => {
  const COST_MULTIPLIER_BASE = 16384;
  const expectedCost = (baseCost: number, multiplier: number, tier: number) => {
    if (tier <= 1) return baseCost;
    return Math.floor(
      baseCost * Math.pow(multiplier / COST_MULTIPLIER_BASE, tier - 1)
    );
  };

  it('tier 1 cost equals base cost', () => {
    const arrow = getTurretById('arrow')!;
    expect(calculateTurretCost(arrow, 1)).toBe(arrow.baseCost.gold);
  });

  it('tier 2 cost scales with the tier multiplier', () => {
    const arrow = getTurretById('arrow')!;
    expect(calculateTurretCost(arrow, 2)).toBe(
      expectedCost(arrow.baseCost.gold, arrow.tierCostMultiplier, 2)
    );
  });

  it('tier 3 cost compounds the multiplier', () => {
    const arrow = getTurretById('arrow')!;
    expect(calculateTurretCost(arrow, 3)).toBe(
      expectedCost(arrow.baseCost.gold, arrow.tierCostMultiplier, 3)
    );
  });

  it('different turrets have different base costs', () => {
    const arrow = getTurretById('arrow')!;
    const cannon = getTurretById('cannon')!;
    const tesla = getTurretById('tesla')!;

    expect(calculateTurretCost(arrow, 1)).toBe(arrow.baseCost.gold);
    expect(calculateTurretCost(cannon, 1)).toBe(cannon.baseCost.gold);
    expect(calculateTurretCost(tesla, 1)).toBe(tesla.baseCost.gold);
    expect(arrow.baseCost.gold).not.toBe(cannon.baseCost.gold);
    expect(arrow.baseCost.gold).not.toBe(tesla.baseCost.gold);
    expect(cannon.baseCost.gold).not.toBe(tesla.baseCost.gold);
  });

  it('supports non-2.0 tier multipliers', () => {
    const arrow = getTurretById('arrow')!;
    const custom = {
      ...arrow,
      baseCost: { gold: 101 },
      tierCostMultiplier: 24576,
    };

    expect(calculateTurretCost(custom, 2)).toBe(151);
  });
});

// ============================================================================
// TEST 5: TURRET STATS CALCULATION WITH CLASS AND TIER
// ============================================================================

describe('calculateTurretStats', () => {
  const arrow = getTurretById('arrow')!;

  it('natural class tier 1 returns base stats', () => {
    const stats = calculateTurretStats(arrow, 'natural', 1);

    // Should be close to base stats (within fixed-point precision)
    expect(toStatFloat(stats.damage)).toBeCloseTo(8.0, 0);
  });

  it('tier increases stats (1.0, 1.25, 1.5)', () => {
    const statsTier1 = calculateTurretStats(arrow, 'natural', 1);
    const statsTier2 = calculateTurretStats(arrow, 'natural', 2);
    const statsTier3 = calculateTurretStats(arrow, 'natural', 3);

    expect(toStatFloat(statsTier2.damage)).toBeGreaterThan(toStatFloat(statsTier1.damage));
    expect(toStatFloat(statsTier3.damage)).toBeGreaterThan(toStatFloat(statsTier2.damage));
  });

  it('fire class increases damage', () => {
    const naturalStats = calculateTurretStats(arrow, 'natural', 1);
    const fireStats = calculateTurretStats(arrow, 'fire', 1);

    expect(toStatFloat(fireStats.damage)).toBeGreaterThan(toStatFloat(naturalStats.damage));
  });

  it('lightning class increases attack speed', () => {
    const naturalStats = calculateTurretStats(arrow, 'natural', 1);
    const lightningStats = calculateTurretStats(arrow, 'lightning', 1);

    expect(toStatFloat(lightningStats.attackSpeed)).toBeGreaterThan(toStatFloat(naturalStats.attackSpeed));
  });

  it('tech class increases range', () => {
    const naturalStats = calculateTurretStats(arrow, 'natural', 1);
    const techStats = calculateTurretStats(arrow, 'tech', 1);

    expect(toStatFloat(techStats.range)).toBeGreaterThan(toStatFloat(naturalStats.range));
  });
});

// ============================================================================
// TEST 6: TURRET HELPER FUNCTIONS
// ============================================================================

describe('Turret Helper Functions', () => {
  describe('getTurretById', () => {
    it('returns turret for valid ID', () => {
      expect(getTurretById('arrow')).toBeDefined();
      expect(getTurretById('cannon')).toBeDefined();
    });

    it('returns undefined for invalid ID', () => {
      expect(getTurretById('nonexistent')).toBeUndefined();
    });
  });

  describe('getTurretsByRole', () => {
    it('returns DPS turrets', () => {
      const dpsTurrets = getTurretsByRole('dps');
      expect(dpsTurrets.length).toBeGreaterThan(0);
      for (const t of dpsTurrets) {
        expect(t.role).toBe('dps');
      }
    });

    it('returns AOE turrets', () => {
      const aoeTurrets = getTurretsByRole('aoe');
      expect(aoeTurrets.length).toBeGreaterThan(0);
      for (const t of aoeTurrets) {
        expect(t.role).toBe('aoe');
      }
    });

    it('returns crowd_control turrets', () => {
      const ccTurrets = getTurretsByRole('crowd_control');
      expect(ccTurrets.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// TEST 7: FORTRESS CLASSES (7 types)
// ============================================================================

describe('Fortress Classes', () => {
  it('should have exactly 6 fortress classes', () => {
    expect(FORTRESS_CLASSES.length).toBe(6);
  });

  it('should have all expected classes', () => {
    const expectedClasses = ['natural', 'ice', 'fire', 'lightning', 'void', 'tech'];
    const actualClasses = FORTRESS_CLASSES.map(c => c.id);

    for (const cls of expectedClasses) {
      expect(actualClasses).toContain(cls);
    }
  });

  it.each(FORTRESS_CLASSES.map(c => c.id))('class %s should have valid structure', (classId) => {
    const cls = getClassById(classId);
    expect(cls).toBeDefined();
    expect(cls!.name).toBeDefined();
    expect(cls!.description).toBeDefined();
    expect(cls!.projectileType).toBeDefined();
    expect(cls!.passiveModifiers).toBeDefined();
  });

  it.each(FORTRESS_CLASSES.map(c => c.id))('class %s should have 2 skills', (classId) => {
    const cls = getClassById(classId);
    expect(cls!.skills.length).toBe(2);
  });

  describe('Natural Class', () => {
    const natural = getClassById('natural')!;

    it('has nature-themed projectile', () => {
      expect(natural.projectileType).toBe('physical');
    });

    it('skills unlock at levels 1 and 5', () => {
      const unlockLevels = natural.skills.map(s => s.unlockedAtFortressLevel);
      expect(unlockLevels).toContain(1);
      expect(unlockLevels).toContain(5);
    });
  });

  describe('Ice Class', () => {
    const ice = getClassById('ice')!;

    it('has ice projectile type', () => {
      expect(ice.projectileType).toBe('icicle');
    });

    it('has freeze effects in skills', () => {
      const hasFreeze = ice.skills.some(s => s.effects.some(e => e.type === 'freeze'));
      expect(hasFreeze).toBe(true);
    });
  });

  describe('Fire Class', () => {
    const fire = getClassById('fire')!;

    it('has fireball projectile type', () => {
      expect(fire.projectileType).toBe('fireball');
    });

    it('skills have burn effects', () => {
      const hasBurn = fire.skills.some(s => s.effects.some(e => e.type === 'burn'));
      expect(hasBurn).toBe(true);
    });
  });

  describe('Lightning Class', () => {
    const lightning = getClassById('lightning')!;

    it('has bolt projectile type', () => {
      expect(lightning.projectileType).toBe('bolt');
    });

    it('skills have stun effects', () => {
      const hasStun = lightning.skills.some(s => s.effects.some(e => e.type === 'stun'));
      expect(hasStun).toBe(true);
    });
  });

  describe('Tech Class', () => {
    const tech = getClassById('tech')!;

    it('has laser projectile type', () => {
      expect(tech.projectileType).toBe('laser');
    });
  });
});

// ============================================================================
// TEST 8: FORTRESS SKILL DEFINITIONS
// ============================================================================

describe('Fortress Skill Definitions', () => {
  it.each(FORTRESS_CLASSES.map(c => c.id))('class %s skills should have valid cooldowns', (classId) => {
    const cls = getClassById(classId);
    const skills = cls!.skills;

    for (const skill of skills) {
      expect(skill.cooldownTicks).toBeGreaterThan(0);
      // Cooldowns should be reasonable (8-60 seconds = 240-1800 ticks)
      expect(skill.cooldownTicks).toBeGreaterThanOrEqual(240);
      expect(skill.cooldownTicks).toBeLessThanOrEqual(1800);
    }
  });

  it.each(FORTRESS_CLASSES.map(c => c.id))('class %s skills should have effects', (classId) => {
    const cls = getClassById(classId);
    const skills = cls!.skills;

    for (const skill of skills) {
      expect(skill.effects).toBeDefined();
      expect(skill.effects.length).toBeGreaterThan(0);
    }
  });

  it('all classes should have skills at level 1 and 5', () => {
    for (const cls of FORTRESS_CLASSES) {
      const level1Skill = cls.skills.find(s => s.unlockedAtFortressLevel === 1);
      const level5Skill = cls.skills.find(s => s.unlockedAtFortressLevel === 5);
      expect(level1Skill).toBeDefined();
      expect(level5Skill).toBeDefined();
    }
  });

  it('skill effects should have valid types', () => {
    const validEffectTypes = [
      'damage', 'slow', 'stun', 'freeze', 'burn', 'poison', 'heal', 'shield', 'buff',
      'percent_current_hp_damage', 'summon'
    ];

    for (const cls of FORTRESS_CLASSES) {
      for (const skill of cls.skills) {
        for (const effect of skill.effects) {
          expect(validEffectTypes).toContain(effect.type);
        }
      }
    }
  });
});

// ============================================================================
// TEST 9: FORTRESS ATTACK SYSTEM
// ============================================================================

describe('Fortress Attack System', () => {
  it('fortress attacks enemies', () => {
    const config = getDefaultConfig();
    const sim = new Simulation(12345, config);

    // Advance until enemies spawn
    for (let i = 0; i < 200; i++) {
      sim.step();
      if (sim.state.enemies.length > 0) break;
    }

    expect(sim.state.enemies.length).toBeGreaterThan(0);

    const enemy = sim.state.enemies[0];
    const initialHp = enemy.hp;

    // Run more ticks to allow fortress to attack
    for (let i = 0; i < 100; i++) {
      sim.step();
    }

    // Enemy should have taken damage (or been killed)
    const anyDamage = enemy.hp < initialHp || sim.state.kills > 0;
    expect(anyDamage).toBe(true);
  });

  it('fortress HP decreases when enemies reach attack range', () => {
    const config = getDefaultConfig();
    const sim = new Simulation(12345, config);

    // Advance until enemies spawn
    for (let i = 0; i < 200; i++) {
      sim.step();
      if (sim.state.enemies.length > 0) break;
    }

    const initialFortressHp = sim.state.fortressHp;

    // Move enemy to fortress attack range
    const enemy = sim.state.enemies[0];
    enemy.x = FP.add(config.fortressX, config.enemyAttackRange);
    enemy.lastAttackTick = sim.state.tick - 100;

    // Run ticks
    for (let i = 0; i < 50; i++) {
      sim.step();
    }

    // Fortress should have taken damage
    expect(sim.state.fortressHp).toBeLessThan(initialFortressHp);
  });

  it('game ends when fortress HP reaches 0', () => {
    const config = getDefaultConfig();
    const sim = new Simulation(12345, config);

    // Set fortress HP very low
    sim.state.fortressHp = 1;

    // Advance until enemies spawn
    for (let i = 0; i < 200; i++) {
      sim.step();
      if (sim.state.enemies.length > 0) break;
    }

    // Move enemy to attack range with high damage
    const enemy = sim.state.enemies[0];
    enemy.x = FP.add(config.fortressX, config.enemyAttackRange);
    enemy.damage = 100;
    enemy.lastAttackTick = sim.state.tick - 100;

    // Run until game ends
    for (let i = 0; i < 100 && !sim.state.ended; i++) {
      sim.step();
    }

    expect(sim.state.ended).toBe(true);
    expect(sim.state.won).toBe(false);
    expect(sim.state.fortressHp).toBe(0);
  });
});

// ============================================================================
// TEST 10: FORTRESS ATTACK INTERVAL
// ============================================================================

describe('Fortress Attack Interval', () => {
  it('fortress attacks at configured interval', () => {
    const config = getDefaultConfig();
    expect(config.fortressAttackInterval).toBe(15); // 0.5 seconds at 30Hz
  });

  it('fortress tracks last attack tick', () => {
    const config = getDefaultConfig();
    const sim = new Simulation(12345, config);

    // Advance until enemies spawn
    for (let i = 0; i < 200; i++) {
      sim.step();
      if (sim.state.enemies.length > 0) break;
    }

    const initialLastAttack = sim.state.fortressLastAttackTick;

    // Run more ticks
    for (let i = 0; i < 30; i++) {
      sim.step();
    }

    // Last attack tick should have updated
    expect(sim.state.fortressLastAttackTick).toBeGreaterThan(initialLastAttack);
  });
});

// ============================================================================
// TEST 11: TURRET ABILITY EFFECTS
// ============================================================================

describe('Turret Ability Effects', () => {
  it('all turrets have valid ability effect types', () => {
    const validEffectTypes = [
      'damage_boost',
      'aoe_attack',
      'chain_all',
      'freeze_all',
    ];

    for (const turret of TURRET_DEFINITIONS) {
      expect(validEffectTypes).toContain(turret.ability.effect.type);
    }
  });

  it('DPS turrets have damage-focused abilities', () => {
    const dpsTurrets = getTurretsByRole('dps');
    const damageAbilityTypes = ['damage_boost'];

    for (const turret of dpsTurrets) {
      expect(damageAbilityTypes).toContain(turret.ability.effect.type);
    }
  });

  it('AOE turrets have area abilities', () => {
    const aoeTurrets = getTurretsByRole('aoe');
    const aoeAbilityTypes = ['aoe_attack', 'chain_all'];

    for (const turret of aoeTurrets) {
      expect(aoeAbilityTypes).toContain(turret.ability.effect.type);
    }
  });

  it('crowd_control turret has freeze ability', () => {
    const frost = getTurretById('frost')!;
    expect(frost.ability.effect.type).toBe('freeze_all');
  });
});

// ============================================================================
// TEST 12: TURRET SPECIAL EFFECTS
// ============================================================================

describe('Turret Special Effects', () => {
  it('turrets with splash have splashRadius', () => {
    for (const turret of TURRET_DEFINITIONS) {
      if (turret.specialEffects?.splash) {
        expect(turret.specialEffects.splashRadius).toBeDefined();
        expect(turret.specialEffects.splashRadius).toBeGreaterThan(0);
      }
    }
  });

  it('turrets with slow have slowDuration', () => {
    for (const turret of TURRET_DEFINITIONS) {
      if (turret.specialEffects?.slowAmount) {
        expect(turret.specialEffects.slowDuration).toBeDefined();
        expect(turret.specialEffects.slowDuration).toBeGreaterThan(0);
      }
    }
  });

  it('turrets with chain have chainTargets', () => {
    for (const turret of TURRET_DEFINITIONS) {
      if (turret.specialEffects?.chainTargets) {
        expect(turret.specialEffects.chainTargets).toBeGreaterThan(0);
        expect(turret.specialEffects.chainDamageReduction).toBeDefined();
      }
    }
  });
});
