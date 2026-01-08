import { describe, it, expect } from 'vitest';
import type { InfinityStoneType } from '../../types.js';
import {
  INFINITY_STONE_DEFINITIONS,
  FRAGMENTS_PER_STONE,
  INFINITY_GAUNTLET,
  getStoneById,
  canUseInfinityGauntlet,
  calculateFragmentBonus,
  canCraftFullStone,
  getStoneDropLocations,
  getFragmentDropChance,
  rollStoneDrop,
} from '../../data/infinity-stones.js';
import { Simulation, getDefaultConfig } from '../../simulation.js';
import { createEnemy } from '../helpers/factories.js';

const ALL_STONES: InfinityStoneType[] = [
  'power',
  'space',
  'time',
  'reality',
  'soul',
  'mind',
];

describe('Infinity Stones data', () => {
  it('defines all stone types once', () => {
    const ids = INFINITY_STONE_DEFINITIONS.map(stone => stone.id);
    expect([...ids].sort()).toEqual([...ALL_STONES].sort());
  });

  it('getStoneById returns definition for each stone', () => {
    for (const stoneType of ALL_STONES) {
      const stone = getStoneById(stoneType);
      expect(stone).toBeDefined();
      expect(stone?.id).toBe(stoneType);
    }
  });

  it('getStoneById returns undefined for unknown stone', () => {
    expect(getStoneById('unknown' as InfinityStoneType)).toBeUndefined();
  });

  it('calculateFragmentBonus returns undefined for zero or unknown stone', () => {
    expect(calculateFragmentBonus('power', 0)).toBeUndefined();
    expect(calculateFragmentBonus('power', -1)).toBeUndefined();
    expect(
      calculateFragmentBonus('unknown' as InfinityStoneType, 1)
    ).toBeUndefined();
  });

  it('calculateFragmentBonus caps at FRAGMENTS_PER_STONE - 1', () => {
    const power = getStoneById('power')!;
    const perFragment = power.fragmentEffect.valuePerFragment;

    expect(calculateFragmentBonus('power', 1)?.value).toBe(perFragment);
    expect(calculateFragmentBonus('power', 9)?.value).toBe(perFragment * 9);
    // With FRAGMENTS_PER_STONE = 10, cap is at 9 fragments
    expect(calculateFragmentBonus('power', 10)?.value).toBe(perFragment * 9);
  });

  it('canCraftFullStone matches fragment threshold', () => {
    expect(canCraftFullStone(FRAGMENTS_PER_STONE - 1)).toBe(false);
    expect(canCraftFullStone(FRAGMENTS_PER_STONE)).toBe(true);
    expect(canCraftFullStone(FRAGMENTS_PER_STONE + 1)).toBe(true);
  });

  it('getStoneDropLocations returns empty for unknown stone', () => {
    expect(getStoneDropLocations('unknown' as InfinityStoneType)).toEqual([]);
  });

  it('getFragmentDropChance returns 5x full drop chance', () => {
    const power = getStoneById('power')!;
    const corvusChance = power.dropLocations.find(
      loc => loc.bossId === 'corvus_glaive'
    )?.dropChance;

    expect(corvusChance).toBeDefined();
    expect(getFragmentDropChance('power', 'corvus_glaive')).toBe(
      (corvusChance as number) * 5
    );
  });

  it('getFragmentDropChance returns 0 for unknown boss', () => {
    expect(getFragmentDropChance('power', 'unknown_boss')).toBe(0);
  });

  it('rollStoneDrop returns null for boss with no drops', () => {
    expect(rollStoneDrop('modok', 'science', 0.1)).toBeNull();
  });

  it('rollStoneDrop respects pillar filter', () => {
    expect(rollStoneDrop('corvus_glaive', 'magic', 0.01)).toBeNull();
  });

  it('rollStoneDrop returns full stone when roll is below full chance', () => {
    // Full stone chance is 33 FP ≈ 0.2%, so roll must be < 0.002
    const drop = rollStoneDrop('corvus_glaive', 'cosmos', 0.001);
    expect(drop).toEqual({ stoneType: 'power', isFullStone: true });
  });

  it('rollStoneDrop returns fragment when roll is between full and fragment chance', () => {
    // Fragment chance is 328 FP ≈ 2%, full stone is 33 FP ≈ 0.2%
    // Roll of 0.01 gives 163 which is between 33 and 328
    const drop = rollStoneDrop('corvus_glaive', 'cosmos', 0.01);
    expect(drop).toEqual({ stoneType: 'power', isFullStone: false });
  });

  it('canUseInfinityGauntlet requires tier, artifact, all stones, and commander level 40+', () => {
    const stones = [...ALL_STONES];
    expect(canUseInfinityGauntlet(2, true, stones, 40)).toBe(false); // tier too low
    expect(canUseInfinityGauntlet(3, false, stones, 40)).toBe(false); // no artifact
    expect(canUseInfinityGauntlet(3, true, stones.slice(0, 5), 40)).toBe(false); // missing stones
    expect(canUseInfinityGauntlet(3, true, stones, 39)).toBe(false); // commander level too low
    expect(canUseInfinityGauntlet(3, true, stones, 40)).toBe(true); // all requirements met
  });
});

describe('Infinity Stones in Simulation', () => {
  const setRngValue = (sim: Simulation, value: number) => {
    (sim as any).rng = { nextFloat: () => value };
  };

  it('adds full stone and clears fragments on full drop', () => {
    const sim = new Simulation(1, getDefaultConfig());
    sim.state.currentPillar = 'cosmos';
    sim.state.wave = 0;
    sim.state.infinityStoneFragments = [{ stoneType: 'power', count: 2 }];

    // Full stone needs roll < 33 FP, so rngValue < 0.002
    setRngValue(sim, 0.001);
    (sim as any).processBossStoneDrop('cosmic_beast');

    expect(sim.state.collectedStones).toContain('power');
    expect(
      sim.state.infinityStoneFragments.find(f => f.stoneType === 'power')
    ).toBeUndefined();
  });

  it('crafts full stone when fragments reach threshold', () => {
    const sim = new Simulation(1, getDefaultConfig());
    sim.state.currentPillar = 'cosmos';
    sim.state.wave = 0;
    // With FRAGMENTS_PER_STONE = 10, we need 9 fragments + 1 to craft
    sim.state.infinityStoneFragments = [
      { stoneType: 'power', count: FRAGMENTS_PER_STONE - 1 },
    ];

    // Fragment drop: roll between 33 and 328 FP, so rngValue between 0.002 and 0.02
    setRngValue(sim, 0.01);
    (sim as any).processBossStoneDrop('cosmic_beast');

    expect(sim.state.collectedStones).toContain('power');
    expect(
      sim.state.infinityStoneFragments.find(f => f.stoneType === 'power')
    ).toBeUndefined();
  });

  it('ignores fragment drops when stone already collected', () => {
    const sim = new Simulation(1, getDefaultConfig());
    sim.state.currentPillar = 'cosmos';
    sim.state.wave = 0;
    sim.state.collectedStones = ['power'];

    // Even with a roll that would give a fragment (0.01 = 163 FP, between 33 and 328)
    // No fragment should be added since we already have the power stone
    setRngValue(sim, 0.01);
    (sim as any).processBossStoneDrop('cosmic_beast');

    expect(sim.state.infinityStoneFragments).toHaveLength(0);
    expect(sim.state.collectedStones).toEqual(['power']);
  });

  it('assembles gauntlet when all stones are collected', () => {
    const sim = new Simulation(1, getDefaultConfig());
    sim.state.currentPillar = 'cosmos';
    sim.state.wave = 0;
    sim.state.collectedStones = ['space', 'time', 'reality', 'soul', 'mind'];

    // Full stone needs roll < 33 FP, so rngValue < 0.002
    setRngValue(sim, 0.001);
    (sim as any).processBossStoneDrop('cosmic_beast');

    expect(sim.state.gauntletState).not.toBeNull();
    expect(sim.state.gauntletState?.isAssembled).toBe(true);
    expect([...(sim.state.gauntletState?.stonesCollected ?? [])].sort()).toEqual(
      [...ALL_STONES].sort()
    );
    expect(sim.state.gauntletState?.snapCooldown).toBe(0);
    expect(sim.state.gauntletState?.snapUsedCount).toBe(0);
  });

  it('executeSnap returns false when gauntlet is not assembled', () => {
    const sim = new Simulation(1, getDefaultConfig());
    sim.state.enemies = [createEnemy({ id: 1 }), createEnemy({ id: 2 })];

    expect(sim.executeSnap()).toBe(false);
  });

  it('executeSnap returns false while on cooldown', () => {
    const sim = new Simulation(1, getDefaultConfig());
    sim.state.gauntletState = {
      isAssembled: true,
      stonesCollected: [...ALL_STONES],
      snapCooldown: 2,
      snapUsedCount: 0,
    };
    sim.state.enemies = [createEnemy({ id: 1 }), createEnemy({ id: 2 })];

    expect(sim.executeSnap()).toBe(false);
  });

  it('executeSnap deals 30% damage to all enemies and sets cooldown', () => {
    const sim = new Simulation(1, getDefaultConfig());
    sim.state.gauntletState = {
      isAssembled: true,
      stonesCollected: [...ALL_STONES],
      snapCooldown: 0,
      snapUsedCount: 0,
    };
    sim.state.enemies = [
      createEnemy({ id: 1, hp: 20, maxHp: 20 }),
      createEnemy({ id: 2, hp: 20, maxHp: 20 }),
      createEnemy({ id: 3, hp: 20, maxHp: 20 }),
      createEnemy({ id: 4, hp: 20, maxHp: 20 }),
    ];

    expect(sim.executeSnap()).toBe(true);
    // SNAP deals 30% of maxHp damage to ALL enemies
    // 30% of 20 = 6 damage, so 20 - 6 = 14 HP remaining
    expect(sim.state.enemies[0].hp).toBe(14);
    expect(sim.state.enemies[1].hp).toBe(14);
    expect(sim.state.enemies[2].hp).toBe(14);
    expect(sim.state.enemies[3].hp).toBe(14);
    expect(sim.state.gauntletState?.snapCooldown).toBe(
      INFINITY_GAUNTLET.snapAbility.cooldownWaves
    );
    expect(sim.state.gauntletState?.snapUsedCount).toBe(1);
  });
});
