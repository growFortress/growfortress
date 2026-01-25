/**
 * Guild Invitation service unit tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../../../__tests__/helpers/setup.js';
import {
  createInvitation,
  getGuildInvitations,
  getUserInvitations,
  getInvitation,
  acceptInvitation,
  declineInvitation,
  cancelInvitation,
  expireOldInvitations,
} from '../../../services/guildInvitation.js';
import {
  mockPrisma,
  createMockGuild,
  createMockGuildMember,
  createMockUser,
} from '../../mocks/prisma.js';
import { GUILD_ERROR_CODES } from '@arcade/protocol';
import * as guildModule from '../../../services/guild.js';
import * as guildStructuresModule from '../../../services/guildStructures.js';

// Mock the guild module
vi.mock('../../../services/guild.js', () => ({
  hasPermission: vi.fn(),
}));

// Mock the guildStructures module
vi.mock('../../../services/guildStructures.js', () => ({
  getMemberCapacity: vi.fn(),
}));

const mockHasPermission = guildModule.hasPermission as ReturnType<typeof vi.fn>;
const mockGetMemberCapacity = guildStructuresModule.getMemberCapacity as ReturnType<typeof vi.fn>;

// Helper to create mock invitation
function createMockInvitation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-123',
    guildId: 'guild-123',
    inviterId: 'leader-123',
    inviteeId: 'user-456',
    message: null,
    status: 'PENDING',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours from now
    respondedAt: null,
    guild: { name: 'Test Guild', tag: 'TEST' },
    inviter: { displayName: 'Leader' },
    invitee: { displayName: 'Invitee' },
    ...overrides,
  };
}

describe('Guild Invitation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set default behavior for guild mocks
    mockHasPermission.mockImplementation((role: string, action: string) => {
      if (action === 'invite') {
        return role === 'LEADER' || role === 'OFFICER';
      }
      return false;
    });
    mockGetMemberCapacity.mockImplementation((kwateraLevel: number) => {
      return 10 + kwateraLevel; // Base 10 + 1 per kwatera level
    });
    // Set default behavior for messaging mocks (used by createGuildInviteNotification)
    mockPrisma.messageThread.create.mockResolvedValue({
      id: 'thread-123',
      subject: 'Guild Invitation',
      type: 'GUILD_INVITE',
      participants: [{ userId: 'user-456', unreadCount: 1 }],
    });
    mockPrisma.messageParticipant.findMany.mockResolvedValue([]);
    mockPrisma.messageParticipant.aggregate.mockResolvedValue({ _sum: { unreadCount: 0 } });
  });

  // ============================================================================
  // createInvitation
  // ============================================================================

  describe('createInvitation', () => {
    it('creates invitation successfully', async () => {
      const member = createMockGuildMember({ role: 'LEADER', guildId: 'guild-123' });
      const guild = createMockGuild({ id: 'guild-123', _count: { members: 5 } });
      const invitee = createMockUser({ id: 'user-456' });
      const invitation = createMockInvitation();

      mockPrisma.guildMember.findUnique
        .mockResolvedValueOnce(member) // Inviter check
        .mockResolvedValueOnce(null);  // Invitee membership check
      mockPrisma.guild.findUnique.mockResolvedValue({ ...guild, _count: { members: 5 } });
      mockPrisma.user.findUnique.mockResolvedValue(invitee);
      mockPrisma.guildInvitation.findFirst.mockResolvedValue(null); // No existing invite
      mockPrisma.guildInvitation.create.mockResolvedValue(invitation);

      const result = await createInvitation('guild-123', 'leader-123', 'user-456', 'Join us!');

      expect(result).toEqual(invitation);
      expect(mockPrisma.guildInvitation.create).toHaveBeenCalled();
    });

    it('throws NOT_IN_GUILD if inviter not in guild', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);

      await expect(createInvitation('guild-123', 'leader-123', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.NOT_IN_GUILD);
    });

    it('throws NOT_IN_GUILD if inviter in different guild', async () => {
      const member = createMockGuildMember({ guildId: 'other-guild' });
      mockPrisma.guildMember.findUnique.mockResolvedValue(member);

      await expect(createInvitation('guild-123', 'leader-123', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.NOT_IN_GUILD);
    });

    it('throws INSUFFICIENT_PERMISSIONS if member role cannot invite', async () => {
      const member = createMockGuildMember({ role: 'MEMBER', guildId: 'guild-123' });
      mockPrisma.guildMember.findUnique.mockResolvedValue(member);

      await expect(createInvitation('guild-123', 'member-123', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    });

    it('throws GUILD_NOT_FOUND if guild does not exist', async () => {
      const member = createMockGuildMember({ role: 'LEADER', guildId: 'guild-123' });
      mockPrisma.guildMember.findUnique.mockResolvedValue(member);
      mockPrisma.guild.findUnique.mockResolvedValue(null);

      await expect(createInvitation('guild-123', 'leader-123', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.GUILD_NOT_FOUND);
    });

    it('throws GUILD_NOT_FOUND if guild is disbanded', async () => {
      const member = createMockGuildMember({ role: 'LEADER', guildId: 'guild-123' });
      const guild = createMockGuild({ disbanded: true });
      mockPrisma.guildMember.findUnique.mockResolvedValue(member);
      mockPrisma.guild.findUnique.mockResolvedValue({ ...guild, _count: { members: 5 } });

      await expect(createInvitation('guild-123', 'leader-123', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.GUILD_NOT_FOUND);
    });

    it('throws GUILD_FULL if guild at capacity', async () => {
      const member = createMockGuildMember({ role: 'LEADER', guildId: 'guild-123' });
      const guild = createMockGuild({ structureKwatera: 0, _count: { members: 10 } }); // kwatera 0 = 10 max
      mockPrisma.guildMember.findUnique.mockResolvedValue(member);
      mockPrisma.guild.findUnique.mockResolvedValue({ ...guild, _count: { members: 10 } });

      await expect(createInvitation('guild-123', 'leader-123', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.GUILD_FULL);
    });

    it('throws USER_NOT_FOUND if invitee does not exist', async () => {
      const member = createMockGuildMember({ role: 'LEADER', guildId: 'guild-123' });
      const guild = createMockGuild({ _count: { members: 5 } });
      mockPrisma.guildMember.findUnique.mockResolvedValue(member);
      mockPrisma.guild.findUnique.mockResolvedValue({ ...guild, _count: { members: 5 } });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(createInvitation('guild-123', 'leader-123', 'nonexistent'))
        .rejects.toThrow(GUILD_ERROR_CODES.USER_NOT_FOUND);
    });

    it('throws USER_ALREADY_IN_GUILD if invitee has membership', async () => {
      const member = createMockGuildMember({ role: 'LEADER', guildId: 'guild-123' });
      const guild = createMockGuild({ _count: { members: 5 } });
      const invitee = createMockUser({ id: 'user-456' });
      const inviteeMembership = createMockGuildMember({ userId: 'user-456' });

      mockPrisma.guildMember.findUnique
        .mockResolvedValueOnce(member)
        .mockResolvedValueOnce(inviteeMembership);
      mockPrisma.guild.findUnique.mockResolvedValue({ ...guild, _count: { members: 5 } });
      mockPrisma.user.findUnique.mockResolvedValue(invitee);

      await expect(createInvitation('guild-123', 'leader-123', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.USER_ALREADY_IN_GUILD);
    });

    it('throws ALREADY_INVITED if pending invitation exists', async () => {
      const member = createMockGuildMember({ role: 'LEADER', guildId: 'guild-123' });
      const guild = createMockGuild({ _count: { members: 5 } });
      const invitee = createMockUser({ id: 'user-456' });
      const existingInvite = createMockInvitation();

      mockPrisma.guildMember.findUnique
        .mockResolvedValueOnce(member)
        .mockResolvedValueOnce(null);
      mockPrisma.guild.findUnique.mockResolvedValue({ ...guild, _count: { members: 5 } });
      mockPrisma.user.findUnique.mockResolvedValue(invitee);
      mockPrisma.guildInvitation.findFirst.mockResolvedValue(existingInvite);

      await expect(createInvitation('guild-123', 'leader-123', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.ALREADY_INVITED);
    });

    it('sets correct expiry time (72 hours)', async () => {
      const member = createMockGuildMember({ role: 'LEADER', guildId: 'guild-123' });
      const guild = createMockGuild({ _count: { members: 5 } });
      const invitee = createMockUser({ id: 'user-456' });
      const invitation = createMockInvitation();

      mockPrisma.guildMember.findUnique
        .mockResolvedValueOnce(member)
        .mockResolvedValueOnce(null);
      mockPrisma.guild.findUnique.mockResolvedValue({ ...guild, _count: { members: 5 } });
      mockPrisma.user.findUnique.mockResolvedValue(invitee);
      mockPrisma.guildInvitation.findFirst.mockResolvedValue(null);
      mockPrisma.guildInvitation.create.mockResolvedValue(invitation);

      await createInvitation('guild-123', 'leader-123', 'user-456');

      const createCall = mockPrisma.guildInvitation.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt as Date;
      const hoursUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);

      expect(hoursUntilExpiry).toBeCloseTo(72, 0);
    });

    it('allows OFFICER to invite', async () => {
      const member = createMockGuildMember({ role: 'OFFICER', guildId: 'guild-123' });
      const guild = createMockGuild({ _count: { members: 5 } });
      const invitee = createMockUser({ id: 'user-456' });
      const invitation = createMockInvitation();

      mockPrisma.guildMember.findUnique
        .mockResolvedValueOnce(member)
        .mockResolvedValueOnce(null);
      mockPrisma.guild.findUnique.mockResolvedValue({ ...guild, _count: { members: 5 } });
      mockPrisma.user.findUnique.mockResolvedValue(invitee);
      mockPrisma.guildInvitation.findFirst.mockResolvedValue(null);
      mockPrisma.guildInvitation.create.mockResolvedValue(invitation);

      const result = await createInvitation('guild-123', 'officer-123', 'user-456');

      expect(result).toBeDefined();
    });
  });

  // ============================================================================
  // getGuildInvitations
  // ============================================================================

  describe('getGuildInvitations', () => {
    it('returns guild invitations', async () => {
      const invitations = [createMockInvitation(), createMockInvitation({ id: 'inv-456' })];
      mockPrisma.guildInvitation.findMany.mockResolvedValue(invitations);
      mockPrisma.guildInvitation.count.mockResolvedValue(2);

      const result = await getGuildInvitations('guild-123');

      expect(result.invitations).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('filters by status', async () => {
      mockPrisma.guildInvitation.findMany.mockResolvedValue([]);
      mockPrisma.guildInvitation.count.mockResolvedValue(0);

      await getGuildInvitations('guild-123', 'ACCEPTED');

      expect(mockPrisma.guildInvitation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ACCEPTED' }),
        })
      );
    });

    it('respects pagination', async () => {
      mockPrisma.guildInvitation.findMany.mockResolvedValue([]);
      mockPrisma.guildInvitation.count.mockResolvedValue(50);

      await getGuildInvitations('guild-123', undefined, 10, 20);

      expect(mockPrisma.guildInvitation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        })
      );
    });
  });

  // ============================================================================
  // getUserInvitations
  // ============================================================================

  describe('getUserInvitations', () => {
    it('returns user pending invitations', async () => {
      const invitations = [createMockInvitation()];
      mockPrisma.guildInvitation.findMany.mockResolvedValue(invitations);
      mockPrisma.guildInvitation.count.mockResolvedValue(1);

      const result = await getUserInvitations('user-456');

      expect(result.invitations).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('only returns non-expired pending invitations', async () => {
      mockPrisma.guildInvitation.findMany.mockResolvedValue([]);
      mockPrisma.guildInvitation.count.mockResolvedValue(0);

      await getUserInvitations('user-456');

      expect(mockPrisma.guildInvitation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PENDING',
            expiresAt: { gt: expect.any(Date) },
          }),
        })
      );
    });

    it('respects pagination', async () => {
      mockPrisma.guildInvitation.findMany.mockResolvedValue([]);
      mockPrisma.guildInvitation.count.mockResolvedValue(0);

      await getUserInvitations('user-456', 5, 10);

      expect(mockPrisma.guildInvitation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
          skip: 10,
        })
      );
    });
  });

  // ============================================================================
  // getInvitation
  // ============================================================================

  describe('getInvitation', () => {
    it('returns invitation by id', async () => {
      const invitation = createMockInvitation();
      mockPrisma.guildInvitation.findUnique.mockResolvedValue(invitation);

      const result = await getInvitation('inv-123');

      expect(result).toEqual(invitation);
    });

    it('returns null for non-existent invitation', async () => {
      mockPrisma.guildInvitation.findUnique.mockResolvedValue(null);

      const result = await getInvitation('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // acceptInvitation
  // ============================================================================

  describe('acceptInvitation', () => {
    it('accepts invitation and creates membership', async () => {
      const invitation = createMockInvitation({
        guild: { name: 'Test', tag: 'TST', structureKwatera: 5, disbanded: false, _count: { members: 5 } },
      });
      mockPrisma.guildInvitation.findUnique.mockResolvedValue(invitation);
      mockPrisma.guildMember.findUnique.mockResolvedValue(null); // Not in any guild
      mockPrisma.$transaction.mockResolvedValue([{}, {}, {}]);

      await acceptInvitation('inv-123', 'user-456');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('throws INVITATION_NOT_FOUND for non-existent invitation', async () => {
      mockPrisma.guildInvitation.findUnique.mockResolvedValue(null);

      await expect(acceptInvitation('nonexistent', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.INVITATION_NOT_FOUND);
    });

    it('throws INSUFFICIENT_PERMISSIONS if not the invitee', async () => {
      const invitation = createMockInvitation({ inviteeId: 'other-user' });
      mockPrisma.guildInvitation.findUnique.mockResolvedValue(invitation);

      await expect(acceptInvitation('inv-123', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    });

    it('throws INVITATION_NOT_PENDING if not pending', async () => {
      const invitation = createMockInvitation({ status: 'DECLINED', inviteeId: 'user-456' });
      mockPrisma.guildInvitation.findUnique.mockResolvedValue(invitation);

      await expect(acceptInvitation('inv-123', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.INVITATION_NOT_PENDING);
    });

    it('throws INVITATION_EXPIRED if expired', async () => {
      const invitation = createMockInvitation({
        expiresAt: new Date(Date.now() - 1000), // Expired
        inviteeId: 'user-456',
        guild: { name: 'Test', tag: 'TST', structureKwatera: 5, disbanded: false, _count: { members: 5 } },
      });
      mockPrisma.guildInvitation.findUnique.mockResolvedValue(invitation);
      mockPrisma.guildInvitation.update.mockResolvedValue({});

      await expect(acceptInvitation('inv-123', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.INVITATION_EXPIRED);

      // Should update status to EXPIRED
      expect(mockPrisma.guildInvitation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'EXPIRED' },
        })
      );
    });

    it('throws GUILD_DISBANDED if guild is disbanded', async () => {
      const invitation = createMockInvitation({
        inviteeId: 'user-456',
        guild: { name: 'Test', tag: 'TST', structureKwatera: 5, disbanded: true, _count: { members: 5 } },
      });
      mockPrisma.guildInvitation.findUnique.mockResolvedValue(invitation);

      await expect(acceptInvitation('inv-123', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.GUILD_DISBANDED);
    });

    it('throws ALREADY_IN_GUILD if user already in guild', async () => {
      const invitation = createMockInvitation({
        inviteeId: 'user-456',
        guild: { name: 'Test', tag: 'TST', structureKwatera: 5, disbanded: false, _count: { members: 5 } },
      });
      const existingMembership = createMockGuildMember();

      mockPrisma.guildInvitation.findUnique.mockResolvedValue(invitation);
      mockPrisma.guildMember.findUnique.mockResolvedValue(existingMembership);

      await expect(acceptInvitation('inv-123', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.ALREADY_IN_GUILD);
    });

    it('throws GUILD_FULL if guild at capacity', async () => {
      const invitation = createMockInvitation({
        inviteeId: 'user-456',
        guild: { name: 'Test', tag: 'TST', structureKwatera: 0, disbanded: false, _count: { members: 10 } },
      });

      mockPrisma.guildInvitation.findUnique.mockResolvedValue(invitation);
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);

      await expect(acceptInvitation('inv-123', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.GUILD_FULL);
    });

    it('cancels other pending invitations on accept', async () => {
      const invitation = createMockInvitation({
        inviteeId: 'user-456',
        guild: { name: 'Test', tag: 'TST', structureKwatera: 5, disbanded: false, _count: { members: 5 } },
      });
      mockPrisma.guildInvitation.findUnique.mockResolvedValue(invitation);
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockResolvedValue([{}, {}, {}]);

      await acceptInvitation('inv-123', 'user-456');

      // The transaction should include cancelling other invitations
      const transactionCalls = mockPrisma.$transaction.mock.calls[0][0];
      expect(transactionCalls).toHaveLength(3);
    });
  });

  // ============================================================================
  // declineInvitation
  // ============================================================================

  describe('declineInvitation', () => {
    it('declines invitation', async () => {
      const invitation = createMockInvitation({ inviteeId: 'user-456' });
      mockPrisma.guildInvitation.findUnique.mockResolvedValue(invitation);
      mockPrisma.guildInvitation.update.mockResolvedValue({});

      await declineInvitation('inv-123', 'user-456');

      expect(mockPrisma.guildInvitation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'DECLINED',
            respondedAt: expect.any(Date),
          }),
        })
      );
    });

    it('throws INVITATION_NOT_FOUND for non-existent invitation', async () => {
      mockPrisma.guildInvitation.findUnique.mockResolvedValue(null);

      await expect(declineInvitation('nonexistent', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.INVITATION_NOT_FOUND);
    });

    it('throws INSUFFICIENT_PERMISSIONS if not the invitee', async () => {
      const invitation = createMockInvitation({ inviteeId: 'other-user' });
      mockPrisma.guildInvitation.findUnique.mockResolvedValue(invitation);

      await expect(declineInvitation('inv-123', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    });

    it('throws INVITATION_NOT_PENDING if already responded', async () => {
      const invitation = createMockInvitation({ inviteeId: 'user-456', status: 'ACCEPTED' });
      mockPrisma.guildInvitation.findUnique.mockResolvedValue(invitation);

      await expect(declineInvitation('inv-123', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.INVITATION_NOT_PENDING);
    });
  });

  // ============================================================================
  // cancelInvitation
  // ============================================================================

  describe('cancelInvitation', () => {
    it('allows inviter to cancel', async () => {
      const invitation = createMockInvitation({ inviterId: 'leader-123' });
      mockPrisma.guildInvitation.findUnique.mockResolvedValue(invitation);
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);
      mockPrisma.guildInvitation.update.mockResolvedValue({});

      await cancelInvitation('inv-123', 'leader-123');

      expect(mockPrisma.guildInvitation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'CANCELLED',
          }),
        })
      );
    });

    it('allows guild officer to cancel', async () => {
      const invitation = createMockInvitation({ inviterId: 'other-leader' });
      const officerMembership = createMockGuildMember({ role: 'OFFICER', guildId: 'guild-123' });

      mockPrisma.guildInvitation.findUnique.mockResolvedValue(invitation);
      mockPrisma.guildMember.findUnique.mockResolvedValue(officerMembership);
      mockPrisma.guildInvitation.update.mockResolvedValue({});

      await cancelInvitation('inv-123', 'officer-123');

      expect(mockPrisma.guildInvitation.update).toHaveBeenCalled();
    });

    it('allows guild leader to cancel', async () => {
      const invitation = createMockInvitation({ inviterId: 'other-user' });
      const leaderMembership = createMockGuildMember({ role: 'LEADER', guildId: 'guild-123' });

      mockPrisma.guildInvitation.findUnique.mockResolvedValue(invitation);
      mockPrisma.guildMember.findUnique.mockResolvedValue(leaderMembership);
      mockPrisma.guildInvitation.update.mockResolvedValue({});

      await cancelInvitation('inv-123', 'leader-123');

      expect(mockPrisma.guildInvitation.update).toHaveBeenCalled();
    });

    it('throws INVITATION_NOT_FOUND for non-existent invitation', async () => {
      mockPrisma.guildInvitation.findUnique.mockResolvedValue(null);

      await expect(cancelInvitation('nonexistent', 'user-123'))
        .rejects.toThrow(GUILD_ERROR_CODES.INVITATION_NOT_FOUND);
    });

    it('throws INSUFFICIENT_PERMISSIONS if not inviter and no guild permission', async () => {
      const invitation = createMockInvitation({ inviterId: 'other-leader' });
      const memberMembership = createMockGuildMember({ role: 'MEMBER', guildId: 'guild-123' });

      mockPrisma.guildInvitation.findUnique.mockResolvedValue(invitation);
      mockPrisma.guildMember.findUnique.mockResolvedValue(memberMembership);

      await expect(cancelInvitation('inv-123', 'member-123'))
        .rejects.toThrow(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    });

    it('throws INSUFFICIENT_PERMISSIONS if not in the same guild', async () => {
      const invitation = createMockInvitation({ inviterId: 'other-leader', guildId: 'guild-123' });
      const membership = createMockGuildMember({ role: 'LEADER', guildId: 'other-guild' });

      mockPrisma.guildInvitation.findUnique.mockResolvedValue(invitation);
      mockPrisma.guildMember.findUnique.mockResolvedValue(membership);

      await expect(cancelInvitation('inv-123', 'leader-123'))
        .rejects.toThrow(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    });

    it('throws INVITATION_NOT_PENDING if not pending', async () => {
      const invitation = createMockInvitation({ inviterId: 'leader-123', status: 'ACCEPTED' });
      mockPrisma.guildInvitation.findUnique.mockResolvedValue(invitation);
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);

      await expect(cancelInvitation('inv-123', 'leader-123'))
        .rejects.toThrow(GUILD_ERROR_CODES.INVITATION_NOT_PENDING);
    });
  });

  // ============================================================================
  // expireOldInvitations
  // ============================================================================

  describe('expireOldInvitations', () => {
    it('updates expired pending invitations', async () => {
      mockPrisma.guildInvitation.updateMany.mockResolvedValue({ count: 5 });

      const result = await expireOldInvitations();

      expect(result).toBe(5);
      expect(mockPrisma.guildInvitation.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'PENDING',
          expiresAt: { lt: expect.any(Date) },
        },
        data: { status: 'EXPIRED' },
      });
    });

    it('returns 0 when no invitations to expire', async () => {
      mockPrisma.guildInvitation.updateMany.mockResolvedValue({ count: 0 });

      const result = await expireOldInvitations();

      expect(result).toBe(0);
    });

    it('handles large batch of expired invitations', async () => {
      mockPrisma.guildInvitation.updateMany.mockResolvedValue({ count: 1000 });

      const result = await expireOldInvitations();

      expect(result).toBe(1000);
    });
  });

  // ============================================================================
  // createInvitation - Additional Edge Cases
  // ============================================================================

  describe('createInvitation - edge cases', () => {
    it('should allow invitation even if guild almost full', async () => {
      const member = createMockGuildMember({ role: 'LEADER', guildId: 'guild-123' });
      const guild = createMockGuild({
        id: 'guild-123',
        structureKwatera: 5, // 15 max members
        _count: { members: 14 }, // 1 slot left
      });
      const invitee = createMockUser({ id: 'user-456' });
      const invitation = createMockInvitation();

      mockPrisma.guildMember.findUnique
        .mockResolvedValueOnce(member)
        .mockResolvedValueOnce(null);
      mockPrisma.guild.findUnique.mockResolvedValue({ ...guild, _count: { members: 14 } });
      mockPrisma.user.findUnique.mockResolvedValue(invitee);
      mockPrisma.guildInvitation.findFirst.mockResolvedValue(null);
      mockPrisma.guildInvitation.create.mockResolvedValue(invitation);

      const result = await createInvitation('guild-123', 'leader-123', 'user-456');

      expect(result).toEqual(invitation);
    });

    it('should include optional message in invitation', async () => {
      const member = createMockGuildMember({ role: 'LEADER', guildId: 'guild-123' });
      const guild = createMockGuild({ id: 'guild-123', _count: { members: 5 } });
      const invitee = createMockUser({ id: 'user-456' });
      const invitation = createMockInvitation({ message: 'Welcome to our guild!' });

      mockPrisma.guildMember.findUnique
        .mockResolvedValueOnce(member)
        .mockResolvedValueOnce(null);
      mockPrisma.guild.findUnique.mockResolvedValue({ ...guild, _count: { members: 5 } });
      mockPrisma.user.findUnique.mockResolvedValue(invitee);
      mockPrisma.guildInvitation.findFirst.mockResolvedValue(null);
      mockPrisma.guildInvitation.create.mockResolvedValue(invitation);

      await createInvitation('guild-123', 'leader-123', 'user-456', 'Welcome to our guild!');

      expect(mockPrisma.guildInvitation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            message: 'Welcome to our guild!',
          }),
        })
      );
    });

    it('should handle empty message as null', async () => {
      const member = createMockGuildMember({ role: 'LEADER', guildId: 'guild-123' });
      const guild = createMockGuild({ id: 'guild-123', _count: { members: 5 } });
      const invitee = createMockUser({ id: 'user-456' });
      const invitation = createMockInvitation({ message: null });

      mockPrisma.guildMember.findUnique
        .mockResolvedValueOnce(member)
        .mockResolvedValueOnce(null);
      mockPrisma.guild.findUnique.mockResolvedValue({ ...guild, _count: { members: 5 } });
      mockPrisma.user.findUnique.mockResolvedValue(invitee);
      mockPrisma.guildInvitation.findFirst.mockResolvedValue(null);
      mockPrisma.guildInvitation.create.mockResolvedValue(invitation);

      await createInvitation('guild-123', 'leader-123', 'user-456', '');

      expect(mockPrisma.guildInvitation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            message: null,
          }),
        })
      );
    });
  });

  // ============================================================================
  // getGuildInvitations - Additional Edge Cases
  // ============================================================================

  describe('getGuildInvitations - edge cases', () => {
    it('should return empty when no invitations exist', async () => {
      mockPrisma.guildInvitation.findMany.mockResolvedValue([]);
      mockPrisma.guildInvitation.count.mockResolvedValue(0);

      const result = await getGuildInvitations('guild-123');

      expect(result.invitations).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle large offset correctly', async () => {
      mockPrisma.guildInvitation.findMany.mockResolvedValue([]);
      mockPrisma.guildInvitation.count.mockResolvedValue(5);

      const result = await getGuildInvitations('guild-123', undefined, 10, 100);

      expect(result.invitations).toEqual([]);
      expect(result.total).toBe(5);
    });

    it('should filter by DECLINED status', async () => {
      mockPrisma.guildInvitation.findMany.mockResolvedValue([]);
      mockPrisma.guildInvitation.count.mockResolvedValue(0);

      await getGuildInvitations('guild-123', 'DECLINED');

      expect(mockPrisma.guildInvitation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'DECLINED' }),
        })
      );
    });

    it('should filter by EXPIRED status', async () => {
      mockPrisma.guildInvitation.findMany.mockResolvedValue([]);
      mockPrisma.guildInvitation.count.mockResolvedValue(0);

      await getGuildInvitations('guild-123', 'EXPIRED');

      expect(mockPrisma.guildInvitation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'EXPIRED' }),
        })
      );
    });
  });

  // ============================================================================
  // getUserInvitations - Additional Edge Cases
  // ============================================================================

  describe('getUserInvitations - edge cases', () => {
    it('should not return expired invitations even if status is PENDING', async () => {
      mockPrisma.guildInvitation.findMany.mockResolvedValue([]);
      mockPrisma.guildInvitation.count.mockResolvedValue(0);

      await getUserInvitations('user-456');

      expect(mockPrisma.guildInvitation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PENDING',
            expiresAt: { gt: expect.any(Date) },
          }),
        })
      );
    });

    it('should order by creation date descending', async () => {
      mockPrisma.guildInvitation.findMany.mockResolvedValue([]);
      mockPrisma.guildInvitation.count.mockResolvedValue(0);

      await getUserInvitations('user-456');

      expect(mockPrisma.guildInvitation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });
  });

  // ============================================================================
  // getInvitation - Additional Edge Cases
  // ============================================================================

  describe('getInvitation - edge cases', () => {
    it('should include guild details', async () => {
      const invitation = createMockInvitation({
        guild: { name: 'Test Guild', tag: 'TST' },
      });
      mockPrisma.guildInvitation.findUnique.mockResolvedValue(invitation);

      const result = await getInvitation('inv-123');

      expect(result?.guild.name).toBe('Test Guild');
      expect(result?.guild.tag).toBe('TST');
    });

    it('should include inviter details', async () => {
      const invitation = createMockInvitation({
        inviter: { displayName: 'GuildLeader' },
      });
      mockPrisma.guildInvitation.findUnique.mockResolvedValue(invitation);

      const result = await getInvitation('inv-123');

      expect(result?.inviter.displayName).toBe('GuildLeader');
    });

    it('should include invitee details', async () => {
      const invitation = createMockInvitation({
        invitee: { displayName: 'NewPlayer' },
      });
      mockPrisma.guildInvitation.findUnique.mockResolvedValue(invitation);

      const result = await getInvitation('inv-123');

      expect(result?.invitee.displayName).toBe('NewPlayer');
    });
  });

  // ============================================================================
  // acceptInvitation - Additional Edge Cases
  // ============================================================================

  describe('acceptInvitation - edge cases', () => {
    it('should handle edge case of accepting just before expiry', async () => {
      const almostExpired = new Date(Date.now() + 1000); // 1 second from now
      const invitation = createMockInvitation({
        expiresAt: almostExpired,
        inviteeId: 'user-456',
        guild: { name: 'Test', tag: 'TST', structureKwatera: 5, disbanded: false, _count: { members: 5 } },
      });
      mockPrisma.guildInvitation.findUnique.mockResolvedValue(invitation);
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockResolvedValue([{}, {}, {}]);

      // Should not throw
      await acceptInvitation('inv-123', 'user-456');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // declineInvitation - Additional Edge Cases
  // ============================================================================

  describe('declineInvitation - edge cases', () => {
    it('should throw if invitation expired', async () => {
      const invitation = createMockInvitation({
        inviteeId: 'user-456',
        status: 'EXPIRED',
      });
      mockPrisma.guildInvitation.findUnique.mockResolvedValue(invitation);

      await expect(declineInvitation('inv-123', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.INVITATION_NOT_PENDING);
    });

    it('should throw if invitation cancelled', async () => {
      const invitation = createMockInvitation({
        inviteeId: 'user-456',
        status: 'CANCELLED',
      });
      mockPrisma.guildInvitation.findUnique.mockResolvedValue(invitation);

      await expect(declineInvitation('inv-123', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.INVITATION_NOT_PENDING);
    });
  });

  // ============================================================================
  // cancelInvitation - Additional Edge Cases
  // ============================================================================

  describe('cancelInvitation - edge cases', () => {
    it('should throw if invitation expired', async () => {
      const invitation = createMockInvitation({
        inviterId: 'leader-123',
        status: 'EXPIRED',
      });
      mockPrisma.guildInvitation.findUnique.mockResolvedValue(invitation);
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);

      await expect(cancelInvitation('inv-123', 'leader-123'))
        .rejects.toThrow(GUILD_ERROR_CODES.INVITATION_NOT_PENDING);
    });

    it('should throw if invitation declined', async () => {
      const invitation = createMockInvitation({
        inviterId: 'leader-123',
        status: 'DECLINED',
      });
      mockPrisma.guildInvitation.findUnique.mockResolvedValue(invitation);
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);

      await expect(cancelInvitation('inv-123', 'leader-123'))
        .rejects.toThrow(GUILD_ERROR_CODES.INVITATION_NOT_PENDING);
    });

    it('should allow cancel by original inviter who is no longer in guild', async () => {
      const invitation = createMockInvitation({
        inviterId: 'ex-leader-123',
        status: 'PENDING',
      });
      mockPrisma.guildInvitation.findUnique.mockResolvedValue(invitation);
      mockPrisma.guildMember.findUnique.mockResolvedValue(null); // Ex-leader no longer in any guild
      mockPrisma.guildInvitation.update.mockResolvedValue({});

      // Should succeed - inviter can always cancel their own invitations
      await cancelInvitation('inv-123', 'ex-leader-123');

      expect(mockPrisma.guildInvitation.update).toHaveBeenCalled();
    });
  });
});
