/**
 * Guild Tower Race service tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCurrentWeekKey,
  getCurrentRace,
  getRaceStatus,
  addWaveContribution,
  getRaceLeaderboard,
  getRaceGuildDetails,
  finalizeRace,
  getRaceHistory,
} from '../../../services/guildTowerRace.js';
import {
  mockPrisma,
  resetPrismaMock,
  createMockGuild,
  createMockGuildMember,
  createMockGuildTowerRace,
  createMockGuildTowerRaceEntry,
} from '../../mocks/prisma.js';

describe('Guild Tower Race Service', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  // ============================================================================
  // GET CURRENT WEEK KEY
  // ============================================================================

  describe('getCurrentWeekKey', () => {
    it('returns week key in YYYY-Www format', () => {
      const weekKey = getCurrentWeekKey();

      expect(weekKey).toMatch(/^\d{4}-W\d{2}$/);
    });

    it('returns consistent week key for same day', () => {
      const key1 = getCurrentWeekKey();
      const key2 = getCurrentWeekKey();

      expect(key1).toBe(key2);
    });

    it('pads week number with zero', () => {
      const weekKey = getCurrentWeekKey();
      const weekPart = weekKey.split('-W')[1];

      expect(weekPart.length).toBe(2);
    });
  });

  // ============================================================================
  // GET CURRENT RACE
  // ============================================================================

  describe('getCurrentRace', () => {
    it('returns existing race for current week', async () => {
      const mockRace = createMockGuildTowerRace();
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(mockRace);

      const result = await getCurrentRace();

      expect(result.id).toBe('race-123');
      expect(result.status).toBe('active');
    });

    it('creates new race if none exists', async () => {
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(null);
      const newRace = createMockGuildTowerRace();
      mockPrisma.guildTowerRace.create.mockResolvedValue(newRace);

      const result = await getCurrentRace();

      expect(mockPrisma.guildTowerRace.create).toHaveBeenCalled();
      expect(result.status).toBe('active');
    });

    it('creates race with correct end time (Sunday 23:59:59)', async () => {
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(null);
      const newRace = createMockGuildTowerRace();
      mockPrisma.guildTowerRace.create.mockResolvedValue(newRace);

      await getCurrentRace();

      expect(mockPrisma.guildTowerRace.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            weekKey: expect.any(String),
            status: 'active',
            endsAt: expect.any(Date),
          }),
        })
      );
    });
  });

  // ============================================================================
  // GET RACE STATUS
  // ============================================================================

  describe('getRaceStatus', () => {
    it('returns status with guild entry', async () => {
      const mockRace = createMockGuildTowerRace();
      const mockEntry = createMockGuildTowerRaceEntry();
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(mockRace);
      mockPrisma.guildTowerRaceEntry.findUnique.mockResolvedValue(mockEntry);
      mockPrisma.guildTowerRaceEntry.count.mockResolvedValue(2); // 2 guilds ahead
      mockPrisma.guildMedalBonus.findUnique.mockResolvedValue(null); // No active bonus

      const result = await getRaceStatus('guild-123');

      expect(result.race.id).toBe('race-123');
      expect(result.guildEntry).not.toBeNull();
      expect(result.guildEntry!.totalWaves).toBe(1000);
      expect(result.guildRank).toBe(3); // 2 higher + 1
    });

    it('returns null entry and rank for guild not in race', async () => {
      const mockRace = createMockGuildTowerRace();
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(mockRace);
      mockPrisma.guildTowerRaceEntry.findUnique.mockResolvedValue(null);
      mockPrisma.guildMedalBonus.findUnique.mockResolvedValue(null); // No active bonus

      const result = await getRaceStatus('guild-999');

      expect(result.guildEntry).toBeNull();
      expect(result.guildRank).toBeNull();
    });

    it('calculates time remaining correctly', async () => {
      const futureEnd = new Date(Date.now() + 3600000); // 1 hour from now
      const mockRace = createMockGuildTowerRace({ endsAt: futureEnd });
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(mockRace);
      mockPrisma.guildTowerRaceEntry.findUnique.mockResolvedValue(null);
      mockPrisma.guildMedalBonus.findUnique.mockResolvedValue(null); // No active bonus

      const result = await getRaceStatus('guild-123');

      expect(result.timeRemaining).toBeGreaterThan(0);
      expect(result.timeRemaining).toBeLessThanOrEqual(3600000);
    });

    it('returns 0 time remaining for expired race', async () => {
      const pastEnd = new Date(Date.now() - 1000); // 1 second ago
      const mockRace = createMockGuildTowerRace({ endsAt: pastEnd });
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(mockRace);
      mockPrisma.guildTowerRaceEntry.findUnique.mockResolvedValue(null);
      mockPrisma.guildMedalBonus.findUnique.mockResolvedValue(null); // No active bonus

      const result = await getRaceStatus('guild-123');

      expect(result.timeRemaining).toBe(0);
    });

    it('returns rank 1 for guild with highest waves', async () => {
      const mockRace = createMockGuildTowerRace();
      const mockEntry = createMockGuildTowerRaceEntry({ totalWaves: 5000 });
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(mockRace);
      mockPrisma.guildTowerRaceEntry.findUnique.mockResolvedValue(mockEntry);
      mockPrisma.guildTowerRaceEntry.count.mockResolvedValue(0); // No guilds ahead
      mockPrisma.guildMedalBonus.findUnique.mockResolvedValue(null); // No active bonus

      const result = await getRaceStatus('guild-123');

      expect(result.guildRank).toBe(1);
    });
  });

  // ============================================================================
  // ADD WAVE CONTRIBUTION
  // ============================================================================

  describe('addWaveContribution', () => {
    it('returns success for 0 or negative waves', async () => {
      const result1 = await addWaveContribution('user-123', 0);
      const result2 = await addWaveContribution('user-123', -5);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(mockPrisma.guildMember.findUnique).not.toHaveBeenCalled();
    });

    it('silently succeeds for user not in guild', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);

      const result = await addWaveContribution('user-999', 10);

      expect(result.success).toBe(true);
    });

    it('silently succeeds for user in disbanded guild', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        ...createMockGuildMember(),
        guild: createMockGuild({ disbanded: true }),
      });

      const result = await addWaveContribution('user-123', 10);

      expect(result.success).toBe(true);
    });

    it('silently succeeds for expired race', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        ...createMockGuildMember(),
        guild: createMockGuild(),
      });
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(
        createMockGuildTowerRace({
          status: 'completed',
          endsAt: new Date(Date.now() - 1000),
        })
      );

      const result = await addWaveContribution('user-123', 10);

      expect(result.success).toBe(true);
    });

    it('creates new entry if guild not yet in race', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        ...createMockGuildMember(),
        guild: createMockGuild(),
      });
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(createMockGuildTowerRace());

      // Transaction mock
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          guildTowerRaceEntry: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(
              createMockGuildTowerRaceEntry({ totalWaves: 0, memberContributions: {} })
            ),
            update: vi.fn().mockResolvedValue({}),
          },
        };
        return await callback(tx);
      });

      const result = await addWaveContribution('user-123', 10);

      expect(result.success).toBe(true);
    });

    it('updates existing entry with new waves', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        ...createMockGuildMember(),
        guild: createMockGuild(),
      });
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(createMockGuildTowerRace());

      const existingEntry = createMockGuildTowerRaceEntry({
        totalWaves: 100,
        memberContributions: { 'user-123': 50 },
      });

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          guildTowerRaceEntry: {
            findUnique: vi.fn().mockResolvedValue(existingEntry),
            update: vi.fn().mockResolvedValue({}),
          },
        };
        return await callback(tx);
      });

      const result = await addWaveContribution('user-123', 25);

      expect(result.success).toBe(true);
    });

    it('accumulates waves for same user', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        ...createMockGuildMember(),
        guild: createMockGuild(),
      });
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(createMockGuildTowerRace());

      let updatedContributions: Record<string, number> | null = null;

      const existingEntry = createMockGuildTowerRaceEntry({
        totalWaves: 100,
        memberContributions: { 'user-123': 50, 'user-456': 50 },
      });

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          guildTowerRaceEntry: {
            findUnique: vi.fn().mockResolvedValue(existingEntry),
            update: vi.fn().mockImplementation((args) => {
              updatedContributions = args.data.memberContributions;
              return Promise.resolve({});
            }),
          },
        };
        return await callback(tx);
      });

      await addWaveContribution('user-123', 30);

      expect(updatedContributions).not.toBeNull();
      expect(updatedContributions!['user-123']).toBe(80); // 50 + 30
      expect(updatedContributions!['user-456']).toBe(50); // unchanged
    });
  });

  // ============================================================================
  // GET RACE LEADERBOARD
  // ============================================================================

  describe('getRaceLeaderboard', () => {
    it('returns empty leaderboard if race not found', async () => {
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(null);

      const result = await getRaceLeaderboard('2026-W99');

      expect(result.entries).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('returns guilds sorted by total waves', async () => {
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(createMockGuildTowerRace());
      mockPrisma.guildTowerRaceEntry.findMany.mockResolvedValue([
        createMockGuildTowerRaceEntry({ guildId: 'guild-1', totalWaves: 5000 }),
        createMockGuildTowerRaceEntry({ guildId: 'guild-2', totalWaves: 3000 }),
        createMockGuildTowerRaceEntry({ guildId: 'guild-3', totalWaves: 1000 }),
      ]);
      mockPrisma.guildTowerRaceEntry.count.mockResolvedValue(3);
      mockPrisma.guild.findMany.mockResolvedValue([
        { id: 'guild-1', name: 'First', tag: '1ST', _count: { members: 15 } },
        { id: 'guild-2', name: 'Second', tag: '2ND', _count: { members: 10 } },
        { id: 'guild-3', name: 'Third', tag: '3RD', _count: { members: 8 } },
      ]);

      const result = await getRaceLeaderboard();

      expect(result.entries).toHaveLength(3);
      expect(result.entries[0].rank).toBe(1);
      expect(result.entries[0].guildName).toBe('First');
      expect(result.entries[0].totalWaves).toBe(5000);
      expect(result.entries[1].rank).toBe(2);
      expect(result.entries[2].rank).toBe(3);
      expect(result.total).toBe(3);
    });

    it('includes guild details in response', async () => {
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(createMockGuildTowerRace());
      mockPrisma.guildTowerRaceEntry.findMany.mockResolvedValue([
        createMockGuildTowerRaceEntry({ guildId: 'guild-1', totalWaves: 1000 }),
      ]);
      mockPrisma.guildTowerRaceEntry.count.mockResolvedValue(1);
      mockPrisma.guild.findMany.mockResolvedValue([
        { id: 'guild-1', name: 'Test Guild', tag: 'TG', _count: { members: 20 } },
      ]);

      const result = await getRaceLeaderboard();

      expect(result.entries[0].guildName).toBe('Test Guild');
      expect(result.entries[0].guildTag).toBe('TG');
      expect(result.entries[0].memberCount).toBe(20);
    });

    it('respects limit and offset', async () => {
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(createMockGuildTowerRace());
      mockPrisma.guildTowerRaceEntry.findMany.mockResolvedValue([
        createMockGuildTowerRaceEntry({ guildId: 'guild-3', totalWaves: 500 }),
      ]);
      mockPrisma.guildTowerRaceEntry.count.mockResolvedValue(10);
      mockPrisma.guild.findMany.mockResolvedValue([
        { id: 'guild-3', name: 'Third', tag: '3RD', _count: { members: 5 } },
      ]);

      const result = await getRaceLeaderboard(undefined, 1, 2);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].rank).toBe(3); // offset + index + 1
      expect(result.total).toBe(10);
    });

    it('handles unknown guilds gracefully', async () => {
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(createMockGuildTowerRace());
      mockPrisma.guildTowerRaceEntry.findMany.mockResolvedValue([
        createMockGuildTowerRaceEntry({ guildId: 'deleted-guild', totalWaves: 100 }),
      ]);
      mockPrisma.guildTowerRaceEntry.count.mockResolvedValue(1);
      mockPrisma.guild.findMany.mockResolvedValue([]); // Guild not found

      const result = await getRaceLeaderboard();

      expect(result.entries[0].guildName).toBe('Unknown');
      expect(result.entries[0].guildTag).toBe('???');
    });
  });

  // ============================================================================
  // GET RACE GUILD DETAILS
  // ============================================================================

  describe('getRaceGuildDetails', () => {
    it('returns null if race not found', async () => {
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(null);

      const result = await getRaceGuildDetails('guild-123', '2026-W99');

      expect(result).toBeNull();
    });

    it('returns null if guild not in race', async () => {
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(createMockGuildTowerRace());
      mockPrisma.guildTowerRaceEntry.findUnique.mockResolvedValue(null);

      const result = await getRaceGuildDetails('guild-999');

      expect(result).toBeNull();
    });

    it('returns guild details with member contributions', async () => {
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(createMockGuildTowerRace());
      mockPrisma.guildTowerRaceEntry.findUnique.mockResolvedValue(
        createMockGuildTowerRaceEntry({
          totalWaves: 1000,
          memberContributions: { 'user-1': 600, 'user-2': 400 },
        })
      );
      mockPrisma.guild.findUnique.mockResolvedValue({ name: 'Test Guild' });
      mockPrisma.guildTowerRaceEntry.count.mockResolvedValue(2); // 2 guilds ahead
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', displayName: 'TopPlayer' },
        { id: 'user-2', displayName: 'SecondPlayer' },
      ]);

      const result = await getRaceGuildDetails('guild-123');

      expect(result).not.toBeNull();
      expect(result!.guildName).toBe('Test Guild');
      expect(result!.totalWaves).toBe(1000);
      expect(result!.rank).toBe(3);
      expect(result!.memberContributions).toHaveLength(2);
    });

    it('sorts member contributions by waves descending', async () => {
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(createMockGuildTowerRace());
      mockPrisma.guildTowerRaceEntry.findUnique.mockResolvedValue(
        createMockGuildTowerRaceEntry({
          memberContributions: { 'user-1': 100, 'user-2': 500, 'user-3': 300 },
        })
      );
      mockPrisma.guild.findUnique.mockResolvedValue({ name: 'Test' });
      mockPrisma.guildTowerRaceEntry.count.mockResolvedValue(0);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', displayName: 'Low' },
        { id: 'user-2', displayName: 'High' },
        { id: 'user-3', displayName: 'Mid' },
      ]);

      const result = await getRaceGuildDetails('guild-123');

      expect(result!.memberContributions[0].displayName).toBe('High');
      expect(result!.memberContributions[0].wavesContributed).toBe(500);
      expect(result!.memberContributions[0].rank).toBe(1);
      expect(result!.memberContributions[1].displayName).toBe('Mid');
      expect(result!.memberContributions[1].rank).toBe(2);
      expect(result!.memberContributions[2].displayName).toBe('Low');
      expect(result!.memberContributions[2].rank).toBe(3);
    });

    it('handles empty member contributions', async () => {
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(createMockGuildTowerRace());
      mockPrisma.guildTowerRaceEntry.findUnique.mockResolvedValue(
        createMockGuildTowerRaceEntry({
          totalWaves: 0,
          memberContributions: {},
        })
      );
      mockPrisma.guild.findUnique.mockResolvedValue({ name: 'Empty Guild' });
      mockPrisma.guildTowerRaceEntry.count.mockResolvedValue(5);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await getRaceGuildDetails('guild-123');

      expect(result!.memberContributions).toHaveLength(0);
      expect(result!.totalWaves).toBe(0);
    });
  });

  // ============================================================================
  // FINALIZE RACE
  // ============================================================================

  describe('finalizeRace', () => {
    it('returns error if race not found', async () => {
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(null);

      const result = await finalizeRace('2026-W99');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Race not found');
    });

    it('returns error if race already completed', async () => {
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(
        createMockGuildTowerRace({ status: 'completed' })
      );

      const result = await finalizeRace('2026-W02');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Race already finalized');
    });

    it('returns rankings ordered by total waves', async () => {
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(createMockGuildTowerRace());
      mockPrisma.guildTowerRaceEntry.findMany.mockResolvedValue([
        createMockGuildTowerRaceEntry({ guildId: 'guild-1', totalWaves: 5000 }),
        createMockGuildTowerRaceEntry({ guildId: 'guild-2', totalWaves: 4000 }),
        createMockGuildTowerRaceEntry({ guildId: 'guild-3', totalWaves: 3000 }),
        createMockGuildTowerRaceEntry({ guildId: 'guild-4', totalWaves: 2000 }),
        createMockGuildTowerRaceEntry({ guildId: 'guild-5', totalWaves: 1000 }),
      ]);

      const result = await finalizeRace('2026-W02');

      expect(result.success).toBe(true);
      expect(result.rankings).toHaveLength(5);

      // Check rankings
      expect(result.rankings![0].rank).toBe(1);
      expect(result.rankings![0].totalWaves).toBe(5000);
      expect(result.rankings![1].rank).toBe(2);
      expect(result.rankings![1].totalWaves).toBe(4000);
      expect(result.rankings![4].rank).toBe(5);
      expect(result.rankings![4].totalWaves).toBe(1000);
    });

    it('marks race as completed', async () => {
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(createMockGuildTowerRace());
      mockPrisma.guildTowerRaceEntry.findMany.mockResolvedValue([]);
      mockPrisma.guildTowerRace.update.mockResolvedValue({});

      await finalizeRace('2026-W02');

      expect(mockPrisma.guildTowerRace.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'completed' },
        })
      );
    });

    it('returns all rankings regardless of count', async () => {
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(createMockGuildTowerRace());
      mockPrisma.guildTowerRace.update.mockResolvedValue({});

      // Create 15 entries
      const entries = Array.from({ length: 15 }, (_, i) =>
        createMockGuildTowerRaceEntry({
          guildId: `guild-${i + 1}`,
          totalWaves: 1500 - i * 100,
        })
      );
      mockPrisma.guildTowerRaceEntry.findMany.mockResolvedValue(entries);

      const result = await finalizeRace('2026-W02');

      expect(result.success).toBe(true);
      expect(result.rankings).toHaveLength(15);

      // Check rank 15
      const rank15Entry = result.rankings!.find(r => r.rank === 15);
      expect(rank15Entry).toBeDefined();
      expect(rank15Entry?.totalWaves).toBe(100);
    });

    it('handles large number of participants', async () => {
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(createMockGuildTowerRace());
      mockPrisma.guildTowerRace.update.mockResolvedValue({});

      // Create 25 entries
      const entries = Array.from({ length: 25 }, (_, i) =>
        createMockGuildTowerRaceEntry({
          guildId: `guild-${i + 1}`,
          totalWaves: 2500 - i * 100,
        })
      );
      mockPrisma.guildTowerRaceEntry.findMany.mockResolvedValue(entries);

      const result = await finalizeRace('2026-W02');

      expect(result.success).toBe(true);
      expect(result.rankings).toHaveLength(25);
      expect(result.rankings![0].rank).toBe(1);
      expect(result.rankings![24].rank).toBe(25);
    });
  });

  // ============================================================================
  // GET RACE HISTORY
  // ============================================================================

  describe('getRaceHistory', () => {
    it('returns empty array if no races exist', async () => {
      mockPrisma.guildTowerRace.findMany.mockResolvedValue([]);
      mockPrisma.guild.findMany.mockResolvedValue([]);

      const result = await getRaceHistory();

      expect(result).toHaveLength(0);
    });

    it('returns races ordered by start date descending', async () => {
      mockPrisma.guildTowerRace.findMany.mockResolvedValue([
        { ...createMockGuildTowerRace({ weekKey: '2026-W03' }), entries: [] },
        { ...createMockGuildTowerRace({ weekKey: '2026-W02' }), entries: [] },
        { ...createMockGuildTowerRace({ weekKey: '2026-W01' }), entries: [] },
      ]);
      mockPrisma.guild.findMany.mockResolvedValue([]);

      const result = await getRaceHistory();

      expect(result).toHaveLength(3);
      expect(result[0].weekKey).toBe('2026-W03');
      expect(result[1].weekKey).toBe('2026-W02');
      expect(result[2].weekKey).toBe('2026-W01');
    });

    it('includes top guild name for completed races', async () => {
      mockPrisma.guildTowerRace.findMany.mockResolvedValue([
        {
          ...createMockGuildTowerRace({ weekKey: '2026-W02', status: 'completed' }),
          entries: [createMockGuildTowerRaceEntry({ guildId: 'guild-1', totalWaves: 5000 })],
        },
      ]);
      mockPrisma.guild.findMany.mockResolvedValue([
        { id: 'guild-1', name: 'Champion Guild' },
      ]);

      const result = await getRaceHistory();

      expect(result[0].topGuild).toBe('Champion Guild');
    });

    it('returns undefined topGuild for races with no entries', async () => {
      mockPrisma.guildTowerRace.findMany.mockResolvedValue([
        { ...createMockGuildTowerRace(), entries: [] },
      ]);
      mockPrisma.guild.findMany.mockResolvedValue([]);

      const result = await getRaceHistory();

      expect(result[0].topGuild).toBeUndefined();
    });

    it('respects limit parameter', async () => {
      mockPrisma.guildTowerRace.findMany.mockResolvedValue([
        { ...createMockGuildTowerRace({ weekKey: '2026-W05' }), entries: [] },
      ]);
      mockPrisma.guild.findMany.mockResolvedValue([]);

      await getRaceHistory(5);

      expect(mockPrisma.guildTowerRace.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 })
      );
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('edge cases', () => {
    it('handles large wave numbers', async () => {
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(createMockGuildTowerRace());
      mockPrisma.guildTowerRaceEntry.findUnique.mockResolvedValue(
        createMockGuildTowerRaceEntry({
          totalWaves: 999999999,
          memberContributions: { 'user-1': 999999999 },
        })
      );
      mockPrisma.guild.findUnique.mockResolvedValue({ name: 'Mega Guild' });
      mockPrisma.guildTowerRaceEntry.count.mockResolvedValue(0);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', displayName: 'ProPlayer' },
      ]);

      const result = await getRaceGuildDetails('guild-123');

      expect(result!.totalWaves).toBe(999999999);
      expect(result!.memberContributions[0].wavesContributed).toBe(999999999);
    });

    it('handles concurrent wave contributions', async () => {
      // This tests that the transaction properly handles updates
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        ...createMockGuildMember(),
        guild: createMockGuild(),
      });
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(createMockGuildTowerRace());

      let callCount = 0;
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        callCount++;
        const tx = {
          guildTowerRaceEntry: {
            findUnique: vi.fn().mockResolvedValue(
              createMockGuildTowerRaceEntry({ totalWaves: 100 + callCount * 10 })
            ),
            update: vi.fn().mockResolvedValue({}),
          },
        };
        return await callback(tx);
      });

      // Simulate concurrent calls
      await Promise.all([
        addWaveContribution('user-1', 10),
        addWaveContribution('user-2', 20),
      ]);

      expect(callCount).toBe(2);
    });

    it('handles null memberContributions gracefully', async () => {
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(createMockGuildTowerRace());
      mockPrisma.guildTowerRaceEntry.findUnique.mockResolvedValue(
        createMockGuildTowerRaceEntry({
          memberContributions: null as any, // Simulate null from DB
        })
      );
      mockPrisma.guild.findUnique.mockResolvedValue({ name: 'Test' });
      mockPrisma.guildTowerRaceEntry.count.mockResolvedValue(0);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await getRaceGuildDetails('guild-123');

      expect(result!.memberContributions).toHaveLength(0);
    });
  });
});
