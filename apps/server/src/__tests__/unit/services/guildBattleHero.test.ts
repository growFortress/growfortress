/**
 * Guild Battle Hero Service Unit Tests
 *
 * Tests for Battle Hero validation, tier calculation, and power calculation
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  mockPrisma,
  createMockGuildMember,
  createMockInventory,
  createMockPowerUpgrades,
} from '../../mocks/prisma.js';

// Mock prisma
vi.mock('../../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

// Mock sim-core
vi.mock('@arcade/sim-core', () => ({
  getHeroById: vi.fn((heroId: string) => {
    if (heroId === 'invalid_hero') return null;
    return {
      id: heroId,
      name: 'Test Hero',
      tier: 1,
      baseStats: { hp: 100, damage: 20, attackSpeed: 1 },
    };
  }),
  calculateHeroPower: vi.fn().mockReturnValue({ totalPower: 1500 }),
  createDefaultStatUpgrades: vi.fn().mockReturnValue({
    hp: 0,
    damage: 0,
    attackSpeed: 0,
  }),
}));

// Mock protocol
vi.mock('@arcade/protocol', () => ({
  GUILD_ERROR_CODES: {
    NOT_IN_GUILD: 'NOT_IN_GUILD',
    HERO_NOT_UNLOCKED: 'HERO_NOT_UNLOCKED',
  },
  FREE_STARTER_HEROES: ['vanguard', 'fire_knight', 'ice_mage'],
}));

import {
  setBattleHero,
  getBattleHero,
  clearBattleHero,
  getGuildBattleRoster,
  getMembersWithBattleHeroes,
  createBattleHeroSnapshots,
  refreshBattleHeroPower,
  countMembersWithBattleHeroes,
} from '../../../services/guildBattleHero.js';
import { getHeroById, calculateHeroPower, createDefaultStatUpgrades } from '@arcade/sim-core';

describe('Guild Battle Hero Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-establish default mock implementations after clearing
    (getHeroById as ReturnType<typeof vi.fn>).mockImplementation((heroId: string) => {
      if (heroId === 'invalid_hero') return null;
      return {
        id: heroId,
        name: 'Test Hero',
        tier: 1,
        baseStats: { hp: 100, damage: 20, attackSpeed: 1 },
      };
    });
    (calculateHeroPower as ReturnType<typeof vi.fn>).mockReturnValue({ totalPower: 1500 });
    (createDefaultStatUpgrades as ReturnType<typeof vi.fn>).mockReturnValue({
      hp: 0,
      damage: 0,
      attackSpeed: 0,
    });
  });

  // ============================================================================
  // SET BATTLE HERO TESTS
  // ============================================================================

  describe('setBattleHero', () => {
    it('validates hero exists', async () => {
      (getHeroById as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

      const result = await setBattleHero('user-123', 'invalid_hero');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Hero not found');
    });

    it('allows free starter heroes without unlock', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember()
      );
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue(null);
      mockPrisma.guildMember.update.mockResolvedValue(createMockGuildMember());

      const result = await setBattleHero('user-123', 'vanguard');

      expect(result.success).toBe(true);
      // Should not check inventory for free heroes
    });

    it('requires unlock for non-free hero', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(
        createMockInventory({ unlockedHeroIds: [] })
      );

      const result = await setBattleHero('user-123', 'legendary_warrior');

      expect(result.success).toBe(false);
      expect(result.error).toBe('HERO_NOT_UNLOCKED');
    });

    it('allows unlocked non-free hero', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(
        createMockInventory({ unlockedHeroIds: ['legendary_warrior'] })
      );
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember()
      );
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue(null);
      mockPrisma.guildMember.update.mockResolvedValue(createMockGuildMember());

      const result = await setBattleHero('user-123', 'legendary_warrior');

      expect(result.success).toBe(true);
    });

    it('requires guild membership', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(
        createMockInventory({ unlockedHeroIds: ['legendary_warrior'] })
      );
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);

      const result = await setBattleHero('user-123', 'legendary_warrior');

      expect(result.success).toBe(false);
      expect(result.error).toBe('NOT_IN_GUILD');
    });

    it('calculates and stores hero power', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember()
      );
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue(null);
      mockPrisma.guildMember.update.mockResolvedValue(createMockGuildMember());

      (calculateHeroPower as ReturnType<typeof vi.fn>).mockReturnValue({
        totalPower: 2000,
      });

      const result = await setBattleHero('user-123', 'vanguard');

      expect(result.success).toBe(true);
      expect(result.battleHero?.power).toBe(2000);
      expect(mockPrisma.guildMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            battleHeroId: 'vanguard',
            battleHeroPower: 2000,
          }),
        })
      );
    });

    it('returns battle hero info on success', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember()
      );
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue(null);
      mockPrisma.guildMember.update.mockResolvedValue(createMockGuildMember());

      const result = await setBattleHero('user-123', 'vanguard');

      expect(result.success).toBe(true);
      expect(result.battleHero).toBeDefined();
      expect(result.battleHero?.heroId).toBe('vanguard');
      expect(result.battleHero?.tier).toBeDefined();
      expect(result.battleHero?.power).toBeDefined();
    });
  });

  // ============================================================================
  // TIER CALCULATION TESTS
  // ============================================================================

  describe('Tier Calculation', () => {
    it('common/uncommon items result in tier 1', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember()
      );
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue(
        createMockPowerUpgrades({
          heroUpgrades: '[]',
          itemTiers: JSON.stringify([
            { itemId: 'vanguard', tier: 'common' },
          ]),
        })
      );
      mockPrisma.guildMember.update.mockResolvedValue(createMockGuildMember());

      const result = await setBattleHero('user-123', 'vanguard');

      expect(result.success).toBe(true);
      expect(result.battleHero?.tier).toBe(1);
    });

    it('rare/epic items result in tier 2', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember()
      );
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue(
        createMockPowerUpgrades({
          heroUpgrades: '[]',
          itemTiers: JSON.stringify([
            { itemId: 'vanguard', tier: 'rare' },
          ]),
        })
      );
      mockPrisma.guildMember.update.mockResolvedValue(createMockGuildMember());

      const result = await setBattleHero('user-123', 'vanguard');

      expect(result.success).toBe(true);
      expect(result.battleHero?.tier).toBe(2);
    });

    it('legendary items result in tier 3', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember()
      );
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue(
        createMockPowerUpgrades({
          heroUpgrades: '[]',
          itemTiers: JSON.stringify([
            { itemId: 'vanguard', tier: 'legendary' },
          ]),
        })
      );
      mockPrisma.guildMember.update.mockResolvedValue(createMockGuildMember());

      const result = await setBattleHero('user-123', 'vanguard');

      expect(result.success).toBe(true);
      expect(result.battleHero?.tier).toBe(3);
    });

    it('defaults to tier 1 when no power upgrades exist', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember()
      );
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue(null);
      mockPrisma.guildMember.update.mockResolvedValue(createMockGuildMember());

      const result = await setBattleHero('user-123', 'vanguard');

      expect(result.success).toBe(true);
      expect(result.battleHero?.tier).toBe(1);
    });
  });

  // ============================================================================
  // POWER CALCULATION TESTS
  // ============================================================================

  describe('Power Calculation', () => {
    it('power is recalculated on setBattleHero', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember()
      );
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue(null);
      mockPrisma.guildMember.update.mockResolvedValue(createMockGuildMember());

      await setBattleHero('user-123', 'vanguard');

      expect(calculateHeroPower).toHaveBeenCalled();
    });

    it('power includes stat upgrades', async () => {
      const statUpgrades = { hp: 10, damage: 5, attackSpeed: 2 };

      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember()
      );
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue(
        createMockPowerUpgrades({
          heroUpgrades: JSON.stringify([
            { heroId: 'vanguard', statUpgrades },
          ]),
          itemTiers: '[]',
        })
      );
      mockPrisma.guildMember.update.mockResolvedValue(createMockGuildMember());

      await setBattleHero('user-123', 'vanguard');

      expect(calculateHeroPower).toHaveBeenCalledWith(
        'vanguard',
        statUpgrades,
        expect.any(Number)
      );
    });

    it('power scales with tier', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember()
      );
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue(
        createMockPowerUpgrades({
          heroUpgrades: '[]',
          itemTiers: JSON.stringify([
            { itemId: 'vanguard', tier: 'legendary' },
          ]),
        })
      );
      mockPrisma.guildMember.update.mockResolvedValue(createMockGuildMember());

      await setBattleHero('user-123', 'vanguard');

      // Should be called with tier 3
      expect(calculateHeroPower).toHaveBeenCalledWith(
        'vanguard',
        expect.any(Object),
        3
      );
    });
  });

  // ============================================================================
  // REFRESH BATTLE HERO POWER TESTS
  // ============================================================================

  describe('refreshBattleHeroPower', () => {
    it('does nothing if member has no battle hero', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ battleHeroId: null })
      );

      await refreshBattleHeroPower('user-123');

      expect(mockPrisma.guildMember.update).not.toHaveBeenCalled();
    });

    it('updates power after hero upgrade', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ battleHeroId: 'vanguard' })
      );
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue(null);
      mockPrisma.guildMember.update.mockResolvedValue(createMockGuildMember());

      (calculateHeroPower as ReturnType<typeof vi.fn>).mockReturnValue({
        totalPower: 3000,
      });

      await refreshBattleHeroPower('user-123');

      expect(mockPrisma.guildMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            battleHeroPower: 3000,
          }),
        })
      );
    });
  });

  // ============================================================================
  // GET/CLEAR BATTLE HERO TESTS
  // ============================================================================

  describe('getBattleHero', () => {
    it('returns null if member not found', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);

      const result = await getBattleHero('user-123');

      expect(result).toBeNull();
    });

    it('returns null if no battle hero set', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ battleHeroId: null })
      );

      const result = await getBattleHero('user-123');

      expect(result).toBeNull();
    });

    it('returns battle hero info if set', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        battleHeroId: 'thunder_lord',
        battleHeroTier: 2,
        battleHeroPower: 2500,
      });

      const result = await getBattleHero('user-123');

      expect(result).not.toBeNull();
      expect(result!.heroId).toBe('thunder_lord');
      expect(result!.tier).toBe(2);
      expect(result!.power).toBe(2500);
    });
  });

  describe('clearBattleHero', () => {
    it('requires guild membership', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);

      const result = await clearBattleHero('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('NOT_IN_GUILD');
    });

    it('clears battle hero on success', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember()
      );
      mockPrisma.guildMember.update.mockResolvedValue(createMockGuildMember());

      const result = await clearBattleHero('user-123');

      expect(result.success).toBe(true);
      expect(mockPrisma.guildMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            battleHeroId: null,
            battleHeroTier: null,
            battleHeroPower: null,
          }),
        })
      );
    });
  });

  // ============================================================================
  // ROSTER QUERIES TESTS
  // ============================================================================

  describe('Roster Queries', () => {
    describe('getGuildBattleRoster', () => {
      it('returns all members with battle hero info', async () => {
        mockPrisma.guildMember.findMany.mockResolvedValue([
          {
            userId: 'user-1',
            battleHeroId: 'vanguard',
            battleHeroTier: 2,
            battleHeroPower: 2000,
            role: 'LEADER',
            user: {
              displayName: 'Leader',
              highestWave: 50,
              createdAt: new Date(),
              powerUpgrades: { cachedTotalPower: 5000 },
              inventory: { unlockedHeroIds: ['vanguard', 'thunder_lord'] },
            },
          },
          {
            userId: 'user-2',
            battleHeroId: null,
            battleHeroTier: null,
            battleHeroPower: null,
            role: 'MEMBER',
            user: {
              displayName: 'Member',
              highestWave: 20,
              createdAt: new Date(),
              powerUpgrades: { cachedTotalPower: 1000 },
              inventory: { unlockedHeroIds: ['vanguard'] },
            },
          },
        ]);

        const roster = await getGuildBattleRoster('guild-123');

        expect(roster).toHaveLength(2);
        expect(roster[0].battleHero).not.toBeNull();
        expect(roster[1].battleHero).toBeNull();
      });

      it('orders by battle hero power desc', async () => {
        mockPrisma.guildMember.findMany.mockResolvedValue([]);

        await getGuildBattleRoster('guild-123');

        expect(mockPrisma.guildMember.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: expect.arrayContaining([
              { battleHeroPower: 'desc' },
            ]),
          })
        );
      });
    });

    describe('getMembersWithBattleHeroes', () => {
      it('only returns members with battle heroes', async () => {
        mockPrisma.guildMember.findMany.mockResolvedValue([
          {
            userId: 'user-1',
            battleHeroId: 'vanguard',
            battleHeroTier: 2,
            battleHeroPower: 2000,
            role: 'LEADER',
            user: {
              displayName: 'Leader',
              highestWave: 50,
              createdAt: new Date(),
              powerUpgrades: { cachedTotalPower: 5000 },
              inventory: { unlockedHeroIds: [] },
            },
          },
        ]);

        const members = await getMembersWithBattleHeroes('guild-123');

        expect(members).toHaveLength(1);
        expect(members[0].battleHero).not.toBeNull();
        expect(mockPrisma.guildMember.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              battleHeroId: { not: null },
            }),
          })
        );
      });
    });

    describe('countMembersWithBattleHeroes', () => {
      it('counts members with battle heroes', async () => {
        mockPrisma.guildMember.count.mockResolvedValue(5);

        const count = await countMembersWithBattleHeroes('guild-123');

        expect(count).toBe(5);
        expect(mockPrisma.guildMember.count).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              guildId: 'guild-123',
              battleHeroId: { not: null },
            }),
          })
        );
      });
    });
  });

  // ============================================================================
  // CREATE SNAPSHOTS TESTS
  // ============================================================================

  describe('createBattleHeroSnapshots', () => {
    it('creates snapshots for selected members', async () => {
      mockPrisma.guildMember.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          battleHeroId: 'vanguard',
          battleHeroTier: 2,
          battleHeroPower: 2000,
          user: { displayName: 'Player1' },
        },
        {
          userId: 'user-2',
          battleHeroId: 'thunder_lord',
          battleHeroTier: 1,
          battleHeroPower: 1500,
          user: { displayName: 'Player2' },
        },
      ]);

      mockPrisma.playerArtifact.findFirst.mockResolvedValue(null);

      const snapshots = await createBattleHeroSnapshots(['user-1', 'user-2']);

      expect(snapshots).toHaveLength(2);
      expect(snapshots[0].userId).toBe('user-1');
      expect(snapshots[0].heroId).toBe('vanguard');
      expect(snapshots[0].tier).toBe(2);
      expect(snapshots[0].power).toBe(2000);
    });

    it('includes equipped artifact if present', async () => {
      mockPrisma.guildMember.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          battleHeroId: 'vanguard',
          battleHeroTier: 2,
          battleHeroPower: 2000,
          user: { displayName: 'Player1' },
        },
      ]);

      mockPrisma.playerArtifact.findFirst.mockResolvedValue({
        artifactId: 'fire_sword',
      });

      const snapshots = await createBattleHeroSnapshots(['user-1']);

      expect(snapshots[0].equippedArtifactId).toBe('fire_sword');
    });

    it('handles members without equipped artifacts', async () => {
      mockPrisma.guildMember.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          battleHeroId: 'vanguard',
          battleHeroTier: 2,
          battleHeroPower: 2000,
          user: { displayName: 'Player1' },
        },
      ]);

      mockPrisma.playerArtifact.findFirst.mockResolvedValue(null);

      const snapshots = await createBattleHeroSnapshots(['user-1']);

      expect(snapshots[0].equippedArtifactId).toBeNull();
    });
  });
});
