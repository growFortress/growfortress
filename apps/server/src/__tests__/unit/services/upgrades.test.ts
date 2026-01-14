/**
 * Upgrades service tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { upgradeHero, upgradeTurret } from '../../../services/upgrades.js';
import { mockPrisma, resetPrismaMock, createMockInventory } from '../../mocks/prisma.js';
import { HERO_UPGRADE_COSTS, TURRET_UPGRADE_COSTS } from '@arcade/protocol';

describe('Upgrades Service', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  describe('upgradeHero', () => {
    it('upgrades hero from tier 1 to tier 2', async () => {
      const cost = HERO_UPGRADE_COSTS['1_to_2'];
      const mockInventory = createMockInventory({
        gold: cost.gold + 100,
        dust: cost.dust + 50,
      });

      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);
      mockPrisma.inventory.update.mockResolvedValue({
        ...mockInventory,
        gold: 100,
        dust: 50,
      });
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue({ heroTiers: { 'hero-1': 1 } });
      mockPrisma.powerUpgrades.upsert.mockResolvedValue({});

      const result = await upgradeHero('user-123', 'hero-1', 1);

      expect(result.success).toBe(true);
      expect(result.newTier).toBe(2);
      expect(result.newInventory.gold).toBe(100);
      expect(result.newInventory.dust).toBe(50);
    });

    it('upgrades hero from tier 2 to tier 3', async () => {
      const cost = HERO_UPGRADE_COSTS['2_to_3'];
      const mockInventory = createMockInventory({
        gold: cost.gold,
        dust: cost.dust,
      });

      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);
      mockPrisma.inventory.update.mockResolvedValue({
        ...mockInventory,
        gold: 0,
        dust: 0,
      });
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue({ heroTiers: { 'hero-1': 2 } });
      mockPrisma.powerUpgrades.upsert.mockResolvedValue({});

      const result = await upgradeHero('user-123', 'hero-1', 2);

      expect(result.success).toBe(true);
      expect(result.newTier).toBe(3);
    });

    it('returns error for invalid current tier (0)', async () => {
      const result = await upgradeHero('user-123', 'hero-1', 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid current tier');
      expect(result.newTier).toBe(0);
    });

    it('returns error for invalid current tier (negative)', async () => {
      const result = await upgradeHero('user-123', 'hero-1', -1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid current tier');
    });

    it('returns error for tier 3 (outside valid range)', async () => {
      const result = await upgradeHero('user-123', 'hero-1', 3);

      expect(result.success).toBe(false);
      // The service validates tier range (1-2) first, so tier 3 is "invalid"
      expect(result.error).toBe('Invalid current tier');
    });

    it('returns error when inventory not found', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(null);

      const result = await upgradeHero('user-123', 'hero-1', 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Inventory not found');
    });

    it('returns error when not enough gold', async () => {
      const cost = HERO_UPGRADE_COSTS['1_to_2'];
      const mockInventory = createMockInventory({
        gold: cost.gold - 1,
        dust: cost.dust + 100,
      });

      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);

      const result = await upgradeHero('user-123', 'hero-1', 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not enough resources');
      expect(result.newInventory.gold).toBe(cost.gold - 1);
    });

    it('returns error when not enough dust', async () => {
      const cost = HERO_UPGRADE_COSTS['1_to_2'];
      const mockInventory = createMockInventory({
        gold: cost.gold + 100,
        dust: cost.dust - 1,
      });

      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);

      const result = await upgradeHero('user-123', 'hero-1', 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not enough resources');
      expect(result.newInventory.dust).toBe(cost.dust - 1);
    });

    it('deducts correct cost from inventory', async () => {
      const cost = HERO_UPGRADE_COSTS['1_to_2'];
      const startGold = cost.gold + 1000;
      const startDust = cost.dust + 500;
      const mockInventory = createMockInventory({
        gold: startGold,
        dust: startDust,
      });

      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);
      mockPrisma.inventory.update.mockResolvedValue({
        ...mockInventory,
        gold: startGold - cost.gold,
        dust: startDust - cost.dust,
      });
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue({ heroTiers: { 'hero-1': 1 } });
      mockPrisma.powerUpgrades.upsert.mockResolvedValue({});

      await upgradeHero('user-123', 'hero-1', 1);

      expect(mockPrisma.inventory.update).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        data: {
          gold: startGold - cost.gold,
          dust: startDust - cost.dust,
        },
      });
    });
  });

  describe('upgradeTurret', () => {
    it('upgrades turret from tier 1 to tier 2', async () => {
      const cost = TURRET_UPGRADE_COSTS['1_to_2'];
      const mockInventory = createMockInventory({
        gold: cost.gold + 100,
        dust: cost.dust + 50,
      });

      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);
      mockPrisma.inventory.update.mockResolvedValue({
        ...mockInventory,
        gold: 100,
        dust: 50,
      });
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue({ turretTiers: { basic: 1 } });
      mockPrisma.powerUpgrades.upsert.mockResolvedValue({});

      const result = await upgradeTurret('user-123', 'basic', 0, 1);

      expect(result.success).toBe(true);
      expect(result.newTier).toBe(2);
      expect(result.newInventory.gold).toBe(100);
      expect(result.newInventory.dust).toBe(50);
    });

    it('upgrades turret from tier 2 to tier 3', async () => {
      const cost = TURRET_UPGRADE_COSTS['2_to_3'];
      const mockInventory = createMockInventory({
        gold: cost.gold,
        dust: cost.dust,
      });

      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);
      mockPrisma.inventory.update.mockResolvedValue({
        ...mockInventory,
        gold: 0,
        dust: 0,
      });
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue({ turretTiers: { basic: 2 } });
      mockPrisma.powerUpgrades.upsert.mockResolvedValue({});

      const result = await upgradeTurret('user-123', 'basic', 0, 2);

      expect(result.success).toBe(true);
      expect(result.newTier).toBe(3);
    });

    it('returns error for invalid current tier', async () => {
      const result = await upgradeTurret('user-123', 'basic', 0, 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid current tier');
    });

    it('returns error for tier 3 (outside valid range)', async () => {
      const result = await upgradeTurret('user-123', 'basic', 0, 3);

      expect(result.success).toBe(false);
      // The service validates tier range (1-2) first, so tier 3 is "invalid"
      expect(result.error).toBe('Invalid current tier');
    });

    it('returns error when inventory not found', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(null);

      const result = await upgradeTurret('user-123', 'basic', 0, 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Inventory not found');
    });

    it('returns error when not enough resources', async () => {
      const mockInventory = createMockInventory({
        gold: 0,
        dust: 0,
      });

      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);

      const result = await upgradeTurret('user-123', 'basic', 0, 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not enough resources');
    });

    it('deducts correct cost from inventory', async () => {
      const cost = TURRET_UPGRADE_COSTS['1_to_2'];
      const startGold = cost.gold + 1000;
      const startDust = cost.dust + 500;
      const mockInventory = createMockInventory({
        gold: startGold,
        dust: startDust,
      });

      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);
      mockPrisma.inventory.update.mockResolvedValue({
        ...mockInventory,
        gold: startGold - cost.gold,
        dust: startDust - cost.dust,
      });
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue({ turretTiers: { basic: 1 } });
      mockPrisma.powerUpgrades.upsert.mockResolvedValue({});

      await upgradeTurret('user-123', 'basic', 0, 1);

      expect(mockPrisma.inventory.update).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        data: {
          gold: startGold - cost.gold,
          dust: startDust - cost.dust,
        },
      });
    });
  });
});
