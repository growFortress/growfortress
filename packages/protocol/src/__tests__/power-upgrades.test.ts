/**
 * Power Upgrades Protocol Schema Tests
 */
import { describe, it, expect } from 'vitest';
import {
  StatUpgradesSchema,
  ItemTierSchema,
  FortressUpgradableStatSchema,
  HeroUpgradableStatSchema,
  TurretUpgradableStatSchema,
  UpgradeFortressStatRequestSchema,
  UpgradeHeroStatRequestSchema,
  UpgradeTurretStatRequestSchema,
  UpgradeItemTierRequestSchema,
  PowerUpgradeResponseSchema,
  PowerBreakdownSchema,
  EntityPowerSchema,
  PowerSummaryResponseSchema,
  UpgradeCostInfoSchema,
  AvailableUpgradesResponseSchema,
} from '../power-upgrades.js';

describe('StatUpgradesSchema', () => {
  it('accepts valid stat upgrades', () => {
    const valid = {
      hp: 5,
      damage: 10,
      attackSpeed: 3,
      range: 0,
      critChance: 2,
      critMultiplier: 1,
      armor: 4,
      dodge: 0,
    };

    const result = StatUpgradesSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('applies defaults for missing values', () => {
    const partial = {};

    const result = StatUpgradesSchema.safeParse(partial);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hp).toBe(0);
      expect(result.data.damage).toBe(0);
    }
  });

  it('rejects negative values', () => {
    const invalid = {
      hp: -1,
      damage: 0,
      attackSpeed: 0,
      range: 0,
      critChance: 0,
      critMultiplier: 0,
      armor: 0,
      dodge: 0,
    };

    const result = StatUpgradesSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects non-integer values', () => {
    const invalid = {
      hp: 1.5,
      damage: 0,
      attackSpeed: 0,
      range: 0,
      critChance: 0,
      critMultiplier: 0,
      armor: 0,
      dodge: 0,
    };

    const result = StatUpgradesSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('ItemTierSchema', () => {
  it('accepts all valid tiers', () => {
    expect(ItemTierSchema.safeParse('common').success).toBe(true);
    expect(ItemTierSchema.safeParse('uncommon').success).toBe(true);
    expect(ItemTierSchema.safeParse('rare').success).toBe(true);
    expect(ItemTierSchema.safeParse('epic').success).toBe(true);
    expect(ItemTierSchema.safeParse('legendary').success).toBe(true);
  });

  it('rejects invalid tier', () => {
    expect(ItemTierSchema.safeParse('mythic').success).toBe(false);
    expect(ItemTierSchema.safeParse('').success).toBe(false);
    expect(ItemTierSchema.safeParse(123).success).toBe(false);
  });
});

describe('FortressUpgradableStatSchema', () => {
  it('accepts valid fortress stats (simplified)', () => {
    const validStats = ['hp', 'damage', 'armor'];
    for (const stat of validStats) {
      expect(FortressUpgradableStatSchema.safeParse(stat).success).toBe(true);
    }
  });

  it('rejects removed stats', () => {
    expect(FortressUpgradableStatSchema.safeParse('attackSpeed').success).toBe(false);
    expect(FortressUpgradableStatSchema.safeParse('critChance').success).toBe(false);
    expect(FortressUpgradableStatSchema.safeParse('critMultiplier').success).toBe(false);
    expect(FortressUpgradableStatSchema.safeParse('range').success).toBe(false);
    expect(FortressUpgradableStatSchema.safeParse('dodge').success).toBe(false);
  });
});

describe('HeroUpgradableStatSchema', () => {
  it('accepts valid hero stats (4 main stats)', () => {
    const validStats = ['damage', 'attackSpeed', 'range', 'critChance'];
    for (const stat of validStats) {
      expect(HeroUpgradableStatSchema.safeParse(stat).success).toBe(true);
    }
  });

  it('rejects removed stats', () => {
    expect(HeroUpgradableStatSchema.safeParse('hp').success).toBe(false);
    expect(HeroUpgradableStatSchema.safeParse('critMultiplier').success).toBe(false);
    expect(HeroUpgradableStatSchema.safeParse('armor').success).toBe(false);
    expect(HeroUpgradableStatSchema.safeParse('dodge').success).toBe(false);
  });
});

describe('TurretUpgradableStatSchema', () => {
  it('accepts valid turret stats (simplified)', () => {
    const validStats = ['damage', 'attackSpeed'];
    for (const stat of validStats) {
      expect(TurretUpgradableStatSchema.safeParse(stat).success).toBe(true);
    }
  });

  it('rejects removed stats', () => {
    expect(TurretUpgradableStatSchema.safeParse('range').success).toBe(false);
    expect(TurretUpgradableStatSchema.safeParse('critChance').success).toBe(false);
    expect(TurretUpgradableStatSchema.safeParse('hp').success).toBe(false);
    expect(TurretUpgradableStatSchema.safeParse('armor').success).toBe(false);
  });
});

describe('UpgradeFortressStatRequestSchema', () => {
  it('accepts valid request', () => {
    const valid = { stat: 'hp' };
    const result = UpgradeFortressStatRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects missing stat', () => {
    const invalid = {};
    const result = UpgradeFortressStatRequestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects invalid stat type', () => {
    const invalid = { stat: 'range' };
    const result = UpgradeFortressStatRequestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('UpgradeHeroStatRequestSchema', () => {
  it('accepts valid request', () => {
    const valid = { heroId: 'storm', stat: 'damage' };
    const result = UpgradeHeroStatRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects empty heroId', () => {
    const invalid = { heroId: '', stat: 'damage' };
    const result = UpgradeHeroStatRequestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects missing stat', () => {
    const invalid = { heroId: 'storm' };
    const result = UpgradeHeroStatRequestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('UpgradeTurretStatRequestSchema', () => {
  it('accepts valid request', () => {
    const valid = { turretType: 'arrow', stat: 'damage' };
    const result = UpgradeTurretStatRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects empty turretType', () => {
    const invalid = { turretType: '', stat: 'damage' };
    const result = UpgradeTurretStatRequestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('UpgradeItemTierRequestSchema', () => {
  it('accepts valid request', () => {
    const valid = { itemId: 'mjolnir' };
    const result = UpgradeItemTierRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects empty itemId', () => {
    const invalid = { itemId: '' };
    const result = UpgradeItemTierRequestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('PowerUpgradeResponseSchema', () => {
  it('accepts successful upgrade response', () => {
    const valid = {
      success: true,
      newLevel: 5,
      goldSpent: 500,
      newGold: 9500,
      newTotalPower: 1500,
    };
    const result = PowerUpgradeResponseSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('accepts item tier upgrade response', () => {
    const valid = {
      success: true,
      newTier: 'rare',
      goldSpent: 1000,
      newGold: 9000,
      newTotalPower: 2000,
    };
    const result = PowerUpgradeResponseSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('accepts error response', () => {
    const valid = {
      success: false,
      goldSpent: 0,
      newGold: 10000,
      newTotalPower: 1000,
      error: 'Insufficient gold',
    };
    const result = PowerUpgradeResponseSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});

describe('PowerBreakdownSchema', () => {
  it('accepts valid breakdown', () => {
    const valid = {
      basePower: 100,
      upgradeMultiplier: 1.5,
      tierMultiplier: 1.25,
      totalPower: 187,
    };
    const result = PowerBreakdownSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects missing fields', () => {
    const invalid = {
      basePower: 100,
      upgradeMultiplier: 1.5,
    };
    const result = PowerBreakdownSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('EntityPowerSchema', () => {
  it('accepts valid entity power', () => {
    const valid = {
      id: 'storm',
      power: {
        basePower: 200,
        upgradeMultiplier: 1.3,
        tierMultiplier: 1.5,
        totalPower: 390,
      },
    };
    const result = EntityPowerSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});

describe('PowerSummaryResponseSchema', () => {
  it('accepts valid power summary', () => {
    const valid = {
      fortressPower: {
        basePower: 100,
        upgradeMultiplier: 1.0,
        tierMultiplier: 1.0,
        totalPower: 100,
      },
      heroPower: [
        {
          id: 'storm',
          power: {
            basePower: 200,
            upgradeMultiplier: 1.2,
            tierMultiplier: 1.0,
            totalPower: 240,
          },
        },
      ],
      turretPower: [],
      itemPower: 50,
      totalPower: 390,
      fortressUpgrades: {
        hp: 0,
        damage: 0,
        attackSpeed: 0,
        range: 0,
        critChance: 0,
        critMultiplier: 0,
        armor: 0,
        dodge: 0,
      },
      heroUpgrades: [
        {
          heroId: 'storm',
          statUpgrades: {
            hp: 0,
            damage: 5,
            attackSpeed: 0,
            range: 0,
            critChance: 0,
            critMultiplier: 0,
            armor: 0,
            dodge: 0,
          },
        },
      ],
      turretUpgrades: [],
      itemTiers: [{ itemId: 'mjolnir', tier: 'common' }],
    };
    const result = PowerSummaryResponseSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('accepts minimal valid response', () => {
    const valid = {
      fortressPower: {
        basePower: 100,
        upgradeMultiplier: 1.0,
        tierMultiplier: 1.0,
        totalPower: 100,
      },
      heroPower: [],
      turretPower: [],
      itemPower: 0,
      totalPower: 100,
      fortressUpgrades: {},
      heroUpgrades: [],
      turretUpgrades: [],
      itemTiers: [],
    };
    const result = PowerSummaryResponseSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});

describe('UpgradeCostInfoSchema', () => {
  it('accepts valid upgrade cost info', () => {
    const valid = {
      stat: 'hp',
      currentLevel: 5,
      maxLevel: 50,
      nextUpgradeCost: 350,
      currentBonusPercent: 27.6,
      nextBonusPercent: 31.0,
    };
    const result = UpgradeCostInfoSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('accepts null for max level reached', () => {
    const valid = {
      stat: 'hp',
      currentLevel: 50,
      maxLevel: 50,
      nextUpgradeCost: null,
      currentBonusPercent: 250.0,
      nextBonusPercent: null,
    };
    const result = UpgradeCostInfoSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});

describe('AvailableUpgradesResponseSchema', () => {
  it('accepts valid available upgrades', () => {
    const valid = {
      gold: 10000,
      fortressUpgrades: [
        {
          stat: 'hp',
          currentLevel: 0,
          maxLevel: 50,
          nextUpgradeCost: 100,
          currentBonusPercent: 0,
          nextBonusPercent: 5.0,
        },
      ],
      heroUpgrades: {
        thunderlord: [
          {
            stat: 'damage',
            currentLevel: 3,
            maxLevel: 30,
            nextUpgradeCost: 180,
            currentBonusPercent: 6.1,
            nextBonusPercent: 8.2,
          },
        ],
      },
      turretUpgrades: {
        arrow: [
          {
            stat: 'damage',
            currentLevel: 0,
            maxLevel: 25,
            nextUpgradeCost: 40,
            currentBonusPercent: 0,
            nextBonusPercent: 2.5,
          },
        ],
      },
      itemUpgrades: [
        {
          itemId: 'mjolnir',
          currentTier: 'common',
          nextTier: 'uncommon',
          upgradeCost: 500,
        },
      ],
    };
    const result = AvailableUpgradesResponseSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('accepts empty upgrades', () => {
    const valid = {
      gold: 0,
      fortressUpgrades: [],
      heroUpgrades: {},
      turretUpgrades: {},
      itemUpgrades: [],
    };
    const result = AvailableUpgradesResponseSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('accepts legendary item (no next tier)', () => {
    const valid = {
      gold: 10000,
      fortressUpgrades: [],
      heroUpgrades: {},
      turretUpgrades: {},
      itemUpgrades: [
        {
          itemId: 'excalibur',
          currentTier: 'legendary',
          nextTier: null,
          upgradeCost: null,
        },
      ],
    };
    const result = AvailableUpgradesResponseSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});
