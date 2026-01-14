import { FastifyPluginAsync } from 'fastify';
import {
  CraftArtifactRequestSchema,
  CraftArtifactResponseSchema,
  EquipArtifactRequestSchema,
  EquipArtifactResponseSchema,
  UnequipArtifactRequestSchema,
  UnequipArtifactResponseSchema,
  UseItemRequestSchema,
  UseItemResponseSchema,
} from '@arcade/protocol';
import {
  getPlayerArtifacts,
  getPlayerItems,
  craftArtifact,
  equipArtifact,
  unequipArtifact,
  useItem,
  addArtifact,
  addItems,
} from '../services/artifacts.js';

const artifactsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /v1/artifacts
   * Get all player artifacts and items
   */
  fastify.get('/v1/artifacts', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const [artifacts, items] = await Promise.all([
      getPlayerArtifacts(request.userId),
      getPlayerItems(request.userId),
    ]);

    return reply.send({ artifacts, items });
  });

  /**
   * POST /v1/artifacts/craft
   * Craft an artifact using materials and gold
   */
  fastify.post('/v1/artifacts/craft', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const validation = CraftArtifactRequestSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({ error: 'Invalid request', details: validation.error.issues });
    }

    const result = await craftArtifact(request.userId, validation.data.artifactId);

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    // Validate response matches protocol schema
    const responseValidation = CraftArtifactResponseSchema.safeParse(result);
    if (!responseValidation.success) {
      fastify.log.error({ error: responseValidation.error }, 'CraftArtifactResponse validation failed');
    }

    return reply.send(result);
  });

  /**
   * POST /v1/artifacts/equip
   * Equip an artifact to a hero
   */
  fastify.post('/v1/artifacts/equip', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const validation = EquipArtifactRequestSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({ error: 'Invalid request', details: validation.error.issues });
    }

    const result = await equipArtifact(
      request.userId,
      validation.data.artifactInstanceId,
      validation.data.heroId,
      validation.data.slotType
    );

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    // Validate response matches protocol schema
    const responseValidation = EquipArtifactResponseSchema.safeParse(result);
    if (!responseValidation.success) {
      fastify.log.error({ error: responseValidation.error }, 'EquipArtifactResponse validation failed');
    }

    return reply.send(result);
  });

  /**
   * POST /v1/artifacts/unequip
   * Unequip an artifact from a hero
   */
  fastify.post('/v1/artifacts/unequip', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const validation = UnequipArtifactRequestSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({ error: 'Invalid request', details: validation.error.issues });
    }

    const result = await unequipArtifact(request.userId, validation.data.artifactInstanceId);

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    // Validate response matches protocol schema
    const responseValidation = UnequipArtifactResponseSchema.safeParse(result);
    if (!responseValidation.success) {
      fastify.log.error({ error: responseValidation.error }, 'UnequipArtifactResponse validation failed');
    }

    return reply.send(result);
  });

  /**
   * POST /v1/items/use
   * Use a consumable item
   */
  fastify.post('/v1/items/use', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const validation = UseItemRequestSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({ error: 'Invalid request', details: validation.error.issues });
    }

    const result = await useItem(request.userId, validation.data.itemId, validation.data.amount);

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    // Validate response matches protocol schema
    const responseValidation = UseItemResponseSchema.safeParse(result);
    if (!responseValidation.success) {
      fastify.log.error({ error: responseValidation.error }, 'UseItemResponse validation failed');
    }

    return reply.send(result);
  });

  /**
   * POST /v1/artifacts/add (Admin/Testing)
   * Add an artifact to player inventory
   */
  fastify.post('/v1/artifacts/add', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { artifactId } = request.body as { artifactId: string };
    if (!artifactId) {
      return reply.status(400).send({ error: 'artifactId is required' });
    }

    const result = await addArtifact(request.userId, artifactId);

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return result;
  });

  /**
   * POST /v1/items/add (Admin/Testing)
   * Add items to player inventory
   */
  fastify.post('/v1/items/add', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { items } = request.body as { items: Record<string, number> };
    if (!items || typeof items !== 'object') {
      return reply.status(400).send({ error: 'items object is required' });
    }

    const result = await addItems(request.userId, items);

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return result;
  });
};

export default artifactsRoutes;
