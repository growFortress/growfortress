/**
 * Slots service tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { purchaseHeroSlot, purchaseTurretSlot, getSlotStatus } from '../../../services/slots.js';
import { mockPrisma } from '../../mocks/prisma.js';

// Mock sim-core slot unlocks
vi.mock('@arcade/sim-core', () => ({
  HERO_SLOT_UNLOCKS: [
    { slot: 1, isFree: true, levelRequired: 1, goldCost: 0 },
    { slot: 2, isFree: true, levelRequired: 1, goldCost: 0 },
    { slot: 3, isFree: false, levelRequired: 5, goldCost: 1000 },
    { slot: 4, isFree: false, levelRequired: 10, goldCost: 2500 },
    { slot: 5, isFree: false, levelRequired: 15, goldCost: 5000 },
  ],
  TURRET_SLOT_UNLOCKS: [
    { slot: 1, isFree: true, levelRequired: 1, goldCost: 0 },
    { slot: 2, isFree: false, levelRequired: 3, goldCost: 500 },
    { slot: 3, isFree: false, levelRequired: 8, goldCost: 1500 },
  ],
  MAX_HERO_SLOTS: 5,
  MAX_TURRET_SLOTS: 3,
  getNextHeroSlotInfo: vi.fn((currentSlots: number, level: number, gold: number) => {
    const HERO_SLOT_UNLOCKS = [
      { slot: 1, isFree: true, levelRequired: 1, goldCost: 0 },
      { slot: 2, isFree: true, levelRequired: 1, goldCost: 0 },
      { slot: 3, isFree: false, levelRequired: 5, goldCost: 1000 },
      { slot: 4, isFree: false, levelRequired: 10, goldCost: 2500 },
      { slot: 5, isFree: false, levelRequired: 15, goldCost: 5000 },
    ];
    if (currentSlots >= 5) return null;
    const nextSlot = HERO_SLOT_UNLOCKS[currentSlots];
    if (!nextSlot) return null;
    if (nextSlot.isFree) return { slot: nextSlot, canPurchase: false, reason: 'already_free' };
    if (level < nextSlot.levelRequired) return { slot: nextSlot, canPurchase: false, reason: 'level_too_low' };
    if (gold < nextSlot.goldCost) return { slot: nextSlot, canPurchase: false, reason: 'insufficient_gold' };
    return { slot: nextSlot, canPurchase: true };
  }),
  getNextTurretSlotInfo: vi.fn((currentSlots: number, level: number, gold: number) => {
    const TURRET_SLOT_UNLOCKS = [
      { slot: 1, isFree: true, levelRequired: 1, goldCost: 0 },
      { slot: 2, isFree: false, levelRequired: 3, goldCost: 500 },
      { slot: 3, isFree: false, levelRequired: 8, goldCost: 1500 },
    ];
    if (currentSlots >= 3) return null;
    const nextSlot = TURRET_SLOT_UNLOCKS[currentSlots];
    if (!nextSlot) return null;
    if (nextSlot.isFree) return { slot: nextSlot, canPurchase: false, reason: 'already_free' };
    if (level < nextSlot.levelRequired) return { slot: nextSlot, canPurchase: false, reason: 'level_too_low' };
    if (gold < nextSlot.goldCost) return { slot: nextSlot, canPurchase: false, reason: 'insufficient_gold' };
    return { slot: nextSlot, canPurchase: true };
  }),
}));

describe('Slots Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockProgression = {
    userId: 'user-123',
    level: 10,
    purchasedHeroSlots: 2,
    purchasedTurretSlots: 1,
    version: 1,
  };

  const mockInventory = {
    userId: 'user-123',
    gold: 5000,
  };

  describe('purchaseHeroSlot', () => {
    it('returns error when user data not found', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          progression: { findUnique: vi.fn().mockResolvedValue(null) },
          inventory: { findUnique: vi.fn().mockResolvedValue(null) },
        };
        return callback(tx);
      });

      const result = await purchaseHeroSlot('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User data not found');
    });

    it('returns error when at max slots', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          progression: {
            findUnique: vi.fn().mockResolvedValue({ ...mockProgression, purchasedHeroSlots: 5 }),
          },
          inventory: { findUnique: vi.fn().mockResolvedValue(mockInventory) },
        };
        return callback(tx);
      });

      const result = await purchaseHeroSlot('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('maksymalną');
    });

    it('returns error when slot is free', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          progression: {
            findUnique: vi.fn().mockResolvedValue({ ...mockProgression, purchasedHeroSlots: 0 }),
          },
          inventory: { findUnique: vi.fn().mockResolvedValue(mockInventory) },
        };
        return callback(tx);
      });

      const result = await purchaseHeroSlot('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('odblokowany za darmo');
    });

    it('returns error when level too low', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          progression: {
            findUnique: vi.fn().mockResolvedValue({ ...mockProgression, level: 3 }),
          },
          inventory: { findUnique: vi.fn().mockResolvedValue(mockInventory) },
        };
        return callback(tx);
      });

      const result = await purchaseHeroSlot('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('poziom');
    });

    it('returns error when insufficient gold', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          progression: { findUnique: vi.fn().mockResolvedValue(mockProgression) },
          inventory: { findUnique: vi.fn().mockResolvedValue({ ...mockInventory, gold: 100 }) },
        };
        return callback(tx);
      });

      const result = await purchaseHeroSlot('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('złota');
    });

    it('successfully purchases slot', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          progression: {
            findUnique: vi.fn().mockResolvedValue(mockProgression),
            update: vi.fn().mockResolvedValue({ ...mockProgression, purchasedHeroSlots: 3 }),
          },
          inventory: {
            findUnique: vi.fn().mockResolvedValue(mockInventory),
            update: vi.fn().mockResolvedValue({ ...mockInventory, gold: 4000 }),
          },
        };
        return callback(tx);
      });

      const result = await purchaseHeroSlot('user-123');

      expect(result.success).toBe(true);
      expect(result.newSlotCount).toBe(3);
      expect(result.goldSpent).toBe(1000);
      expect(result.newGold).toBe(4000);
    });

    it('handles transaction errors', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('Database error'));

      const result = await purchaseHeroSlot('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('błąd');
    });
  });

  describe('purchaseTurretSlot', () => {
    it('returns error when user data not found', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          progression: { findUnique: vi.fn().mockResolvedValue(null) },
          inventory: { findUnique: vi.fn().mockResolvedValue(null) },
        };
        return callback(tx);
      });

      const result = await purchaseTurretSlot('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User data not found');
    });

    it('returns error when at max slots', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          progression: {
            findUnique: vi.fn().mockResolvedValue({ ...mockProgression, purchasedTurretSlots: 3 }),
          },
          inventory: { findUnique: vi.fn().mockResolvedValue(mockInventory) },
        };
        return callback(tx);
      });

      const result = await purchaseTurretSlot('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('maksymalną');
    });

    it('successfully purchases turret slot', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          progression: {
            findUnique: vi.fn().mockResolvedValue(mockProgression),
            update: vi.fn().mockResolvedValue({ ...mockProgression, purchasedTurretSlots: 2 }),
          },
          inventory: {
            findUnique: vi.fn().mockResolvedValue(mockInventory),
            update: vi.fn().mockResolvedValue({ ...mockInventory, gold: 4500 }),
          },
        };
        return callback(tx);
      });

      const result = await purchaseTurretSlot('user-123');

      expect(result.success).toBe(true);
      expect(result.newSlotCount).toBe(2);
      expect(result.goldSpent).toBe(500);
    });
  });

  describe('getSlotStatus', () => {
    it('returns null when user data not found', async () => {
      mockPrisma.progression.findUnique.mockResolvedValue(null);
      mockPrisma.inventory.findUnique.mockResolvedValue(null);

      const result = await getSlotStatus('user-123');

      expect(result).toBeNull();
    });

    it('returns slot status for user', async () => {
      mockPrisma.progression.findUnique.mockResolvedValue(mockProgression);
      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);

      const result = await getSlotStatus('user-123');

      expect(result).not.toBeNull();
      expect(result?.currentHeroSlots).toBe(2);
      expect(result?.currentTurretSlots).toBe(1);
      expect(result?.nextHeroSlot).toBeDefined();
      expect(result?.nextTurretSlot).toBeDefined();
    });

    it('shows can purchase when requirements met', async () => {
      mockPrisma.progression.findUnique.mockResolvedValue(mockProgression);
      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);

      const result = await getSlotStatus('user-123');

      expect(result?.nextHeroSlot?.canPurchase).toBe(true);
    });

    it('shows reason when cannot purchase', async () => {
      mockPrisma.progression.findUnique.mockResolvedValue({
        ...mockProgression,
        level: 3,
      });
      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);

      const result = await getSlotStatus('user-123');

      expect(result?.nextHeroSlot?.canPurchase).toBe(false);
      expect(result?.nextHeroSlot?.reason).toBe('level_too_low');
    });
  });
});
