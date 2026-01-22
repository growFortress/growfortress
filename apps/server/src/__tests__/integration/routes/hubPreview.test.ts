/**
 * Integration tests for hub preview routes
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildTestApp, generateTestToken } from '../../helpers/testApp.js';
import { mockPrisma } from '../../mocks/prisma.js';

// Import test setup (mocks prisma, redis, config)
import '../../helpers/setup.js';

describe('Hub Preview Routes', () => {
  let app: FastifyInstance;
  let authToken: string;

  beforeEach(async () => {
    app = await buildTestApp();
    authToken = await generateTestToken('user-123');
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /v1/hub/:userId', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/hub/target-user-456',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 404 for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/hub/nonexistent-user',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: 'User not found' });
    });

    it('should return 404 for banned user', async () => {
      // The query has banned: false filter, so banned users return null
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/hub/banned-user',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return hub preview for valid user', async () => {
      const targetUserId = 'target-user-456';
      const mockUser = {
        id: targetUserId,
        displayName: 'TargetPlayer',
        description: 'A strong player',
        highestWave: 150,
        defaultFortressClass: 'fire',
        exclusiveItems: ['mythic_crown'],
        progression: { level: 25 },
        powerUpgrades: {
          heroUpgrades: [
            { heroId: 'storm', statUpgrades: { hp: 10, damage: 8 } },
          ],
          turretUpgrades: [
            { turretType: 'railgun', statUpgrades: { damage: 5, attackSpeed: 3 } },
          ],
          cachedTotalPower: 5000,
        },
        inventory: {
          unlockedHeroIds: ['storm', 'frost'],
          unlockedTurretIds: ['railgun', 'artillery'],
        },
        artifacts: [
          {
            artifactId: 'blazing_sword',
            level: 10,
            equippedSlot: 'weapon',
            equippedToHeroId: 'storm',
          },
        ],
        guildMembership: {
          guild: { tag: 'PRO' },
        },
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const response = await app.inject({
        method: 'GET',
        url: `/v1/hub/${targetUserId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.userId).toBe(targetUserId);
      expect(body.displayName).toBe('TargetPlayer');
      expect(body.description).toBe('A strong player');
      expect(body.guildTag).toBe('PRO');
      expect(body.level).toBe(25);
      expect(body.highestWave).toBe(150);
      expect(body.totalPower).toBe(5000);
      expect(body.fortressClass).toBe('fire');
      expect(body.exclusiveItems).toEqual(['mythic_crown']);

      // Check heroes
      expect(body.heroes).toHaveLength(5);
      const stormHero = body.heroes.find((h: any) => h.heroId === 'storm');
      expect(stormHero).toBeDefined();
      expect(stormHero.level).toBe(18); // hp(10) + damage(8)
      expect(stormHero.equippedArtifacts).toHaveLength(1);
      expect(stormHero.equippedArtifacts[0].artifactId).toBe('blazing_sword');

      // Check turrets
      expect(body.turrets).toHaveLength(2);
      const railgunTurret = body.turrets.find((t: any) => t.turretType === 'railgun');
      expect(railgunTurret).toBeDefined();
      expect(railgunTurret.level).toBe(8); // damage(5) + attackSpeed(3)
    });

    it('should allow viewing own hub preview', async () => {
      const mockUser = {
        id: 'user-123',
        displayName: 'SelfPlayer',
        description: null,
        highestWave: 50,
        defaultFortressClass: 'natural',
        exclusiveItems: [],
        progression: { level: 10 },
        powerUpgrades: null,
        inventory: null,
        artifacts: [],
        guildMembership: null,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/hub/user-123',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().displayName).toBe('SelfPlayer');
    });

    it('should handle user with minimal data', async () => {
      const mockUser = {
        id: 'minimal-user',
        displayName: 'NewPlayer',
        description: null,
        highestWave: 0,
        defaultFortressClass: null,
        exclusiveItems: null,
        progression: null,
        powerUpgrades: null,
        inventory: null,
        artifacts: [],
        guildMembership: null,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/hub/minimal-user',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.displayName).toBe('NewPlayer');
      expect(body.level).toBe(1); // Default
      expect(body.totalPower).toBe(0); // Default
      expect(body.fortressClass).toBe('natural'); // Default
      expect(body.exclusiveItems).toEqual([]);
      expect(body.heroes.map((hero: any) => hero.heroId)).toEqual([
        'vanguard',
        'storm',
        'medic',
        'pyro',
      ]);
      expect(body.turrets.map((turret: any) => turret.turretType)).toEqual(['railgun']);
      expect(body.guildTag).toBeNull();
    });

    it('should validate userId parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/hub/',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      // Empty userId should result in 400 (validation error from Zod)
      expect(response.statusCode).toBe(400);
    });
  });
});
