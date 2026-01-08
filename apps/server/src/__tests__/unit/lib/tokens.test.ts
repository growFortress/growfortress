/**
 * Token library tests
 */
import { describe, it, expect } from 'vitest';
import {
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  createRunToken,
  verifyRunToken,
  createSessionToken,
  verifySessionToken,
} from '../../../lib/tokens.js';

const baseSimConfig = {
  fortressClass: 'natural' as const,
  startingHeroes: [] as string[],
  startingTurrets: [] as { definitionId: string; slotIndex: number; class: 'natural' | 'fire' | 'ice' | 'lightning' }[],
  commanderLevel: 1,
  progressionDamageBonus: 1,
  progressionGoldBonus: 1,
  startingGold: 0,
  maxHeroSlots: 1,
  fortressBaseHp: 100,
  fortressBaseDamage: 10,
  waveIntervalTicks: 90,
};

describe('Token Library', () => {
  describe('Access Tokens', () => {
    it('creates valid access token', async () => {
      const token = await createAccessToken('user-123');

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT format
    });

    it('verifies valid access token', async () => {
      const token = await createAccessToken('user-123');
      const payload = await verifyAccessToken(token);

      expect(payload).not.toBeNull();
      expect(payload!.sub).toBe('user-123');
      expect(payload!.type).toBe('access');
    });

    it('returns null for invalid token', async () => {
      const payload = await verifyAccessToken('invalid-token');

      expect(payload).toBeNull();
    });

    it('returns null for refresh token used as access', async () => {
      const refreshToken = await createRefreshToken('user-123', 'session-456');
      const payload = await verifyAccessToken(refreshToken);

      expect(payload).toBeNull();
    });

    it('returns null for tampered token', async () => {
      const token = await createAccessToken('user-123');
      const tampered = token.slice(0, -5) + 'xxxxx';
      const payload = await verifyAccessToken(tampered);

      expect(payload).toBeNull();
    });
  });

  describe('Refresh Tokens', () => {
    it('creates valid refresh token', async () => {
      const token = await createRefreshToken('user-123', 'session-456');

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);
    });

    it('verifies valid refresh token', async () => {
      const token = await createRefreshToken('user-123', 'session-456');
      const payload = await verifyRefreshToken(token);

      expect(payload).not.toBeNull();
      expect(payload!.sub).toBe('user-123');
      expect(payload!.sessionId).toBe('session-456');
      expect(payload!.type).toBe('refresh');
    });

    it('returns null for invalid token', async () => {
      const payload = await verifyRefreshToken('invalid-token');

      expect(payload).toBeNull();
    });

    it('returns null for access token used as refresh', async () => {
      const accessToken = await createAccessToken('user-123');
      const payload = await verifyRefreshToken(accessToken);

      expect(payload).toBeNull();
    });

    it('includes session ID', async () => {
      const token = await createRefreshToken('user-123', 'session-789');
      const payload = await verifyRefreshToken(token);

      expect(payload!.sessionId).toBe('session-789');
    });
  });

  describe('Run Tokens', () => {
    it('creates valid run token', async () => {
      const token = await createRunToken({
        runId: 'run-123',
        userId: 'user-123',
        seed: 12345,
        simVersion: 1,
        tickHz: 30,
        maxWaves: 10,
        auditTicks: [100, 200, 300],
        simConfig: baseSimConfig,
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);
    });

    it('verifies valid run token', async () => {
      const token = await createRunToken({
        runId: 'run-123',
        userId: 'user-123',
        seed: 12345,
        simVersion: 1,
        tickHz: 30,
        maxWaves: 10,
        auditTicks: [100, 200, 300],
        simConfig: baseSimConfig,
      });

      const payload = await verifyRunToken(token);

      expect(payload).not.toBeNull();
      expect(payload!.runId).toBe('run-123');
      expect(payload!.userId).toBe('user-123');
      expect(payload!.seed).toBe(12345);
      expect(payload!.simVersion).toBe(1);
      expect(payload!.tickHz).toBe(30);
      expect(payload!.maxWaves).toBe(10);
      expect(payload!.auditTicks).toEqual([100, 200, 300]);
    });

    it('returns null for invalid token', async () => {
      const payload = await verifyRunToken('invalid-token');

      expect(payload).toBeNull();
    });

    it('includes issuedAt and exp', async () => {
      const beforeCreate = Math.floor(Date.now() / 1000);
      const token = await createRunToken({
        runId: 'run-123',
        userId: 'user-123',
        seed: 12345,
        simVersion: 1,
        tickHz: 30,
        maxWaves: 10,
        auditTicks: [],
        simConfig: baseSimConfig,
      });
      const afterCreate = Math.floor(Date.now() / 1000);

      const payload = await verifyRunToken(token);

      expect(payload!.issuedAt).toBeGreaterThanOrEqual(beforeCreate);
      expect(payload!.issuedAt).toBeLessThanOrEqual(afterCreate);
      expect(payload!.exp).toBeGreaterThan(payload!.issuedAt);
    });

    it('preserves all payload fields', async () => {
      const token = await createRunToken({
        runId: 'run-456',
        userId: 'user-789',
        seed: 99999,
        simVersion: 2,
        tickHz: 60,
        maxWaves: 5,
        auditTicks: [50, 150, 250, 350],
        simConfig: baseSimConfig,
      });

      const payload = await verifyRunToken(token);

      expect(payload!.runId).toBe('run-456');
      expect(payload!.userId).toBe('user-789');
      expect(payload!.seed).toBe(99999);
      expect(payload!.simVersion).toBe(2);
      expect(payload!.tickHz).toBe(60);
      expect(payload!.maxWaves).toBe(5);
      expect(payload!.auditTicks).toEqual([50, 150, 250, 350]);
    });
  });

  describe('Session Tokens', () => {
    it('creates valid session token', async () => {
      const token = await createSessionToken({
        sessionId: 'gs-123',
        userId: 'user-123',
        seed: 12345,
        simVersion: 1,
        startingWave: 0,
        segmentAuditTicks: [100, 200],
        simConfig: baseSimConfig,
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);
    });

    it('verifies valid session token', async () => {
      const token = await createSessionToken({
        sessionId: 'gs-123',
        userId: 'user-123',
        seed: 12345,
        simVersion: 1,
        startingWave: 5,
        segmentAuditTicks: [100, 200],
        simConfig: baseSimConfig,
      });

      const payload = await verifySessionToken(token);

      expect(payload).not.toBeNull();
      expect(payload!.sessionId).toBe('gs-123');
      expect(payload!.userId).toBe('user-123');
      expect(payload!.seed).toBe(12345);
      expect(payload!.startingWave).toBe(5);
    });

    it('returns null for invalid token', async () => {
      const payload = await verifySessionToken('invalid-token');

      expect(payload).toBeNull();
    });

    it('preserves all payload fields', async () => {
      const token = await createSessionToken({
        sessionId: 'gs-456',
        userId: 'user-789',
        seed: 54321,
        simVersion: 2,
        startingWave: 10,
        segmentAuditTicks: [50, 100, 150],
        simConfig: baseSimConfig,
      });

      const payload = await verifySessionToken(token);

      expect(payload!.sessionId).toBe('gs-456');
      expect(payload!.userId).toBe('user-789');
      expect(payload!.seed).toBe(54321);
      expect(payload!.simVersion).toBe(2);
      expect(payload!.startingWave).toBe(10);
      expect(payload!.segmentAuditTicks).toEqual([50, 100, 150]);
    });
  });

  describe('Token Isolation', () => {
    it('different token types are not interchangeable', async () => {
      const accessToken = await createAccessToken('user-123');
      const refreshToken = await createRefreshToken('user-123', 'session-123');
      const runToken = await createRunToken({
        runId: 'run-123',
        userId: 'user-123',
        seed: 12345,
        simVersion: 1,
        tickHz: 30,
        maxWaves: 10,
        auditTicks: [],
        simConfig: baseSimConfig,
      });

      // Access token should not verify as refresh
      expect(await verifyRefreshToken(accessToken)).toBeNull();

      // Refresh token should not verify as access
      expect(await verifyAccessToken(refreshToken)).toBeNull();

      // Run token should not verify as access/refresh (different secret)
      expect(await verifyAccessToken(runToken)).toBeNull();
      expect(await verifyRefreshToken(runToken)).toBeNull();
    });
  });
});
