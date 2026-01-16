/**
 * Guild Leaderboard service unit tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../../__tests__/helpers/setup.js";
import {
  mockPrisma,
  createMockGuild,
  createMockGuildMember,
} from "../../mocks/prisma.js";

// Use vi.hoisted to create mocks that are available before module loading
const {
  mockRedisGet,
  mockRedisSetex,
  mockRedisDel,
  mockGetCurrentWeekKey,
  mockDistributeRewards,
  mockAwardChampionsTrophy,
} = vi.hoisted(() => ({
  mockRedisGet: vi.fn(),
  mockRedisSetex: vi.fn(),
  mockRedisDel: vi.fn(),
  mockGetCurrentWeekKey: vi.fn(),
  mockDistributeRewards: vi.fn(),
  mockAwardChampionsTrophy: vi.fn(),
}));

// Mock modules
vi.mock("../../../lib/redis.js", () => ({
  redis: {
    get: mockRedisGet,
    setex: mockRedisSetex,
    del: mockRedisDel,
  },
}));

vi.mock("../../../lib/queue.js", () => ({
  getCurrentWeekKey: mockGetCurrentWeekKey,
}));

vi.mock("../../../services/guildTreasury.js", () => ({
  distributeRewards: mockDistributeRewards,
}));

vi.mock("../../../services/guildProgression.js", () => ({
  awardChampionsTrophy: mockAwardChampionsTrophy,
}));

// Import after mocks
import {
  getWeeklyLeaderboard,
  getGuildRank,
  getMemberContributions,
  snapshotWeeklyRankings,
  distributeWeeklyRewards,
  invalidateLeaderboardCache,
  getAvailableWeeks,
} from "../../../services/guildLeaderboard.js";

// Helper to create mock leaderboard entry
function createMockLeaderboardEntry(overrides: Record<string, unknown> = {}) {
  return {
    rank: 1,
    guildId: "guild-123",
    guildName: "Test Guild",
    guildTag: "TEST",
    level: 5,
    honor: 1500,
    totalScore: 10000,
    battlesWon: 10,
    battlesLost: 5,
    memberCount: 8,
    ...overrides,
  };
}

describe("Guild Leaderboard Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentWeekKey.mockReturnValue("2025-W01");
    mockDistributeRewards.mockResolvedValue(undefined);
    mockAwardChampionsTrophy.mockResolvedValue(undefined);
  });

  // ============================================================================
  // getWeeklyLeaderboard
  // ============================================================================

  describe("getWeeklyLeaderboard", () => {
    it("returns cached leaderboard when available", async () => {
      const cachedData = {
        entries: [
          createMockLeaderboardEntry(),
          createMockLeaderboardEntry({ rank: 2, guildId: "guild-456" }),
        ],
        total: 2,
      };
      mockRedisGet.mockResolvedValue(JSON.stringify(cachedData));
      mockGetCurrentWeekKey.mockReturnValue("2025-W01");

      const result = await getWeeklyLeaderboard("2025-W01");

      expect(result.entries).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockPrisma.guild.findMany).not.toHaveBeenCalled();
    });

    it("caches results after database fetch", async () => {
      mockRedisGet.mockResolvedValue(null);
      mockGetCurrentWeekKey.mockReturnValue("2025-W01");
      mockPrisma.guild.findMany.mockResolvedValue([]);
      mockPrisma.guild.count.mockResolvedValue(0);
      mockPrisma.guildBattle.groupBy.mockResolvedValue([]);

      await getWeeklyLeaderboard("2025-W01");

      expect(mockRedisSetex).toHaveBeenCalled();
    });

    it("respects pagination with offset and limit", async () => {
      const cachedData = {
        entries: Array.from({ length: 10 }, (_, i) =>
          createMockLeaderboardEntry({ rank: i + 1, guildId: `guild-${i}` }),
        ),
        total: 10,
      };
      mockRedisGet.mockResolvedValue(JSON.stringify(cachedData));
      mockGetCurrentWeekKey.mockReturnValue("2025-W01");

      const result = await getWeeklyLeaderboard("2025-W01", 3, 5);

      expect(result.entries).toHaveLength(3);
      expect(result.entries[0].rank).toBe(6); // offset + 1
      expect(result.entries[2].rank).toBe(8); // offset + 3
    });

    it("uses current week key by default", async () => {
      mockGetCurrentWeekKey.mockReturnValue("2025-W05");
      mockRedisGet.mockResolvedValue(null);
      mockPrisma.guild.findMany.mockResolvedValue([]);
      mockPrisma.guild.count.mockResolvedValue(0);
      mockPrisma.guildBattle.groupBy.mockResolvedValue([]);

      const result = await getWeeklyLeaderboard();

      expect(result.weekKey).toBe("2025-W05");
    });

    it("calculates battle stats correctly", async () => {
      mockRedisGet.mockResolvedValue(null);
      mockGetCurrentWeekKey.mockReturnValue("2025-W01");

      const guilds = [
        createMockGuild({
          id: "guild-1",
          name: "Guild 1",
          honor: 1500,
          _count: { members: 10 },
        }),
      ];

      const battleStats = [
        {
          attackerGuildId: "guild-1",
          defenderGuildId: "guild-2",
          winnerGuildId: "guild-1",
        },
        {
          attackerGuildId: "guild-1",
          defenderGuildId: "guild-3",
          winnerGuildId: "guild-1",
        },
        {
          attackerGuildId: "guild-2",
          defenderGuildId: "guild-1",
          winnerGuildId: "guild-2",
        },
      ];

      mockPrisma.guild.findMany.mockResolvedValue(guilds);
      mockPrisma.guild.count.mockResolvedValue(1);
      mockPrisma.guildBattle.groupBy.mockResolvedValue(battleStats);

      const result = await getWeeklyLeaderboard("2025-W01");

      // guild-1 won 2, lost 1
      expect(result.entries[0].battlesWon).toBe(2);
      expect(result.entries[0].battlesLost).toBe(1);
    });

    it("excludes disbanded guilds", async () => {
      mockRedisGet.mockResolvedValue(null);
      mockGetCurrentWeekKey.mockReturnValue("2025-W01");
      mockPrisma.guild.findMany.mockResolvedValue([]);
      mockPrisma.guild.count.mockResolvedValue(0);
      mockPrisma.guildBattle.groupBy.mockResolvedValue([]);

      await getWeeklyLeaderboard("2025-W01");

      expect(mockPrisma.guild.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { disbanded: false },
        }),
      );
    });

    it("loads snapshot entries for past weeks", async () => {
      mockRedisGet.mockResolvedValue(null);
      mockGetCurrentWeekKey.mockReturnValue("2025-W02");
      mockPrisma.guildLeaderboardEntry.findMany.mockResolvedValue([
        {
          guildId: "guild-1",
          honor: 900,
          totalScore: 5000,
          battlesWon: 3,
          battlesLost: 1,
          memberCount: 7,
          guild: {
            name: "Guild 1",
            tag: "G1",
            level: 4,
            _count: { members: 7 },
          },
        },
      ]);
      mockPrisma.guildLeaderboardEntry.count.mockResolvedValue(1);

      const result = await getWeeklyLeaderboard("2025-W01");

      expect(mockPrisma.guildLeaderboardEntry.findMany).toHaveBeenCalled();
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].honor).toBe(900);
    });
  });

  // ============================================================================
  // getGuildRank
  // ============================================================================

  describe("getGuildRank", () => {
    it("returns guild rank and honor", async () => {
      mockGetCurrentWeekKey.mockReturnValue("2025-W01");
      const guild = createMockGuild({ honor: 1200 });
      mockPrisma.guild.findUnique.mockResolvedValue(guild);
      mockPrisma.guild.count.mockResolvedValue(5); // 5 guilds with higher honor

      const result = await getGuildRank("guild-123");

      expect(result).toEqual({ rank: 6, honor: 1200 });
    });

    it("returns rank 1 when highest honor", async () => {
      mockGetCurrentWeekKey.mockReturnValue("2025-W01");
      const guild = createMockGuild({ honor: 2000 });
      mockPrisma.guild.findUnique.mockResolvedValue(guild);
      mockPrisma.guild.count.mockResolvedValue(0); // No guilds with higher honor

      const result = await getGuildRank("guild-123");

      expect(result).toEqual({ rank: 1, honor: 2000 });
    });

    it("returns null for non-existent guild", async () => {
      mockGetCurrentWeekKey.mockReturnValue("2025-W01");
      mockPrisma.guild.findUnique.mockResolvedValue(null);

      const result = await getGuildRank("nonexistent");

      expect(result).toBeNull();
    });

    it("returns null for disbanded guild", async () => {
      mockGetCurrentWeekKey.mockReturnValue("2025-W01");
      const guild = createMockGuild({ disbanded: true });
      mockPrisma.guild.findUnique.mockResolvedValue(guild);

      const result = await getGuildRank("guild-123");

      expect(result).toBeNull();
    });

    it("returns rank from snapshots for past weeks", async () => {
      mockGetCurrentWeekKey.mockReturnValue("2025-W02");
      mockPrisma.guildLeaderboardEntry.findUnique.mockResolvedValue({
        guildId: "guild-123",
        honor: 900,
      });
      mockPrisma.guildLeaderboardEntry.count.mockResolvedValue(2);

      const result = await getGuildRank("guild-123", "2025-W01");

      expect(result).toEqual({ rank: 3, honor: 900 });
    });
  });

  // ============================================================================
  // getMemberContributions
  // ============================================================================

  describe("getMemberContributions", () => {
    it("returns member contributions sorted by XP", async () => {
      const members = [
        {
          ...createMockGuildMember({
            userId: "user-1",
            weeklyXpContributed: 500,
          }),
          user: { displayName: "Top Contributor" },
        },
        {
          ...createMockGuildMember({
            userId: "user-2",
            weeklyXpContributed: 200,
          }),
          user: { displayName: "Second Best" },
        },
      ];
      mockPrisma.guildMember.findMany.mockResolvedValue(members);

      const result = await getMemberContributions("guild-123");

      expect(result).toHaveLength(2);
      expect(result[0].displayName).toBe("Top Contributor");
      expect(result[0].xpContributed).toBe(500);
    });

    it("returns empty array for guild with no members", async () => {
      mockPrisma.guildMember.findMany.mockResolvedValue([]);

      const result = await getMemberContributions("guild-123");

      expect(result).toEqual([]);
    });

    it("includes all contribution fields", async () => {
      const member = {
        ...createMockGuildMember({
          userId: "user-1",
          weeklyXpContributed: 500,
          totalGoldDonated: 10000,
          totalDustDonated: 100,
          battlesParticipated: 5,
          battlesWon: 3,
        }),
        user: { displayName: "Test User" },
      };
      mockPrisma.guildMember.findMany.mockResolvedValue([member]);

      const result = await getMemberContributions("guild-123");

      expect(result[0]).toMatchObject({
        userId: "user-1",
        displayName: "Test User",
        xpContributed: 500,
        goldDonated: 10000,
        dustDonated: 100,
        battlesParticipated: 5,
        battlesWon: 3,
      });
    });
  });

  // ============================================================================
  // snapshotWeeklyRankings
  // ============================================================================

  describe("snapshotWeeklyRankings", () => {
    it("creates leaderboard entries for all active guilds", async () => {
      const guilds = [
        createMockGuild({ id: "guild-1", _count: { members: 10 } }),
        createMockGuild({ id: "guild-2", _count: { members: 8 } }),
      ];
      mockPrisma.guild.findMany.mockResolvedValue(guilds);
      mockPrisma.guildBattle.groupBy.mockResolvedValue([]);
      mockPrisma.guildBattle.count.mockResolvedValue(0);
      mockPrisma.guildLeaderboardEntry.upsert.mockResolvedValue({});

      await snapshotWeeklyRankings("2025-W01");

      expect(mockPrisma.guildLeaderboardEntry.upsert).toHaveBeenCalledTimes(2);
    });

    it("calculates battle wins from groupBy results", async () => {
      const guilds = [
        createMockGuild({ id: "guild-1", _count: { members: 10 } }),
      ];
      const battleStats = [{ winnerGuildId: "guild-1", _count: 5 }];

      mockPrisma.guild.findMany.mockResolvedValue(guilds);
      mockPrisma.guildBattle.groupBy.mockResolvedValue(battleStats);
      mockPrisma.guildBattle.count.mockResolvedValue(2); // losses
      mockPrisma.guildLeaderboardEntry.upsert.mockResolvedValue({});

      await snapshotWeeklyRankings("2025-W01");

      expect(mockPrisma.guildLeaderboardEntry.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            battlesWon: 5,
          }),
        }),
      );
    });

    it("handles guilds with no battles", async () => {
      const guilds = [
        createMockGuild({ id: "guild-1", _count: { members: 10 } }),
      ];

      mockPrisma.guild.findMany.mockResolvedValue(guilds);
      mockPrisma.guildBattle.groupBy.mockResolvedValue([]);
      mockPrisma.guildBattle.count.mockResolvedValue(0);
      mockPrisma.guildLeaderboardEntry.upsert.mockResolvedValue({});

      await snapshotWeeklyRankings("2025-W01");

      expect(mockPrisma.guildLeaderboardEntry.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            battlesWon: 0,
            battlesLost: 0,
          }),
        }),
      );
    });
  });

  // ============================================================================
  // distributeWeeklyRewards
  // ============================================================================

  describe("distributeWeeklyRewards", () => {
    beforeEach(() => {
      // Mock getWeeklyLeaderboard by mocking redis
      mockRedisGet.mockResolvedValue(null);
      mockPrisma.guildBattle.groupBy.mockResolvedValue([]);
    });

    it("distributes rewards to top 25 guilds", async () => {
      const guilds = Array.from({ length: 30 }, (_, i) =>
        createMockGuild({
          id: `guild-${i}`,
          honor: 1500 - i,
          _count: { members: 10 },
        }),
      );

      mockPrisma.guild.findMany.mockResolvedValue(guilds);
      mockPrisma.guild.count.mockResolvedValue(30);

      await distributeWeeklyRewards("2025-W01");

      // Only top 25 guilds get rewards
      expect(mockDistributeRewards).toHaveBeenCalledTimes(25);
    });

    it("gives correct rewards for rank 1", async () => {
      const guilds = [
        createMockGuild({
          id: "guild-1",
          honor: 2000,
          _count: { members: 10 },
        }),
      ];

      mockPrisma.guild.findMany.mockResolvedValue(guilds);
      mockPrisma.guild.count.mockResolvedValue(1);

      await distributeWeeklyRewards("2025-W01");

      expect(mockDistributeRewards).toHaveBeenCalledWith(
        "guild-1",
        { gold: 50000, dust: 500 },
        expect.stringContaining("Rank #1"),
      );
    });

    it("gives correct rewards for rank 2", async () => {
      const guilds = [
        createMockGuild({
          id: "guild-1",
          honor: 2000,
          _count: { members: 10 },
        }),
        createMockGuild({
          id: "guild-2",
          honor: 1800,
          _count: { members: 10 },
        }),
      ];

      mockPrisma.guild.findMany.mockResolvedValue(guilds);
      mockPrisma.guild.count.mockResolvedValue(2);

      await distributeWeeklyRewards("2025-W01");

      expect(mockDistributeRewards).toHaveBeenCalledWith(
        "guild-2",
        { gold: 30000, dust: 300 },
        expect.stringContaining("Rank #2"),
      );
    });

    it("gives correct rewards for rank 3", async () => {
      const guilds = Array.from({ length: 3 }, (_, i) =>
        createMockGuild({
          id: `guild-${i}`,
          honor: 2000 - i * 100,
          _count: { members: 10 },
        }),
      );

      mockPrisma.guild.findMany.mockResolvedValue(guilds);
      mockPrisma.guild.count.mockResolvedValue(3);

      await distributeWeeklyRewards("2025-W01");

      expect(mockDistributeRewards).toHaveBeenCalledWith(
        "guild-2",
        { gold: 20000, dust: 200 },
        expect.stringContaining("Rank #3"),
      );
    });

    it("awards champions trophy to top 10", async () => {
      const guilds = Array.from({ length: 15 }, (_, i) =>
        createMockGuild({
          id: `guild-${i}`,
          honor: 2000 - i * 50,
          _count: { members: 10 },
        }),
      );

      mockPrisma.guild.findMany.mockResolvedValue(guilds);
      mockPrisma.guild.count.mockResolvedValue(15);

      await distributeWeeklyRewards("2025-W01");

      // Top 10 guilds get champions trophy
      expect(mockAwardChampionsTrophy).toHaveBeenCalledTimes(10);
    });

    it("does not award trophy to ranks 11-25", async () => {
      const guilds = Array.from({ length: 25 }, (_, i) =>
        createMockGuild({
          id: `guild-${i}`,
          honor: 2000 - i * 50,
          _count: { members: 10 },
        }),
      );

      mockPrisma.guild.findMany.mockResolvedValue(guilds);
      mockPrisma.guild.count.mockResolvedValue(25);

      await distributeWeeklyRewards("2025-W01");

      // Verify trophy only for top 10
      expect(mockAwardChampionsTrophy).toHaveBeenCalledTimes(10);
      expect(mockAwardChampionsTrophy).not.toHaveBeenCalledWith("guild-10");
    });
  });

  // ============================================================================
  // invalidateLeaderboardCache
  // ============================================================================

  describe("invalidateLeaderboardCache", () => {
    it("deletes cache for specified week", async () => {
      await invalidateLeaderboardCache("2025-W05");

      expect(mockRedisDel).toHaveBeenCalledWith(
        "leaderboard:guild:2025-W05:full",
      );
    });

    it("uses current week by default", async () => {
      mockGetCurrentWeekKey.mockReturnValue("2025-W10");

      await invalidateLeaderboardCache();

      expect(mockRedisDel).toHaveBeenCalledWith(
        "leaderboard:guild:2025-W10:full",
      );
    });
  });

  // ============================================================================
  // getAvailableWeeks
  // ============================================================================

  describe("getAvailableWeeks", () => {
    it("returns distinct week keys", async () => {
      mockPrisma.guildLeaderboardEntry.findMany.mockResolvedValue([
        { weekKey: "2025-W05" },
        { weekKey: "2025-W04" },
        { weekKey: "2025-W03" },
      ]);

      const result = await getAvailableWeeks();

      expect(result).toEqual(["2025-W05", "2025-W04", "2025-W03"]);
    });

    it("respects limit parameter", async () => {
      mockPrisma.guildLeaderboardEntry.findMany.mockResolvedValue([
        { weekKey: "2025-W05" },
      ]);

      await getAvailableWeeks(5);

      expect(mockPrisma.guildLeaderboardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        }),
      );
    });

    it("orders by week key descending", async () => {
      mockPrisma.guildLeaderboardEntry.findMany.mockResolvedValue([]);

      await getAvailableWeeks();

      expect(mockPrisma.guildLeaderboardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { weekKey: "desc" },
        }),
      );
    });

    it("returns empty array when no weeks available", async () => {
      mockPrisma.guildLeaderboardEntry.findMany.mockResolvedValue([]);

      const result = await getAvailableWeeks();

      expect(result).toEqual([]);
    });
  });
});
