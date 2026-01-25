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

    it('should throw APPLICATION_NOT_PENDING if already processed', async () => {
      const application = createMockGuildApplication({
        id: 'app-123',
        applicantId: 'user-456',
        status: 'ACCEPTED',
      });
      mockPrisma.guildApplication.findUnique.mockResolvedValue(application);

      await expect(cancelApplication('app-123', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.APPLICATION_NOT_PENDING);
    });
  });

  // ============================================================================
  // createApplication - Additional Edge Cases
  // ============================================================================

  describe('createApplication - edge cases', () => {
    it('should throw USER_NOT_FOUND if applicant does not exist', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);
      mockPrisma.guild.findUnique.mockResolvedValue(
        createMockGuild({
          id: 'guild-123',
          settings: { accessMode: 'APPLY', minLevel: 1 },
          _count: { members: 5 },
        })
      );
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(createApplication('guild-123', 'nonexistent-user'))
        .rejects.toThrow(GUILD_ERROR_CODES.USER_NOT_FOUND);
    });

    it('should throw MAX_APPLICATIONS_REACHED if too many active applications', async () => {
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
      mockPrisma.guildApplication.count.mockResolvedValue(5); // Max is typically 5

      await expect(createApplication('guild-123', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.MAX_APPLICATIONS_REACHED);
    });

    it('should allow application at minLevel boundary', async () => {
      const application = createMockGuildApplication();
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);
      mockPrisma.guild.findUnique.mockResolvedValue(
        createMockGuild({
          id: 'guild-123',
          settings: { accessMode: 'APPLY', minLevel: 50 },
          _count: { members: 5 },
        })
      );
      mockPrisma.user.findUnique.mockResolvedValue(
        createMockUser({ id: 'user-456', highestWave: 50 })
      );
      mockPrisma.guildApplication.findFirst.mockResolvedValue(null);
      mockPrisma.guildApplication.count.mockResolvedValue(0);
      mockPrisma.guildApplication.create.mockResolvedValue(application);

      const result = await createApplication('guild-123', 'user-456');

      expect(result).toEqual(application);
    });

    it('should create application without message', async () => {
      const application = createMockGuildApplication({ message: null });
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

      await createApplication('guild-123', 'user-456');

      expect(mockPrisma.guildApplication.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            message: null,
          }),
        })
      );
    });

    it('should handle null settings as INVITE_ONLY mode', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);
      mockPrisma.guild.findUnique.mockResolvedValue(
        createMockGuild({
          id: 'guild-123',
          settings: null, // No settings - defaults to INVITE_ONLY
          _count: { members: 5 },
        })
      );

      await expect(createApplication('guild-123', 'user-456'))
        .rejects.toThrow(GUILD_ERROR_CODES.GUILD_NOT_ACCEPTING_APPLICATIONS);
    });
  });

  // ============================================================================
  // acceptApplication - Additional Edge Cases
  // ============================================================================

  describe('acceptApplication - edge cases', () => {
    it('should throw INSUFFICIENT_PERMISSIONS if responder in different guild', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const application = createMockGuildApplication({
        id: 'app-123',
        guildId: 'guild-123',
        status: 'PENDING',
        expiresAt: futureDate,
        guild: { structureKwatera: 5, disbanded: false, _count: { members: 5 } },
      });
      mockPrisma.guildApplication.findUnique.mockResolvedValue(application);
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER', guildId: 'different-guild' })
      );

      await expect(acceptApplication('app-123', 'leader-123'))
        .rejects.toThrow(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    });

    it('should throw GUILD_DISBANDED if guild was disbanded', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const application = createMockGuildApplication({
        id: 'app-123',
        guildId: 'guild-123',
        status: 'PENDING',
        expiresAt: futureDate,
        guild: { structureKwatera: 5, disbanded: true, _count: { members: 5 } },
      });
      mockPrisma.guildApplication.findUnique.mockResolvedValue(application);
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER', guildId: 'guild-123' })
      );

      await expect(acceptApplication('app-123', 'leader-123'))
        .rejects.toThrow(GUILD_ERROR_CODES.GUILD_DISBANDED);
    });

    it('should throw USER_ALREADY_IN_GUILD if applicant joined another guild', async () => {
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
        .mockResolvedValueOnce(createMockGuildMember({ userId: 'user-456', guildId: 'other-guild' }));

      await expect(acceptApplication('app-123', 'leader-123'))
        .rejects.toThrow(GUILD_ERROR_CODES.USER_ALREADY_IN_GUILD);
    });

    it('should throw GUILD_FULL if guild reached capacity since application', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      mockGetMemberCapacity.mockReturnValue(10);
      const application = createMockGuildApplication({
        id: 'app-123',
        guildId: 'guild-123',
        applicantId: 'user-456',
        status: 'PENDING',
        expiresAt: futureDate,
        guild: { structureKwatera: 0, disbanded: false, _count: { members: 10 } }, // Full
      });
      mockPrisma.guildApplication.findUnique.mockResolvedValue(application);
      mockPrisma.guildMember.findUnique
        .mockResolvedValueOnce(createMockGuildMember({ role: 'LEADER', guildId: 'guild-123' }))
        .mockResolvedValueOnce(null);

      await expect(acceptApplication('app-123', 'leader-123'))
        .rejects.toThrow(GUILD_ERROR_CODES.GUILD_FULL);
    });

    it('should allow OFFICER to accept applications', async () => {
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
        .mockResolvedValueOnce(createMockGuildMember({ role: 'OFFICER', guildId: 'guild-123' }))
        .mockResolvedValueOnce(null);
      mockPrisma.$transaction.mockResolvedValue([{}, {}, {}, {}]);

      await acceptApplication('app-123', 'officer-123');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // declineApplication - Additional Edge Cases
  // ============================================================================

  describe('declineApplication - edge cases', () => {
    it('should throw INSUFFICIENT_PERMISSIONS if responder in different guild', async () => {
      const application = createMockGuildApplication({
        id: 'app-123',
        guildId: 'guild-123',
        status: 'PENDING',
      });
      mockPrisma.guildApplication.findUnique.mockResolvedValue(application);
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER', guildId: 'different-guild' })
      );

      await expect(declineApplication('app-123', 'leader-123'))
        .rejects.toThrow(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    });

    it('should throw APPLICATION_NOT_PENDING if expired', async () => {
      const application = createMockGuildApplication({
        id: 'app-123',
        guildId: 'guild-123',
        status: 'EXPIRED',
      });
      mockPrisma.guildApplication.findUnique.mockResolvedValue(application);
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'LEADER', guildId: 'guild-123' })
      );

      await expect(declineApplication('app-123', 'leader-123'))
        .rejects.toThrow(GUILD_ERROR_CODES.APPLICATION_NOT_PENDING);
    });

    it('should allow OFFICER to decline applications', async () => {
      const application = createMockGuildApplication({
        id: 'app-123',
        guildId: 'guild-123',
        status: 'PENDING',
      });
      mockPrisma.guildApplication.findUnique.mockResolvedValue(application);
      mockPrisma.guildMember.findUnique.mockResolvedValue(
        createMockGuildMember({ role: 'OFFICER', guildId: 'guild-123' })
      );
      mockPrisma.guildApplication.update.mockResolvedValue({});

      await declineApplication('app-123', 'officer-123');

      expect(mockPrisma.guildApplication.update).toHaveBeenCalled();
    });

    it('should throw INSUFFICIENT_PERMISSIONS if not in guild', async () => {
      const application = createMockGuildApplication({
        id: 'app-123',
        guildId: 'guild-123',
        status: 'PENDING',
      });
      mockPrisma.guildApplication.findUnique.mockResolvedValue(application);
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);

      await expect(declineApplication('app-123', 'random-user'))
        .rejects.toThrow(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    });
  });

  // ============================================================================
  // getGuildApplications - Additional Tests
  // ============================================================================

  describe('getGuildApplications - edge cases', () => {
    it('should respect pagination with offset', async () => {
      mockPrisma.guildApplication.findMany.mockResolvedValue([]);
      mockPrisma.guildApplication.count.mockResolvedValue(100);

      await getGuildApplications('guild-123', undefined, 25, 50);

      expect(mockPrisma.guildApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 25,
          skip: 50,
        })
      );
    });

    it('should return empty when guild has no applications', async () => {
      mockPrisma.guildApplication.findMany.mockResolvedValue([]);
      mockPrisma.guildApplication.count.mockResolvedValue(0);

      const result = await getGuildApplications('guild-123');

      expect(result.applications).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should order by createdAt descending', async () => {
      mockPrisma.guildApplication.findMany.mockResolvedValue([]);
      mockPrisma.guildApplication.count.mockResolvedValue(0);

      await getGuildApplications('guild-123');

      expect(mockPrisma.guildApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });
  });

  // ============================================================================
  // getUserApplications - Additional Tests
  // ============================================================================

  describe('getUserApplications - edge cases', () => {
    it('should respect pagination', async () => {
      mockPrisma.guildApplication.findMany.mockResolvedValue([]);
      mockPrisma.guildApplication.count.mockResolvedValue(10);

      await getUserApplications('user-456', 5, 5);

      expect(mockPrisma.guildApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
          skip: 5,
        })
      );
    });

    it('should return empty when user has no pending applications', async () => {
      mockPrisma.guildApplication.findMany.mockResolvedValue([]);
      mockPrisma.guildApplication.count.mockResolvedValue(0);

      const result = await getUserApplications('user-456');

      expect(result.applications).toEqual([]);
      expect(result.total).toBe(0);
    });
  });
});
