/**
 * Guild Search Modal - Search and browse guilds to join
 */
import { useState, useEffect, useCallback } from 'preact/hooks';
import { useTranslation } from '../../i18n/useTranslation.js';
import type { Guild, GuildAccessMode, GuildApplication } from '@arcade/protocol';
import {
  showGuildSearch,
  closeGuildSearch,
  guildSearchResults,
  guildSearchTotal,
  searchLoading,
  receivedInvitations,
  myApplications,
  myApplicationsTotal,
  myActiveApplicationsCount,
} from '../../state/guild.signals.js';
import {
  searchGuilds,
  getGuild,
  acceptInvitation,
  declineInvitation,
  joinGuildDirect,
  submitApplication,
  getMyApplications,
  cancelApplication,
} from '../../api/guild.js';
import { Button } from '../shared/Button.js';
import { Modal } from '../shared/Modal.js';
import { Spinner } from '../shared/Spinner.js';
import { GuildTag } from '../shared/GuildTag.js';
import styles from './GuildSearchModal.module.css';

interface GuildSearchModalProps {
  onSuccess?: () => void;
}

export function GuildSearchModal({ onSuccess }: GuildSearchModalProps) {
  const { t } = useTranslation('common');
  const [query, setQuery] = useState('');
  const [selectedGuild, setSelectedGuild] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'search' | 'invitations' | 'applications'>('search');
  const [applicationsLoading, setApplicationsLoading] = useState(false);

  const invitations = receivedInvitations.value;
  const applications = myApplications.value;
  const activeApplicationsCount = myActiveApplicationsCount.value;

  useEffect(() => {
    if (showGuildSearch.value) {
      // Load initial guilds
      handleSearch('');
      // Load my applications
      loadMyApplications();
    }
  }, [showGuildSearch.value]);

  const loadMyApplications = useCallback(async () => {
    setApplicationsLoading(true);
    try {
      const data = await getMyApplications({ limit: 20, offset: 0 });
      myApplications.value = data.applications;
      myApplicationsTotal.value = data.total;
    } catch (error) {
      console.error('Failed to load my applications:', error);
    } finally {
      setApplicationsLoading(false);
    }
  }, []);

  const handleSearch = useCallback(async (searchQuery: string) => {
    searchLoading.value = true;
    try {
      const data = await searchGuilds({
        search: searchQuery || undefined,
        limit: 20,
        offset: 0,
      });
      guildSearchResults.value = data.guilds;
      guildSearchTotal.value = data.total;
    } catch (error) {
      console.error('Failed to search guilds:', error);
    } finally {
      searchLoading.value = false;
    }
  }, []);

  const handleSearchSubmit = (e: Event) => {
    e.preventDefault();
    handleSearch(query);
  };

  const handleViewGuild = async (guild: Guild) => {
    setLoadingDetails(true);
    try {
      const data = await getGuild(guild.id);
      setSelectedGuild({ ...data.guild, levelInfo: data.levelInfo });
    } catch (error) {
      console.error('Failed to load guild details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleAcceptInvitation = async (invitationId: string) => {
    setActionLoading(true);
    try {
      await acceptInvitation(invitationId);
      closeGuildSearch();
      onSuccess?.();
    } catch (error) {
      console.error('Failed to accept invitation:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    setActionLoading(true);
    try {
      await declineInvitation(invitationId);
      // Remove from local state
      receivedInvitations.value = invitations.filter((i) => i.id !== invitationId);
    } catch (error) {
      console.error('Failed to decline invitation:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelApplication = async (applicationId: string) => {
    setActionLoading(true);
    try {
      await cancelApplication(applicationId);
      // Remove from local state
      myApplications.value = applications.filter((a) => a.id !== applicationId);
    } catch (error) {
      console.error('Failed to cancel application:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedGuild(null);
    setQuery('');
    closeGuildSearch();
  };

  if (!showGuildSearch.value) {
    return null;
  }

  const guilds = guildSearchResults.value;
  const total = guildSearchTotal.value;
  const loading = searchLoading.value;

  return (
    <Modal isOpen={showGuildSearch.value} onClose={handleClose} title={t('guild.searchTitle')}>
      <div class={styles.container}>
        {/* View mode tabs */}
        <div class={styles.tabs}>
          <button
            class={`${styles.tab} ${viewMode === 'search' ? styles.tabActive : ''}`}
            onClick={() => setViewMode('search')}
          >
            {t('guild.search')}
          </button>
          <button
            class={`${styles.tab} ${viewMode === 'invitations' ? styles.tabActive : ''}`}
            onClick={() => setViewMode('invitations')}
          >
            {t('guild.invitations')}
            {invitations.length > 0 && (
              <span class={styles.tabBadge}>{invitations.length}</span>
            )}
          </button>
          <button
            class={`${styles.tab} ${viewMode === 'applications' ? styles.tabActive : ''}`}
            onClick={() => setViewMode('applications')}
          >
            {t('guild.myApplications')}
            {activeApplicationsCount > 0 && (
              <span class={styles.tabBadge}>{activeApplicationsCount}</span>
            )}
          </button>
        </div>

        {viewMode === 'search' && (
          <>
            {/* Search form */}
            <form onSubmit={handleSearchSubmit} class={styles.searchForm}>
              <input
                type="text"
                class={styles.searchInput}
                value={query}
                onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
                placeholder={t('guild.searchPlaceholder')}
              />
              <Button type="submit" variant="primary" size="sm" disabled={loading}>
                {loading ? '...' : t('guild.search')}
              </Button>
            </form>

            {/* Results */}
            {loading ? (
              <div class={styles.loading}>
                <Spinner />
              </div>
            ) : selectedGuild ? (
              <GuildDetails
                guild={selectedGuild}
                onBack={() => setSelectedGuild(null)}
                loading={loadingDetails}
                onSuccess={onSuccess}
                t={t}
              />
            ) : (
              <div class={styles.results}>
                {guilds.length === 0 ? (
                  <div class={styles.empty}>
                    <span class={styles.emptyIcon}>🔍</span>
                    <span>{t('guild.noGuildsFound')}</span>
                  </div>
                ) : (
                  <>
                    <div class={styles.resultCount}>
                      {t('guild.foundGuilds', { count: total })}
                    </div>
                    <div class={styles.guildList}>
                      {guilds.map((guild) => (
                        <GuildCard
                          key={guild.id}
                          guild={guild}
                          onClick={() => handleViewGuild(guild)}
                          t={t}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {viewMode === 'invitations' && (
          <div class={styles.invitationsList}>
            {invitations.length === 0 ? (
              <div class={styles.empty}>
                <span class={styles.emptyIcon}>📬</span>
                <span>{t('guild.noInvitations')}</span>
              </div>
            ) : (
              invitations.map((invitation) => (
                <div key={invitation.id} class={styles.invitationCard}>
                  <div class={styles.invitationInfo}>
                    <span class={styles.invitationGuild}>
                      {invitation.guildName}{' '}
                      <GuildTag guildId={invitation.guildId} tag={invitation.guildTag} />
                    </span>
                    <span class={styles.invitationFrom}>
                      {t('guild.from')} {invitation.inviterName}
                    </span>
                    {invitation.message && (
                      <span class={styles.invitationMessage}>"{invitation.message}"</span>
                    )}
                  </div>
                  <div class={styles.invitationActions}>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleAcceptInvitation(invitation.id)}
                      disabled={actionLoading}
                    >
                      {t('guild.accept')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeclineInvitation(invitation.id)}
                      disabled={actionLoading}
                    >
                      {t('guild.decline')}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {viewMode === 'applications' && (
          <div class={styles.applicationsList}>
            {applicationsLoading ? (
              <div class={styles.loading}>
                <Spinner />
              </div>
            ) : applications.length === 0 ? (
              <div class={styles.empty}>
                <span class={styles.emptyIcon}>📝</span>
                <span>{t('guild.noActiveApplications')}</span>
                <span class={styles.emptyHint}>
                  {t('guild.browseAndApply')}
                </span>
              </div>
            ) : (
              applications.map((application) => (
                <MyApplicationCard
                  key={application.id}
                  application={application}
                  onCancel={() => handleCancelApplication(application.id)}
                  actionLoading={actionLoading}
                />
              ))
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

interface GuildCardProps {
  guild: Guild & { _count?: { members: number }; settings?: { accessMode?: GuildAccessMode } };
  onClick: () => void;
  t: (key: string, params?: Record<string, unknown>) => string;
}

function GuildCard({ guild, onClick, t }: GuildCardProps) {
  const accessMode = (guild.settings as any)?.accessMode || 'INVITE_ONLY';

  return (
    <div class={styles.guildCard} onClick={onClick}>
      <div class={styles.guildInfo}>
        <span class={styles.guildName}>
          <AccessModeIcon mode={accessMode} />
          {guild.name} <GuildTag guildId={guild.id} tag={guild.tag} />
        </span>
        <div class={styles.guildMeta}>
          <span>Lv.{guild.level}</span>
          <span>{t('guild.honor')}: {guild.honor.toLocaleString()}</span>
          {guild._count && <span>{guild._count.members} {t('leaderboard.members')}</span>}
        </div>
      </div>
      <span class={styles.guildArrow}>→</span>
    </div>
  );
}

interface GuildDetailsProps {
  guild: any;
  onBack: () => void;
  loading: boolean;
  onSuccess?: () => void;
  t: (key: string, params?: Record<string, unknown>) => string;
}

function GuildDetails({ guild, onBack, loading, onSuccess, t }: GuildDetailsProps) {
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [applicationMessage, setApplicationMessage] = useState('');

  if (loading) {
    return (
      <div class={styles.loading}>
        <Spinner />
      </div>
    );
  }

  const accessMode: GuildAccessMode = (guild.settings as any)?.accessMode || 'INVITE_ONLY';

  const handleJoinDirect = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      await joinGuildDirect(guild.id);
      setActionSuccess('Dolaczyles do gildii!');
      closeGuildSearch();
      onSuccess?.();
    } catch (err: any) {
      setActionError(err.message || 'Nie udalo sie dolaczyc do gildii');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApply = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      await submitApplication(guild.id, applicationMessage || undefined);
      setActionSuccess('Podanie zostalo wyslane!');
    } catch (err: any) {
      setActionError(err.message || 'Nie udalo sie wyslac podania');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div class={styles.guildDetails}>
      <button class={styles.backBtn} onClick={onBack}>
        {t('guild.back')}
      </button>

      <div class={styles.detailsHeader}>
        <h3 class={styles.detailsName}>
          <AccessModeIcon mode={accessMode} />
          {guild.name} <GuildTag guildId={guild.id} tag={guild.tag} />
        </h3>
        <div class={styles.detailsLevel}>{t('guild.level')} {guild.level}</div>
      </div>

      {guild.description && (
        <p class={styles.detailsDescription}>{guild.description}</p>
      )}

      <div class={styles.detailsStats}>
        <div class={styles.detailsStat}>
          <span class={styles.statLabel}>{t('guild.honor')}</span>
          <span class={styles.statValue}>{guild.honor.toLocaleString()}</span>
        </div>
        <div class={styles.detailsStat}>
          <span class={styles.statLabel}>{t('guild.members')}</span>
          <span class={styles.statValue}>
            {guild.members?.length || 0}/{guild.levelInfo?.maxMembers || 10}
          </span>
        </div>
        <div class={styles.detailsStat}>
          <span class={styles.statLabel}>{t('guild.trophies')}</span>
          <span class={styles.statValue}>{guild.trophies?.length || 0}</span>
        </div>
      </div>

      {guild.members && guild.members.length > 0 && (
        <div class={styles.memberPreview}>
          <h4 class={styles.memberPreviewTitle}>{t('guild.members')}</h4>
          <div class={styles.memberPreviewList}>
            {guild.members.slice(0, 5).map((member: any) => (
              <div key={member.id} class={styles.memberPreviewItem}>
                <span>{member.user?.displayName || 'Unknown'}</span>
                <span class={styles.memberRole}>
                  {member.role === 'LEADER' ? '👑' : member.role === 'OFFICER' ? '⚔️' : ''}
                </span>
              </div>
            ))}
            {guild.members.length > 5 && (
              <div class={styles.memberPreviewMore}>
                {t('guild.more', { count: guild.members.length - 5 })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action section based on access mode */}
      <div class={styles.joinSection}>
        {actionError && <div class={styles.joinError}>{actionError}</div>}
        {actionSuccess && <div class={styles.joinSuccess}>{actionSuccess}</div>}

        {!actionSuccess && accessMode === 'OPEN' && (
          <Button
            variant="primary"
            onClick={handleJoinDirect}
            disabled={actionLoading}
          >
            {actionLoading ? t('guild.joining') : t('guild.joinGuildBtn')}
          </Button>
        )}

        {!actionSuccess && accessMode === 'APPLY' && (
          <div class={styles.applySection}>
            <textarea
              class={styles.applyMessage}
              placeholder={t('guild.applicationMessagePlaceholder')}
              maxLength={200}
              value={applicationMessage}
              onInput={(e) => setApplicationMessage((e.target as HTMLTextAreaElement).value)}
            />
            <Button
              variant="primary"
              onClick={handleApply}
              disabled={actionLoading}
            >
              {actionLoading ? t('guild.sending') : t('guild.sendApplication')}
            </Button>
          </div>
        )}

        {!actionSuccess && accessMode === 'INVITE_ONLY' && (
          <div class={styles.detailsInfo}>
            <span class={styles.infoIcon}>🔒</span>
            <span>{t('guild.inviteOnlyInfo')}</span>
          </div>
        )}

        {!actionSuccess && accessMode === 'CLOSED' && (
          <div class={styles.detailsInfo}>
            <span class={styles.infoIcon}>🚫</span>
            <span>{t('guild.closedInfo')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Access Mode Icon Component
interface AccessModeIconProps {
  mode: GuildAccessMode;
}

function AccessModeIcon({ mode }: AccessModeIconProps) {
  const { t } = useTranslation('common');
  const icons: Record<GuildAccessMode, { icon: string; class: string; titleKey: string }> = {
    OPEN: { icon: '🚪', class: styles.accessModeOpen, titleKey: 'guild.accessModes.open' },
    APPLY: { icon: '📨', class: styles.accessModeApply, titleKey: 'guild.accessModes.apply' },
    INVITE_ONLY: { icon: '🔒', class: styles.accessModeInviteOnly, titleKey: 'guild.accessModes.inviteOnly' },
    CLOSED: { icon: '🚫', class: styles.accessModeClosed, titleKey: 'guild.accessModes.closed' },
  };

  const { icon, class: className, titleKey } = icons[mode];

  return (
    <span class={`${styles.accessModeIcon} ${className}`} title={t(titleKey)}>
      {icon}
    </span>
  );
}

// My Application Card Component
interface MyApplicationCardProps {
  application: GuildApplication;
  onCancel: () => void;
  actionLoading: boolean;
}

function MyApplicationCard({ application, onCancel, actionLoading }: MyApplicationCardProps) {
  const { t } = useTranslation('common');

  // Get guild info from the extended application data
  const guild = (application as any).guild;
  const guildName = guild?.name || t('guild.unknownGuild');
  const guildTag = guild?.tag || '';

  // Calculate time remaining
  const expiresAt = new Date(application.expiresAt);
  const now = new Date();
  const hoursRemaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)));

  const statusLabels: Record<string, string> = {
    PENDING: t('guild.applicationStatus.pending'),
    ACCEPTED: t('guild.applicationStatus.accepted'),
    DECLINED: t('guild.applicationStatus.declined'),
    EXPIRED: t('guild.applicationStatus.expired'),
    CANCELLED: t('guild.applicationStatus.cancelled'),
  };

  const statusStyles: Record<string, string> = {
    PENDING: styles.statusPending,
    ACCEPTED: styles.statusAccepted,
    DECLINED: styles.statusDeclined,
    EXPIRED: styles.statusExpired,
    CANCELLED: styles.statusCancelled,
  };

  return (
    <div class={styles.applicationCard}>
      <div class={styles.applicationInfo}>
        <span class={styles.applicationGuild}>
          {guildName} {guildTag && <GuildTag guildId={application.guildId} tag={guildTag} />}
        </span>
        <span class={`${styles.applicationStatus} ${statusStyles[application.status] || ''}`}>
          {statusLabels[application.status] || application.status}
        </span>
        {application.status === 'PENDING' && (
          <span class={styles.applicationExpiry}>
            {t('guild.expiresIn', { hours: hoursRemaining })}
          </span>
        )}
        {application.message && (
          <span class={styles.applicationMessage}>"{application.message}"</span>
        )}
      </div>
      {application.status === 'PENDING' && (
        <div class={styles.applicationActions}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={actionLoading}
          >
            {t('guild.cancelApplication')}
          </Button>
        </div>
      )}
    </div>
  );
}
