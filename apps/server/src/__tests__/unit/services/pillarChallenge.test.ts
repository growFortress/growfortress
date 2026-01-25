/**
 * Pillar Challenge service tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  startPillarChallenge,
  abandonPillarChallenge,
  getPillarChallengeStatus,
  previewChallengeRewards,
  craftCrystal,
  assembleMatrix,
} from '../../../services/pillarChallenge.js';
import {
  mockPrisma,
  createMockPillarChallengeSession,
  createMockPillarChallengeLimits,
  createMockCrystalProgress,
  createMockInventory,
} from '../../mocks/prisma.js';

// Mock logger to prevent console output
vi.mock('../../../lib/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock sim-core pillar challenge functions
vi.mock('@arcade/sim-core', async () => {
  const actual = await vi.importActual('@arcade/sim-core');
  return {
    ...actual,
    isTierUnlocked: vi.fn((tier: string) => {
      // Normal tier always unlocked, others need progress
      return tier === 'normal';
    }),
    isCooldownExpired: vi.fn(() => true),
    getCooldownRemaining: vi.fn(() => 0),
    replayPillarChallenge: vi.fn(() => ({
      valid: true,
      state: {
        achievedBonuses: ['no_fortress_damage'],
      },
    })),
    calculateFragmentRewards: vi.fn(() => ({
      primaryFragments: 5,
      secondaryFragments: 2,
      fullCrystalEarned: false,
      fullCrystalType: null,
    })),
    calculateMaterialRewards: vi.fn(() => ({
      gold: 100,
      materials: { iron: 5 },
    })),
  };
});

describe('Pillar Challenge Service', () => {
  describe('startPillarChallenge', () => {
    beforeEach(() => {
      mockPrisma.pillarChallengeSession.findFirst.mockResolvedValue(null);
      mockPrisma.pillarChallengeLimits.findUnique.mockResolvedValue(
        createMockPillarChallengeLimits()
      );
      mockPrisma.pillarChallengeLimits.create.mockResolvedValue(
        createMockPillarChallengeLimits()
      );
      mockPrisma.pillarChallengeLimits.update.mockResolvedValue(
        createMockPillarChallengeLimits()
      );
      mockPrisma.pillarChallengeSession.findMany.mockResolvedValue([]);
      mockPrisma.inventory.findUnique.mockResolvedValue(createMockInventory({ gold: 1000 }));
      mockPrisma.inventory.update.mockResolvedValue(createMockInventory());
      mockPrisma.pillarChallengeSession.create.mockResolvedValue(
        createMockPillarChallengeSession()
      );
    });

    it('fails if user has an active session', async () => {
      mockPrisma.pillarChallengeSession.findFirst.mockResolvedValue(
        createMockPillarChallengeSession()
      );

      const result = await startPillarChallenge(
        'user-123',
        'streets',
        'normal',
        {
          fortressClass: 'natural',
          heroes: [{ heroId: 'vanguard', level: 1, artifacts: [] }],
          turrets: [{ turretId: 'railgun', slotIndex: 0 }],
        },
        false
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('aktywną sesję');
    });

    it('fails if daily free attempts exhausted and not using paid', async () => {
      mockPrisma.pillarChallengeLimits.findUnique.mockResolvedValue(
        createMockPillarChallengeLimits({ dailyAttempts: 3 }) // Max is typically 3
      );

      const result = await startPillarChallenge(
        'user-123',
        'streets',
        'normal',
        {
          fortressClass: 'natural',
          heroes: [{ heroId: 'vanguard', level: 1, artifacts: [] }],
          turrets: [{ turretId: 'railgun', slotIndex: 0 }],
        },
        false
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('darmowe próby');
    });

    it('fails if not enough gold for paid attempt', async () => {
      mockPrisma.pillarChallengeLimits.findUnique.mockResolvedValue(
        createMockPillarChallengeLimits({ dailyAttempts: 3 })
      );
      mockPrisma.inventory.findUnique.mockResolvedValue(createMockInventory({ gold: 0 }));

      const result = await startPillarChallenge(
        'user-123',
        'streets',
        'normal',
        {
          fortressClass: 'natural',
          heroes: [{ heroId: 'vanguard', level: 1, artifacts: [] }],
          turrets: [{ turretId: 'railgun', slotIndex: 0 }],
        },
        true
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('złota');
    });

    it('successfully starts a challenge', async () => {
      const result = await startPillarChallenge(
        'user-123',
        'streets',
        'normal',
        {
          fortressClass: 'natural',
          heroes: [{ heroId: 'vanguard', level: 1, artifacts: [] }],
          turrets: [{ turretId: 'railgun', slotIndex: 0 }],
        },
        false
      );

      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
      expect(result.seed).toBeDefined();
      expect(result.tierConfig).toBeDefined();
    });

    it('creates session in database', async () => {
      await startPillarChallenge(
        'user-123',
        'streets',
        'normal',
        {
          fortressClass: 'natural',
          heroes: [{ heroId: 'vanguard', level: 1, artifacts: [] }],
          turrets: [{ turretId: 'railgun', slotIndex: 0 }],
        },
        false
      );

      expect(mockPrisma.pillarChallengeSession.create).toHaveBeenCalled();
    });

    it('updates attempt counts', async () => {
      await startPillarChallenge(
        'user-123',
        'streets',
        'normal',
        {
          fortressClass: 'natural',
          heroes: [{ heroId: 'vanguard', level: 1, artifacts: [] }],
          turrets: [{ turretId: 'railgun', slotIndex: 0 }],
        },
        false
      );

      expect(mockPrisma.pillarChallengeLimits.update).toHaveBeenCalled();
    });

    it('deducts gold for paid attempts', async () => {
      mockPrisma.pillarChallengeLimits.findUnique.mockResolvedValue(
        createMockPillarChallengeLimits({ dailyAttempts: 3 })
      );
      mockPrisma.inventory.findUnique.mockResolvedValue(createMockInventory({ gold: 1000 }));

      await startPillarChallenge(
        'user-123',
        'streets',
        'normal',
        {
          fortressClass: 'natural',
          heroes: [{ heroId: 'vanguard', level: 1, artifacts: [] }],
          turrets: [{ turretId: 'railgun', slotIndex: 0 }],
        },
        true
      );

      expect(mockPrisma.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { gold: expect.objectContaining({ decrement: expect.any(Number) }) },
        })
      );
    });
  });

  describe('abandonPillarChallenge', () => {
    it('fails if session does not exist', async () => {
      mockPrisma.pillarChallengeSession.findUnique.mockResolvedValue(null);

      const result = await abandonPillarChallenge('user-123', 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('nie istnieje');
    });

    it('fails if session belongs to different user', async () => {
      mockPrisma.pillarChallengeSession.findUnique.mockResolvedValue(
        createMockPillarChallengeSession({ userId: 'other-user' })
      );

      const result = await abandonPillarChallenge('user-123', 'pcs-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('nie należy');
    });

    it('fails if session already ended', async () => {
      mockPrisma.pillarChallengeSession.findUnique.mockResolvedValue(
        createMockPillarChallengeSession({ endedAt: new Date() })
      );

      const result = await abandonPillarChallenge('user-123', 'pcs-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('zakończona');
    });

    it('successfully abandons valid session', async () => {
      mockPrisma.pillarChallengeSession.findUnique.mockResolvedValue(
        createMockPillarChallengeSession()
      );
      mockPrisma.pillarChallengeSession.update.mockResolvedValue({});

      const result = await abandonPillarChallenge('user-123', 'pcs-123');

      expect(result.success).toBe(true);
      expect(mockPrisma.pillarChallengeSession.update).toHaveBeenCalledWith({
        where: { id: 'pcs-123' },
        data: {
          endedAt: expect.any(Date),
          verified: false,
        },
      });
    });
  });

  describe('getPillarChallengeStatus', () => {
    beforeEach(() => {
      mockPrisma.pillarChallengeSession.findMany.mockResolvedValue([]);
      mockPrisma.crystalProgress.findUnique.mockResolvedValue(createMockCrystalProgress());
      mockPrisma.crystalProgress.create.mockResolvedValue(createMockCrystalProgress());
      mockPrisma.pillarChallengeLimits.findUnique.mockResolvedValue(
        createMockPillarChallengeLimits()
      );
      mockPrisma.pillarChallengeLimits.create.mockResolvedValue(
        createMockPillarChallengeLimits()
      );
    });

    it('returns status with all pillars', async () => {
      const result = await getPillarChallengeStatus('user-123');

      expect(result.success).toBe(true);
      expect(result.progress).toBeDefined();
      expect(result.progress?.length).toBe(6); // 6 pillars
    });

    it('returns crystal progress', async () => {
      mockPrisma.crystalProgress.findUnique.mockResolvedValue(
        createMockCrystalProgress({ powerFragments: 5, spaceFragments: 3 })
      );

      const result = await getPillarChallengeStatus('user-123');

      expect(result.crystalProgress?.powerFragments).toBe(5);
      expect(result.crystalProgress?.spaceFragments).toBe(3);
    });

    it('returns attempt limits', async () => {
      mockPrisma.pillarChallengeLimits.findUnique.mockResolvedValue(
        createMockPillarChallengeLimits({ dailyAttempts: 2, dailyPaidAttempts: 1 })
      );

      const result = await getPillarChallengeStatus('user-123');

      expect(result.limits?.freeAttemptsUsed).toBe(2);
      expect(result.limits?.paidAttemptsUsed).toBe(1);
    });

    it('returns unlocked tiers', async () => {
      const result = await getPillarChallengeStatus('user-123');

      expect(result.unlockedTiers).toBeDefined();
      expect(result.unlockedTiers?.streets).toContain('normal');
    });
  });

  describe('previewChallengeRewards', () => {
    it('returns reward preview for normal tier', async () => {
      const result = await previewChallengeRewards('streets', 'normal');

      expect(result.success).toBe(true);
      expect(result.baseFragments).toBeDefined();
      expect(result.crystalTypes).toBeDefined();
      expect(result.goldRange).toBeDefined();
    });

    it('returns performance bonuses', async () => {
      const result = await previewChallengeRewards('streets', 'normal');

      expect(result.performanceBonuses).toBeDefined();
      expect(Array.isArray(result.performanceBonuses)).toBe(true);
    });

    it('includes crystal types for pillar', async () => {
      const result = await previewChallengeRewards('streets', 'normal');

      expect(result.crystalTypes?.primary).toBeDefined();
    });
  });

  describe('craftCrystal', () => {
    beforeEach(() => {
      mockPrisma.crystalProgress.findUnique.mockResolvedValue(createMockCrystalProgress());
      mockPrisma.crystalProgress.create.mockResolvedValue(createMockCrystalProgress());
    });

    it('fails if not enough fragments', async () => {
      mockPrisma.crystalProgress.findUnique.mockResolvedValue(
        createMockCrystalProgress({ powerFragments: 5 })
      );

      const result = await craftCrystal('user-123', 'power');

      expect(result.success).toBe(false);
      expect(result.error).toContain('fragmentów');
    });

    it('fails if already has crystal', async () => {
      mockPrisma.crystalProgress.findUnique.mockResolvedValue(
        createMockCrystalProgress({ powerFragments: 10, fullCrystals: ['power'] })
      );

      const result = await craftCrystal('user-123', 'power');

      expect(result.success).toBe(false);
      expect(result.error).toContain('już ten kryształ');
    });

    it('successfully crafts crystal with enough fragments', async () => {
      mockPrisma.crystalProgress.findUnique.mockResolvedValue(
        createMockCrystalProgress({ powerFragments: 10 })
      );
      mockPrisma.crystalProgress.update.mockResolvedValue(
        createMockCrystalProgress({ powerFragments: 0, fullCrystals: ['power'] })
      );

      const result = await craftCrystal('user-123', 'power');

      expect(result.success).toBe(true);
      expect(result.newCrystalProgress?.fullCrystals).toContain('power');
    });

    it('deducts fragments on success', async () => {
      mockPrisma.crystalProgress.findUnique.mockResolvedValue(
        createMockCrystalProgress({ powerFragments: 15 })
      );
      mockPrisma.crystalProgress.update.mockResolvedValue(
        createMockCrystalProgress({ powerFragments: 5, fullCrystals: ['power'] })
      );

      await craftCrystal('user-123', 'power');

      expect(mockPrisma.crystalProgress.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            powerFragments: { decrement: 10 },
          }),
        })
      );
    });
  });

  describe('assembleMatrix', () => {
    beforeEach(() => {
      mockPrisma.crystalProgress.findUnique.mockResolvedValue(createMockCrystalProgress());
      mockPrisma.crystalProgress.create.mockResolvedValue(createMockCrystalProgress());
    });

    it('fails if matrix already assembled', async () => {
      mockPrisma.crystalProgress.findUnique.mockResolvedValue(
        createMockCrystalProgress({ matrixAssembled: true })
      );

      const result = await assembleMatrix('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('już zmontowana');
    });

    it('fails if missing crystals', async () => {
      mockPrisma.crystalProgress.findUnique.mockResolvedValue(
        createMockCrystalProgress({
          fullCrystals: ['power', 'space', 'time'], // Missing reality, soul, mind
        })
      );

      const result = await assembleMatrix('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Brakuje kryształów');
    });

    it('successfully assembles matrix with all crystals', async () => {
      mockPrisma.crystalProgress.findUnique.mockResolvedValue(
        createMockCrystalProgress({
          fullCrystals: ['power', 'space', 'time', 'reality', 'soul', 'mind'],
        })
      );
      mockPrisma.crystalProgress.update.mockResolvedValue(
        createMockCrystalProgress({
          fullCrystals: ['power', 'space', 'time', 'reality', 'soul', 'mind'],
          matrixAssembled: true,
        })
      );

      const result = await assembleMatrix('user-123');

      expect(result.success).toBe(true);
      expect(result.newCrystalProgress?.matrixAssembled).toBe(true);
    });

    it('returns unlocked bonuses on success', async () => {
      mockPrisma.crystalProgress.findUnique.mockResolvedValue(
        createMockCrystalProgress({
          fullCrystals: ['power', 'space', 'time', 'reality', 'soul', 'mind'],
        })
      );
      mockPrisma.crystalProgress.update.mockResolvedValue(
        createMockCrystalProgress({
          fullCrystals: ['power', 'space', 'time', 'reality', 'soul', 'mind'],
          matrixAssembled: true,
        })
      );

      const result = await assembleMatrix('user-123');

      expect(result.bonusesUnlocked).toBeDefined();
      expect(result.bonusesUnlocked?.length).toBeGreaterThan(0);
    });
  });
});
