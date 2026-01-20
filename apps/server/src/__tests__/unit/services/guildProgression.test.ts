/**
 * Guild Progression service unit tests
 * Tests the backwards-compatible trophy management functions
 *
 * Note: The actual trophy awarding is now handled by guildBattleTrophies.ts
 * This service now provides stubs for backwards compatibility and
 * delegates to the new trophy system.
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
} from '../../mocks/prisma.js';

describe('Guild Progression Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // checkAndAwardTrophies (backwards compat stub)
  // ============================================================================

  describe('checkAndAwardTrophies', () => {
    it('returns empty newTrophies (trophies now awarded via guildBattleTrophies)', async () => {
      // The function now returns empty since trophy awarding moved to guildBattleTrophies.ts
      const result = await checkAndAwardTrophies('guild-123');

      expect(result.newTrophies).toEqual([]);
    });
  });

  // ============================================================================
  // awardChampionsTrophy (backwards compat stub)
  // ============================================================================

  describe('awardChampionsTrophy', () => {
    it('does nothing (replaced by Tower Race medals)', async () => {
      // This function is now a no-op since Tower Race medals replace the old CHAMPIONS trophy
      await awardChampionsTrophy('guild-123');

      // Should not call any prisma functions
      expect(mockPrisma.guild.update).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // getTrophyBonuses (queries new GuildBattleTrophy table)
  // ============================================================================

  describe('getTrophyBonuses', () => {
    it('returns bonuses from earned trophies', async () => {
      // Mock the GuildBattleTrophy query
      mockPrisma.guildBattleTrophy.findMany.mockResolvedValue([
        { trophyId: 'FIRST_BLOOD' },
        { trophyId: 'BATTLE_HARDENED' },
      ]);

      const bonuses = await getTrophyBonuses('guild-123');

      // FIRST_BLOOD = +5, BATTLE_HARDENED = +10 = 15 total
      expect(bonuses.statBonus).toBe(15);
      expect(bonuses.coinMultiplier).toBe(1); // No coin multiplier trophies
      // Old bonuses no longer exist
      expect(bonuses.goldBonus).toBe(0);
      expect(bonuses.xpBonus).toBe(0);
      expect(bonuses.dustBonus).toBe(0);
    });

    it('returns zeros for guild with no trophies', async () => {
      mockPrisma.guildBattleTrophy.findMany.mockResolvedValue([]);

      const bonuses = await getTrophyBonuses('guild-123');

      expect(bonuses.statBonus).toBe(0);
      expect(bonuses.coinMultiplier).toBe(1);
      expect(bonuses.goldBonus).toBe(0);
      expect(bonuses.xpBonus).toBe(0);
      expect(bonuses.dustBonus).toBe(0);
    });

    it('includes coin multiplier from streak trophies', async () => {
      // HOT_STREAK gives +10% coins
      mockPrisma.guildBattleTrophy.findMany.mockResolvedValue([
        { trophyId: 'HOT_STREAK' },
      ]);

      const bonuses = await getTrophyBonuses('guild-123');

      expect(bonuses.coinMultiplier).toBe(1.1); // +10%
      expect(bonuses.statBonus).toBe(0); // No stat bonus from HOT_STREAK
    });

    it('accumulates stat bonus and coin multiplier', async () => {
      mockPrisma.guildBattleTrophy.findMany.mockResolvedValue([
        { trophyId: 'FIRST_BLOOD' },     // +5 stats
        { trophyId: 'WAR_MACHINE' },     // +20 stats
        { trophyId: 'HOT_STREAK' },      // 1.1x coins
        { trophyId: 'UNSTOPPABLE' },     // 1.2x coins
      ]);

      const bonuses = await getTrophyBonuses('guild-123');

      expect(bonuses.statBonus).toBe(25); // 5 + 20
      expect(bonuses.coinMultiplier).toBeCloseTo(1.32); // 1.1 * 1.2
    });
  });
});
