/**
 * Guild Treasury service tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getTreasury,
  canWithdraw,
  deposit,
  withdraw,
  getTreasuryLogs,
  payBattleCost,
  distributeRewards,
} from '../../../services/guildTreasury.js';
import {
  mockPrisma,
  resetPrismaMock,
  createMockGuildMember,
  createMockGuildTreasury,
  createMockGuildTreasuryLog,
  createMockInventory,
} from '../../mocks/prisma.js';
import { GUILD_ERROR_CODES } from '@arcade/protocol';

describe('Guild Treasury Service', () => {
  beforeEach(() => {
    resetPrismaMock();
    // Mock daily donation total aggregate (for donation limits)
    mockPrisma.guildTreasuryLog.aggregate.mockResolvedValue({
      _sum: { goldAmount: 0, dustAmount: 0 },
    });
  });

  // ============================================================================
  // GET TREASURY
  // ============================================================================

  describe('getTreasury', () => {
    it('returns treasury for guild', async () => {
      const mockTreasury = createMockGuildTreasury({ gold: 1000, dust: 100 });
      mockPrisma.guildTreasury.findUnique.mockResolvedValue(mockTreasury);

      const result = await getTreasury('guild-123');

      expect(result).not.toBeNull();
      expect(result!.gold).toBe(1000);
      expect(result!.dust).toBe(100);
    });

    it('returns null if treasury not found', async () => {
      mockPrisma.guildTreasury.findUnique.mockResolvedValue(null);

      const result = await getTreasury('non-existent');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // CAN WITHDRAW
  // ============================================================================

  describe('canWithdraw', () => {
    it('returns allowed for leader with no recent withdrawals', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER' })
      );
      mockPrisma.guildTreasuryLog.findFirst.mockResolvedValue(null);

      const result = await canWithdraw('guild-123', 'user-123');

      expect(result.allowed).toBe(true);
    });

    it('returns not allowed for non-members', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);

      const result = await canWithdraw('guild-123', 'non-member');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe(GUILD_ERROR_CODES.NOT_IN_GUILD);
    });

    it('returns not allowed for non-leaders', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'MEMBER' })
      );

      const result = await canWithdraw('guild-123', 'user-123');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    });

    it('returns cooldown info if recent withdrawal exists', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER' })
      );
      // Recent withdrawal from 1 hour ago
      mockPrisma.guildTreasuryLog.findFirst.mockResolvedValue({
        createdAt: new Date(Date.now() - 60 * 60 * 1000),
      });

      const result = await canWithdraw('guild-123', 'user-123');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe(GUILD_ERROR_CODES.WITHDRAWAL_COOLDOWN);
      expect(result.nextAllowedAt).toBeDefined();
    });

    it('allows withdrawal after cooldown period', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER' })
      );
      // Old withdrawal from 25 hours ago
      mockPrisma.guildTreasuryLog.findFirst.mockResolvedValue({
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      });

      const result = await canWithdraw('guild-123', 'user-123');

      expect(result.allowed).toBe(true);
    });
  });

  // ============================================================================
  // DEPOSIT
  // ============================================================================

  describe('deposit', () => {
    it('deposits gold to treasury', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(createMockGuildMember());
      mockPrisma.inventory.findUnique.mockResolvedValue(createMockInventory({ gold: 1000 }));
      mockPrisma.inventory.update.mockResolvedValue({});
      mockPrisma.guildTreasury.update.mockResolvedValue(createMockGuildTreasury({ gold: 500 }));
      mockPrisma.guildMember.update.mockResolvedValue({});
      mockPrisma.guildTreasuryLog.create.mockResolvedValue({});

      const result = await deposit('guild-123', 'user-123', { gold: 500 });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result.gold).toBe(500);
    });

    it('throws error if not in guild', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);

      await expect(
        deposit('guild-123', 'user-123', { gold: 500 })
      ).rejects.toThrow(GUILD_ERROR_CODES.NOT_IN_GUILD);
    });

    it('throws error if invalid amount', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(createMockGuildMember());

      await expect(
        deposit('guild-123', 'user-123', { gold: 0 })
      ).rejects.toThrow(GUILD_ERROR_CODES.INVALID_AMOUNT);
    });

    it('throws error if insufficient personal funds', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(createMockGuildMember());
      mockPrisma.inventory.findUnique.mockResolvedValue(createMockInventory({ gold: 100 }));

      await expect(
        deposit('guild-123', 'user-123', { gold: 500 })
      ).rejects.toThrow(GUILD_ERROR_CODES.INSUFFICIENT_PERSONAL_FUNDS);
    });
  });

  // ============================================================================
  // WITHDRAW
  // ============================================================================

  describe('withdraw', () => {
    it('withdraws gold from treasury', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER' })
      );
      mockPrisma.guildTreasuryLog.findFirst.mockResolvedValue(null);
      mockPrisma.guildTreasury.findUnique.mockResolvedValue(
        createMockGuildTreasury({ gold: 10000 })
      );
      mockPrisma.guildTreasury.update.mockResolvedValue(createMockGuildTreasury({ gold: 8000 }));
      mockPrisma.inventory.update.mockResolvedValue({});
      mockPrisma.guildTreasuryLog.create.mockResolvedValue({});

      const result = await withdraw('guild-123', 'user-123', { gold: 2000 }, 'Test withdrawal');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result.gold).toBe(8000);
    });

    it('throws error if treasury insufficient', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER' })
      );
      mockPrisma.guildTreasuryLog.findFirst.mockResolvedValue(null);
      mockPrisma.guildTreasury.findUnique.mockResolvedValue(
        createMockGuildTreasury({ gold: 100 })
      );

      await expect(
        withdraw('guild-123', 'user-123', { gold: 500 }, 'Test')
      ).rejects.toThrow(GUILD_ERROR_CODES.TREASURY_INSUFFICIENT);
    });

    it('throws error if exceeding 20% limit', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER' })
      );
      mockPrisma.guildTreasuryLog.findFirst.mockResolvedValue(null);
      mockPrisma.guildTreasury.findUnique.mockResolvedValue(
        createMockGuildTreasury({ gold: 10000 })
      );

      // 20% of 10000 = 2000, trying to withdraw 3000
      await expect(
        withdraw('guild-123', 'user-123', { gold: 3000 }, 'Test')
      ).rejects.toThrow(GUILD_ERROR_CODES.WITHDRAWAL_LIMIT_EXCEEDED);
    });
  });

  // ============================================================================
  // GET LOGS
  // ============================================================================

  describe('getTreasuryLogs', () => {
    it('returns paginated logs', async () => {
      mockPrisma.guildTreasuryLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          transactionType: 'DEPOSIT_GOLD',
          goldAmount: 1000,
          user: { displayName: 'TestUser' },
        },
      ]);
      mockPrisma.guildTreasuryLog.count.mockResolvedValue(1);

      const result = await getTreasuryLogs('guild-123', 50, 0);

      expect(result.logs.length).toBe(1);
      expect(result.total).toBe(1);
    });

    it('uses pagination parameters', async () => {
      mockPrisma.guildTreasuryLog.findMany.mockResolvedValue([]);
      mockPrisma.guildTreasuryLog.count.mockResolvedValue(0);

      await getTreasuryLogs('guild-123', 10, 20);

      expect(mockPrisma.guildTreasuryLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        })
      );
    });
  });

  // ============================================================================
  // PAY BATTLE COST
  // ============================================================================

  describe('payBattleCost', () => {
    it('deducts gold from treasury for battle', async () => {
      mockPrisma.guildTreasury.findUnique.mockResolvedValue(
        createMockGuildTreasury({ gold: 10000 })
      );
      mockPrisma.guildTreasury.update.mockResolvedValue(
        createMockGuildTreasury({ gold: 9500 })
      );
      mockPrisma.guildTreasuryLog.create.mockResolvedValue({});

      await payBattleCost('guild-123', 'user-123', 500, 'battle-abc');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('throws error if treasury has insufficient gold', async () => {
      mockPrisma.guildTreasury.findUnique.mockResolvedValue(
        createMockGuildTreasury({ gold: 100 })
      );

      await expect(
        payBattleCost('guild-123', 'user-123', 500, 'battle-abc')
      ).rejects.toThrow(GUILD_ERROR_CODES.TREASURY_INSUFFICIENT);
    });

    it('throws error if treasury not found', async () => {
      mockPrisma.guildTreasury.findUnique.mockResolvedValue(null);

      await expect(
        payBattleCost('guild-123', 'user-123', 500, 'battle-abc')
      ).rejects.toThrow(GUILD_ERROR_CODES.TREASURY_INSUFFICIENT);
    });
  });

  // ============================================================================
  // DISTRIBUTE REWARDS
  // ============================================================================

  describe('distributeRewards', () => {
    it('adds rewards to treasury', async () => {
      mockPrisma.guildTreasury.update.mockResolvedValue(
        createMockGuildTreasury({ gold: 2000, dust: 200 })
      );
      mockPrisma.guildMember.findFirst.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER' })
      );
      mockPrisma.guildTreasuryLog.create.mockResolvedValue({});

      await distributeRewards(
        'guild-123',
        { gold: 1000, dust: 100 },
        'Battle victory reward'
      );

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('creates audit log with leader userId', async () => {
      const mockLeader = createMockGuildMember({ role: 'LEADER', userId: 'leader-user' });
      mockPrisma.guildTreasury.update.mockResolvedValue(
        createMockGuildTreasury({ gold: 1000 })
      );
      mockPrisma.guildMember.findFirst.mockResolvedValue(mockLeader);
      mockPrisma.guildTreasuryLog.create.mockResolvedValue({});

      await distributeRewards('guild-123', { gold: 500 }, 'Reward test');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // AUDIT LOG VERIFICATION
  // ============================================================================

  describe('Audit Log Creation', () => {
    describe('Deposit Audit Logs', () => {
      it('creates DEPOSIT_GOLD log when depositing gold', async () => {
        mockPrisma.guildMember.findUnique.mockResolvedValue(createMockGuildMember());
        mockPrisma.inventory.findUnique.mockResolvedValue(createMockInventory({ gold: 5000 }));
        mockPrisma.inventory.update.mockResolvedValue({});
        mockPrisma.guildTreasury.update.mockResolvedValue(
          createMockGuildTreasury({ gold: 1500, dust: 0 })
        );
        mockPrisma.guildMember.update.mockResolvedValue({});
        mockPrisma.guildTreasuryLog.create.mockResolvedValue({});

        await deposit('guild-123', 'user-123', { gold: 1500 });

        expect(mockPrisma.$transaction).toHaveBeenCalled();
      });

      it('creates DEPOSIT_DUST log when depositing dust', async () => {
        mockPrisma.guildMember.findUnique.mockResolvedValue(createMockGuildMember());
        mockPrisma.inventory.findUnique.mockResolvedValue(createMockInventory({ dust: 500 }));
        mockPrisma.inventory.update.mockResolvedValue({});
        mockPrisma.guildTreasury.update.mockResolvedValue(
          createMockGuildTreasury({ gold: 0, dust: 200 })
        );
        mockPrisma.guildMember.update.mockResolvedValue({});
        mockPrisma.guildTreasuryLog.create.mockResolvedValue({});

        await deposit('guild-123', 'user-123', { dust: 200 });

        expect(mockPrisma.$transaction).toHaveBeenCalled();
      });

      it('creates multiple logs when depositing multiple resources', async () => {
        mockPrisma.guildMember.findUnique.mockResolvedValue(createMockGuildMember());
        mockPrisma.inventory.findUnique.mockResolvedValue(
          createMockInventory({ gold: 5000, dust: 500 })
        );
        mockPrisma.inventory.update.mockResolvedValue({});
        mockPrisma.guildTreasury.update.mockResolvedValue(
          createMockGuildTreasury({ gold: 1000, dust: 100 })
        );
        mockPrisma.guildMember.update.mockResolvedValue({});
        mockPrisma.guildTreasuryLog.create.mockResolvedValue({});

        await deposit('guild-123', 'user-123', { gold: 1000, dust: 100 });

        expect(mockPrisma.$transaction).toHaveBeenCalled();
      });
    });

    describe('Withdraw Audit Logs', () => {
      it('creates WITHDRAW_GOLD log when withdrawing gold', async () => {
        mockPrisma.guildMember.findUnique.mockResolvedValue(
          createMockGuildMember({ role: 'LEADER' })
        );
        mockPrisma.guildTreasuryLog.findFirst.mockResolvedValue(null);
        mockPrisma.guildTreasury.findUnique.mockResolvedValue(
          createMockGuildTreasury({ gold: 10000 })
        );
        mockPrisma.guildTreasury.update.mockResolvedValue(
          createMockGuildTreasury({ gold: 8000 })
        );
        mockPrisma.inventory.update.mockResolvedValue({});
        mockPrisma.guildTreasuryLog.create.mockResolvedValue({});

        await withdraw('guild-123', 'user-123', { gold: 2000 }, 'Guild upgrade');

        expect(mockPrisma.$transaction).toHaveBeenCalled();
      });

      it('creates WITHDRAW_DUST log when withdrawing dust', async () => {
        mockPrisma.guildMember.findUnique.mockResolvedValue(
          createMockGuildMember({ role: 'LEADER' })
        );
        mockPrisma.guildTreasuryLog.findFirst.mockResolvedValue(null);
        mockPrisma.guildTreasury.findUnique.mockResolvedValue(
          createMockGuildTreasury({ dust: 1000 })
        );
        mockPrisma.guildTreasury.update.mockResolvedValue(
          createMockGuildTreasury({ dust: 800 })
        );
        mockPrisma.inventory.update.mockResolvedValue({});
        mockPrisma.guildTreasuryLog.create.mockResolvedValue({});

        await withdraw('guild-123', 'user-123', { dust: 200 }, 'Dust withdrawal');

        expect(mockPrisma.$transaction).toHaveBeenCalled();
      });

      it('creates multiple logs when withdrawing multiple resources', async () => {
        mockPrisma.guildMember.findUnique.mockResolvedValue(
          createMockGuildMember({ role: 'LEADER' })
        );
        mockPrisma.guildTreasuryLog.findFirst.mockResolvedValue(null);
        mockPrisma.guildTreasury.findUnique.mockResolvedValue(
          createMockGuildTreasury({ gold: 10000, dust: 1000 })
        );
        mockPrisma.guildTreasury.update.mockResolvedValue(
          createMockGuildTreasury({ gold: 8000, dust: 800 })
        );
        mockPrisma.inventory.update.mockResolvedValue({});
        mockPrisma.guildTreasuryLog.create.mockResolvedValue({});

        await withdraw('guild-123', 'user-123', { gold: 2000, dust: 200 }, 'Multi-resource');

        expect(mockPrisma.$transaction).toHaveBeenCalled();
      });

      it('logs include negative amounts for withdrawals', async () => {
        mockPrisma.guildMember.findUnique.mockResolvedValue(
          createMockGuildMember({ role: 'LEADER' })
        );
        mockPrisma.guildTreasuryLog.findFirst.mockResolvedValue(null);
        mockPrisma.guildTreasury.findUnique.mockResolvedValue(
          createMockGuildTreasury({ gold: 10000 })
        );
        mockPrisma.guildTreasury.update.mockResolvedValue(
          createMockGuildTreasury({ gold: 8000 })
        );
        mockPrisma.inventory.update.mockResolvedValue({});
        mockPrisma.guildTreasuryLog.create.mockResolvedValue({});

        await withdraw('guild-123', 'user-123', { gold: 2000 }, 'Test');

        expect(mockPrisma.$transaction).toHaveBeenCalled();
      });
    });

    describe('Battle Cost Audit Logs', () => {
      it('creates BATTLE_COST log with referenceId', async () => {
        mockPrisma.guildTreasury.findUnique.mockResolvedValue(
          createMockGuildTreasury({ gold: 10000 })
        );
        mockPrisma.guildTreasury.update.mockResolvedValue(
          createMockGuildTreasury({ gold: 9000 })
        );
        mockPrisma.guildTreasuryLog.create.mockResolvedValue({});

        await payBattleCost('guild-123', 'user-123', 1000, 'battle-xyz-123');

        expect(mockPrisma.$transaction).toHaveBeenCalled();
      });

      it('creates log with negative gold amount', async () => {
        mockPrisma.guildTreasury.findUnique.mockResolvedValue(
          createMockGuildTreasury({ gold: 5000 })
        );
        mockPrisma.guildTreasury.update.mockResolvedValue(
          createMockGuildTreasury({ gold: 4500 })
        );
        mockPrisma.guildTreasuryLog.create.mockResolvedValue({});

        await payBattleCost('guild-123', 'user-123', 500, 'battle-abc');

        expect(mockPrisma.$transaction).toHaveBeenCalled();
      });
    });

    describe('Reward Distribution Audit Logs', () => {
      it('creates REWARD_DISTRIBUTION log', async () => {
        mockPrisma.guildTreasury.update.mockResolvedValue(
          createMockGuildTreasury({ gold: 5000 })
        );
        mockPrisma.guildMember.findFirst.mockResolvedValue(
          createMockGuildMember({ role: 'LEADER', userId: 'leader-id' })
        );
        mockPrisma.guildTreasuryLog.create.mockResolvedValue({});

        await distributeRewards('guild-123', { gold: 2000 }, 'Weekly boss reward');

        expect(mockPrisma.$transaction).toHaveBeenCalled();
      });

      it('includes multiple resource types in single log', async () => {
        mockPrisma.guildTreasury.update.mockResolvedValue(
          createMockGuildTreasury({ gold: 3000, dust: 300 })
        );
        mockPrisma.guildMember.findFirst.mockResolvedValue(
          createMockGuildMember({ role: 'LEADER' })
        );
        mockPrisma.guildTreasuryLog.create.mockResolvedValue({});

        await distributeRewards(
          'guild-123',
          { gold: 1000, dust: 100 },
          'Multi-resource reward'
        );

        expect(mockPrisma.$transaction).toHaveBeenCalled();
      });
    });

    describe('Log Balance Tracking', () => {
      it('logs contain balance after transaction for deposits', async () => {
        mockPrisma.guildMember.findUnique.mockResolvedValue(createMockGuildMember());
        mockPrisma.inventory.findUnique.mockResolvedValue(createMockInventory({ gold: 5000 }));
        mockPrisma.inventory.update.mockResolvedValue({});
        mockPrisma.guildTreasury.update.mockResolvedValue(
          createMockGuildTreasury({ gold: 2500, dust: 250 })
        );
        mockPrisma.guildMember.update.mockResolvedValue({});
        mockPrisma.guildTreasuryLog.create.mockResolvedValue({});

        await deposit('guild-123', 'user-123', { gold: 1000 });

        expect(mockPrisma.$transaction).toHaveBeenCalled();
      });

      it('logs contain balance after transaction for withdrawals', async () => {
        mockPrisma.guildMember.findUnique.mockResolvedValue(
          createMockGuildMember({ role: 'LEADER' })
        );
        mockPrisma.guildTreasuryLog.findFirst.mockResolvedValue(null);
        mockPrisma.guildTreasury.findUnique.mockResolvedValue(
          createMockGuildTreasury({ gold: 10000, dust: 1000 })
        );
        mockPrisma.guildTreasury.update.mockResolvedValue(
          createMockGuildTreasury({ gold: 8000, dust: 1000 })
        );
        mockPrisma.inventory.update.mockResolvedValue({});
        mockPrisma.guildTreasuryLog.create.mockResolvedValue({});

        await withdraw('guild-123', 'user-123', { gold: 2000 }, 'Test');

        expect(mockPrisma.$transaction).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // WITHDRAWAL PERMISSIONS & LIMITS (EXTENDED)
  // ============================================================================

  describe('Withdrawal Permissions (Extended)', () => {
    it('officers cannot withdraw', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'OFFICER' })
      );

      const result = await canWithdraw('guild-123', 'user-123');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    });

    it('calculates correct cooldown end time', async () => {
      const withdrawalTime = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12 hours ago
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER' })
      );
      mockPrisma.guildTreasuryLog.findFirst.mockResolvedValue({
        createdAt: withdrawalTime,
      });

      const result = await canWithdraw('guild-123', 'user-123');

      expect(result.allowed).toBe(false);
      expect(result.nextAllowedAt).toBeDefined();
      // Should be 24 hours after the withdrawal time
      const expectedEnd = new Date(withdrawalTime);
      expectedEnd.setHours(expectedEnd.getHours() + 24);
      expect(result.nextAllowedAt!.getTime()).toBeCloseTo(expectedEnd.getTime(), -3);
    });
  });

  describe('Withdrawal Limits (Extended)', () => {
    it('enforces 20% limit on dust withdrawals', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER' })
      );
      mockPrisma.guildTreasuryLog.findFirst.mockResolvedValue(null);
      mockPrisma.guildTreasury.findUnique.mockResolvedValue(
        createMockGuildTreasury({ dust: 1000 })
      );

      // 20% of 1000 = 200, trying to withdraw 300
      await expect(
        withdraw('guild-123', 'user-123', { dust: 300 }, 'Test')
      ).rejects.toThrow(GUILD_ERROR_CODES.WITHDRAWAL_LIMIT_EXCEEDED);
    });

    it('allows withdrawal at exactly 20% limit', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER' })
      );
      mockPrisma.guildTreasuryLog.findFirst.mockResolvedValue(null);
      mockPrisma.guildTreasury.findUnique.mockResolvedValue(
        createMockGuildTreasury({ gold: 10000 })
      );
      mockPrisma.guildTreasury.update.mockResolvedValue(
        createMockGuildTreasury({ gold: 8000 })
      );
      mockPrisma.inventory.update.mockResolvedValue({});
      mockPrisma.guildTreasuryLog.create.mockResolvedValue({});

      // 20% of 10000 = 2000
      const result = await withdraw('guild-123', 'user-123', { gold: 2000 }, 'Test');

      expect(result.gold).toBe(8000);
    });

    it('rejects when any single resource exceeds 20% limit', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER' })
      );
      mockPrisma.guildTreasuryLog.findFirst.mockResolvedValue(null);
      mockPrisma.guildTreasury.findUnique.mockResolvedValue(
        createMockGuildTreasury({ gold: 10000, dust: 1000 })
      );

      // Gold is 20% OK (2000), but dust 300 > 20% of 1000
      await expect(
        withdraw('guild-123', 'user-123', { gold: 2000, dust: 300 }, 'Test')
      ).rejects.toThrow(GUILD_ERROR_CODES.WITHDRAWAL_LIMIT_EXCEEDED);
    });
  });

  // ============================================================================
  // LOG RETRIEVAL (EXTENDED)
  // ============================================================================

  describe('getTreasuryLogs (Extended)', () => {
    it('includes user displayName in logs', async () => {
      const mockLog = createMockGuildTreasuryLog({
        user: { displayName: 'GuildLeader' },
      });
      mockPrisma.guildTreasuryLog.findMany.mockResolvedValue([mockLog]);
      mockPrisma.guildTreasuryLog.count.mockResolvedValue(1);

      const result = await getTreasuryLogs('guild-123');

      expect(result.logs[0].user.displayName).toBe('GuildLeader');
    });

    it('returns logs sorted by createdAt desc', async () => {
      const oldLog = createMockGuildTreasuryLog({
        id: 'old-log',
        createdAt: new Date(Date.now() - 1000),
      });
      const newLog = createMockGuildTreasuryLog({
        id: 'new-log',
        createdAt: new Date(),
      });
      mockPrisma.guildTreasuryLog.findMany.mockResolvedValue([newLog, oldLog]);
      mockPrisma.guildTreasuryLog.count.mockResolvedValue(2);

      const result = await getTreasuryLogs('guild-123');

      expect(result.logs[0].id).toBe('new-log');
      expect(result.logs[1].id).toBe('old-log');
    });

    it('respects default pagination limit', async () => {
      mockPrisma.guildTreasuryLog.findMany.mockResolvedValue([]);
      mockPrisma.guildTreasuryLog.count.mockResolvedValue(0);

      await getTreasuryLogs('guild-123');

      expect(mockPrisma.guildTreasuryLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
          skip: 0,
        })
      );
    });

    it('returns various transaction types', async () => {
      const logs = [
        createMockGuildTreasuryLog({ transactionType: 'DEPOSIT_GOLD' }),
        createMockGuildTreasuryLog({ transactionType: 'WITHDRAW_GOLD' }),
        createMockGuildTreasuryLog({ transactionType: 'BATTLE_COST' }),
        createMockGuildTreasuryLog({ transactionType: 'REWARD_DISTRIBUTION' }),
      ];
      mockPrisma.guildTreasuryLog.findMany.mockResolvedValue(logs);
      mockPrisma.guildTreasuryLog.count.mockResolvedValue(4);

      const result = await getTreasuryLogs('guild-123');

      expect(result.logs.length).toBe(4);
      expect(result.total).toBe(4);
    });
  });
});
