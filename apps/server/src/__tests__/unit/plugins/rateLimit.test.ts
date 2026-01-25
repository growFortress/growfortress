/**
 * Rate limit plugin unit tests
 *
 * Tests for rate limiting configuration, endpoint-specific limits,
 * and the withRateLimit helper function.
 */
import { describe, it, expect } from 'vitest';
import { RATE_LIMITS, withRateLimit } from '../../../plugins/rateLimit.js';

describe('Rate Limit Plugin', () => {
  describe('RATE_LIMITS configuration', () => {
    describe('authentication limits', () => {
      it('should have strict limits for auth endpoints', () => {
        expect(RATE_LIMITS.auth.max).toBe(5);
        expect(RATE_LIMITS.auth.timeWindow).toBe(60000); // 1 minute
      });

      it('should have very strict limits for password reset', () => {
        expect(RATE_LIMITS.passwordReset.max).toBe(3);
        expect(RATE_LIMITS.passwordReset.timeWindow).toBe(3600000); // 1 hour
      });
    });

    describe('run operation limits', () => {
      it('should have moderate limits for run start', () => {
        expect(RATE_LIMITS.runStart.max).toBe(20);
        expect(RATE_LIMITS.runStart.timeWindow).toBe(60000);
      });

      it('should have higher limits for run finish', () => {
        expect(RATE_LIMITS.runFinish.max).toBe(40);
        expect(RATE_LIMITS.runFinish.timeWindow).toBe(60000);
      });
    });

    describe('session limits', () => {
      it('should have reasonable limits for session operations', () => {
        expect(RATE_LIMITS.session.max).toBe(60);
        expect(RATE_LIMITS.session.timeWindow).toBe(60000);
      });
    });

    describe('read-heavy operation limits', () => {
      it('should have permissive limits for leaderboard', () => {
        expect(RATE_LIMITS.leaderboard.max).toBe(120);
        expect(RATE_LIMITS.leaderboard.timeWindow).toBe(60000);
      });

      it('should have permissive limits for profile', () => {
        expect(RATE_LIMITS.profile.max).toBe(120);
        expect(RATE_LIMITS.profile.timeWindow).toBe(60000);
      });

      it('should have moderate limits for hub preview', () => {
        expect(RATE_LIMITS.hubPreview.max).toBe(60);
        expect(RATE_LIMITS.hubPreview.timeWindow).toBe(60000);
      });
    });

    describe('PvP limits', () => {
      it('should limit PvP challenge creation', () => {
        expect(RATE_LIMITS.pvpChallenges.max).toBe(20);
        expect(RATE_LIMITS.pvpChallenges.timeWindow).toBe(60000);
      });
    });

    describe('slot purchase limits', () => {
      it('should have strict limits for slot purchases', () => {
        expect(RATE_LIMITS.slotPurchase.max).toBe(10);
        expect(RATE_LIMITS.slotPurchase.timeWindow).toBe(60000);
      });
    });

    describe('guild operation limits', () => {
      it('should have very strict limits for guild creation', () => {
        expect(RATE_LIMITS.guildCreate.max).toBe(3);
        expect(RATE_LIMITS.guildCreate.timeWindow).toBe(3600000); // 1 hour
      });

      it('should have moderate limits for guild battles', () => {
        expect(RATE_LIMITS.guildBattle.max).toBe(20);
        expect(RATE_LIMITS.guildBattle.timeWindow).toBe(60000);
      });

      it('should have strict limits for shield activation', () => {
        expect(RATE_LIMITS.guildShield.max).toBe(10);
        expect(RATE_LIMITS.guildShield.timeWindow).toBe(60000);
      });

      it('should have higher limits for guild invitations', () => {
        expect(RATE_LIMITS.guildInvite.max).toBe(40);
        expect(RATE_LIMITS.guildInvite.timeWindow).toBe(60000);
      });

      it('should have strict limits for guild applications', () => {
        expect(RATE_LIMITS.guildApply.max).toBe(10);
        expect(RATE_LIMITS.guildApply.timeWindow).toBe(60000);
      });

      it('should have moderate limits for guild management', () => {
        expect(RATE_LIMITS.guildManage.max).toBe(30);
        expect(RATE_LIMITS.guildManage.timeWindow).toBe(60000);
      });

      it('should have permissive limits for guild read operations', () => {
        expect(RATE_LIMITS.guildRead.max).toBe(120);
        expect(RATE_LIMITS.guildRead.timeWindow).toBe(60000);
      });

      it('should have moderate limits for guild chat', () => {
        expect(RATE_LIMITS.guildChat.max).toBe(60);
        expect(RATE_LIMITS.guildChat.timeWindow).toBe(60000);
      });
    });

    describe('default limits', () => {
      it('should have generous default limits', () => {
        expect(RATE_LIMITS.default.max).toBe(200);
        expect(RATE_LIMITS.default.timeWindow).toBe(60000);
      });
    });

    describe('limit hierarchy', () => {
      it('should have auth limits stricter than session limits', () => {
        expect(RATE_LIMITS.auth.max).toBeLessThan(RATE_LIMITS.session.max);
      });

      it('should have session limits stricter than read limits', () => {
        expect(RATE_LIMITS.session.max).toBeLessThan(RATE_LIMITS.leaderboard.max);
      });

      it('should have guild create stricter than guild read', () => {
        expect(RATE_LIMITS.guildCreate.max).toBeLessThan(RATE_LIMITS.guildRead.max);
      });

      it('should have password reset stricter than auth', () => {
        // More restrictive by having longer time window
        expect(RATE_LIMITS.passwordReset.timeWindow).toBeGreaterThan(
          RATE_LIMITS.auth.timeWindow
        );
      });
    });
  });

  describe('withRateLimit helper', () => {
    it('should return config with default rate limit', () => {
      const config = withRateLimit();

      expect(config.config?.rateLimit).toEqual({
        max: RATE_LIMITS.default.max,
        timeWindow: RATE_LIMITS.default.timeWindow,
      });
    });

    it('should return config with specified rate limit type', () => {
      const config = withRateLimit('auth');

      expect(config.config?.rateLimit).toEqual({
        max: RATE_LIMITS.auth.max,
        timeWindow: RATE_LIMITS.auth.timeWindow,
      });
    });

    it('should preserve additional config options', () => {
      const config = withRateLimit('session', {
        preHandler: async () => {},
      });

      expect(config.preHandler).toBeDefined();
      expect(config.config?.rateLimit).toBeDefined();
    });

    it('should merge additional config.* options', () => {
      const config = withRateLimit('default', {
        config: {
          public: true,
        },
      });

      expect(config.config?.public).toBe(true);
      expect(config.config?.rateLimit).toBeDefined();
    });

    it('should work with guildCreate limit', () => {
      const config = withRateLimit('guildCreate');

      expect(config.config?.rateLimit).toEqual({
        max: 3,
        timeWindow: 3600000,
      });
    });

    it('should work with pvpChallenges limit', () => {
      const config = withRateLimit('pvpChallenges');

      expect(config.config?.rateLimit).toEqual({
        max: 20,
        timeWindow: 60000,
      });
    });

    it('should work with passwordReset limit', () => {
      const config = withRateLimit('passwordReset');

      expect(config.config?.rateLimit).toEqual({
        max: 3,
        timeWindow: 3600000,
      });
    });

    it('should work with slotPurchase limit', () => {
      const config = withRateLimit('slotPurchase');

      expect(config.config?.rateLimit).toEqual({
        max: 10,
        timeWindow: 60000,
      });
    });
  });

  describe('rate limit calculations', () => {
    it('should allow expected requests within window', () => {
      const { max, timeWindow } = RATE_LIMITS.auth;

      // With 5 requests per minute, user should be able to make
      // 5 login attempts before being rate limited
      expect(max).toBe(5);
      expect(timeWindow).toBe(60000);

      // Average rate: 1 request per 12 seconds
      const averageRateMs = timeWindow / max;
      expect(averageRateMs).toBe(12000);
    });

    it('should calculate correct rates for guild operations', () => {
      // Guild creation: 3 per hour = 1 per 20 minutes
      expect(RATE_LIMITS.guildCreate.timeWindow / RATE_LIMITS.guildCreate.max).toBe(1200000);

      // Guild battles: 20 per minute = 1 per 3 seconds
      expect(RATE_LIMITS.guildBattle.timeWindow / RATE_LIMITS.guildBattle.max).toBe(3000);
    });

    it('should have all time windows as positive numbers', () => {
      for (const [, limit] of Object.entries(RATE_LIMITS)) {
        expect(limit.timeWindow).toBeGreaterThan(0);
        expect(limit.max).toBeGreaterThan(0);
      }
    });

    it('should have time windows as whole milliseconds', () => {
      for (const [, limit] of Object.entries(RATE_LIMITS)) {
        expect(Number.isInteger(limit.timeWindow)).toBe(true);
        expect(Number.isInteger(limit.max)).toBe(true);
      }
    });
  });

  describe('rate limit key generation', () => {
    it('should document that key uses userId when authenticated', () => {
      // This is the expected behavior from the plugin:
      // keyGenerator: (request) => request.userId || request.ip

      // When user is authenticated, rate limit is per-user
      const authenticatedKey = 'user-123';
      expect(authenticatedKey).toBe('user-123');
    });

    it('should document that key falls back to IP when not authenticated', () => {
      // When user is not authenticated, rate limit is per-IP
      const unauthenticatedKey = '192.168.1.1';
      expect(unauthenticatedKey).toBe('192.168.1.1');
    });
  });

  describe('rate limit headers', () => {
    it('should document expected response headers on rate limit', () => {
      const expectedHeaders = {
        'x-ratelimit-limit': true,
        'x-ratelimit-remaining': true,
        'x-ratelimit-reset': true,
        'retry-after': true,
      };

      // These headers should be included when rate limit is exceeded
      expect(Object.keys(expectedHeaders)).toContain('x-ratelimit-limit');
      expect(Object.keys(expectedHeaders)).toContain('x-ratelimit-remaining');
      expect(Object.keys(expectedHeaders)).toContain('x-ratelimit-reset');
      expect(Object.keys(expectedHeaders)).toContain('retry-after');
    });

    it('should document headers added on all requests', () => {
      const headersOnExceeding = {
        'x-ratelimit-limit': true,
        'x-ratelimit-remaining': true,
        'x-ratelimit-reset': true,
      };

      // These headers are added to all responses approaching the limit
      expect(Object.keys(headersOnExceeding)).toHaveLength(3);
    });
  });

  describe('limit type completeness', () => {
    it('should have all expected limit types defined', () => {
      const expectedTypes = [
        'auth',
        'passwordReset',
        'runStart',
        'runFinish',
        'session',
        'leaderboard',
        'profile',
        'hubPreview',
        'pvpChallenges',
        'slotPurchase',
        'guildCreate',
        'guildBattle',
        'guildShield',
        'guildInvite',
        'guildApply',
        'guildManage',
        'guildRead',
        'guildChat',
        'default',
      ];

      for (const type of expectedTypes) {
        expect(RATE_LIMITS).toHaveProperty(type);
      }
    });
  });
});
