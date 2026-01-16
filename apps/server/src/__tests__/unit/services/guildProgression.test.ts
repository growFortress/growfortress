/**
 * Guild Progression service unit tests
 * Tests trophy management functions
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../../../__tests__/helpers/setup.js';
import {
  checkAndAwardTrophies,
  awardChampionsTrophy,
  getTrophyBonuses,
} from '../../../services/guildProgression.js';
import {
  mockPrisma,
  createMockGuild,
  createMockGuildTreasury,
} from '../../mocks/prisma.js';

describe('Guild Progression Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // checkAndAwardTrophies
  // ============================================================================

  describe('checkAndAwardTrophies', () => {
    it('awards FIRST_BLOOD after 1 battle win', async () => {
      const guild = createMockGuild({ trophies: [] });
      mockPrisma.guild.findUnique.mockResolvedValue({
        ...guild,
        treasury: createMockGuildTreasury(),
        _count: { members: 5 },
      });
      mockPrisma.guildBattle.count.mockResolvedValue(1);
      mockPrisma.guild.update.mockResolvedValue(guild);

      const result = await checkAndAwardTrophies('guild-123');

      expect(result.newTrophies).toContain('FIRST_BLOOD');
    });

    it('awards BATTLE_HARDENED after 10 battle wins', async () => {
      const guild = createMockGuild({ trophies: ['FIRST_BLOOD'] });
      mockPrisma.guild.findUnique.mockResolvedValue({
        ...guild,
        treasury: createMockGuildTreasury(),
        _count: { members: 5 },
      });
      mockPrisma.guildBattle.count.mockResolvedValue(10);
      mockPrisma.guild.update.mockResolvedValue(guild);

      const result = await checkAndAwardTrophies('guild-123');

      expect(result.newTrophies).toContain('BATTLE_HARDENED');
    });

    it('awards WAR_MACHINE after 50 battle wins', async () => {
      const guild = createMockGuild({ trophies: ['FIRST_BLOOD', 'BATTLE_HARDENED'] });
      mockPrisma.guild.findUnique.mockResolvedValue({
        ...guild,
        treasury: createMockGuildTreasury(),
        _count: { members: 5 },
      });
      mockPrisma.guildBattle.count.mockResolvedValue(50);
      mockPrisma.guild.update.mockResolvedValue(guild);

      const result = await checkAndAwardTrophies('guild-123');

      expect(result.newTrophies).toContain('WAR_MACHINE');
    });

    it('awards WEALTHY at 1M gold deposited', async () => {
      const guild = createMockGuild({ trophies: [] });
      mockPrisma.guild.findUnique.mockResolvedValue({
        ...guild,
        treasury: createMockGuildTreasury({ totalGoldDeposited: BigInt(1000000) }),
        _count: { members: 5 },
      });
      mockPrisma.guildBattle.count.mockResolvedValue(0);
      mockPrisma.guild.update.mockResolvedValue(guild);

      const result = await checkAndAwardTrophies('guild-123');

      expect(result.newTrophies).toContain('WEALTHY');
    });

    it('awards UNITED at 30 members (max capacity)', async () => {
      const guild = createMockGuild({ trophies: [] });
      mockPrisma.guild.findUnique.mockResolvedValue({
        ...guild,
        treasury: createMockGuildTreasury(),
        _count: { members: 30 },
      });
      mockPrisma.guildBattle.count.mockResolvedValue(0);
      mockPrisma.guild.update.mockResolvedValue(guild);

      const result = await checkAndAwardTrophies('guild-123');

      expect(result.newTrophies).toContain('UNITED');
    });

    it('awards ANCIENT after 90 days', async () => {
      const guild = createMockGuild({
        trophies: [],
        createdAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000),
      });
      mockPrisma.guild.findUnique.mockResolvedValue({
        ...guild,
        treasury: createMockGuildTreasury(),
        _count: { members: 5 },
      });
      mockPrisma.guildBattle.count.mockResolvedValue(0);
      mockPrisma.guild.update.mockResolvedValue(guild);

      const result = await checkAndAwardTrophies('guild-123');

      expect(result.newTrophies).toContain('ANCIENT');
    });

    it('does not duplicate trophies', async () => {
      const guild = createMockGuild({ trophies: ['FIRST_BLOOD'] });
      mockPrisma.guild.findUnique.mockResolvedValue({
        ...guild,
        treasury: createMockGuildTreasury(),
        _count: { members: 5 },
      });
      mockPrisma.guildBattle.count.mockResolvedValue(5);
      mockPrisma.guild.update.mockResolvedValue(guild);

      const result = await checkAndAwardTrophies('guild-123');

      expect(result.newTrophies).not.toContain('FIRST_BLOOD');
    });

    it('handles disbanded guild', async () => {
      const guild = createMockGuild({ disbanded: true });
      mockPrisma.guild.findUnique.mockResolvedValue({
        ...guild,
        treasury: null,
        _count: { members: 0 },
      });

      const result = await checkAndAwardTrophies('guild-123');

      expect(result.newTrophies).toEqual([]);
    });
  });

  // ============================================================================
  // awardChampionsTrophy
  // ============================================================================

  describe('awardChampionsTrophy', () => {
    it('awards CHAMPIONS trophy', async () => {
      const guild = createMockGuild({ trophies: [] });
      mockPrisma.guild.findUnique.mockResolvedValue(guild);
      mockPrisma.guild.update.mockResolvedValue(guild);

      await awardChampionsTrophy('guild-123');

      expect(mockPrisma.guild.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            trophies: expect.arrayContaining(['CHAMPIONS']),
          }),
        })
      );
    });

    it('does not duplicate trophy', async () => {
      const guild = createMockGuild({ trophies: ['CHAMPIONS'] });
      mockPrisma.guild.findUnique.mockResolvedValue(guild);

      await awardChampionsTrophy('guild-123');

      expect(mockPrisma.guild.update).not.toHaveBeenCalled();
    });

    it('handles disbanded guild', async () => {
      const guild = createMockGuild({ disbanded: true });
      mockPrisma.guild.findUnique.mockResolvedValue(guild);

      await awardChampionsTrophy('guild-123');

      expect(mockPrisma.guild.update).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // getTrophyBonuses
  // ============================================================================

  describe('getTrophyBonuses', () => {
    it('returns stat bonuses for battle trophies', () => {
      const bonuses = getTrophyBonuses(['FIRST_BLOOD', 'BATTLE_HARDENED', 'WAR_MACHINE']);

      expect(bonuses.statBonus).toBe(35); // 5 + 10 + 20
    });

    it('returns gold bonus for WEALTHY', () => {
      const bonuses = getTrophyBonuses(['WEALTHY']);

      expect(bonuses.goldBonus).toBe(0.05);
    });

    it('returns XP bonus for UNITED', () => {
      const bonuses = getTrophyBonuses(['UNITED']);

      expect(bonuses.xpBonus).toBe(0.05);
    });

    it('returns dust bonus for ANCIENT', () => {
      const bonuses = getTrophyBonuses(['ANCIENT']);

      expect(bonuses.dustBonus).toBe(0.05);
    });

    it('accumulates multiple trophy bonuses', () => {
      const bonuses = getTrophyBonuses(['FIRST_BLOOD', 'WEALTHY', 'UNITED', 'ANCIENT']);

      expect(bonuses.statBonus).toBe(5);
      expect(bonuses.goldBonus).toBe(0.05);
      expect(bonuses.xpBonus).toBe(0.05);
      expect(bonuses.dustBonus).toBe(0.05);
    });

    it('returns zeros for empty trophy list', () => {
      const bonuses = getTrophyBonuses([]);

      expect(bonuses.statBonus).toBe(0);
      expect(bonuses.goldBonus).toBe(0);
      expect(bonuses.xpBonus).toBe(0);
      expect(bonuses.dustBonus).toBe(0);
    });
  });
});
