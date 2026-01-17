/**
 * Integration tests for heroes routes
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildTestApp, generateTestToken } from '../../helpers/testApp.js';
import { mockPrisma, createMockInventory } from '../../mocks/prisma.js';

// Import test setup (mocks prisma, redis)
import '../../helpers/setup.js';

describe('Heroes Routes', () => {
  let app: FastifyInstance;
  let authToken: string;

  beforeEach(async () => {
    app = await buildTestApp();
    authToken = await generateTestToken('user-123');
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /v1/heroes/unlock', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/heroes/unlock',
        payload: { heroId: 'storm' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 with invalid request body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/heroes/unlock',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {}, // Missing heroId
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: 'Invalid request body' });
    });

    it('should unlock a free starter hero', async () => {
      const mockInventory = createMockInventory({
        unlockedHeroIds: [],
        gold: 100,
        dust: 50,
      });

      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);
      mockPrisma.inventory.update.mockResolvedValue({
        ...mockInventory,
        unlockedHeroIds: ['storm'],
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/heroes/unlock',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: { heroId: 'storm' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.heroId).toBe('storm');
      expect(body.unlockedHeroIds).toContain('storm');

      // Starter heroes should not deduct resources
      expect(mockPrisma.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            gold: 100, // Unchanged
            dust: 50,  // Unchanged
          }),
        })
      );
    });

    it('should unlock a common hero and deduct resources', async () => {
      const mockInventory = createMockInventory({
        unlockedHeroIds: [],
        gold: 5000,
        dust: 1000,
      });

      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);
      mockPrisma.inventory.update.mockResolvedValue({
        ...mockInventory,
        gold: 2000,
        dust: 500,
        unlockedHeroIds: ['frost'],
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/heroes/unlock',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: { heroId: 'frost' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.heroId).toBe('frost');
    });

    it('should fail if hero is already unlocked', async () => {
      const mockInventory = createMockInventory({
        unlockedHeroIds: ['storm'],
        gold: 100,
        dust: 50,
      });

      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/heroes/unlock',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: { heroId: 'storm' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Hero already unlocked');
    });

    it('should fail if not enough resources', async () => {
      const mockInventory = createMockInventory({
        unlockedHeroIds: [],
        gold: 100,  // Not enough for common hero (needs 3000)
        dust: 50,
      });

      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/heroes/unlock',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: { heroId: 'frost' }, // common rarity
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Not enough resources');
    });

    it('should fail if hero does not exist (invalid heroId)', async () => {
      // Invalid heroId fails Zod validation before reaching the service
      const response = await app.inject({
        method: 'POST',
        url: '/v1/heroes/unlock',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: { heroId: 'nonexistent_hero' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: 'Invalid request body' });
    });

    it('should fail if inventory not found', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/heroes/unlock',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: { heroId: 'storm' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Inventory not found');
    });
  });

  describe('POST /v1/turrets/unlock', () => {
    // Valid turret types: 'railgun', 'artillery', 'sniper', 'arc', 'cryo', 'flame', 'support', 'poison'
    // Starter turrets: 'railgun', 'cryo'

    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/turrets/unlock',
        payload: { turretType: 'railgun' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 with invalid request body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/turrets/unlock',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {}, // Missing turretType
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: 'Invalid request body' });
    });

    it('should unlock a free starter turret (arrow)', async () => {
      const mockInventory = createMockInventory({
        unlockedTurretIds: [],
        gold: 100,
        dust: 50,
      });

      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);
      mockPrisma.inventory.update.mockResolvedValue({
        ...mockInventory,
        unlockedTurretIds: ['railgun'],
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/turrets/unlock',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: { turretType: 'railgun' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.turretType).toBe('railgun');
      expect(body.unlockedTurretIds).toContain('railgun');

      // Starter turrets should not deduct resources
      expect(mockPrisma.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            gold: 100, // Unchanged
            dust: 50,  // Unchanged
          }),
        })
      );
    });

    it('should unlock a non-starter turret and deduct resources', async () => {
      const mockInventory = createMockInventory({
        unlockedTurretIds: [],
        gold: 5000,
        dust: 1000,
      });

      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);
      mockPrisma.inventory.update.mockResolvedValue({
        ...mockInventory,
        gold: 3000,
        dust: 500,
        unlockedTurretIds: ['artillery'],
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/turrets/unlock',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: { turretType: 'artillery' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.turretType).toBe('artillery');
    });

    it('should fail if turret is already unlocked', async () => {
      const mockInventory = createMockInventory({
        unlockedTurretIds: ['railgun'],
        gold: 100,
        dust: 50,
      });

      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/turrets/unlock',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: { turretType: 'railgun' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Turret already unlocked');
    });

    it('should fail if not enough resources for non-starter turret', async () => {
      const mockInventory = createMockInventory({
        unlockedTurretIds: [],
        gold: 100,  // Not enough
        dust: 50,
      });

      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/turrets/unlock',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: { turretType: 'artillery' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Not enough resources');
    });

    it('should fail if inventory not found', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/turrets/unlock',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: { turretType: 'railgun' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Inventory not found');
    });
  });
});
