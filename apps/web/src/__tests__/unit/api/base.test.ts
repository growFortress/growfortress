/**
 * Base API module tests
 *
 * Tests for request handling, token refresh, error handling, and retries.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMockResponse,
  createErrorResponse,
  create401Response,
  createTokenRefreshResponse,
  createNoContentResponse,
  createNetworkError,
} from '../../mocks/api.js';

// Mock the config
vi.mock('../../../config.js', () => ({
  CONFIG: {
    API_URL: 'http://localhost:3000',
  },
}));

// Mock auth module
const mockGetAccessToken = vi.fn();
const mockSetAuthData = vi.fn();
const mockClearTokens = vi.fn();

vi.mock('../../../api/auth.js', () => ({
  getAccessToken: () => mockGetAccessToken(),
  setAuthData: (...args: unknown[]) => mockSetAuthData(...args),
  clearTokens: () => mockClearTokens(),
}));

// Import after mocks
import { request, tryRefreshToken, ApiError, createDomainError } from '../../../api/base.js';

describe('Base API Module', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
    mockGetAccessToken.mockReturnValue('test-access-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ApiError', () => {
    it('should create error with all properties', () => {
      const error = new ApiError(400, 'Bad request', 'BAD_REQUEST', { field: 'email' });

      expect(error).toBeInstanceOf(Error);
      expect(error.status).toBe(400);
      expect(error.message).toBe('Bad request');
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.data).toEqual({ field: 'email' });
      expect(error.name).toBe('ApiError');
    });

    it('should work without optional properties', () => {
      const error = new ApiError(500, 'Server error');

      expect(error.status).toBe(500);
      expect(error.message).toBe('Server error');
      expect(error.code).toBeUndefined();
      expect(error.data).toBeUndefined();
    });
  });

  describe('createDomainError', () => {
    it('should create a domain-specific error class', () => {
      const PvpApiError = createDomainError('PvpApiError');
      const error = new PvpApiError(403, 'Not allowed', 'PVP_FORBIDDEN');

      expect(error).toBeInstanceOf(ApiError);
      expect(error.name).toBe('PvpApiError');
      expect(error.status).toBe(403);
      expect(error.message).toBe('Not allowed');
      expect(error.code).toBe('PVP_FORBIDDEN');
    });
  });

  describe('request', () => {
    it('should make a GET request with authorization header', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ data: 'test' }));

      const result = await request('/v1/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-access-token',
          }),
          credentials: 'include',
        })
      );
      expect(result).toEqual({ data: 'test' });
    });

    it('should make a POST request with JSON body', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ success: true }));

      await request('/v1/test', {
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'test' }),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-access-token',
          }),
        })
      );
    });

    it('should skip auth header when skipAuth is true', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ data: 'test' }));

      await request('/v1/public', { skipAuth: true });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/public',
        expect.objectContaining({
          headers: expect.not.objectContaining({
            Authorization: expect.anything(),
          }),
        })
      );
    });

    it('should not add auth header when no token exists', async () => {
      mockGetAccessToken.mockReturnValue(null);
      mockFetch.mockResolvedValue(createMockResponse({ data: 'test' }));

      await request('/v1/test');

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[1].headers.Authorization).toBeUndefined();
    });

    it('should handle 204 No Content responses', async () => {
      mockFetch.mockResolvedValue(createNoContentResponse());

      const result = await request('/v1/test', { method: 'DELETE' });

      expect(result).toEqual({});
    });

    it('should handle non-JSON responses', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse('OK', { contentType: 'text/plain' })
      );

      const result = await request('/v1/test');

      expect(result).toEqual({});
    });

    it('should throw ApiError on error response', async () => {
      mockFetch.mockResolvedValue(
        createErrorResponse(400, 'Validation failed', 'VALIDATION_ERROR', { field: 'email' })
      );

      await expect(request('/v1/test')).rejects.toThrow(ApiError);

      try {
        await request('/v1/test');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(400);
        expect((error as ApiError).message).toBe('Validation failed');
        expect((error as ApiError).code).toBe('VALIDATION_ERROR');
      }
    });

    it('should use default error message when response has no error field', async () => {
      const response = createMockResponse({}, { status: 500, ok: false });
      mockFetch.mockResolvedValue(response);

      try {
        await request('/v1/test');
      } catch (error) {
        expect((error as ApiError).message).toBe('Request failed');
      }
    });

    it('should handle JSON parse errors gracefully', async () => {
      const response = {
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as unknown as Response;
      mockFetch.mockResolvedValue(response);

      try {
        await request('/v1/test');
      } catch (error) {
        expect((error as ApiError).message).toBe('Request failed');
      }
    });

    it('should pass through custom credentials option', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ data: 'test' }));

      await request('/v1/test', { credentials: 'omit' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          credentials: 'omit',
        })
      );
    });

    it('should merge custom headers with default headers', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ data: 'test' }));

      await request('/v1/test', {
        headers: { 'X-Custom-Header': 'custom-value' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom-Header': 'custom-value',
            Authorization: 'Bearer test-access-token',
          }),
        })
      );
    });
  });

  describe('request - token refresh on 401', () => {
    it('should retry request after successful token refresh', async () => {
      // First call returns 401, refresh succeeds, second call succeeds
      mockFetch
        .mockResolvedValueOnce(create401Response())
        .mockResolvedValueOnce(createTokenRefreshResponse('new-token', 'TestUser'))
        .mockResolvedValueOnce(createMockResponse({ data: 'success' }));

      const result = await request('/v1/protected');

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockSetAuthData).toHaveBeenCalledWith('new-token', undefined, 'TestUser');
      expect(result).toEqual({ data: 'success' });
    });

    it('should not retry on 401 when skipAuthRefresh is true', async () => {
      mockFetch.mockResolvedValue(create401Response());

      await expect(request('/v1/test', { skipAuthRefresh: true })).rejects.toThrow(ApiError);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry when retry is false (already retried)', async () => {
      mockFetch
        .mockResolvedValueOnce(create401Response())
        .mockResolvedValueOnce(createTokenRefreshResponse())
        .mockResolvedValueOnce(create401Response()); // Second request also fails

      // The third call (retry) should fail without further retry
      await expect(request('/v1/protected')).rejects.toThrow(ApiError);

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should throw error when token refresh fails', async () => {
      mockFetch
        .mockResolvedValueOnce(create401Response())
        .mockResolvedValueOnce(createErrorResponse(401, 'Refresh failed'));

      await expect(request('/v1/protected')).rejects.toThrow(ApiError);

      expect(mockClearTokens).toHaveBeenCalled();
    });

    it('should not refresh on non-401 errors', async () => {
      mockFetch.mockResolvedValue(createErrorResponse(403, 'Forbidden'));

      await expect(request('/v1/test')).rejects.toThrow(ApiError);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('tryRefreshToken', () => {
    it('should successfully refresh token', async () => {
      mockFetch.mockResolvedValue(createTokenRefreshResponse('fresh-token', 'User'));

      const result = await tryRefreshToken();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/auth/refresh',
        {
          method: 'POST',
          credentials: 'include',
        }
      );
      expect(mockSetAuthData).toHaveBeenCalledWith('fresh-token', undefined, 'User');
    });

    it('should return false on refresh failure', async () => {
      mockFetch.mockResolvedValue(createErrorResponse(401, 'Invalid refresh token'));

      const result = await tryRefreshToken();

      expect(result).toBe(false);
      expect(mockClearTokens).toHaveBeenCalled();
    });

    it('should return false on network error', async () => {
      mockFetch.mockRejectedValue(createNetworkError());

      const result = await tryRefreshToken();

      expect(result).toBe(false);
      expect(mockClearTokens).toHaveBeenCalled();
    });

    it('should use singleton pattern for concurrent refresh requests', async () => {
      // Create a delayed response to simulate slow network
      let resolveRefresh: (value: Response) => void;
      const refreshPromise = new Promise<Response>((resolve) => {
        resolveRefresh = resolve;
      });
      mockFetch.mockReturnValue(refreshPromise);

      // Start multiple concurrent refresh requests
      const refresh1 = tryRefreshToken();
      const refresh2 = tryRefreshToken();
      const refresh3 = tryRefreshToken();

      // Resolve the refresh
      resolveRefresh!(createTokenRefreshResponse());

      // All should resolve to the same result
      const [result1, result2, result3] = await Promise.all([refresh1, refresh2, refresh3]);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);
      // Only one fetch call should have been made
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should allow new refresh after previous completes', async () => {
      mockFetch.mockResolvedValue(createTokenRefreshResponse());

      await tryRefreshToken();
      await tryRefreshToken();

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
