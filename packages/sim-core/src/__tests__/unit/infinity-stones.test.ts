import { describe, it, expect } from 'vitest';
import type { CrystalType } from '../../types.js';
import {
  CRYSTAL_DEFINITIONS,
  FRAGMENTS_PER_STONE,
  CRYSTAL_MATRIX,
  getCrystalById,
  canUseCrystalMatrix,
  calculateFragmentBonus,
  canCraftFullCrystal,
  getCrystalDropLocations,
  getFragmentDropChance,
  rollCrystalDrop,
  // Legacy aliases for backwards compatibility tests
  INFINITY_STONE_DEFINITIONS,
  INFINITY_GAUNTLET,
  getStoneById,
  canUseInfinityGauntlet,
  canCraftFullStone,
  getStoneDropLocations,
  rollStoneDrop,
} from '../../data/crystals.js';
import { Simulation, getDefaultConfig } from '../../simulation.js';
import { createEnemy } from '../helpers/factories.js';

const ALL_CRYSTALS: CrystalType[] = [
  'power',
  'space',
  'time',
  'reality',
  'soul',
  'mind',
];

describe('Crystal data', () => {
  it('defines all crystal types once', () => {
    const ids = CRYSTAL_DEFINITIONS.map(crystal => crystal.id);
    expect([...ids].sort()).toEqual([...ALL_CRYSTALS].sort());
  });

  it('getCrystalById returns definition for each crystal', () => {
    for (const crystalType of ALL_CRYSTALS) {
      const crystal = getCrystalById(crystalType);
      expect(crystal).toBeDefined();
      expect(crystal?.id).toBe(crystalType);
    }
  });

  it('getCrystalById returns undefined for unknown crystal', () => {
    expect(getCrystalById('unknown' as CrystalType)).toBeUndefined();
  });

  it('calculateFragmentBonus returns undefined for zero or unknown crystal', () => {
    expect(calculateFragmentBonus('power', 0)).toBeUndefined();
    expect(calculateFragmentBonus('power', -1)).toBeUndefined();
    expect(
      calculateFragmentBonus('unknown' as CrystalType, 1)
    ).toBeUndefined();
  });

  it('calculateFragmentBonus caps at FRAGMENTS_PER_STONE - 1', () => {
    const power = getCrystalById('power')!;
    const perFragment = power.fragmentEffect.valuePerFragment;

    expect(calculateFragmentBonus('power', 1)?.value).toBe(perFragment);
    expect(calculateFragmentBonus('power', 9)?.value).toBe(perFragment * 9);
    // With FRAGMENTS_PER_STONE = 10, cap is at 9 fragments
    expect(calculateFragmentBonus('power', 10)?.value).toBe(perFragment * 9);
  });

  it('canCraftFullCrystal matches fragment threshold', () => {
    expect(canCraftFullCrystal(FRAGMENTS_PER_STONE - 1)).toBe(false);
    expect(canCraftFullCrystal(FRAGMENTS_PER_STONE)).toBe(true);
    expect(canCraftFullCrystal(FRAGMENTS_PER_STONE + 1)).toBe(true);
  });

  it('getCrystalDropLocations returns empty for unknown crystal', () => {
    expect(getCrystalDropLocations('unknown' as CrystalType)).toEqual([]);
  });

  it('getFragmentDropChance returns 5x full drop chance', () => {
    const power = getCrystalById('power')!;
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

  it('rollCrystalDrop returns null for boss with no drops', () => {
    expect(rollCrystalDrop('modok', 'science', 0.1)).toBeNull();
  });

  it('rollCrystalDrop respects pillar filter', () => {
    expect(rollCrystalDrop('corvus_glaive', 'magic', 0.01)).toBeNull();
  });

  it('rollCrystalDrop returns full crystal when roll is below full chance', () => {
    // Full crystal chance is 33 FP ≈ 0.2%, so roll must be < 0.002
    const drop = rollCrystalDrop('corvus_glaive', 'cosmos', 0.001);
    expect(drop?.crystalType).toBe('power');
    expect(drop?.isFullCrystal).toBe(true);
  });

  it('rollCrystalDrop returns fragment when roll is between full and fragment chance', () => {
    // Fragment chance is 328 FP ≈ 2%, full crystal is 33 FP ≈ 0.2%
    // Roll of 0.01 gives 163 which is between 33 and 328
    const drop = rollCrystalDrop('corvus_glaive', 'cosmos', 0.01);
    expect(drop?.crystalType).toBe('power');
    expect(drop?.isFullCrystal).toBe(false);
  });

  it('canUseCrystalMatrix requires tier, artifact, all crystals, and commander level 40+', () => {
    const crystals = [...ALL_CRYSTALS];
    expect(canUseCrystalMatrix(2, true, crystals, 40)).toBe(false); // tier too low
    expect(canUseCrystalMatrix(3, false, crystals, 40)).toBe(false); // no artifact
    expect(canUseCrystalMatrix(3, true, crystals.slice(0, 5), 40)).toBe(false); // missing crystals
    expect(canUseCrystalMatrix(3, true, crystals, 39)).toBe(false); // commander level too low
    expect(canUseCrystalMatrix(3, true, crystals, 40)).toBe(true); // all requirements met
  });
});

describe('Legacy aliases', () => {
  it('INFINITY_STONE_DEFINITIONS equals CRYSTAL_DEFINITIONS', () => {
    expect(INFINITY_STONE_DEFINITIONS).toBe(CRYSTAL_DEFINITIONS);
  });

  it('getStoneById is an alias for getCrystalById', () => {
    expect(getStoneById('power')).toBe(getCrystalById('power'));
  });

  it('canCraftFullStone is an alias for canCraftFullCrystal', () => {
    expect(canCraftFullStone(10)).toBe(canCraftFullCrystal(10));
  });

  it('getStoneDropLocations is an alias for getCrystalDropLocations', () => {
    expect(getStoneDropLocations('power')).toEqual(getCrystalDropLocations('power'));
  });

  it('rollStoneDrop returns both old and new property names', () => {
    const drop = rollStoneDrop('corvus_glaive', 'cosmos', 0.001);
    expect(drop).not.toBeNull();
    // New properties
    expect(drop?.crystalType).toBe('power');
    expect(drop?.isFullCrystal).toBe(true);
    // Legacy properties
    expect(drop?.stoneType).toBe('power');
    expect(drop?.isFullStone).toBe(true);
  });

  it('canUseInfinityGauntlet is an alias for canUseCrystalMatrix', () => {
    const crystals = [...ALL_CRYSTALS];
    expect(canUseInfinityGauntlet(3, true, crystals, 40)).toBe(
      canUseCrystalMatrix(3, true, crystals, 40)
    );
  });

  it('INFINITY_GAUNTLET equals CRYSTAL_MATRIX', () => {
    expect(INFINITY_GAUNTLET).toBe(CRYSTAL_MATRIX);
  });
});

describe('Crystals in Simulation', () => {
  const setRngValue = (sim: Simulation, value: number) => {
    (sim as any).rng = { nextFloat: () => value };
  };

  it('adds full crystal and clears fragments on full drop', () => {
    const sim = new Simulation(1, getDefaultConfig());
    sim.state.currentPillar = 'cosmos';
    sim.state.wave = 0;
    sim.state.crystalFragments = [{ crystalType: 'power', count: 2 }];
    sim.state.infinityStoneFragments = sim.state.crystalFragments; // Legacy sync

    // Full crystal needs roll < 33 FP, so rngValue < 0.002
    setRngValue(sim, 0.001);
    (sim as any).processBossStoneDrop('cosmic_beast');

    expect(sim.state.collectedCrystals).toContain('power');
    expect(
      sim.state.crystalFragments.find(f => f.crystalType === 'power')
    ).toBeUndefined();
  });

  it('crafts full crystal when fragments reach threshold', () => {
    const sim = new Simulation(1, getDefaultConfig());
    sim.state.currentPillar = 'cosmos';
    sim.state.wave = 0;
    // With FRAGMENTS_PER_STONE = 10, we need 9 fragments + 1 to craft
    const fragment = { crystalType: 'power' as CrystalType, count: FRAGMENTS_PER_STONE - 1 };
    sim.state.crystalFragments = [fragment];
    sim.state.infinityStoneFragments = sim.state.crystalFragments; // Legacy sync

    // Fragment drop: roll between 33 and 328 FP, so rngValue between 0.002 and 0.02
    setRngValue(sim, 0.01);
    (sim as any).processBossStoneDrop('cosmic_beast');

    expect(sim.state.collectedCrystals).toContain('power');
    expect(
      sim.state.crystalFragments.find(f => f.crystalType === 'power')
    ).toBeUndefined();
  });

  it('ignores fragment drops when crystal already collected', () => {
    const sim = new Simulation(1, getDefaultConfig());
    sim.state.currentPillar = 'cosmos';
    sim.state.wave = 0;
    sim.state.collectedCrystals = ['power'];
    sim.state.collectedStones = [...sim.state.collectedCrystals]; // Legacy sync (copy)

    // Even with a roll that would give a fragment (0.01 = 163 FP, between 33 and 328)
    // No fragment should be added since we already have the power crystal
    setRngValue(sim, 0.01);
    (sim as any).processBossStoneDrop('cosmic_beast');

    expect(sim.state.crystalFragments).toHaveLength(0);
    expect(sim.state.collectedCrystals).toEqual(['power']);
  });

  it('assembles matrix when all crystals are collected', () => {
    const sim = new Simulation(1, getDefaultConfig());
    sim.state.currentPillar = 'cosmos';
    sim.state.wave = 0;
    sim.state.collectedCrystals = ['space', 'time', 'reality', 'soul', 'mind'];
    sim.state.collectedStones = [...sim.state.collectedCrystals]; // Legacy sync (copy, not reference)

    // Full crystal needs roll < 33 FP, so rngValue < 0.002
    setRngValue(sim, 0.001);
    (sim as any).processBossStoneDrop('cosmic_beast');

    expect(sim.state.matrixState).not.toBeNull();
    expect(sim.state.matrixState?.isAssembled).toBe(true);
    expect([...(sim.state.matrixState?.crystalsCollected ?? [])].sort()).toEqual(
      [...ALL_CRYSTALS].sort()
    );
    expect(sim.state.matrixState?.annihilationCooldown).toBe(0);
    expect(sim.state.matrixState?.annihilationUsedCount).toBe(0);
  });

  it('executeSnap returns false when matrix is not assembled', () => {
    const sim = new Simulation(1, getDefaultConfig());
    sim.state.enemies = [createEnemy({ id: 1 }), createEnemy({ id: 2 })];

    expect(sim.executeSnap()).toBe(false);
  });

  it('executeSnap returns false while on cooldown', () => {
    const sim = new Simulation(1, getDefaultConfig());
    sim.state.matrixState = {
      isAssembled: true,
      crystalsCollected: [...ALL_CRYSTALS],
      annihilationCooldown: 2,
      annihilationUsedCount: 0,
    };
    sim.state.gauntletState = sim.state.matrixState; // Legacy sync
    sim.state.enemies = [createEnemy({ id: 1 }), createEnemy({ id: 2 })];

    expect(sim.executeSnap()).toBe(false);
  });

  it('executeSnap deals 30% damage to all enemies and sets cooldown', () => {
    const sim = new Simulation(1, getDefaultConfig());
    sim.state.matrixState = {
      isAssembled: true,
      crystalsCollected: [...ALL_CRYSTALS],
      annihilationCooldown: 0,
      annihilationUsedCount: 0,
    };
    sim.state.gauntletState = sim.state.matrixState; // Legacy sync
    sim.state.enemies = [
      createEnemy({ id: 1, hp: 20, maxHp: 20 }),
      createEnemy({ id: 2, hp: 20, maxHp: 20 }),
      createEnemy({ id: 3, hp: 20, maxHp: 20 }),
      createEnemy({ id: 4, hp: 20, maxHp: 20 }),
    ];

    expect(sim.executeSnap()).toBe(true);
    // Annihilation Wave deals 30% of maxHp damage to ALL enemies
    // 30% of 20 = 6 damage, so 20 - 6 = 14 HP remaining
    expect(sim.state.enemies[0].hp).toBe(14);
    expect(sim.state.enemies[1].hp).toBe(14);
    expect(sim.state.enemies[2].hp).toBe(14);
    expect(sim.state.enemies[3].hp).toBe(14);
    expect(sim.state.matrixState?.annihilationCooldown).toBe(
      CRYSTAL_MATRIX.annihilationWave?.cooldownWaves ?? 3
    );
    expect(sim.state.matrixState?.annihilationUsedCount).toBe(1);
  });
});
