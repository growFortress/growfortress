import { FastifyPluginAsync, FastifyError } from 'fastify';
import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import { prisma } from '../lib/prisma.js';

const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler(async (error: FastifyError, request, reply) => {
    // Log error to console
    request.log.error(error);

    // Persist error to database for dashboard (if it's a serious error or validation issue)
    const statusCode = error.statusCode || 500;
    
    if (statusCode >= 400) {
      try {
        await prisma.systemError.create({
          data: {
            message: error.message,
            stack: error.stack,
            path: request.url,
            method: request.method,
            status: statusCode,
            userId: (request as any).userId || null,
          }
        });
      } catch (dbError) {
        request.log.error(dbError, 'Failed to log error to database');
      }
    }

    // Handle Zod validation errors
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'Validation error',
        details: error.errors,
        requestId: request.id,
      });
    }

    // Handle rate limit errors
    if (error.statusCode === 429) {
      return reply.status(429).send({
        error: 'Too many requests',
        retryAfter: reply.getHeader('retry-after') || error.message,
        requestId: request.id,
      });
    }

    // Handle other errors
    const message = statusCode === 500 ? 'Internal server error' : error.message;

    return reply.status(statusCode).send({
      error: message,
      requestId: request.id,
    });
  });
};

export default fp(errorHandlerPlugin, {
  name: 'errorHandler',
});
