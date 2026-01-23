/**
 * Shop service tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getShopOverview,
  buyWithDust,
  getActiveBoosters,
  getPurchases,
  verifyCheckout,
} from '../../../services/shop.js';
import { mockPrisma } from '../../mocks/prisma.js';

// Mock stripe module
vi.mock('../../../lib/stripe.js', () => ({
  isStripeConfigured: vi.fn(() => true),
  createCheckoutSession: vi.fn(),
  getCheckoutSession: vi.fn(),
  isSessionPaid: vi.fn(),
  verifyWebhookSignature: vi.fn(),
}));

// Mock battlepass service
vi.mock('../../../services/battlepass.js', () => ({
  grantPremiumStatus: vi.fn(),
}));

// Mock protocol
vi.mock('@arcade/protocol', () => ({
  SHOP_DUST_PACKAGES: [
    { id: 'dust_small', dustAmount: 100, bonusDust: 10, priceMinor: { PLN: 499, USD: 199 } },
    { id: 'dust_medium', dustAmount: 500, bonusDust: 75, priceMinor: { PLN: 1999, USD: 499 } },
    { id: 'dust_large', dustAmount: 1200, bonusDust: 200, priceMinor: { PLN: 3999, USD: 999 } },
  ],
  STARTER_PACK: {
    dustAmount: 500,
    goldAmount: 10000,
    rareMaterialsCount: 3,
    cosmeticId: 'founder_badge',
  },
  STARTER_PACK_PRICE_MINOR: { PLN: 2999, USD: 999 },
  BOOSTER_DEFINITIONS: [
    { id: 'xp_boost_1h', type: 'xp_1.5x', durationHours: 1, dustCost: 50 },
    { id: 'gold_boost_1h', type: 'gold_1.5x', durationHours: 1, dustCost: 50 },
  ],
  CONVENIENCE_ITEMS: [
    { id: 'instant_claim', name: 'Instant Claim', description: 'Claim idle rewards instantly', dustCost: 25 },
    { id: 'quest_refresh', name: 'Quest Refresh', description: 'Refresh daily quests', dustCost: 30 },
  ],
  SHOP_ERROR_CODES: {
    PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
    PURCHASE_LIMIT_REACHED: 'PURCHASE_LIMIT_REACHED',
    HERO_ALREADY_OWNED: 'HERO_ALREADY_OWNED',
    INSUFFICIENT_DUST: 'INSUFFICIENT_DUST',
    INVALID_PRODUCT_TYPE: 'INVALID_PRODUCT_TYPE',
  },
  PREMIUM_HEROES: [
    { id: 'hero_phoenix', heroId: 'phoenix', name: 'Phoenix', description: 'Legendary fire hero', class: 'mage', role: 'damage', priceMinor: { PLN: 4999, USD: 1499 } },
  ],
  BUNDLES: [
    { id: 'bundle_starter', name: 'Starter Bundle', description: 'Great value bundle', dustAmount: 200, goldAmount: 5000, randomHeroCount: 0, randomArtifactCount: 0, priceMinor: { PLN: 1999, USD: 499 }, badgeText: 'VALUE' },
  ],
  BATTLE_PASS: {
    id: 'battle_pass_s1',
    name: 'Battle Pass Season 1',
    description: 'Premium battle pass',
    durationDays: 90,
    priceMinor: { PLN: 2999, USD: 999 },
  },
}));

describe('Shop Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockUser = {
    id: 'user-123',
    preferredCurrency: 'PLN',
  };

  const mockInventory = {
    userId: 'user-123',
    dust: 500,
    gold: 10000,
    unlockedHeroIds: ['vanguard'],
    materials: {},
  };

  describe('getShopOverview', () => {
    it('returns shop overview with all categories', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.userPurchaseLimit.findMany.mockResolvedValue([]);
      mockPrisma.shopPurchase.findMany.mockResolvedValue([]);
      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);

      const result = await getShopOverview('user-123');

      expect(result.currency).toBe('PLN');
      expect(result.categories).toBeDefined();
      expect(result.categories.length).toBeGreaterThan(0);
      expect(result.starterPackAvailable).toBe(true);
    });

    it('hides starter pack if already purchased', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.userPurchaseLimit.findMany.mockResolvedValue([
        { userId: 'user-123', productId: 'starter_pack', purchaseCount: 1 },
      ]);
      mockPrisma.shopPurchase.findMany.mockResolvedValue([]);
      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);

      const result = await getShopOverview('user-123');

      expect(result.starterPackAvailable).toBe(false);
      const featured = result.categories.find(c => c.id === 'featured');
      const starterProduct = featured?.products.find(p => p.id === 'starter_pack');
      expect(starterProduct).toBeUndefined();
    });

    it('tracks first purchase bonus availability', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.userPurchaseLimit.findMany.mockResolvedValue([]);
      mockPrisma.shopPurchase.findMany.mockResolvedValue([
        { productId: 'dust_small', status: 'COMPLETED', productType: 'DUST' },
      ]);
      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);

      const result = await getShopOverview('user-123');

      expect(result.firstPurchaseBonusAvailable['dust_small']).toBe(false);
      expect(result.firstPurchaseBonusAvailable['dust_medium']).toBe(true);
    });

    it('filters out owned premium heroes', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.userPurchaseLimit.findMany.mockResolvedValue([]);
      mockPrisma.shopPurchase.findMany.mockResolvedValue([]);
      mockPrisma.inventory.findUnique.mockResolvedValue({
        ...mockInventory,
        unlockedHeroIds: ['vanguard', 'phoenix'],
      });

      const result = await getShopOverview('user-123');

      const heroCategory = result.categories.find(c => c.id === 'heroes');
      const phoenixProduct = heroCategory?.products.find(p => p.id === 'hero_phoenix');
      expect(phoenixProduct).toBeUndefined();
    });

    it('uses default currency when user has none set', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, preferredCurrency: null });
      mockPrisma.userPurchaseLimit.findMany.mockResolvedValue([]);
      mockPrisma.shopPurchase.findMany.mockResolvedValue([]);
      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);

      const result = await getShopOverview('user-123');

      expect(result.currency).toBe('PLN');
    });
  });

  describe('buyWithDust', () => {
    it('purchases a booster successfully', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          inventory: {
            update: vi.fn().mockResolvedValue({ ...mockInventory, dust: 450 }),
          },
          activeBooster: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return await callback(tx);
      });

      const result = await buyWithDust('user-123', 'booster', 'xp_boost_1h');

      expect(result.success).toBe(true);
      expect(result.dustSpent).toBe(50);
      expect(result.itemGranted).toBe('xp_boost_1h');
      expect(result.expiresAt).toBeDefined();
    });

    it('extends existing booster', async () => {
      const existingExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 min from now
      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          inventory: {
            update: vi.fn().mockResolvedValue({ ...mockInventory, dust: 450 }),
          },
          activeBooster: {
            findFirst: vi.fn().mockResolvedValue({
              id: 'booster-1',
              type: 'xp_1.5x',
              expiresAt: existingExpiry,
            }),
            update: vi.fn().mockResolvedValue({}),
          },
        };
        return await callback(tx);
      });

      const result = await buyWithDust('user-123', 'booster', 'xp_boost_1h');

      expect(result.success).toBe(true);
    });

    it('throws error for non-existent booster', async () => {
      await expect(
        buyWithDust('user-123', 'booster', 'nonexistent_booster')
      ).rejects.toThrow('PRODUCT_NOT_FOUND');
    });

    it('throws error for insufficient dust', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue({
        ...mockInventory,
        dust: 10, // Not enough
      });

      await expect(
        buyWithDust('user-123', 'booster', 'xp_boost_1h')
      ).rejects.toThrow('INSUFFICIENT_DUST');
    });

    it('throws error for no inventory', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(null);

      await expect(
        buyWithDust('user-123', 'booster', 'xp_boost_1h')
      ).rejects.toThrow('INSUFFICIENT_DUST');
    });

    it('purchases convenience item successfully', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          inventory: {
            update: vi.fn().mockResolvedValue({ ...mockInventory, dust: 475 }),
          },
          user: {
            update: vi.fn().mockResolvedValue({}),
          },
          dailyQuestProgress: {
            deleteMany: vi.fn().mockResolvedValue({}),
          },
        };
        return await callback(tx);
      });

      const result = await buyWithDust('user-123', 'convenience', 'instant_claim');

      expect(result.success).toBe(true);
      expect(result.dustSpent).toBe(25);
      expect(result.itemGranted).toBe('instant_claim');
      expect(result.expiresAt).toBeUndefined(); // Convenience items don't expire
    });

    it('throws error for non-existent convenience item', async () => {
      await expect(
        buyWithDust('user-123', 'convenience', 'nonexistent_item')
      ).rejects.toThrow('PRODUCT_NOT_FOUND');
    });

    it('throws error for invalid item type', async () => {
      await expect(
        buyWithDust('user-123', 'cosmetic', 'some_cosmetic')
      ).rejects.toThrow('INVALID_PRODUCT_TYPE');
    });
  });

  describe('getActiveBoosters', () => {
    it('returns active boosters', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      mockPrisma.activeBooster.findMany.mockResolvedValue([
        { id: 'booster-1', type: 'xp_1.5x', expiresAt: futureDate, userId: 'user-123' },
        { id: 'booster-2', type: 'gold_1.5x', expiresAt: futureDate, userId: 'user-123' },
      ]);

      const result = await getActiveBoosters('user-123');

      expect(result.boosters).toHaveLength(2);
      expect(result.boosters[0].type).toBe('xp_1.5x');
      expect(result.boosters[0].remainingSeconds).toBeGreaterThan(0);
    });

    it('returns empty array when no active boosters', async () => {
      mockPrisma.activeBooster.findMany.mockResolvedValue([]);

      const result = await getActiveBoosters('user-123');

      expect(result.boosters).toHaveLength(0);
    });

    it('queries only non-expired boosters', async () => {
      mockPrisma.activeBooster.findMany.mockResolvedValue([]);

      await getActiveBoosters('user-123');

      expect(mockPrisma.activeBooster.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', expiresAt: { gt: expect.any(Date) } },
      });
    });
  });

  describe('getPurchases', () => {
    it('returns paginated purchase history', async () => {
      const mockPurchases = [
        {
          id: 'purchase-1',
          productId: 'dust_small',
          productType: 'DUST',
          productName: '100 Dust',
          pricePLN: 499,
          priceCurrency: 'PLN',
          status: 'COMPLETED',
          dustGranted: 110,
          goldGranted: null,
          heroGranted: null,
          cosmeticGranted: null,
          materialsGranted: null,
          createdAt: new Date('2024-01-15'),
          completedAt: new Date('2024-01-15'),
        },
      ];
      mockPrisma.shopPurchase.findMany.mockResolvedValue(mockPurchases);
      mockPrisma.shopPurchase.count.mockResolvedValue(1);

      const result = await getPurchases('user-123');

      expect(result.purchases).toHaveLength(1);
      expect(result.purchases[0].productType).toBe('dust');
      expect(result.purchases[0].status).toBe('completed');
      expect(result.purchases[0].price).toBe(4.99);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('respects limit and offset parameters', async () => {
      mockPrisma.shopPurchase.findMany.mockResolvedValue([]);
      mockPrisma.shopPurchase.count.mockResolvedValue(100);

      await getPurchases('user-123', 20, 40);

      expect(mockPrisma.shopPurchase.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 40,
      });
    });

    it('caps limit at 100', async () => {
      mockPrisma.shopPurchase.findMany.mockResolvedValue([]);
      mockPrisma.shopPurchase.count.mockResolvedValue(0);

      await getPurchases('user-123', 200, 0);

      expect(mockPrisma.shopPurchase.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
        take: 100,
        skip: 0,
      });
    });

    it('indicates hasMore when more purchases exist', async () => {
      const mockPurchase = {
        id: 'p1',
        productId: 'dust_small',
        productType: 'DUST',
        productName: '100 Dust',
        pricePLN: 499,
        priceCurrency: 'PLN',
        status: 'COMPLETED',
        dustGranted: 110,
        goldGranted: null,
        heroGranted: null,
        cosmeticGranted: null,
        materialsGranted: null,
        createdAt: new Date('2024-01-15'),
        completedAt: new Date('2024-01-15'),
      };
      mockPrisma.shopPurchase.findMany.mockResolvedValue([mockPurchase]);
      mockPrisma.shopPurchase.count.mockResolvedValue(50);

      const result = await getPurchases('user-123', 10, 0);

      expect(result.hasMore).toBe(true);
    });
  });

  describe('verifyCheckout', () => {
    it('returns completed status for finished purchase', async () => {
      const mockPurchase = {
        id: 'purchase-1',
        stripeSessionId: 'session-123',
        userId: 'user-123',
        productId: 'dust_small',
        productType: 'DUST',
        productName: '100 Dust',
        pricePLN: 499,
        priceCurrency: 'PLN',
        status: 'COMPLETED',
        dustGranted: 110,
        goldGranted: null,
        heroGranted: null,
        cosmeticGranted: null,
        materialsGranted: null,
        createdAt: new Date('2024-01-15'),
        completedAt: new Date('2024-01-15'),
      };
      mockPrisma.shopPurchase.findFirst.mockResolvedValue(mockPurchase);

      const result = await verifyCheckout('session-123', 'user-123');

      expect(result.status).toBe('completed');
      expect(result.purchase).toBeDefined();
      expect(result.purchase?.dustGranted).toBe(110);
    });

    it('returns pending status for pending purchase', async () => {
      mockPrisma.shopPurchase.findFirst.mockResolvedValue({
        id: 'purchase-1',
        status: 'PENDING',
        stripeSessionId: 'session-123',
        userId: 'user-123',
        productId: 'dust_small',
        productType: 'DUST',
        productName: '100 Dust',
        pricePLN: 499,
        priceCurrency: 'PLN',
      });

      const result = await verifyCheckout('session-123', 'user-123');

      expect(result.status).toBe('pending');
      expect(result.purchase).toBeUndefined();
    });

    it('checks Stripe directly when no purchase record exists', async () => {
      mockPrisma.shopPurchase.findFirst.mockResolvedValue(null);
      const { getCheckoutSession } = await import('../../../lib/stripe.js');
      vi.mocked(getCheckoutSession).mockResolvedValue({
        id: 'session-123',
        payment_status: 'paid',
        status: 'complete',
      } as any);

      const result = await verifyCheckout('session-123', 'user-123');

      expect(getCheckoutSession).toHaveBeenCalledWith('session-123');
      expect(result.status).toBe('completed');
    });

    it('returns not_found when no purchase and no Stripe session', async () => {
      mockPrisma.shopPurchase.findFirst.mockResolvedValue(null);
      const { getCheckoutSession } = await import('../../../lib/stripe.js');
      vi.mocked(getCheckoutSession).mockResolvedValue(null);

      const result = await verifyCheckout('session-123', 'user-123');

      expect(result.status).toBe('not_found');
    });
  });
});
