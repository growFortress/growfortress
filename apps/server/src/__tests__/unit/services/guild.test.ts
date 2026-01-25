/**
 * Guild service tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createGuild,
  getGuild,
  disbandGuild,
  searchGuilds,
  getUserGuild,
  leaveGuild,
  kickMember,
  updateMemberRole,
  transferLeadership,
  hasPermission,
} from '../../../services/guild.js';
import {
  getMemberCapacity,
  getGuildBonusesFromStructures,
} from '../../../services/guildStructures.js';
import {
  mockPrisma,
  resetPrismaMock,
  createMockGuild,
  createMockGuildMember,
} from '../../mocks/prisma.js';
import { GUILD_ERROR_CODES } from '@arcade/protocol';

describe('Guild Service', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  describe('hasPermission', () => {
    it('LEADER has all permissions', () => {
      expect(hasPermission('LEADER', 'manage')).toBe(true);
      expect(hasPermission('LEADER', 'invite')).toBe(true);
      expect(hasPermission('LEADER', 'kick')).toBe(true);
      expect(hasPermission('LEADER', 'battle')).toBe(true);
      expect(hasPermission('LEADER', 'withdraw')).toBe(true);
    });

    it('OFFICER has invite, kick, and battle permissions', () => {
      expect(hasPermission('OFFICER', 'manage')).toBe(false);
      expect(hasPermission('OFFICER', 'invite')).toBe(true);
      expect(hasPermission('OFFICER', 'kick')).toBe(true);
      expect(hasPermission('OFFICER', 'battle')).toBe(true);
      expect(hasPermission('OFFICER', 'withdraw')).toBe(false);
    });

    it('MEMBER has no special permissions', () => {
      expect(hasPermission('MEMBER', 'manage')).toBe(false);
      expect(hasPermission('MEMBER', 'invite')).toBe(false);
      expect(hasPermission('MEMBER', 'kick')).toBe(false);
      expect(hasPermission('MEMBER', 'battle')).toBe(false);
      expect(hasPermission('MEMBER', 'withdraw')).toBe(false);
    });
  });

  describe('getMemberCapacity', () => {
    it('returns 10 for kwatera level 0', () => {
      expect(getMemberCapacity(0)).toBe(10);
    });

    it('returns 15 for kwatera level 5', () => {
      expect(getMemberCapacity(5)).toBe(15);
    });

    it('returns 30 for kwatera level 20', () => {
      expect(getMemberCapacity(20)).toBe(30);
    });
  });

  describe('getGuildBonusesFromStructures', () => {
    it('returns 0 bonuses for all structures at level 0', () => {
      const bonuses = getGuildBonusesFromStructures({
        kwatera: 0,
        skarbiec: 0,
        akademia: 0,
        zbrojownia: 0,
      });
      expect(bonuses.goldBoost).toBe(0);
      expect(bonuses.statBoost).toBe(0);
      expect(bonuses.xpBoost).toBe(0);
    });

    it('returns correct bonuses for structures at level 10', () => {
      const bonuses = getGuildBonusesFromStructures({
        kwatera: 10,
        skarbiec: 10,
        akademia: 10,
        zbrojownia: 10,
      });
      expect(bonuses.goldBoost).toBe(0.10);
      expect(bonuses.statBoost).toBe(0.10);
      expect(bonuses.xpBoost).toBe(0.10);
    });

    it('returns max bonuses for structures at level 20', () => {
      const bonuses = getGuildBonusesFromStructures({
        kwatera: 20,
        skarbiec: 20,
        akademia: 20,
        zbrojownia: 20,
      });
      expect(bonuses.goldBoost).toBe(0.20);
      expect(bonuses.statBoost).toBe(0.20);
      expect(bonuses.xpBoost).toBe(0.20);
    });
  });

  // ============================================================================
  // CREATE GUILD
  // ============================================================================

  describe('createGuild', () => {
    it('creates a new guild successfully', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);
      // First call for name check, second for tag check
      mockPrisma.guild.findUnique
        .mockResolvedValueOnce(null) // name check
        .mockResolvedValueOnce(null); // tag check

      const mockGuild = createMockGuild();
      mockPrisma.guild.create.mockResolvedValue(mockGuild);
      mockPrisma.guildMember.create.mockResolvedValue(createMockGuildMember({ role: 'LEADER' }));
      mockPrisma.guildTreasury.create.mockResolvedValue({});
      // Third call is to get the created guild with members
      mockPrisma.guild.findUnique.mockResolvedValue({
        ...mockGuild,
        members: [createMockGuildMember({ role: 'LEADER', user: { displayName: 'TestUser' } })],
        _count: { members: 1 },
      });

      const result = await createGuild('user-123', {
        name: 'Test Guild',
        tag: 'TEST',
        description: 'A test guild',
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.name).toBe('Test Guild');
    });

    it('throws error if user is already in a guild', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(createMockGuildMember());

      await expect(
        createGuild('user-123', { name: 'Test', tag: 'TEST' })
      ).rejects.toThrow(GUILD_ERROR_CODES.ALREADY_IN_GUILD);
    });

    it('throws error if guild name is taken', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);
      mockPrisma.guild.findUnique
        .mockResolvedValueOnce(createMockGuild()) // name check
        .mockResolvedValueOnce(null); // tag check

      await expect(
        createGuild('user-123', { name: 'Test Guild', tag: 'NEW' })
      ).rejects.toThrow(GUILD_ERROR_CODES.NAME_TAKEN);
    });

    it('throws error if guild tag is taken', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);
      mockPrisma.guild.findUnique
        .mockResolvedValueOnce(null) // name check
        .mockResolvedValueOnce(createMockGuild()); // tag check

      await expect(
        createGuild('user-123', { name: 'New Guild', tag: 'TEST' })
      ).rejects.toThrow(GUILD_ERROR_CODES.TAG_TAKEN);
    });
  });

  // ============================================================================
  // GET GUILD
  // ============================================================================

  describe('getGuild', () => {
    it('returns guild with members', async () => {
      const mockGuild = createMockGuild();
      mockPrisma.guild.findUnique.mockResolvedValue({
        ...mockGuild,
        members: [
          { ...createMockGuildMember({ role: 'LEADER' }), user: { displayName: 'Leader' } },
          { ...createMockGuildMember({ userId: 'user-456' }), user: { displayName: 'Member' } },
        ],
        _count: { members: 2 },
      });

      const result = await getGuild('guild-123');

      expect(result).not.toBeNull();
      expect(result!.name).toBe('Test Guild');
      expect(result!.members.length).toBe(2);
    });

    it('returns null for non-existent guild', async () => {
      mockPrisma.guild.findUnique.mockResolvedValue(null);

      const result = await getGuild('non-existent');

      expect(result).toBeNull();
    });

    it('returns null for disbanded guild', async () => {
      mockPrisma.guild.findUnique.mockResolvedValue(createMockGuild({ disbanded: true }));

      const result = await getGuild('guild-123');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // SEARCH GUILDS
  // ============================================================================

  describe('searchGuilds', () => {
    it('returns all guilds when no search query', async () => {
      mockPrisma.guild.findMany.mockResolvedValue([createMockGuild()]);
      mockPrisma.guild.count.mockResolvedValue(1);

      const result = await searchGuilds(undefined, 20, 0);

      expect(result.guilds.length).toBe(1);
      expect(result.total).toBe(1);
    });

    it('searches by name and tag', async () => {
      mockPrisma.guild.findMany.mockResolvedValue([createMockGuild()]);
      mockPrisma.guild.count.mockResolvedValue(1);

      await searchGuilds('test', 20, 0);

      expect(mockPrisma.guild.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: expect.any(Object) }),
              expect.objectContaining({ tag: expect.any(Object) }),
            ]),
          }),
        })
      );
    });
  });

  // ============================================================================
  // MEMBERSHIP
  // ============================================================================

  describe('getUserGuild', () => {
    it('returns null if user has no guild', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);

      const result = await getUserGuild('user-123');

      expect(result).toBeNull();
    });

    it('returns membership with guild details', async () => {
      const mockMembership = {
        ...createMockGuildMember(),
        guild: createMockGuild(),
        user: { displayName: 'TestUser' },
      };
      mockPrisma.guildMember.findUnique.mockResolvedValue(mockMembership);

      const result = await getUserGuild('user-123');

      expect(result).not.toBeNull();
      expect(result!.guild.name).toBe('Test Guild');
    });
  });

  describe('leaveGuild', () => {
    it('removes member from guild', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(createMockGuildMember());
      mockPrisma.guildMember.delete.mockResolvedValue({});

      await leaveGuild('guild-123', 'user-123');

      expect(mockPrisma.guildMember.delete).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
    });

    it('throws error if user is not in guild', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);

      await expect(
        leaveGuild('guild-123', 'user-123')
      ).rejects.toThrow(GUILD_ERROR_CODES.NOT_IN_GUILD);
    });

    it('throws error if user is leader', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER' })
      );

      await expect(
        leaveGuild('guild-123', 'user-123')
      ).rejects.toThrow(GUILD_ERROR_CODES.CANNOT_LEAVE_AS_LEADER);
    });
  });

  describe('kickMember', () => {
    it('kicks member when actor is leader', async () => {
      mockPrisma.guildMember.findUnique
        .mockResolvedValueOnce(createMockGuildMember({ role: 'LEADER', userId: 'leader-123' }))
        .mockResolvedValueOnce(createMockGuildMember({ userId: 'user-456' }));
      mockPrisma.guildMember.delete.mockResolvedValue({});

      await kickMember('guild-123', 'leader-123', 'user-456');

      expect(mockPrisma.guildMember.delete).toHaveBeenCalledWith({
        where: { userId: 'user-456' },
      });
    });

    it('throws error when trying to kick leader', async () => {
      mockPrisma.guildMember.findUnique
        .mockResolvedValueOnce(createMockGuildMember({ role: 'OFFICER', userId: 'officer-123' }))
        .mockResolvedValueOnce(createMockGuildMember({ role: 'LEADER', userId: 'leader-123' }));

      await expect(
        kickMember('guild-123', 'officer-123', 'leader-123')
      ).rejects.toThrow(GUILD_ERROR_CODES.CANNOT_KICK_LEADER);
    });

    it('officer cannot kick another officer', async () => {
      mockPrisma.guildMember.findUnique
        .mockResolvedValueOnce(createMockGuildMember({ role: 'OFFICER', userId: 'officer-1' }))
        .mockResolvedValueOnce(createMockGuildMember({ role: 'OFFICER', userId: 'officer-2' }));

      await expect(
        kickMember('guild-123', 'officer-1', 'officer-2')
      ).rejects.toThrow(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    });
  });

  describe('updateMemberRole', () => {
    it('promotes member to officer', async () => {
      mockPrisma.guildMember.findUnique
        .mockResolvedValueOnce(createMockGuildMember({ role: 'LEADER', userId: 'leader-123' }))
        .mockResolvedValueOnce(createMockGuildMember({ userId: 'user-456' }));
      mockPrisma.guildMember.update.mockResolvedValue(
        createMockGuildMember({ role: 'OFFICER', userId: 'user-456' })
      );

      const result = await updateMemberRole('guild-123', 'leader-123', 'user-456', 'OFFICER');

      expect(result.role).toBe('OFFICER');
    });

    it('only leader can change roles', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'OFFICER', userId: 'officer-123' })
      );

      await expect(
        updateMemberRole('guild-123', 'officer-123', 'user-456', 'OFFICER')
      ).rejects.toThrow(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    });
  });

  describe('transferLeadership', () => {
    it('transfers leadership successfully', async () => {
      mockPrisma.guildMember.findUnique
        .mockResolvedValueOnce(createMockGuildMember({ role: 'LEADER', userId: 'leader-123' }))
        .mockResolvedValueOnce(createMockGuildMember({ role: 'OFFICER', userId: 'officer-123' }));

      await transferLeadership('guild-123', 'leader-123', 'officer-123');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('only leader can transfer leadership', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'OFFICER', userId: 'officer-123' })
      );

      await expect(
        transferLeadership('guild-123', 'officer-123', 'user-456')
      ).rejects.toThrow(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    });

    it('cannot transfer to non-member', async () => {
      mockPrisma.guildMember.findUnique
        .mockResolvedValueOnce(createMockGuildMember({ role: 'LEADER', userId: 'leader-123' }))
        .mockResolvedValueOnce(null);

      await expect(
        transferLeadership('guild-123', 'leader-123', 'non-member')
      ).rejects.toThrow(GUILD_ERROR_CODES.TARGET_NOT_IN_GUILD);
    });
  });

  // ============================================================================
  // UPDATE GUILD
  // ============================================================================

  describe('updateGuild', () => {
    it('updates guild name successfully', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER' })
      );
      mockPrisma.guild.findFirst.mockResolvedValue(null); // No duplicate name
      mockPrisma.guild.update.mockResolvedValue(createMockGuild({ name: 'New Name' }));

      const { updateGuild } = await import('../../../services/guild.js');
      const result = await updateGuild('guild-123', 'user-123', { name: 'New Name' });

      expect(result.name).toBe('New Name');
    });

    it('throws error if not in guild', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);

      const { updateGuild } = await import('../../../services/guild.js');
      await expect(
        updateGuild('guild-123', 'user-123', { name: 'New Name' })
      ).rejects.toThrow(GUILD_ERROR_CODES.NOT_IN_GUILD);
    });

    it('throws error if not leader', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'OFFICER' })
      );

      const { updateGuild } = await import('../../../services/guild.js');
      await expect(
        updateGuild('guild-123', 'user-123', { name: 'New Name' })
      ).rejects.toThrow(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    });

    it('throws error if new name is taken', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER' })
      );
      mockPrisma.guild.findFirst.mockResolvedValue(createMockGuild({ id: 'other-guild' }));

      const { updateGuild } = await import('../../../services/guild.js');
      await expect(
        updateGuild('guild-123', 'user-123', { name: 'Taken Name' })
      ).rejects.toThrow(GUILD_ERROR_CODES.NAME_TAKEN);
    });

    it('throws error if new tag is taken', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER' })
      );
      // When only tag is provided (no name), only tag check happens
      mockPrisma.guild.findFirst.mockResolvedValue(createMockGuild({ id: 'other-guild' }));

      const { updateGuild } = await import('../../../services/guild.js');
      await expect(
        updateGuild('guild-123', 'user-123', { tag: 'TAKEN' })
      ).rejects.toThrow(GUILD_ERROR_CODES.TAG_TAKEN);
    });

    it('updates description', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER' })
      );
      mockPrisma.guild.update.mockResolvedValue(
        createMockGuild({ description: 'New description' })
      );

      const { updateGuild } = await import('../../../services/guild.js');
      const result = await updateGuild('guild-123', 'user-123', {
        description: 'New description',
      });

      expect(result.description).toBe('New description');
    });

    it('updates settings', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER' })
      );
      mockPrisma.guild.findUnique.mockResolvedValue(
        createMockGuild({ settings: { minLevel: 1 } })
      );
      mockPrisma.guild.update.mockResolvedValue(
        createMockGuild({ settings: { minLevel: 10 } })
      );

      const { updateGuild } = await import('../../../services/guild.js');
      const result = await updateGuild('guild-123', 'user-123', {
        settings: { minLevel: 10 },
      });

      expect(result.settings).toEqual({ minLevel: 10 });
    });

    it('normalizes tag to uppercase', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER' })
      );
      mockPrisma.guild.findFirst.mockResolvedValue(null);
      mockPrisma.guild.update.mockResolvedValue(createMockGuild({ tag: 'NEW' }));

      const { updateGuild } = await import('../../../services/guild.js');
      await updateGuild('guild-123', 'user-123', { tag: 'new' });

      expect(mockPrisma.guild.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tag: 'NEW' }),
        })
      );
    });
  });

  // ============================================================================
  // JOIN GUILD
  // ============================================================================

  describe('joinGuild', () => {
    it('joins guild via invitation', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);
      mockPrisma.guild.findUnique.mockResolvedValue({
        ...createMockGuild(),
        _count: { members: 5 },
        structureKwatera: 0,
      });
      mockPrisma.guildInvitation.update.mockResolvedValue({});
      mockPrisma.guildMember.create.mockResolvedValue(createMockGuildMember());

      const { joinGuild } = await import('../../../services/guild.js');
      const result = await joinGuild('guild-123', 'user-456', 'invitation-123');

      expect(result.role).toBe('MEMBER');
    });

    it('throws error if user already in a guild', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(createMockGuildMember());

      const { joinGuild } = await import('../../../services/guild.js');
      await expect(
        joinGuild('guild-123', 'user-123')
      ).rejects.toThrow(GUILD_ERROR_CODES.ALREADY_IN_GUILD);
    });

    it('throws error if guild not found', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);
      mockPrisma.guild.findUnique.mockResolvedValue(null);

      const { joinGuild } = await import('../../../services/guild.js');
      await expect(
        joinGuild('non-existent', 'user-123')
      ).rejects.toThrow(GUILD_ERROR_CODES.GUILD_NOT_FOUND);
    });

    it('throws error if guild is disbanded', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);
      mockPrisma.guild.findUnique.mockResolvedValue(createMockGuild({ disbanded: true }));

      const { joinGuild } = await import('../../../services/guild.js');
      await expect(
        joinGuild('guild-123', 'user-123')
      ).rejects.toThrow(GUILD_ERROR_CODES.GUILD_NOT_FOUND);
    });

    it('throws error if guild is full', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);
      mockPrisma.guild.findUnique.mockResolvedValue({
        ...createMockGuild(),
        _count: { members: 10 }, // Max for kwatera level 0
        structureKwatera: 0,
      });

      const { joinGuild } = await import('../../../services/guild.js');
      await expect(
        joinGuild('guild-123', 'user-123')
      ).rejects.toThrow(GUILD_ERROR_CODES.GUILD_FULL);
    });
  });

  describe('joinGuildDirect', () => {
    it('joins open guild directly', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);
      mockPrisma.guild.findUnique.mockResolvedValue({
        ...createMockGuild(),
        settings: { accessMode: 'OPEN', minLevel: 1 },
        _count: { members: 5 },
        structureKwatera: 0,
      });
      mockPrisma.user.findUnique.mockResolvedValue({ highestWave: 10 });
      mockPrisma.guildApplication.updateMany.mockResolvedValue({});
      mockPrisma.guildInvitation.updateMany.mockResolvedValue({});
      mockPrisma.guildMember.create.mockResolvedValue(createMockGuildMember());

      const { joinGuildDirect } = await import('../../../services/guild.js');
      const result = await joinGuildDirect('guild-123', 'user-456');

      expect(result.role).toBe('MEMBER');
    });

    it('throws error for closed guild', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);
      mockPrisma.guild.findUnique.mockResolvedValue({
        ...createMockGuild(),
        settings: { accessMode: 'CLOSED' },
        _count: { members: 5 },
      });

      const { joinGuildDirect } = await import('../../../services/guild.js');
      await expect(
        joinGuildDirect('guild-123', 'user-456')
      ).rejects.toThrow(GUILD_ERROR_CODES.GUILD_CLOSED);
    });

    it('throws error for invite-only guild', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);
      mockPrisma.guild.findUnique.mockResolvedValue({
        ...createMockGuild(),
        settings: { accessMode: 'INVITE_ONLY' },
        _count: { members: 5 },
      });

      const { joinGuildDirect } = await import('../../../services/guild.js');
      await expect(
        joinGuildDirect('guild-123', 'user-456')
      ).rejects.toThrow(GUILD_ERROR_CODES.GUILD_NOT_ACCEPTING_DIRECT_JOIN);
    });

    it('throws error if user level too low', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);
      mockPrisma.guild.findUnique.mockResolvedValue({
        ...createMockGuild(),
        settings: { accessMode: 'OPEN', minLevel: 50 },
        _count: { members: 5 },
        structureKwatera: 0,
      });
      mockPrisma.user.findUnique.mockResolvedValue({ highestWave: 10 });

      const { joinGuildDirect } = await import('../../../services/guild.js');
      await expect(
        joinGuildDirect('guild-123', 'user-456')
      ).rejects.toThrow(GUILD_ERROR_CODES.LEVEL_TOO_LOW);
    });

    it('throws error if user not found', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);
      mockPrisma.guild.findUnique.mockResolvedValue({
        ...createMockGuild(),
        settings: { accessMode: 'OPEN', minLevel: 1 },
        _count: { members: 5 },
        structureKwatera: 0,
      });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const { joinGuildDirect } = await import('../../../services/guild.js');
      await expect(
        joinGuildDirect('guild-123', 'user-456')
      ).rejects.toThrow(GUILD_ERROR_CODES.USER_NOT_FOUND);
    });

    it('cancels pending applications and invitations', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);
      mockPrisma.guild.findUnique.mockResolvedValue({
        ...createMockGuild(),
        settings: { accessMode: 'OPEN', minLevel: 1 },
        _count: { members: 5 },
        structureKwatera: 0,
      });
      mockPrisma.user.findUnique.mockResolvedValue({ highestWave: 10 });
      mockPrisma.guildApplication.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.guildInvitation.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.guildMember.create.mockResolvedValue(createMockGuildMember());

      const { joinGuildDirect } = await import('../../../services/guild.js');
      await joinGuildDirect('guild-123', 'user-456');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // GUILD POWER
  // ============================================================================

  describe('getGuildPower', () => {
    it('returns sum of all member power', async () => {
      mockPrisma.guildMember.findMany.mockResolvedValue([
        {
          ...createMockGuildMember({ userId: 'user-1' }),
          user: { powerUpgrades: { cachedTotalPower: 1000 } },
        },
        {
          ...createMockGuildMember({ userId: 'user-2' }),
          user: { powerUpgrades: { cachedTotalPower: 2000 } },
        },
        {
          ...createMockGuildMember({ userId: 'user-3' }),
          user: { powerUpgrades: { cachedTotalPower: 1500 } },
        },
      ]);

      const { getGuildPower } = await import('../../../services/guild.js');
      const power = await getGuildPower('guild-123');

      expect(power).toBe(4500);
    });

    it('returns 0 for guild with no members', async () => {
      mockPrisma.guildMember.findMany.mockResolvedValue([]);

      const { getGuildPower } = await import('../../../services/guild.js');
      const power = await getGuildPower('guild-123');

      expect(power).toBe(0);
    });

    it('handles members without power upgrades', async () => {
      mockPrisma.guildMember.findMany.mockResolvedValue([
        {
          ...createMockGuildMember({ userId: 'user-1' }),
          user: { powerUpgrades: { cachedTotalPower: 1000 } },
        },
        {
          ...createMockGuildMember({ userId: 'user-2' }),
          user: { powerUpgrades: null },
        },
      ]);

      const { getGuildPower } = await import('../../../services/guild.js');
      const power = await getGuildPower('guild-123');

      expect(power).toBe(1000);
    });
  });

  // ============================================================================
  // UPDATE GUILD DESCRIPTION/NOTES/EMBLEM
  // ============================================================================

  describe('updateGuildDescription', () => {
    it('updates description successfully', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER' })
      );
      mockPrisma.guild.update.mockResolvedValue(
        createMockGuild({ description: 'New description' })
      );

      const { updateGuildDescription } = await import('../../../services/guild.js');
      const result = await updateGuildDescription(
        'guild-123',
        'user-123',
        'New description'
      );

      expect(result.description).toBe('New description');
    });

    it('officer can update description', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'OFFICER' })
      );
      mockPrisma.guild.update.mockResolvedValue(
        createMockGuild({ description: 'Updated' })
      );

      const { updateGuildDescription } = await import('../../../services/guild.js');
      const result = await updateGuildDescription('guild-123', 'user-123', 'Updated');

      expect(result.description).toBe('Updated');
    });

    it('member cannot update description', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'MEMBER' })
      );

      const { updateGuildDescription } = await import('../../../services/guild.js');
      await expect(
        updateGuildDescription('guild-123', 'user-123', 'New desc')
      ).rejects.toThrow(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    });

    it('can set description to null', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER' })
      );
      mockPrisma.guild.update.mockResolvedValue(createMockGuild({ description: null }));

      const { updateGuildDescription } = await import('../../../services/guild.js');
      await updateGuildDescription('guild-123', 'user-123', null);

      expect(mockPrisma.guild.update).toHaveBeenCalledWith({
        where: { id: 'guild-123' },
        data: { description: null },
      });
    });
  });

  describe('updateGuildNotes', () => {
    it('updates internal notes successfully', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER' })
      );
      mockPrisma.guild.update.mockResolvedValue(
        createMockGuild({ internalNotes: 'Secret notes' })
      );

      const { updateGuildNotes } = await import('../../../services/guild.js');
      await updateGuildNotes('guild-123', 'user-123', 'Secret notes');

      expect(mockPrisma.guild.update).toHaveBeenCalledWith({
        where: { id: 'guild-123' },
        data: { internalNotes: 'Secret notes' },
      });
    });

    it('officer can update notes', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'OFFICER' })
      );
      mockPrisma.guild.update.mockResolvedValue(createMockGuild());

      const { updateGuildNotes } = await import('../../../services/guild.js');
      await updateGuildNotes('guild-123', 'user-123', 'Notes');

      expect(mockPrisma.guild.update).toHaveBeenCalled();
    });

    it('member cannot update notes', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'MEMBER' })
      );

      const { updateGuildNotes } = await import('../../../services/guild.js');
      await expect(
        updateGuildNotes('guild-123', 'user-123', 'Notes')
      ).rejects.toThrow(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    });
  });

  describe('updateGuildEmblem', () => {
    it('updates emblem URL successfully', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER' })
      );
      mockPrisma.guild.update.mockResolvedValue(
        createMockGuild({ emblemUrl: 'https://example.com/emblem.png' })
      );

      const { updateGuildEmblem } = await import('../../../services/guild.js');
      await updateGuildEmblem(
        'guild-123',
        'user-123',
        'https://example.com/emblem.png'
      );

      expect(mockPrisma.guild.update).toHaveBeenCalledWith({
        where: { id: 'guild-123' },
        data: { emblemUrl: 'https://example.com/emblem.png' },
      });
    });

    it('accepts data URL for emblem', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER' })
      );
      mockPrisma.guild.update.mockResolvedValue(createMockGuild());

      const { updateGuildEmblem } = await import('../../../services/guild.js');
      await updateGuildEmblem(
        'guild-123',
        'user-123',
        'data:image/png;base64,iVBORw0KGgo='
      );

      expect(mockPrisma.guild.update).toHaveBeenCalled();
    });

    it('rejects invalid emblem URL format', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER' })
      );

      const { updateGuildEmblem } = await import('../../../services/guild.js');
      await expect(
        updateGuildEmblem('guild-123', 'user-123', 'not-a-valid-url')
      ).rejects.toThrow('Invalid emblem URL format');
    });

    it('member cannot update emblem', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'MEMBER' })
      );

      const { updateGuildEmblem } = await import('../../../services/guild.js');
      await expect(
        updateGuildEmblem('guild-123', 'user-123', 'https://example.com/img.png')
      ).rejects.toThrow(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    });

    it('can set emblem to null', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER' })
      );
      mockPrisma.guild.update.mockResolvedValue(createMockGuild({ emblemUrl: null }));

      const { updateGuildEmblem } = await import('../../../services/guild.js');
      await updateGuildEmblem('guild-123', 'user-123', null);

      expect(mockPrisma.guild.update).toHaveBeenCalledWith({
        where: { id: 'guild-123' },
        data: { emblemUrl: null },
      });
    });
  });

  // ============================================================================
  // DISBAND
  // ============================================================================

  describe('disbandGuild', () => {
    it('disbands guild when called by leader', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER' })
      );
      mockPrisma.guild.update.mockResolvedValue({});
      mockPrisma.guildMember.deleteMany.mockResolvedValue({});
      mockPrisma.guildInvitation.updateMany.mockResolvedValue({});
      mockPrisma.guildBattle.updateMany.mockResolvedValue({});

      await disbandGuild('guild-123', 'user-123');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('only leader can disband', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'OFFICER' })
      );

      await expect(
        disbandGuild('guild-123', 'user-123')
      ).rejects.toThrow(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    });
  });
});
