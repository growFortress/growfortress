import { FastifyPluginAsync } from 'fastify';
import {
  AuthRegisterRequestSchema,
  AuthLoginRequestSchema,
  AuthRefreshRequestSchema,
  CompleteOnboardingRequestSchema,
  ForgotPasswordRequestSchema,
  ResetPasswordRequestSchema,
} from '@arcade/protocol';
import { 
  registerUser, 
  loginUser, 
  refreshTokens, 
  getUserProfile, 
  completeOnboarding, 
  updateDefaultLoadout, 
  logoutUser,
  requestPasswordReset,
  resetPassword
} from '../services/auth.js';
import { withRateLimit } from '../plugins/rateLimit.js';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Register new account (strict rate limit to prevent abuse)
  fastify.post('/v1/auth/register', withRateLimit('auth', { config: { public: true } }), async (request, reply) => {
    const body = AuthRegisterRequestSchema.parse(request.body);

    try {
      const result = await registerUser(body.username, body.password, body.email);

      return reply.status(201).send({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        userId: result.userId,
        displayName: result.displayName,
        expiresAt: result.expiresAt,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'USERNAME_TAKEN') {
          return reply.status(409).send({ error: 'Username is already taken' });
        }
        if (error.message === 'EMAIL_TAKEN') {
          return reply.status(409).send({ error: 'Email is already taken' });
        }
      }
      throw error;
    }
  });

  // Login (strict rate limit to prevent brute force)
  fastify.post('/v1/auth/login', withRateLimit('auth', { config: { public: true } }), async (request, reply) => {
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

  // Refresh tokens (rate limited to prevent token cycling attacks)
  fastify.post('/v1/auth/refresh', withRateLimit('auth', { config: { public: true } }), async (request, reply) => {
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
  fastify.get('/v1/profile', withRateLimit('profile'), async (request, reply) => {
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

  // Update player description
  fastify.patch('/v1/profile/description', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const body = request.body as { description?: string };

    // Allow empty string to clear description
    const description = body.description ?? '';

    if (description.length > 500) {
      return reply.status(400).send({ error: 'Description must be 500 characters or less' });
    }

    const result = await updateDefaultLoadout(request.userId, { description });

    return reply.send({ description: result.description || '' });
  });

  // Logout (invalidate refresh token by revoking session)
  fastify.post('/v1/auth/logout', withRateLimit('auth'), async (request, reply) => {
    const body = request.body as { refreshToken?: string };

    if (!body.refreshToken) {
      // No token provided, just acknowledge logout (client-side cleanup)
      return reply.status(204).send();
    }

    // Revoke the session associated with this refresh token
    await logoutUser(body.refreshToken);

    return reply.status(204).send();
  });

  // Forgot password (request reset email)
  fastify.post('/v1/auth/forgot-password', withRateLimit('auth', { config: { public: true } }), async (request, reply) => {
    const body = ForgotPasswordRequestSchema.parse(request.body);
    
    await requestPasswordReset(body.email);
    
    // Always return success to prevent email enumeration
    return reply.status(200).send({ message: 'If an account exists with this email, a reset link has been sent.' });
  });

  // Reset password (submit new password)
  fastify.post('/v1/auth/reset-password', withRateLimit('auth', { config: { public: true } }), async (request, reply) => {
    const body = ResetPasswordRequestSchema.parse(request.body);
    
    const success = await resetPassword(body.token, body.password);
    
    if (!success) {
      return reply.status(400).send({ error: 'Invalid or expired reset token' });
    }
    
    return reply.status(200).send({ message: 'Password has been reset successfully' });
  });
};

export default authRoutes;
