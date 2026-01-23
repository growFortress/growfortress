/**
 * Gacha service tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GachaType } from '@prisma/client';
import {
  getGachaStatus,
  pullHeroGacha,
  redeemSpark,
  getGachaHistory,
} from '../../../services/gacha.js';
import { mockPrisma } from '../../mocks/prisma.js';

// Mock banners service
vi.mock('../../../services/banners.js', () => ({
  getActiveBanners: vi.fn(() => Promise.resolve([])),
}));

// Mock sim-core
vi.mock('@arcade/sim-core', () => ({
  getHeroById: vi.fn((id: string) => {
    const heroes: Record<string, { id: string; name: string; rarity: string }> = {
      'vanguard': { id: 'vanguard', name: 'Vanguard', rarity: 'common' },
      'storm': { id: 'storm', name: 'Storm', rarity: 'rare' },
      'frost': { id: 'frost', name: 'Frost', rarity: 'epic' },
      'pyro': { id: 'pyro', name: 'Pyro', rarity: 'legendary' },
    };
    return heroes[id] || null;
  }),
  HEROES: [
    { id: 'vanguard', name: 'Vanguard', rarity: 'common' },
    { id: 'storm', name: 'Storm', rarity: 'rare' },
    { id: 'frost', name: 'Frost', rarity: 'epic' },
    { id: 'pyro', name: 'Pyro', rarity: 'legendary' },
  ],
}));

// Mock protocol config
vi.mock('@arcade/protocol', () => ({
  HERO_GACHA_CONFIG: {
    singlePullCost: 100,
    tenPullCost: 900,
    pityThreshold: 90,
    sparkThreshold: 300,
    rates: {
      common: 60,
      rare: 30,
      epic: 8,
      legendary: 2,
    },
    shardConversion: {
      common: 10,
      rare: 25,
      epic: 50,
      legendary: 100,
    },
  },
}));

describe('Gacha Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockGachaProgress = {
    userId: 'user-123',
    heroPityCount: 10,
    heroSparkCount: 50,
    heroShards: 100,
    artifactPity: {},
  };

  const mockInventory = {
    userId: 'user-123',
    dust: 1000,
    unlockedHeroIds: ['vanguard'],
  };

  describe('getGachaStatus', () => {
    it('returns gacha progress for existing user', async () => {
      mockPrisma.gachaProgress.findUnique.mockResolvedValue(mockGachaProgress);
      mockPrisma.gachaPull.findFirst
        .mockResolvedValueOnce({ createdAt: new Date('2024-01-15') })
        .mockResolvedValueOnce({ createdAt: new Date('2024-01-10') });

      const result = await getGachaStatus('user-123');

      expect(result).toEqual({
        heroPityCount: 10,
        heroSparkCount: 50,
        heroShards: 100,
        artifactPityCount: {},
        lastHeroPull: '2024-01-15T00:00:00.000Z',
        lastArtifactPull: '2024-01-10T00:00:00.000Z',
      });
    });

    it('creates new progress if not exists', async () => {
      mockPrisma.gachaProgress.findUnique.mockResolvedValue(null);
      mockPrisma.gachaProgress.create.mockResolvedValue({
        userId: 'user-123',
        heroPityCount: 0,
        heroSparkCount: 0,
        heroShards: 0,
        artifactPity: {},
      });
      mockPrisma.gachaPull.findFirst.mockResolvedValue(null);

      const result = await getGachaStatus('user-123');

      expect(result.heroPityCount).toBe(0);
      expect(result.heroSparkCount).toBe(0);
      expect(result.lastHeroPull).toBeUndefined();
    });
  });

  describe('pullHeroGacha', () => {
    it('returns error when inventory not found', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(null);

      const result = await pullHeroGacha('user-123', 'single');

      expect(result.success).toBe(false);
      expect(result.error).toBe('INVENTORY_NOT_FOUND');
    });

    it('returns error when insufficient dust for single pull', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue({
        ...mockInventory,
        dust: 50,
      });

      const result = await pullHeroGacha('user-123', 'single');

      expect(result.success).toBe(false);
      expect(result.error).toBe('INSUFFICIENT_DUST');
      expect(result.newDustBalance).toBe(50);
    });

    it('returns error when insufficient dust for ten pull', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue({
        ...mockInventory,
        dust: 500,
      });

      const result = await pullHeroGacha('user-123', 'ten');

      expect(result.success).toBe(false);
      expect(result.error).toBe('INSUFFICIENT_DUST');
    });

    it('performs single pull successfully', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);
      mockPrisma.gachaProgress.findUnique.mockResolvedValue(mockGachaProgress);
      mockPrisma.$transaction.mockResolvedValue([
        { ...mockInventory, dust: 900 },
        { ...mockGachaProgress, heroPityCount: 11, heroSparkCount: 51 },
      ]);

      const result = await pullHeroGacha('user-123', 'single');

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.dustSpent).toBe(100);
    });

    it('performs ten pull successfully', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);
      mockPrisma.gachaProgress.findUnique.mockResolvedValue(mockGachaProgress);
      mockPrisma.$transaction.mockResolvedValue([
        { ...mockInventory, dust: 100 },
        { ...mockGachaProgress, heroPityCount: 20, heroSparkCount: 60 },
      ]);

      const result = await pullHeroGacha('user-123', 'ten');

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(10);
      expect(result.dustSpent).toBe(900);
    });

    it('marks new heroes as isNew', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue({
        ...mockInventory,
        unlockedHeroIds: [], // No heroes unlocked
      });
      mockPrisma.gachaProgress.findUnique.mockResolvedValue(mockGachaProgress);
      mockPrisma.$transaction.mockResolvedValue([
        { ...mockInventory, dust: 900 },
        mockGachaProgress,
      ]);

      const result = await pullHeroGacha('user-123', 'single');

      expect(result.success).toBe(true);
      expect(result.results[0].isNew).toBe(true);
    });

    it('grants shards for duplicate heroes', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue({
        ...mockInventory,
        unlockedHeroIds: ['vanguard', 'storm', 'frost', 'pyro'], // All heroes owned
      });
      mockPrisma.gachaProgress.findUnique.mockResolvedValue(mockGachaProgress);
      mockPrisma.$transaction.mockResolvedValue([
        { ...mockInventory, dust: 900 },
        { ...mockGachaProgress, heroShards: 110 },
      ]);

      const result = await pullHeroGacha('user-123', 'single');

      expect(result.success).toBe(true);
      expect(result.results[0].isNew).toBe(false);
      expect(result.results[0].shardsGranted).toBeDefined();
    });
  });

  describe('redeemSpark', () => {
    it('returns error for non-existent hero', async () => {
      const result = await redeemSpark('user-123', 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('HERO_NOT_FOUND');
    });

    it('returns error when insufficient spark', async () => {
      mockPrisma.gachaProgress.findUnique.mockResolvedValue({
        ...mockGachaProgress,
        heroSparkCount: 100,
      });

      const result = await redeemSpark('user-123', 'vanguard');

      expect(result.success).toBe(false);
      expect(result.error).toBe('INSUFFICIENT_SPARK');
      expect(result.remainingSpark).toBe(100);
    });

    it('returns error when inventory not found', async () => {
      mockPrisma.gachaProgress.findUnique.mockResolvedValue({
        ...mockGachaProgress,
        heroSparkCount: 300,
      });
      mockPrisma.inventory.findUnique.mockResolvedValue(null);

      const result = await redeemSpark('user-123', 'vanguard');

      expect(result.success).toBe(false);
      expect(result.error).toBe('INVENTORY_NOT_FOUND');
    });

    it('returns error when hero already owned', async () => {
      mockPrisma.gachaProgress.findUnique.mockResolvedValue({
        ...mockGachaProgress,
        heroSparkCount: 300,
      });
      mockPrisma.inventory.findUnique.mockResolvedValue({
        ...mockInventory,
        unlockedHeroIds: ['vanguard'],
      });

      const result = await redeemSpark('user-123', 'vanguard');

      expect(result.success).toBe(false);
      expect(result.error).toBe('HERO_ALREADY_OWNED');
    });

    it('successfully redeems spark for hero', async () => {
      mockPrisma.gachaProgress.findUnique.mockResolvedValue({
        ...mockGachaProgress,
        heroSparkCount: 300,
      });
      mockPrisma.inventory.findUnique.mockResolvedValue({
        ...mockInventory,
        unlockedHeroIds: [],
      });
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await redeemSpark('user-123', 'vanguard');

      expect(result.success).toBe(true);
      expect(result.heroId).toBe('vanguard');
      expect(result.heroName).toBe('Vanguard');
      expect(result.sparkSpent).toBe(300);
      expect(result.remainingSpark).toBe(0);
    });
  });

  describe('getGachaHistory', () => {
    it('returns paginated pull history', async () => {
      const mockPulls = [
        {
          id: 'pull-1',
          gachaType: GachaType.HERO,
          itemId: 'vanguard',
          itemName: 'Vanguard',
          rarity: 'common',
          isNew: true,
          dustSpent: 100,
          createdAt: new Date('2024-01-15'),
        },
      ];
      mockPrisma.gachaPull.findMany.mockResolvedValue(mockPulls);
      mockPrisma.gachaPull.count.mockResolvedValue(1);

      const result = await getGachaHistory('user-123');

      expect(result.pulls).toHaveLength(1);
      expect(result.pulls[0].gachaType).toBe('hero');
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('filters by gacha type', async () => {
      mockPrisma.gachaPull.findMany.mockResolvedValue([]);
      mockPrisma.gachaPull.count.mockResolvedValue(0);

      await getGachaHistory('user-123', GachaType.HERO);

      expect(mockPrisma.gachaPull.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', gachaType: GachaType.HERO },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('handles pagination with offset', async () => {
      mockPrisma.gachaPull.findMany.mockResolvedValue([]);
      mockPrisma.gachaPull.count.mockResolvedValue(100);

      const result = await getGachaHistory('user-123', undefined, 20, 50);

      expect(mockPrisma.gachaPull.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 50,
      });
      expect(result.hasMore).toBe(true);
    });
  });
});
