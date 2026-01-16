/**
 * Guild API client
 */
import type {
  CreateGuildRequest,
  CreateGuildResponse,
  UpdateGuildRequest,
  GuildSearchQuery,
  GuildSearchResponse,
  MyGuildResponse,
  UpdateMemberRoleRequest,
  TransferLeadershipRequest,
  CreateInvitationRequest,
  InvitationsQuery,
  InvitationsResponse,
  CreateApplicationRequest,
  ApplicationsQuery,
  ApplicationsResponse,
  GuildApplication,
  TreasuryResponse,
  TreasuryDepositRequest,
  TreasuryWithdrawRequest,
  TreasuryLogsQuery,
  TreasuryLogsResponse,
  BattlesQuery,
  BattlesResponse,
  GuildLeaderboardQuery,
  GuildLeaderboardResponse,
  GuildRankResponse,
  GuildWithMembers,
  GuildBattleWithResult,
  SetBattleHeroRequest,
  BattleHero,
  BattleRosterMember,
  StructuresResponse,
  UpgradeStructureResponse,
  GuildStructureType,
} from '@arcade/protocol';
import { CONFIG } from '../config.js';
import { getAccessToken } from './auth.js';
import { ApiError } from './client.js';

async function guildRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${CONFIG.API_URL}${path}`;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(response.status, data.error || 'Request failed', data);
  }

  const contentType = response.headers.get('content-type');
  if (response.status === 204 || !contentType?.includes('application/json')) {
    return {} as T;
  }

  return response.json();
}

export async function getMyGuild(): Promise<MyGuildResponse> {
  return guildRequest<MyGuildResponse>('/v1/guilds/me');
}

export async function createGuild(data: CreateGuildRequest): Promise<CreateGuildResponse> {
  return guildRequest<CreateGuildResponse>('/v1/guilds', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getGuild(guildId: string): Promise<{ guild: GuildWithMembers }> {
  return guildRequest(`/v1/guilds/${encodeURIComponent(guildId)}`);
}

export async function updateGuild(guildId: string, data: UpdateGuildRequest): Promise<{ guild: GuildWithMembers }> {
  return guildRequest(`/v1/guilds/${encodeURIComponent(guildId)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function disbandGuild(guildId: string): Promise<{ success: boolean }> {
  return guildRequest(`/v1/guilds/${encodeURIComponent(guildId)}`, {
    method: 'DELETE',
  });
}

export async function searchGuilds(query?: GuildSearchQuery): Promise<GuildSearchResponse> {
  const params = new URLSearchParams();
  if (query?.search) params.set('search', query.search);
  if (query?.limit) params.set('limit', query.limit.toString());
  if (query?.offset) params.set('offset', query.offset.toString());
  const qs = params.toString();
  return guildRequest<GuildSearchResponse>(`/v1/guilds${qs ? '?' + qs : ''}`);
}

export async function leaveGuild(guildId: string): Promise<{ success: boolean }> {
  return guildRequest(`/v1/guilds/${encodeURIComponent(guildId)}/leave`, { method: 'POST' });
}

export async function kickMember(guildId: string, userId: string): Promise<{ success: boolean }> {
  return guildRequest(`/v1/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

export async function updateMemberRole(
  guildId: string,
  userId: string,
  data: UpdateMemberRoleRequest
): Promise<{ member: any }> {
  return guildRequest(`/v1/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}/role`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function transferLeadership(
  guildId: string,
  data: TransferLeadershipRequest
): Promise<{ success: boolean }> {
  return guildRequest(`/v1/guilds/${encodeURIComponent(guildId)}/transfer`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function sendInvitation(
  guildId: string,
  data: CreateInvitationRequest
): Promise<{ invitation: any }> {
  return guildRequest(`/v1/guilds/${encodeURIComponent(guildId)}/invitations`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getGuildInvitations(
  guildId: string,
  query?: InvitationsQuery
): Promise<InvitationsResponse> {
  const params = new URLSearchParams();
  if (query?.status) params.set('status', query.status);
  if (query?.limit) params.set('limit', query.limit.toString());
  if (query?.offset) params.set('offset', query.offset.toString());
  const qs = params.toString();
  return guildRequest<InvitationsResponse>(`/v1/guilds/${encodeURIComponent(guildId)}/invitations${qs ? '?' + qs : ''}`);
}

export async function getReceivedInvitations(query?: InvitationsQuery): Promise<InvitationsResponse> {
  const params = new URLSearchParams();
  if (query?.status) params.set('status', query.status);
  if (query?.limit) params.set('limit', query.limit.toString());
  if (query?.offset) params.set('offset', query.offset.toString());
  const qs = params.toString();
  return guildRequest<InvitationsResponse>(`/v1/guilds/invitations/received${qs ? '?' + qs : ''}`);
}

export async function acceptInvitation(invitationId: string): Promise<{ success: boolean }> {
  return guildRequest(`/v1/guilds/invitations/${encodeURIComponent(invitationId)}/accept`, { method: 'POST' });
}

export async function declineInvitation(invitationId: string): Promise<{ success: boolean }> {
  return guildRequest(`/v1/guilds/invitations/${encodeURIComponent(invitationId)}/decline`, { method: 'POST' });
}

export async function cancelInvitation(invitationId: string): Promise<{ success: boolean }> {
  return guildRequest(`/v1/guilds/invitations/${encodeURIComponent(invitationId)}/cancel`, { method: 'POST' });
}

// ============================================================================
// GUILD APPLICATIONS
// ============================================================================

/**
 * Join an OPEN guild directly (no application needed)
 */
export async function joinGuildDirect(guildId: string): Promise<{ success: boolean }> {
  return guildRequest(`/v1/guilds/${encodeURIComponent(guildId)}/join`, { method: 'POST' });
}

/**
 * Submit an application to join a guild (for APPLY mode guilds)
 */
export async function submitApplication(
  guildId: string,
  message?: string
): Promise<{ application: GuildApplication }> {
  const data: CreateApplicationRequest = message ? { message } : {};
  return guildRequest(`/v1/guilds/${encodeURIComponent(guildId)}/applications`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get guild's applications (for officers/leaders)
 */
export async function getGuildApplications(
  guildId: string,
  query?: ApplicationsQuery
): Promise<ApplicationsResponse> {
  const params = new URLSearchParams();
  if (query?.status) params.set('status', query.status);
  if (query?.limit) params.set('limit', query.limit.toString());
  if (query?.offset) params.set('offset', query.offset.toString());
  const qs = params.toString();
  return guildRequest<ApplicationsResponse>(
    `/v1/guilds/${encodeURIComponent(guildId)}/applications${qs ? '?' + qs : ''}`
  );
}

/**
 * Get user's own applications
 */
export async function getMyApplications(query?: ApplicationsQuery): Promise<ApplicationsResponse> {
  const params = new URLSearchParams();
  if (query?.status) params.set('status', query.status);
  if (query?.limit) params.set('limit', query.limit.toString());
  if (query?.offset) params.set('offset', query.offset.toString());
  const qs = params.toString();
  return guildRequest<ApplicationsResponse>(`/v1/guilds/applications/mine${qs ? '?' + qs : ''}`);
}

/**
 * Accept an application (for officers/leaders)
 */
export async function acceptApplication(applicationId: string): Promise<{ success: boolean }> {
  return guildRequest(`/v1/guilds/applications/${encodeURIComponent(applicationId)}/accept`, {
    method: 'POST',
  });
}

/**
 * Decline an application (for officers/leaders)
 */
export async function declineApplication(applicationId: string): Promise<{ success: boolean }> {
  return guildRequest(`/v1/guilds/applications/${encodeURIComponent(applicationId)}/decline`, {
    method: 'POST',
  });
}

/**
 * Cancel own application
 */
export async function cancelApplication(applicationId: string): Promise<{ success: boolean }> {
  return guildRequest(`/v1/guilds/applications/${encodeURIComponent(applicationId)}/cancel`, {
    method: 'POST',
  });
}

export async function getTreasury(guildId: string): Promise<TreasuryResponse> {
  return guildRequest<TreasuryResponse>(`/v1/guilds/${encodeURIComponent(guildId)}/treasury`);
}

export async function depositToTreasury(
  guildId: string,
  data: TreasuryDepositRequest
): Promise<{ treasury: any }> {
  return guildRequest(`/v1/guilds/${encodeURIComponent(guildId)}/treasury/deposit`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function withdrawFromTreasury(
  guildId: string,
  data: TreasuryWithdrawRequest
): Promise<{ treasury: any }> {
  return guildRequest(`/v1/guilds/${encodeURIComponent(guildId)}/treasury/withdraw`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getTreasuryLogs(
  guildId: string,
  query?: TreasuryLogsQuery
): Promise<TreasuryLogsResponse> {
  const params = new URLSearchParams();
  if (query?.limit) params.set('limit', query.limit.toString());
  if (query?.offset) params.set('offset', query.offset.toString());
  const qs = params.toString();
  return guildRequest<TreasuryLogsResponse>(`/v1/guilds/${encodeURIComponent(guildId)}/treasury/logs${qs ? '?' + qs : ''}`);
}

export async function getGuildBattles(
  guildId: string,
  query?: BattlesQuery
): Promise<BattlesResponse> {
  const params = new URLSearchParams();
  if (query?.type) params.set('type', query.type);
  if (query?.limit) params.set('limit', query.limit.toString());
  if (query?.offset) params.set('offset', query.offset.toString());
  const qs = params.toString();
  return guildRequest<BattlesResponse>(`/v1/guilds/${encodeURIComponent(guildId)}/battles${qs ? '?' + qs : ''}`);
}

export async function getBattle(guildId: string, battleId: string): Promise<{ battle: GuildBattleWithResult }> {
  return guildRequest(`/v1/guilds/${encodeURIComponent(guildId)}/battles/${encodeURIComponent(battleId)}`);
}

// Instant Attack (Arena 5v5)

export interface InstantAttackRequest {
  defenderGuildId: string;
  selectedMemberIds: string[];
}

export interface InstantAttackResponse {
  battle: GuildBattleWithResult;
  attackerHonorChange: number;
  defenderHonorChange: number;
}

export interface AttackStatus {
  dailyAttacks: number;
  maxDailyAttacks: number;
  canAttack: boolean;
  nextResetAt: string;
}

export interface ShieldStatus {
  isActive: boolean;
  shield: { activatedAt: string; expiresAt: string; activatedBy: string } | null;
  canActivate: boolean;
  activationCost: number;
  weeklyUsed: number;
  maxWeekly: number;
}

export async function instantAttack(guildId: string, request: InstantAttackRequest): Promise<InstantAttackResponse> {
  return guildRequest(`/v1/guilds/${encodeURIComponent(guildId)}/battles/attack`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function getAttackStatus(guildId: string): Promise<AttackStatus> {
  return guildRequest(`/v1/guilds/${encodeURIComponent(guildId)}/battles/status`);
}

export async function getShieldStatus(guildId: string): Promise<ShieldStatus> {
  return guildRequest(`/v1/guilds/${encodeURIComponent(guildId)}/shield`);
}

export async function activateShield(guildId: string): Promise<{ shield: { activatedAt: string; expiresAt: string; activatedBy: string } }> {
  return guildRequest(`/v1/guilds/${encodeURIComponent(guildId)}/shield`, { method: 'POST' });
}

// Leaderboard

export async function getGuildLeaderboard(query?: GuildLeaderboardQuery): Promise<GuildLeaderboardResponse> {
  const params = new URLSearchParams();
  if (query?.week) params.set('week', query.week);
  if (query?.limit) params.set('limit', query.limit.toString());
  if (query?.offset) params.set('offset', query.offset.toString());
  const qs = params.toString();
  return guildRequest<GuildLeaderboardResponse>(`/v1/guilds/leaderboard${qs ? '?' + qs : ''}`);
}

export async function getGuildRank(guildId: string, week?: string): Promise<GuildRankResponse> {
  const params = new URLSearchParams();
  if (week) params.set('week', week);
  const qs = params.toString();
  return guildRequest<GuildRankResponse>(`/v1/guilds/${encodeURIComponent(guildId)}/rank${qs ? '?' + qs : ''}`);
}

// Battle Hero

export async function setBattleHero(guildId: string, heroId: string): Promise<{ battleHero: BattleHero }> {
  const request: SetBattleHeroRequest = { heroId };
  return guildRequest(`/v1/guilds/${encodeURIComponent(guildId)}/battle-hero`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

export async function getBattleHero(guildId: string): Promise<{ battleHero: BattleHero | null }> {
  return guildRequest(`/v1/guilds/${encodeURIComponent(guildId)}/battle-hero`);
}

export async function clearBattleHero(guildId: string): Promise<{ success: boolean }> {
  return guildRequest(`/v1/guilds/${encodeURIComponent(guildId)}/battle-hero`, { method: 'DELETE' });
}

export async function getBattleRoster(guildId: string): Promise<{ roster: BattleRosterMember[] }> {
  return guildRequest(`/v1/guilds/${encodeURIComponent(guildId)}/battle-roster`);
}

// ============================================================================
// STRUCTURES
// ============================================================================

export async function getStructures(guildId: string): Promise<StructuresResponse> {
  return guildRequest<StructuresResponse>(`/v1/guilds/${encodeURIComponent(guildId)}/structures`);
}

export async function upgradeStructure(
  guildId: string,
  structure: GuildStructureType
): Promise<UpgradeStructureResponse> {
  return guildRequest<UpgradeStructureResponse>(
    `/v1/guilds/${encodeURIComponent(guildId)}/structures/${structure}/upgrade`,
    { method: 'POST' }
  );
}

// ============================================================================
// TOWER RACE
// ============================================================================

export interface TowerRace {
  id: string;
  weekKey: string;
  startedAt: string;
  endsAt: string;
  status: 'active' | 'completed';
}

export interface TowerRaceEntry {
  guildId: string;
  guildName: string;
  guildTag: string;
  totalWaves: number;
  rank: number;
}

export interface TowerRaceContribution {
  userId: string;
  displayName: string;
  wavesContributed: number;
}

export interface TowerRaceLeaderboardResponse {
  race: TowerRace;
  entries: TowerRaceEntry[];
  myGuildEntry: TowerRaceEntry | null;
  myContribution: number;
}

export interface TowerRaceStatusResponse {
  race: TowerRace;
  guildEntry: {
    totalWaves: number;
    memberContributions: Record<string, number>;
  } | null;
  guildRank: number | null;
  timeRemaining: number;
}

export interface TowerRaceDetailsResponse {
  race: TowerRace;
  guildEntry: TowerRaceEntry | null;
  contributions: TowerRaceContribution[];
}

export interface TowerRaceHistoryEntry {
  weekKey: string;
  status: string;
  topGuild?: string;
}

export async function getTowerRaceLeaderboard(
  week?: string,
  limit?: number,
  offset?: number
): Promise<TowerRaceLeaderboardResponse> {
  const params = new URLSearchParams();
  if (week) params.set('week', week);
  if (limit) params.set('limit', limit.toString());
  if (offset) params.set('offset', offset.toString());
  const qs = params.toString();
  return guildRequest<TowerRaceLeaderboardResponse>(`/v1/guilds/tower-race${qs ? '?' + qs : ''}`);
}

export async function getTowerRaceStatus(guildId: string): Promise<TowerRaceStatusResponse> {
  return guildRequest<TowerRaceStatusResponse>(`/v1/guilds/${encodeURIComponent(guildId)}/tower-race`);
}

export async function getTowerRaceDetails(
  guildId: string,
  week?: string
): Promise<TowerRaceDetailsResponse> {
  const params = new URLSearchParams();
  if (week) params.set('week', week);
  const qs = params.toString();
  return guildRequest<TowerRaceDetailsResponse>(`/v1/guilds/${encodeURIComponent(guildId)}/tower-race/details${qs ? '?' + qs : ''}`);
}

export async function getTowerRaceHistory(limit?: number): Promise<{ history: TowerRaceHistoryEntry[] }> {
  const params = new URLSearchParams();
  if (limit) params.set('limit', limit.toString());
  const qs = params.toString();
  return guildRequest(`/v1/guilds/tower-race/history${qs ? '?' + qs : ''}`);
}

// ============================================================================
// GUILD BOSS
// ============================================================================

export interface GuildBoss {
  id: string;
  weekKey: string;
  bossType: string;
  totalHp: string;
  currentHp: string;
  weakness: string;
  endsAt: string;
}

export interface BossAttempt {
  id: string;
  damage: string;
  heroId: string;
  heroTier: number;
  attemptedAt: string;
}

export interface BossTopGuild {
  rank: number;
  guildId: string;
  guildName: string;
  guildTag: string;
  totalDamage: number;
}

export interface BossTopDamageDealer {
  rank: number;
  userId: string;
  displayName: string;
  damage: number;
  heroId?: string;
  heroTier?: number;
}

export interface BossLeaderboardEntry {
  rank: number;
  guildId: string;
  guildName: string;
  guildTag: string;
  totalDamage: number;
  participantCount: number;
}

export interface BossMemberDamage {
  rank: number;
  userId: string;
  displayName: string;
  damage: number;
  heroId: string;
  heroTier: number;
}

export interface GuildBossInfoResponse {
  boss: GuildBoss;
  topGuilds: BossTopGuild[];
  topDamageDealers: BossTopDamageDealer[];
}

export interface GuildBossStatusResponse {
  boss: GuildBoss;
  myTodaysAttempt: BossAttempt | null;
  canAttack: boolean;
  myTotalDamage: number;
  guildTotalDamage: number;
  guildRank: number | null;
}

export interface AttackBossResponse {
  attempt: BossAttempt;
  bossCurrentHp: string;
  guildCoinsEarned: number;
}

export interface BossLeaderboardResponse {
  entries: BossLeaderboardEntry[];
  total: number;
}

export interface BossBreakdownResponse {
  members: BossMemberDamage[];
  totalDamage: number;
}

export async function getGuildBossInfo(week?: string): Promise<GuildBossInfoResponse> {
  const params = new URLSearchParams();
  if (week) params.set('week', week);
  const qs = params.toString();
  return guildRequest<GuildBossInfoResponse>(`/v1/guilds/boss${qs ? '?' + qs : ''}`);
}

export async function getGuildBossStatus(guildId: string): Promise<GuildBossStatusResponse> {
  return guildRequest<GuildBossStatusResponse>(`/v1/guilds/${encodeURIComponent(guildId)}/boss`);
}

export async function attackGuildBoss(guildId: string): Promise<AttackBossResponse> {
  return guildRequest<AttackBossResponse>(`/v1/guilds/${encodeURIComponent(guildId)}/boss/attack`, {
    method: 'POST',
  });
}

export async function getBossLeaderboard(
  week?: string,
  limit?: number,
  offset?: number
): Promise<BossLeaderboardResponse> {
  const params = new URLSearchParams();
  if (week) params.set('week', week);
  if (limit) params.set('limit', limit.toString());
  if (offset) params.set('offset', offset.toString());
  const qs = params.toString();
  return guildRequest<BossLeaderboardResponse>(`/v1/guilds/boss/leaderboard${qs ? '?' + qs : ''}`);
}

export async function getBossBreakdown(
  guildId: string,
  week?: string
): Promise<BossBreakdownResponse> {
  const params = new URLSearchParams();
  if (week) params.set('week', week);
  const qs = params.toString();
  return guildRequest<BossBreakdownResponse>(`/v1/guilds/${encodeURIComponent(guildId)}/boss/breakdown${qs ? '?' + qs : ''}`);
}

export async function getBossTopDamageDealers(
  week?: string,
  limit?: number
): Promise<{ topDamageDealers: BossTopDamageDealer[] }> {
  const params = new URLSearchParams();
  if (week) params.set('week', week);
  if (limit) params.set('limit', limit.toString());
  const qs = params.toString();
  return guildRequest(`/v1/guilds/boss/top-damage${qs ? '?' + qs : ''}`);
}
