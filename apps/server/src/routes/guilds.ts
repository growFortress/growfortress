import { FastifyPluginAsync } from 'fastify';
import { withRateLimit } from '../plugins/rateLimit.js';
import {
  CreateGuildRequestSchema,
  UpdateGuildRequestSchema,
  GuildSearchQuerySchema,
  UpdateMemberRoleRequestSchema,
  TransferLeadershipRequestSchema,
  CreateInvitationRequestSchema,
  InvitationsQuerySchema,
  CreateApplicationRequestSchema,
  ApplicationsQuerySchema,
  TreasuryDepositRequestSchema,
  TreasuryWithdrawRequestSchema,
  TreasuryLogsQuerySchema,
  BattlesQuerySchema,
  GuildLeaderboardQuerySchema,
  SetBattleHeroRequestSchema,
  InstantAttackRequestSchema,
  GUILD_ERROR_CODES,
} from '@arcade/protocol';
import {
  createGuild,
  getGuild,
  updateGuild,
  disbandGuild,
  searchGuilds,
  getUserGuild,
  leaveGuild,
  kickMember,
  updateMemberRole,
  transferLeadership,
  joinGuildDirect,
} from '../services/guild.js';
import {
  getMemberCapacity,
  getStructuresInfo,
  upgradeStructure,
  getGuildBonusesFromStructures,
} from '../services/guildStructures.js';
import {
  createInvitation,
  getGuildInvitations,
  getUserInvitations,
  acceptInvitation,
  declineInvitation,
  cancelInvitation,
} from '../services/guildInvitation.js';
import {
  createApplication,
  getGuildApplications,
  getUserApplications,
  acceptApplication,
  declineApplication,
  cancelApplication,
} from '../services/guildApplication.js';
import {
  getTreasury,
  canWithdraw,
  deposit,
  withdraw,
  getTreasuryLogs,
} from '../services/guildTreasury.js';
import {
  getGuildBattles,
  getBattle,
  instantAttack,
  getShieldStatus,
  activateShield,
  getAttackStatus,
} from '../services/guildBattle.js';
import {
  getWeeklyLeaderboard,
  getGuildRank,
  getMemberContributions,
} from '../services/guildLeaderboard.js';
import {
  setBattleHero,
  getBattleHero,
  clearBattleHero,
  getGuildBattleRoster,
} from '../services/guildBattleHero.js';
import {
  getCurrentRace,
  getRaceStatus,
  getRaceLeaderboard,
  getRaceGuildDetails,
  getRaceHistory,
  getCurrentWeekKey as getTowerRaceWeekKey,
} from '../services/guildTowerRace.js';
import {
  getCurrentBoss,
  getBossStatus,
  attackBoss,
  getBossLeaderboard,
  getGuildBossDamageBreakdown,
  getTopDamageDealers,
} from '../services/guildBoss.js';
import { getGuildMedalCollection, getActiveWaveBonus } from '../services/guildMedals.js';
import { getGuildTrophies } from '../services/guildBattleTrophies.js';
import { getCurrentWeekKey } from '../lib/queue.js';
import {
  requireGuildMembership,
  requireGuildPermission,
  verifyGuildIdMatchesUserGuild,
} from '../lib/guildMembershipCheck.js';

const guildRoutes: FastifyPluginAsync = async (fastify) => {
  // ============================================================================
  // GUILD MANAGEMENT
  // ============================================================================

  // Create guild
  fastify.post('/v1/guilds', withRateLimit('guildCreate'), async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const body = CreateGuildRequestSchema.parse(request.body);
      const guild = await createGuild(request.userId, body);
      return reply.send({ guild });
    } catch (error: any) {
      // Handle Zod validation errors
      if (error.name === 'ZodError') {
        return reply.status(400).send({ 
          error: 'VALIDATION_ERROR', 
          code: 'VALIDATION_ERROR',
          details: error.errors 
        });
      }
      if (Object.values(GUILD_ERROR_CODES).includes(error.message)) {
        return reply.status(400).send({ error: error.message, code: error.message });
      }
      throw error;
    }
  });

  // Get guild by ID
  fastify.get('/v1/guilds/:guildId', { config: { public: true } }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const guild = await getGuild(guildId);

    if (!guild) {
      return reply.status(404).send({ error: GUILD_ERROR_CODES.GUILD_NOT_FOUND });
    }

    // Check if user is an authenticated member of this guild
    let isGuildMember = false;
    if (request.userId) {
      const membership = await getUserGuild(request.userId);
      isGuildMember = membership?.guildId === guildId;
    }

    // For non-members/public: limit member data to count and top 5 members only
    const limitedMembers = isGuildMember
      ? guild.members
      : guild.members.slice(0, 5);

    // Get structure bonuses
    const bonuses = getGuildBonusesFromStructures({
      kwatera: guild.structureKwatera,
      skarbiec: guild.structureSkarbiec,
      akademia: guild.structureAkademia,
      zbrojownia: guild.structureZbrojownia,
    });

    return reply.send({
      guild: {
        ...guild,
        members: limitedMembers,
        memberCount: guild._count.members,
        maxMembers: getMemberCapacity(guild.structureKwatera),
      },
      structures: {
        kwatera: guild.structureKwatera,
        skarbiec: guild.structureSkarbiec,
        akademia: guild.structureAkademia,
        zbrojownia: guild.structureZbrojownia,
      },
      bonuses,
      isFullMemberList: isGuildMember,
    });
  });

  // Update guild
  fastify.patch('/v1/guilds/:guildId', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const { guildId } = request.params as { guildId: string };
      const body = UpdateGuildRequestSchema.parse(request.body);
      const guild = await updateGuild(guildId, request.userId, body);
      return reply.send({ guild });
    } catch (error: any) {
      if (Object.values(GUILD_ERROR_CODES).includes(error.message)) {
        return reply.status(400).send({ error: error.message });
      }
      throw error;
    }
  });

  // Disband guild
  fastify.delete('/v1/guilds/:guildId', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const { guildId } = request.params as { guildId: string };
      await disbandGuild(guildId, request.userId);
      return reply.send({ success: true });
    } catch (error: any) {
      if (Object.values(GUILD_ERROR_CODES).includes(error.message)) {
        return reply.status(400).send({ error: error.message });
      }
      throw error;
    }
  });

  // Search guilds
  fastify.get('/v1/guilds', { config: { public: true } }, async (request, reply) => {
    const query = GuildSearchQuerySchema.parse(request.query);
    const result = await searchGuilds(query.search, query.limit, query.offset);
    return reply.send(result);
  });

  // ============================================================================
  // MEMBERSHIP
  // ============================================================================

  // Get my guild
  fastify.get('/v1/guilds/me', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const membership = await getUserGuild(request.userId);

    if (!membership) {
      return reply.send({
        guild: null,
        membership: null,
        bonuses: null,
        structures: null,
      });
    }

    const guildWithDetails = await getGuild(membership.guildId);

    // Get bonuses from structure levels
    const bonuses = guildWithDetails ? getGuildBonusesFromStructures({
      kwatera: guildWithDetails.structureKwatera,
      skarbiec: guildWithDetails.structureSkarbiec,
      akademia: guildWithDetails.structureAkademia,
      zbrojownia: guildWithDetails.structureZbrojownia,
    }) : null;

    // Transform battleHero fields to expected schema format
    const battleHero = membership.battleHeroId ? {
      heroId: membership.battleHeroId,
      tier: membership.battleHeroTier ?? 1,
      power: membership.battleHeroPower ?? 0,
    } : null;

    return reply.send({
      guild: guildWithDetails,
      membership: {
        id: membership.id,
        guildId: membership.guildId,
        userId: membership.userId,
        displayName: membership.user.displayName,
        role: membership.role,
        battleHero,
        battleHeroUpdatedAt: membership.battleHeroUpdatedAt?.toISOString() ?? null,
        totalGoldDonated: membership.totalGoldDonated,
        totalDustDonated: membership.totalDustDonated,
        battlesParticipated: membership.battlesParticipated,
        battlesWon: membership.battlesWon,
        joinedAt: membership.joinedAt.toISOString(),
      },
      bonuses,
      structures: guildWithDetails ? {
        kwatera: guildWithDetails.structureKwatera,
        skarbiec: guildWithDetails.structureSkarbiec,
        akademia: guildWithDetails.structureAkademia,
        zbrojownia: guildWithDetails.structureZbrojownia,
      } : null,
    });
  });

  // Leave guild
  fastify.post('/v1/guilds/:guildId/leave', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const { guildId } = request.params as { guildId: string };
      await leaveGuild(guildId, request.userId);
      return reply.send({ success: true });
    } catch (error: any) {
      if (Object.values(GUILD_ERROR_CODES).includes(error.message)) {
        return reply.status(400).send({ error: error.message });
      }
      throw error;
    }
  });

  // Kick member
  fastify.delete('/v1/guilds/:guildId/members/:userId', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const { guildId, userId: targetUserId } = request.params as { guildId: string; userId: string };
      await kickMember(guildId, request.userId, targetUserId);
      return reply.send({ success: true });
    } catch (error: any) {
      if (Object.values(GUILD_ERROR_CODES).includes(error.message)) {
        return reply.status(400).send({ error: error.message });
      }
      throw error;
    }
  });

  // Update member role
  fastify.patch('/v1/guilds/:guildId/members/:userId/role', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const { guildId, userId: targetUserId } = request.params as { guildId: string; userId: string };
      const body = UpdateMemberRoleRequestSchema.parse(request.body);
      const member = await updateMemberRole(guildId, request.userId, targetUserId, body.role);
      return reply.send({ member });
    } catch (error: any) {
      if (Object.values(GUILD_ERROR_CODES).includes(error.message)) {
        return reply.status(400).send({ error: error.message });
      }
      throw error;
    }
  });

  // Transfer leadership
  fastify.post('/v1/guilds/:guildId/transfer', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const { guildId } = request.params as { guildId: string };
      const body = TransferLeadershipRequestSchema.parse(request.body);
      await transferLeadership(guildId, request.userId, body.newLeaderId);
      return reply.send({ success: true });
    } catch (error: any) {
      if (Object.values(GUILD_ERROR_CODES).includes(error.message)) {
        return reply.status(400).send({ error: error.message });
      }
      throw error;
    }
  });

  // ============================================================================
  // BATTLE HERO
  // ============================================================================

  // Set Battle Hero
  fastify.put('/v1/guilds/:guildId/battle-hero', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const body = SetBattleHeroRequestSchema.parse(request.body);
      const result = await setBattleHero(request.userId, body.heroId);

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return reply.send({ battleHero: result.battleHero });
    } catch (error: any) {
      if (Object.values(GUILD_ERROR_CODES).includes(error.message)) {
        return reply.status(400).send({ error: error.message });
      }
      throw error;
    }
  });

  // Get my Battle Hero
  fastify.get('/v1/guilds/:guildId/battle-hero', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const battleHero = await getBattleHero(request.userId);
    return reply.send({ battleHero });
  });

  // Clear Battle Hero
  fastify.delete('/v1/guilds/:guildId/battle-hero', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const result = await clearBattleHero(request.userId);

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return reply.send({ success: true });
    } catch (error: any) {
      if (Object.values(GUILD_ERROR_CODES).includes(error.message)) {
        return reply.status(400).send({ error: error.message });
      }
      throw error;
    }
  });

  // Get Battle Roster (for Leader/Officer to see all members with Battle Heroes)
  fastify.get('/v1/guilds/:guildId/battle-roster', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { guildId } = request.params as { guildId: string };

    // Security: Verify user is a member with battle permission (LEADER/OFFICER)
    const membershipCheck = await requireGuildPermission(request.userId, guildId, 'battle');
    if (!membershipCheck.valid) {
      return reply.status(403).send({ error: membershipCheck.error });
    }

    const roster = await getGuildBattleRoster(guildId);

    return reply.send({
      roster: roster.map(member => ({
        ...member,
        lastActiveAt: member.lastActiveAt?.toISOString() || null,
      })),
    });
  });

  // ============================================================================
  // INVITATIONS
  // ============================================================================

  // Send invitation
  fastify.post('/v1/guilds/:guildId/invitations', withRateLimit('guildInvite'), async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const { guildId } = request.params as { guildId: string };
      const body = CreateInvitationRequestSchema.parse(request.body);
      const invitation = await createInvitation(guildId, request.userId, body.userId, body.message);
      return reply.send({ invitation });
    } catch (error: any) {
      if (Object.values(GUILD_ERROR_CODES).includes(error.message)) {
        return reply.status(400).send({ error: error.message });
      }
      throw error;
    }
  });

  // Get guild invitations
  fastify.get('/v1/guilds/:guildId/invitations', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { guildId } = request.params as { guildId: string };
    const query = InvitationsQuerySchema.parse(request.query);
    const result = await getGuildInvitations(guildId, query.status, query.limit, query.offset);
    return reply.send(result);
  });

  // Get my received invitations
  fastify.get('/v1/guilds/invitations/received', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const query = InvitationsQuerySchema.parse(request.query);
    const result = await getUserInvitations(request.userId, query.limit, query.offset);
    return reply.send(result);
  });

  // Accept invitation
  fastify.post('/v1/guilds/invitations/:invitationId/accept', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const { invitationId } = request.params as { invitationId: string };
      await acceptInvitation(invitationId, request.userId);
      return reply.send({ success: true });
    } catch (error: any) {
      if (Object.values(GUILD_ERROR_CODES).includes(error.message)) {
        return reply.status(400).send({ error: error.message });
      }
      throw error;
    }
  });

  // Decline invitation
  fastify.post('/v1/guilds/invitations/:invitationId/decline', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const { invitationId } = request.params as { invitationId: string };
      await declineInvitation(invitationId, request.userId);
      return reply.send({ success: true });
    } catch (error: any) {
      if (Object.values(GUILD_ERROR_CODES).includes(error.message)) {
        return reply.status(400).send({ error: error.message });
      }
      throw error;
    }
  });

  // Cancel invitation
  fastify.post('/v1/guilds/invitations/:invitationId/cancel', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const { invitationId } = request.params as { invitationId: string };
      await cancelInvitation(invitationId, request.userId);
      return reply.send({ success: true });
    } catch (error: any) {
      if (Object.values(GUILD_ERROR_CODES).includes(error.message)) {
        return reply.status(400).send({ error: error.message });
      }
      throw error;
    }
  });

  // ============================================================================
  // APPLICATIONS
  // ============================================================================

  // Direct join for OPEN guilds
  fastify.post('/v1/guilds/:guildId/join', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const { guildId } = request.params as { guildId: string };
      await joinGuildDirect(guildId, request.userId);
      return reply.send({ success: true });
    } catch (error: any) {
      if (Object.values(GUILD_ERROR_CODES).includes(error.message)) {
        return reply.status(400).send({ error: error.message });
      }
      throw error;
    }
  });

  // Submit application
  fastify.post('/v1/guilds/:guildId/applications', withRateLimit('guildApply'), async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const { guildId } = request.params as { guildId: string };
      const body = CreateApplicationRequestSchema.parse(request.body);
      const application = await createApplication(guildId, request.userId, body.message);
      return reply.send({ application });
    } catch (error: any) {
      if (Object.values(GUILD_ERROR_CODES).includes(error.message)) {
        return reply.status(400).send({ error: error.message });
      }
      throw error;
    }
  });

  // Get guild applications (for officers/leader)
  fastify.get('/v1/guilds/:guildId/applications', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { guildId } = request.params as { guildId: string };

    // Security: Verify user has invite permission (LEADER/OFFICER)
    const membershipCheck = await requireGuildPermission(request.userId, guildId, 'invite');
    if (!membershipCheck.valid) {
      return reply.status(403).send({ error: membershipCheck.error });
    }

    const query = ApplicationsQuerySchema.parse(request.query);
    const result = await getGuildApplications(guildId, query.status, query.limit, query.offset);
    return reply.send(result);
  });

  // Get my sent applications
  fastify.get('/v1/guilds/applications/mine', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const query = ApplicationsQuerySchema.parse(request.query);
    const result = await getUserApplications(request.userId, query.limit, query.offset);
    return reply.send(result);
  });

  // Accept application
  fastify.post('/v1/guilds/applications/:applicationId/accept', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const { applicationId } = request.params as { applicationId: string };
      await acceptApplication(applicationId, request.userId);
      return reply.send({ success: true });
    } catch (error: any) {
      if (Object.values(GUILD_ERROR_CODES).includes(error.message)) {
        return reply.status(400).send({ error: error.message });
      }
      throw error;
    }
  });

  // Decline application
  fastify.post('/v1/guilds/applications/:applicationId/decline', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const { applicationId } = request.params as { applicationId: string };
      await declineApplication(applicationId, request.userId);
      return reply.send({ success: true });
    } catch (error: any) {
      if (Object.values(GUILD_ERROR_CODES).includes(error.message)) {
        return reply.status(400).send({ error: error.message });
      }
      throw error;
    }
  });

  // Cancel own application
  fastify.post('/v1/guilds/applications/:applicationId/cancel', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const { applicationId } = request.params as { applicationId: string };
      await cancelApplication(applicationId, request.userId);
      return reply.send({ success: true });
    } catch (error: any) {
      if (Object.values(GUILD_ERROR_CODES).includes(error.message)) {
        return reply.status(400).send({ error: error.message });
      }
      throw error;
    }
  });

  // ============================================================================
  // STRUCTURES
  // ============================================================================

  // Get structures info
  fastify.get('/v1/guilds/:guildId/structures', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { guildId } = request.params as { guildId: string };

    // Security: Verify user is a member of this guild
    const membershipCheck = await requireGuildMembership(request.userId, guildId);
    if (!membershipCheck.valid) {
      return reply.status(403).send({ error: membershipCheck.error });
    }

    const structures = await getStructuresInfo(guildId);
    return reply.send({ structures });
  });

  // Upgrade a structure
  fastify.post('/v1/guilds/:guildId/structures/:structure/upgrade', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const { guildId, structure } = request.params as { guildId: string; structure: string };

      // Validate structure type
      const validStructures = ['kwatera', 'skarbiec', 'akademia', 'zbrojownia'];
      if (!validStructures.includes(structure)) {
        return reply.status(400).send({ error: 'INVALID_STRUCTURE_TYPE' });
      }

      const result = await upgradeStructure(
        guildId,
        request.userId,
        structure as 'kwatera' | 'skarbiec' | 'akademia' | 'zbrojownia'
      );

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return reply.send(result.result);
    } catch (error: any) {
      if (Object.values(GUILD_ERROR_CODES).includes(error.message)) {
        return reply.status(400).send({ error: error.message });
      }
      throw error;
    }
  });

  // ============================================================================
  // TREASURY
  // ============================================================================

  // Get treasury
  fastify.get('/v1/guilds/:guildId/treasury', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { guildId } = request.params as { guildId: string };

    // Security: Verify user is a member of this guild
    const membershipCheck = await requireGuildMembership(request.userId, guildId);
    if (!membershipCheck.valid) {
      return reply.status(403).send({ error: membershipCheck.error });
    }

    const [treasury, withdrawStatus, logsResult] = await Promise.all([
      getTreasury(guildId),
      canWithdraw(guildId, request.userId),
      getTreasuryLogs(guildId, 10, 0),
    ]);

    if (!treasury) {
      return reply.status(404).send({ error: GUILD_ERROR_CODES.GUILD_NOT_FOUND });
    }

    return reply.send({
      treasury: {
        gold: treasury.gold,
        dust: treasury.dust,
        totalGoldDeposited: Number(treasury.totalGoldDeposited),
        totalDustDeposited: Number(treasury.totalDustDeposited),
      },
      recentLogs: logsResult.logs.map(log => ({
        ...log,
        userName: log.user.displayName,
        createdAt: log.createdAt.toISOString(),
      })),
      canWithdraw: withdrawStatus.allowed,
      nextWithdrawAt: withdrawStatus.nextAllowedAt?.toISOString() || null,
    });
  });

  // Deposit to treasury
  fastify.post('/v1/guilds/:guildId/treasury/deposit', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const { guildId } = request.params as { guildId: string };
      const body = TreasuryDepositRequestSchema.parse(request.body);
      const treasury = await deposit(guildId, request.userId, body);
      return reply.send({
        treasury: {
          ...treasury,
          totalGoldDeposited: Number(treasury.totalGoldDeposited),
          totalDustDeposited: Number(treasury.totalDustDeposited),
        },
      });
    } catch (error: any) {
      if (Object.values(GUILD_ERROR_CODES).includes(error.message)) {
        return reply.status(400).send({ error: error.message });
      }
      throw error;
    }
  });

  // Withdraw from treasury
  fastify.post('/v1/guilds/:guildId/treasury/withdraw', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const { guildId } = request.params as { guildId: string };
      const body = TreasuryWithdrawRequestSchema.parse(request.body);
      const treasury = await withdraw(guildId, request.userId, body, body.reason);
      return reply.send({
        treasury: {
          ...treasury,
          totalGoldDeposited: Number(treasury.totalGoldDeposited),
          totalDustDeposited: Number(treasury.totalDustDeposited),
        },
      });
    } catch (error: any) {
      if (Object.values(GUILD_ERROR_CODES).includes(error.message)) {
        return reply.status(400).send({ error: error.message });
      }
      throw error;
    }
  });

  // Get treasury logs
  fastify.get('/v1/guilds/:guildId/treasury/logs', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { guildId } = request.params as { guildId: string };

    // Security: Verify user is a member of this guild
    const membershipCheck = await requireGuildMembership(request.userId, guildId);
    if (!membershipCheck.valid) {
      return reply.status(403).send({ error: membershipCheck.error });
    }

    const query = TreasuryLogsQuerySchema.parse(request.query);
    const result = await getTreasuryLogs(guildId, query.limit, query.offset);
    return reply.send({
      logs: result.logs.map(log => ({
        ...log,
        userName: log.user.displayName,
        createdAt: log.createdAt.toISOString(),
      })),
      total: result.total,
    });
  });

  // ============================================================================
  // BATTLES (Arena 5v5 - Instant Attack System)
  // ============================================================================

  // NOTE: Old pending/accept battle system removed.
  // Instant attack system will be implemented in FAZA 3.
  // For now, only GET endpoints are available to view battle history.
  // Instant attack (Arena 5v5)
  fastify.post('/v1/guilds/:guildId/battles/attack', withRateLimit('guildBattle'), async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const { guildId } = request.params as { guildId: string };
      const body = InstantAttackRequestSchema.parse(request.body);

      const result = await instantAttack(
        guildId,
        body.defenderGuildId,
        request.userId,
        body.selectedMemberIds
      );

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return reply.send({
        battle: {
          ...result.result!.battle,
          createdAt: result.result!.battle.createdAt.toISOString(),
          resolvedAt: result.result!.battle.resolvedAt?.toISOString() || null,
        },
        attackerHonorChange: result.result!.attackerHonorChange,
        defenderHonorChange: result.result!.defenderHonorChange,
      });
    } catch (error: any) {
      if (Object.values(GUILD_ERROR_CODES).includes(error.message)) {
        return reply.status(400).send({ error: error.message });
      }
      throw error;
    }
  });

  // Get attack status (daily limits, can attack, etc.)
  fastify.get('/v1/guilds/:guildId/battles/status', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { guildId } = request.params as { guildId: string };
    const status = await getAttackStatus(guildId);

    return reply.send({
      ...status,
      nextResetAt: status.nextResetAt.toISOString(),
    });
  });

  // Get shield status
  fastify.get('/v1/guilds/:guildId/shield', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { guildId } = request.params as { guildId: string };
    const status = await getShieldStatus(guildId);

    return reply.send({
      isActive: status.isActive,
      shield: status.shield ? {
        activatedAt: status.shield.activatedAt.toISOString(),
        expiresAt: status.shield.expiresAt.toISOString(),
        activatedBy: status.shield.activatedBy,
      } : null,
      canActivate: status.canActivate,
      activationCost: status.activationCost,
      weeklyUsed: status.weeklyUsed,
      maxWeekly: status.maxWeekly,
    });
  });

  // Activate shield
  fastify.post('/v1/guilds/:guildId/shield', withRateLimit('guildShield'), async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const { guildId } = request.params as { guildId: string };
      const result = await activateShield(guildId, request.userId);

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return reply.send({
        shield: {
          activatedAt: result.shield!.activatedAt.toISOString(),
          expiresAt: result.shield!.expiresAt.toISOString(),
          activatedBy: result.shield!.activatedBy,
        },
      });
    } catch (error: any) {
      if (Object.values(GUILD_ERROR_CODES).includes(error.message)) {
        return reply.status(400).send({ error: error.message });
      }
      throw error;
    }
  });


  // Get battles (history of resolved battles)
  fastify.get('/v1/guilds/:guildId/battles', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { guildId } = request.params as { guildId: string };
    const query = BattlesQuerySchema.parse(request.query);
    const result = await getGuildBattles(guildId, query.type, query.limit, query.offset);
    return reply.send({
      battles: result.battles.map(battle => ({
        ...battle,
        createdAt: battle.createdAt.toISOString(),
        resolvedAt: battle.resolvedAt.toISOString(),
      })),
      total: result.total,
    });
  });

  // Get battle by ID
  fastify.get('/v1/guilds/:guildId/battles/:battleId', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { battleId } = request.params as { battleId: string };
    const battle = await getBattle(battleId);

    if (!battle) {
      return reply.status(404).send({ error: GUILD_ERROR_CODES.BATTLE_NOT_FOUND });
    }

    return reply.send({
      battle: {
        ...battle,
        createdAt: battle.createdAt.toISOString(),
        resolvedAt: battle.resolvedAt.toISOString(),
      },
    });
  });

  // ============================================================================
  // LEADERBOARD
  // ============================================================================

  // Get guild leaderboard
  fastify.get('/v1/guilds/leaderboard', { config: { public: true } }, async (request, reply) => {
    const query = GuildLeaderboardQuerySchema.parse(request.query);
    const weekKey = query.week || getCurrentWeekKey();
    const result = await getWeeklyLeaderboard(weekKey, query.limit, query.offset);

    // Add user's guild rank if authenticated
    let myGuildRank: number | null = null;
    if (request.userId) {
      const membership = await getUserGuild(request.userId);
      if (membership) {
        const rank = await getGuildRank(membership.guildId, weekKey);
        myGuildRank = rank?.rank || null;
      }
    }

    return reply.send({
      ...result,
      myGuildRank,
    });
  });

  // Get guild's rank
  fastify.get('/v1/guilds/:guildId/rank', { config: { public: true } }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const query = request.query as { week?: string };
    const weekKey = query.week || getCurrentWeekKey();

    const rank = await getGuildRank(guildId, weekKey);

    if (!rank) {
      return reply.status(404).send({ error: GUILD_ERROR_CODES.GUILD_NOT_FOUND });
    }

    return reply.send({
      ...rank,
      weekKey,
    });
  });

  // Get member contributions
  fastify.get('/v1/guilds/:guildId/contributions', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { guildId } = request.params as { guildId: string };
    const query = request.query as { week?: string };
    const weekKey = query.week || getCurrentWeekKey();

    try {
      const contributions = await getMemberContributions(guildId, weekKey);

      return reply.send({
        weekKey,
        contributions,
      });
    } catch (error: any) {
      if (error.message === 'HISTORICAL_CONTRIBUTIONS_NOT_AVAILABLE') {
        return reply.status(400).send({
          error: 'HISTORICAL_CONTRIBUTIONS_NOT_AVAILABLE',
          message: 'Historical contribution data is not available. Only current week is supported.',
        });
      }
      throw error;
    }
  });

  // ============================================================================
  // WEEKLY TOWER RACE
  // ============================================================================

  // Get tower race leaderboard (current week)
  fastify.get('/v1/guilds/tower-race', { config: { public: true } }, async (request, reply) => {
    const query = request.query as { week?: string; limit?: string; offset?: string };
    const weekKey = query.week || getTowerRaceWeekKey();
    const limit = parseInt(query.limit || '20', 10);
    const offset = parseInt(query.offset || '0', 10);

    const race = await getCurrentRace();
    const { entries } = await getRaceLeaderboard(weekKey, limit, offset);

    // Get current user's guild contribution if authenticated
    let myGuildEntry = null;
    let myContribution = 0;

    if (request.userId) {
      const membership = await getUserGuild(request.userId);
      if (membership) {
        const guildDetails = await getRaceGuildDetails(membership.guildId, weekKey);
        if (guildDetails) {
          myGuildEntry = {
            guildId: guildDetails.guildId,
            guildName: guildDetails.guildName,
            guildTag: '', // Will be filled from entries if available
            totalWaves: guildDetails.totalWaves,
            rank: guildDetails.rank,
          };

          // Find this user's contribution
          const userContrib = guildDetails.memberContributions.find(
            c => c.userId === request.userId
          );
          myContribution = userContrib?.wavesContributed || 0;
        }
      }
    }

    return reply.send({
      race: {
        id: race.id,
        weekKey: race.weekKey,
        startedAt: race.startedAt.toISOString(),
        endsAt: race.endsAt.toISOString(),
        status: race.status,
      },
      entries: entries.map(e => ({
        guildId: e.guildId,
        guildName: e.guildName,
        guildTag: e.guildTag,
        totalWaves: e.totalWaves,
        rank: e.rank,
      })),
      myGuildEntry,
      myContribution,
    });
  });

  // Get tower race status for a specific guild
  fastify.get('/v1/guilds/:guildId/tower-race', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { guildId } = request.params as { guildId: string };
    const status = await getRaceStatus(guildId);

    return reply.send({
      race: {
        id: status.race.id,
        weekKey: status.race.weekKey,
        startedAt: status.race.startedAt.toISOString(),
        endsAt: status.race.endsAt.toISOString(),
        status: status.race.status,
      },
      guildEntry: status.guildEntry ? {
        totalWaves: status.guildEntry.totalWaves,
        memberContributions: status.guildEntry.memberContributions,
      } : null,
      guildRank: status.guildRank,
      timeRemaining: status.timeRemaining,
    });
  });

  // Get detailed tower race breakdown for guild
  fastify.get('/v1/guilds/:guildId/tower-race/details', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { guildId } = request.params as { guildId: string };
    const query = request.query as { week?: string };
    const weekKey = query.week || getTowerRaceWeekKey();

    const race = await getCurrentRace();
    const details = await getRaceGuildDetails(guildId, weekKey);

    if (!details) {
      return reply.send({
        race: {
          id: race.id,
          weekKey: race.weekKey,
          startedAt: race.startedAt.toISOString(),
          endsAt: race.endsAt.toISOString(),
          status: race.status,
        },
        guildEntry: null,
        contributions: [],
      });
    }

    return reply.send({
      race: {
        id: race.id,
        weekKey: race.weekKey,
        startedAt: race.startedAt.toISOString(),
        endsAt: race.endsAt.toISOString(),
        status: race.status,
      },
      guildEntry: {
        guildId: details.guildId,
        guildName: details.guildName,
        guildTag: '', // Filled from entries if needed
        totalWaves: details.totalWaves,
        rank: details.rank,
      },
      contributions: details.memberContributions.map(c => ({
        userId: c.userId,
        displayName: c.displayName,
        wavesContributed: c.wavesContributed,
      })),
    });
  });

  // Get tower race history
  fastify.get('/v1/guilds/tower-race/history', { config: { public: true } }, async (request, reply) => {
    const query = request.query as { limit?: string };
    const limit = parseInt(query.limit || '10', 10);

    const history = await getRaceHistory(limit);

    return reply.send({
      history: history.map(r => ({
        weekKey: r.weekKey,
        status: r.status,
        topGuild: r.topGuild,
      })),
    });
  });

  // ============================================================================
  // GUILD BOSS
  // ============================================================================

  // Get current boss info (public)
  fastify.get('/v1/guilds/boss', { config: { public: true } }, async (request, reply) => {
    const query = request.query as { week?: string };
    const boss = await getCurrentBoss();

    // Get leaderboard preview
    const { entries } = await getBossLeaderboard(query.week, 5, 0);
    const topDamage = await getTopDamageDealers(query.week, 5);

    return reply.send({
      boss: {
        id: boss.id,
        weekKey: boss.weekKey,
        bossType: boss.bossType,
        totalHp: boss.totalHp.toString(),
        currentHp: boss.currentHp.toString(),
        weakness: boss.weakness,
        endsAt: boss.endsAt.toISOString(),
      },
      topGuilds: entries.map(e => ({
        rank: e.rank,
        guildId: e.guildId,
        guildName: e.guildName,
        guildTag: e.guildTag,
        totalDamage: e.totalDamage,
      })),
      topDamageDealers: topDamage.map(d => ({
        rank: d.rank,
        userId: d.userId,
        displayName: d.displayName,
        damage: d.damage,
      })),
    });
  });

  // Get boss status for a guild member
  fastify.get('/v1/guilds/:guildId/boss', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { guildId } = request.params as { guildId: string };

    // Security: Verify user belongs to the guild specified in guildId param
    const membershipCheck = await verifyGuildIdMatchesUserGuild(request.userId, guildId);
    if (!membershipCheck.valid) {
      return reply.status(403).send({ error: membershipCheck.error });
    }

    const status = await getBossStatus(guildId, request.userId);

    return reply.send({
      boss: {
        id: status.boss.id,
        weekKey: status.boss.weekKey,
        bossType: status.boss.bossType,
        totalHp: status.boss.totalHp.toString(),
        currentHp: status.boss.currentHp.toString(),
        weakness: status.boss.weakness,
        endsAt: status.boss.endsAt.toISOString(),
      },
      myTodaysAttempt: status.myTodaysAttempt ? {
        id: status.myTodaysAttempt.id,
        damage: status.myTodaysAttempt.damage.toString(),
        heroId: status.myTodaysAttempt.heroId,
        heroTier: status.myTodaysAttempt.heroTier,
        attemptedAt: status.myTodaysAttempt.attemptedAt.toISOString(),
      } : null,
      canAttack: status.canAttack,
      myTotalDamage: status.myTotalDamage,
      guildTotalDamage: status.guildTotalDamage,
      guildRank: status.guildRank,
    });
  });

  // Attack the boss
  fastify.post('/v1/guilds/:guildId/boss/attack', withRateLimit('guildBattle'), async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { guildId } = request.params as { guildId: string };

    // Security: Verify user belongs to the guild specified in guildId param
    const membershipCheck = await verifyGuildIdMatchesUserGuild(request.userId, guildId);
    if (!membershipCheck.valid) {
      return reply.status(403).send({ error: membershipCheck.error });
    }

    const result = await attackBoss(request.userId, guildId);

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({
      attempt: {
        id: result.attempt!.id,
        damage: result.attempt!.damage.toString(),
        heroId: result.attempt!.heroId,
        heroTier: result.attempt!.heroTier,
        attemptedAt: result.attempt!.attemptedAt.toISOString(),
      },
      bossCurrentHp: result.bossCurrentHp?.toString(),
      guildCoinsEarned: result.guildCoinsEarned ?? 0,
    });
  });

  // Get boss leaderboard (guild rankings)
  fastify.get('/v1/guilds/boss/leaderboard', { config: { public: true } }, async (request, reply) => {
    const query = request.query as { week?: string; limit?: string; offset?: string };
    const limit = parseInt(query.limit || '20', 10);
    const offset = parseInt(query.offset || '0', 10);

    const { entries, total } = await getBossLeaderboard(query.week, limit, offset);

    return reply.send({
      entries: entries.map(e => ({
        rank: e.rank,
        guildId: e.guildId,
        guildName: e.guildName,
        guildTag: e.guildTag,
        totalDamage: e.totalDamage,
        participantCount: e.participantCount,
      })),
      total,
    });
  });

  // Get guild's boss damage breakdown
  fastify.get('/v1/guilds/:guildId/boss/breakdown', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { guildId } = request.params as { guildId: string };
    const query = request.query as { week?: string };

    const { members, totalDamage } = await getGuildBossDamageBreakdown(guildId, query.week);

    return reply.send({
      members: members.map(m => ({
        rank: m.rank,
        userId: m.userId,
        displayName: m.displayName,
        damage: m.damage,
        heroId: m.heroId,
        heroTier: m.heroTier,
      })),
      totalDamage,
    });
  });

  // Get top damage dealers globally
  fastify.get('/v1/guilds/boss/top-damage', { config: { public: true } }, async (request, reply) => {
    const query = request.query as { week?: string; limit?: string };
    const limit = parseInt(query.limit || '10', 10);

    const topDamage = await getTopDamageDealers(query.week, limit);

    return reply.send({
      topDamageDealers: topDamage.map(d => ({
        rank: d.rank,
        userId: d.userId,
        displayName: d.displayName,
        damage: d.damage,
        heroId: d.heroId,
        heroTier: d.heroTier,
      })),
    });
  });

  // ============================================================================
  // GUILD MEDALS (Tower Race rewards)
  // ============================================================================

  // Get guild's medal collection
  fastify.get('/v1/guilds/:guildId/medals', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { guildId } = request.params as { guildId: string };

    // Verify membership
    const membershipCheck = await requireGuildMembership(request.userId, guildId);
    if (!membershipCheck.valid) {
      return reply.status(403).send({ error: membershipCheck.error });
    }

    const collection = await getGuildMedalCollection(guildId);

    return reply.send({
      medals: collection.medals.map(m => ({
        id: m.id,
        weekKey: m.weekKey,
        medalType: m.medalType,
        rank: m.rank,
        totalWaves: m.totalWaves,
        coinsAwarded: m.coinsAwarded,
        awardedAt: m.awardedAt.toISOString(),
      })),
      stats: collection.stats,
      activeBonus: {
        wavesBonus: collection.activeBonus.wavesBonus,
        sourceMedalType: collection.activeBonus.sourceMedalType,
        sourceWeekKey: collection.activeBonus.sourceWeekKey,
        expiresAt: collection.activeBonus.expiresAt?.toISOString() || null,
        isActive: collection.activeBonus.isActive,
      },
    });
  });

  // Get guild's active medal bonus only
  fastify.get('/v1/guilds/:guildId/medals/bonus', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { guildId } = request.params as { guildId: string };

    // Verify membership
    const membershipCheck = await requireGuildMembership(request.userId, guildId);
    if (!membershipCheck.valid) {
      return reply.status(403).send({ error: membershipCheck.error });
    }

    const activeBonus = await getActiveWaveBonus(guildId);

    return reply.send({
      activeBonus: {
        wavesBonus: activeBonus.wavesBonus,
        sourceMedalType: activeBonus.sourceMedalType,
        sourceWeekKey: activeBonus.sourceWeekKey,
        expiresAt: activeBonus.expiresAt?.toISOString() || null,
        isActive: activeBonus.isActive,
      },
    });
  });

  // ============================================================================
  // GUILD TROPHIES (Arena 5v5 rewards)
  // ============================================================================

  // Get guild's trophies
  fastify.get('/v1/guilds/:guildId/trophies', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { guildId } = request.params as { guildId: string };

    // Verify membership
    const membershipCheck = await requireGuildMembership(request.userId, guildId);
    if (!membershipCheck.valid) {
      return reply.status(403).send({ error: membershipCheck.error });
    }

    const trophies = await getGuildTrophies(guildId);

    return reply.send(trophies);
  });
};

export default guildRoutes;
