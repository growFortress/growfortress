/**
 * Unit tests for power-upgrades service
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  upgradeFortressStat,
  upgradeHeroStat,
  upgradeTurretStat,
  getPowerSummary,
  getCachedTotalPower,
} from '../../../services/power-upgrades.js';
import { mockPrisma, createMockInventory, createMockProgression } from '../../mocks/prisma.js';

// Import test setup
import '../../helpers/setup.js';

// Helper to create mock power upgrades data
function createMockPowerUpgrades(overrides: Record<string, unknown> = {}) {
  return {
    id: 'power-123',
    userId: 'user-123',
    fortressUpgrades: JSON.stringify({ statUpgrades: { hp: 0, damage: 0, regen: 0 } }),
    heroUpgrades: JSON.stringify([]),
    turretUpgrades: JSON.stringify([]),
    itemTiers: JSON.stringify([]),
    cachedTotalPower: 0,
    ...overrides,
  };
}

describe('Power Upgrades Service', () => {
  const userId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('upgradeFortressStat', () => {
    it('should return error for invalid stat', async () => {
      const result = await upgradeFortressStat(userId, 'invalid_stat' as never);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid stat');
    });

    it('should return error if inventory not found', async () => {
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue(null);
      mockPrisma.powerUpgrades.create.mockResolvedValue(createMockPowerUpgrades());
      mockPrisma.inventory.findUnique.mockResolvedValue(null);
      mockPrisma.progression.findUnique.mockResolvedValue(null);

      const result = await upgradeFortressStat(userId, 'hp');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Inventory not found');
    });

    it('should return error if not enough gold', async () => {
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue(createMockPowerUpgrades());
      mockPrisma.inventory.findUnique.mockResolvedValue(createMockInventory({ gold: 10 })); // Not enough
      mockPrisma.progression.findUnique.mockResolvedValue(createMockProgression());

      const result = await upgradeFortressStat(userId, 'hp');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not enough gold');
    });

    it('should upgrade fortress stat successfully', async () => {
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue(createMockPowerUpgrades());
      mockPrisma.inventory.findUnique.mockResolvedValue(createMockInventory({ gold: 10000 }));
      mockPrisma.progression.findUnique.mockResolvedValue(createMockProgression());
      mockPrisma.inventory.update.mockResolvedValue(createMockInventory({ gold: 9000 }));
      mockPrisma.powerUpgrades.upsert.mockResolvedValue(createMockPowerUpgrades());

      const result = await upgradeFortressStat(userId, 'hp');

      expect(result.success).toBe(true);
      expect(result.newLevel).toBe(1);
      expect(result.goldSpent).toBeGreaterThan(0);
    });
  });

  describe('upgradeHeroStat', () => {
    it('should return error for invalid stat', async () => {
      const result = await upgradeHeroStat(userId, 'storm', 'invalid_stat' as never);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid stat');
    });

    it('should return error if inventory not found', async () => {
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue(null);
      mockPrisma.powerUpgrades.create.mockResolvedValue(createMockPowerUpgrades());
      mockPrisma.inventory.findUnique.mockResolvedValue(null);
      mockPrisma.progression.findUnique.mockResolvedValue(null);

      const result = await upgradeHeroStat(userId, 'storm', 'damage');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Inventory not found');
    });

    it('should upgrade hero stat successfully', async () => {
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue(createMockPowerUpgrades());
      mockPrisma.inventory.findUnique.mockResolvedValue(createMockInventory({ gold: 10000 }));
      mockPrisma.progression.findUnique.mockResolvedValue(createMockProgression());
      mockPrisma.inventory.update.mockResolvedValue(createMockInventory({ gold: 9000 }));
      mockPrisma.powerUpgrades.upsert.mockResolvedValue(createMockPowerUpgrades());

      const result = await upgradeHeroStat(userId, 'storm', 'damage');

      expect(result.success).toBe(true);
      expect(result.newLevel).toBe(1);
    });
  });

  describe('upgradeTurretStat', () => {
    it('should return error for invalid stat', async () => {
      const result = await upgradeTurretStat(userId, 'railgun', 'invalid_stat' as never);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid stat');
    });

    it('should return error if inventory not found', async () => {
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue(null);
      mockPrisma.powerUpgrades.create.mockResolvedValue(createMockPowerUpgrades());
      mockPrisma.inventory.findUnique.mockResolvedValue(null);
      mockPrisma.progression.findUnique.mockResolvedValue(null);

      const result = await upgradeTurretStat(userId, 'railgun', 'damage');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Inventory not found');
    });

    it('should upgrade turret stat successfully', async () => {
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue(createMockPowerUpgrades());
      mockPrisma.inventory.findUnique.mockResolvedValue(createMockInventory({ gold: 10000 }));
      mockPrisma.progression.findUnique.mockResolvedValue(createMockProgression());
      mockPrisma.inventory.update.mockResolvedValue(createMockInventory({ gold: 9000 }));
      mockPrisma.powerUpgrades.upsert.mockResolvedValue(createMockPowerUpgrades());

      const result = await upgradeTurretStat(userId, 'railgun', 'damage');

      expect(result.success).toBe(true);
      expect(result.newLevel).toBe(1);
    });
  });

  describe('getPowerSummary', () => {
    it('should return power summary for new user', async () => {
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue(null);
      mockPrisma.powerUpgrades.create.mockResolvedValue(createMockPowerUpgrades());
      mockPrisma.progression.findUnique.mockResolvedValue(createMockProgression({ level: 1 }));

      const result = await getPowerSummary(userId);

      expect(result.totalPower).toBeDefined();
      expect(result.fortressPower).toBeDefined();
      expect(result.heroPower).toBeDefined();
      expect(result.turretPower).toBeDefined();
    });

    it('should return power summary for existing user', async () => {
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue(createMockPowerUpgrades({
        fortressUpgrades: JSON.stringify({ statUpgrades: { hp: 5, damage: 3, regen: 1 } }),
      }));
      mockPrisma.progression.findUnique.mockResolvedValue(createMockProgression({ level: 10 }));

      const result = await getPowerSummary(userId);

      expect(result.totalPower).toBeGreaterThan(0);
      expect(result.fortressUpgrades).toBeDefined();
    });
  });

  describe('getCachedTotalPower', () => {
    it('should return 0 for new user', async () => {
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue(null);
      mockPrisma.powerUpgrades.create.mockResolvedValue(createMockPowerUpgrades({
        cachedTotalPower: 0,
      }));

      const result = await getCachedTotalPower(userId);

      expect(result).toBe(0);
    });

    it('should return cached power for existing user', async () => {
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue(createMockPowerUpgrades({
        cachedTotalPower: 5000,
      }));

      const result = await getCachedTotalPower(userId);

      expect(result).toBe(5000);
    });
  });
});
