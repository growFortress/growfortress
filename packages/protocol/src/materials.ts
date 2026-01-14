import { z } from 'zod';

// ============================================================================
// Materials Inventory
// ============================================================================

export const MaterialsResponseSchema = z.object({
  materials: z.record(z.string(), z.number()),
  totalCount: z.number().int().min(0),
  uniqueCount: z.number().int().min(0),
});

export type MaterialsResponse = z.infer<typeof MaterialsResponseSchema>;

// ============================================================================
// Add Materials
// ============================================================================

export const AddMaterialsRequestSchema = z.object({
  materials: z.record(z.string(), z.number().int().min(1)),
});

export type AddMaterialsRequest = z.infer<typeof AddMaterialsRequestSchema>;

export const AddMaterialsResponseSchema = z.object({
  success: z.boolean(),
  materials: z.record(z.string(), z.number()),
});

export type AddMaterialsResponse = z.infer<typeof AddMaterialsResponseSchema>;

// ============================================================================
// Remove Materials
// ============================================================================

export const RemoveMaterialsRequestSchema = z.object({
  materials: z.record(z.string(), z.number().int().min(1)),
});

export type RemoveMaterialsRequest = z.infer<typeof RemoveMaterialsRequestSchema>;

export const RemoveMaterialsResponseSchema = z.object({
  success: z.boolean(),
  materials: z.record(z.string(), z.number()),
});

export type RemoveMaterialsResponse = z.infer<typeof RemoveMaterialsResponseSchema>;
