/**
 * Banners service tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GachaType } from '@prisma/client';
import {
  listAllBanners,
  getActiveBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
  isBannerLive,
  getFeaturedRateUp,
} from '../../../services/banners.js';
import { mockPrisma } from '../../mocks/prisma.js';

describe('Banners Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockBanner = {
    id: 'banner-1',
    name: 'Test Banner',
    description: 'Test Description',
    gachaType: GachaType.HERO,
    featuredItems: ['hero-1', 'hero-2'],
    rateUpMultiplier: 2.0,
    startsAt: new Date('2024-01-01'),
    endsAt: new Date('2024-12-31'),
    isActive: true,
    priority: 10,
    imageUrl: 'http://example.com/image.png',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('listAllBanners', () => {
    it('returns all banners ordered by priority and startsAt', async () => {
      mockPrisma.gachaBanner.findMany.mockResolvedValue([mockBanner]);

      const result = await listAllBanners();

      expect(result).toEqual([mockBanner]);
      expect(mockPrisma.gachaBanner.findMany).toHaveBeenCalledWith({
        orderBy: [{ priority: 'desc' }, { startsAt: 'desc' }],
      });
    });
  });

  describe('getActiveBanners', () => {
    it('returns active banners within time window', async () => {
      mockPrisma.gachaBanner.findMany.mockResolvedValue([mockBanner]);

      const result = await getActiveBanners();

      expect(result).toEqual([mockBanner]);
      expect(mockPrisma.gachaBanner.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          startsAt: { lte: expect.any(Date) },
          endsAt: { gte: expect.any(Date) },
        },
        orderBy: [{ priority: 'desc' }, { startsAt: 'desc' }],
      });
    });

    it('filters by gacha type when provided', async () => {
      mockPrisma.gachaBanner.findMany.mockResolvedValue([mockBanner]);

      await getActiveBanners(GachaType.HERO);

      expect(mockPrisma.gachaBanner.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          startsAt: { lte: expect.any(Date) },
          endsAt: { gte: expect.any(Date) },
          gachaType: GachaType.HERO,
        },
        orderBy: [{ priority: 'desc' }, { startsAt: 'desc' }],
      });
    });
  });

  describe('getBannerById', () => {
    it('returns banner by id', async () => {
      mockPrisma.gachaBanner.findUnique.mockResolvedValue(mockBanner);

      const result = await getBannerById('banner-1');

      expect(result).toEqual(mockBanner);
      expect(mockPrisma.gachaBanner.findUnique).toHaveBeenCalledWith({
        where: { id: 'banner-1' },
      });
    });

    it('returns null when not found', async () => {
      mockPrisma.gachaBanner.findUnique.mockResolvedValue(null);

      const result = await getBannerById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createBanner', () => {
    it('creates banner with all fields', async () => {
      mockPrisma.gachaBanner.create.mockResolvedValue(mockBanner);

      const result = await createBanner({
        name: 'Test Banner',
        description: 'Test Description',
        gachaType: GachaType.HERO,
        featuredItems: ['hero-1', 'hero-2'],
        rateUpMultiplier: 2.5,
        startsAt: new Date('2024-01-01'),
        endsAt: new Date('2024-12-31'),
        priority: 10,
        imageUrl: 'http://example.com/image.png',
      });

      expect(result).toEqual(mockBanner);
      expect(mockPrisma.gachaBanner.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Banner',
          description: 'Test Description',
          gachaType: GachaType.HERO,
          featuredItems: ['hero-1', 'hero-2'],
          rateUpMultiplier: 2.5,
          startsAt: new Date('2024-01-01'),
          endsAt: new Date('2024-12-31'),
          priority: 10,
          imageUrl: 'http://example.com/image.png',
        },
      });
    });

    it('uses default values when optional fields not provided', async () => {
      mockPrisma.gachaBanner.create.mockResolvedValue(mockBanner);

      await createBanner({
        name: 'Test Banner',
        gachaType: GachaType.HERO,
        featuredItems: ['hero-1'],
        startsAt: new Date('2024-01-01'),
        endsAt: new Date('2024-12-31'),
      });

      expect(mockPrisma.gachaBanner.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          rateUpMultiplier: 2.0, // default
          priority: 0, // default
        }),
      });
    });
  });

  describe('updateBanner', () => {
    it('updates only provided fields', async () => {
      mockPrisma.gachaBanner.update.mockResolvedValue(mockBanner);

      await updateBanner('banner-1', {
        name: 'Updated Name',
        isActive: false,
      });

      expect(mockPrisma.gachaBanner.update).toHaveBeenCalledWith({
        where: { id: 'banner-1' },
        data: {
          name: 'Updated Name',
          isActive: false,
        },
      });
    });

    it('can update all fields', async () => {
      mockPrisma.gachaBanner.update.mockResolvedValue(mockBanner);

      await updateBanner('banner-1', {
        name: 'Updated',
        description: 'New Desc',
        gachaType: GachaType.ARTIFACT,
        featuredItems: ['new-item'],
        rateUpMultiplier: 3.0,
        startsAt: new Date('2025-01-01'),
        endsAt: new Date('2025-12-31'),
        isActive: true,
        priority: 20,
        imageUrl: 'http://new-url.com',
      });

      expect(mockPrisma.gachaBanner.update).toHaveBeenCalledWith({
        where: { id: 'banner-1' },
        data: {
          name: 'Updated',
          description: 'New Desc',
          gachaType: GachaType.ARTIFACT,
          featuredItems: ['new-item'],
          rateUpMultiplier: 3.0,
          startsAt: new Date('2025-01-01'),
          endsAt: new Date('2025-12-31'),
          isActive: true,
          priority: 20,
          imageUrl: 'http://new-url.com',
        },
      });
    });
  });

  describe('deleteBanner', () => {
    it('deletes banner by id', async () => {
      mockPrisma.gachaBanner.delete.mockResolvedValue(mockBanner);

      const result = await deleteBanner('banner-1');

      expect(result).toEqual(mockBanner);
      expect(mockPrisma.gachaBanner.delete).toHaveBeenCalledWith({
        where: { id: 'banner-1' },
      });
    });
  });

  describe('isBannerLive', () => {
    it('returns true for active banner within time window', () => {
      const now = new Date();
      const banner = {
        isActive: true,
        startsAt: new Date(now.getTime() - 1000),
        endsAt: new Date(now.getTime() + 1000),
      };

      expect(isBannerLive(banner)).toBe(true);
    });

    it('returns false for inactive banner', () => {
      const now = new Date();
      const banner = {
        isActive: false,
        startsAt: new Date(now.getTime() - 1000),
        endsAt: new Date(now.getTime() + 1000),
      };

      expect(isBannerLive(banner)).toBe(false);
    });

    it('returns false for banner not yet started', () => {
      const now = new Date();
      const banner = {
        isActive: true,
        startsAt: new Date(now.getTime() + 1000),
        endsAt: new Date(now.getTime() + 2000),
      };

      expect(isBannerLive(banner)).toBe(false);
    });

    it('returns false for expired banner', () => {
      const now = new Date();
      const banner = {
        isActive: true,
        startsAt: new Date(now.getTime() - 2000),
        endsAt: new Date(now.getTime() - 1000),
      };

      expect(isBannerLive(banner)).toBe(false);
    });
  });

  describe('getFeaturedRateUp', () => {
    it('returns rate up multiplier for featured item', async () => {
      mockPrisma.gachaBanner.findMany.mockResolvedValue([mockBanner]);

      const result = await getFeaturedRateUp('hero-1', GachaType.HERO);

      expect(result).toBe(2.0);
    });

    it('returns 1.0 for non-featured item', async () => {
      mockPrisma.gachaBanner.findMany.mockResolvedValue([mockBanner]);

      const result = await getFeaturedRateUp('hero-999', GachaType.HERO);

      expect(result).toBe(1.0);
    });

    it('returns 1.0 when no active banners', async () => {
      mockPrisma.gachaBanner.findMany.mockResolvedValue([]);

      const result = await getFeaturedRateUp('hero-1', GachaType.HERO);

      expect(result).toBe(1.0);
    });
  });
});
