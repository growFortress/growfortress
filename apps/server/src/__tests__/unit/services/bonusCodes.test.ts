/**
 * Bonus Codes service tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { redeemBonusCode } from '../../../services/bonusCodes.js';
import { mockPrisma } from '../../mocks/prisma.js';

describe('Bonus Codes Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockBonusCode = {
    id: 'code-1',
    code: 'TESTCODE',
    rewardGold: 1000,
    rewardDust: 100,
    rewardEnergy: 50,
    rewardMaterials: { iron: 10, wood: 20 },
    isActive: true,
    validFrom: new Date('2024-01-01'),
    validUntil: new Date('2027-12-31'), // Future date
    maxRedemptions: 100,
    redemptionCount: 5,
    redemptions: [],
  };

  describe('redeemBonusCode', () => {
    it('returns error for empty code', async () => {
      const result = await redeemBonusCode('user-123', '  ');

      expect(result).toEqual({
        success: false,
        error: 'INVALID_CODE',
      });
    });

    it('returns error for non-existent code', async () => {
      mockPrisma.bonusCode.findUnique.mockResolvedValue(null);

      const result = await redeemBonusCode('user-123', 'FAKECODE');

      expect(result).toEqual({
        success: false,
        error: 'INVALID_CODE',
      });
    });

    it('normalizes code to uppercase', async () => {
      mockPrisma.bonusCode.findUnique.mockResolvedValue(null);

      await redeemBonusCode('user-123', 'testcode');

      expect(mockPrisma.bonusCode.findUnique).toHaveBeenCalledWith({
        where: { code: 'TESTCODE' },
        include: {
          redemptions: { where: { userId: 'user-123' } },
        },
      });
    });

    it('returns error for inactive code', async () => {
      mockPrisma.bonusCode.findUnique.mockResolvedValue({
        ...mockBonusCode,
        isActive: false,
      });

      const result = await redeemBonusCode('user-123', 'TESTCODE');

      expect(result).toEqual({
        success: false,
        error: 'CODE_INACTIVE',
      });
    });

    it('returns error for code not yet valid', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      mockPrisma.bonusCode.findUnique.mockResolvedValue({
        ...mockBonusCode,
        validFrom: futureDate,
      });

      const result = await redeemBonusCode('user-123', 'TESTCODE');

      expect(result).toEqual({
        success: false,
        error: 'CODE_NOT_YET_VALID',
      });
    });

    it('returns error for expired code', async () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);

      mockPrisma.bonusCode.findUnique.mockResolvedValue({
        ...mockBonusCode,
        validUntil: pastDate,
      });

      const result = await redeemBonusCode('user-123', 'TESTCODE');

      expect(result).toEqual({
        success: false,
        error: 'CODE_EXPIRED',
      });
    });

    it('returns error for already redeemed code', async () => {
      mockPrisma.bonusCode.findUnique.mockResolvedValue({
        ...mockBonusCode,
        redemptions: [{ id: 'redemption-1', userId: 'user-123' }],
      });

      const result = await redeemBonusCode('user-123', 'TESTCODE');

      expect(result).toEqual({
        success: false,
        error: 'ALREADY_REDEEMED',
      });
    });

    it('returns error for exhausted code', async () => {
      mockPrisma.bonusCode.findUnique.mockResolvedValue({
        ...mockBonusCode,
        maxRedemptions: 10,
        redemptionCount: 10,
      });

      const result = await redeemBonusCode('user-123', 'TESTCODE');

      expect(result).toEqual({
        success: false,
        error: 'CODE_EXHAUSTED',
      });
    });

    it('successfully redeems valid code with all rewards', async () => {
      mockPrisma.bonusCode.findUnique.mockResolvedValue(mockBonusCode);

      // Mock transaction
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          inventory: {
            update: vi.fn().mockResolvedValue({}),
            findUnique: vi.fn().mockResolvedValue({ materials: {} }),
          },
          userEnergy: {
            upsert: vi.fn().mockResolvedValue({}),
          },
          bonusCodeRedemption: {
            create: vi.fn().mockResolvedValue({}),
          },
          bonusCode: {
            update: vi.fn().mockResolvedValue({}),
          },
        };
        await callback(tx);
      });

      const result = await redeemBonusCode('user-123', 'TESTCODE');

      expect(result).toEqual({
        success: true,
        rewards: {
          gold: 1000,
          dust: 100,
          energy: 50,
          materials: { iron: 10, wood: 20 },
        },
      });
    });

    it('handles code with no materials', async () => {
      mockPrisma.bonusCode.findUnique.mockResolvedValue({
        ...mockBonusCode,
        rewardMaterials: null,
      });

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          inventory: {
            update: vi.fn().mockResolvedValue({}),
            findUnique: vi.fn().mockResolvedValue({ materials: {} }),
          },
          userEnergy: {
            upsert: vi.fn().mockResolvedValue({}),
          },
          bonusCodeRedemption: {
            create: vi.fn().mockResolvedValue({}),
          },
          bonusCode: {
            update: vi.fn().mockResolvedValue({}),
          },
        };
        await callback(tx);
      });

      const result = await redeemBonusCode('user-123', 'TESTCODE');

      expect(result.success).toBe(true);
      expect(result.rewards?.materials).toEqual({});
    });

    it('handles code with no max redemptions (unlimited)', async () => {
      mockPrisma.bonusCode.findUnique.mockResolvedValue({
        ...mockBonusCode,
        maxRedemptions: null,
        redemptionCount: 999,
      });

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          inventory: {
            update: vi.fn().mockResolvedValue({}),
            findUnique: vi.fn().mockResolvedValue({ materials: {} }),
          },
          userEnergy: {
            upsert: vi.fn().mockResolvedValue({}),
          },
          bonusCodeRedemption: {
            create: vi.fn().mockResolvedValue({}),
          },
          bonusCode: {
            update: vi.fn().mockResolvedValue({}),
          },
        };
        await callback(tx);
      });

      const result = await redeemBonusCode('user-123', 'TESTCODE');

      expect(result.success).toBe(true);
    });
  });
});
