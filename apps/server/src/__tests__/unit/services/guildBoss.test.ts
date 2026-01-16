/**
 * Guild Boss service tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCurrentBoss,
  getBossStatus,
  attackBoss,
  getBossLeaderboard,
  getGuildBossDamageBreakdown,
  getTopDamageDealers,
  finalizeBoss,
} from '../../../services/guildBoss.js';
import {
  mockPrisma,
  resetPrismaMock,
  createMockGuild,
  createMockGuildMember,
  createMockGuildBoss,
  createMockGuildBossAttempt,
} from '../../mocks/prisma.js';

// Mock getCurrentWeekKey from weekUtils
vi.mock('../../../lib/weekUtils.js', () => ({
  getCurrentWeekKey: vi.fn(() => '2026-W02'),
  getWeekEnd: vi.fn(() => new Date('2026-01-18T23:59:59.999Z')),
}));

describe('Guild Boss Service', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  // ============================================================================
  // GET CURRENT BOSS
  // ============================================================================

  describe('getCurrentBoss', () => {
    it('returns existing boss for current week', async () => {
      const mockBoss = createMockGuildBoss();
      mockPrisma.guildBoss.findUnique.mockResolvedValue(mockBoss);

      const result = await getCurrentBoss();

      expect(result.id).toBe('boss-123');
      expect(result.weekKey).toBe('2026-W02');
      expect(result.bossType).toBe('dragon');
    });

    it('creates new boss if none exists for current week', async () => {
      mockPrisma.guildBoss.findUnique.mockResolvedValue(null);
      const newBoss = createMockGuildBoss();
      mockPrisma.guildBoss.create.mockResolvedValue(newBoss);

      const result = await getCurrentBoss();

      expect(mockPrisma.guildBoss.create).toHaveBeenCalled();
      expect(result.weekKey).toBe('2026-W02');
    });

    it('creates boss with correct type based on week rotation', async () => {
      mockPrisma.guildBoss.findUnique.mockResolvedValue(null);
      const newBoss = createMockGuildBoss({ bossType: 'titan' });
      mockPrisma.guildBoss.create.mockResolvedValue(newBoss);

      await getCurrentBoss();

      expect(mockPrisma.guildBoss.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            weekKey: '2026-W02',
            bossType: expect.any(String),
            weakness: expect.any(String),
            totalHp: expect.any(BigInt),
          }),
        })
      );
    });
  });

  // ============================================================================
  // GET BOSS STATUS
  // ============================================================================

  describe('getBossStatus', () => {
    it('returns canAttack=true if user has not attacked today', async () => {
      const mockBoss = createMockGuildBoss();
      mockPrisma.guildBoss.findUnique.mockResolvedValue(mockBoss);
      mockPrisma.guildBossAttempt.findFirst.mockResolvedValue(null);
      mockPrisma.guildBossAttempt.aggregate
        .mockResolvedValueOnce({ _sum: { damage: null } }) // user damage
        .mockResolvedValueOnce({ _sum: { damage: BigInt(500000) } }); // guild damage
      mockPrisma.$queryRaw.mockResolvedValue([{ count: BigInt(0) }]);

      const result = await getBossStatus('guild-123', 'user-123');

      expect(result.canAttack).toBe(true);
      expect(result.myTodaysAttempt).toBeNull();
      expect(result.guildTotalDamage).toBe(500000);
    });

    it('returns canAttack=false if user already attacked today', async () => {
      const mockBoss = createMockGuildBoss();
      const mockAttempt = createMockGuildBossAttempt();
      mockPrisma.guildBoss.findUnique.mockResolvedValue(mockBoss);
      mockPrisma.guildBossAttempt.findFirst.mockResolvedValue(mockAttempt);
      mockPrisma.guildBossAttempt.aggregate
        .mockResolvedValueOnce({ _sum: { damage: BigInt(100000) } })
        .mockResolvedValueOnce({ _sum: { damage: BigInt(500000) } });
      mockPrisma.$queryRaw.mockResolvedValue([{ count: BigInt(2) }]);

      const result = await getBossStatus('guild-123', 'user-123');

      expect(result.canAttack).toBe(false);
      expect(result.myTodaysAttempt).not.toBeNull();
      expect(result.myTotalDamage).toBe(100000);
    });

    it('returns canAttack=false if boss has expired', async () => {
      const expiredBoss = createMockGuildBoss({
        endsAt: new Date(Date.now() - 1000), // Already ended
      });
      mockPrisma.guildBoss.findUnique.mockResolvedValue(expiredBoss);
      mockPrisma.guildBossAttempt.findFirst.mockResolvedValue(null);
      mockPrisma.guildBossAttempt.aggregate.mockResolvedValue({ _sum: { damage: null } });
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await getBossStatus('guild-123', 'user-123');

      expect(result.canAttack).toBe(false);
    });

    it('calculates correct guild rank', async () => {
      const mockBoss = createMockGuildBoss();
      mockPrisma.guildBoss.findUnique.mockResolvedValue(mockBoss);
      mockPrisma.guildBossAttempt.findFirst.mockResolvedValue(null);
      mockPrisma.guildBossAttempt.aggregate
        .mockResolvedValueOnce({ _sum: { damage: BigInt(50000) } })
        .mockResolvedValueOnce({ _sum: { damage: BigInt(200000) } });
      // 3 guilds have higher damage
      mockPrisma.$queryRaw.mockResolvedValue([{ count: BigInt(3) }]);

      const result = await getBossStatus('guild-123', 'user-123');

      expect(result.guildRank).toBe(4); // 3 higher + 1 = rank 4
    });

    it('returns null rank if guild has no damage', async () => {
      const mockBoss = createMockGuildBoss();
      mockPrisma.guildBoss.findUnique.mockResolvedValue(mockBoss);
      mockPrisma.guildBossAttempt.findFirst.mockResolvedValue(null);
      mockPrisma.guildBossAttempt.aggregate.mockResolvedValue({ _sum: { damage: null } });
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await getBossStatus('guild-123', 'user-123');

      expect(result.guildRank).toBeNull();
      expect(result.guildTotalDamage).toBe(0);
    });
  });

  // ============================================================================
  // ATTACK BOSS
  // ============================================================================

  describe('attackBoss', () => {
    it('returns error if user not in guild', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);

      const result = await attackBoss('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('NOT_IN_GUILD');
    });

    it('returns error if guild is disbanded', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        ...createMockGuildMember(),
        battleHeroId: 'THUNDERLORD',
        guild: createMockGuild({ disbanded: true }),
      });

      const result = await attackBoss('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('NOT_IN_GUILD');
    });

    it('returns error if no Battle Hero set', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        ...createMockGuildMember(),
        battleHeroId: null,
        guild: createMockGuild(),
      });

      const result = await attackBoss('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('NO_BATTLE_HERO_SET');
    });

    it('returns error if boss has expired', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        ...createMockGuildMember(),
        battleHeroId: 'THUNDERLORD',
        battleHeroPower: 1500,
        battleHeroTier: 2,
        guild: createMockGuild(),
      });
      mockPrisma.guildBoss.findUnique.mockResolvedValue(
        createMockGuildBoss({ endsAt: new Date(Date.now() - 1000) })
      );

      const result = await attackBoss('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('BOSS_EXPIRED');
    });

    it('returns error if already attacked today', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        ...createMockGuildMember(),
        battleHeroId: 'THUNDERLORD',
        battleHeroPower: 1500,
        battleHeroTier: 2,
        guild: createMockGuild(),
      });
      mockPrisma.guildBoss.findUnique.mockResolvedValue(createMockGuildBoss());
      mockPrisma.guildBossAttempt.findFirst.mockResolvedValue(createMockGuildBossAttempt());

      const result = await attackBoss('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('ALREADY_ATTACKED_BOSS_TODAY');
    });

    it('successfully attacks boss and calculates damage', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        ...createMockGuildMember(),
        battleHeroId: 'THUNDERLORD',
        battleHeroPower: 1500,
        battleHeroTier: 2,
        guild: createMockGuild(),
      });
      mockPrisma.guildBoss.findUnique
        .mockResolvedValueOnce(createMockGuildBoss())
        .mockResolvedValueOnce(createMockGuildBoss({ currentHp: BigInt(49900000) }));
      mockPrisma.guildBossAttempt.findFirst.mockResolvedValue(null);

      const mockAttempt = createMockGuildBossAttempt({ damage: BigInt(150000) });
      mockPrisma.$transaction.mockResolvedValue([mockAttempt, {}]);
      mockPrisma.guildMember.update.mockResolvedValue({});

      const result = await attackBoss('user-123');

      expect(result.success).toBe(true);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('calculates higher damage for higher tier heroes', async () => {
      // Test that tier 3 deals more damage than tier 1
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        ...createMockGuildMember(),
        battleHeroId: 'THUNDERLORD',
        battleHeroPower: 1000,
        battleHeroTier: 3, // Max tier
        guild: createMockGuild(),
      });
      mockPrisma.guildBoss.findUnique.mockResolvedValue(createMockGuildBoss());
      mockPrisma.guildBossAttempt.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockResolvedValue([createMockGuildBossAttempt(), {}]);
      mockPrisma.guildMember.update.mockResolvedValue({});

      const result = await attackBoss('user-123');

      expect(result.success).toBe(true);
      // Tier 3 should have 2x multiplier (1 + (3-1)*0.5 = 2)
    });

  });

  // ============================================================================
  // LEADERBOARD
  // ============================================================================

  describe('getBossLeaderboard', () => {
    it('returns empty leaderboard if no boss exists', async () => {
      mockPrisma.guildBoss.findUnique.mockResolvedValue(null);

      const result = await getBossLeaderboard('2026-W02');

      expect(result.entries).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('returns guilds sorted by total damage', async () => {
      mockPrisma.guildBoss.findUnique.mockResolvedValue(createMockGuildBoss());
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          { guildId: 'guild-1', totalDamage: BigInt(500000), participantCount: BigInt(5) },
          { guildId: 'guild-2', totalDamage: BigInt(300000), participantCount: BigInt(3) },
          { guildId: 'guild-3', totalDamage: BigInt(100000), participantCount: BigInt(2) },
        ])
        .mockResolvedValueOnce([{ count: BigInt(3) }]);
      mockPrisma.guild.findMany.mockResolvedValue([
        { id: 'guild-1', name: 'Top Guild', tag: 'TOP' },
        { id: 'guild-2', name: 'Mid Guild', tag: 'MID' },
        { id: 'guild-3', name: 'Low Guild', tag: 'LOW' },
      ]);

      const result = await getBossLeaderboard();

      expect(result.entries).toHaveLength(3);
      expect(result.entries[0].rank).toBe(1);
      expect(result.entries[0].guildName).toBe('Top Guild');
      expect(result.entries[0].totalDamage).toBe(500000);
      expect(result.entries[1].rank).toBe(2);
      expect(result.entries[2].rank).toBe(3);
      expect(result.total).toBe(3);
    });

    it('respects limit and offset parameters', async () => {
      mockPrisma.guildBoss.findUnique.mockResolvedValue(createMockGuildBoss());
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          { guildId: 'guild-3', totalDamage: BigInt(100000), participantCount: BigInt(2) },
        ])
        .mockResolvedValueOnce([{ count: BigInt(5) }]);
      mockPrisma.guild.findMany.mockResolvedValue([
        { id: 'guild-3', name: 'Third Guild', tag: 'THR' },
      ]);

      const result = await getBossLeaderboard(undefined, 1, 2);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].rank).toBe(3); // offset + index + 1
      expect(result.total).toBe(5);
    });
  });

  // ============================================================================
  // GUILD DAMAGE BREAKDOWN
  // ============================================================================

  describe('getGuildBossDamageBreakdown', () => {
    it('returns empty if no boss exists', async () => {
      mockPrisma.guildBoss.findUnique.mockResolvedValue(null);

      const result = await getGuildBossDamageBreakdown('guild-123');

      expect(result.members).toHaveLength(0);
      expect(result.totalDamage).toBe(0);
    });

    it('returns members sorted by damage', async () => {
      mockPrisma.guildBoss.findUnique.mockResolvedValue(createMockGuildBoss());
      mockPrisma.guildBossAttempt.findMany.mockResolvedValue([
        createMockGuildBossAttempt({ userId: 'user-1', damage: BigInt(200000) }),
        createMockGuildBossAttempt({ userId: 'user-2', damage: BigInt(100000) }),
        createMockGuildBossAttempt({ userId: 'user-1', damage: BigInt(50000) }), // Same user, day 2
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', displayName: 'TopPlayer' },
        { id: 'user-2', displayName: 'SecondPlayer' },
      ]);

      const result = await getGuildBossDamageBreakdown('guild-123');

      expect(result.members).toHaveLength(2);
      expect(result.members[0].displayName).toBe('TopPlayer');
      expect(result.members[0].damage).toBe(250000); // Aggregated
      expect(result.members[0].rank).toBe(1);
      expect(result.members[1].displayName).toBe('SecondPlayer');
      expect(result.members[1].damage).toBe(100000);
      expect(result.members[1].rank).toBe(2);
      expect(result.totalDamage).toBe(350000);
    });

    it('handles single member guild', async () => {
      mockPrisma.guildBoss.findUnique.mockResolvedValue(createMockGuildBoss());
      mockPrisma.guildBossAttempt.findMany.mockResolvedValue([
        createMockGuildBossAttempt({ userId: 'user-1', damage: BigInt(50000) }),
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', displayName: 'SoloPlayer' },
      ]);

      const result = await getGuildBossDamageBreakdown('guild-123');

      expect(result.members).toHaveLength(1);
      expect(result.members[0].rank).toBe(1);
      expect(result.totalDamage).toBe(50000);
    });
  });

  // ============================================================================
  // TOP DAMAGE DEALERS
  // ============================================================================

  describe('getTopDamageDealers', () => {
    it('returns empty if no boss exists', async () => {
      mockPrisma.guildBoss.findUnique.mockResolvedValue(null);

      const result = await getTopDamageDealers();

      expect(result).toHaveLength(0);
    });

    it('returns top players globally', async () => {
      mockPrisma.guildBoss.findUnique.mockResolvedValue(createMockGuildBoss());
      mockPrisma.$queryRaw.mockResolvedValue([
        { userId: 'user-1', totalDamage: BigInt(1000000), heroId: 'THUNDERLORD', heroTier: 3 },
        { userId: 'user-2', totalDamage: BigInt(800000), heroId: 'JADE_TITAN', heroTier: 2 },
        { userId: 'user-3', totalDamage: BigInt(500000), heroId: 'FROST_ARCHER', heroTier: 1 },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', displayName: 'Champion' },
        { id: 'user-2', displayName: 'RunnerUp' },
        { id: 'user-3', displayName: 'ThirdPlace' },
      ]);

      const result = await getTopDamageDealers();

      expect(result).toHaveLength(3);
      expect(result[0].displayName).toBe('Champion');
      expect(result[0].damage).toBe(1000000);
      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(2);
      expect(result[2].rank).toBe(3);
    });

    it('respects limit parameter', async () => {
      mockPrisma.guildBoss.findUnique.mockResolvedValue(createMockGuildBoss());
      mockPrisma.$queryRaw.mockResolvedValue([
        { userId: 'user-1', totalDamage: BigInt(1000000), heroId: 'THUNDERLORD', heroTier: 3 },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', displayName: 'TopOne' },
      ]);

      const result = await getTopDamageDealers(undefined, 1);

      expect(result).toHaveLength(1);
    });
  });

  // ============================================================================
  // FINALIZE BOSS
  // ============================================================================

  describe('finalizeBoss', () => {
    it('returns error if boss not found', async () => {
      mockPrisma.guildBoss.findUnique.mockResolvedValue(null);

      const result = await finalizeBoss('2026-W02');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Boss not found');
    });

    it('distributes rewards to top guilds', async () => {
      mockPrisma.guildBoss.findUnique.mockResolvedValue(createMockGuildBoss());
      // Mock leaderboard
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          { guildId: 'guild-1', totalDamage: BigInt(500000), participantCount: BigInt(5) },
          { guildId: 'guild-2', totalDamage: BigInt(300000), participantCount: BigInt(3) },
          { guildId: 'guild-3', totalDamage: BigInt(100000), participantCount: BigInt(2) },
        ])
        .mockResolvedValueOnce([{ count: BigInt(3) }]);
      mockPrisma.guild.findMany.mockResolvedValue([
        { id: 'guild-1', name: 'First', tag: '1ST' },
        { id: 'guild-2', name: 'Second', tag: '2ND' },
        { id: 'guild-3', name: 'Third', tag: '3RD' },
      ]);

      const result = await finalizeBoss('2026-W02');

      expect(result.success).toBe(true);
      expect(result.topGuilds).toBeDefined();
      expect(result.topGuilds!.length).toBeGreaterThan(0);
      expect(result.topGuilds![0].rank).toBe(1);
      expect(result.topGuilds![0].totalDamage).toBe(500000);
    });

    it('returns rankings by damage', async () => {
      mockPrisma.guildBoss.findUnique.mockResolvedValue(createMockGuildBoss());

      // Create 3 guilds to test rankings
      const guildDamages = [
        { guildId: 'guild-1', totalDamage: BigInt(500), participantCount: BigInt(1) },
        { guildId: 'guild-2', totalDamage: BigInt(400), participantCount: BigInt(1) },
        { guildId: 'guild-3', totalDamage: BigInt(300), participantCount: BigInt(1) },
      ];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(guildDamages)
        .mockResolvedValueOnce([{ count: BigInt(3) }]);

      mockPrisma.guild.findMany.mockResolvedValue([
        { id: 'guild-1', name: 'G1', tag: 'G1' },
        { id: 'guild-2', name: 'G2', tag: 'G2' },
        { id: 'guild-3', name: 'G3', tag: 'G3' },
      ]);

      const result = await finalizeBoss('2026-W02');

      expect(result.success).toBe(true);
      expect(result.topGuilds).toHaveLength(3);
      expect(result.topGuilds![0].rank).toBe(1);
      expect(result.topGuilds![0].totalDamage).toBe(500);
      expect(result.topGuilds![1].rank).toBe(2);
      expect(result.topGuilds![1].totalDamage).toBe(400);
      expect(result.topGuilds![2].rank).toBe(3);
      expect(result.topGuilds![2].totalDamage).toBe(300);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('edge cases', () => {
    it('handles BigInt damage values correctly', async () => {
      mockPrisma.guildBoss.findUnique.mockResolvedValue(
        createMockGuildBoss({ currentHp: BigInt('49999999999') })
      );
      mockPrisma.guildBossAttempt.findMany.mockResolvedValue([
        createMockGuildBossAttempt({ damage: BigInt('9999999999') }),
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-123', displayName: 'BigDamagePlayer' },
      ]);

      const result = await getGuildBossDamageBreakdown('guild-123');

      expect(result.totalDamage).toBe(9999999999);
    });

    it('handles empty guild with no attempts', async () => {
      mockPrisma.guildBoss.findUnique.mockResolvedValue(createMockGuildBoss());
      mockPrisma.guildBossAttempt.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await getGuildBossDamageBreakdown('guild-123');

      expect(result.members).toHaveLength(0);
      expect(result.totalDamage).toBe(0);
    });

    it('handles user with no Battle Hero power set', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        ...createMockGuildMember(),
        battleHeroId: 'THUNDERLORD',
        battleHeroPower: null, // Not set
        battleHeroTier: null,
        guild: createMockGuild(),
      });
      mockPrisma.guildBoss.findUnique.mockResolvedValue(createMockGuildBoss());
      mockPrisma.guildBossAttempt.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockResolvedValue([createMockGuildBossAttempt(), {}]);
      mockPrisma.guildMember.update.mockResolvedValue({});

      const result = await attackBoss('user-123');

      // Should use default power of 1000
      expect(result.success).toBe(true);
    });

    it('handles week key with special characters', async () => {
      mockPrisma.guildBoss.findUnique.mockResolvedValue(null);

      const result = await getBossLeaderboard('2026-W01');

      expect(result.entries).toHaveLength(0);
    });
  });
});
