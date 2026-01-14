import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { verifyAccessToken } from '../lib/tokens.js';
import { prisma } from '../lib/prisma.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    isAdmin?: boolean;
  }
  interface FastifyContextConfig {
    public?: boolean;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('userId', undefined);
  fastify.decorateRequest('isAdmin', false);

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip auth for routes marked as public in route config
    if (request.routeOptions?.config?.public) {
      return;
    }

    // Skip auth for health endpoint
    if (request.url.startsWith('/health')) {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing authorization header' });
    }

    const token = authHeader.slice(7);
    const payload = await verifyAccessToken(token);

    if (!payload) {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }

    request.userId = payload.sub;

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { role: true },
    });
    request.isAdmin = user?.role === 'ADMIN';
  });
};

export default fp(authPlugin, {
  name: 'auth',
});
