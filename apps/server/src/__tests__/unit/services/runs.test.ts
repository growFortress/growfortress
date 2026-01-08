/**
 * Runs service tests
 */
import { describe, it, expect } from 'vitest';
import { startRun, getRun, isRunWithinTTL, finishRun, saveRunEvents } from '../../../services/runs.js';
import { mockPrisma, createMockRun, createMockUser, createMockInventory, createMockProgression } from '../../mocks/prisma.js';

describe('Runs Service', () => {
  describe('startRun', () => {
    it('creates run with correct fields', async () => {
      // Setup user profile mock
      const mockUser = createMockUser();
      const mockInventory = createMockInventory();
      const mockProgression = createMockProgression({ level: 5 });

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        inventory: mockInventory,
        progression: mockProgression,
      });

      const mockRun = createMockRun();
      mockPrisma.run.create.mockResolvedValue(mockRun);

      const result = await startRun('user-123');

      expect(result).not.toBeNull();
      expect(result!.runId).toBeDefined();
      expect(result!.runToken).toBeDefined();
      expect(result!.seed).toBeDefined();
      expect(result!.simVersion).toBeDefined();
      expect(result!.tickHz).toBe(30);
      expect(result!.maxWaves).toBe(10);
    });

    it('returns null if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await startRun('nonexistent');

      expect(result).toBeNull();
    });

    it('includes progression bonuses', async () => {
      const mockUser = createMockUser();
      const mockInventory = createMockInventory();
      const mockProgression = createMockProgression({ level: 10 });

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        inventory: mockInventory,
        progression: mockProgression,
      });

      mockPrisma.run.create.mockResolvedValue(createMockRun());

      const result = await startRun('user-123');

      expect(result!.progressionBonuses).toBeDefined();
      // Level 10 bonuses from unified progression system
      expect(result!.progressionBonuses.damageMultiplier).toBeGreaterThanOrEqual(1);
      expect(result!.progressionBonuses.goldMultiplier).toBeGreaterThanOrEqual(1);
      expect(result!.progressionBonuses.startingGold).toBeGreaterThanOrEqual(0);
      expect(result!.progressionBonuses.maxHeroSlots).toBe(2); // Level 10 unlocks 2nd hero slot
      expect(result!.progressionBonuses.maxTurretSlots).toBe(2); // Level 10 = 2 turret slots
    });

    it('generates 3-5 audit ticks', async () => {
      const mockUser = createMockUser();
      const mockInventory = createMockInventory();
      const mockProgression = createMockProgression();

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        inventory: mockInventory,
        progression: mockProgression,
      });

      mockPrisma.run.create.mockResolvedValue(createMockRun());

      const result = await startRun('user-123');

      expect(result!.auditTicks.length).toBeGreaterThanOrEqual(3);
      expect(result!.auditTicks.length).toBeLessThanOrEqual(5);
    });

    it('audit ticks are sorted', async () => {
      const mockUser = createMockUser();
      const mockInventory = createMockInventory();
      const mockProgression = createMockProgression();

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        inventory: mockInventory,
        progression: mockProgression,
      });

      mockPrisma.run.create.mockResolvedValue(createMockRun());

      const result = await startRun('user-123');

      for (let i = 1; i < result!.auditTicks.length; i++) {
        expect(result!.auditTicks[i]).toBeGreaterThanOrEqual(result!.auditTicks[i - 1]);
      }
    });

    it('creates database run record', async () => {
      const mockUser = createMockUser();
      const mockInventory = createMockInventory();
      const mockProgression = createMockProgression();

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        inventory: mockInventory,
        progression: mockProgression,
      });

      mockPrisma.run.create.mockResolvedValue(createMockRun());

      await startRun('user-123');

      expect(mockPrisma.run.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            tickHz: 30,
            maxWaves: 10,
          }),
        })
      );
    });
  });

  describe('getRun', () => {
    it('returns run if found', async () => {
      const mockRun = createMockRun();
      mockPrisma.run.findUnique.mockResolvedValue(mockRun);

      const result = await getRun('run-123');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('run-123');
      expect(result!.userId).toBe('user-123');
      expect(result!.seed).toBe(12345);
    });

    it('returns null if not found', async () => {
      mockPrisma.run.findUnique.mockResolvedValue(null);

      const result = await getRun('nonexistent');

      expect(result).toBeNull();
    });

    it('returns all relevant fields', async () => {
      const mockRun = createMockRun({
        simVersion: 2,
        tickHz: 60,
        maxWaves: 5,
        auditTicks: [100, 200],
        verified: true,
        endedAt: new Date(),
      });
      mockPrisma.run.findUnique.mockResolvedValue(mockRun);

      const result = await getRun('run-123');

      expect(result!.simVersion).toBe(2);
      expect(result!.tickHz).toBe(60);
      expect(result!.maxWaves).toBe(5);
      expect(result!.auditTicks).toEqual([100, 200]);
      expect(result!.verified).toBe(true);
      expect(result!.endedAt).not.toBeNull();
    });
  });

  describe('isRunWithinTTL', () => {
    it('returns true for recent run', () => {
      const issuedAt = new Date();

      const result = isRunWithinTTL(issuedAt, 600);

      expect(result).toBe(true);
    });

    it('returns false for expired run', () => {
      const issuedAt = new Date(Date.now() - 700 * 1000);

      const result = isRunWithinTTL(issuedAt, 600);

      expect(result).toBe(false);
    });

    it('uses default TTL of 600 seconds', () => {
      const issuedAt = new Date(Date.now() - 500 * 1000);

      const result = isRunWithinTTL(issuedAt);

      expect(result).toBe(true);
    });

    it('returns false exactly at expiry', () => {
      const issuedAt = new Date(Date.now() - 600 * 1000);

      const result = isRunWithinTTL(issuedAt, 600);

      expect(result).toBe(false);
    });

    it('handles custom TTL', () => {
      const issuedAt = new Date(Date.now() - 100 * 1000);

      expect(isRunWithinTTL(issuedAt, 50)).toBe(false);
      expect(isRunWithinTTL(issuedAt, 200)).toBe(true);
    });
  });

  describe('finishRun', () => {
    it('updates run with verification result', async () => {
      await finishRun(
        'run-123',
        true,
        null,
        12345678,
        5000,
        { wavesCleared: 5, kills: 50 }
      );

      expect(mockPrisma.run.update).toHaveBeenCalledWith({
        where: { id: 'run-123' },
        data: expect.objectContaining({
          verified: true,
          rejectReason: null,
          finalHash: 12345678,
          score: 5000,
        }),
      });
    });

    it('sets endedAt timestamp', async () => {
      await finishRun('run-123', true, null, 12345678, 5000, {});

      expect(mockPrisma.run.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            endedAt: expect.any(Date),
          }),
        })
      );
    });

    it('stores rejection reason when verification fails', async () => {
      await finishRun(
        'run-123',
        false,
        'FINAL_HASH_MISMATCH',
        0,
        0,
        {}
      );

      expect(mockPrisma.run.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            verified: false,
            rejectReason: 'FINAL_HASH_MISMATCH',
          }),
        })
      );
    });

    it('stores summary as JSON', async () => {
      const summary = {
        wavesCleared: 10,
        kills: 100,
        eliteKills: 5,
        goldEarned: 500,
      };

      await finishRun('run-123', true, null, 12345678, 5000, summary);

      expect(mockPrisma.run.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            summaryJson: summary,
          }),
        })
      );
    });
  });

  describe('saveRunEvents', () => {
    it('creates run event record', async () => {
      const events = [
        { type: 'ACTIVATE_SKILL', tick: 100 },
        { type: 'CHOOSE_RELIC', tick: 200, wave: 1, optionIndex: 0 },
      ];

      await saveRunEvents('run-123', events);

      expect(mockPrisma.runEvent.create).toHaveBeenCalledWith({
        data: {
          runId: 'run-123',
          data: events,
        },
      });
    });

    it('handles empty events array', async () => {
      await saveRunEvents('run-123', []);

      expect(mockPrisma.runEvent.create).toHaveBeenCalledWith({
        data: {
          runId: 'run-123',
          data: [],
        },
      });
    });
  });
});
