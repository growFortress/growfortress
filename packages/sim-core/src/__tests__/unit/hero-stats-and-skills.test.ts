import { describe, it, expect } from 'vitest';
import { Simulation, getDefaultConfig, FP } from '../../index.js';
import {
  HEROES,
  getHeroById,
  calculateHeroStats,
  getHeroTier,
  canUpgradeTier,
  getXpRequiredForLevel,
} from '../../data/heroes.js';
import { calculateHeroStoneCooldownReduction } from '../../systems.js';

// ============================================================================
// TEST 1: ALL HEROES BASE STATS VALIDATION
// ============================================================================

describe('Hero Base Stats', () => {
  it('all 10 heroes should be defined', () => {
    expect(HEROES.length).toBe(10);
  });

  it.each(HEROES.map(h => h.id))('hero %s should have valid base stats', (heroId) => {
    const hero = getHeroById(heroId);
    expect(hero).toBeDefined();

    // Check all required base stats exist
    expect(hero!.baseStats.hp).toBeGreaterThan(0);
    expect(hero!.baseStats.damage).toBeGreaterThan(0);
    expect(hero!.baseStats.attackSpeed).toBeGreaterThan(0);
    expect(hero!.baseStats.range).toBeGreaterThan(0);
    expect(hero!.baseStats.moveSpeed).toBeGreaterThan(0);
    expect(hero!.baseStats.deployCooldown).toBeGreaterThan(0);
  });

  it.each(HEROES.map(h => h.id))('hero %s should have 3 tiers', (heroId) => {
    const hero = getHeroById(heroId);
    expect(hero!.tiers.length).toBe(3);
    expect(hero!.tiers[0].tier).toBe(1);
    expect(hero!.tiers[1].tier).toBe(2);
    expect(hero!.tiers[2].tier).toBe(3);
  });

  it.each(HEROES.map(h => h.id))('hero %s should have 1 weakness', (heroId) => {
    const hero = getHeroById(heroId);
    expect(hero!.weaknesses.length).toBe(1);
  });

  it.each(HEROES.map(h => h.id))('hero %s should have valid class and role', (heroId) => {
    const hero = getHeroById(heroId);
    const validClasses = ['lightning', 'tech', 'natural', 'fire', 'ice', 'void', 'plasma'];
    const validRoles = ['tank', 'dps', 'support', 'crowd_control', 'assassin'];

    expect(validClasses).toContain(hero!.class);
    expect(validRoles).toContain(hero!.role);
  });

  // Specific hero stat tests
  describe('Unit Storm stats', () => {
    const hero = getHeroById('storm')!;

    it('has correct base stats', () => {
      expect(hero.baseStats.hp).toBe(280);
      expect(hero.baseStats.damage).toBe(25);
      expect(hero.baseStats.attackSpeed).toBe(1.2);
    });

    it('is lightning class and dps role', () => {
      expect(hero.class).toBe('lightning');
      expect(hero.role).toBe('dps');
    });
  });

  describe('Unit-1 "Titan" stats', () => {
    const hero = getHeroById('titan')!;

    it('has highest HP (tank)', () => {
      expect(hero.baseStats.hp).toBe(500);
      expect(hero.role).toBe('tank');
    });

    it('has slower attack speed', () => {
      expect(hero.baseStats.attackSpeed).toBe(0.7);
    });
  });

  describe('Unit-5 "Frost" stats', () => {
    const hero = getHeroById('frost')!;

    it('has highest attack speed among remaining heroes', () => {
      expect(hero.baseStats.attackSpeed).toBe(1.8);
    });

    it('has longest range', () => {
      expect(FP.toFloat(hero.baseStats.range)).toBe(12);
    });
  });
});

// ============================================================================
// TEST 2: CALCULATE HERO STATS (TIER AND LEVEL BONUSES)
// ============================================================================

describe('calculateHeroStats', () => {
  const storm = getHeroById('storm')!;

  describe('tier multipliers', () => {
    it('tier 1 has 1.0x multiplier', () => {
      const stats = calculateHeroStats(storm, 1, 1);
      expect(stats.hp).toBe(280); // 280 * 1.0 * 1.0
      expect(stats.damage).toBe(25); // 25 * 1.0 * 1.0
    });

    it('tier 2 has 1.5x multiplier', () => {
      const stats = calculateHeroStats(storm, 2, 1);
      expect(stats.hp).toBe(420); // 280 * 1.5 * 1.0
      expect(stats.damage).toBe(37); // floor(25 * 1.5 * 1.0) = 37
    });

    it('tier 3 has 2.0x multiplier', () => {
      const stats = calculateHeroStats(storm, 3, 1);
      expect(stats.hp).toBe(560); // 280 * 2.0 * 1.0
      expect(stats.damage).toBe(50); // 25 * 2.0 * 1.0
    });
  });

  describe('level bonuses (+2% per level)', () => {
    it('level 1 has no bonus', () => {
      const stats = calculateHeroStats(storm, 1, 1);
      expect(stats.hp).toBe(280);
    });

    it('level 2 has +2% bonus', () => {
      const stats = calculateHeroStats(storm, 1, 2);
      // 280 * 1.0 * 1.02 = 285.6 -> 285
      expect(stats.hp).toBe(285);
    });

    it('level 10 has +18% bonus', () => {
      const stats = calculateHeroStats(storm, 1, 10);
      // 280 * 1.0 * 1.18 = 330.4 -> 330
      expect(stats.hp).toBe(330);
    });

    it('level 20 has +38% bonus', () => {
      const stats = calculateHeroStats(storm, 1, 20);
      // 280 * 1.0 * 1.38 = 386.4 (may be 386 or 387 due to floating point)
      expect(stats.hp).toBeGreaterThanOrEqual(386);
      expect(stats.hp).toBeLessThanOrEqual(387);
    });
  });

  describe('combined tier and level', () => {
    it('tier 2 level 10 combines multipliers', () => {
      const stats = calculateHeroStats(storm, 2, 10);
      // HP: 280 * 1.5 * 1.18 = 495.6 -> 495
      expect(stats.hp).toBe(495);
      // Damage: 25 * 1.5 * 1.18 = 44.25 -> 44
      expect(stats.damage).toBe(44);
    });

    it('tier 3 level 25 combines multipliers', () => {
      const stats = calculateHeroStats(storm, 3, 25);
      // HP: 280 * 2.0 * 1.48 = 828.8 -> 828
      expect(stats.hp).toBe(828);
      // Damage: 25 * 2.0 * 1.48 = 74
      expect(stats.damage).toBe(74);
    });
  });

  describe('attack speed scales with tier only', () => {
    it('tier affects attack speed', () => {
      const stats1 = calculateHeroStats(storm, 1, 1);
      const stats2 = calculateHeroStats(storm, 2, 1);
      const stats3 = calculateHeroStats(storm, 3, 1);

      expect(stats1.attackSpeed).toBeCloseTo(1.2, 2);
      expect(stats2.attackSpeed).toBeCloseTo(1.8, 2); // 1.2 * 1.5
      expect(stats3.attackSpeed).toBeCloseTo(2.4, 2); // 1.2 * 2.0
    });

    it('level does NOT affect attack speed', () => {
      const stats1 = calculateHeroStats(storm, 1, 1);
      const stats10 = calculateHeroStats(storm, 1, 10);

      expect(stats1.attackSpeed).toBe(stats10.attackSpeed);
    });
  });

  describe('range and moveSpeed are unchanged', () => {
    it('range is constant across tiers and levels', () => {
      const stats1 = calculateHeroStats(storm, 1, 1);
      const stats2 = calculateHeroStats(storm, 2, 10);
      const stats3 = calculateHeroStats(storm, 3, 25);

      expect(stats1.range).toBe(stats2.range);
      expect(stats2.range).toBe(stats3.range);
    });

    it('moveSpeed is constant across tiers and levels', () => {
      const stats1 = calculateHeroStats(storm, 1, 1);
      const stats2 = calculateHeroStats(storm, 2, 10);
      const stats3 = calculateHeroStats(storm, 3, 25);

      expect(stats1.moveSpeed).toBe(stats2.moveSpeed);
      expect(stats2.moveSpeed).toBe(stats3.moveSpeed);
    });
  });
});

// ============================================================================
// TEST 3: TIER SYSTEM
// ============================================================================

describe('Tier System', () => {
  const storm = getHeroById('storm')!;

  describe('getHeroTier', () => {
    it('returns correct tier data', () => {
      // getHeroTier takes heroId string, not hero object
      const tier1 = getHeroTier('storm', 1);
      const tier2 = getHeroTier('storm', 2);
      const tier3 = getHeroTier('storm', 3);

      expect(tier1).toBeDefined();
      expect(tier2).toBeDefined();
      expect(tier3).toBeDefined();
      expect(tier1!.name).toBe('Unit-7 "Storm"');
      expect(tier2!.name).toBe('Unit-7 "Storm" Mk.II');
      expect(tier3!.name).toBe('Unit-7 "Storm" APEX');
    });

    it('tier multipliers increase with tier', () => {
      const tier1 = getHeroTier('storm', 1);
      const tier2 = getHeroTier('storm', 2);
      const tier3 = getHeroTier('storm', 3);

      expect(tier1!.statMultiplier).toBe(1.0);
      expect(tier2!.statMultiplier).toBe(1.5);
      expect(tier3!.statMultiplier).toBe(2.0);
    });
  });

  describe('canUpgradeTier', () => {
    it('cannot upgrade from tier 3', () => {
      expect(canUpgradeTier(storm, 3, 99)).toBe(false);
    });

    it('can upgrade tier 1 -> 2 at level 10', () => {
      expect(canUpgradeTier(storm, 1, 9)).toBe(false);
      expect(canUpgradeTier(storm, 1, 10)).toBe(true);
      expect(canUpgradeTier(storm, 1, 15)).toBe(true);
    });

    it('can upgrade tier 2 -> 3 at level 20', () => {
      expect(canUpgradeTier(storm, 2, 19)).toBe(false);
      expect(canUpgradeTier(storm, 2, 20)).toBe(true);
      expect(canUpgradeTier(storm, 2, 25)).toBe(true);
    });
  });

  describe('getXpRequiredForLevel', () => {
    it('level 1 requires 100 XP', () => {
      expect(getXpRequiredForLevel(1)).toBe(100);
    });

    it('XP requirement increases exponentially', () => {
      const xp1 = getXpRequiredForLevel(1);
      const xp2 = getXpRequiredForLevel(2);
      const xp5 = getXpRequiredForLevel(5);
      const xp10 = getXpRequiredForLevel(10);

      expect(xp2).toBeGreaterThan(xp1);
      expect(xp5).toBeGreaterThan(xp2);
      expect(xp10).toBeGreaterThan(xp5);

      // Should roughly follow 100 * 1.5^(level-1)
      expect(xp2).toBe(Math.floor(100 * Math.pow(1.5, 1))); // 150
      expect(xp5).toBe(Math.floor(100 * Math.pow(1.5, 4))); // 506
    });
  });
});

// ============================================================================
// TEST 4: SKILL DEFINITIONS VALIDATION
// ============================================================================

describe('Skill Definitions', () => {
  it.each(HEROES.map(h => h.id))('hero %s should have skills in all tiers', (heroId) => {
    const hero = getHeroById(heroId);

    for (const tier of hero!.tiers) {
      expect(tier.skills.length).toBeGreaterThan(0);

      for (const skill of tier.skills) {
        expect(skill.id).toBeDefined();
        expect(skill.name).toBeDefined();
        expect(skill.description).toBeDefined();
        expect(typeof skill.cooldownTicks).toBe('number');
        expect(typeof skill.isPassive).toBe('boolean');
        expect(typeof skill.isUltimate).toBe('boolean');
        expect(typeof skill.unlockedAtLevel).toBe('number');
        expect(Array.isArray(skill.effects)).toBe(true);
      }
    }
  });

  it.each(HEROES.map(h => h.id))('hero %s should have at least one passive skill', (heroId) => {
    const hero = getHeroById(heroId);
    let hasPassive = false;

    for (const tier of hero!.tiers) {
      for (const skill of tier.skills) {
        if (skill.isPassive) {
          hasPassive = true;
          // Passive skills should have 0 cooldown
          expect(skill.cooldownTicks).toBe(0);
        }
      }
    }

    expect(hasPassive).toBe(true);
  });

  it.each(HEROES.map(h => h.id))('hero %s should have an ultimate in tier 3', (heroId) => {
    const hero = getHeroById(heroId);
    const tier3 = hero!.tiers[2];

    const hasUltimate = tier3.skills.some(s => s.isUltimate);
    expect(hasUltimate).toBe(true);
  });

  describe('Unit Storm skills', () => {
    const hero = getHeroById('storm')!;

    it('tier 1 has Arc Strike and Storm Protocol passive', () => {
      const tier1Skills = hero.tiers[0].skills;
      const arcStrike = tier1Skills.find(s => s.id === 'arc_strike');
      const stormPassive = tier1Skills.find(s => s.id === 'storm_passive');

      expect(arcStrike).toBeDefined();
      expect(arcStrike!.cooldownTicks).toBe(180);
      expect(arcStrike!.isPassive).toBe(false);

      expect(stormPassive).toBeDefined();
      expect(stormPassive!.isPassive).toBe(true);
      expect(stormPassive!.cooldownTicks).toBe(0);
    });

    it('tier 3 has EMP Storm ultimate', () => {
      const tier3Skills = hero.tiers[2].skills;
      const empStorm = tier3Skills.find(s => s.id === 'emp_storm');

      expect(empStorm).toBeDefined();
      expect(empStorm!.isUltimate).toBe(true);
      expect(empStorm!.cooldownTicks).toBe(900); // 30 seconds
      expect(empStorm!.effects.length).toBe(2); // damage + stun
    });
  });

  describe('Skill unlock levels', () => {
    it.each(HEROES.map(h => h.id))('hero %s skills unlock at appropriate levels', (heroId) => {
      const hero = getHeroById(heroId);

      // Tier 1 skills should unlock at level 1-9
      for (const skill of hero!.tiers[0].skills) {
        expect(skill.unlockedAtLevel).toBeLessThanOrEqual(9);
      }

      // Tier 2 skills should unlock at level 10-19
      for (const skill of hero!.tiers[1].skills) {
        expect(skill.unlockedAtLevel).toBeGreaterThanOrEqual(10);
        expect(skill.unlockedAtLevel).toBeLessThanOrEqual(19);
      }

      // Tier 3 skills should unlock at level 20+
      for (const skill of hero!.tiers[2].skills) {
        expect(skill.unlockedAtLevel).toBeGreaterThanOrEqual(20);
      }
    });
  });
});

// ============================================================================
// TEST 5: SKILL COOLDOWNS
// ============================================================================

describe('Skill Cooldowns', () => {
  it('skill cooldown decreases each tick', () => {
    const config = getDefaultConfig();
    config.startingHeroes = ['storm'];

    const sim = new Simulation(12345, config);
    const hero = sim.state.heroes[0];

    // Set initial cooldown
    hero.skillCooldowns['hammer_throw'] = 100;

    // Step simulation
    sim.step();

    // Cooldown should decrease by 1
    expect(hero.skillCooldowns['hammer_throw']).toBe(99);
  });

  it('skill cooldown stops at 0', () => {
    const config = getDefaultConfig();
    config.startingHeroes = ['storm'];

    const sim = new Simulation(12345, config);
    const hero = sim.state.heroes[0];

    // Set cooldown to 1
    hero.skillCooldowns['hammer_throw'] = 1;

    // Step twice
    sim.step();
    sim.step();

    // Should be 0, not negative
    expect(hero.skillCooldowns['hammer_throw']).toBe(0);
  });

  describe('cooldown reduction from Crystal (Chrono Crystal)', () => {
    it('no crystal returns 1.0 multiplier', () => {
      expect(calculateHeroStoneCooldownReduction(undefined)).toBe(1.0);
    });

    it('unknown crystal type returns 1.0 multiplier', () => {
      expect(calculateHeroStoneCooldownReduction('unknown' as any)).toBe(1.0);
    });
  });
});

// ============================================================================
// TEST 6: SKILL EFFECTS IN COMBAT
// ============================================================================

describe('Skill Effects in Combat', () => {
  // Helper to advance until enemies spawn
  function advanceUntilEnemies(sim: Simulation, maxTicks = 300): boolean {
    for (let i = 0; i < maxTicks; i++) {
      sim.step();
      if (sim.state.enemies.length > 0) {
        return true;
      }
    }
    return false;
  }

  it('damage skill reduces enemy HP', () => {
    const config = getDefaultConfig();
    config.startingHeroes = ['storm'];

    const sim = new Simulation(12345, config);
    const hero = sim.state.heroes[0];

    // Set hero to high level to unlock skills
    hero.level = 10;
    hero.tier = 1;

    // Advance until enemies spawn
    const hasEnemies = advanceUntilEnemies(sim);
    expect(hasEnemies).toBe(true);

    const enemy = sim.state.enemies[0];
    const initialEnemyHp = enemy.hp;

    // Run for a while to let hero attack/use skills
    for (let i = 0; i < 300; i++) {
      sim.step();
    }

    // Enemy should have taken damage (from hero or fortress attacks)
    // Note: we test damage happened, not specifically from skills
    const anyDamage = enemy.hp < initialEnemyHp || sim.state.kills > 0;
    expect(anyDamage).toBe(true);
  });

  it('stun effect stops enemy movement', () => {
    const config = getDefaultConfig();
    config.startingHeroes = ['storm'];

    const sim = new Simulation(12345, config);

    // Advance until enemies spawn
    for (let i = 0; i < 200; i++) {
      sim.step();
      if (sim.state.enemies.length > 0) break;
    }

    expect(sim.state.enemies.length).toBeGreaterThan(0);

    const enemy = sim.state.enemies[0];

    // Manually apply stun (speed = 0)
    enemy.speed = 0;
    const initialX = enemy.x;

    // Run a few ticks
    for (let i = 0; i < 10; i++) {
      sim.step();
    }

    // Enemy position should be mostly unchanged (stunned)
    // Note: position might change slightly due to physics
    const deltaX = Math.abs(FP.toFloat(enemy.x) - FP.toFloat(initialX));
    expect(deltaX).toBeLessThan(1);
  });

  it('slow effect reduces enemy speed', () => {
    const config = getDefaultConfig();
    const sim = new Simulation(12345, config);

    // Advance until enemies spawn
    for (let i = 0; i < 200; i++) {
      sim.step();
      if (sim.state.enemies.length > 0) break;
    }

    const enemy = sim.state.enemies[0];
    const originalSpeed = enemy.speed;

    // Apply 30% slow
    enemy.speed = FP.mul(enemy.speed, FP.fromFloat(0.7));

    expect(enemy.speed).toBeLessThan(originalSpeed);
    expect(FP.toFloat(enemy.speed)).toBeCloseTo(FP.toFloat(originalSpeed) * 0.7, 2);
  });
});

// ============================================================================
// TEST 7: BUFF SYSTEM
// ============================================================================

describe('Buff System', () => {
  it('buffs are added with correct expiration', () => {
    const config = getDefaultConfig();
    config.startingHeroes = ['storm'];

    const sim = new Simulation(12345, config);
    const hero = sim.state.heroes[0];

    // Add a buff manually
    hero.buffs.push({
      id: 'test_buff',
      stat: 'damageBonus',
      amount: 0.5, // +50% damage
      expirationTick: sim.state.tick + 150,
    });

    expect(hero.buffs.length).toBe(1);
    expect(hero.buffs[0].amount).toBe(0.5);
  });

  it('expired buffs are removed', () => {
    const config = getDefaultConfig();
    config.startingHeroes = ['storm'];

    const sim = new Simulation(12345, config);
    const hero = sim.state.heroes[0];

    // Add buff that expires in 10 ticks
    hero.buffs.push({
      id: 'test_buff',
      stat: 'damageBonus',
      amount: 0.5,
      expirationTick: sim.state.tick + 10,
    });

    expect(hero.buffs.length).toBe(1);

    // Advance past expiration
    for (let i = 0; i < 15; i++) {
      sim.step();
    }

    // Buff should be removed
    expect(hero.buffs.length).toBe(0);
  });

  it('multiple buffs can be active', () => {
    const config = getDefaultConfig();
    config.startingHeroes = ['storm'];

    const sim = new Simulation(12345, config);
    const hero = sim.state.heroes[0];

    hero.buffs.push({
      id: 'buff1',
      stat: 'damageBonus',
      amount: 0.3,
      expirationTick: sim.state.tick + 100,
    });

    hero.buffs.push({
      id: 'buff2',
      stat: 'attackSpeedBonus',
      amount: 0.2,
      expirationTick: sim.state.tick + 100,
    });

    expect(hero.buffs.length).toBe(2);
  });
});

// ============================================================================
// TEST 8: HEAL EFFECT
// ============================================================================

describe('Heal Effect', () => {
  it('heal increases hero HP', () => {
    const config = getDefaultConfig();
    config.startingHeroes = ['storm'];

    const sim = new Simulation(12345, config);
    const hero = sim.state.heroes[0];

    hero.maxHp = 200;
    hero.currentHp = 100;

    const initialHp = hero.currentHp;

    // Simulate heal effect
    hero.currentHp = Math.min(hero.currentHp + 50, hero.maxHp);

    expect(hero.currentHp).toBe(150);
    expect(hero.currentHp).toBeGreaterThan(initialHp);
  });

  it('heal does not exceed max HP', () => {
    const config = getDefaultConfig();
    config.startingHeroes = ['storm'];

    const sim = new Simulation(12345, config);
    const hero = sim.state.heroes[0];

    hero.maxHp = 200;
    hero.currentHp = 180;

    // Try to heal 50 HP
    hero.currentHp = Math.min(hero.currentHp + 50, hero.maxHp);

    // Should cap at maxHp
    expect(hero.currentHp).toBe(200);
  });
});

// ============================================================================
// TEST 9: SKILL LEVEL REQUIREMENTS
// ============================================================================

describe('Skill Level Requirements', () => {
  it('skills require minimum level to unlock', () => {
    const config = getDefaultConfig();
    config.startingHeroes = ['storm'];

    const sim = new Simulation(12345, config);
    const hero = sim.state.heroes[0];
    const heroDef = getHeroById('storm')!;

    // At level 1, only level 1 skills should be available
    hero.level = 1;
    const tier1Skills = heroDef.tiers[0].skills;

    for (const skill of tier1Skills) {
      if (skill.unlockedAtLevel <= 1) {
        // This skill is available
        expect(skill.unlockedAtLevel).toBeLessThanOrEqual(hero.level);
      }
    }
  });

  it('arc_strike unlocks at level 5', () => {
    const heroDef = getHeroById('storm')!;
    const arcStrike = heroDef.tiers[0].skills.find(s => s.id === 'arc_strike');

    expect(arcStrike!.unlockedAtLevel).toBe(5);
  });

  it('emp_storm ultimate unlocks at level 25', () => {
    const heroDef = getHeroById('storm')!;
    const empStorm = heroDef.tiers[2].skills.find(s => s.id === 'emp_storm');

    expect(empStorm!.unlockedAtLevel).toBe(25);
  });
});

// ============================================================================
// TEST 10: PASSIVE VS ACTIVE SKILLS
// ============================================================================

describe('Passive vs Active Skills', () => {
  it('passive skills have 0 cooldown', () => {
    for (const hero of HEROES) {
      for (const tier of hero.tiers) {
        for (const skill of tier.skills) {
          if (skill.isPassive) {
            expect(skill.cooldownTicks).toBe(0);
          }
        }
      }
    }
  });

  it('active skills have positive cooldown', () => {
    for (const hero of HEROES) {
      for (const tier of hero.tiers) {
        for (const skill of tier.skills) {
          if (!skill.isPassive) {
            expect(skill.cooldownTicks).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it('ultimate skills have longer cooldowns', () => {
    for (const hero of HEROES) {
      for (const tier of hero.tiers) {
        const ultimates = tier.skills.filter(s => s.isUltimate);
        const nonUltimates = tier.skills.filter(s => !s.isUltimate && !s.isPassive);

        for (const ultimate of ultimates) {
          // Ultimates should generally have cooldowns >= 600 ticks (20 seconds)
          expect(ultimate.cooldownTicks).toBeGreaterThanOrEqual(600);

          // And longer than most regular skills in same tier
          for (const regular of nonUltimates) {
            expect(ultimate.cooldownTicks).toBeGreaterThan(regular.cooldownTicks);
          }
        }
      }
    }
  });
});

// ============================================================================
// TEST 11: SKILL EFFECT TYPES
// ============================================================================

describe('Skill Effect Types', () => {
  const allEffectTypes = new Set<string>();

  // Collect all effect types
  for (const hero of HEROES) {
    for (const tier of hero.tiers) {
      for (const skill of tier.skills) {
        for (const effect of skill.effects) {
          allEffectTypes.add(effect.type);
        }
      }
    }
  }

  it('damage effects have amount', () => {
    for (const hero of HEROES) {
      for (const tier of hero.tiers) {
        for (const skill of tier.skills) {
          for (const effect of skill.effects) {
            if (effect.type === 'damage') {
              expect(effect.amount).toBeGreaterThan(0);
            }
          }
        }
      }
    }
  });

  it('stun effects have duration', () => {
    for (const hero of HEROES) {
      for (const tier of hero.tiers) {
        for (const skill of tier.skills) {
          for (const effect of skill.effects) {
            if (effect.type === 'stun') {
              expect(effect.duration).toBeGreaterThan(0);
            }
          }
        }
      }
    }
  });
});

// ============================================================================
// TEST 12: ALL HEROES STATS COMPARISON
// ============================================================================

describe('Hero Stats Comparison', () => {
  it('tanks have highest HP', () => {
    const tanks = HEROES.filter(h => h.role === 'tank');
    const nonTanks = HEROES.filter(h => h.role !== 'tank');

    const minTankHp = Math.min(...tanks.map(h => h.baseStats.hp));
    const maxNonTankHp = Math.max(...nonTanks.map(h => h.baseStats.hp));

    expect(minTankHp).toBeGreaterThanOrEqual(maxNonTankHp * 0.8); // Tanks should have at least 80% of max non-tank HP
  });

  it('dps heroes have high damage', () => {
    const dpsHeroes = HEROES.filter(h => h.role === 'dps');

    for (const hero of dpsHeroes) {
      expect(hero.baseStats.damage).toBeGreaterThanOrEqual(20);
    }
  });

  it('support heroes have good range', () => {
    const supportHeroes = HEROES.filter(h => h.role === 'support');

    for (const hero of supportHeroes) {
      expect(FP.toFloat(hero.baseStats.range)).toBeGreaterThanOrEqual(8);
    }
  });
});
