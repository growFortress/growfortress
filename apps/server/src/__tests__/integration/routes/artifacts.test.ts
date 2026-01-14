/**
 * Integration tests for artifacts routes
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildTestApp, generateTestToken } from '../../helpers/testApp.js';
import { mockPrisma, createMockInventory, createMockPlayerArtifact } from '../../mocks/prisma.js';

// Import test setup (mocks prisma, redis, config)
import '../../helpers/setup.js';

describe('Artifacts Routes', () => {
  let app: FastifyInstance;
  let authToken: string;

  beforeEach(async () => {
    app = await buildTestApp();
    authToken = await generateTestToken('user-123');
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /v1/artifacts', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/artifacts',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return empty artifacts and items for new player', async () => {
      mockPrisma.playerArtifact.findMany.mockResolvedValue([]);
      mockPrisma.inventory.findUnique.mockResolvedValue(createMockInventory({
        items: {},
      }));

      const response = await app.inject({
        method: 'GET',
        url: '/v1/artifacts',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.artifacts).toEqual([]);
      expect(body.items).toEqual([]);
    });

    it('should return player artifacts and items', async () => {
      const mockArtifact = createMockPlayerArtifact('thunderstrike_blade');

      mockPrisma.playerArtifact.findMany.mockResolvedValue([mockArtifact]);
      mockPrisma.inventory.findUnique.mockResolvedValue(createMockInventory({
        items: { potion_hp: 5, potion_mana: 3 },
      }));

      const response = await app.inject({
        method: 'GET',
        url: '/v1/artifacts',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.artifacts).toHaveLength(1);
      expect(body.artifacts[0].artifactId).toBe('thunderstrike_blade');
      expect(body.items).toHaveLength(2);
    });
  });

  describe('POST /v1/artifacts/equip', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/artifacts/equip',
        payload: { artifactInstanceId: 'art-123', heroId: 'storm' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 with invalid request body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/artifacts/equip',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {}, // Missing required fields
      });

      expect(response.statusCode).toBe(400);
    });

    it('should fail if artifact not found', async () => {
      mockPrisma.playerArtifact.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/artifacts/equip',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: { artifactInstanceId: 'nonexistent', heroId: 'storm', slotType: 'weapon' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('Artifact not found');
    });
  });

  describe('POST /v1/artifacts/unequip', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/artifacts/unequip',
        payload: { artifactInstanceId: 'art-123' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 with invalid request body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/artifacts/unequip',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {}, // Missing required fields
      });

      expect(response.statusCode).toBe(400);
    });

    it('should fail if artifact not found', async () => {
      mockPrisma.playerArtifact.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/artifacts/unequip',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: { artifactInstanceId: 'nonexistent' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('Artifact not found');
    });

    it('should unequip artifact successfully', async () => {
      const mockArtifact = createMockPlayerArtifact('thunderstrike_blade', {
        id: 'art-123',
        equippedToHeroId: 'storm',
      });

      mockPrisma.playerArtifact.findFirst.mockResolvedValue(mockArtifact);
      mockPrisma.playerArtifact.update.mockResolvedValue({
        ...mockArtifact,
        equippedToHeroId: null,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/artifacts/unequip',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: { artifactInstanceId: 'art-123' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.artifact.equippedToHeroId).toBeNull();
    });
  });

  describe('POST /v1/items/use', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/items/use',
        payload: { itemId: 'potion_hp', amount: 1 },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 with invalid request body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/items/use',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {}, // Missing required fields
      });

      expect(response.statusCode).toBe(400);
    });

    it('should fail if inventory not found', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/items/use',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: { itemId: 'potion_hp', amount: 1 },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('Inventory not found');
    });

    it('should fail if not enough items', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(createMockInventory({
        items: { potion_hp: 1 },
      }));

      const response = await app.inject({
        method: 'POST',
        url: '/v1/items/use',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: { itemId: 'potion_hp', amount: 5 },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('Not enough items');
    });

    it('should use item successfully', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(createMockInventory({
        items: { potion_hp: 5 },
      }));
      mockPrisma.inventory.update.mockResolvedValue(createMockInventory({
        items: { potion_hp: 4 },
      }));

      const response = await app.inject({
        method: 'POST',
        url: '/v1/items/use',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: { itemId: 'potion_hp', amount: 1 },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
    });
  });

  describe('POST /v1/artifacts/add (Admin)', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/artifacts/add',
        payload: { artifactId: 'thunderstrike_blade' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 with missing artifactId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/artifacts/add',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('artifactId is required');
    });

    it('should fail if already owns artifact', async () => {
      const mockArtifact = createMockPlayerArtifact('thunderstrike_blade');
      mockPrisma.playerArtifact.findUnique.mockResolvedValue(mockArtifact);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/artifacts/add',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: { artifactId: 'thunderstrike_blade' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('You already own this artifact');
    });

    it('should add artifact successfully', async () => {
      mockPrisma.playerArtifact.findUnique.mockResolvedValue(null);
      const mockArtifact = createMockPlayerArtifact('thunderstrike_blade');
      mockPrisma.playerArtifact.create.mockResolvedValue(mockArtifact);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/artifacts/add',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: { artifactId: 'thunderstrike_blade' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.artifact.artifactId).toBe('thunderstrike_blade');
    });
  });

  describe('POST /v1/items/add (Admin)', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/items/add',
        payload: { items: { potion_hp: 5 } },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 with missing items', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/items/add',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('items object is required');
    });

    it('should fail if inventory not found', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/items/add',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: { items: { potion_hp: 5 } },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('Inventory not found');
    });

    it('should add items successfully', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(createMockInventory({
        items: { potion_hp: 2 },
      }));
      mockPrisma.inventory.update.mockResolvedValue(createMockInventory({
        items: { potion_hp: 7, potion_mana: 3 },
      }));

      const response = await app.inject({
        method: 'POST',
        url: '/v1/items/add',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: { items: { potion_hp: 5, potion_mana: 3 } },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
    });
  });
});
