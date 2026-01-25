/**
 * API Client tests
 *
 * Tests for authentication, profile, sessions, upgrades, and other client functions.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMockAuthResponse,
  createMockProfile,
  createMockSession,
  createMockActiveSession,
} from '../../mocks/data.js';

// Mock config
vi.mock('../../../config.js', () => ({
  CONFIG: {
    API_URL: 'http://localhost:3000',
  },
}));

// Mock auth module
const mockSetAuthData = vi.fn();
const mockClearTokens = vi.fn();
const mockSetGuestModeStorage = vi.fn();
const mockClearGuestModeStorage = vi.fn();

vi.mock('../../../api/auth.js', () => ({
  getAccessToken: vi.fn(() => 'mock-token'),
  setAuthData: (...args: unknown[]) => mockSetAuthData(...args),
  clearTokens: () => mockClearTokens(),
  setGuestModeStorage: (value: boolean) => mockSetGuestModeStorage(value),
  clearGuestModeStorage: () => mockClearGuestModeStorage(),
}));

// Mock base request
const mockRequest = vi.fn();
vi.mock('../../../api/base.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../api/base.js')>();
  return {
    ...original,
    request: (...args: unknown[]) => mockRequest(...args),
  };
});

// Mock state reset
const mockResetAllState = vi.fn();
vi.mock('../../../state/index.js', () => ({
  resetAllState: () => mockResetAllState(),
}));

// Mock referral utils
const mockGetReferralCode = vi.fn();
const mockClearReferralCode = vi.fn();
vi.mock('../../../utils/referral.js', () => ({
  getReferralCode: () => mockGetReferralCode(),
  clearReferralCode: () => mockClearReferralCode(),
}));

// Import after mocks
import {
  register,
  login,
  logout,
  refreshTokensApi,
  forgotPassword,
  resetPassword,
  createGuestSession,
  convertGuestToUser,
  getProfile,
  getReferralStatus,
  updatePreferredCurrency,
  getLeaderboard,
  startSession,
  getActiveSession,
  submitSegment,
  refreshSessionToken,
  endSession,
  upgradeHero,
  upgradeTurret,
  ApiError,
} from '../../../api/client.js';

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetReferralCode.mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // AUTHENTICATION
  // ==========================================================================

  describe('register', () => {
    it('should register a new user', async () => {
      const mockResponse = createMockAuthResponse({
        accessToken: 'new-token',
        userId: 'new-user-123',
        displayName: 'NewUser',
      });
      mockRequest.mockResolvedValue(mockResponse);

      const result = await register({
        username: 'newuser',
        password: 'password123',
        email: 'new@example.com',
      });

      expect(mockRequest).toHaveBeenCalledWith(
        '/v1/auth/register',
        expect.objectContaining({
          method: 'POST',
          skipAuth: true,
          skipAuthRefresh: true,
        })
      );
      expect(mockSetAuthData).toHaveBeenCalledWith('new-token', 'new-user-123', 'NewUser');
      expect(result).toEqual(mockResponse);
    });

    it('should use stored referral code if present', async () => {
      mockGetReferralCode.mockReturnValue('REFERRAL123');
      mockRequest.mockResolvedValue(createMockAuthResponse());

      await register({ username: 'user', password: 'pass' });

      expect(mockRequest).toHaveBeenCalledWith(
        '/v1/auth/register',
        expect.objectContaining({
          body: expect.stringContaining('REFERRAL123'),
        })
      );
      expect(mockClearReferralCode).toHaveBeenCalled();
    });

    it('should prefer provided referral code over stored one', async () => {
      mockGetReferralCode.mockReturnValue('STORED123');
      mockRequest.mockResolvedValue(createMockAuthResponse());

      await register({ username: 'user', password: 'pass', referralCode: 'PROVIDED456' });

      const callArgs = mockRequest.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.referralCode).toBe('PROVIDED456');
    });
  });

  describe('login', () => {
    it('should log in and set auth data', async () => {
      const mockResponse = createMockAuthResponse();
      mockRequest.mockResolvedValue(mockResponse);

      const result = await login({ username: 'user', password: 'pass' });

      expect(mockRequest).toHaveBeenCalledWith(
        '/v1/auth/login',
        expect.objectContaining({
          method: 'POST',
          skipAuth: true,
          skipAuthRefresh: true,
        })
      );
      expect(mockSetAuthData).toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });
  });

  describe('logout', () => {
    it('should logout and clear state', async () => {
      mockRequest.mockResolvedValue({ message: 'Logged out' });

      await logout();

      expect(mockRequest).toHaveBeenCalledWith(
        '/v1/auth/logout',
        expect.objectContaining({
          method: 'POST',
          skipAuth: true,
          skipAuthRefresh: true,
        })
      );
      expect(mockResetAllState).toHaveBeenCalled();
      expect(mockClearTokens).toHaveBeenCalled();
    });

    it('should clear state even if logout request fails', async () => {
      mockRequest.mockRejectedValue(new Error('Network error'));

      await logout();

      expect(mockResetAllState).toHaveBeenCalled();
      expect(mockClearTokens).toHaveBeenCalled();
    });
  });

  describe('refreshTokensApi', () => {
    it('should refresh tokens and update auth data', async () => {
      const mockResponse = { accessToken: 'new-token', displayName: 'User' };
      mockRequest.mockResolvedValue(mockResponse);

      const result = await refreshTokensApi();

      expect(mockRequest).toHaveBeenCalledWith(
        '/v1/auth/refresh',
        expect.objectContaining({
          method: 'POST',
          skipAuth: true,
          skipAuthRefresh: true,
        })
      );
      expect(mockSetAuthData).toHaveBeenCalledWith('new-token', undefined, 'User');
      expect(result).toEqual(mockResponse);
    });

    it('should return null and clear tokens on 401', async () => {
      const error = new ApiError(401, 'Unauthorized');
      mockRequest.mockRejectedValue(error);

      const result = await refreshTokensApi();

      expect(result).toBeNull();
      expect(mockClearTokens).toHaveBeenCalled();
    });

    it('should throw non-401 errors', async () => {
      const error = new ApiError(500, 'Server error');
      mockRequest.mockRejectedValue(error);

      await expect(refreshTokensApi()).rejects.toThrow(ApiError);
    });
  });

  describe('forgotPassword', () => {
    it('should send forgot password request', async () => {
      mockRequest.mockResolvedValue({ message: 'Email sent' });

      const result = await forgotPassword({ email: 'user@example.com' });

      expect(mockRequest).toHaveBeenCalledWith(
        '/v1/auth/forgot-password',
        expect.objectContaining({
          method: 'POST',
          skipAuth: true,
        })
      );
      expect(result).toEqual({ message: 'Email sent' });
    });
  });

  describe('resetPassword', () => {
    it('should reset password with token', async () => {
      mockRequest.mockResolvedValue({ message: 'Password reset' });

      const result = await resetPassword({ token: 'reset-token', password: 'newpass' });

      expect(mockRequest).toHaveBeenCalledWith(
        '/v1/auth/reset-password',
        expect.objectContaining({
          method: 'POST',
          skipAuth: true,
        })
      );
      expect(result).toEqual({ message: 'Password reset' });
    });
  });

  // ==========================================================================
  // GUEST MODE
  // ==========================================================================

  describe('createGuestSession', () => {
    it('should create guest session and set guest mode', async () => {
      const mockResponse = {
        accessToken: 'guest-token',
        userId: 'guest-123',
        displayName: 'Guest',
        expiresAt: Date.now() + 86400000,
        isGuest: true,
      };
      mockRequest.mockResolvedValue(mockResponse);

      const result = await createGuestSession();

      expect(mockRequest).toHaveBeenCalledWith(
        '/v1/auth/guest',
        expect.objectContaining({
          method: 'POST',
          skipAuth: true,
        })
      );
      expect(mockSetAuthData).toHaveBeenCalledWith('guest-token', 'guest-123', 'Guest');
      expect(mockSetGuestModeStorage).toHaveBeenCalledWith(true);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('convertGuestToUser', () => {
    it('should convert guest to user and clear guest mode', async () => {
      const mockResponse = {
        accessToken: 'user-token',
        userId: 'user-123',
        displayName: 'RealUser',
        expiresAt: Date.now() + 86400000,
        isGuest: false,
      };
      mockRequest.mockResolvedValue(mockResponse);

      const result = await convertGuestToUser({
        username: 'realuser',
        password: 'password123',
      });

      expect(mockRequest).toHaveBeenCalledWith(
        '/v1/auth/convert-guest',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(mockSetAuthData).toHaveBeenCalledWith('user-token', 'user-123', 'RealUser');
      expect(mockClearGuestModeStorage).toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });
  });

  // ==========================================================================
  // PROFILE
  // ==========================================================================

  describe('getProfile', () => {
    it('should fetch user profile', async () => {
      const mockProfile = createMockProfile();
      mockRequest.mockResolvedValue(mockProfile);

      const result = await getProfile();

      expect(mockRequest).toHaveBeenCalledWith('/v1/profile');
      expect(result).toEqual(mockProfile);
    });
  });

  describe('getReferralStatus', () => {
    it('should fetch referral status', async () => {
      const mockStatus = { referralCode: 'ABC123', inviteCount: 5 };
      mockRequest.mockResolvedValue(mockStatus);

      const result = await getReferralStatus();

      expect(mockRequest).toHaveBeenCalledWith('/v1/referrals');
      expect(result).toEqual(mockStatus);
    });
  });

  describe('updatePreferredCurrency', () => {
    it('should update preferred currency', async () => {
      mockRequest.mockResolvedValue({ preferredCurrency: 'USD' });

      await updatePreferredCurrency('USD');

      expect(mockRequest).toHaveBeenCalledWith(
        '/v1/profile/currency',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ currency: 'USD' }),
        })
      );
    });
  });

  // ==========================================================================
  // LEADERBOARD
  // ==========================================================================

  describe('getLeaderboard', () => {
    it('should fetch leaderboard with default limit', async () => {
      const mockLeaderboard = { entries: [], week: '2026-W04' };
      mockRequest.mockResolvedValue(mockLeaderboard);

      await getLeaderboard();

      expect(mockRequest).toHaveBeenCalledWith('/v1/leaderboards/weekly?limit=10');
    });

    it('should fetch leaderboard with custom week and limit', async () => {
      mockRequest.mockResolvedValue({ entries: [] });

      await getLeaderboard('2026-W03', 50);

      expect(mockRequest).toHaveBeenCalledWith('/v1/leaderboards/weekly?week=2026-W03&limit=50');
    });
  });

  // ==========================================================================
  // SESSIONS
  // ==========================================================================

  describe('startSession', () => {
    it('should start a new session', async () => {
      const mockSession = createMockSession();
      mockRequest.mockResolvedValue(mockSession);

      const result = await startSession({ pillarId: 'streets' });

      expect(mockRequest).toHaveBeenCalledWith(
        '/v1/sessions/start',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ pillarId: 'streets' }),
        })
      );
      expect(result).toEqual(mockSession);
    });

    it('should start session with empty options', async () => {
      mockRequest.mockResolvedValue(createMockSession());

      await startSession();

      expect(mockRequest).toHaveBeenCalledWith(
        '/v1/sessions/start',
        expect.objectContaining({
          body: JSON.stringify({}),
        })
      );
    });
  });

  describe('getActiveSession', () => {
    it('should fetch active session', async () => {
      const mockActive = createMockActiveSession();
      mockRequest.mockResolvedValue(mockActive);

      const result = await getActiveSession();

      expect(mockRequest).toHaveBeenCalledWith('/v1/sessions/active');
      expect(result).toEqual(mockActive);
    });

    it('should return null on 404', async () => {
      const error = new ApiError(404, 'No active session');
      mockRequest.mockRejectedValue(error);

      const result = await getActiveSession();

      expect(result).toBeNull();
    });

    it('should throw non-404 errors', async () => {
      const error = new ApiError(500, 'Server error');
      mockRequest.mockRejectedValue(error);

      await expect(getActiveSession()).rejects.toThrow(ApiError);
    });
  });

  describe('submitSegment', () => {
    it('should submit segment data', async () => {
      const mockResponse = { verified: true, goldEarned: 100 };
      mockRequest.mockResolvedValue(mockResponse);

      const result = await submitSegment('session-123', {
        sessionToken: 'token',
        startWave: 0,
        endWave: 10,
        events: [],
        checkpoints: [{ tick: 100, hash32: 123, chainHash32: 456 }],
        finalHash: 987654321,
      });

      expect(mockRequest).toHaveBeenCalledWith(
        '/v1/sessions/session-123/segment',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should encode session ID in URL', async () => {
      mockRequest.mockResolvedValue({});

      await submitSegment('session/with/slashes', {
        sessionToken: 't',
        startWave: 0,
        endWave: 1,
        events: [],
        checkpoints: [],
        finalHash: 0,
      });

      expect(mockRequest).toHaveBeenCalledWith(
        '/v1/sessions/session%2Fwith%2Fslashes/segment',
        expect.anything()
      );
    });
  });

  describe('refreshSessionToken', () => {
    it('should refresh session token', async () => {
      mockRequest.mockResolvedValue({ sessionToken: 'new-token' });

      const result = await refreshSessionToken('session-123', 'old-token');

      expect(mockRequest).toHaveBeenCalledWith(
        '/v1/sessions/session-123/refresh-token',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ sessionToken: 'old-token' }),
        })
      );
      expect(result).toEqual({ sessionToken: 'new-token' });
    });
  });

  describe('endSession', () => {
    it('should end session with reason', async () => {
      const mockResponse = { rewards: { gold: 500, xp: 100 } };
      mockRequest.mockResolvedValue(mockResponse);

      const result = await endSession('session-123', 'completed');

      expect(mockRequest).toHaveBeenCalledWith(
        '/v1/sessions/session-123/end',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ reason: 'completed', partialRewards: undefined }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should end session with partial rewards', async () => {
      mockRequest.mockResolvedValue({});

      await endSession('session-123', 'quit', { gold: 100, dust: 10, xp: 50, finalWave: 5 });

      expect(mockRequest).toHaveBeenCalledWith(
        '/v1/sessions/session-123/end',
        expect.objectContaining({
          body: JSON.stringify({ reason: 'quit', partialRewards: { gold: 100, dust: 10, xp: 50, finalWave: 5 } }),
        })
      );
    });
  });

  // ==========================================================================
  // UPGRADES
  // ==========================================================================

  describe('upgradeHero', () => {
    it('should upgrade hero', async () => {
      const mockResponse = { success: true, newTier: 2 };
      mockRequest.mockResolvedValue(mockResponse);

      const result = await upgradeHero({ heroId: 'warrior', currentTier: 1 });

      expect(mockRequest).toHaveBeenCalledWith(
        '/v1/upgrades/hero',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ heroId: 'warrior', currentTier: 1 }),
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('upgradeTurret', () => {
    it('should upgrade turret', async () => {
      const mockResponse = { success: true, newTier: 2 };
      mockRequest.mockResolvedValue(mockResponse);

      const result = await upgradeTurret({ turretType: 'cannon', slotIndex: 0, currentTier: 1 });

      expect(mockRequest).toHaveBeenCalledWith(
        '/v1/upgrades/turret',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ turretType: 'cannon', slotIndex: 0, currentTier: 1 }),
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });
});
