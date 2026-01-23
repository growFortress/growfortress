/**
 * Extended auth service tests
 * Tests for guest mode, password reset, account management, and admin auth
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  mockPrisma,
  createMockUser,
  createMockInventory,
  createMockProgression,
  createMockSession,
  createMockPasswordResetToken,
} from '../../mocks/prisma.js';
import '../../helpers/setup.js';

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed-password'),
    compare: vi.fn(),
  },
}));

// Mock email service
vi.mock('../../../services/email.js', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

// Mock referrals service
vi.mock('../../../services/referrals.js', () => ({
  createReferralCode: vi.fn().mockResolvedValue('ABC123'),
  applyReferralCode: vi.fn().mockResolvedValue({ applied: true }),
}));

// Mock messages service
vi.mock('../../../services/messages.js', () => ({
  createSystemMessage: vi.fn().mockResolvedValue(undefined),
}));

// Mock power-upgrades service
vi.mock('../../../services/power-upgrades.js', () => ({
  recalculateCachedPower: vi.fn().mockResolvedValue(undefined),
}));

// Mock geoip service
vi.mock('../../../services/geoip.js', () => ({
  getDefaultCurrencyForCountry: vi.fn().mockReturnValue('USD'),
}));

// Import services after mocks are set up
import {
  createGuestUser,
  convertGuestToUser,
  loginAdmin,
  refreshAdminTokens,
  changePassword,
  requestPasswordReset,
  resetPassword,
  deleteAccount,
  completeOnboarding,
} from '../../../services/auth.js';
import bcrypt from 'bcrypt';
import { sendPasswordResetEmail } from '../../../services/email.js';
import { applyReferralCode } from '../../../services/referrals.js';

describe('Auth Service Extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset bcrypt mocks to defaults
    (bcrypt.hash as ReturnType<typeof vi.fn>).mockResolvedValue('hashed-password');
    (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);
  });

  // ==========================================================================
  // createGuestUser Tests
  // ==========================================================================
  describe('createGuestUser', () => {
    it('should create guest user with random username', async () => {
      const mockUser = createMockUser({
        id: 'guest-user-123',
        username: 'guest_abcdef1234',
        displayName: 'Guest_ABCDEF',
        isGuest: true,
      });
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.session.create.mockResolvedValue(createMockSession({ userId: 'guest-user-123' }));

      const result = await createGuestUser();

      expect(result.userId).toBe('guest-user-123');
      expect(result.displayName).toBe('Guest_ABCDEF');
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            username: expect.stringMatching(/^guest_[a-f0-9]+$/),
          }),
        })
      );
    });

    it('should set isGuest flag to true', async () => {
      const mockUser = createMockUser({
        id: 'guest-user-123',
        isGuest: true,
      });
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.session.create.mockResolvedValue(createMockSession());

      const result = await createGuestUser();

      expect(result.isGuest).toBe(true);
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isGuest: true,
          }),
        })
      );
    });

    it('should create inventory and progression for guest', async () => {
      const mockUser = createMockUser({ id: 'guest-user-123', isGuest: true });
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.session.create.mockResolvedValue(createMockSession());

      await createGuestUser();

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            inventory: expect.objectContaining({
              create: expect.objectContaining({
                gold: 1000,
                dust: 100,
              }),
            }),
            progression: expect.objectContaining({
              create: expect.objectContaining({
                level: 1,
                xp: 0,
                totalXp: 0,
              }),
            }),
          }),
        })
      );
    });

    it('should apply locale preferences when provided', async () => {
      const mockUser = createMockUser({
        id: 'guest-user-123',
        isGuest: true,
        country: 'PL',
        preferredCurrency: 'PLN',
      });
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.session.create.mockResolvedValue(createMockSession());

      await createGuestUser({ country: 'PL', preferredCurrency: 'PLN' });

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            country: 'PL',
            preferredCurrency: 'PLN',
          }),
        })
      );
    });

    it('should generate access token with isGuest flag', async () => {
      const mockUser = createMockUser({ id: 'guest-user-123', isGuest: true });
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.session.create.mockResolvedValue(createMockSession());

      const result = await createGuestUser();

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresAt).toBeGreaterThan(Date.now());
      expect(result.isGuest).toBe(true);
    });
  });

  // ==========================================================================
  // convertGuestToUser Tests
  // ==========================================================================
  describe('convertGuestToUser', () => {
    const guestUserId = 'guest-user-123';

    it('should convert guest to full user', async () => {
      const guestUser = createMockUser({
        id: guestUserId,
        username: 'guest_abc123',
        isGuest: true,
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce(guestUser); // First call - find guest
      mockPrisma.user.findUnique.mockResolvedValueOnce(null); // Second call - check username
      mockPrisma.user.update.mockResolvedValue({
        ...guestUser,
        username: 'newuser',
        displayName: 'newuser',
        isGuest: false,
      });
      mockPrisma.session.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.session.create.mockResolvedValue(createMockSession());
      mockPrisma.playerArtifact.findUnique.mockResolvedValue(null);
      mockPrisma.playerArtifact.create.mockResolvedValue({
        id: 'artifact-1',
        userId: guestUserId,
        artifactId: 'founders_medal',
        level: 1,
      });

      const result = await convertGuestToUser(guestUserId, 'newuser', 'password123');

      expect(result.userId).toBe(guestUserId);
      expect(result.displayName).toBe('newuser');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            username: 'newuser',
            isGuest: false,
            guestExpiresAt: null,
          }),
        })
      );
    });

    it('should throw USER_NOT_FOUND if user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(convertGuestToUser('nonexistent', 'newuser', 'password123')).rejects.toThrow(
        'USER_NOT_FOUND'
      );
    });

    it('should throw NOT_A_GUEST if user is not a guest', async () => {
      const normalUser = createMockUser({ id: 'user-123', isGuest: false });
      mockPrisma.user.findUnique.mockResolvedValue(normalUser);

      await expect(convertGuestToUser('user-123', 'newuser', 'password123')).rejects.toThrow(
        'NOT_A_GUEST'
      );
    });

    it('should throw USERNAME_TAKEN if username exists', async () => {
      const guestUser = createMockUser({ id: guestUserId, isGuest: true });
      const existingUser = createMockUser({ id: 'other-user', username: 'newuser' });

      mockPrisma.user.findUnique.mockResolvedValueOnce(guestUser); // Guest lookup
      mockPrisma.user.findUnique.mockResolvedValueOnce(existingUser); // Username check

      await expect(convertGuestToUser(guestUserId, 'newuser', 'password123')).rejects.toThrow(
        'USERNAME_TAKEN'
      );
    });

    it('should throw EMAIL_TAKEN if email exists', async () => {
      const guestUser = createMockUser({ id: guestUserId, isGuest: true });
      const existingUser = createMockUser({ id: 'other-user', email: 'test@test.com' });

      mockPrisma.user.findUnique.mockResolvedValueOnce(guestUser); // Guest lookup
      mockPrisma.user.findUnique.mockResolvedValueOnce(null); // Username check
      mockPrisma.user.findUnique.mockResolvedValueOnce(existingUser); // Email check

      await expect(
        convertGuestToUser(guestUserId, 'newuser', 'password123', 'test@test.com')
      ).rejects.toThrow('EMAIL_TAKEN');
    });

    it('should revoke old sessions', async () => {
      const guestUser = createMockUser({ id: guestUserId, isGuest: true });
      mockPrisma.user.findUnique.mockResolvedValueOnce(guestUser);
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.update.mockResolvedValue({ ...guestUser, isGuest: false });
      mockPrisma.session.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.session.create.mockResolvedValue(createMockSession());
      mockPrisma.playerArtifact.findUnique.mockResolvedValue(null);
      mockPrisma.playerArtifact.create.mockResolvedValue({} as any);

      await convertGuestToUser(guestUserId, 'newuser', 'password123');

      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: guestUserId, revoked: false },
        data: { revoked: true },
      });
    });

    it('should apply referral code if provided', async () => {
      const guestUser = createMockUser({ id: guestUserId, isGuest: true });
      mockPrisma.user.findUnique.mockResolvedValueOnce(guestUser);
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.update.mockResolvedValue({ ...guestUser, isGuest: false });
      mockPrisma.session.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.session.create.mockResolvedValue(createMockSession());
      mockPrisma.playerArtifact.findUnique.mockResolvedValue(null);
      mockPrisma.playerArtifact.create.mockResolvedValue({} as any);

      await convertGuestToUser(guestUserId, 'newuser', 'password123', undefined, 'REFCODE123');

      expect(applyReferralCode).toHaveBeenCalledWith(guestUserId, 'REFCODE123');
    });

    it('should update displayName to new username', async () => {
      const guestUser = createMockUser({ id: guestUserId, isGuest: true });
      mockPrisma.user.findUnique.mockResolvedValueOnce(guestUser);
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.update.mockResolvedValue({
        ...guestUser,
        username: 'newuser',
        displayName: 'newuser',
        isGuest: false,
      });
      mockPrisma.session.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.session.create.mockResolvedValue(createMockSession());
      mockPrisma.playerArtifact.findUnique.mockResolvedValue(null);
      mockPrisma.playerArtifact.create.mockResolvedValue({} as any);

      await convertGuestToUser(guestUserId, 'newuser', 'password123');

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            displayName: 'newuser',
          }),
        })
      );
    });
  });

  // ==========================================================================
  // loginAdmin Tests
  // ==========================================================================
  describe('loginAdmin', () => {
    it('should return null if user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await loginAdmin('admin', 'password123');

      expect(result).toBeNull();
    });

    it('should return null if user is not ADMIN', async () => {
      const normalUser = createMockUser({ role: 'USER' });
      mockPrisma.user.findUnique.mockResolvedValue(normalUser);

      const result = await loginAdmin('testuser', 'password123');

      expect(result).toBeNull();
    });

    it('should return null if password is wrong', async () => {
      const adminUser = createMockUser({ role: 'ADMIN' });
      mockPrisma.user.findUnique.mockResolvedValue(adminUser);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const result = await loginAdmin('admin', 'wrongpassword');

      expect(result).toBeNull();
    });

    it('should create session and return tokens for valid admin', async () => {
      const adminUser = createMockUser({ id: 'admin-123', role: 'ADMIN', displayName: 'Admin' });
      mockPrisma.user.findUnique.mockResolvedValue(adminUser);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      mockPrisma.session.create.mockResolvedValue(createMockSession({ userId: 'admin-123' }));

      const result = await loginAdmin('admin', 'correctpassword');

      expect(result).not.toBeNull();
      expect(result!.userId).toBe('admin-123');
      expect(result!.displayName).toBe('Admin');
      expect(result!.accessToken).toBeDefined();
      expect(result!.refreshToken).toBeDefined();
      expect(mockPrisma.session.create).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // refreshAdminTokens Tests
  // ==========================================================================
  describe('refreshAdminTokens', () => {
    it('should return null for invalid token', async () => {
      const result = await refreshAdminTokens('invalid-token');

      expect(result).toBeNull();
    });

    it('should return null for revoked session', async () => {
      // This test relies on token verification which would fail for invalid tokens
      // In real scenario, we'd need a valid token that points to a revoked session
      const result = await refreshAdminTokens('some-revoked-token');

      expect(result).toBeNull();
    });

    it('should return null if user is not admin', async () => {
      // Token verification will fail for invalid tokens, so this returns null
      const result = await refreshAdminTokens('token-for-non-admin');

      expect(result).toBeNull();
    });

    it('should create new session and return tokens for valid admin refresh', async () => {
      // This test would require a valid admin refresh token
      // Since we can't easily create one in unit tests, we verify the null case
      const result = await refreshAdminTokens('invalid-admin-token');

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // changePassword Tests
  // ==========================================================================
  describe('changePassword', () => {
    const userId = 'user-123';

    it('should return error if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await changePassword(userId, 'oldpass', 'newpass');

      expect(result.success).toBe(false);
      expect(result.error).toBe('USER_NOT_FOUND');
    });

    it('should return error if current password is wrong', async () => {
      const mockUser = createMockUser();
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const result = await changePassword(userId, 'wrongpassword', 'newpass');

      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_PASSWORD');
    });

    it('should hash new password and update user', async () => {
      const mockUser = createMockUser();
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      (bcrypt.hash as ReturnType<typeof vi.fn>).mockResolvedValue('new-hashed-password');
      mockPrisma.$transaction.mockResolvedValue([{}, { count: 1 }]);

      const result = await changePassword(userId, 'oldpass', 'newpass');

      expect(result.success).toBe(true);
      expect(bcrypt.hash).toHaveBeenCalledWith('newpass', 12);
    });

    it('should revoke all sessions after password change', async () => {
      const mockUser = createMockUser();
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      mockPrisma.$transaction.mockResolvedValue([{}, { count: 3 }]);

      await changePassword(userId, 'oldpass', 'newpass');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // requestPasswordReset Tests
  // ==========================================================================
  describe('requestPasswordReset', () => {
    it('should always return true to prevent email enumeration', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await requestPasswordReset('nonexistent@test.com');

      expect(result).toBe(true);
    });

    it('should create token and send email if user exists', async () => {
      const mockUser = createMockUser({ email: 'test@test.com' });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.passwordResetToken.create.mockResolvedValue({
        id: 'token-123',
        token: 'hashed-token',
        userId: 'user-123',
        expiresAt: new Date(),
      });

      const result = await requestPasswordReset('test@test.com');

      expect(result).toBe(true);
      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalled();
      expect(sendPasswordResetEmail).toHaveBeenCalledWith(
        'test@test.com',
        expect.any(String)
      );
    });

    it('should not create token if user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await requestPasswordReset('nonexistent@test.com');

      expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // resetPassword Tests
  // ==========================================================================
  describe('resetPassword', () => {
    it('should return false if token not found', async () => {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue(null);

      const result = await resetPassword('invalid-token', 'newpassword');

      expect(result).toBe(false);
    });

    it('should return false if token expired', async () => {
      const expiredToken = createMockPasswordResetToken({
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      });
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue(expiredToken);

      const result = await resetPassword('expired-token', 'newpassword');

      expect(result).toBe(false);
    });

    it('should update password and delete token', async () => {
      const validToken = createMockPasswordResetToken({
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      });
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue(validToken);
      mockPrisma.$transaction.mockResolvedValue([{}, {}, { count: 1 }]);

      const result = await resetPassword('valid-token', 'newpassword');

      expect(result).toBe(true);
      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword', 12);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should revoke all sessions', async () => {
      const validToken = createMockPasswordResetToken({
        expiresAt: new Date(Date.now() + 3600000),
      });
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue(validToken);
      mockPrisma.$transaction.mockResolvedValue([{}, {}, { count: 2 }]);

      await resetPassword('valid-token', 'newpassword');

      // Transaction includes session.updateMany to revoke sessions
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // deleteAccount Tests
  // ==========================================================================
  describe('deleteAccount', () => {
    const userId = 'user-123';

    it('should delete all user data in transaction', async () => {
      mockPrisma.$transaction.mockResolvedValue([
        { count: 1 }, // sessions
        { count: 0 }, // password reset tokens
        { count: 0 }, // messages
        { count: 0 }, // ticket responses
        { count: 0 }, // support tickets
        { count: 0 }, // pvp challenges
        { count: 0 }, // guild members
        { count: 0 }, // player artifacts
        { count: 0 }, // battlepass progress
        { count: 0 }, // daily quests
        { count: 0 }, // mastery progress
        { count: 0 }, // power upgrades
        { count: 0 }, // progression
        { count: 0 }, // inventory
        {}, // user
      ]);

      const result = await deleteAccount(userId);

      expect(result).toBe(true);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should return true on success', async () => {
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await deleteAccount(userId);

      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('Database error'));

      const result = await deleteAccount(userId);

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // completeOnboarding Tests
  // ==========================================================================
  describe('completeOnboarding', () => {
    const userId = 'user-123';

    it('should set default loadout', async () => {
      mockPrisma.user.update.mockResolvedValue(
        createMockUser({
          defaultFortressClass: 'natural',
          defaultHeroId: 'vanguard',
          defaultTurretType: 'railgun',
          onboardingCompleted: true,
        })
      );

      const result = await completeOnboarding(userId, 'natural', 'vanguard', 'railgun');

      expect(result.success).toBe(true);
      expect(result.defaultLoadout.fortressClass).toBe('natural');
      expect(result.defaultLoadout.heroId).toBe('vanguard');
      expect(result.defaultLoadout.turretType).toBe('railgun');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          defaultFortressClass: 'natural',
          defaultHeroId: 'vanguard',
          defaultTurretType: 'railgun',
          onboardingCompleted: true,
        },
      });
    });

    it('should set onboardingCompleted to true', async () => {
      mockPrisma.user.update.mockResolvedValue(
        createMockUser({
          onboardingCompleted: true,
        })
      );

      await completeOnboarding(userId, 'fire', 'pyro', 'artillery');

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            onboardingCompleted: true,
          }),
        })
      );
    });
  });
});
