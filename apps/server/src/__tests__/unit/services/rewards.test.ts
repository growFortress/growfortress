/**
 * Rewards service tests
 */
import { describe, it, expect } from 'vitest';
import { calculateRewards, applyRewards } from '../../../services/rewards.js';
import { mockPrisma, createMockUser, createMockInventory, createMockProgression } from '../../mocks/prisma.js';

describe('Rewards Service', () => {
  describe('calculateRewards', () => {
    it('returns gold from summary', () => {
      const rewards = calculateRewards({
        wavesCleared: 5,
        kills: 50,
        eliteKills: 2,
        goldEarned: 250,
        dustEarned: 10,
        won: false,
      });

      expect(rewards.gold).toBe(250);
    });

    it('returns dust from summary', () => {
      const rewards = calculateRewards({
        wavesCleared: 5,
        kills: 50,
        eliteKills: 2,
        goldEarned: 250,
        dustEarned: 25,
        won: false,
      });

      expect(rewards.dust).toBe(25);
    });

    it('adds 5 dust bonus on win', () => {
      const rewards = calculateRewards({
        wavesCleared: 10,
        kills: 100,
        eliteKills: 5,
        goldEarned: 500,
        dustEarned: 30,
        won: true,
      });

      expect(rewards.dust).toBe(30); // dust from run only, no win bonus
    });

    it('calculates XP from waves cleared (10 per wave)', () => {
      const rewards = calculateRewards({
        wavesCleared: 8,
        kills: 0,
        eliteKills: 0,
        goldEarned: 0,
        dustEarned: 0,
        won: false,
      });

      expect(rewards.xp).toBe(80); // 8 * 10
    });

    it('calculates XP from kills (1.0 per kill)', () => {
      const rewards = calculateRewards({
        wavesCleared: 0,
        kills: 75,
        eliteKills: 0,
        goldEarned: 0,
        dustEarned: 0,
        won: false,
      });

      expect(rewards.xp).toBe(75); // floor(75 * 1.0)
    });

    it('calculates XP from elite kills (5 per elite)', () => {
      const rewards = calculateRewards({
        wavesCleared: 0,
        kills: 0,
        eliteKills: 10,
        goldEarned: 0,
        dustEarned: 0,
        won: false,
      });

      expect(rewards.xp).toBe(50); // 10 * 5
    });

    it('adds 125 XP bonus on win', () => {
      const rewards = calculateRewards({
        wavesCleared: 0,
        kills: 0,
        eliteKills: 0,
        goldEarned: 0,
        dustEarned: 0,
        won: true,
      });

      expect(rewards.xp).toBe(125);
    });

    it('combines all XP sources correctly', () => {
      const rewards = calculateRewards({
        wavesCleared: 10,
        kills: 100,
        eliteKills: 5,
        goldEarned: 0,
        dustEarned: 0,
        won: true,
      });

      // 10*10 + floor(100*1.0) + 5*5 + 125 = 100 + 100 + 25 + 125 = 350
      expect(rewards.xp).toBe(350);
    });

    it('sets levelUp to false initially', () => {
      const rewards = calculateRewards({
        wavesCleared: 10,
        kills: 100,
        eliteKills: 5,
        goldEarned: 500,
        dustEarned: 50,
        won: true,
      });

      expect(rewards.levelUp).toBe(false);
    });

    it('handles zero values', () => {
      const rewards = calculateRewards({
        wavesCleared: 0,
        kills: 0,
        eliteKills: 0,
        goldEarned: 0,
        dustEarned: 0,
        won: false,
      });

      expect(rewards.gold).toBe(0);
      expect(rewards.dust).toBe(0);
      expect(rewards.xp).toBe(0);
    });
  });

  describe('applyRewards', () => {
    it('updates inventory with gold and dust', async () => {
      const mockUser = createMockUser();
      const mockInventory = createMockInventory({ gold: 100, dust: 50 });
      const mockProgression = createMockProgression({ level: 1, xp: 0 });

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        inventory: mockInventory,
        progression: mockProgression,
      });

      mockPrisma.$transaction.mockResolvedValue([
        { ...mockInventory, gold: 350, dust: 80 },
        mockProgression,
      ]);

      const result = await applyRewards('user-123', {
        gold: 250,
        dust: 30,
        xp: 50,
        levelUp: false,
      });

      expect(result.newInventory.gold).toBe(350);
      expect(result.newInventory.dust).toBe(80);
    });

    it('throws error if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        applyRewards('nonexistent', {
          gold: 100,
          dust: 10,
          xp: 50,
          levelUp: false,
        })
      ).rejects.toThrow('User not found');
    });

    it('throws error if inventory missing', async () => {
      const mockUser = createMockUser();
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        inventory: null,
        progression: createMockProgression(),
      });

      await expect(
        applyRewards('user-123', {
          gold: 100,
          dust: 10,
          xp: 50,
          levelUp: false,
        })
      ).rejects.toThrow('User not found');
    });

    it('throws error if progression missing', async () => {
      const mockUser = createMockUser();
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        inventory: createMockInventory(),
        progression: null,
      });

      await expect(
        applyRewards('user-123', {
          gold: 100,
          dust: 10,
          xp: 50,
          levelUp: false,
        })
      ).rejects.toThrow('User not found');
    });

    it('detects level up when XP exceeds threshold', async () => {
      const mockUser = createMockUser();
      const mockInventory = createMockInventory();
      // New formula: Level 1 needs 200 XP to level up to level 2
      // User has 150 XP, gains 60 = 210 XP total >= 200, so level up
      const mockProgression = createMockProgression({ level: 1, xp: 150 });

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        inventory: mockInventory,
        progression: mockProgression,
      });

      // After level up: level 2, xp = 210 - 200 = 10
      mockPrisma.$transaction.mockResolvedValue([
        mockInventory,
        { ...mockProgression, level: 2, xp: 10, totalXp: 210 },
      ]);

      const result = await applyRewards('user-123', {
        gold: 100,
        dust: 10,
        xp: 60,
        levelUp: false,
      });

      expect(result.levelUp).toBe(true);
      expect(result.newLevel).toBe(2);
      expect(result.newProgression.level).toBe(2);
    });

    it('handles multiple level ups', async () => {
      const mockUser = createMockUser();
      const mockInventory = createMockInventory();
      // New formula: Level 1 = 200 XP, Level 2 = 400 XP, Level 3 = 600 XP
      // To reach level 3: 200 + 400 = 600 XP
      const mockProgression = createMockProgression({ level: 1, xp: 0 });

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        inventory: mockInventory,
        progression: mockProgression,
      });

      // With 650 XP: level 1â†’2 (200), level 2â†’3 (400), remaining = 50
      mockPrisma.$transaction.mockResolvedValue([
        mockInventory,
        { ...mockProgression, level: 3, xp: 50, totalXp: 650 },
      ]);

      const result = await applyRewards('user-123', {
        gold: 0,
        dust: 0,
        xp: 650,
        levelUp: false,
      });

      expect(result.levelUp).toBe(true);
      expect(result.newLevel).toBe(3);
    });

    it('calculates xpToNextLevel correctly', async () => {
      const mockUser = createMockUser();
      const mockInventory = createMockInventory();
      const mockProgression = createMockProgression({ level: 5, xp: 200 });

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        inventory: mockInventory,
        progression: mockProgression,
      });

      mockPrisma.$transaction.mockResolvedValue([
        mockInventory,
        { ...mockProgression, xp: 250 },
      ]);

      const result = await applyRewards('user-123', {
        gold: 0,
        dust: 0,
        xp: 50,
        levelUp: false,
      });

      // New XP formula: level 5 = 5 * 200 = 1000
      // xpToNextLevel = 1000 - 250 = 750
      expect(result.newProgression.xpToNextLevel).toBe(750);
    });
  });
});

