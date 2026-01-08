import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';

/**
 * Middleware to check if the user has ADMIN role.
 * Assumes that auth plugin has already populated request.userId
 */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.userId;

  if (!userId) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  });

  if (!user || user.role !== 'ADMIN') {
    return reply.code(403).send({ error: 'Forbidden: Admin access required' });
  }
}
