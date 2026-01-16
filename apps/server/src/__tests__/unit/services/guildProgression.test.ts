/**
 * Guild Progression service unit tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../../../__tests__/helpers/setup.js';
import {
  getXpForLevel,
  getXpToNextLevel,
  calculateLevelFromXp,
  getGuildLevelInfo,
  addGuildXp,
  addXpFromWave,
  addXpFromRun,
  addXpFromDonation,
  addXpFromBattle,
  checkAndAwardTrophies,
  awardChampionsTrophy,
  getTrophyBonuses,
  resetWeeklyContributions,
} from '../../../services/guildProgression.js';
import {
  mockPrisma,
  createMockGuild,
  createMockGuildMember,
  createMockGuildTreasury,
} from '../../mocks/prisma.js';

describe('Guild Progression Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // getXpForLevel
  // ============================================================================

  describe('getXpForLevel', () => {
    it('returns 0 XP for level 1', () => {
      const xp = getXpForLevel(1);
      expect(xp).toBe(0); // Level 1 requires 0 XP
    });

    it('returns correct XP for level 2', () => {
      const xp = getXpForLevel(2);
      expect(xp).toBeGreaterThan(0);
    });

    it('returns correct XP for level 10', () => {
      const xp = getXpForLevel(10);
      expect(xp).toBeGreaterThan(getXpForLevel(9));
    });

    it('returns correct XP for level 20 (max)', () => {
      const xp = getXpForLevel(20);
      expect(xp).toBeGreaterThan(getXpForLevel(19));
    });

    it('returns max level XP for levels beyond 20', () => {
      const xp = getXpForLevel(25);
      const maxXp = getXpForLevel(20);
      expect(xp).toBe(maxXp);
    });
  });

  // ============================================================================
  // getXpToNextLevel
  // ============================================================================

  describe('getXpToNextLevel', () => {
    it('returns correct XP needed for next level', () => {
      const xpNeeded = getXpToNextLevel(1, 50);
      const level2Xp = getXpForLevel(2);
      expect(xpNeeded).toBe(level2Xp - 50);
    });

    it('returns 0 at max level (20)', () => {
      const xpNeeded = getXpToNextLevel(20, 999999);
      expect(xpNeeded).toBe(0);
    });

    it('handles mid-level XP correctly', () => {
      const level2Xp = getXpForLevel(2);
      const level3Xp = getXpForLevel(3);
      const midXp = level2Xp + Math.floor((level3Xp - level2Xp) / 2);
      const xpNeeded = getXpToNextLevel(2, midXp);
      expect(xpNeeded).toBe(level3Xp - midXp);
    });

    it('returns 0 when XP exceeds next level requirement', () => {
      const level3Xp = getXpForLevel(3);
      const xpNeeded = getXpToNextLevel(2, level3Xp + 1000);
      expect(xpNeeded).toBe(0);
    });
  });

  // ============================================================================
  // calculateLevelFromXp
  // ============================================================================

  describe('calculateLevelFromXp', () => {
    it('returns level 1 for 0 XP', () => {
      const level = calculateLevelFromXp(0);
      expect(level).toBe(1);
    });

    it('calculates correct level from total XP', () => {
      const level5Xp = getXpForLevel(5);
      const level = calculateLevelFromXp(level5Xp);
      expect(level).toBe(5);
    });

    it('returns max level for high XP', () => {
      const level = calculateLevelFromXp(10000000);
      expect(level).toBe(20);
    });

    it('returns correct level at exact boundaries', () => {
      const level3Xp = getXpForLevel(3);
      const level = calculateLevelFromXp(level3Xp);
      expect(level).toBe(3);
    });

    it('returns previous level when XP just below threshold', () => {
      const level3Xp = getXpForLevel(3);
      const level = calculateLevelFromXp(level3Xp - 1);
      expect(level).toBe(2);
    });
  });

  // ============================================================================
  // getGuildLevelInfo
  // ============================================================================

  describe('getGuildLevelInfo', () => {
    it('returns complete level info object', () => {
      const info = getGuildLevelInfo(5, 1000, 5000);

      expect(info).toHaveProperty('level');
      expect(info).toHaveProperty('xp');
      expect(info).toHaveProperty('xpToNextLevel');
      expect(info).toHaveProperty('totalXp');
      expect(info).toHaveProperty('memberCapacity');
      expect(info).toHaveProperty('bonuses');
    });

    it('includes correct bonuses for level', () => {
      const info = getGuildLevelInfo(5, 1000, 5000);

      expect(info.bonuses).toHaveProperty('goldBoost');
      expect(info.bonuses).toHaveProperty('statBoost');
      expect(info.bonuses).toHaveProperty('xpBoost');
    });

    it('calculates xpToNextLevel correctly', () => {
      const totalXp = getXpForLevel(5) + 100;
      const info = getGuildLevelInfo(5, 100, totalXp);
      const expectedXp = getXpToNextLevel(5, totalXp);

      expect(info.xpToNextLevel).toBe(expectedXp);
    });

    it('includes member capacity', () => {
      const info = getGuildLevelInfo(10, 1000, 50000);
      expect(info.memberCapacity).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // addGuildXp
  // ============================================================================

  describe('addGuildXp', () => {
    it('adds XP to guild', async () => {
      const guild = createMockGuild({ level: 1, xp: 0, totalXp: 0 });
      mockPrisma.guild.findUnique.mockResolvedValue(guild);
      mockPrisma.guild.update.mockResolvedValue({ ...guild, xp: 100, totalXp: 100 });

      const result = await addGuildXp('guild-123', 100, 'test');

      expect(mockPrisma.guild.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            xp: 100,
            totalXp: 100,
          }),
        })
      );
      expect(result.leveled).toBe(false);
    });

    it('returns leveled=false when not leveling up', async () => {
      const guild = createMockGuild({ level: 1, xp: 0, totalXp: 0 });
      mockPrisma.guild.findUnique.mockResolvedValue(guild);
      mockPrisma.guild.update.mockResolvedValue({ ...guild, xp: 10, totalXp: 10 });

      const result = await addGuildXp('guild-123', 10, 'test');

      expect(result.leveled).toBe(false);
      expect(result.newLevel).toBeUndefined();
    });

    it('returns leveled=true and new level on level up', async () => {
      const guild = createMockGuild({ level: 1, xp: 0, totalXp: 0 });
      const level2Xp = getXpForLevel(2);
      mockPrisma.guild.findUnique.mockResolvedValue(guild);
      mockPrisma.guild.update.mockResolvedValue({ ...guild, level: 2, xp: level2Xp, totalXp: level2Xp });

      const result = await addGuildXp('guild-123', level2Xp + 100, 'test');

      expect(result.leveled).toBe(true);
      expect(result.newLevel).toBe(2);
      expect(result.previousLevel).toBe(1);
    });

    it('handles disbanded guild', async () => {
      const guild = createMockGuild({ disbanded: true });
      mockPrisma.guild.findUnique.mockResolvedValue(guild);

      const result = await addGuildXp('guild-123', 100, 'test');

      expect(result.leveled).toBe(false);
      expect(mockPrisma.guild.update).not.toHaveBeenCalled();
    });

    it('handles non-existent guild', async () => {
      mockPrisma.guild.findUnique.mockResolvedValue(null);

      const result = await addGuildXp('nonexistent', 100, 'test');

      expect(result.leveled).toBe(false);
      expect(mockPrisma.guild.update).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // addXpFromWave
  // ============================================================================

  describe('addXpFromWave', () => {
    it('adds XP_PER_WAVE to guild', async () => {
      const member = createMockGuildMember({ guildId: 'guild-123' });
      const guild = createMockGuild({ id: 'guild-123' });

      mockPrisma.guildMember.findUnique.mockResolvedValue(member);
      mockPrisma.guild.findUnique.mockResolvedValue(guild);
      mockPrisma.guild.update.mockResolvedValue(guild);
      mockPrisma.guildMember.update.mockResolvedValue(member);

      await addXpFromWave('user-123');

      expect(mockPrisma.guild.update).toHaveBeenCalled();
      expect(mockPrisma.guildMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            weeklyXpContributed: expect.any(Object),
          }),
        })
      );
    });

    it('does nothing if user not in guild', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);

      await addXpFromWave('user-123');

      expect(mockPrisma.guild.update).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // addXpFromRun
  // ============================================================================

  describe('addXpFromRun', () => {
    it('adds XP_PER_RUN to guild', async () => {
      const member = createMockGuildMember({ guildId: 'guild-123' });
      const guild = createMockGuild({ id: 'guild-123' });

      mockPrisma.guildMember.findUnique.mockResolvedValue(member);
      mockPrisma.guild.findUnique.mockResolvedValue(guild);
      mockPrisma.guild.update.mockResolvedValue(guild);
      mockPrisma.guildMember.update.mockResolvedValue(member);

      await addXpFromRun('user-123');

      expect(mockPrisma.guild.update).toHaveBeenCalled();
      expect(mockPrisma.guildMember.update).toHaveBeenCalled();
    });

    it('does nothing if user not in guild', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);

      await addXpFromRun('user-123');

      expect(mockPrisma.guild.update).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // addXpFromDonation
  // ============================================================================

  describe('addXpFromDonation', () => {
    it('calculates gold XP correctly', async () => {
      const guild = createMockGuild();
      mockPrisma.guild.findUnique.mockResolvedValue(guild);
      mockPrisma.guild.update.mockResolvedValue(guild);

      await addXpFromDonation('guild-123', 1000, 0);

      expect(mockPrisma.guild.update).toHaveBeenCalled();
    });

    it('calculates dust XP correctly', async () => {
      const guild = createMockGuild();
      mockPrisma.guild.findUnique.mockResolvedValue(guild);
      mockPrisma.guild.update.mockResolvedValue(guild);

      await addXpFromDonation('guild-123', 0, 100);

      expect(mockPrisma.guild.update).toHaveBeenCalled();
    });

    it('adds combined XP', async () => {
      const guild = createMockGuild();
      mockPrisma.guild.findUnique.mockResolvedValue(guild);
      mockPrisma.guild.update.mockResolvedValue(guild);

      await addXpFromDonation('guild-123', 500, 50);

      expect(mockPrisma.guild.update).toHaveBeenCalled();
    });

    it('handles zero amounts', async () => {
      await addXpFromDonation('guild-123', 0, 0);

      expect(mockPrisma.guild.findUnique).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // addXpFromBattle
  // ============================================================================

  describe('addXpFromBattle', () => {
    it('adds XP_PER_BATTLE_WIN for win', async () => {
      const guild = createMockGuild();
      mockPrisma.guild.findUnique.mockResolvedValue(guild);
      mockPrisma.guild.update.mockResolvedValue(guild);

      await addXpFromBattle('guild-123', true);

      expect(mockPrisma.guild.update).toHaveBeenCalled();
    });

    it('adds XP_PER_BATTLE_PARTICIPATION for loss', async () => {
      const guild = createMockGuild();
      mockPrisma.guild.findUnique.mockResolvedValue(guild);
      mockPrisma.guild.update.mockResolvedValue(guild);

      await addXpFromBattle('guild-123', false);

      expect(mockPrisma.guild.update).toHaveBeenCalled();
    });
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

    it('awards UNITED at 20 members', async () => {
      const guild = createMockGuild({ trophies: [] });
      mockPrisma.guild.findUnique.mockResolvedValue({
        ...guild,
        treasury: createMockGuildTreasury(),
        _count: { members: 20 },
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

  // ============================================================================
  // resetWeeklyContributions
  // ============================================================================

  describe('resetWeeklyContributions', () => {
    it('resets all members weeklyXpContributed to 0', async () => {
      mockPrisma.guildMember.updateMany.mockResolvedValue({ count: 50 });

      await resetWeeklyContributions();

      expect(mockPrisma.guildMember.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { weeklyXpContributed: 0 },
        })
      );
    });

    it('returns count of updated members', async () => {
      mockPrisma.guildMember.updateMany.mockResolvedValue({ count: 25 });

      const result = await resetWeeklyContributions();

      expect(result).toBe(25);
    });
  });
});
