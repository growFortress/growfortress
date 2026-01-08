import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createBulkReward, listAvailableRewards, claimReward } from '../../../services/bulkRewards.js';
import { mockPrisma } from '../../mocks/prisma.js';

describe('BulkRewards Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createBulkReward', () => {
    it('creates a bulk reward for all players', async () => {
      const rewardData = {
        title: 'Test Reward',
        description: 'Test Description',
        type: 'GOLD',
        value: '100',
      };

      mockPrisma.bulkReward.create.mockResolvedValue({ id: 'reward-1', ...rewardData, targetType: 'ALL', createdAt: new Date() });

      const result = await createBulkReward(rewardData);

      expect(mockPrisma.bulkReward.create).toHaveBeenCalledWith({
        data: {
          ...rewardData,
          targetType: 'ALL',
        },
      });
      expect(result.id).toBe('reward-1');
    });
  });

  describe('listAvailableRewards', () => {
    it('lists rewards not yet claimed by the user', async () => {
      const mockRewards = [
        { id: 'reward-1', title: 'R1', expiresAt: null },
      ];
      mockPrisma.bulkReward.findMany.mockResolvedValue(mockRewards);
      mockPrisma.playerRewardClaim.findMany.mockResolvedValue([]);

      const result = await listAvailableRewards('user-1');

      expect(mockPrisma.bulkReward.findMany).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe('claimReward', () => {
    it('claims a reward and updates inventory', async () => {
      const userId = 'user-1';
      const rewardId = 'reward-1';
      const reward = { id: rewardId, type: 'GOLD', value: '500', expiresAt: null };

      // Mock transaction
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });

      mockPrisma.bulkReward.findUnique.mockResolvedValue(reward);
      mockPrisma.playerRewardClaim.findUnique.mockResolvedValue(null);
      mockPrisma.inventory.update.mockResolvedValue({});

      const result = await claimReward(userId, rewardId);

      expect(result.success).toBe(true);
      expect(mockPrisma.playerRewardClaim.create).toHaveBeenCalledWith({
        data: { userId, rewardId }
      });
      expect(mockPrisma.inventory.update).toHaveBeenCalledWith({
        where: { userId },
        data: { gold: { increment: 500 } }
      });
    });

    it('throws error if reward already claimed', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });

      mockPrisma.bulkReward.findUnique.mockResolvedValue({ id: 'r1', expiresAt: null });
      mockPrisma.playerRewardClaim.findUnique.mockResolvedValue({ id: 'claim-1' });

      await expect(claimReward('u1', 'r1')).rejects.toThrow('Reward already claimed');
    });

    it('throws error if reward expired', async () => {
      const pastDate = new Date(Date.now() - 10000);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });

      mockPrisma.bulkReward.findUnique.mockResolvedValue({ id: 'r1', expiresAt: pastDate });

      await expect(claimReward('u1', 'r1')).rejects.toThrow('Reward has expired');
    });
  });
});
