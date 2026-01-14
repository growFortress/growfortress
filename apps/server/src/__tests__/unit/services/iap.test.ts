/**
 * IAP (In-App Purchase) service tests
 */
import { describe, it, expect } from 'vitest';
import { getPackages, grantDust, getTransactions } from '../../../services/iap.js';
import { mockPrisma } from '../../mocks/prisma.js';
import { DUST_PACKAGES } from '@arcade/protocol';

describe('IAP Service', () => {
  describe('getPackages', () => {
    it('returns all dust packages', async () => {
      mockPrisma.iAPTransaction.findMany.mockResolvedValue([]);

      const result = await getPackages('user-123');

      expect(result.packages).toEqual(DUST_PACKAGES);
      expect(result.packages.length).toBeGreaterThan(0);
    });

    it('marks first purchase bonus as available for new users', async () => {
      mockPrisma.iAPTransaction.findMany.mockResolvedValue([]);

      const result = await getPackages('user-123');

      // All packages should have first purchase bonus available
      for (const pkg of DUST_PACKAGES) {
        expect(result.firstPurchaseBonusAvailable[pkg.id]).toBe(true);
      }
    });

    it('marks first purchase bonus as unavailable for purchased packages', async () => {
      mockPrisma.iAPTransaction.findMany.mockResolvedValue([
        { packageId: 'dust_100' },
        { packageId: 'dust_500' },
      ]);

      const result = await getPackages('user-123');

      expect(result.firstPurchaseBonusAvailable['dust_100']).toBe(false);
      expect(result.firstPurchaseBonusAvailable['dust_500']).toBe(false);
      expect(result.firstPurchaseBonusAvailable['dust_1100']).toBe(true);
    });
  });

  describe('grantDust', () => {
    it('throws error for unknown package', async () => {
      await expect(
        grantDust('user-123', 'invalid_package', 'txn-123', 'ios')
      ).rejects.toThrow('Unknown package');
    });

    it('throws error for duplicate transaction', async () => {
      mockPrisma.iAPTransaction.findUnique.mockResolvedValue({
        id: 'existing',
        transactionId: 'txn-123',
      });

      await expect(
        grantDust('user-123', 'dust_100', 'txn-123', 'ios')
      ).rejects.toThrow('Transaction already processed');
    });

    it('grants dust for valid first purchase', async () => {
      const pkg = DUST_PACKAGES.find((p) => p.id === 'dust_100')!;

      mockPrisma.iAPTransaction.findUnique.mockResolvedValue(null);
      mockPrisma.iAPTransaction.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });
      mockPrisma.iAPTransaction.create.mockResolvedValue({});
      mockPrisma.inventory.update.mockResolvedValue({
        dust: pkg.dustAmount + pkg.bonusDust,
      });

      const result = await grantDust('user-123', 'dust_100', 'txn-new', 'ios');

      expect(result.success).toBe(true);
      expect(result.dustGranted).toBe(pkg.dustAmount);
      expect(result.bonusGranted).toBe(pkg.bonusDust);
      expect(result.isFirstPurchase).toBe(true);
    });

    it('grants dust without bonus for repeat purchase', async () => {
      const pkg = DUST_PACKAGES.find((p) => p.id === 'dust_100')!;

      mockPrisma.iAPTransaction.findUnique.mockResolvedValue(null);
      mockPrisma.iAPTransaction.findFirst.mockResolvedValue({
        id: 'previous',
        packageId: 'dust_100',
      });
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });
      mockPrisma.iAPTransaction.create.mockResolvedValue({});
      mockPrisma.inventory.update.mockResolvedValue({
        dust: pkg.dustAmount,
      });

      const result = await grantDust('user-123', 'dust_100', 'txn-repeat', 'ios');

      expect(result.success).toBe(true);
      expect(result.dustGranted).toBe(pkg.dustAmount);
      expect(result.bonusGranted).toBe(0);
      expect(result.isFirstPurchase).toBe(false);
    });

    it('creates transaction record', async () => {
      mockPrisma.iAPTransaction.findUnique.mockResolvedValue(null);
      mockPrisma.iAPTransaction.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });
      mockPrisma.iAPTransaction.create.mockResolvedValue({});
      mockPrisma.inventory.update.mockResolvedValue({ dust: 100 });

      await grantDust('user-123', 'dust_100', 'txn-create', 'android');

      expect(mockPrisma.iAPTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          packageId: 'dust_100',
          transactionId: 'txn-create',
          platform: 'android',
        }),
      });
    });

    it('updates user inventory with dust', async () => {
      const pkg = DUST_PACKAGES.find((p) => p.id === 'dust_500')!;

      mockPrisma.iAPTransaction.findUnique.mockResolvedValue(null);
      mockPrisma.iAPTransaction.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });
      mockPrisma.iAPTransaction.create.mockResolvedValue({});
      mockPrisma.inventory.update.mockResolvedValue({
        dust: pkg.dustAmount + pkg.bonusDust,
      });

      await grantDust('user-123', 'dust_500', 'txn-update', 'steam');

      expect(mockPrisma.inventory.update).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        data: {
          dust: { increment: pkg.dustAmount + pkg.bonusDust },
        },
      });
    });

    it('supports all platforms', async () => {
      const platforms = ['ios', 'android', 'steam', 'web'] as const;

      for (const platform of platforms) {
        mockPrisma.iAPTransaction.findUnique.mockResolvedValue(null);
        mockPrisma.iAPTransaction.findFirst.mockResolvedValue(null);
        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          return callback(mockPrisma);
        });
        mockPrisma.iAPTransaction.create.mockResolvedValue({});
        mockPrisma.inventory.update.mockResolvedValue({ dust: 100 });

        const result = await grantDust('user-123', 'dust_100', `txn-${platform}`, platform);

        expect(result.success).toBe(true);
      }
    });
  });

  describe('getTransactions', () => {
    it('returns empty list for user with no transactions', async () => {
      mockPrisma.iAPTransaction.findMany.mockResolvedValue([]);
      mockPrisma.iAPTransaction.count.mockResolvedValue(0);

      const result = await getTransactions('user-123');

      expect(result.transactions).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('returns transactions in descending order', async () => {
      const now = new Date();
      const earlier = new Date(now.getTime() - 86400000);

      mockPrisma.iAPTransaction.findMany.mockResolvedValue([
        {
          id: 'txn-1',
          userId: 'user-123',
          packageId: 'dust_100',
          dustGranted: 100,
          bonusGranted: 10,
          transactionId: 'store-txn-1',
          platform: 'ios',
          createdAt: now,
        },
        {
          id: 'txn-2',
          userId: 'user-123',
          packageId: 'dust_500',
          dustGranted: 500,
          bonusGranted: 75,
          transactionId: 'store-txn-2',
          platform: 'ios',
          createdAt: earlier,
        },
      ]);
      mockPrisma.iAPTransaction.count.mockResolvedValue(2);

      const result = await getTransactions('user-123');

      expect(result.transactions.length).toBe(2);
      expect(result.total).toBe(2);
      expect(result.transactions[0].packageId).toBe('dust_100');
    });

    it('respects limit and offset', async () => {
      mockPrisma.iAPTransaction.findMany.mockResolvedValue([]);
      mockPrisma.iAPTransaction.count.mockResolvedValue(100);

      await getTransactions('user-123', 10, 20);

      expect(mockPrisma.iAPTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        })
      );
    });

    it('formats dates as ISO strings', async () => {
      const date = new Date('2024-01-15T12:00:00.000Z');

      mockPrisma.iAPTransaction.findMany.mockResolvedValue([
        {
          id: 'txn-1',
          userId: 'user-123',
          packageId: 'dust_100',
          dustGranted: 100,
          bonusGranted: 10,
          transactionId: 'store-txn',
          platform: 'ios',
          createdAt: date,
        },
      ]);
      mockPrisma.iAPTransaction.count.mockResolvedValue(1);

      const result = await getTransactions('user-123');

      expect(result.transactions[0].createdAt).toBe('2024-01-15T12:00:00.000Z');
    });
  });
});
