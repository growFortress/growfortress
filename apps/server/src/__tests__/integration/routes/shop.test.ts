/**
 * Shop Routes Integration Tests
 *
 * IMPORTANT: vi.mock calls are hoisted to the top of the file by Vitest.
 * The prisma mock MUST be declared here (not just in setup.ts) to ensure
 * it's applied before any transitive imports of prisma through testApp.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';

// Mock prisma - hoisted before any imports that depend on it
vi.mock('../../../lib/prisma.js', async () => {
  const { mockPrisma } = await import('../../mocks/prisma.js');
  return {
    prisma: mockPrisma,
    Prisma: {},
  };
});

// Mock config - needed before redis and other modules load
vi.mock('../../../config.js', () => ({
  config: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-key-for-testing-purposes-only-minimum-32-chars',
    JWT_ACCESS_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '7d',
    PORT: 3000,
    NODE_ENV: 'test',
    RUN_TOKEN_SECRET: 'test-run-token-secret-key-for-testing-minimum-32-chars',
    RUN_TOKEN_EXPIRY_SECONDS: 600,
    RATE_LIMIT_MAX: 100,
    RATE_LIMIT_WINDOW_MS: 60000,
    API_PREFIX: '',
  },
  parseDuration: (duration: string): number => {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 0;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 0;
    }
  },
}));

// Mock redis
vi.mock('../../../lib/redis.js', async () => {
  const { mockRedis } = await import('../../mocks/redis.js');
  return { redis: mockRedis };
});

import { buildTestApp, generateTestToken } from '../../helpers/testApp.js';
import { mockPrisma, createMockInventory } from '../../mocks/prisma.js';
import '../../helpers/setup.js';

// Mock Stripe to avoid real API calls
vi.mock('../../../lib/stripe.js', () => ({
  isStripeConfigured: vi.fn(() => true),
  createCheckoutSession: vi.fn(() =>
    Promise.resolve({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/test',
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    })
  ),
  getCheckoutSession: vi.fn(() =>
    Promise.resolve({
      id: 'cs_test_123',
      payment_status: 'paid',
      status: 'complete',
    })
  ),
  verifyWebhookSignature: vi.fn(),
  isSessionPaid: vi.fn(() => true),
}));

// Helper to create mock user
function createMockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-123',
    username: 'testuser',
    displayName: 'TestUser',
    role: 'USER',
    preferredCurrency: 'PLN',
    createdAt: new Date(),
    ...overrides,
  };
}

// Helper to create mock purchase
function createMockPurchase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'purchase-123',
    userId: 'user-123',
    productId: 'dust_small',
    productType: 'DUST',
    productName: '100 Dust',
    pricePLN: 999,
    priceCurrency: 'PLN',
    status: 'COMPLETED',
    stripeSessionId: 'cs_test_123',
    stripePaymentId: 'pi_test_123',
    dustGranted: 100,
    goldGranted: null,
    heroGranted: null,
    cosmeticGranted: null,
    materialsGranted: null,
    createdAt: new Date(),
    completedAt: new Date(),
    ...overrides,
  };
}

// Helper to create mock active booster
function createMockActiveBooster(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booster-123',
    userId: 'user-123',
    type: 'xp_1.5x',
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
    createdAt: new Date(),
    ...overrides,
  };
}

describe('Shop Routes Integration', () => {
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

  // ============================================================================
  // GET /v1/shop
  // ============================================================================

  describe('GET /v1/shop', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/shop',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return shop overview with categories', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(createMockUser());
      mockPrisma.userPurchaseLimit.findMany.mockResolvedValue([]);
      mockPrisma.shopPurchase.findMany.mockResolvedValue([]);
      mockPrisma.inventory.findUnique.mockResolvedValue(createMockInventory());

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/shop',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.currency).toBe('PLN');
      expect(body.categories).toBeDefined();
      expect(Array.isArray(body.categories)).toBe(true);
      expect(body.starterPackAvailable).toBe(true);
    });

    it('should include user preferred currency in prices', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(
        createMockUser({ preferredCurrency: 'EUR' })
      );
      mockPrisma.userPurchaseLimit.findMany.mockResolvedValue([]);
      mockPrisma.shopPurchase.findMany.mockResolvedValue([]);
      mockPrisma.inventory.findUnique.mockResolvedValue(createMockInventory());

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/shop',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.currency).toBe('EUR');
    });

    it('should show starter pack unavailable when already purchased', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(createMockUser());
      mockPrisma.userPurchaseLimit.findMany.mockResolvedValue([
        { userId: 'user-123', productId: 'starter_pack', purchaseCount: 1 },
      ]);
      mockPrisma.shopPurchase.findMany.mockResolvedValue([]);
      mockPrisma.inventory.findUnique.mockResolvedValue(createMockInventory());

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/shop',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.starterPackAvailable).toBe(false);
    });
  });

  // ============================================================================
  // GET /v1/shop/purchases
  // ============================================================================

  describe('GET /v1/shop/purchases', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/shop/purchases',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return user purchase history', async () => {
      const mockPurchases = [
        createMockPurchase({ id: 'purchase-1' }),
        createMockPurchase({ id: 'purchase-2', productId: 'dust_medium' }),
      ];

      mockPrisma.shopPurchase.findMany.mockResolvedValue(mockPurchases);
      mockPrisma.shopPurchase.count.mockResolvedValue(2);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/shop/purchases',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.purchases).toBeDefined();
      expect(body.purchases.length).toBe(2);
      expect(body.total).toBe(2);
      expect(body.hasMore).toBe(false);
    });

    it('should support pagination with limit and offset', async () => {
      mockPrisma.shopPurchase.findMany.mockResolvedValue([createMockPurchase()]);
      mockPrisma.shopPurchase.count.mockResolvedValue(50);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/shop/purchases?limit=10&offset=20',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.total).toBe(50);
      expect(body.hasMore).toBe(true);

      expect(mockPrisma.shopPurchase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        })
      );
    });
  });

  // ============================================================================
  // POST /v1/shop/checkout
  // ============================================================================

  describe('POST /v1/shop/checkout', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/shop/checkout',
        payload: { productId: 'dust_small' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should create checkout session for valid product', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(createMockUser());
      mockPrisma.userPurchaseLimit.findUnique.mockResolvedValue(null);
      mockPrisma.shopPurchase.create.mockResolvedValue(createMockPurchase({ status: 'PENDING' }));

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/shop/checkout',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          productId: 'dust_small',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.sessionId).toBe('cs_test_123');
      expect(body.checkoutUrl).toBe('https://checkout.stripe.com/test');
      expect(body.expiresAt).toBeDefined();
    });

    it('should return 404 for invalid product', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(createMockUser());
      mockPrisma.userPurchaseLimit.findUnique.mockResolvedValue(null);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/shop/checkout',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          productId: 'nonexistent_product',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('PRODUCT_NOT_FOUND');
    });

    it('should return 400 when purchase limit reached', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(createMockUser());
      mockPrisma.userPurchaseLimit.findUnique.mockResolvedValue({
        userId: 'user-123',
        productId: 'starter_pack',
        purchaseCount: 1, // Already purchased, limit is 1
      });

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/shop/checkout',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          productId: 'starter_pack',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('PURCHASE_LIMIT_REACHED');
    });

    it('should return 400 for missing productId', async () => {
      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/shop/checkout',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('VALIDATION_ERROR');
    });
  });

  // ============================================================================
  // GET /v1/shop/boosters
  // ============================================================================

  describe('GET /v1/shop/boosters', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/shop/boosters',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return active boosters', async () => {
      const mockBoosters = [
        createMockActiveBooster({ type: 'xp_1.5x' }),
        createMockActiveBooster({ id: 'booster-456', type: 'gold_1.5x' }),
      ];

      mockPrisma.activeBooster.findMany.mockResolvedValue(mockBoosters);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/shop/boosters',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.boosters).toBeDefined();
      expect(body.boosters.length).toBe(2);
      expect(body.boosters[0].type).toBe('xp_1.5x');
      expect(body.boosters[0].remainingSeconds).toBeGreaterThan(0);
    });

    it('should return empty array when no active boosters', async () => {
      mockPrisma.activeBooster.findMany.mockResolvedValue([]);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/shop/boosters',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.boosters).toEqual([]);
    });
  });

  // ============================================================================
  // POST /v1/shop/buy-dust
  // ============================================================================

  describe('POST /v1/shop/buy-dust', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/shop/buy-dust',
        payload: { itemType: 'booster', itemId: 'xp_3h' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should buy booster with dust', async () => {
      const inventory = createMockInventory({ dust: 500 });
      mockPrisma.inventory.findUnique.mockResolvedValue(inventory);
      mockPrisma.inventory.update.mockResolvedValue({ ...inventory, dust: 390 });
      mockPrisma.activeBooster.findFirst.mockResolvedValue(null);
      mockPrisma.activeBooster.create.mockResolvedValue(createMockActiveBooster());

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/shop/buy-dust',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          itemType: 'booster',
          itemId: 'xp_3h',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.dustSpent).toBeGreaterThan(0);
      expect(body.newDustBalance).toBeDefined();
    });

    it('should return 400 for insufficient dust', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(createMockInventory({ dust: 10 }));

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/shop/buy-dust',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          itemType: 'booster',
          itemId: 'xp_3h',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('INSUFFICIENT_DUST');
    });

    it('should return 404 for invalid booster', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(createMockInventory({ dust: 500 }));

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/shop/buy-dust',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          itemType: 'booster',
          itemId: 'nonexistent_booster',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('PRODUCT_NOT_FOUND');
    });

    it('should return 400 for invalid itemType', async () => {
      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/shop/buy-dust',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          itemType: 'invalid_type',
          itemId: 'some_item',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // ============================================================================
  // GET /v1/shop/verify/:sessionId
  // ============================================================================

  describe('GET /v1/shop/verify/:sessionId', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/shop/verify/cs_test_123',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return checkout status for valid session', async () => {
      mockPrisma.shopPurchase.findFirst.mockResolvedValue(
        createMockPurchase({ status: 'COMPLETED' })
      );

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/shop/verify/cs_test_123',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('completed');
      expect(body.purchase).toBeDefined();
    });

    it('should return pending status for unpaid session', async () => {
      mockPrisma.shopPurchase.findFirst.mockResolvedValue(
        createMockPurchase({ status: 'PENDING', completedAt: null })
      );

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/shop/verify/cs_test_456',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('pending');
    });
  });
});
