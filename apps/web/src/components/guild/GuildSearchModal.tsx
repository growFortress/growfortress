/**
 * Guild Search Modal - Search and browse guilds to join
 */
import { useState, useEffect, useCallback } from 'preact/hooks';
import { useTranslation } from '../../i18n/useTranslation.js';
import type { Guild } from '@arcade/protocol';
import {
  showGuildSearch,
  closeGuildSearch,
  guildSearchResults,
  guildSearchTotal,
  searchLoading,
  receivedInvitations,
} from '../../state/guild.signals.js';
import { searchGuilds, getGuild, acceptInvitation, declineInvitation } from '../../api/guild.js';
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
  const [viewMode, setViewMode] = useState<'search' | 'invitations'>('search');

  const invitations = receivedInvitations.value;

  useEffect(() => {
    if (showGuildSearch.value) {
      // Load initial guilds
      handleSearch('');
    }
  }, [showGuildSearch.value]);

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
      </div>
    </Modal>
  );
}

interface GuildCardProps {
  guild: Guild & { _count?: { members: number } };
  onClick: () => void;
  t: (key: string, params?: Record<string, unknown>) => string;
}

function GuildCard({ guild, onClick, t }: GuildCardProps) {
  return (
    <div class={styles.guildCard} onClick={onClick}>
      <div class={styles.guildInfo}>
        <span class={styles.guildName}>
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
  t: (key: string, params?: Record<string, unknown>) => string;
}

function GuildDetails({ guild, onBack, loading, t }: GuildDetailsProps) {
  if (loading) {
    return (
      <div class={styles.loading}>
        <Spinner />
      </div>
    );
  }

  return (
    <div class={styles.guildDetails}>
      <button class={styles.backBtn} onClick={onBack}>
        {t('guild.back')}
      </button>

      <div class={styles.detailsHeader}>
        <h3 class={styles.detailsName}>
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

      <div class={styles.detailsInfo}>
        <span class={styles.infoIcon}>ℹ️</span>
        <span>
          {t('guild.joinInfo')}
        </span>
      </div>
    </div>
  );
}
