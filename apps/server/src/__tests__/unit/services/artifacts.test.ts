/**
 * Artifacts service tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getPlayerArtifacts,
  getPlayerItems,
  craftArtifact,
  equipArtifact,
  unequipArtifact,
  useItem,
  addArtifact,
  addItems,
} from '../../../services/artifacts.js';
import {
  mockPrisma,
  resetPrismaMock,
  createMockInventory,
  createMockPlayerArtifact,
} from '../../mocks/prisma.js';

describe('Artifacts Service', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  describe('getPlayerArtifacts', () => {
    it('returns empty array when player has no artifacts', async () => {
      mockPrisma.playerArtifact.findMany.mockResolvedValue([]);

      const result = await getPlayerArtifacts('user-123');

      expect(result).toEqual([]);
    });

    it('returns all player artifacts', async () => {
      const mockArtifacts = [
        createMockPlayerArtifact('sword_of_fire'),
        createMockPlayerArtifact('shield_of_ice'),
      ];

      mockPrisma.playerArtifact.findMany.mockResolvedValue(mockArtifacts);

      const result = await getPlayerArtifacts('user-123');

      expect(result).toHaveLength(2);
      expect(result[0].artifactId).toBe('sword_of_fire');
      expect(result[1].artifactId).toBe('shield_of_ice');
    });

    it('returns artifacts with equippedToHeroId', async () => {
      const mockArtifact = createMockPlayerArtifact('sword_of_fire', {
        equippedToHeroId: 'hero-1',
      });

      mockPrisma.playerArtifact.findMany.mockResolvedValue([mockArtifact]);

      const result = await getPlayerArtifacts('user-123');

      expect(result[0].equippedToHeroId).toBe('hero-1');
    });

    it('converts acquiredAt to ISO string', async () => {
      const mockArtifact = createMockPlayerArtifact('sword_of_fire');
      mockPrisma.playerArtifact.findMany.mockResolvedValue([mockArtifact]);

      const result = await getPlayerArtifacts('user-123');

      expect(typeof result[0].acquiredAt).toBe('string');
      expect(result[0].acquiredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('getPlayerItems', () => {
    it('returns empty array when inventory not found', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(null);

      const result = await getPlayerItems('user-123');

      expect(result).toEqual([]);
    });

    it('returns empty array when items is null', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue({ items: null });

      const result = await getPlayerItems('user-123');

      expect(result).toEqual([]);
    });

    it('returns player items', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue({
        items: { potion: 5, key: 2 },
      });

      const result = await getPlayerItems('user-123');

      expect(result).toHaveLength(2);
      expect(result).toContainEqual({ itemId: 'potion', amount: 5 });
      expect(result).toContainEqual({ itemId: 'key', amount: 2 });
    });

    it('filters out items with zero amount', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue({
        items: { potion: 5, key: 0 },
      });

      const result = await getPlayerItems('user-123');

      expect(result).toHaveLength(1);
      expect(result[0].itemId).toBe('potion');
    });
  });

  describe('useItem', () => {
    it('uses an item successfully', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue({
        items: { potion: 5 },
      });
      mockPrisma.inventory.update.mockResolvedValue({
        items: { potion: 4 },
      });

      const result = await useItem('user-123', 'potion', 1);

      expect(result.success).toBe(true);
      expect(result.items).toContainEqual({ itemId: 'potion', amount: 4 });
    });

    it('returns error when inventory not found', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(null);

      const result = await useItem('user-123', 'potion', 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Inventory not found');
    });

    it('returns error when not enough items', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue({
        items: { potion: 2 },
      });

      const result = await useItem('user-123', 'potion', 5);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not enough items');
    });

    it('removes item from inventory when count reaches zero', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue({
        items: { potion: 1 },
      });
      mockPrisma.inventory.update.mockResolvedValue({
        items: {},
      });

      const result = await useItem('user-123', 'potion', 1);

      expect(result.success).toBe(true);
      expect(result.items).toEqual([]);
    });

    it('uses multiple items at once', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue({
        items: { potion: 10 },
      });
      mockPrisma.inventory.update.mockResolvedValue({
        items: { potion: 7 },
      });

      const result = await useItem('user-123', 'potion', 3);

      expect(result.success).toBe(true);
      expect(result.items).toContainEqual({ itemId: 'potion', amount: 7 });
    });
  });

  describe('addArtifact', () => {
    it('adds artifact to player', async () => {
      const mockArtifact = createMockPlayerArtifact('sword_of_fire');

      mockPrisma.playerArtifact.findUnique.mockResolvedValue(null);
      mockPrisma.playerArtifact.create.mockResolvedValue(mockArtifact);

      const result = await addArtifact('user-123', 'sword_of_fire');

      expect(result.success).toBe(true);
      expect(result.artifact?.artifactId).toBe('sword_of_fire');
    });

    it('returns error when player already owns artifact', async () => {
      const existing = createMockPlayerArtifact('sword_of_fire');
      mockPrisma.playerArtifact.findUnique.mockResolvedValue(existing);

      const result = await addArtifact('user-123', 'sword_of_fire');

      expect(result.success).toBe(false);
      expect(result.error).toBe('You already own this artifact');
    });
  });

  describe('addItems', () => {
    it('adds items to inventory', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue({
        items: { potion: 5 },
      });
      mockPrisma.inventory.update.mockResolvedValue({
        items: { potion: 8, key: 3 },
      });

      const result = await addItems('user-123', { potion: 3, key: 3 });

      expect(result.success).toBe(true);
      expect(result.items).toContainEqual({ itemId: 'potion', amount: 8 });
      expect(result.items).toContainEqual({ itemId: 'key', amount: 3 });
    });

    it('returns error when inventory not found', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(null);

      const result = await addItems('user-123', { potion: 3 });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Inventory not found');
    });

    it('handles empty inventory items', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue({
        items: null,
      });
      mockPrisma.inventory.update.mockResolvedValue({
        items: { potion: 5 },
      });

      const result = await addItems('user-123', { potion: 5 });

      expect(result.success).toBe(true);
      expect(result.items).toContainEqual({ itemId: 'potion', amount: 5 });
    });
  });

  describe('equipArtifact', () => {
    it('returns error when artifact instance not found', async () => {
      mockPrisma.playerArtifact.findFirst.mockResolvedValue(null);

      const result = await equipArtifact('user-123', 'artifact-123', 'hero-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Artifact not found');
    });

    // Note: Full equipArtifact testing requires mocking @arcade/sim-core
    // functions (getArtifactById, getHeroById, canHeroEquipArtifact)
    // These tests focus on the database interaction layer
  });

  describe('unequipArtifact', () => {
    it('unequips artifact successfully', async () => {
      const mockArtifact = createMockPlayerArtifact('sword_of_fire', {
        equippedToHeroId: 'hero-1',
      });

      mockPrisma.playerArtifact.findFirst.mockResolvedValue(mockArtifact);
      mockPrisma.playerArtifact.update.mockResolvedValue({
        ...mockArtifact,
        equippedToHeroId: null,
      });

      const result = await unequipArtifact('user-123', mockArtifact.id);

      expect(result.success).toBe(true);
      expect(result.artifact?.equippedToHeroId).toBeNull();
    });

    it('returns error when artifact not found', async () => {
      mockPrisma.playerArtifact.findFirst.mockResolvedValue(null);

      const result = await unequipArtifact('user-123', 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Artifact not found');
    });
  });

  describe('craftArtifact', () => {
    // Note: craftArtifact first calls getArtifactById from @arcade/sim-core
    // to validate the artifact exists. Testing with fake artifact IDs
    // will return 'Artifact not found'. Full testing requires either:
    // - Using real artifact IDs from sim-core
    // - Mocking the sim-core module

    it('returns error for non-existent artifact', async () => {
      // Fake artifact IDs are rejected by getArtifactById
      const result = await craftArtifact('user-123', 'fake_artifact_id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Artifact not found');
    });

    it('returns error for non-craftable artifact (drop-only)', async () => {
      // 'mjolnir' exists but has source.type: 'drop', not 'craft'
      const result = await craftArtifact('user-123', 'mjolnir');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Artifact is not craftable');
    });

    it('returns error when player already owns craftable artifact', async () => {
      // 'stormbreaker' exists and is craftable
      const existing = createMockPlayerArtifact('stormbreaker');
      mockPrisma.playerArtifact.findUnique.mockResolvedValue(existing);

      const result = await craftArtifact('user-123', 'stormbreaker');

      expect(result.success).toBe(false);
      expect(result.error).toBe('You already own this artifact');
    });

    it('returns error when inventory not found', async () => {
      // 'stormbreaker' is craftable
      mockPrisma.playerArtifact.findUnique.mockResolvedValue(null);
      mockPrisma.inventory.findUnique.mockResolvedValue(null);

      const result = await craftArtifact('user-123', 'stormbreaker');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Inventory not found');
    });

    it('returns error when not enough gold', async () => {
      // 'stormbreaker' is craftable and has a gold cost
      mockPrisma.playerArtifact.findUnique.mockResolvedValue(null);
      mockPrisma.inventory.findUnique.mockResolvedValue(
        createMockInventory({ gold: 0, materials: {} })
      );

      const result = await craftArtifact('user-123', 'stormbreaker');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not enough gold');
    });
  });
});
