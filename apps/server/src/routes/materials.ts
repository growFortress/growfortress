import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

// Schema for adding materials
const AddMaterialsSchema = z.object({
  materials: z.record(z.string(), z.number().int().min(1)),
});

// Schema for removing materials
const RemoveMaterialsSchema = z.object({
  materials: z.record(z.string(), z.number().int().min(1)),
});

const materialsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /v1/inventory/materials
   * Get player's materials inventory
   */
  fastify.get('/v1/inventory/materials', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const inventory = await prisma.inventory.findUnique({
      where: { userId: request.userId },
      select: { materials: true },
    });

    if (!inventory) {
      return reply.status(404).send({ error: 'Inventory not found' });
    }

    // Parse materials JSON, default to empty object
    const materials =
      typeof inventory.materials === 'object' && inventory.materials !== null
        ? (inventory.materials as Record<string, number>)
        : {};

    return reply.send({
      materials,
      totalCount: Object.values(materials).reduce((sum, n) => sum + n, 0),
      uniqueCount: Object.keys(materials).length,
    });
  });

  /**
   * POST /v1/inventory/materials/add
   * Add materials to player's inventory (for testing/admin)
   */
  fastify.post('/v1/inventory/materials/add', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const validation = AddMaterialsSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({ error: 'Invalid request', details: validation.error.issues });
    }

    const { materials: toAdd } = validation.data;

    const inventory = await prisma.inventory.findUnique({
      where: { userId: request.userId },
      select: { materials: true },
    });

    if (!inventory) {
      return reply.status(404).send({ error: 'Inventory not found' });
    }

    // Parse existing materials
    const existingMaterials =
      typeof inventory.materials === 'object' && inventory.materials !== null
        ? (inventory.materials as Record<string, number>)
        : {};

    // Add new materials
    const updatedMaterials = { ...existingMaterials };
    for (const [materialId, amount] of Object.entries(toAdd)) {
      updatedMaterials[materialId] = (updatedMaterials[materialId] || 0) + amount;
    }

    // Update in database
    await prisma.inventory.update({
      where: { userId: request.userId },
      data: { materials: updatedMaterials },
    });

    return reply.send({
      success: true,
      materials: updatedMaterials,
    });
  });

  /**
   * POST /v1/inventory/materials/remove
   * Remove materials from player's inventory (for crafting)
   */
  fastify.post('/v1/inventory/materials/remove', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const validation = RemoveMaterialsSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({ error: 'Invalid request', details: validation.error.issues });
    }

    const { materials: toRemove } = validation.data;

    const inventory = await prisma.inventory.findUnique({
      where: { userId: request.userId },
      select: { materials: true },
    });

    if (!inventory) {
      return reply.status(404).send({ error: 'Inventory not found' });
    }

    // Parse existing materials
    const existingMaterials =
      typeof inventory.materials === 'object' && inventory.materials !== null
        ? (inventory.materials as Record<string, number>)
        : {};

    // Check if player has enough materials
    for (const [materialId, amount] of Object.entries(toRemove)) {
      const current = existingMaterials[materialId] || 0;
      if (current < amount) {
        return reply.status(400).send({
          error: 'Insufficient materials',
          materialId,
          required: amount,
          available: current,
        });
      }
    }

    // Remove materials
    const updatedMaterials = { ...existingMaterials };
    for (const [materialId, amount] of Object.entries(toRemove)) {
      updatedMaterials[materialId] = (updatedMaterials[materialId] || 0) - amount;
      if (updatedMaterials[materialId] <= 0) {
        delete updatedMaterials[materialId];
      }
    }

    // Update in database
    await prisma.inventory.update({
      where: { userId: request.userId },
      data: { materials: updatedMaterials },
    });

    return reply.send({
      success: true,
      materials: updatedMaterials,
    });
  });
};

export default materialsRoutes;
