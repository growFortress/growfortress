/**
 * Energy Routes Integration Tests
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildTestApp, generateTestToken } from '../../helpers/testApp.js';
import { mockPrisma, createMockInventory } from '../../mocks/prisma.js';
import '../../helpers/setup.js';

// Import energy config for test values
import { ENERGY_CONFIG } from '@arcade/protocol';

// Helper to create mock user energy data
function createMockUserEnergy(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-123',
    currentEnergy: ENERGY_CONFIG.MAX_ENERGY,
    maxEnergy: ENERGY_CONFIG.MAX_ENERGY,
    lastRegenAt: new Date(),
    ...overrides,
  };
}

describe('Energy Routes Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Import energy routes and add to test app builder
    const { default: energyRoutes } = await import('../../../routes/energy.js');
    const { buildTestApp: buildApp } = await import('../../helpers/testApp.js');

    app = await buildApp();
    await app.register(energyRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // GET /v1/energy
  // ============================================================================

  describe('GET /v1/energy', () => {
    it('should return 401 without auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/energy',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Unauthorized');
    });

    it('should return current energy and max', async () => {
      const mockEnergy = createMockUserEnergy({
        currentEnergy: 30,
        maxEnergy: ENERGY_CONFIG.MAX_ENERGY,
      });
      mockPrisma.userEnergy.findUnique.mockResolvedValue(mockEnergy);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/energy',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.currentEnergy).toBe(30);
      expect(body.maxEnergy).toBe(ENERGY_CONFIG.MAX_ENERGY);
      expect(body.canPlay).toBe(true);
    });

    it('should return time until next recharge when below max', async () => {
      const lastRegenAt = new Date(Date.now() - 3 * 60 * 1000); // 3 minutes ago
      const mockEnergy = createMockUserEnergy({
        currentEnergy: 30,
        lastRegenAt,
      });
      mockPrisma.userEnergy.findUnique.mockResolvedValue(mockEnergy);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/energy',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.currentEnergy).toBe(30);
      expect(body.nextRegenAt).not.toBeNull();
      expect(body.timeToFullRegen).toBeGreaterThan(0);
    });

    it('should initialize energy if user has no record', async () => {
      mockPrisma.userEnergy.findUnique.mockResolvedValue(null);
      mockPrisma.userEnergy.create.mockResolvedValue(createMockUserEnergy());

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/energy',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.currentEnergy).toBe(ENERGY_CONFIG.MAX_ENERGY);
      expect(body.maxEnergy).toBe(ENERGY_CONFIG.MAX_ENERGY);
      expect(mockPrisma.userEnergy.create).toHaveBeenCalled();
    });

    it('should calculate regenerated energy since last check', async () => {
      // 25 minutes ago - should have regenerated 2 energy (10 min per point)
      const lastRegenAt = new Date(Date.now() - 25 * 60 * 1000);
      const mockEnergy = createMockUserEnergy({
        currentEnergy: 30,
        lastRegenAt,
      });
      mockPrisma.userEnergy.findUnique.mockResolvedValue(mockEnergy);
      mockPrisma.userEnergy.update.mockResolvedValue({
        ...mockEnergy,
        currentEnergy: 32,
      });

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/energy',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      // Should have regenerated 2 points (25 min / 10 min per point = 2)
      expect(body.currentEnergy).toBe(32);
      expect(mockPrisma.userEnergy.update).toHaveBeenCalled();
    });

    it('should cap regenerated energy at max energy', async () => {
      // Very old lastRegenAt - should have regenerated way more than max
      const lastRegenAt = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const mockEnergy = createMockUserEnergy({
        currentEnergy: 45,
        lastRegenAt,
      });
      mockPrisma.userEnergy.findUnique.mockResolvedValue(mockEnergy);
      mockPrisma.userEnergy.update.mockResolvedValue({
        ...mockEnergy,
        currentEnergy: ENERGY_CONFIG.MAX_ENERGY,
      });

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/energy',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      // Should be capped at MAX_ENERGY
      expect(body.currentEnergy).toBe(ENERGY_CONFIG.MAX_ENERGY);
    });

    it('should return null nextRegenAt when at max energy', async () => {
      const mockEnergy = createMockUserEnergy({
        currentEnergy: ENERGY_CONFIG.MAX_ENERGY,
      });
      mockPrisma.userEnergy.findUnique.mockResolvedValue(mockEnergy);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/energy',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.currentEnergy).toBe(ENERGY_CONFIG.MAX_ENERGY);
      expect(body.nextRegenAt).toBeNull();
      expect(body.timeToFullRegen).toBe(0);
    });
  });

  // ============================================================================
  // POST /v1/energy/refill
  // ============================================================================

  describe('POST /v1/energy/refill', () => {
    it('should return 401 without auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/energy/refill',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Unauthorized');
    });

    it('should refill energy with currency', async () => {
      const mockEnergy = createMockUserEnergy({
        currentEnergy: 20,
      });
      const mockInventory = createMockInventory({
        dust: 100,
      });

      mockPrisma.userEnergy.findUnique.mockResolvedValue(mockEnergy);
      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn({
          inventory: {
            update: vi.fn().mockResolvedValue({
              ...mockInventory,
              dust: 100 - ENERGY_CONFIG.REFILL_DUST_COST,
            }),
          },
          userEnergy: {
            update: vi.fn().mockResolvedValue({
              ...mockEnergy,
              currentEnergy: ENERGY_CONFIG.MAX_ENERGY,
            }),
          },
        });
      });

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/energy/refill',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.newEnergy).toBe(ENERGY_CONFIG.MAX_ENERGY);
      expect(body.dustSpent).toBe(ENERGY_CONFIG.REFILL_DUST_COST);
      expect(body.newDust).toBe(100 - ENERGY_CONFIG.REFILL_DUST_COST);
    });

    it('should reject if insufficient currency', async () => {
      const mockEnergy = createMockUserEnergy({
        currentEnergy: 20,
      });
      const mockInventory = createMockInventory({
        dust: 10, // Less than REFILL_DUST_COST
      });

      mockPrisma.userEnergy.findUnique.mockResolvedValue(mockEnergy);
      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/energy/refill',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('INSUFFICIENT_DUST');
    });

    it('should reject if already at max energy', async () => {
      const mockEnergy = createMockUserEnergy({
        currentEnergy: ENERGY_CONFIG.MAX_ENERGY,
      });
      const mockInventory = createMockInventory({
        dust: 100,
      });

      mockPrisma.userEnergy.findUnique.mockResolvedValue(mockEnergy);
      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/energy/refill',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('ENERGY_FULL');
    });

    it('should return error if user inventory not found', async () => {
      const mockEnergy = createMockUserEnergy({
        currentEnergy: 20,
      });

      mockPrisma.userEnergy.findUnique.mockResolvedValue(mockEnergy);
      mockPrisma.inventory.findUnique.mockResolvedValue(null);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/energy/refill',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('User not found');
    });

    it('should initialize energy record if missing before refill check', async () => {
      // First findUnique returns null, triggering create
      mockPrisma.userEnergy.findUnique.mockResolvedValueOnce(null);
      mockPrisma.userEnergy.create.mockResolvedValue(
        createMockUserEnergy({ currentEnergy: ENERGY_CONFIG.MAX_ENERGY })
      );
      // Second call (from the inventory lookup parallel)
      mockPrisma.inventory.findUnique.mockResolvedValue(createMockInventory({ dust: 100 }));

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/energy/refill',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      // Should be ENERGY_FULL since create initializes at max
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('ENERGY_FULL');
    });
  });
});
