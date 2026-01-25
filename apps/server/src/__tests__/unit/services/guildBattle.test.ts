/**
 * Guild Battle Service Unit Tests
 *
 * Tests for instant attack, shield system, daily limits, and cooldowns
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  mockPrisma,
  createMockGuild,
  createMockGuildMember,
  createMockGuildShield,
  createMockGuildBattle,
} from '../../mocks/prisma.js';

// Mock prisma
vi.mock('../../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

// Mock guild service
vi.mock('../../../services/guild.js', () => ({
  hasPermission: vi.fn().mockReturnValue(true),
}));

// Mock guildBattleHero service
vi.mock('../../../services/guildBattleHero.js', () => ({
  getMembersWithBattleHeroes: vi.fn(),
  createBattleHeroSnapshots: vi.fn(),
}));

// Mock guildTreasury service
vi.mock('../../../services/guildTreasury.js', () => ({
  payBattleCost: vi.fn(),
}));

// Mock sim-core arena
vi.mock('@arcade/sim-core', () => ({
  runGuildArena: vi.fn().mockReturnValue({
    winnerSide: 'attacker',
    winReason: 'elimination',
    attackerSurvivors: 3,
    defenderSurvivors: 0,
    attackerTotalDamage: 50000,
    defenderTotalDamage: 30000,
    mvp: { ownerId: 'user-1', heroId: 'vanguard', ownerName: 'Player1', damage: 20000, kills: 2 },
    keyMoments: [],
    killLog: [],
    duration: 300,
  }),
}));

import {
  getShieldStatus,
  activateShield,
  getDailyAttackCount,
  getDailyDefenseCount,
  canAttackGuild,
  instantAttack,
  getGuildBattles,
  getBattle,
  getAttackStatus,
  calculateHonorChange,
} from '../../../services/guildBattle.js';
import { hasPermission } from '../../../services/guild.js';
import { getMembersWithBattleHeroes, createBattleHeroSnapshots } from '../../../services/guildBattleHero.js';
import { payBattleCost } from '../../../services/guildTreasury.js';

describe('Guild Battle Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // HONOR CALCULATION TESTS
  // ============================================================================

  describe('calculateHonorChange', () => {
    it('winner gains honor', () => {
      const change = calculateHonorChange(1000, 1000, 5000, 5000);
      expect(change.winnerGain).toBeGreaterThan(0);
    });

    it('loser loses honor', () => {
      const change = calculateHonorChange(1000, 1000, 5000, 5000);
      expect(change.loserLoss).toBeGreaterThan(0);
    });

    it('underdog bonus for beating stronger guild', () => {
      // Weaker winner (lower power)
      const changeWeak = calculateHonorChange(1000, 1000, 3000, 5000);
      // Stronger winner (higher power)
      const changeStrong = calculateHonorChange(1000, 1000, 7000, 5000);

      // Underdog should gain more
      expect(changeWeak.winnerGain).toBeGreaterThan(changeStrong.winnerGain);
    });

    it('honor cannot go below minimum (100)', () => {
      // Loser has low honor
      const change = calculateHonorChange(1000, 150, 5000, 5000);
      // Loss should be capped
      expect(change.loserLoss).toBeLessThanOrEqual(50); // 150 - 100 = 50 max loss
    });

    it('loser expected to win loses more honor', () => {
      // When higher-rated (1200) beats lower-rated (1000) - expected outcome
      const expectedResult = calculateHonorChange(1200, 1000, 5000, 5000);
      // When lower-rated (800) beats higher-rated (1000) - upset
      const upsetResult = calculateHonorChange(800, 1000, 5000, 5000);

      // In expected result, loser was expected to lose (low expected win)
      // In upset, loser was expected to win (high expected win)
      // ELO: you lose more honor when expected to win but lose
      expect(expectedResult.loserLoss).toBeGreaterThan(upsetResult.loserLoss);
    });
  });

  // ============================================================================
  // SHIELD SYSTEM TESTS
  // ============================================================================

  describe('Shield System', () => {
    describe('getShieldStatus', () => {
      it('returns inactive status when no shield exists', async () => {
        mockPrisma.guildShield.findUnique.mockResolvedValue(null);

        const status = await getShieldStatus('guild-123');

        expect(status.isActive).toBe(false);
        expect(status.shield).toBeNull();
        expect(status.canActivate).toBe(true);
      });

      it('returns active status when shield is valid', async () => {
        const futureDate = new Date();
        futureDate.setHours(futureDate.getHours() + 12);

        mockPrisma.guildShield.findUnique.mockResolvedValue(
          createMockGuildShield({ expiresAt: futureDate })
        );

        const status = await getShieldStatus('guild-123');

        expect(status.isActive).toBe(true);
        expect(status.shield).not.toBeNull();
        expect(status.canActivate).toBe(false);
      });

      it('returns inactive status when shield is expired', async () => {
        const pastDate = new Date();
        pastDate.setHours(pastDate.getHours() - 1);

        mockPrisma.guildShield.findUnique.mockResolvedValue(
          createMockGuildShield({ expiresAt: pastDate })
        );

        const status = await getShieldStatus('guild-123');

        expect(status.isActive).toBe(false);
      });

      it('tracks weekly shield usage', async () => {
        mockPrisma.guildShield.findUnique.mockResolvedValue(
          createMockGuildShield({ weeklyCount: 1 })
        );

        const status = await getShieldStatus('guild-123');

        expect(status.weeklyUsed).toBe(1);
      });
    });

    describe('activateShield', () => {
      it('requires guild membership', async () => {
        mockPrisma.guildMember.findUnique.mockResolvedValue(null);

        const result = await activateShield('guild-123', 'user-123');

        expect(result.success).toBe(false);
        expect(result.error).toBe('NOT_IN_GUILD');
      });

      it('requires battle permission', async () => {
        mockPrisma.guildMember.findUnique.mockResolvedValue(
          createMockGuildMember({ role: 'MEMBER' })
        );
        (hasPermission as ReturnType<typeof vi.fn>).mockReturnValue(false);
        mockPrisma.guildShield.findUnique.mockResolvedValue(null);

        const result = await activateShield('guild-123', 'user-123');

        expect(result.success).toBe(false);
        expect(result.error).toBe('INSUFFICIENT_PERMISSIONS');
      });

      it('fails if shield already active', async () => {
        mockPrisma.guildMember.findUnique.mockResolvedValue(
          createMockGuildMember({ role: 'LEADER' })
        );
        (hasPermission as ReturnType<typeof vi.fn>).mockReturnValue(true);

        const futureDate = new Date();
        futureDate.setHours(futureDate.getHours() + 12);
        mockPrisma.guildShield.findUnique.mockResolvedValue(
          createMockGuildShield({ expiresAt: futureDate })
        );

        const result = await activateShield('guild-123', 'user-123');

        expect(result.success).toBe(false);
        expect(result.error).toBe('SHIELD_ALREADY_ACTIVE');
      });

      it('fails if weekly limit reached', async () => {
        mockPrisma.guildMember.findUnique.mockResolvedValue(
          createMockGuildMember({ role: 'LEADER' })
        );
        (hasPermission as ReturnType<typeof vi.fn>).mockReturnValue(true);

        // Expired shield but 2 uses this week
        const pastDate = new Date();
        pastDate.setHours(pastDate.getHours() - 1);
        mockPrisma.guildShield.findUnique.mockResolvedValue(
          createMockGuildShield({ expiresAt: pastDate, weeklyCount: 2 })
        );

        const result = await activateShield('guild-123', 'user-123');

        expect(result.success).toBe(false);
        expect(result.error).toBe('SHIELD_WEEKLY_LIMIT');
      });

      it('requires sufficient treasury funds', async () => {
        mockPrisma.guildMember.findUnique.mockResolvedValue(
          createMockGuildMember({ role: 'LEADER' })
        );
        (hasPermission as ReturnType<typeof vi.fn>).mockReturnValue(true);
        mockPrisma.guildShield.findUnique.mockResolvedValue(null);
        (payBattleCost as ReturnType<typeof vi.fn>).mockRejectedValue(
          new Error('Insufficient funds')
        );

        const result = await activateShield('guild-123', 'user-123');

        expect(result.success).toBe(false);
        expect(result.error).toBe('TREASURY_INSUFFICIENT');
      });

      it('creates shield with 24h duration on success', async () => {
        mockPrisma.guildMember.findUnique.mockResolvedValue(
          createMockGuildMember({ role: 'LEADER' })
        );
        (hasPermission as ReturnType<typeof vi.fn>).mockReturnValue(true);
        mockPrisma.guildShield.findUnique.mockResolvedValue(null);
        (payBattleCost as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

        const mockShield = createMockGuildShield();
        mockPrisma.guildShield.upsert.mockResolvedValue(mockShield);

        const result = await activateShield('guild-123', 'user-123');

        expect(result.success).toBe(true);
        expect(result.shield).toBeDefined();
        expect(payBattleCost).toHaveBeenCalledWith(
          'guild-123',
          'user-123',
          expect.any(Number),
          'shield',
          'SHIELD_PURCHASE'
        );
      });
    });
  });

  // ============================================================================
  // ATTACK LIMITS TESTS
  // ============================================================================

  describe('Attack Limits', () => {
    describe('getDailyAttackCount', () => {
      it('counts attacks from today', async () => {
        mockPrisma.guildBattle.count.mockResolvedValue(5);

        const count = await getDailyAttackCount('guild-123');

        expect(count).toBe(5);
        expect(mockPrisma.guildBattle.count).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              attackerGuildId: 'guild-123',
            }),
          })
        );
      });
    });

    describe('getDailyDefenseCount', () => {
      it('counts defenses from today', async () => {
        mockPrisma.guildBattle.count.mockResolvedValue(3);

        const count = await getDailyDefenseCount('guild-123');

        expect(count).toBe(3);
        expect(mockPrisma.guildBattle.count).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              defenderGuildId: 'guild-123',
            }),
          })
        );
      });
    });

    describe('canAttackGuild', () => {
      it('blocks attacking same guild', async () => {
        const result = await canAttackGuild('guild-123', 'guild-123');

        expect(result.canAttack).toBe(false);
        expect(result.cooldownEndsAt).toBeUndefined();
      });

      it('allows attack if no recent battle', async () => {
        mockPrisma.guildBattle.findFirst.mockResolvedValue(null);

        const result = await canAttackGuild('guild-123', 'guild-456');

        expect(result.canAttack).toBe(true);
        expect(result.cooldownEndsAt).toBeUndefined();
      });

      it('blocks attack if recent battle exists', async () => {
        const recentBattle = createMockGuildBattle({
          createdAt: new Date(),
        });
        mockPrisma.guildBattle.findFirst.mockResolvedValue(recentBattle);

        const result = await canAttackGuild('guild-123', 'guild-456');

        expect(result.canAttack).toBe(false);
        expect(result.cooldownEndsAt).toBeDefined();
      });
    });
  });

  // ============================================================================
  // INSTANT ATTACK TESTS
  // ============================================================================

  describe('instantAttack', () => {
    const selectedMemberIds = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'];

    beforeEach(() => {
      // Setup default successful mocks
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER' })
      );
      (hasPermission as ReturnType<typeof vi.fn>).mockReturnValue(true);
      mockPrisma.guildShield.findUnique.mockResolvedValue(null);
      mockPrisma.guildBattle.count.mockResolvedValue(0);
      mockPrisma.guildBattle.findFirst.mockResolvedValue(null);

      const mockMembers = selectedMemberIds.map(id => ({
        userId: id,
        battleHeroId: 'vanguard',
        battleHeroPower: 1000,
      }));
      (getMembersWithBattleHeroes as ReturnType<typeof vi.fn>).mockResolvedValue(mockMembers);

      const mockSnapshots = selectedMemberIds.map(id => ({
        userId: id,
        displayName: `Player ${id}`,
        heroId: 'vanguard',
        tier: 1,
        power: 1000,
      }));
      (createBattleHeroSnapshots as ReturnType<typeof vi.fn>).mockResolvedValue(mockSnapshots);

      mockPrisma.guild.findUnique.mockResolvedValue(createMockGuild({ honor: 1000 }));
    });

    it('requires exactly 5 members', async () => {
      const result = await instantAttack(
        'guild-123',
        'guild-456',
        'user-123',
        ['user-1', 'user-2', 'user-3'] // Only 3 members
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_MEMBER_SELECTION');
    });

    it('blocks attacking own guild', async () => {
      const result = await instantAttack(
        'guild-123',
        'guild-123',
        'user-123',
        selectedMemberIds
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('CANNOT_ATTACK_SELF');
    });

    it('requires attacker guild membership', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);

      const result = await instantAttack(
        'guild-123',
        'guild-456',
        'user-123',
        selectedMemberIds
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('NOT_IN_GUILD');
    });

    it('requires battle permission', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'MEMBER' })
      );
      (hasPermission as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const result = await instantAttack(
        'guild-123',
        'guild-456',
        'user-123',
        selectedMemberIds
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('blocks attack when attacker has active shield', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 12);

      // First call for attacker guild, second for defender
      mockPrisma.guildShield.findUnique
        .mockResolvedValueOnce(createMockGuildShield({ expiresAt: futureDate }));

      const result = await instantAttack(
        'guild-123',
        'guild-456',
        'user-123',
        selectedMemberIds
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('ATTACKER_SHIELD_ACTIVE');
    });

    it('blocks attack when defender has active shield', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 12);

      // First call for attacker (no shield), second for defender (has shield)
      mockPrisma.guildShield.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createMockGuildShield({ expiresAt: futureDate }));

      const result = await instantAttack(
        'guild-123',
        'guild-456',
        'user-123',
        selectedMemberIds
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('DEFENDER_SHIELD_ACTIVE');
    });

    it('respects daily attack limit (10)', async () => {
      mockPrisma.guildBattle.count.mockResolvedValue(10);

      const result = await instantAttack(
        'guild-123',
        'guild-456',
        'user-123',
        selectedMemberIds
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('DAILY_ATTACK_LIMIT');
    });

    it('respects cooldown per guild pair', async () => {
      mockPrisma.guildBattle.count.mockResolvedValue(0);
      mockPrisma.guildBattle.findFirst.mockResolvedValue(
        createMockGuildBattle({ createdAt: new Date() })
      );

      const result = await instantAttack(
        'guild-123',
        'guild-456',
        'user-123',
        selectedMemberIds
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('BATTLE_COOLDOWN');
    });

    it('validates selected members belong to guild', async () => {
      // Mock count to return fewer valid members than selected
      mockPrisma.guildMember.count.mockResolvedValue(2); // Only 2 of 5 are valid

      const result = await instantAttack(
        'guild-123',
        'guild-456',
        'user-123',
        selectedMemberIds
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_MEMBER_SELECTION');
    });

    it('fails if defender has fewer than 5 battle heroes', async () => {
      // Mock count to return all 5 attackers are valid
      mockPrisma.guildMember.count.mockResolvedValue(5);

      // Defender has too few battle heroes
      (getMembersWithBattleHeroes as ReturnType<typeof vi.fn>).mockResolvedValue([
        { userId: 'def-1', battleHeroId: 'vanguard', battleHeroPower: 1000 },
        { userId: 'def-2', battleHeroId: 'vanguard', battleHeroPower: 1000 },
      ]);

      const result = await instantAttack(
        'guild-123',
        'guild-456',
        'user-123',
        selectedMemberIds
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('NOT_ENOUGH_BATTLE_HEROES');
    });

    it('respects defender daily defense limit (5)', async () => {
      // Attacker has 0 attacks, defender has reached max defenses
      mockPrisma.guildBattle.count
        .mockResolvedValueOnce(0) // Attacker daily attacks
        .mockResolvedValueOnce(5); // Defender daily defenses (max is 5)

      const result = await instantAttack(
        'guild-123',
        'guild-456',
        'user-123',
        selectedMemberIds
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('DEFENDER_MAX_ATTACKS_RECEIVED');
    });
  });

  // ============================================================================
  // BATTLE QUERIES TESTS
  // ============================================================================

  describe('Battle Queries', () => {
    describe('getGuildBattles', () => {
      it('returns paginated battle history', async () => {
        const mockBattles = [createMockGuildBattle(), createMockGuildBattle()];
        mockPrisma.guildBattle.findMany.mockResolvedValue(mockBattles);
        mockPrisma.guildBattle.count.mockResolvedValue(10);

        const result = await getGuildBattles('guild-123', 'all', 2, 0);

        expect(result.battles).toHaveLength(2);
        expect(result.total).toBe(10);
      });

      it('filters by type (sent)', async () => {
        mockPrisma.guildBattle.findMany.mockResolvedValue([]);
        mockPrisma.guildBattle.count.mockResolvedValue(0);

        await getGuildBattles('guild-123', 'sent', 10, 0);

        expect(mockPrisma.guildBattle.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: [{ attackerGuildId: 'guild-123' }],
            }),
          })
        );
      });

      it('filters by type (received)', async () => {
        mockPrisma.guildBattle.findMany.mockResolvedValue([]);
        mockPrisma.guildBattle.count.mockResolvedValue(0);

        await getGuildBattles('guild-123', 'received', 10, 0);

        expect(mockPrisma.guildBattle.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: [{ defenderGuildId: 'guild-123' }],
            }),
          })
        );
      });

      it('orders by createdAt descending', async () => {
        mockPrisma.guildBattle.findMany.mockResolvedValue([]);
        mockPrisma.guildBattle.count.mockResolvedValue(0);

        await getGuildBattles('guild-123');

        expect(mockPrisma.guildBattle.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: { createdAt: 'desc' },
          })
        );
      });
    });

    describe('getBattle', () => {
      it('returns battle by ID', async () => {
        const mockBattle = createMockGuildBattle();
        mockPrisma.guildBattle.findUnique.mockResolvedValue(mockBattle);

        const result = await getBattle('battle-123');

        expect(result).not.toBeNull();
        expect(mockPrisma.guildBattle.findUnique).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'battle-123' },
          })
        );
      });

      it('returns null for non-existent battle', async () => {
        mockPrisma.guildBattle.findUnique.mockResolvedValue(null);

        const result = await getBattle('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('getAttackStatus', () => {
      it('returns correct attack status', async () => {
        mockPrisma.guildBattle.count.mockResolvedValue(5);
        mockPrisma.guildShield.findUnique.mockResolvedValue(null);

        const status = await getAttackStatus('guild-123');

        expect(status.dailyAttacks).toBe(5);
        expect(status.maxDailyAttacks).toBe(10);
        expect(status.canAttack).toBe(true);
        expect(status.nextResetAt).toBeInstanceOf(Date);
      });

      it('cannot attack when at daily limit', async () => {
        mockPrisma.guildBattle.count.mockResolvedValue(10);
        mockPrisma.guildShield.findUnique.mockResolvedValue(null);

        const status = await getAttackStatus('guild-123');

        expect(status.canAttack).toBe(false);
      });

      it('cannot attack when shield is active', async () => {
        mockPrisma.guildBattle.count.mockResolvedValue(0);
        const futureDate = new Date();
        futureDate.setHours(futureDate.getHours() + 12);
        mockPrisma.guildShield.findUnique.mockResolvedValue(
          createMockGuildShield({ expiresAt: futureDate })
        );

        const status = await getAttackStatus('guild-123');

        expect(status.canAttack).toBe(false);
      });
    });
  });
});
