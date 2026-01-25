/**
 * Auth plugin unit tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance, FastifyRequest } from 'fastify';
import { mockPrisma, createMockUser } from '../../mocks/prisma.js';

// Use vi.hoisted to define mocks before vi.mock is hoisted
const mocks = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(),
  verifyAdminAccessToken: vi.fn(),
  resetTokenSecrets: vi.fn(),
}));

vi.mock('../../../lib/tokens.js', () => mocks);

// Import auth plugin after mocking
import authPlugin from '../../../plugins/auth.js';

describe('Auth Plugin', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    await app.register(authPlugin);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('request decoration', () => {
    it('should decorate request with userId undefined by default', async () => {
      let capturedRequest: FastifyRequest | null = null;

      app.get('/test', { config: { public: true } }, async (request: FastifyRequest) => {
        capturedRequest = request;
        return { ok: true };
      });

      await app.ready();
      await app.inject({ method: 'GET', url: '/test' });

      expect(capturedRequest).not.toBeNull();
      expect(capturedRequest!.userId).toBeUndefined();
    });

    it('should decorate request with isAdmin false by default', async () => {
      let capturedRequest: FastifyRequest | null = null;

      app.get('/test', { config: { public: true } }, async (request: FastifyRequest) => {
        capturedRequest = request;
        return { ok: true };
      });

      await app.ready();
      await app.inject({ method: 'GET', url: '/test' });

      expect(capturedRequest!.isAdmin).toBe(false);
    });

    it('should decorate request with isGuest false by default', async () => {
      let capturedRequest: FastifyRequest | null = null;

      app.get('/test', { config: { public: true } }, async (request: FastifyRequest) => {
        capturedRequest = request;
        return { ok: true };
      });

      await app.ready();
      await app.inject({ method: 'GET', url: '/test' });

      expect(capturedRequest!.isGuest).toBe(false);
    });
  });

  describe('public routes', () => {
    it('should skip auth for routes marked as public', async () => {
      app.get('/public-route', { config: { public: true } }, async () => {
        return { message: 'public' };
      });

      await app.ready();
      const response = await app.inject({
        method: 'GET',
        url: '/public-route',
      });

      expect(response.statusCode).toBe(200);
      expect(mocks.verifyAccessToken).not.toHaveBeenCalled();
    });

    it('should skip auth for health endpoint', async () => {
      app.get('/health', async () => {
        return { status: 'ok' };
      });

      await app.ready();
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      expect(mocks.verifyAccessToken).not.toHaveBeenCalled();
    });

    it('should skip auth for health sub-endpoints', async () => {
      app.get('/health/db', async () => {
        return { status: 'ok' };
      });

      await app.ready();
      const response = await app.inject({
        method: 'GET',
        url: '/health/db',
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('authorization header validation', () => {
    it('should return 401 when authorization header is missing', async () => {
      app.get('/protected', async () => {
        return { ok: true };
      });

      await app.ready();
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.payload)).toEqual({
        error: 'Missing authorization header',
      });
    });

    it('should return 401 when authorization header does not start with Bearer', async () => {
      app.get('/protected', async () => {
        return { ok: true };
      });

      await app.ready();
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Basic sometoken',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.payload)).toEqual({
        error: 'Missing authorization header',
      });
    });
  });

  describe('token verification', () => {
    it('should return 401 when token is invalid', async () => {
      mocks.verifyAccessToken.mockResolvedValue(null);

      app.get('/protected', async () => {
        return { ok: true };
      });

      await app.ready();
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.payload)).toEqual({
        error: 'Invalid or expired token',
      });
    });

    it('should return 401 when user is not found', async () => {
      mocks.verifyAccessToken.mockResolvedValue({ sub: 'user-123' });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      app.get('/protected', async () => {
        return { ok: true };
      });

      await app.ready();
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.payload)).toEqual({
        error: 'Invalid or expired token',
      });
    });

    it('should set userId on request when token is valid', async () => {
      mocks.verifyAccessToken.mockResolvedValue({ sub: 'user-123' });
      mockPrisma.user.findUnique.mockResolvedValue(
        createMockUser({ id: 'user-123', role: 'USER', banned: false })
      );

      let capturedUserId: string | undefined;

      app.get('/protected', async (request: FastifyRequest) => {
        capturedUserId = request.userId;
        return { ok: true };
      });

      await app.ready();
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(capturedUserId).toBe('user-123');
    });
  });

  describe('banned users', () => {
    it('should return 403 when user is banned', async () => {
      mocks.verifyAccessToken.mockResolvedValue({ sub: 'user-123' });
      mockPrisma.user.findUnique.mockResolvedValue(
        createMockUser({ id: 'user-123', role: 'USER', banned: true })
      );

      app.get('/protected', async () => {
        return { ok: true };
      });

      await app.ready();
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload)).toEqual({
        error: 'User is banned',
      });
    });
  });

  describe('admin routes', () => {
    it('should use verifyAdminAccessToken for admin routes', async () => {
      mocks.verifyAdminAccessToken.mockResolvedValue({ sub: 'admin-123' });
      mockPrisma.user.findUnique.mockResolvedValue(
        createMockUser({ id: 'admin-123', role: 'ADMIN', banned: false })
      );

      app.get('/admin/dashboard', async () => {
        return { ok: true };
      });

      await app.ready();
      await app.inject({
        method: 'GET',
        url: '/admin/dashboard',
        headers: {
          authorization: 'Bearer admin-token',
        },
      });

      expect(mocks.verifyAdminAccessToken).toHaveBeenCalledWith('admin-token');
      expect(mocks.verifyAccessToken).not.toHaveBeenCalled();
    });

    it('should return 403 when non-admin accesses admin route', async () => {
      mocks.verifyAdminAccessToken.mockResolvedValue({ sub: 'user-123' });
      mockPrisma.user.findUnique.mockResolvedValue(
        createMockUser({ id: 'user-123', role: 'USER', banned: false })
      );

      app.get('/admin/dashboard', async () => {
        return { ok: true };
      });

      await app.ready();
      const response = await app.inject({
        method: 'GET',
        url: '/admin/dashboard',
        headers: {
          authorization: 'Bearer user-token',
        },
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload)).toEqual({
        error: 'Forbidden: Admin access required',
      });
    });

    it('should allow admin to access admin routes', async () => {
      mocks.verifyAdminAccessToken.mockResolvedValue({ sub: 'admin-123' });
      mockPrisma.user.findUnique.mockResolvedValue(
        createMockUser({ id: 'admin-123', role: 'ADMIN', banned: false })
      );

      let capturedIsAdmin: boolean | undefined;

      app.get('/admin/dashboard', async (request: FastifyRequest) => {
        capturedIsAdmin = request.isAdmin;
        return { ok: true };
      });

      await app.ready();
      const response = await app.inject({
        method: 'GET',
        url: '/admin/dashboard',
        headers: {
          authorization: 'Bearer admin-token',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(capturedIsAdmin).toBe(true);
    });
  });

  describe('guest users', () => {
    it('should set isGuest from token payload', async () => {
      mocks.verifyAccessToken.mockResolvedValue({ sub: 'guest-123', isGuest: true });
      mockPrisma.user.findUnique.mockResolvedValue(
        createMockUser({ id: 'guest-123', role: 'USER', banned: false, isGuest: true })
      );

      let capturedIsGuest: boolean | undefined;

      app.get('/protected', async (request: FastifyRequest) => {
        capturedIsGuest = request.isGuest;
        return { ok: true };
      });

      await app.ready();
      await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Bearer guest-token',
        },
      });

      expect(capturedIsGuest).toBe(true);
    });

    it('should prioritize database isGuest over token payload', async () => {
      mocks.verifyAccessToken.mockResolvedValue({ sub: 'user-123', isGuest: true });
      mockPrisma.user.findUnique.mockResolvedValue(
        createMockUser({ id: 'user-123', role: 'USER', banned: false, isGuest: false })
      );

      let capturedIsGuest: boolean | undefined;

      app.get('/protected', async (request: FastifyRequest) => {
        capturedIsGuest = request.isGuest;
        return { ok: true };
      });

      await app.ready();
      await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Bearer token',
        },
      });

      // Database value should override token payload
      expect(capturedIsGuest).toBe(false);
    });
  });
});
