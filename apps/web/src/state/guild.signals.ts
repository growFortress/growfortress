/**
 * Guild system state management using Preact Signals
 */
import { signal, computed } from '@preact/signals';
import type {
  Guild,
  GuildWithMembers,
  GuildMember,
  GuildTreasury,
  GuildBattle,
  GuildInvitation,
  GuildApplication,
  GuildStructureInfo,
} from '@arcade/protocol';

// ============================================================================
// PANEL STATE
// ============================================================================

/** Whether the guild panel is visible */
export const showGuildPanel = signal(false);

/** Current active tab in guild panel */
export const guildPanelTab = signal<'info' | 'members' | 'treasury' | 'battles' | 'roster' | 'tower-race' | 'boss' | 'applications' | 'medals' | 'trophies'>('info');

/** Whether guild search modal is visible */
export const showGuildSearch = signal(false);

/** Whether guild create modal is visible */
export const showGuildCreate = signal(false);

// ============================================================================
// PLAYER GUILD DATA
// ============================================================================

/** Player's current guild (null if not in a guild) */
export const playerGuild = signal<GuildWithMembers | null>(null);

/** Player's guild membership details */
export const playerMembership = signal<GuildMember | null>(null);

/** Guild bonuses for the player */
export const guildBonuses = signal<{ goldBoost: number; statBoost: number; xpBoost: number } | null>(null);

/** Guild structures info for upgrade UI */
export const guildStructures = signal<GuildStructureInfo[] | null>(null);

/** Loading state for structures */
export const structuresLoading = signal(false);

/** Whether player is in a guild */
export const isInGuild = computed(() => playerGuild.value !== null);

/** Whether player is guild leader */
export const isGuildLeader = computed(() => playerMembership.value?.role === 'LEADER');

/** Whether player is officer or leader */
export const isGuildOfficer = computed(() =>
  playerMembership.value?.role === 'LEADER' || playerMembership.value?.role === 'OFFICER'
);

// ============================================================================
// GUILD MEMBERS
// ============================================================================

/** All guild members */
export const guildMembers = computed(() => playerGuild.value?.members || []);

/** Guild leader */
export const guildLeader = computed(() =>
  guildMembers.value.find(m => m.role === 'LEADER')
);

/** Guild officers */
export const guildOfficers = computed(() =>
  guildMembers.value.filter(m => m.role === 'OFFICER')
);

/** Member count */
export const memberCount = computed(() => guildMembers.value.length);

// ============================================================================
// TREASURY
// ============================================================================

/** Guild treasury data */
export const guildTreasury = signal<GuildTreasury | null>(null);

/** Treasury logs */
export const treasuryLogs = signal<any[]>([]);

/** Whether player can withdraw */
export const canWithdraw = signal(false);

/** Next allowed withdrawal time */
export const nextWithdrawAt = signal<string | null>(null);

// ============================================================================
// BATTLES (Arena 5v5 - all battles are now instant/RESOLVED)
// ============================================================================

/** All guild battles */
export const guildBattles = signal<GuildBattle[]>([]);

/** Battle history - all battles are now instant (RESOLVED) */
export const battleHistory = computed(() => guildBattles.value);

/** Count of battles as attacker (for stats display) */
export const attacksCount = computed(() => {
  if (!playerGuild.value) return 0;
  return guildBattles.value.filter(b => b.attackerGuildId === playerGuild.value!.id).length;
});

/** Count of battles as defender (for stats display) */
export const defensesCount = computed(() => {
  if (!playerGuild.value) return 0;
  return guildBattles.value.filter(b => b.defenderGuildId === playerGuild.value!.id).length;
});

// ============================================================================
// INVITATIONS
// ============================================================================

/** Received guild invitations */
export const receivedInvitations = signal<GuildInvitation[]>([]);

/** Whether there are new invitations */
export const hasNewInvitations = computed(() => receivedInvitations.value.length > 0);

/** Invitation count */
export const invitationCount = computed(() => receivedInvitations.value.length);

// ============================================================================
// APPLICATIONS
// ============================================================================

/** Guild's received applications (for officers/leaders) */
export const guildApplications = signal<GuildApplication[]>([]);

/** Total count of guild applications */
export const guildApplicationsTotal = signal(0);

/** User's sent applications */
export const myApplications = signal<GuildApplication[]>([]);

/** Total count of user's applications */
export const myApplicationsTotal = signal(0);

/** Pending applications count (for badge display) */
export const pendingApplicationsCount = computed(() =>
  guildApplications.value.filter(a => a.status === 'PENDING').length
);

/** User's active applications count */
export const myActiveApplicationsCount = computed(() =>
  myApplications.value.filter(a => a.status === 'PENDING').length
);

/** Whether there are pending applications to review */
export const hasPendingApplications = computed(() => pendingApplicationsCount.value > 0);

// ============================================================================
// GUILD SEARCH
// ============================================================================

/** Search query */
export const guildSearchQuery = signal('');

/** Search results */
export const guildSearchResults = signal<Guild[]>([]);

/** Total search results count */
export const guildSearchTotal = signal(0);

// ============================================================================
// GUILD LEADERBOARD
// ============================================================================

/** Guild leaderboard entries */
export const guildLeaderboard = signal<any[]>([]);

/** Player's guild rank */
export const myGuildRank = signal<number | null>(null);

// ============================================================================
// ATTACK STATE (Arena 5v5)
// ============================================================================

/** Target guild for attack */
export const attackTargetGuild = signal<{ id: string; name: string; tag: string; honor: number } | null>(null);

/** Selected member IDs for attack (max 5) */
export const selectedAttackMembers = signal<string[]>([]);

/** Whether attack modal is open */
export const isAttackModalOpen = signal(false);

/** Whether an attack is in progress */
export const attackInProgress = signal(false);

/** Can current player initiate attacks (Leader/Officer only) */
export const canInitiateAttack = computed(() => {
  const membership = playerMembership.value;
  return membership?.role === 'LEADER' || membership?.role === 'OFFICER';
});

/** Count of members with Battle Hero set */
export const readyMembersCount = computed(() => {
  const guild = playerGuild.value;
  if (!guild) return 0;
  return guild.members.filter(m => m.battleHero).length;
});

// ============================================================================
// SHIELD STATE
// ============================================================================

/** Shield status for the guild */
export const shieldStatus = signal<{
  isActive: boolean;
  expiresAt: string | null;
  weeklyUsed: number;
  maxWeekly: number;
  canActivate: boolean;
  activationCost: number;
} | null>(null);

// ============================================================================
// LOADING STATES
// ============================================================================

export const guildLoading = signal(false);
export const treasuryLoading = signal(false);
export const battlesLoading = signal(false);
export const invitationsLoading = signal(false);
export const applicationsLoading = signal(false);
export const searchLoading = signal(false);
export const leaderboardLoading = signal(false);

// ============================================================================
// ERROR STATES
// ============================================================================

export const guildError = signal<string | null>(null);
export const treasuryError = signal<string | null>(null);
export const battlesError = signal<string | null>(null);

// ============================================================================
// UI ACTIONS
// ============================================================================

/**
 * Open the guild panel
 */
export function openGuildPanel(tab?: typeof guildPanelTab.value) {
  if (tab) guildPanelTab.value = tab;
  showGuildPanel.value = true;
}

/**
 * Close the guild panel
 */
export function closeGuildPanel() {
  showGuildPanel.value = false;
}

/**
 * Open guild search modal
 */
export function openGuildSearch() {
  showGuildSearch.value = true;
  guildSearchQuery.value = '';
  guildSearchResults.value = [];
}

/**
 * Close guild search modal
 */
export function closeGuildSearch() {
  showGuildSearch.value = false;
}

/**
 * Open guild create modal
 */
export function openGuildCreate() {
  showGuildCreate.value = true;
}

/**
 * Close guild create modal
 */
export function closeGuildCreate() {
  showGuildCreate.value = false;
}

/**
 * Reset all guild state (on logout or leaving guild)
 */
export function resetGuildState() {
  playerGuild.value = null;
  playerMembership.value = null;
  guildBonuses.value = null;
  guildStructures.value = null;
  guildTreasury.value = null;
  treasuryLogs.value = [];
  guildBattles.value = [];
  receivedInvitations.value = [];
  guildApplications.value = [];
  guildApplicationsTotal.value = 0;
  myApplications.value = [];
  myApplicationsTotal.value = 0;
  guildError.value = null;
}

/**
 * Update guild data from API response
 */
export function setGuildData(data: {
  guild: GuildWithMembers | null;
  membership: GuildMember | null;
  bonuses: { goldBoost: number; statBoost: number; xpBoost: number } | null;
}) {
  playerGuild.value = data.guild;
  playerMembership.value = data.membership;
  guildBonuses.value = data.bonuses;
}

/**
 * Update treasury data from API response
 */
export function setTreasuryData(data: {
  treasury: GuildTreasury;
  recentLogs: any[];
  canWithdraw: boolean;
  nextWithdrawAt: string | null;
}) {
  guildTreasury.value = data.treasury;
  treasuryLogs.value = data.recentLogs;
  canWithdraw.value = data.canWithdraw;
  nextWithdrawAt.value = data.nextWithdrawAt;
}

/**
 * Open attack modal
 */
export function openAttackModal() {
  attackTargetGuild.value = null;
  selectedAttackMembers.value = [];
  isAttackModalOpen.value = true;
}

/**
 * Close attack modal
 */
export function closeAttackModal() {
  isAttackModalOpen.value = false;
  attackTargetGuild.value = null;
  selectedAttackMembers.value = [];
}

/**
 * Update shield status from API response
 */
export function setShieldStatus(data: {
  isActive: boolean;
  shield: { expiresAt: string } | null;
  canActivate: boolean;
  activationCost: number;
  weeklyUsed: number;
  maxWeekly: number;
}) {
  shieldStatus.value = {
    isActive: data.isActive,
    expiresAt: data.shield?.expiresAt || null,
    weeklyUsed: data.weeklyUsed,
    maxWeekly: data.maxWeekly,
    canActivate: data.canActivate,
    activationCost: data.activationCost,
  };
}
