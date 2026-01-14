/**
 * Unit tests for hubPreview service
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getHubPreview, invalidateHubPreviewCache } from '../../../services/hubPreview.js';
import { mockPrisma } from '../../mocks/prisma.js';
import { setMockRedisValue, getMockRedisKeys } from '../../mocks/redis.js';

// Import test setup
import '../../helpers/setup.js';

describe('HubPreview Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getHubPreview', () => {
    const userId = 'user-123';

    it('should return null for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await getHubPreview(userId);

      expect(result).toBeNull();
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: userId, banned: false },
        })
      );
    });

    it('should return null for banned user', async () => {
      // The query has `banned: false` filter, so banned users won't be found
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await getHubPreview(userId);

      expect(result).toBeNull();
    });

    it('should return cached data if available', async () => {
      const cachedData = {
        userId,
        displayName: 'CachedUser',
        description: null,
        guildId: null,
        guildTag: null,
        level: 5,
        highestWave: 50,
        totalPower: 1500,
        fortressClass: 'fire',
        exclusiveItems: [],
        heroes: [],
        turrets: [],
      };

      setMockRedisValue(`hub:preview:${userId}`, JSON.stringify(cachedData));

      const result = await getHubPreview(userId);

      expect(result).toEqual(cachedData);
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should fetch and return basic user data', async () => {
      const mockUser = {
        id: userId,
        displayName: 'TestPlayer',
        description: 'A test player',
        highestWave: 100,
        defaultFortressClass: 'ice',
        exclusiveItems: ['legendary_sword'],
        progression: { level: 10 },
        powerUpgrades: {
          heroUpgrades: [],
          turretUpgrades: [],
          cachedTotalPower: 2500,
        },
        inventory: {
          unlockedHeroIds: [],
          unlockedTurretIds: [],
        },
        artifacts: [],
        guildMembership: null,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await getHubPreview(userId);

      expect(result).not.toBeNull();
      expect(result?.userId).toBe(userId);
      expect(result?.displayName).toBe('TestPlayer');
      expect(result?.description).toBe('A test player');
      expect(result?.highestWave).toBe(100);
      expect(result?.fortressClass).toBe('ice');
      expect(result?.level).toBe(10);
      expect(result?.totalPower).toBe(2500);
      expect(result?.exclusiveItems).toEqual(['legendary_sword']);
      expect(result?.guildTag).toBeNull();
    });

    it('should include guild tag when user is in a guild', async () => {
      const mockUser = {
        id: userId,
        displayName: 'GuildMember',
        description: null,
        highestWave: 50,
        defaultFortressClass: 'natural',
        exclusiveItems: [],
        progression: { level: 5 },
        powerUpgrades: null,
        inventory: null,
        artifacts: [],
        guildMembership: {
          guild: { tag: 'BEST' },
        },
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await getHubPreview(userId);

      expect(result?.guildTag).toBe('BEST');
    });

    it('should build heroes array from unlocked heroes with upgrades', async () => {
      const mockUser = {
        id: userId,
        displayName: 'HeroPlayer',
        description: null,
        highestWave: 75,
        defaultFortressClass: 'lightning',
        exclusiveItems: [],
        progression: { level: 15 },
        powerUpgrades: {
          heroUpgrades: [
            { heroId: 'storm', statUpgrades: { hp: 10, damage: 5 } },
            { heroId: 'frost', statUpgrades: { hp: 3, damage: 2 } },
          ],
          turretUpgrades: [],
          cachedTotalPower: 3000,
        },
        inventory: {
          unlockedHeroIds: ['storm', 'frost', 'vanguard'],
          unlockedTurretIds: [],
        },
        artifacts: [],
        guildMembership: null,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await getHubPreview(userId);

      expect(result?.heroes).toHaveLength(3);

      const stormHero = result?.heroes.find(h => h.heroId === 'storm');
      expect(stormHero).toBeDefined();
      expect(stormHero?.level).toBe(15); // hp(10) + damage(5)
      expect(stormHero?.tier).toBe(1);

      const frostHero = result?.heroes.find(h => h.heroId === 'frost');
      expect(frostHero?.level).toBe(5); // hp(3) + damage(2)

      const vanguardHero = result?.heroes.find(h => h.heroId === 'vanguard');
      expect(vanguardHero?.level).toBe(0); // No upgrades
    });

    it('should include equipped artifacts for heroes', async () => {
      const mockUser = {
        id: userId,
        displayName: 'ArtifactPlayer',
        description: null,
        highestWave: 100,
        defaultFortressClass: 'magic',
        exclusiveItems: [],
        progression: { level: 20 },
        powerUpgrades: {
          heroUpgrades: [],
          turretUpgrades: [],
          cachedTotalPower: 5000,
        },
        inventory: {
          unlockedHeroIds: ['storm'],
          unlockedTurretIds: [],
        },
        artifacts: [
          {
            artifactId: 'blazing_sword',
            level: 5,
            equippedSlot: 'weapon',
            equippedToHeroId: 'storm',
          },
          {
            artifactId: 'iron_armor',
            level: 3,
            equippedSlot: 'armor',
            equippedToHeroId: 'storm',
          },
          {
            artifactId: 'unequipped_ring',
            level: 1,
            equippedSlot: null,
            equippedToHeroId: null,
          },
        ],
        guildMembership: null,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await getHubPreview(userId);

      const stormHero = result?.heroes.find(h => h.heroId === 'storm');
      expect(stormHero?.equippedArtifacts).toHaveLength(2);

      const weapon = stormHero?.equippedArtifacts.find(a => a.slotType === 'weapon');
      expect(weapon?.artifactId).toBe('blazing_sword');
      expect(weapon?.level).toBe(5);

      const armor = stormHero?.equippedArtifacts.find(a => a.slotType === 'armor');
      expect(armor?.artifactId).toBe('iron_armor');
      expect(armor?.level).toBe(3);
    });

    it('should build turrets array from unlocked turrets with upgrades', async () => {
      const mockUser = {
        id: userId,
        displayName: 'TurretPlayer',
        description: null,
        highestWave: 80,
        defaultFortressClass: 'tech',
        exclusiveItems: [],
        progression: { level: 12 },
        powerUpgrades: {
          heroUpgrades: [],
          turretUpgrades: [
            { turretType: 'railgun', statUpgrades: { damage: 8, attackSpeed: 4 } },
            { turretType: 'artillery', statUpgrades: { damage: 5, attackSpeed: 2 } },
          ],
          cachedTotalPower: 2800,
        },
        inventory: {
          unlockedHeroIds: [],
          unlockedTurretIds: ['railgun', 'artillery', 'flamethrower'],
        },
        artifacts: [],
        guildMembership: null,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await getHubPreview(userId);

      expect(result?.turrets).toHaveLength(3);

      const railgun = result?.turrets.find(t => t.turretType === 'railgun');
      expect(railgun?.level).toBe(12); // damage(8) + attackSpeed(4)
      expect(railgun?.slotIndex).toBe(0);

      const artillery = result?.turrets.find(t => t.turretType === 'artillery');
      expect(artillery?.level).toBe(7); // damage(5) + attackSpeed(2)
      expect(artillery?.slotIndex).toBe(1);

      const flamethrower = result?.turrets.find(t => t.turretType === 'flamethrower');
      expect(flamethrower?.level).toBe(0); // No upgrades
      expect(flamethrower?.slotIndex).toBe(2);
    });

    it('should use default values when optional data is missing', async () => {
      const mockUser = {
        id: userId,
        displayName: 'MinimalPlayer',
        description: null,
        highestWave: 0,
        defaultFortressClass: null,
        exclusiveItems: null,
        progression: null,
        powerUpgrades: null,
        inventory: null,
        artifacts: [],
        guildMembership: null,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await getHubPreview(userId);

      expect(result?.level).toBe(1); // Default level
      expect(result?.totalPower).toBe(0); // Default power
      expect(result?.fortressClass).toBe('natural'); // Default class
      expect(result?.exclusiveItems).toEqual([]); // Empty array
      expect(result?.heroes).toEqual([]); // No heroes
      expect(result?.turrets).toEqual([]); // No turrets
    });

    it('should cache the result after fetching from database', async () => {
      const mockUser = {
        id: userId,
        displayName: 'CacheTestPlayer',
        description: null,
        highestWave: 50,
        defaultFortressClass: 'fire',
        exclusiveItems: [],
        progression: { level: 5 },
        powerUpgrades: null,
        inventory: null,
        artifacts: [],
        guildMembership: null,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      // First call - fetches from DB and caches
      const result1 = await getHubPreview(userId);
      expect(result1?.displayName).toBe('CacheTestPlayer');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await getHubPreview(userId);
      expect(result2?.displayName).toBe('CacheTestPlayer');
      // Still only 1 call because second call used cache
      expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('invalidateHubPreviewCache', () => {
    const userId = 'user-123';

    it('should delete cache key for user', async () => {
      // Set up cached data
      setMockRedisValue(`hub:preview:${userId}`, JSON.stringify({ userId }));

      // Verify cache exists
      let keys = getMockRedisKeys();
      expect(keys).toContain(`hub:preview:${userId}`);

      // Invalidate cache
      await invalidateHubPreviewCache(userId);

      // After fetching again, prisma should be called
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const result = await getHubPreview(userId);

      expect(result).toBeNull();
      expect(mockPrisma.user.findUnique).toHaveBeenCalled();
    });
  });
});
