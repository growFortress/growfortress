import { FastifyPluginAsync } from 'fastify';
import {
  AuthRegisterRequestSchema,
  AuthLoginRequestSchema,
  AuthRefreshRequestSchema,
  CompleteOnboardingRequestSchema,
} from '@arcade/protocol';
import { registerUser, loginUser, refreshTokens, getUserProfile, completeOnboarding, updateDefaultLoadout } from '../services/auth.js';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Register new account
  fastify.post('/v1/auth/register', { config: { public: true } }, async (request, reply) => {
    const body = AuthRegisterRequestSchema.parse(request.body);

    try {
      const result = await registerUser(body.username, body.password);

      return reply.status(201).send({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        userId: result.userId,
        displayName: result.displayName,
        expiresAt: result.expiresAt,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'USERNAME_TAKEN') {
        return reply.status(409).send({ error: 'Username is already taken' });
      }
      throw error;
    }
  });

  // Login
  fastify.post('/v1/auth/login', { config: { public: true } }, async (request, reply) => {
    const body = AuthLoginRequestSchema.parse(request.body);

    const result = await loginUser(body.username, body.password);

    if (!result) {
      return reply.status(401).send({ error: 'Invalid username or password' });
    }

    return reply.send({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      userId: result.userId,
      displayName: result.displayName,
      expiresAt: result.expiresAt,
    });
  });

  // Refresh tokens
  fastify.post('/v1/auth/refresh', { config: { public: true } }, async (request, reply) => {
    const body = AuthRefreshRequestSchema.parse(request.body);

    const result = await refreshTokens(body.refreshToken);

    if (!result) {
      return reply.status(401).send({ error: 'Invalid or expired refresh token' });
    }

    return reply.send({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      displayName: result.displayName,
      expiresAt: result.expiresAt,
    });
  });

  // Get user profile
  fastify.get('/v1/profile', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const profile = await getUserProfile(request.userId);

    if (!profile) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send(profile);
  });

  // Complete onboarding - set default loadout
  fastify.post('/v1/onboarding/complete', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const body = CompleteOnboardingRequestSchema.parse(request.body);

    const result = await completeOnboarding(
      request.userId,
      body.fortressClass,
      body.heroId,
      body.turretType
    );

    return reply.send(result);
  });

  // Update default loadout (for changing defaults later)
  fastify.patch('/v1/profile/loadout', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const body = request.body as {
      fortressClass?: string;
      heroId?: string;
      turretType?: string;
    };

    const result = await updateDefaultLoadout(request.userId, body);

    return reply.send({ defaultLoadout: result });
  });

  // Update profile (display name)
  fastify.patch('/v1/profile', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const body = request.body as { displayName?: string };

    if (!body.displayName || body.displayName.length < 1 || body.displayName.length > 30) {
      return reply.status(400).send({ error: 'Display name must be between 1 and 30 characters' });
    }

    // Update display name in database
    const result = await updateDefaultLoadout(request.userId, { displayName: body.displayName });

    return reply.send({ displayName: result.displayName || body.displayName });
  });

  // Logout (invalidate refresh token - for future implementation with token blacklist)
  fastify.post('/v1/auth/logout', async (_request, reply) => {
    // Note: In a production system, we would add the refresh token to a blacklist
    // For now, the client clears the tokens locally
    return reply.status(204).send();
  });
};

export default authRoutes;
