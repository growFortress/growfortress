/**
 * Guild Structures Service Tests
 *
 * Tests for structure-based guild progression:
 * - Cost calculations
 * - Bonus calculations (member capacity, gold, XP, stat)
 * - Structure info retrieval
 * - Structure upgrades
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    guild: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    guildMember: {
      findUnique: vi.fn(),
    },
    guildTreasury: {
      update: vi.fn(),
    },
    guildTreasuryLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn({
      guild: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      guildMember: {
        findUnique: vi.fn(),
      },
      guildTreasury: {
        update: vi.fn(),
      },
      guildTreasuryLog: {
        create: vi.fn(),
      },
    })),
  },
}));

// Mock guildPreview for cache invalidation
vi.mock('../../../services/guildPreview.js', () => ({
  invalidateGuildPreviewCache: vi.fn(),
}));

import {
  getUpgradeCost,
  getMemberCapacity,
  getGoldBonus,
  getXpBonus,
  getStatBonus,
  getGuildBonusesFromStructures,
  getStructuresInfo,
  upgradeStructure,
} from '../../../services/guildStructures.js';
import { prisma } from '../../../lib/prisma.js';
import { GUILD_CONSTANTS } from '@arcade/protocol';

describe('Guild Structures Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // COST CALCULATIONS
  // ============================================================================

  describe('getUpgradeCost', () => {
    it('should return null for max level', () => {
      const cost = getUpgradeCost(GUILD_CONSTANTS.STRUCTURE_MAX_LEVEL);
      expect(cost).toBeNull();
    });

    it('should calculate cost for level 0 upgrade', () => {
      const cost = getUpgradeCost(0);
      expect(cost).not.toBeNull();
      // Level 0 -> 1: gold = 500 * 1 * 1 = 500, dust = 25 * 1 = 25
      expect(cost!.gold).toBe(GUILD_CONSTANTS.STRUCTURE_UPGRADE_BASE_GOLD * 1);
      expect(cost!.dust).toBe(GUILD_CONSTANTS.STRUCTURE_UPGRADE_BASE_DUST * 1);
    });

    it('should calculate cost for level 5 upgrade', () => {
      const cost = getUpgradeCost(5);
      expect(cost).not.toBeNull();
      // Level 5 -> 6: gold = 500 * 6 * 6 = 18000, dust = 25 * 6 = 150
      const nextLevel = 6;
      expect(cost!.gold).toBe(GUILD_CONSTANTS.STRUCTURE_UPGRADE_BASE_GOLD * nextLevel * nextLevel);
      expect(cost!.dust).toBe(GUILD_CONSTANTS.STRUCTURE_UPGRADE_BASE_DUST * nextLevel);
    });

    it('should calculate cost for level 19 upgrade', () => {
      const cost = getUpgradeCost(19);
      expect(cost).not.toBeNull();
      // Level 19 -> 20: gold = 500 * 20 * 20 = 200000, dust = 25 * 20 = 500
      const nextLevel = 20;
      expect(cost!.gold).toBe(GUILD_CONSTANTS.STRUCTURE_UPGRADE_BASE_GOLD * nextLevel * nextLevel);
      expect(cost!.dust).toBe(GUILD_CONSTANTS.STRUCTURE_UPGRADE_BASE_DUST * nextLevel);
    });

    it('should have increasing costs with level', () => {
      const cost5 = getUpgradeCost(5);
      const cost10 = getUpgradeCost(10);
      expect(cost10!.gold).toBeGreaterThan(cost5!.gold);
      expect(cost10!.dust).toBeGreaterThan(cost5!.dust);
    });
  });

  // ============================================================================
  // BONUS CALCULATIONS
  // ============================================================================

  describe('getMemberCapacity', () => {
    it('should return base capacity for level 0', () => {
      const capacity = getMemberCapacity(0);
      expect(capacity).toBe(GUILD_CONSTANTS.MEMBER_BASE_CAPACITY);
    });

    it('should increase by 1 per level', () => {
      const capacity5 = getMemberCapacity(5);
      const capacity6 = getMemberCapacity(6);
      expect(capacity6 - capacity5).toBe(1);
    });

    it('should return max capacity at max level', () => {
      const capacity = getMemberCapacity(GUILD_CONSTANTS.STRUCTURE_MAX_LEVEL);
      expect(capacity).toBe(GUILD_CONSTANTS.MEMBER_BASE_CAPACITY + GUILD_CONSTANTS.STRUCTURE_MAX_LEVEL);
    });
  });

  describe('getGoldBonus', () => {
    it('should return 0 for level 0', () => {
      const bonus = getGoldBonus(0);
      expect(bonus).toBe(0);
    });

    it('should return 1% per level', () => {
      const bonus = getGoldBonus(1);
      expect(bonus).toBe(GUILD_CONSTANTS.STRUCTURE_BONUS_PER_LEVEL);
    });

    it('should return 20% at max level', () => {
      const bonus = getGoldBonus(GUILD_CONSTANTS.STRUCTURE_MAX_LEVEL);
      expect(bonus).toBe(GUILD_CONSTANTS.STRUCTURE_MAX_LEVEL * GUILD_CONSTANTS.STRUCTURE_BONUS_PER_LEVEL);
    });
  });

  describe('getXpBonus', () => {
    it('should return 0 for level 0', () => {
      const bonus = getXpBonus(0);
      expect(bonus).toBe(0);
    });

    it('should return 1% per level', () => {
      const bonus = getXpBonus(5);
      expect(bonus).toBe(5 * GUILD_CONSTANTS.STRUCTURE_BONUS_PER_LEVEL);
    });

    it('should return max bonus at max level', () => {
      const bonus = getXpBonus(GUILD_CONSTANTS.STRUCTURE_MAX_LEVEL);
      expect(bonus).toBe(GUILD_CONSTANTS.STRUCTURE_MAX_LEVEL * GUILD_CONSTANTS.STRUCTURE_BONUS_PER_LEVEL);
    });
  });

  describe('getStatBonus', () => {
    it('should return 0 for level 0', () => {
      const bonus = getStatBonus(0);
      expect(bonus).toBe(0);
    });

    it('should return 1% per level', () => {
      const bonus = getStatBonus(10);
      expect(bonus).toBe(10 * GUILD_CONSTANTS.STRUCTURE_BONUS_PER_LEVEL);
    });

    it('should return max bonus at max level', () => {
      const bonus = getStatBonus(GUILD_CONSTANTS.STRUCTURE_MAX_LEVEL);
      expect(bonus).toBe(GUILD_CONSTANTS.STRUCTURE_MAX_LEVEL * GUILD_CONSTANTS.STRUCTURE_BONUS_PER_LEVEL);
    });
  });

  describe('getGuildBonusesFromStructures', () => {
    it('should return all zero bonuses for level 0 structures', () => {
      const bonuses = getGuildBonusesFromStructures({
        kwatera: 0,
        skarbiec: 0,
        akademia: 0,
        zbrojownia: 0,
      });

      expect(bonuses.goldBoost).toBe(0);
      expect(bonuses.statBoost).toBe(0);
      expect(bonuses.xpBoost).toBe(0);
    });

    it('should calculate bonuses from different structure levels', () => {
      const bonuses = getGuildBonusesFromStructures({
        kwatera: 5,
        skarbiec: 10,
        akademia: 15,
        zbrojownia: 20,
      });

      expect(bonuses.goldBoost).toBe(10 * GUILD_CONSTANTS.STRUCTURE_BONUS_PER_LEVEL);
      expect(bonuses.xpBoost).toBe(15 * GUILD_CONSTANTS.STRUCTURE_BONUS_PER_LEVEL);
      expect(bonuses.statBoost).toBe(20 * GUILD_CONSTANTS.STRUCTURE_BONUS_PER_LEVEL);
    });

    it('should ignore kwatera for bonuses (only affects member capacity)', () => {
      const bonuses = getGuildBonusesFromStructures({
        kwatera: 20,
        skarbiec: 0,
        akademia: 0,
        zbrojownia: 0,
      });

      // kwatera doesn't affect gold/xp/stat bonuses
      expect(bonuses.goldBoost).toBe(0);
      expect(bonuses.xpBoost).toBe(0);
      expect(bonuses.statBoost).toBe(0);
    });
  });

  // ============================================================================
  // STRUCTURE INFO
  // ============================================================================

  describe('getStructuresInfo', () => {
    it('should return empty array for non-existent guild', async () => {
      vi.mocked(prisma.guild.findUnique).mockResolvedValue(null);

      const info = await getStructuresInfo('non-existent');

      expect(info).toEqual([]);
    });

    it('should return info for all four structures', async () => {
      vi.mocked(prisma.guild.findUnique).mockResolvedValue({
        id: 'guild-1',
        structureKwatera: 5,
        structureSkarbiec: 3,
        structureAkademia: 7,
        structureZbrojownia: 2,
        treasury: {
          gold: 10000,
          dust: 500,
        },
      } as any);

      const info = await getStructuresInfo('guild-1');

      expect(info).toHaveLength(4);
      expect(info.map((s) => s.type)).toEqual(['kwatera', 'skarbiec', 'akademia', 'zbrojownia']);
    });

    it('should include correct levels for each structure', async () => {
      vi.mocked(prisma.guild.findUnique).mockResolvedValue({
        id: 'guild-1',
        structureKwatera: 5,
        structureSkarbiec: 3,
        structureAkademia: 7,
        structureZbrojownia: 2,
        treasury: { gold: 10000, dust: 500 },
      } as any);

      const info = await getStructuresInfo('guild-1');

      expect(info.find((s) => s.type === 'kwatera')!.level).toBe(5);
      expect(info.find((s) => s.type === 'skarbiec')!.level).toBe(3);
      expect(info.find((s) => s.type === 'akademia')!.level).toBe(7);
      expect(info.find((s) => s.type === 'zbrojownia')!.level).toBe(2);
    });

    it('should calculate canAfford correctly', async () => {
      // Cost for level 0 -> 1 is 500 gold, 25 dust
      vi.mocked(prisma.guild.findUnique).mockResolvedValue({
        id: 'guild-1',
        structureKwatera: 0,
        structureSkarbiec: 0,
        structureAkademia: 0,
        structureZbrojownia: 0,
        treasury: { gold: 1000, dust: 50 },
      } as any);

      const info = await getStructuresInfo('guild-1');

      // Should be able to afford level 1 upgrade
      expect(info.every((s) => s.canAfford)).toBe(true);
    });

    it('should set canAfford false when treasury is insufficient', async () => {
      vi.mocked(prisma.guild.findUnique).mockResolvedValue({
        id: 'guild-1',
        structureKwatera: 0,
        structureSkarbiec: 0,
        structureAkademia: 0,
        structureZbrojownia: 0,
        treasury: { gold: 100, dust: 10 }, // Not enough
      } as any);

      const info = await getStructuresInfo('guild-1');

      expect(info.every((s) => s.canAfford)).toBe(false);
    });

    it('should include current and next bonus values', async () => {
      vi.mocked(prisma.guild.findUnique).mockResolvedValue({
        id: 'guild-1',
        structureKwatera: 5,
        structureSkarbiec: 10,
        structureAkademia: 15,
        structureZbrojownia: 19,
        treasury: { gold: 100000, dust: 10000 },
      } as any);

      const info = await getStructuresInfo('guild-1');

      const skarbiec = info.find((s) => s.type === 'skarbiec')!;
      expect(skarbiec.currentBonus).toBe(10 * GUILD_CONSTANTS.STRUCTURE_BONUS_PER_LEVEL);
      expect(skarbiec.nextBonus).toBe(11 * GUILD_CONSTANTS.STRUCTURE_BONUS_PER_LEVEL);
    });

    it('should have null nextBonus at max level', async () => {
      vi.mocked(prisma.guild.findUnique).mockResolvedValue({
        id: 'guild-1',
        structureKwatera: 20,
        structureSkarbiec: 20,
        structureAkademia: 20,
        structureZbrojownia: 20,
        treasury: { gold: 0, dust: 0 },
      } as any);

      const info = await getStructuresInfo('guild-1');

      expect(info.every((s) => s.nextBonus === null)).toBe(true);
      expect(info.every((s) => s.upgradeCost === null)).toBe(true);
    });
  });

  // ============================================================================
  // UPGRADE STRUCTURE
  // ============================================================================

  describe('upgradeStructure', () => {
    it('should fail for non-existent guild', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          guild: { findUnique: vi.fn().mockResolvedValue(null) },
          guildMember: { findUnique: vi.fn() },
          guildTreasury: { update: vi.fn() },
          guildTreasuryLog: { create: vi.fn() },
        };
        return fn(tx);
      });

      const result = await upgradeStructure('guild-1', 'user-1', 'kwatera');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should fail for non-leader', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          guild: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'guild-1',
              disbanded: false,
              structureKwatera: 0,
              treasury: { gold: 10000, dust: 500 },
            }),
            update: vi.fn(),
          },
          guildMember: {
            findUnique: vi.fn().mockResolvedValue({
              userId: 'user-1',
              guildId: 'guild-1',
              role: 'MEMBER', // Not leader
            }),
          },
          guildTreasury: { update: vi.fn() },
          guildTreasuryLog: { create: vi.fn() },
        };
        return fn(tx);
      });

      const result = await upgradeStructure('guild-1', 'user-1', 'kwatera');

      expect(result.success).toBe(false);
    });

    it('should fail at max level', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          guild: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'guild-1',
              disbanded: false,
              structureKwatera: GUILD_CONSTANTS.STRUCTURE_MAX_LEVEL, // Already max
              treasury: { gold: 100000, dust: 10000 },
            }),
            update: vi.fn(),
          },
          guildMember: {
            findUnique: vi.fn().mockResolvedValue({
              userId: 'user-1',
              guildId: 'guild-1',
              role: 'LEADER',
            }),
          },
          guildTreasury: { update: vi.fn() },
          guildTreasuryLog: { create: vi.fn() },
        };
        return fn(tx);
      });

      const result = await upgradeStructure('guild-1', 'user-1', 'kwatera');

      expect(result.success).toBe(false);
    });

    it('should fail with insufficient treasury', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          guild: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'guild-1',
              disbanded: false,
              structureKwatera: 0,
              treasury: { gold: 100, dust: 10 }, // Not enough
            }),
            update: vi.fn(),
          },
          guildMember: {
            findUnique: vi.fn().mockResolvedValue({
              userId: 'user-1',
              guildId: 'guild-1',
              role: 'LEADER',
            }),
          },
          guildTreasury: { update: vi.fn() },
          guildTreasuryLog: { create: vi.fn() },
        };
        return fn(tx);
      });

      const result = await upgradeStructure('guild-1', 'user-1', 'kwatera');

      expect(result.success).toBe(false);
    });

    it('should successfully upgrade structure with sufficient treasury', async () => {
      const mockGuildUpdate = vi.fn().mockResolvedValue({});
      const mockTreasuryUpdate = vi.fn().mockResolvedValue({});
      const mockLogCreate = vi.fn().mockResolvedValue({});

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          guild: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'guild-1',
              disbanded: false,
              structureKwatera: 5,
              treasury: { gold: 50000, dust: 1000 }, // Enough
            }),
            update: mockGuildUpdate,
          },
          guildMember: {
            findUnique: vi.fn().mockResolvedValue({
              userId: 'user-1',
              guildId: 'guild-1',
              role: 'LEADER',
            }),
          },
          guildTreasury: { update: mockTreasuryUpdate },
          guildTreasuryLog: { create: mockLogCreate },
        };
        return fn(tx);
      });

      const result = await upgradeStructure('guild-1', 'user-1', 'kwatera');

      expect(result.success).toBe(true);
    });

    it('should fail for disbanded guild', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          guild: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'guild-1',
              disbanded: true, // Disbanded
              structureKwatera: 5,
              treasury: { gold: 50000, dust: 1000 },
            }),
            update: vi.fn(),
          },
          guildMember: {
            findUnique: vi.fn().mockResolvedValue({
              userId: 'user-1',
              guildId: 'guild-1',
              role: 'LEADER',
            }),
          },
          guildTreasury: { update: vi.fn() },
          guildTreasuryLog: { create: vi.fn() },
        };
        return fn(tx);
      });

      const result = await upgradeStructure('guild-1', 'user-1', 'kwatera');

      expect(result.success).toBe(false);
    });

    it('should fail if user not a member', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          guild: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'guild-1',
              disbanded: false,
              structureKwatera: 5,
              treasury: { gold: 50000, dust: 1000 },
            }),
            update: vi.fn(),
          },
          guildMember: {
            findUnique: vi.fn().mockResolvedValue(null), // Not a member
          },
          guildTreasury: { update: vi.fn() },
          guildTreasuryLog: { create: vi.fn() },
        };
        return fn(tx);
      });

      const result = await upgradeStructure('guild-1', 'user-1', 'kwatera');

      expect(result.success).toBe(false);
    });

    it('should fail if user in different guild', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          guild: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'guild-1',
              disbanded: false,
              structureKwatera: 5,
              treasury: { gold: 50000, dust: 1000 },
            }),
            update: vi.fn(),
          },
          guildMember: {
            findUnique: vi.fn().mockResolvedValue({
              userId: 'user-1',
              guildId: 'different-guild', // Different guild
              role: 'LEADER',
            }),
          },
          guildTreasury: { update: vi.fn() },
          guildTreasuryLog: { create: vi.fn() },
        };
        return fn(tx);
      });

      const result = await upgradeStructure('guild-1', 'user-1', 'kwatera');

      expect(result.success).toBe(false);
    });

    it('should upgrade skarbiec structure', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          guild: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'guild-1',
              disbanded: false,
              structureSkarbiec: 10,
              treasury: { gold: 100000, dust: 2000 },
            }),
            update: vi.fn().mockResolvedValue({}),
          },
          guildMember: {
            findUnique: vi.fn().mockResolvedValue({
              userId: 'user-1',
              guildId: 'guild-1',
              role: 'LEADER',
            }),
          },
          guildTreasury: { update: vi.fn().mockResolvedValue({}) },
          guildTreasuryLog: { create: vi.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      const result = await upgradeStructure('guild-1', 'user-1', 'skarbiec');

      expect(result.success).toBe(true);
    });

    it('should upgrade akademia structure', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          guild: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'guild-1',
              disbanded: false,
              structureAkademia: 7,
              treasury: { gold: 50000, dust: 1000 },
            }),
            update: vi.fn().mockResolvedValue({}),
          },
          guildMember: {
            findUnique: vi.fn().mockResolvedValue({
              userId: 'user-1',
              guildId: 'guild-1',
              role: 'LEADER',
            }),
          },
          guildTreasury: { update: vi.fn().mockResolvedValue({}) },
          guildTreasuryLog: { create: vi.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      const result = await upgradeStructure('guild-1', 'user-1', 'akademia');

      expect(result.success).toBe(true);
    });

    it('should upgrade zbrojownia structure', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          guild: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'guild-1',
              disbanded: false,
              structureZbrojownia: 15,
              treasury: { gold: 150000, dust: 3000 },
            }),
            update: vi.fn().mockResolvedValue({}),
          },
          guildMember: {
            findUnique: vi.fn().mockResolvedValue({
              userId: 'user-1',
              guildId: 'guild-1',
              role: 'LEADER',
            }),
          },
          guildTreasury: { update: vi.fn().mockResolvedValue({}) },
          guildTreasuryLog: { create: vi.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      const result = await upgradeStructure('guild-1', 'user-1', 'zbrojownia');

      expect(result.success).toBe(true);
    });

    it('should fail with insufficient dust but enough gold', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          guild: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'guild-1',
              disbanded: false,
              structureKwatera: 5,
              treasury: { gold: 100000, dust: 5 }, // Not enough dust
            }),
            update: vi.fn(),
          },
          guildMember: {
            findUnique: vi.fn().mockResolvedValue({
              userId: 'user-1',
              guildId: 'guild-1',
              role: 'LEADER',
            }),
          },
          guildTreasury: { update: vi.fn() },
          guildTreasuryLog: { create: vi.fn() },
        };
        return fn(tx);
      });

      const result = await upgradeStructure('guild-1', 'user-1', 'kwatera');

      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // MEMBER CAPACITY EDGE CASES
  // ============================================================================

  describe('getMemberCapacity - edge cases', () => {
    it('should handle negative level gracefully', () => {
      // Negative level should still compute (even if invalid input)
      const capacity = getMemberCapacity(-1);
      expect(capacity).toBe(GUILD_CONSTANTS.MEMBER_BASE_CAPACITY - 1);
    });

    it('should handle very high level', () => {
      const capacity = getMemberCapacity(100);
      expect(capacity).toBe(GUILD_CONSTANTS.MEMBER_BASE_CAPACITY + 100);
    });
  });

  // ============================================================================
  // BONUS CALCULATIONS EDGE CASES
  // ============================================================================

  describe('bonus calculations - edge cases', () => {
    it('should handle negative levels in getGoldBonus', () => {
      const bonus = getGoldBonus(-5);
      expect(bonus).toBe(-5 * GUILD_CONSTANTS.STRUCTURE_BONUS_PER_LEVEL);
    });

    it('should handle very high levels in getXpBonus', () => {
      const bonus = getXpBonus(100);
      expect(bonus).toBe(100 * GUILD_CONSTANTS.STRUCTURE_BONUS_PER_LEVEL);
    });

    it('should handle very high levels in getStatBonus', () => {
      const bonus = getStatBonus(100);
      expect(bonus).toBe(100 * GUILD_CONSTANTS.STRUCTURE_BONUS_PER_LEVEL);
    });
  });

  // ============================================================================
  // getGuildBonusesFromStructures EDGE CASES
  // ============================================================================

  describe('getGuildBonusesFromStructures - edge cases', () => {
    it('should handle max level structures', () => {
      const bonuses = getGuildBonusesFromStructures({
        kwatera: GUILD_CONSTANTS.STRUCTURE_MAX_LEVEL,
        skarbiec: GUILD_CONSTANTS.STRUCTURE_MAX_LEVEL,
        akademia: GUILD_CONSTANTS.STRUCTURE_MAX_LEVEL,
        zbrojownia: GUILD_CONSTANTS.STRUCTURE_MAX_LEVEL,
      });

      const maxBonus = GUILD_CONSTANTS.STRUCTURE_MAX_LEVEL * GUILD_CONSTANTS.STRUCTURE_BONUS_PER_LEVEL;
      expect(bonuses.goldBoost).toBe(maxBonus);
      expect(bonuses.xpBoost).toBe(maxBonus);
      expect(bonuses.statBoost).toBe(maxBonus);
    });

    it('should handle asymmetric structure levels', () => {
      const bonuses = getGuildBonusesFromStructures({
        kwatera: 20,
        skarbiec: 5,
        akademia: 10,
        zbrojownia: 15,
      });

      expect(bonuses.goldBoost).toBe(5 * GUILD_CONSTANTS.STRUCTURE_BONUS_PER_LEVEL);
      expect(bonuses.xpBoost).toBe(10 * GUILD_CONSTANTS.STRUCTURE_BONUS_PER_LEVEL);
      expect(bonuses.statBoost).toBe(15 * GUILD_CONSTANTS.STRUCTURE_BONUS_PER_LEVEL);
    });
  });
});
