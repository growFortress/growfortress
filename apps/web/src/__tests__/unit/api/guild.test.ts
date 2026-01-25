/**
 * Guild API tests
 *
 * Tests for guild CRUD, member management, treasury, battles, and other guild operations.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMockResponse,
  createErrorResponse,
  createNoContentResponse,
} from '../../mocks/api.js';
import {
  createMockGuild,
  createMockGuildWithMembers,
  createMockGuildMember,
  createMockGuildTreasury,
  createMockGuildInvitation,
  createMockGuildApplication,
} from '../../mocks/data.js';

// Mock config
vi.mock('../../../config.js', () => ({
  CONFIG: {
    API_URL: 'http://localhost:3000',
  },
}));

// Mock auth module
vi.mock('../../../api/auth.js', () => ({
  getAccessToken: vi.fn(() => 'mock-token'),
}));

// Mock AudioManager to prevent document access
vi.mock('../../../game/AudioManager.js', () => ({
  AudioManager: {
    getInstance: vi.fn(() => ({
      play: vi.fn(),
      playMusic: vi.fn(),
      stopMusic: vi.fn(),
      setMasterVolume: vi.fn(),
      setMusicVolume: vi.fn(),
      setSfxVolume: vi.fn(),
    })),
  },
}));

// Mock ui.signals to prevent AudioManager dependency chain
vi.mock('../../../state/ui.signals.js', () => ({
  currentModal: { value: null },
  modals: { value: [] },
  toasts: { value: [] },
  showToast: vi.fn(),
  hideToast: vi.fn(),
  showModal: vi.fn(),
  hideModal: vi.fn(),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocks
import {
  getMyGuild,
  createGuild,
  getGuild,
  updateGuild,
  updateGuildDescription,
  updateGuildNotes,
  updateGuildEmblem,
  sendGuildMessage,
  getGuildMessages,
  disbandGuild,
  searchGuilds,
  leaveGuild,
  kickMember,
  updateMemberRole,
  transferLeadership,
  sendInvitation,
  getGuildInvitations,
  getReceivedInvitations,
  acceptInvitation,
  declineInvitation,
  cancelInvitation,
  joinGuildDirect,
  submitApplication,
  getGuildApplications,
  getMyApplications,
  acceptApplication,
  declineApplication,
  cancelApplication,
  getTreasury,
} from '../../../api/guild.js';

describe('Guild API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // GUILD CRUD
  // ==========================================================================

  describe('getMyGuild', () => {
    it('should fetch current user guild', async () => {
      const mockGuild = createMockGuildWithMembers();
      mockFetch.mockResolvedValue(createMockResponse({ guild: mockGuild, membership: createMockGuildMember() }));

      const result = await getMyGuild();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds/me',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token',
          }),
        })
      );
      expect(result.guild).toBeDefined();
    });
  });

  describe('createGuild', () => {
    it('should create a new guild', async () => {
      const mockGuild = createMockGuild({ name: 'New Guild' });
      mockFetch.mockResolvedValue(createMockResponse({ guild: mockGuild }));

      const result = await createGuild({
        name: 'New Guild',
        tag: 'NEW',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result.guild.name).toBe('New Guild');
    });
  });

  describe('getGuild', () => {
    it('should fetch guild by ID', async () => {
      const mockGuild = createMockGuildWithMembers();
      mockFetch.mockResolvedValue(createMockResponse({ guild: mockGuild }));

      const result = await getGuild('guild-123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds/guild-123',
        expect.anything()
      );
      expect(result.guild).toBeDefined();
    });

    it('should encode guild ID in URL', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ guild: createMockGuild() }));

      await getGuild('guild/with/slashes');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds/guild%2Fwith%2Fslashes',
        expect.anything()
      );
    });
  });

  describe('updateGuild', () => {
    it('should update guild settings', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ guild: createMockGuild({ name: 'Updated Guild' }) }));

      await updateGuild('guild-123', { name: 'Updated Guild' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds/guild-123',
        expect.objectContaining({
          method: 'PATCH',
        })
      );
    });
  });

  describe('updateGuildDescription', () => {
    it('should update guild description', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ guild: createMockGuild() }));

      await updateGuildDescription('guild-123', 'New description');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds/guild-123/description',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ description: 'New description' }),
        })
      );
    });

    it('should clear description when null', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ guild: createMockGuild() }));

      await updateGuildDescription('guild-123', null);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          body: JSON.stringify({ description: null }),
        })
      );
    });
  });

  describe('updateGuildNotes', () => {
    it('should update guild notes', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ guild: createMockGuild() }));

      await updateGuildNotes('guild-123', 'Internal notes');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds/guild-123/notes',
        expect.objectContaining({
          method: 'PATCH',
        })
      );
    });
  });

  describe('updateGuildEmblem', () => {
    it('should update guild emblem', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ guild: createMockGuild() }));

      await updateGuildEmblem('guild-123', 'https://example.com/emblem.png');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds/guild-123/emblem',
        expect.objectContaining({
          method: 'PATCH',
        })
      );
    });
  });

  describe('disbandGuild', () => {
    it('should disband guild', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ success: true }));

      const result = await disbandGuild('guild-123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds/guild-123',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('searchGuilds', () => {
    it('should search guilds without query', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ guilds: [], total: 0 }));

      await searchGuilds();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds',
        expect.anything()
      );
    });

    it('should search guilds with query params', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ guilds: [createMockGuild()], total: 1 }));

      await searchGuilds({ search: 'test', limit: 10, offset: 0 });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds?search=test&limit=10',
        expect.anything()
      );
    });

    it('should search guilds with offset', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ guilds: [createMockGuild()], total: 1 }));

      await searchGuilds({ search: 'test', limit: 10, offset: 20 });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds?search=test&limit=10&offset=20',
        expect.anything()
      );
    });

    it('should support abort signal', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ guilds: [], total: 0 }));
      const controller = new AbortController();

      await searchGuilds({ limit: 20, offset: 0 }, controller.signal);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          signal: controller.signal,
        })
      );
    });
  });

  // ==========================================================================
  // MEMBER MANAGEMENT
  // ==========================================================================

  describe('leaveGuild', () => {
    it('should leave guild', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ success: true }));

      const result = await leaveGuild('guild-123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds/guild-123/leave',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('kickMember', () => {
    it('should kick member from guild', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ success: true }));

      const result = await kickMember('guild-123', 'user-456');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds/guild-123/members/user-456',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ member: createMockGuildMember({ role: 'OFFICER' }) }));

      await updateMemberRole('guild-123', 'user-456', { role: 'OFFICER' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds/guild-123/members/user-456/role',
        expect.objectContaining({
          method: 'PATCH',
        })
      );
    });
  });

  describe('transferLeadership', () => {
    it('should transfer leadership', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ success: true }));

      const result = await transferLeadership('guild-123', { newLeaderId: 'user-456' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds/guild-123/transfer',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // INVITATIONS
  // ==========================================================================

  describe('sendInvitation', () => {
    it('should send guild invitation', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ invitation: createMockGuildInvitation() }));

      await sendInvitation('guild-123', { userId: 'user-456' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds/guild-123/invitations',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('getGuildInvitations', () => {
    it('should get guild invitations', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ invitations: [createMockGuildInvitation()], total: 1 }));

      await getGuildInvitations('guild-123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds/guild-123/invitations',
        expect.anything()
      );
    });

    it('should get invitations with query params', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ invitations: [], total: 0 }));

      await getGuildInvitations('guild-123', { status: 'PENDING' as const, limit: 10, offset: 0 });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds/guild-123/invitations?status=PENDING&limit=10',
        expect.anything()
      );
    });
  });

  describe('getReceivedInvitations', () => {
    it('should get received invitations', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ invitations: [] }));

      await getReceivedInvitations();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds/invitations/received',
        expect.anything()
      );
    });
  });

  describe('acceptInvitation', () => {
    it('should accept invitation', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ success: true }));

      const result = await acceptInvitation('invite-123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds/invitations/invite-123/accept',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('declineInvitation', () => {
    it('should decline invitation', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ success: true }));

      await declineInvitation('invite-123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds/invitations/invite-123/decline',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('cancelInvitation', () => {
    it('should cancel invitation', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ success: true }));

      await cancelInvitation('invite-123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds/invitations/invite-123/cancel',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  // ==========================================================================
  // APPLICATIONS
  // ==========================================================================

  describe('joinGuildDirect', () => {
    it('should join open guild directly', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ success: true }));

      const result = await joinGuildDirect('guild-123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds/guild-123/join',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('submitApplication', () => {
    it('should submit application without message', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ application: createMockGuildApplication() }));

      await submitApplication('guild-123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds/guild-123/applications',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({}),
        })
      );
    });

    it('should submit application with message', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ application: createMockGuildApplication() }));

      await submitApplication('guild-123', 'Please accept me!');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          body: JSON.stringify({ message: 'Please accept me!' }),
        })
      );
    });
  });

  describe('getGuildApplications', () => {
    it('should get guild applications', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ applications: [], total: 0 }));

      await getGuildApplications('guild-123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds/guild-123/applications',
        expect.anything()
      );
    });

    it('should filter by status', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ applications: [], total: 0 }));

      await getGuildApplications('guild-123', { status: 'PENDING' as const, limit: 20, offset: 0 });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds/guild-123/applications?status=PENDING&limit=20',
        expect.anything()
      );
    });
  });

  describe('getMyApplications', () => {
    it('should get own applications', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ applications: [] }));

      await getMyApplications();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds/applications/mine',
        expect.anything()
      );
    });
  });

  describe('acceptApplication', () => {
    it('should accept application', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ success: true }));

      const result = await acceptApplication('app-123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds/applications/app-123/accept',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('declineApplication', () => {
    it('should decline application', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ success: true }));

      await declineApplication('app-123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds/applications/app-123/decline',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('cancelApplication', () => {
    it('should cancel application', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ success: true }));

      await cancelApplication('app-123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds/applications/app-123/cancel',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  // ==========================================================================
  // TREASURY
  // ==========================================================================

  describe('getTreasury', () => {
    it('should fetch guild treasury', async () => {
      mockFetch.mockResolvedValue(createMockResponse({
        treasury: createMockGuildTreasury(),
        recentLogs: [],
        canWithdraw: true,
        nextWithdrawAt: null,
      }));

      const result = await getTreasury('guild-123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds/guild-123/treasury',
        expect.anything()
      );
      expect(result.treasury.gold).toBeDefined();
    });
  });

  // ==========================================================================
  // CHAT
  // ==========================================================================

  describe('sendGuildMessage', () => {
    it('should send guild message', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ message: { id: 'msg-123', content: 'Hello' } }));

      await sendGuildMessage('guild-123', 'Hello');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds/guild-123/chat/messages',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ content: 'Hello' }),
        })
      );
    });
  });

  describe('getGuildMessages', () => {
    it('should fetch guild messages', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ messages: [], total: 0 }));

      await getGuildMessages('guild-123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds/guild-123/chat/messages',
        expect.anything()
      );
    });

    it('should fetch with pagination', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ messages: [] }));

      await getGuildMessages('guild-123', { limit: 50, offset: 100 });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/guilds/guild-123/chat/messages?limit=50&offset=100',
        expect.anything()
      );
    });
  });

  // ==========================================================================
  // ERROR HANDLING
  // ==========================================================================

  describe('error handling', () => {
    it('should throw ApiError on non-OK response', async () => {
      mockFetch.mockResolvedValue(createErrorResponse(400, 'Bad request', 'VALIDATION_ERROR'));

      await expect(getMyGuild()).rejects.toThrow();
    });

    it('should handle JSON parse errors', async () => {
      const response = {
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as unknown as Response;
      mockFetch.mockResolvedValue(response);

      await expect(getMyGuild()).rejects.toThrow();
    });

    it('should handle 204 No Content', async () => {
      mockFetch.mockResolvedValue(createNoContentResponse());

      const result = await disbandGuild('guild-123');

      expect(result).toEqual({});
    });
  });
});
