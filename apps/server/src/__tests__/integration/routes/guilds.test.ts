/**
 * Guild Routes Integration Tests
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildTestApp, generateTestToken } from '../../helpers/testApp.js';
import {
  mockPrisma,
  createMockGuild,
  createMockGuildMember,
  createMockGuildTreasury,
  createMockGuildInvitation,
  createMockGuildBattle,
} from '../../mocks/prisma.js';
import { vi } from 'vitest';

describe('Guild Routes Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to create a guild with structures and counts as expected by the router
  const createMockGuildWithDetails = (data: any = {}) => {
    return {
      ...createMockGuild(data),
      structureKwatera: 1,
      structureSkarbiec: 1,
      structureAkademia: 1,
      structureZbrojownia: 1,
      _count: { members: 1 },
      members: [
        {
          ...createMockGuildMember({ role: 'LEADER' }),
          user: { displayName: 'Leader' }
        }
      ]
    };
  };

  // ============================================================================
  // GUILD MANAGEMENT
  // ============================================================================

  describe('POST /v1/guilds', () => {
    it('should create a new guild', async () => {
      // Mock no existing membership
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);
      
      const mockGuild = createMockGuildWithDetails({ name: 'Test Guild', tag: 'NEW' });
      
      // Mock name/tag uniqueness and final fetch
      mockPrisma.guild.findUnique
        .mockResolvedValueOnce(null) // name check
        .mockResolvedValueOnce(null) // tag check
        .mockResolvedValue(mockGuild); // final getGuild call

      mockPrisma.guild.create.mockResolvedValue(mockGuild);
      mockPrisma.guildMember.create.mockResolvedValue(createMockGuildMember({ role: 'LEADER' }));
      mockPrisma.guildTreasury.create.mockResolvedValue({ guildId: mockGuild.id });
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/guilds',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          name: 'Test Guild',
          tag: 'NEW',
          description: 'Test description',
        },
      });

      if (response.statusCode !== 200) {
        console.log('POST /v1/guilds failure:', response.body);
      }
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.guild).toBeDefined();
      expect(body.guild.name).toBe('Test Guild');
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/guilds',
        payload: {
          name: 'Test Guild',
          tag: 'TEST',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should validate tag format', async () => {
      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/guilds',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          name: 'Test Guild',
          tag: 'A', // Now invalid because min is 2
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBeDefined();
    });
  });

  describe('GET /v1/guilds/:guildId', () => {
    it('should return guild info (public endpoint)', async () => {
      const mockGuild = createMockGuildWithDetails();
      mockPrisma.guild.findUnique.mockResolvedValue(mockGuild);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/guilds/guild-123',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.guild).toBeDefined();
      expect(body.guild.name).toBe('Test Guild');
      expect(body.structures).toBeDefined();
      expect(body.bonuses).toBeDefined();
      expect(body.guild.memberCount).toBe(1);
    });

    it('should return 404 for non-existent guild', async () => {
      mockPrisma.guild.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/guilds/non-existent',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /v1/guilds', () => {
    it('should search guilds (public endpoint)', async () => {
      mockPrisma.guild.findMany.mockResolvedValue([createMockGuild()]);
      mockPrisma.guild.count.mockResolvedValue(1);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/guilds?search=test',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.guilds).toHaveLength(1);
      expect(body.guilds[0].name).toBe('Test Guild');
      expect(body.total).toBe(1);
    });
  });

  describe('GET /v1/guilds/me', () => {
    it('should return user guild membership', async () => {
      const mockGuild = createMockGuildWithDetails();
      
      // Membership call
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        ...createMockGuildMember(),
        guild: mockGuild,
        user: { displayName: 'TestUser' },
      });
      
      // Detailed guild call
      mockPrisma.guild.findUnique.mockResolvedValue(mockGuild);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/guilds/me',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.guild).toBeDefined();
      expect(body.membership).toBeDefined();
      expect(body.bonuses).toBeDefined();
      expect(body.structures).toBeDefined();
    });

    it('should return null if user has no guild', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/guilds/me',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.guild).toBeNull();
      expect(body.membership).toBeNull();
    });
  });

  describe('POST /v1/guilds/:guildId/leave', () => {
    it('should allow member to leave guild', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(createMockGuildMember());
      mockPrisma.guildMember.delete.mockResolvedValue({});

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/guilds/guild-123/leave',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('GET /v1/guilds/invitations/received', () => {
    it('should return received invitations', async () => {
      mockPrisma.guildInvitation.findMany.mockResolvedValue([
        {
          ...createMockGuildInvitation(),
          guild: { name: 'Test Guild', tag: 'TEST' },
          inviter: { displayName: 'Inviter' },
          invitee: { displayName: 'Invitee' },
        },
      ]);
      mockPrisma.guildInvitation.count.mockResolvedValue(1);

      const token = await generateTestToken('user-456');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/guilds/invitations/received',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.invitations).toBeDefined();
      expect(body.total).toBe(1);
    });
  });

  describe('GET /v1/guilds/:guildId/treasury', () => {
    it('should return treasury info', async () => {
      const mockTreasury = createMockGuildTreasury({ gold: 5000, dust: 200 });
      mockPrisma.guildTreasury.findUnique.mockResolvedValue(mockTreasury);
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        ...createMockGuildMember({ role: 'LEADER' }),
        guild: { disbanded: false },
      });
      mockPrisma.guildTreasuryLog.findFirst.mockResolvedValue(null);
      mockPrisma.guildTreasuryLog.findMany.mockResolvedValue([]);
      mockPrisma.guildTreasuryLog.count.mockResolvedValue(0);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/guilds/guild-123/treasury',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.treasury).toBeDefined();
      expect(body.treasury.gold).toBe(5000);
      expect(body.treasury.dust).toBe(200);
    });
  });

  describe('POST /v1/guilds/:guildId/treasury/deposit', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/guilds/guild-123/treasury/deposit',
        payload: {
          gold: 500,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject invalid amounts', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(createMockGuildMember());

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/guilds/guild-123/treasury/deposit',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          gold: 0,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('INVALID_AMOUNT');
    });
  });

  describe('GET /v1/guilds/:guildId/battles', () => {
    it('should return guild battles', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(createMockGuildMember());

      const mockBattle = createMockGuildBattle();
      mockPrisma.guildBattle.findMany.mockResolvedValue([
        {
          ...mockBattle,
          attackerGuild: { name: 'Guild A', tag: 'GA' },
          defenderGuild: { name: 'Guild B', tag: 'GB' },
          result: null,
        },
      ]);
      mockPrisma.guildBattle.count.mockResolvedValue(1);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/guilds/guild-123/battles',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.battles).toBeDefined();
      expect(body.total).toBe(1);
    });
  });

  describe('GET /v1/guilds/leaderboard', () => {
    it('should return guild leaderboard (public endpoint)', async () => {
      const mockGuild = createMockGuild();
      mockPrisma.guild.findMany.mockResolvedValue([
        { ...mockGuild, _count: { members: 5 } },
      ]);
      mockPrisma.guild.count.mockResolvedValue(1);
      (mockPrisma.guildBattle as any).groupBy.mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/guilds/leaderboard',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries).toBeDefined();
      expect(body.weekKey).toBeDefined();
      expect(body.total).toBeDefined();
    });

    it('should include user guild rank when authenticated', async () => {
      mockPrisma.guild.findMany.mockResolvedValue([]);
      mockPrisma.guild.count.mockResolvedValue(0);
      (mockPrisma.guildBattle as any).groupBy.mockResolvedValue([]);
      
      const mockGuild = createMockGuild({ disbanded: false });
      
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        ...createMockGuildMember(),
        guild: mockGuild,
        user: { displayName: 'Test' },
      });
      
      mockPrisma.guild.findUnique.mockResolvedValue(mockGuild);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/guilds/leaderboard',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.myGuildRank).toBeDefined();
    });
  });

  describe('GET /v1/guilds/:guildId/rank', () => {
    it('should return guild rank (public endpoint)', async () => {
      const mockGuild = createMockGuild({ honor: 1500, disbanded: false });
      mockPrisma.guild.findUnique.mockResolvedValue(mockGuild);
      mockPrisma.guild.count.mockResolvedValue(5);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/guilds/guild-123/rank',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.rank).toBeDefined();
    });
  });
});
