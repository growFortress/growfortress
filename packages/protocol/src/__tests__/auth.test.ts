/**
 * Auth schema tests
 */
import { describe, it, expect } from 'vitest';
import {
  AuthRegisterRequestSchema,
  AuthRegisterResponseSchema,
  AuthLoginRequestSchema,
  AuthLoginResponseSchema,
  AuthRefreshRequestSchema,
  AuthRefreshResponseSchema,
  InventorySchema,
  ProgressionSchema,
  ProfileResponseSchema,
} from '../auth.js';

describe('Auth Schemas', () => {
  describe('AuthRegisterRequestSchema', () => {
    it('validates correct register request', () => {
      const result = AuthRegisterRequestSchema.safeParse({
        username: 'testuser',
        password: 'password123',
      });

      expect(result.success).toBe(true);
    });

    it('rejects username too short', () => {
      const result = AuthRegisterRequestSchema.safeParse({
        username: 'ab',
        password: 'password123',
      });

      expect(result.success).toBe(false);
    });

    it('rejects username too long', () => {
      const result = AuthRegisterRequestSchema.safeParse({
        username: 'a'.repeat(21),
        password: 'password123',
      });

      expect(result.success).toBe(false);
    });

    it('rejects username with invalid characters', () => {
      const result = AuthRegisterRequestSchema.safeParse({
        username: 'test@user',
        password: 'password123',
      });

      expect(result.success).toBe(false);
    });

    it('accepts username with underscore', () => {
      const result = AuthRegisterRequestSchema.safeParse({
        username: 'test_user',
        password: 'password123',
      });

      expect(result.success).toBe(true);
    });

    it('rejects password too short', () => {
      const result = AuthRegisterRequestSchema.safeParse({
        username: 'testuser',
        password: '12345',
      });

      expect(result.success).toBe(false);
    });

    it('rejects password too long', () => {
      const result = AuthRegisterRequestSchema.safeParse({
        username: 'testuser',
        password: 'a'.repeat(101),
      });

      expect(result.success).toBe(false);
    });

    it('rejects missing username', () => {
      const result = AuthRegisterRequestSchema.safeParse({
        password: 'password123',
      });

      expect(result.success).toBe(false);
    });

    it('rejects missing password', () => {
      const result = AuthRegisterRequestSchema.safeParse({
        username: 'testuser',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('AuthRegisterResponseSchema', () => {
    it('validates correct response', () => {
      const result = AuthRegisterResponseSchema.safeParse({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
        userId: 'user-123',
        displayName: 'TestUser',
        expiresAt: Date.now() + 900000,
      });

      expect(result.success).toBe(true);
    });

    it('rejects missing fields', () => {
      const result = AuthRegisterResponseSchema.safeParse({
        accessToken: 'token',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('AuthLoginRequestSchema', () => {
    it('validates correct login request', () => {
      const result = AuthLoginRequestSchema.safeParse({
        username: 'testuser',
        password: 'password123',
      });

      expect(result.success).toBe(true);
    });

    it('applies same validation as register', () => {
      const result = AuthLoginRequestSchema.safeParse({
        username: 'ab', // too short
        password: 'password123',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('AuthLoginResponseSchema', () => {
    it('validates correct response', () => {
      const result = AuthLoginResponseSchema.safeParse({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
        userId: 'user-123',
        displayName: 'TestUser',
        expiresAt: 1234567890,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('AuthRefreshRequestSchema', () => {
    it('validates correct request', () => {
      const result = AuthRefreshRequestSchema.safeParse({
        refreshToken: 'refresh-token-123',
      });

      expect(result.success).toBe(true);
    });

    it('rejects missing refreshToken', () => {
      const result = AuthRefreshRequestSchema.safeParse({});

      expect(result.success).toBe(false);
    });
  });

  describe('AuthRefreshResponseSchema', () => {
    it('validates correct response', () => {
      const result = AuthRefreshResponseSchema.safeParse({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        displayName: 'TestUser',
        expiresAt: 1234567890,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('InventorySchema', () => {
    it('validates correct inventory', () => {
      const result = InventorySchema.safeParse({
        gold: 100,
        dust: 50,
      });

      expect(result.success).toBe(true);
    });

    it('rejects negative gold', () => {
      const result = InventorySchema.safeParse({
        gold: -10,
        dust: 50,
      });

      expect(result.success).toBe(false);
    });

    it('rejects non-integer values', () => {
      const result = InventorySchema.safeParse({
        gold: 100.5,
        dust: 50,
      });

      expect(result.success).toBe(false);
    });

    it('accepts zero values', () => {
      const result = InventorySchema.safeParse({
        gold: 0,
        dust: 0,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('ProgressionSchema', () => {
    it('validates correct progression', () => {
      const result = ProgressionSchema.safeParse({
        level: 5,
        xp: 200,
        totalXp: 1050,
        xpToNextLevel: 559,
      });

      expect(result.success).toBe(true);
    });

    it('rejects level below 1', () => {
      const result = ProgressionSchema.safeParse({
        level: 0,
        xp: 0,
        totalXp: 0,
        xpToNextLevel: 100,
      });

      expect(result.success).toBe(false);
    });

    it('rejects negative xp', () => {
      const result = ProgressionSchema.safeParse({
        level: 1,
        xp: -10,
        totalXp: 0,
        xpToNextLevel: 100,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('ProfileResponseSchema', () => {
    it('validates correct profile', () => {
      const result = ProfileResponseSchema.safeParse({
        userId: 'user-123',
        displayName: 'TestUser',
        description: 'A test user profile',
        inventory: { gold: 100, dust: 50 },
        progression: { level: 5, xp: 200, totalXp: 1050, xpToNextLevel: 559 },
        currentWave: 10,
        highestWave: 25,
        onboardingCompleted: true,
        defaultLoadout: { fortressClass: 'natural', heroId: 'vanguard', turretType: 'arrow' },
        unlockedHeroes: ['vanguard'],
        unlockedTurrets: ['arrow'],
        role: 'USER',
      });

      expect(result.success).toBe(true);
    });

    it('accepts empty unlocked arrays', () => {
      const result = ProfileResponseSchema.safeParse({
        userId: 'user-123',
        displayName: 'TestUser',
        description: '',
        inventory: { gold: 0, dust: 0 },
        progression: { level: 1, xp: 0, totalXp: 0, xpToNextLevel: 150 },
        currentWave: 0,
        highestWave: 0,
        onboardingCompleted: false,
        defaultLoadout: { fortressClass: null, heroId: null, turretType: null },
        unlockedHeroes: [],
        unlockedTurrets: [],
        role: 'USER',
      });

      expect(result.success).toBe(true);
    });

    it('rejects negative currentWave', () => {
      const result = ProfileResponseSchema.safeParse({
        userId: 'user-123',
        displayName: 'TestUser',
        description: '',
        inventory: { gold: 0, dust: 0 },
        progression: { level: 1, xp: 0, totalXp: 0, xpToNextLevel: 150 },
        currentWave: -1,
        highestWave: 0,
        onboardingCompleted: false,
        defaultLoadout: { fortressClass: null, heroId: null, turretType: null },
        unlockedHeroes: [],
        unlockedTurrets: [],
        role: 'USER',
      });

      expect(result.success).toBe(false);
    });
  });
});
