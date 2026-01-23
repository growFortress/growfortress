/**
 * Unit tests for heroes service
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  unlockHero,
  unlockTurret,
  getUnlockedHeroes,
  getUnlockedTurrets,
} from '../../../services/heroes.js';
import { mockPrisma, createMockInventory } from '../../mocks/prisma.js';

// Import test setup
import '../../helpers/setup.js';

describe('Heroes Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('unlockHero', () => {
    const userId = 'user-123';

    it('should return error if hero does not exist', async () => {
      const result = await unlockHero(userId, 'nonexistent_hero');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Hero not found');
    });

    it('should return error if inventory not found', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(null);

      const result = await unlockHero(userId, 'storm');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Inventory not found');
    });

    it('should return error if hero already unlocked', async () => {
      const mockInventory = createMockInventory({
        unlockedHeroIds: ['storm'],
        gold: 10000,
        dust: 5000,
      });

      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);

      const result = await unlockHero(userId, 'storm');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Hero already unlocked');
    });

    it('should unlock starter hero without deducting resources', async () => {
      const mockInventory = createMockInventory({
        unlockedHeroIds: [],
        gold: 100,
        dust: 50,
      });

      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);
      mockPrisma.inventory.update.mockResolvedValue({
        ...mockInventory,
        unlockedHeroIds: ['storm'],
      });

      const result = await unlockHero(userId, 'storm');

      expect(result.success).toBe(true);
      expect(result.heroId).toBe('storm');
      expect(mockPrisma.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            gold: 100, // Unchanged
            dust: 50,  // Unchanged
          }),
        })
      );
    });

    it('should return error if not enough resources for non-starter hero', async () => {
      const mockInventory = createMockInventory({
        unlockedHeroIds: [],
        gold: 100, // Not enough (needs 3000 for common)
        dust: 50,
      });

      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);

      const result = await unlockHero(userId, 'frost'); // common rarity

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not enough resources');
    });

    it('should unlock non-starter hero and deduct resources', async () => {
      const mockInventory = createMockInventory({
        unlockedHeroIds: [],
        gold: 5000,
        dust: 1000,
      });

      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);
      mockPrisma.inventory.update.mockResolvedValue({
        ...mockInventory,
        gold: 2000,
        dust: 500,
        unlockedHeroIds: ['frost'],
      });

      const result = await unlockHero(userId, 'frost');

      expect(result.success).toBe(true);
      expect(result.heroId).toBe('frost');
    });
  });

  describe('unlockTurret', () => {
    const userId = 'user-123';

    it('should return error if inventory not found', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(null);

      const result = await unlockTurret(userId, 'railgun');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Inventory not found');
    });

    it('should return error if turret already unlocked', async () => {
      const mockInventory = createMockInventory({
        unlockedTurretIds: ['railgun'],
        gold: 10000,
        dust: 5000,
      });

      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);

      const result = await unlockTurret(userId, 'railgun');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Turret already unlocked');
    });

    it('should unlock starter turret without deducting resources', async () => {
      const mockInventory = createMockInventory({
        unlockedTurretIds: [],
        gold: 100,
        dust: 50,
      });

      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);
      mockPrisma.inventory.update.mockResolvedValue({
        ...mockInventory,
        unlockedTurretIds: ['railgun'],
      });

      const result = await unlockTurret(userId, 'railgun');

      expect(result.success).toBe(true);
      expect(result.turretType).toBe('railgun');
      expect(mockPrisma.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            gold: 100, // Unchanged
            dust: 50,  // Unchanged
          }),
        })
      );
    });

    it('should return error if not enough resources for non-starter turret', async () => {
      const mockInventory = createMockInventory({
        unlockedTurretIds: [],
        gold: 100, // Not enough
        dust: 50,
      });

      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);

      const result = await unlockTurret(userId, 'artillery');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not enough resources');
    });
  });

  describe('getUnlockedHeroes', () => {
    const userId = 'user-123';

    it('should return starter heroes when inventory empty', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(null);

      const result = await getUnlockedHeroes(userId);

      // Should include all free starter heroes
      expect(result).toContain('vanguard');
      expect(result).toContain('storm');
      expect(result).toContain('medic');
      expect(result).toContain('pyro');
      expect(result).toHaveLength(4);
    });

    it('should include both starter and unlocked heroes', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue({
        unlockedHeroIds: ['frost'],
      });

      const result = await getUnlockedHeroes(userId);

      // Should include unlocked hero
      expect(result).toContain('frost');
      // Should also include starters
      expect(result).toContain('storm');
    });
  });

  describe('getUnlockedTurrets', () => {
    const userId = 'user-123';

    it('should return starter turrets when inventory empty', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(null);

      const result = await getUnlockedTurrets(userId);

      // Should include free starter turret (railgun only)
      expect(result).toContain('railgun');
      expect(result).toHaveLength(1);
    });

    it('should include both starter and unlocked turrets', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue({
        unlockedTurretIds: ['artillery'],
      });

      const result = await getUnlockedTurrets(userId);

      // Should include unlocked turret
      expect(result).toContain('artillery');
      // Should also include starter (railgun only)
      expect(result).toContain('railgun');
      expect(result).toHaveLength(2);
    });
  });
});
