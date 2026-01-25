/**
 * Referrals service tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockPrisma, createMockUser } from '../../mocks/prisma.js';
import '../../helpers/setup.js';

// Import service functions after setup
import {
  createReferralCode,
  getOrCreateReferralCode,
  getReferralStatus,
  applyReferralCode,
  REFERRAL_REWARDS,
} from '../../../services/referrals.js';

describe('Referrals Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('REFERRAL_REWARDS', () => {
    it('should have correct reward values for inviter', () => {
      expect(REFERRAL_REWARDS.inviter.gold).toBe(500);
      expect(REFERRAL_REWARDS.inviter.dust).toBe(20);
    });

    it('should have correct reward values for invitee', () => {
      expect(REFERRAL_REWARDS.invitee.gold).toBe(300);
      expect(REFERRAL_REWARDS.invitee.dust).toBe(10);
    });
  });

  describe('createReferralCode', () => {
    it('should generate unique 8-character uppercase hex code', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const code = await createReferralCode();

      expect(code).toMatch(/^[A-F0-9]{8}$/);
      expect(code).toBe(code.toUpperCase());
    });

    it('should retry if code already exists', async () => {
      // First call returns existing user, second call returns null
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 'existing-user' })
        .mockResolvedValueOnce(null);

      const code = await createReferralCode();

      expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(2);
      expect(code).toMatch(/^[A-F0-9]{8}$/);
    });

    it('should throw after MAX_CODE_ATTEMPTS failures', async () => {
      // Always return existing user to force failure
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      await expect(createReferralCode()).rejects.toThrow('REFERRAL_CODE_GENERATION_FAILED');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(5); // MAX_CODE_ATTEMPTS = 5
    });
  });

  describe('getOrCreateReferralCode', () => {
    it('should return existing code if user has one', async () => {
      const mockUser = createMockUser({ referralCode: 'EXISTCODE' });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await getOrCreateReferralCode('user-123');

      expect(result).toBe('EXISTCODE');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should create new code if user does not have one', async () => {
      const mockUser = createMockUser({ referralCode: null });
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(mockUser) // getOrCreateReferralCode check
        .mockResolvedValueOnce(null); // createReferralCode uniqueness check
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, referralCode: 'NEWCODE1' });

      const result = await getOrCreateReferralCode('user-123');

      expect(result).toMatch(/^[A-F0-9]{8}$/);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { referralCode: expect.stringMatching(/^[A-F0-9]{8}$/) },
      });
    });

    it('should throw USER_NOT_FOUND if user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(getOrCreateReferralCode('nonexistent')).rejects.toThrow('USER_NOT_FOUND');
    });
  });

  describe('getReferralStatus', () => {
    it('should return referral code and invite count', async () => {
      const mockUser = createMockUser({ referralCode: 'TESTCODE' });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.count.mockResolvedValue(5);

      const result = await getReferralStatus('user-123');

      expect(result).toEqual({
        referralCode: 'TESTCODE',
        inviteCount: 5,
        rewards: REFERRAL_REWARDS,
      });
      expect(mockPrisma.user.count).toHaveBeenCalledWith({
        where: { referredById: 'user-123' },
      });
    });

    it('should create code if not exists', async () => {
      const mockUser = createMockUser({ referralCode: null });
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(mockUser) // getOrCreateReferralCode check
        .mockResolvedValueOnce(null); // createReferralCode uniqueness check
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, referralCode: 'NEWCODE2' });
      mockPrisma.user.count.mockResolvedValue(0);

      const result = await getReferralStatus('user-123');

      expect(result.referralCode).toMatch(/^[A-F0-9]{8}$/);
      expect(result.inviteCount).toBe(0);
      expect(result.rewards).toEqual(REFERRAL_REWARDS);
    });
  });

  describe('applyReferralCode', () => {
    const inviterId = 'inviter-123';
    const inviteeId = 'invitee-456';

    it('should return EMPTY_CODE for empty input', async () => {
      const result = await applyReferralCode(inviteeId, '');

      expect(result).toEqual({ applied: false, reason: 'EMPTY_CODE' });
    });

    it('should return EMPTY_CODE for whitespace-only input', async () => {
      const result = await applyReferralCode(inviteeId, '   ');

      expect(result).toEqual({ applied: false, reason: 'EMPTY_CODE' });
    });

    it('should return INVITEE_NOT_FOUND if invitee does not exist', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // invitee lookup
        .mockResolvedValueOnce({ id: inviterId }); // inviter lookup

      const result = await applyReferralCode(inviteeId, 'VALIDCODE');

      expect(result).toEqual({ applied: false, reason: 'INVITEE_NOT_FOUND' });
    });

    it('should return INVALID_CODE if code does not match any user', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: inviteeId, referredById: null }) // invitee lookup
        .mockResolvedValueOnce(null); // inviter lookup (no match)

      const result = await applyReferralCode(inviteeId, 'BADCODE1');

      expect(result).toEqual({ applied: false, reason: 'INVALID_CODE' });
    });

    it('should return SELF_REFERRAL if user tries to refer themselves', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: inviteeId, referredById: null }) // invitee lookup
        .mockResolvedValueOnce({ id: inviteeId }); // inviter lookup (same user)

      const result = await applyReferralCode(inviteeId, 'SELFCODE');

      expect(result).toEqual({ applied: false, reason: 'SELF_REFERRAL' });
    });

    it('should return ALREADY_REFERRED if already has referredById', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: inviteeId, referredById: 'other-user' }) // invitee already referred
        .mockResolvedValueOnce({ id: inviterId }); // inviter lookup

      const result = await applyReferralCode(inviteeId, 'VALIDCODE');

      expect(result).toEqual({ applied: false, reason: 'ALREADY_REFERRED' });
    });

    it('should apply successfully and update referredById', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: inviteeId, referredById: null }) // invitee lookup
        .mockResolvedValueOnce({ id: inviterId }); // inviter lookup

      const result = await applyReferralCode(inviteeId, 'VALIDCODE');

      expect(result).toEqual({ applied: true });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should grant rewards to both inviter and invitee', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: inviteeId, referredById: null }) // invitee lookup
        .mockResolvedValueOnce({ id: inviterId }); // inviter lookup

      // Track what the transaction callback does
      let transactionCalls: { model: string; method: string; args: unknown }[] = [];
      mockPrisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<void>) => {
        const txMock = {
          user: {
            update: vi.fn().mockImplementation((args) => {
              transactionCalls.push({ model: 'user', method: 'update', args });
              return Promise.resolve({});
            }),
          },
          inventory: {
            update: vi.fn().mockImplementation((args) => {
              transactionCalls.push({ model: 'inventory', method: 'update', args });
              return Promise.resolve({});
            }),
          },
        };
        await callback(txMock);
        return {};
      });

      const result = await applyReferralCode(inviteeId, 'VALIDCODE');

      expect(result).toEqual({ applied: true });

      // Verify user update (setting referredById)
      const userUpdate = transactionCalls.find((c) => c.model === 'user' && c.method === 'update');
      expect(userUpdate).toBeDefined();
      expect(userUpdate!.args).toEqual({
        where: { id: inviteeId },
        data: { referredById: inviterId },
      });

      // Verify inviter inventory update
      const inviterInventoryUpdate = transactionCalls.find(
        (c) =>
          c.model === 'inventory' &&
          c.method === 'update' &&
          (c.args as { where: { userId: string } }).where.userId === inviterId
      );
      expect(inviterInventoryUpdate).toBeDefined();
      expect(inviterInventoryUpdate!.args).toEqual({
        where: { userId: inviterId },
        data: {
          gold: { increment: REFERRAL_REWARDS.inviter.gold },
          dust: { increment: REFERRAL_REWARDS.inviter.dust },
        },
      });

      // Verify invitee inventory update
      const inviteeInventoryUpdate = transactionCalls.find(
        (c) =>
          c.model === 'inventory' &&
          c.method === 'update' &&
          (c.args as { where: { userId: string } }).where.userId === inviteeId
      );
      expect(inviteeInventoryUpdate).toBeDefined();
      expect(inviteeInventoryUpdate!.args).toEqual({
        where: { userId: inviteeId },
        data: {
          gold: { increment: REFERRAL_REWARDS.invitee.gold },
          dust: { increment: REFERRAL_REWARDS.invitee.dust },
        },
      });
    });

    it('should normalize code to uppercase (case-insensitive matching)', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: inviteeId, referredById: null }) // invitee lookup
        .mockResolvedValueOnce({ id: inviterId }); // inviter lookup

      await applyReferralCode(inviteeId, 'abcd1234');

      // Should have searched with uppercase code
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { referralCode: 'ABCD1234' },
        select: { id: true },
      });
    });
  });
});
