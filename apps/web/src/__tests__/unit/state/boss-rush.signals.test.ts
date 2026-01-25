/**
 * Boss Rush signals tests
 *
 * Tests for Boss Rush mode state signals.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createMockBossRushResult } from '../../mocks/data.js';

// Import signals
import {
  // Session state
  bossRushActive,
  bossRushSessionId,
  bossRushSessionToken,
  bossRushSeed,
  bossRushStartTime,
  // Current boss state
  currentBossIndex,
  currentBossType,
  currentBossName,
  currentBossPillar,
  bossHp,
  bossMaxHp,
  currentCycle,
  // Damage tracking
  totalDamageDealt,
  currentBossDamage,
  damagePerSecond,
  damageHistory,
  // Progress & milestones
  bossesKilled,
  bossRushGoldEarned,
  bossRushDustEarned,
  bossRushMaterialsEarned,
  BOSS_RUSH_MILESTONES,
  achievedMilestones,
  // UI state
  showBossRushSetup,
  showBossRushEndScreen,
  bossRushEndResult,
  showBossRushDetails,
  bossRushIntermission,
  intermissionCountdown,
  bossRushLoading,
  bossRushError,
  // Leaderboard state
  userBestDamage,
  userBestBossesKilled,
  userBossRushRank,
  bossRushLeaderboard,
  bossRushLeaderboardLoading,
} from '../../../state/boss-rush.signals.js';

describe('Boss Rush Signals', () => {
  beforeEach(() => {
    // Reset all signals to defaults
    bossRushActive.value = false;
    bossRushSessionId.value = null;
    bossRushSessionToken.value = null;
    bossRushSeed.value = 0;
    bossRushStartTime.value = null;
    currentBossIndex.value = 0;
    currentBossType.value = null;
    currentBossName.value = '';
    currentBossPillar.value = null;
    bossHp.value = 0;
    bossMaxHp.value = 100;
    currentCycle.value = 0;
    totalDamageDealt.value = 0;
    currentBossDamage.value = 0;
    damagePerSecond.value = 0;
    damageHistory.value = [];
    bossesKilled.value = 0;
    bossRushGoldEarned.value = 0;
    bossRushDustEarned.value = 0;
    bossRushMaterialsEarned.value = {};
    achievedMilestones.value = [];
    showBossRushSetup.value = false;
    showBossRushEndScreen.value = false;
    bossRushEndResult.value = null;
    showBossRushDetails.value = false;
    bossRushIntermission.value = false;
    intermissionCountdown.value = 0;
    bossRushLoading.value = false;
    bossRushError.value = null;
    userBestDamage.value = 0;
    userBestBossesKilled.value = 0;
    userBossRushRank.value = null;
    bossRushLeaderboard.value = [];
    bossRushLeaderboardLoading.value = false;
  });

  // ==========================================================================
  // SESSION STATE
  // ==========================================================================

  describe('session state', () => {
    it('should default bossRushActive to false', () => {
      expect(bossRushActive.value).toBe(false);
    });

    it('should activate Boss Rush session', () => {
      bossRushActive.value = true;
      bossRushSessionId.value = 'session-123';
      bossRushSessionToken.value = 'token-abc';
      bossRushSeed.value = 12345;
      bossRushStartTime.value = Date.now();

      expect(bossRushActive.value).toBe(true);
      expect(bossRushSessionId.value).toBe('session-123');
      expect(bossRushSessionToken.value).toBe('token-abc');
      expect(bossRushSeed.value).toBe(12345);
      expect(bossRushStartTime.value).not.toBeNull();
    });

    it('should clear session state', () => {
      bossRushActive.value = true;
      bossRushSessionId.value = 'session-123';

      // Reset
      bossRushActive.value = false;
      bossRushSessionId.value = null;

      expect(bossRushActive.value).toBe(false);
      expect(bossRushSessionId.value).toBeNull();
    });
  });

  // ==========================================================================
  // CURRENT BOSS STATE
  // ==========================================================================

  describe('current boss state', () => {
    it('should track current boss', () => {
      currentBossIndex.value = 2;
      currentBossType.value = 'mafia_boss';
      currentBossName.value = 'Don Corleone';
      currentBossPillar.value = 'streets';

      expect(currentBossIndex.value).toBe(2);
      expect(currentBossType.value).toBe('mafia_boss');
      expect(currentBossName.value).toBe('Don Corleone');
      expect(currentBossPillar.value).toBe('streets');
    });

    it('should track boss HP', () => {
      bossHp.value = 50000;
      bossMaxHp.value = 100000;

      expect(bossHp.value).toBe(50000);
      expect(bossMaxHp.value).toBe(100000);
    });

    it('should track cycle progression', () => {
      currentCycle.value = 0;
      expect(currentCycle.value).toBe(0);

      currentCycle.value = 1; // Second cycle with 2x scaling
      expect(currentCycle.value).toBe(1);
    });
  });

  // ==========================================================================
  // DAMAGE TRACKING
  // ==========================================================================

  describe('damage tracking', () => {
    it('should track total damage', () => {
      totalDamageDealt.value = 150000;
      expect(totalDamageDealt.value).toBe(150000);
    });

    it('should track current boss damage', () => {
      currentBossDamage.value = 25000;
      expect(currentBossDamage.value).toBe(25000);
    });

    it('should track DPS', () => {
      damagePerSecond.value = 5000;
      expect(damagePerSecond.value).toBe(5000);
    });

    it('should store damage history', () => {
      damageHistory.value = [
        {
          bossIndex: 0,
          bossName: 'First Boss',
          pillarId: 'streets',
          damage: 50000,
          timeMs: 30000,
          killed: true,
        },
        {
          bossIndex: 1,
          bossName: 'Second Boss',
          pillarId: 'science',
          damage: 75000,
          timeMs: 45000,
          killed: true,
        },
      ];

      expect(damageHistory.value.length).toBe(2);
      expect(damageHistory.value[0].killed).toBe(true);
      expect(damageHistory.value[1].damage).toBe(75000);
    });
  });

  // ==========================================================================
  // PROGRESS & MILESTONES
  // ==========================================================================

  describe('progress tracking', () => {
    it('should track bosses killed', () => {
      bossesKilled.value = 5;
      expect(bossesKilled.value).toBe(5);
    });

    it('should track rewards earned', () => {
      bossRushGoldEarned.value = 5000;
      bossRushDustEarned.value = 200;
      bossRushMaterialsEarned.value = { iron: 10, crystal: 5 };

      expect(bossRushGoldEarned.value).toBe(5000);
      expect(bossRushDustEarned.value).toBe(200);
      expect(bossRushMaterialsEarned.value.iron).toBe(10);
    });

    it('should have milestone definitions', () => {
      expect(BOSS_RUSH_MILESTONES.length).toBeGreaterThan(0);
      expect(BOSS_RUSH_MILESTONES[0]).toHaveProperty('bosses');
      expect(BOSS_RUSH_MILESTONES[0]).toHaveProperty('reward');
      expect(BOSS_RUSH_MILESTONES[0]).toHaveProperty('label');
    });

    it('should track achieved milestones', () => {
      achievedMilestones.value = [0, 1]; // First two milestones
      expect(achievedMilestones.value).toContain(0);
      expect(achievedMilestones.value).toContain(1);
      expect(achievedMilestones.value.length).toBe(2);
    });
  });

  // ==========================================================================
  // UI STATE
  // ==========================================================================

  describe('UI state', () => {
    it('should toggle setup modal', () => {
      showBossRushSetup.value = true;
      expect(showBossRushSetup.value).toBe(true);
    });

    it('should toggle end screen', () => {
      showBossRushEndScreen.value = true;
      expect(showBossRushEndScreen.value).toBe(true);
    });

    it('should store end result', () => {
      const result = createMockBossRushResult();
      bossRushEndResult.value = result as any;

      expect(bossRushEndResult.value).not.toBeNull();
      expect((bossRushEndResult.value as any)?.bossesKilled).toBe(5);
    });

    it('should toggle details panel', () => {
      showBossRushDetails.value = true;
      expect(showBossRushDetails.value).toBe(true);
    });

    it('should handle intermission state', () => {
      bossRushIntermission.value = true;
      intermissionCountdown.value = 5;

      expect(bossRushIntermission.value).toBe(true);
      expect(intermissionCountdown.value).toBe(5);
    });

    it('should track loading state', () => {
      bossRushLoading.value = true;
      expect(bossRushLoading.value).toBe(true);
    });

    it('should track error state', () => {
      bossRushError.value = 'Session expired';
      expect(bossRushError.value).toBe('Session expired');

      bossRushError.value = null;
      expect(bossRushError.value).toBeNull();
    });
  });

  // ==========================================================================
  // LEADERBOARD STATE
  // ==========================================================================

  describe('leaderboard state', () => {
    it('should track user best scores', () => {
      userBestDamage.value = 500000;
      userBestBossesKilled.value = 10;

      expect(userBestDamage.value).toBe(500000);
      expect(userBestBossesKilled.value).toBe(10);
    });

    it('should track user rank', () => {
      userBossRushRank.value = 42;
      expect(userBossRushRank.value).toBe(42);
    });

    it('should store leaderboard entries', () => {
      bossRushLeaderboard.value = [
        {
          rank: 1,
          userId: 'user-1',
          displayName: 'TopPlayer',
          totalDamage: 1000000,
          bossesKilled: 21,
          createdAt: new Date().toISOString(),
        },
        {
          rank: 2,
          userId: 'user-2',
          displayName: 'SecondPlace',
          totalDamage: 900000,
          bossesKilled: 18,
          createdAt: new Date().toISOString(),
        },
      ];

      expect(bossRushLeaderboard.value.length).toBe(2);
      expect(bossRushLeaderboard.value[0].rank).toBe(1);
    });

    it('should track leaderboard loading', () => {
      bossRushLeaderboardLoading.value = true;
      expect(bossRushLeaderboardLoading.value).toBe(true);
    });
  });

  // ==========================================================================
  // SESSION FLOW SIMULATION
  // ==========================================================================

  describe('session flow', () => {
    it('should simulate starting Boss Rush', () => {
      // Start session
      bossRushLoading.value = true;

      // Session started
      bossRushLoading.value = false;
      bossRushActive.value = true;
      bossRushSessionId.value = 'session-123';
      bossRushSeed.value = 54321;
      bossRushStartTime.value = Date.now();
      currentBossIndex.value = 0;
      currentBossName.value = 'First Boss';
      bossHp.value = 100000;
      bossMaxHp.value = 100000;

      expect(bossRushActive.value).toBe(true);
      expect(currentBossIndex.value).toBe(0);
    });

    it('should simulate defeating a boss', () => {
      bossRushActive.value = true;

      // Deal damage
      currentBossDamage.value = 100000;
      totalDamageDealt.value = 100000;

      // Boss defeated
      bossesKilled.value = 1;
      damageHistory.value = [{
        bossIndex: 0,
        bossName: 'First Boss',
        pillarId: 'streets',
        damage: 100000,
        timeMs: 30000,
        killed: true,
      }];

      // Intermission
      bossRushIntermission.value = true;
      intermissionCountdown.value = 3;

      expect(bossesKilled.value).toBe(1);
      expect(bossRushIntermission.value).toBe(true);
    });

    it('should simulate ending Boss Rush', () => {
      bossRushActive.value = true;
      bossesKilled.value = 5;
      totalDamageDealt.value = 500000;

      // End session
      bossRushActive.value = false;
      showBossRushEndScreen.value = true;
      bossRushEndResult.value = {
        verified: true,
        rewards: {
          gold: 5000,
          dust: 200,
          xp: 1000,
          materials: {},
          levelUp: false,
        },
        leaderboardRank: 50,
      };

      expect(bossRushActive.value).toBe(false);
      expect(showBossRushEndScreen.value).toBe(true);
      expect(bossRushEndResult.value?.verified).toBe(true);
    });
  });
});
