/**
 * Guild Application service unit tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../../helpers/setup.js';
import {
  createApplication,
  getGuildApplications,
  getUserApplications,
  acceptApplication,
  declineApplication,
  cancelApplication,
} from '../../../services/guildApplication.js';
import {
  mockPrisma,
  createMockGuildApplication,
  createMockGuild,
  createMockGuildMember,
  createMockUser,
} from '../../mocks/prisma.js';
import { GUILD_ERROR_CODES } from '@arcade/protocol';
import * as guildModule from '../../../services/guild.js';
import * as guildStructuresModule from '../../../services/guildStructures.js';
import * as guildPreviewModule from '../../../services/guildPreview.js';

// Mock the guild module
vi.mock('../../../services/guild.js', () => ({
  hasPermission: vi.fn(),
}));

// Mock the guildStructures module
vi.mock('../../../services/guildStructures.js', () => ({
  getMemberCapacity: vi.fn().mockReturnValue(50),
}));

// Mock the guildPreview module
vi.mock('../../../services/guildPreview.js', () => ({
  invalidateGuildPreviewCache: vi.fn(),
}));

const mockHasPermission = guildModule.hasPermission as ReturnType<typeof vi.fn>;
const mockGetMemberCapacity = guildStructuresModule.getMemberCapacity as ReturnType<typeof vi.fn>;
const mockInvalidateGuildPreviewCache = guildPreviewModule.invalidateGuildPreviewCache as ReturnType<typeof vi.fn>;

describe('Guild Application Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set default behavior for guild mocks
    mockHasPermission.mockImplementation((role: string, action: string) => {
      if (action === 'invite') {
        return role === 'LEADER' || role === 'OFFICER';
      }
      return false;
    });
    mockGetMemberCapacity.mockReturnValue(50);
    mockInvalidateGuildPreviewCache.mockResolvedValue(undefined);
  });

  // ============================================================================
  // createApplication
  // ============================================================================

  describe('createApplication', () => {
    it('should throw ALREADY_IN_GUILD if applicant is in a guild', async () => {
      const existingMembership = createMockGuildMember({ userId: 'user-456' });
      mockPrisma.guildMember.findUnique.mockResolvedValue(existingMembership);

      await expect(createApplication('guild-123', 'user-456', 'Please accept me!'))
        .rejects.toThrow(GUILD_ERROR_CODES.ALREADY_IN_GUILD);
    });

    it('should throw GUILD_NOT_FOUND if guild does not exist', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);
      mockPrisma.guild.findUnique.mockResolvedValue(null);

      await expect(createApplication('nonexistent-guild', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.GUILD_NOT_FOUND);
    });

    it('should throw GUILD_NOT_FOUND if guild is disbanded', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);
      mockPrisma.guild.findUnique.mockResolvedValue(
        createMockGuild({ id: 'guild-123', disbanded: true })
      );

      await expect(createApplication('guild-123', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.GUILD_NOT_FOUND);
    });

    it('should throw GUILD_CLOSED if access mode is CLOSED', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);
      mockPrisma.guild.findUnique.mockResolvedValue(
        createMockGuild({
          id: 'guild-123',
          settings: { accessMode: 'CLOSED', minLevel: 1 },
          _count: { members: 5 },
        })
      );

      await expect(createApplication('guild-123', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.GUILD_CLOSED);
    });

    it('should throw GUILD_NOT_ACCEPTING_APPLICATIONS if not APPLY mode', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);
      mockPrisma.guild.findUnique.mockResolvedValue(
        createMockGuild({
          id: 'guild-123',
          settings: { accessMode: 'INVITE_ONLY', minLevel: 1 },
          _count: { members: 5 },
        })
      );

      await expect(createApplication('guild-123', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.GUILD_NOT_ACCEPTING_APPLICATIONS);
    });

    it('should throw GUILD_FULL if at capacity', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);
      mockGetMemberCapacity.mockReturnValue(10);
      mockPrisma.guild.findUnique.mockResolvedValue(
        createMockGuild({
          id: 'guild-123',
          structureKwatera: 0,
          settings: { accessMode: 'APPLY', minLevel: 1 },
          _count: { members: 10 },
        })
      );

      await expect(createApplication('guild-123', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.GUILD_FULL);
    });

    it('should throw LEVEL_TOO_LOW if below minLevel', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);
      mockPrisma.guild.findUnique.mockResolvedValue(
        createMockGuild({
          id: 'guild-123',
          settings: { accessMode: 'APPLY', minLevel: 50 },
          _count: { members: 5 },
        })
      );
      mockPrisma.user.findUnique.mockResolvedValue(
        createMockUser({ id: 'user-456', highestWave: 10 })
      );

      await expect(createApplication('guild-123', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.LEVEL_TOO_LOW);
    });

    it('should throw ALREADY_APPLIED if pending application exists', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);
      mockPrisma.guild.findUnique.mockResolvedValue(
        createMockGuild({
          id: 'guild-123',
          settings: { accessMode: 'APPLY', minLevel: 1 },
          _count: { members: 5 },
        })
      );
      mockPrisma.user.findUnique.mockResolvedValue(
        createMockUser({ id: 'user-456', highestWave: 50 })
      );
      mockPrisma.guildApplication.findFirst.mockResolvedValue(
        createMockGuildApplication({ applicantId: 'user-456', guildId: 'guild-123' })
      );

      await expect(createApplication('guild-123', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.ALREADY_APPLIED);
    });

    it('should create application with correct expiry', async () => {
      const application = createMockGuildApplication();
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);
      mockPrisma.guild.findUnique.mockResolvedValue(
        createMockGuild({
          id: 'guild-123',
          settings: { accessMode: 'APPLY', minLevel: 1 },
          _count: { members: 5 },
        })
      );
      mockPrisma.user.findUnique.mockResolvedValue(
        createMockUser({ id: 'user-456', highestWave: 50 })
      );
      mockPrisma.guildApplication.findFirst.mockResolvedValue(null);
      mockPrisma.guildApplication.count.mockResolvedValue(0);
      mockPrisma.guildApplication.create.mockResolvedValue(application);

      const result = await createApplication('guild-123', 'user-456', 'Please accept me!');

      expect(result).toEqual(application);
      expect(mockPrisma.guildApplication.create).toHaveBeenCalled();
      const createCall = mockPrisma.guildApplication.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt as Date;
      const hoursUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
      expect(hoursUntilExpiry).toBeCloseTo(72, 0);
    });
  });

  // ============================================================================
  // getGuildApplications
  // ============================================================================

  describe('getGuildApplications', () => {
    it('should return paginated applications for guild', async () => {
      const applications = [
        createMockGuildApplication({ id: 'app-1' }),
        createMockGuildApplication({ id: 'app-2' }),
      ];
      mockPrisma.guildApplication.findMany.mockResolvedValue(applications);
      mockPrisma.guildApplication.count.mockResolvedValue(2);

      const result = await getGuildApplications('guild-123');

      expect(result.applications).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockPrisma.guildApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { guildId: 'guild-123' },
        })
      );
    });

    it('should filter by status when provided', async () => {
      mockPrisma.guildApplication.findMany.mockResolvedValue([]);
      mockPrisma.guildApplication.count.mockResolvedValue(0);

      await getGuildApplications('guild-123', 'ACCEPTED');

      expect(mockPrisma.guildApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ACCEPTED' }),
        })
      );
    });
  });

  // ============================================================================
  // getUserApplications
  // ============================================================================

  describe('getUserApplications', () => {
    it('should return user pending applications', async () => {
      const applications = [createMockGuildApplication({ applicantId: 'user-456' })];
      mockPrisma.guildApplication.findMany.mockResolvedValue(applications);
      mockPrisma.guildApplication.count.mockResolvedValue(1);

      const result = await getUserApplications('user-456');

      expect(result.applications).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter out expired applications', async () => {
      mockPrisma.guildApplication.findMany.mockResolvedValue([]);
      mockPrisma.guildApplication.count.mockResolvedValue(0);

      await getUserApplications('user-456');

      expect(mockPrisma.guildApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            applicantId: 'user-456',
            status: 'PENDING',
            expiresAt: { gt: expect.any(Date) },
          }),
        })
      );
    });
  });

  // ============================================================================
  // acceptApplication
  // ============================================================================

  describe('acceptApplication', () => {
    it('should throw APPLICATION_NOT_FOUND if not exists', async () => {
      mockPrisma.guildApplication.findUnique.mockResolvedValue(null);

      await expect(acceptApplication('nonexistent', 'responder-123'))
        .rejects.toThrow(GUILD_ERROR_CODES.APPLICATION_NOT_FOUND);
    });

    it('should throw INSUFFICIENT_PERMISSIONS if not officer/leader', async () => {
      const application = createMockGuildApplication({
        id: 'app-123',
        guildId: 'guild-123',
        guild: { structureKwatera: 5, disbanded: false, _count: { members: 5 } },
      });
      mockPrisma.guildApplication.findUnique.mockResolvedValue(application);
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'MEMBER', guildId: 'guild-123' })
      );

      await expect(acceptApplication('app-123', 'member-123'))
        .rejects.toThrow(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    });

    it('should throw APPLICATION_NOT_PENDING if already processed', async () => {
      const application = createMockGuildApplication({
        id: 'app-123',
        guildId: 'guild-123',
        status: 'DECLINED',
        guild: { structureKwatera: 5, disbanded: false, _count: { members: 5 } },
      });
      mockPrisma.guildApplication.findUnique.mockResolvedValue(application);
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER', guildId: 'guild-123' })
      );

      await expect(acceptApplication('app-123', 'leader-123'))
        .rejects.toThrow(GUILD_ERROR_CODES.APPLICATION_NOT_PENDING);
    });

    it('should throw APPLICATION_EXPIRED if expired', async () => {
      const expiredDate = new Date(Date.now() - 1000);
      const application = createMockGuildApplication({
        id: 'app-123',
        guildId: 'guild-123',
        status: 'PENDING',
        expiresAt: expiredDate,
        guild: { structureKwatera: 5, disbanded: false, _count: { members: 5 } },
      });
      mockPrisma.guildApplication.findUnique.mockResolvedValue(application);
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER', guildId: 'guild-123' })
      );
      mockPrisma.guildApplication.update.mockResolvedValue({});

      await expect(acceptApplication('app-123', 'leader-123'))
        .rejects.toThrow(GUILD_ERROR_CODES.APPLICATION_EXPIRED);

      expect(mockPrisma.guildApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'EXPIRED' },
        })
      );
    });

    it('should create guild membership on accept', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const application = createMockGuildApplication({
        id: 'app-123',
        guildId: 'guild-123',
        applicantId: 'user-456',
        status: 'PENDING',
        expiresAt: futureDate,
        guild: { structureKwatera: 5, disbanded: false, _count: { members: 5 } },
      });
      mockPrisma.guildApplication.findUnique.mockResolvedValue(application);
      mockPrisma.guildMember.findUnique
        .mockResolvedValueOnce(createMockGuildMember({ role: 'LEADER', guildId: 'guild-123' }))
        .mockResolvedValueOnce(null); // Applicant not in guild
      mockPrisma.$transaction.mockResolvedValue([{}, {}, {}, {}]);

      await acceptApplication('app-123', 'leader-123');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockInvalidateGuildPreviewCache).toHaveBeenCalledWith('guild-123');
    });

    it('should cancel other pending applications for user on accept', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const application = createMockGuildApplication({
        id: 'app-123',
        guildId: 'guild-123',
        applicantId: 'user-456',
        status: 'PENDING',
        expiresAt: futureDate,
        guild: { structureKwatera: 5, disbanded: false, _count: { members: 5 } },
      });
      mockPrisma.guildApplication.findUnique.mockResolvedValue(application);
      mockPrisma.guildMember.findUnique
        .mockResolvedValueOnce(createMockGuildMember({ role: 'LEADER', guildId: 'guild-123' }))
        .mockResolvedValueOnce(null);
      mockPrisma.$transaction.mockResolvedValue([{}, {}, {}, {}]);

      await acceptApplication('app-123', 'leader-123');

      // Transaction should include updating other applications and invitations
      const transactionCalls = mockPrisma.$transaction.mock.calls[0][0];
      expect(transactionCalls).toHaveLength(4); // update app, create member, cancel apps, cancel invites
    });
  });

  // ============================================================================
  // declineApplication
  // ============================================================================

  describe('declineApplication', () => {
    it('should throw APPLICATION_NOT_FOUND if not exists', async () => {
      mockPrisma.guildApplication.findUnique.mockResolvedValue(null);

      await expect(declineApplication('nonexistent', 'responder-123'))
        .rejects.toThrow(GUILD_ERROR_CODES.APPLICATION_NOT_FOUND);
    });

    it('should throw INSUFFICIENT_PERMISSIONS if not officer/leader', async () => {
      const application = createMockGuildApplication({
        id: 'app-123',
        guildId: 'guild-123',
      });
      mockPrisma.guildApplication.findUnique.mockResolvedValue(application);
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'MEMBER', guildId: 'guild-123' })
      );

      await expect(declineApplication('app-123', 'member-123'))
        .rejects.toThrow(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    });

    it('should update status to DECLINED', async () => {
      const application = createMockGuildApplication({
        id: 'app-123',
        guildId: 'guild-123',
        status: 'PENDING',
      });
      mockPrisma.guildApplication.findUnique.mockResolvedValue(application);
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER', guildId: 'guild-123' })
      );
      mockPrisma.guildApplication.update.mockResolvedValue({});

      await declineApplication('app-123', 'leader-123');

      expect(mockPrisma.guildApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'app-123' },
          data: expect.objectContaining({
            status: 'DECLINED',
            respondedAt: expect.any(Date),
            respondedBy: 'leader-123',
          }),
        })
      );
    });
  });

  // ============================================================================
  // cancelApplication
  // ============================================================================

  describe('cancelApplication', () => {
    it('should throw APPLICATION_NOT_FOUND if not exists', async () => {
      mockPrisma.guildApplication.findUnique.mockResolvedValue(null);

      await expect(cancelApplication('nonexistent', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.APPLICATION_NOT_FOUND);
    });

    it('should throw INSUFFICIENT_PERMISSIONS if not applicant', async () => {
      const application = createMockGuildApplication({
        id: 'app-123',
        applicantId: 'other-user',
      });
      mockPrisma.guildApplication.findUnique.mockResolvedValue(application);

      await expect(cancelApplication('app-123', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    });

    it('should update status to CANCELLED', async () => {
      const application = createMockGuildApplication({
        id: 'app-123',
        applicantId: 'user-456',
        status: 'PENDING',
      });
      mockPrisma.guildApplication.findUnique.mockResolvedValue(application);
      mockPrisma.guildApplication.update.mockResolvedValue({});

      await cancelApplication('app-123', 'user-456');

      expect(mockPrisma.guildApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'app-123' },
          data: expect.objectContaining({
            status: 'CANCELLED',
            respondedAt: expect.any(Date),
          }),
        })
      );
    });
  });
});
