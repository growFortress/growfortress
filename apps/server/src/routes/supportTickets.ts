import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createTicket,
  getUserTickets,
  getTicketById,
  addResponse,
  closeTicket,
} from '../services/supportTickets.js';

// Validation schemas
const CreateTicketSchema = z.object({
  category: z.enum(['BUG_REPORT', 'ACCOUNT_ISSUE', 'PAYMENT', 'OTHER']),
  subject: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
});

const AddResponseSchema = z.object({
  content: z.string().min(1).max(2000),
});

const GetTicketsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
});

export async function supportTicketRoutes(fastify: FastifyInstance) {
  // POST /support-tickets - Create a new ticket
  fastify.post('/support-tickets', async (request, reply) => {
    const userId = request.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const parsed = CreateTicketSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation error',
        details: parsed.error.flatten(),
      });
    }

    try {
      const ticket = await createTicket(
        userId,
        parsed.data.category,
        parsed.data.subject,
        parsed.data.description
      );
      return reply.code(201).send(ticket);
    } catch (error: any) {
      if (error.message.includes('Rate limit')) {
        return reply.code(429).send({ error: error.message });
      }
      return reply.code(400).send({ error: error.message });
    }
  });

  // GET /support-tickets - Get user's tickets
  fastify.get('/support-tickets', async (request, reply) => {
    const userId = request.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const parsed = GetTicketsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation error',
        details: parsed.error.flatten(),
      });
    }

    const { page, limit, status } = parsed.data;
    const result = await getUserTickets(userId, page, limit, status);
    return reply.send(result);
  });

  // GET /support-tickets/:id - Get a specific ticket with responses
  fastify.get('/support-tickets/:id', async (request, reply) => {
    const userId = request.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };
    const ticket = await getTicketById(id, userId);

    if (!ticket) {
      return reply.code(404).send({ error: 'Ticket not found' });
    }

    return reply.send(ticket);
  });

  // POST /support-tickets/:id/responses - Add a response to a ticket
  fastify.post('/support-tickets/:id/responses', async (request, reply) => {
    const userId = request.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };
    const parsed = AddResponseSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation error',
        details: parsed.error.flatten(),
      });
    }

    try {
      const response = await addResponse(id, userId, parsed.data.content, false);
      return reply.code(201).send(response);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return reply.code(404).send({ error: error.message });
      }
      if (error.message.includes('Access denied') || error.message.includes('closed')) {
        return reply.code(403).send({ error: error.message });
      }
      return reply.code(400).send({ error: error.message });
    }
  });

  // PATCH /support-tickets/:id/close - Close a ticket
  fastify.patch('/support-tickets/:id/close', async (request, reply) => {
    const userId = request.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    try {
      const ticket = await closeTicket(id, userId);
      return reply.send(ticket);
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('denied')) {
        return reply.code(404).send({ error: 'Ticket not found' });
      }
      return reply.code(400).send({ error: error.message });
    }
  });
}
