/**
 * Guild Panel - Main guild interface component
 */
import { useEffect, useCallback, useState } from 'preact/hooks';
import { useTranslation } from '../../i18n/useTranslation.js';
import {
  showGuildPanel,
  closeGuildPanel,
  guildPanelTab,
  playerGuild,
  guildBonuses,
  guildLevelInfo,
  guildBattles,
  receivedInvitations,
  guildLoading,
  treasuryLoading,
  battlesLoading,
  guildError,
  isInGuild,
  isGuildOfficer,
  memberCount,
  invitationCount,
  setGuildData,
  setTreasuryData,
  openGuildSearch,
  openGuildCreate,
} from '../../state/guild.signals.js';
import {
  getMyGuild,
  getTreasury,
  getGuildBattles,
  getReceivedInvitations,
} from '../../api/guild.js';
import { Button } from '../shared/Button.js';
import { Spinner } from '../shared/Spinner.js';
import { GuildInfoTab } from './GuildInfoTab.js';
import { GuildMembersTab } from './GuildMembersTab.js';
import { GuildTreasuryTab } from './GuildTreasuryTab.js';
import { GuildBattlesTab } from './GuildBattlesTab.js';
import { GuildRosterTab } from './GuildRosterTab.js';
import { GuildTowerRaceTab } from './GuildTowerRaceTab.js';
import { GuildBossTab } from './GuildBossTab.js';
import styles from './GuildPanel.module.css';

type TabType = 'info' | 'members' | 'treasury' | 'battles' | 'roster' | 'tower-race' | 'boss';

export function GuildPanel() {
  const { t } = useTranslation('common');
  const [refreshing, setRefreshing] = useState(false);

  // Load data when panel opens
  useEffect(() => {
    if (showGuildPanel.value) {
      loadGuildData();
    }
  }, [showGuildPanel.value]);

  const loadGuildData = useCallback(async () => {
    guildLoading.value = true;
    guildError.value = null;

    try {
      // Load main guild data
      const myGuildData = await getMyGuild();
      setGuildData({
        guild: myGuildData.guild,
        membership: myGuildData.membership,
        bonuses: myGuildData.bonuses,
      });

      // Level info is computed from guild level
      if (myGuildData.guild) {
        guildLevelInfo.value = {
          level: myGuildData.guild.level,
          xp: myGuildData.guild.xp,
          totalXp: myGuildData.guild.totalXp,
          xpToNextLevel: 10000 * myGuildData.guild.level, // Simplified
          bonuses: myGuildData.bonuses || { goldBoost: 0, dustBoost: 0, xpBoost: 0 },
          memberCapacity: 10 + myGuildData.guild.level,
        };
      }

      // If player is in a guild, load additional data
      if (myGuildData.guild) {
        await Promise.all([
          loadTreasuryData(myGuildData.guild.id),
          loadBattlesData(myGuildData.guild.id),
        ]);
      }

      // Load received invitations regardless of guild membership
      const invitationsData = await getReceivedInvitations({ status: 'PENDING', limit: 20, offset: 0 });
      receivedInvitations.value = invitationsData.invitations;
    } catch (error) {
      console.error('Failed to load guild data:', error);
      guildError.value = t('guild.loadError');
    } finally {
      guildLoading.value = false;
    }
  }, [t]);

  const loadTreasuryData = async (guildId: string) => {
    treasuryLoading.value = true;
    try {
      const data = await getTreasury(guildId);
      setTreasuryData({
        treasury: data.treasury,
        recentLogs: data.recentLogs,
        canWithdraw: data.canWithdraw,
        nextWithdrawAt: data.nextWithdrawAt,
      });
    } catch (error) {
      console.error('Failed to load treasury:', error);
    } finally {
      treasuryLoading.value = false;
    }
  };

  const loadBattlesData = async (guildId: string) => {
    battlesLoading.value = true;
    try {
      const data = await getGuildBattles(guildId);
      guildBattles.value = data.battles;
    } catch (error) {
      console.error('Failed to load battles:', error);
    } finally {
      battlesLoading.value = false;
    }
  };

  const refreshData = useCallback(async () => {
    setRefreshing(true);
    await loadGuildData();
    setRefreshing(false);
  }, [loadGuildData]);

  const handleTabClick = (tab: TabType) => {
    guildPanelTab.value = tab;
  };

  if (!showGuildPanel.value) {
    return null;
  }

  const activeTab = guildPanelTab.value;
  const guild = playerGuild.value;
  const bonuses = guildBonuses.value;
  const pendingInvitations = invitationCount.value;

  return (
    <div
      class={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeGuildPanel();
      }}
    >
      <div class={styles.panel}>
        {/* Header */}
        <div class={styles.header}>
          <div class={styles.headerLeft}>
            <span class={styles.icon}>🏰</span>
            <h2 class={styles.title}>
              {guild ? guild.name : t('guild.title')}
              {guild && <span class={styles.guildTag}> [{guild.tag}]</span>}
            </h2>
            {pendingInvitations > 0 && !isInGuild.value && (
              <span class={styles.invitationsBadge}>{pendingInvitations}</span>
            )}
          </div>
          <button class={styles.closeBtn} onClick={closeGuildPanel}>
            ×
          </button>
        </div>

        {/* Loading state */}
        {guildLoading.value && (
          <div class={styles.loading}>
            <Spinner />
          </div>
        )}

        {/* Error state */}
        {guildError.value && (
          <div class={styles.error}>{guildError.value}</div>
        )}

        {/* No guild state */}
        {!guildLoading.value && !guildError.value && !isInGuild.value && (
          <NoGuildView
            pendingInvitations={pendingInvitations}
            onRefresh={refreshData}
            t={t}
          />
        )}

        {/* Guild content */}
        {!guildLoading.value && !guildError.value && isInGuild.value && guild && (
          <>
            {/* Stats Bar */}
            <div class={styles.statsBar}>
              <div class={styles.statItem}>
                <span class={styles.statLabel}>{t('guild.honor')}</span>
                <span class={`${styles.statValue} ${styles.statValueHonor}`}>
                  {guild.honor.toLocaleString()}
                </span>
              </div>
              <div class={styles.statItem}>
                <span class={styles.statLabel}>{t('guild.members')}</span>
                <span class={styles.statValue}>
                  {memberCount.value}/{guildLevelInfo.value?.memberCapacity || 10}
                </span>
              </div>
              <div class={styles.statItem}>
                <span class={styles.statLabel}>{t('guild.level')}</span>
                <span class={`${styles.statValue} ${styles.statValueLevel}`}>
                  {guild.level}
                </span>
              </div>
              {bonuses && (
                <>
                  <div class={styles.statItem}>
                    <span class={styles.statLabel}>Gold+</span>
                    <span class={`${styles.statValue} ${styles.statValueBonus}`}>
                      {bonuses.goldBoost}%
                    </span>
                  </div>
                  <div class={styles.statItem}>
                    <span class={styles.statLabel}>Dust+</span>
                    <span class={`${styles.statValue} ${styles.statValueBonus}`}>
                      {bonuses.dustBoost}%
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Tabs */}
            <div class={styles.tabs}>
              <button
                class={`${styles.tab} ${activeTab === 'info' ? styles.tabActive : ''}`}
                onClick={() => handleTabClick('info')}
              >
                {t('guild.tabs.info')}
              </button>
              <button
                class={`${styles.tab} ${activeTab === 'members' ? styles.tabActive : ''}`}
                onClick={() => handleTabClick('members')}
              >
                {t('guild.tabs.members')}
              </button>
              <button
                class={`${styles.tab} ${activeTab === 'treasury' ? styles.tabActive : ''}`}
                onClick={() => handleTabClick('treasury')}
              >
                {t('guild.tabs.treasury')}
              </button>
              <button
                class={`${styles.tab} ${activeTab === 'battles' ? styles.tabActive : ''}`}
                onClick={() => handleTabClick('battles')}
              >
                {t('guild.tabs.battles')}
              </button>
              <button
                class={`${styles.tab} ${activeTab === 'tower-race' ? styles.tabActive : ''}`}
                onClick={() => handleTabClick('tower-race')}
              >
                {t('guild.tabs.race')}
              </button>
              <button
                class={`${styles.tab} ${activeTab === 'boss' ? styles.tabActive : ''}`}
                onClick={() => handleTabClick('boss')}
              >
                {t('guild.tabs.boss')}
              </button>
              {/* Roster tab - only for officers */}
              {isGuildOfficer.value && (
                <button
                  class={`${styles.tab} ${activeTab === 'roster' ? styles.tabActive : ''}`}
                  onClick={() => handleTabClick('roster')}
                >
                  {t('guild.tabs.roster')}
                </button>
              )}
              <button
                class={`${styles.refreshBtn} ${refreshing ? styles.refreshBtnSpinning : ''}`}
                onClick={refreshData}
                title={t('guild.refresh')}
              >
                🔄
              </button>
            </div>

            {/* Content */}
            <div class={styles.content}>
              {activeTab === 'info' && <GuildInfoTab onRefresh={refreshData} />}
              {activeTab === 'members' && <GuildMembersTab onRefresh={refreshData} />}
              {activeTab === 'treasury' && <GuildTreasuryTab onRefresh={refreshData} />}
              {activeTab === 'battles' && <GuildBattlesTab onRefresh={refreshData} />}
              {activeTab === 'tower-race' && <GuildTowerRaceTab onRefresh={refreshData} />}
              {activeTab === 'boss' && <GuildBossTab onRefresh={refreshData} />}
              {activeTab === 'roster' && <GuildRosterTab />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface NoGuildViewProps {
  pendingInvitations: number;
  onRefresh: () => void;
  t: (key: string, params?: Record<string, unknown>) => string;
}

function NoGuildView({ pendingInvitations, onRefresh, t }: NoGuildViewProps) {
  return (
    <div class={styles.noGuild}>
      <span class={styles.noGuildIcon}>🏰</span>
      <h3 class={styles.noGuildTitle}>{t('guild.notInGuild')}</h3>
      <p class={styles.noGuildText}>
        {t('guild.joinBenefits')}
      </p>
      <div class={styles.noGuildActions}>
        <Button variant="primary" onClick={() => { closeGuildPanel(); openGuildSearch(); }}>
          {t('guild.searchGuild')}
        </Button>
        <Button variant="secondary" onClick={() => { closeGuildPanel(); openGuildCreate(); }}>
          {t('guild.createGuild')}
        </Button>
      </div>
      {pendingInvitations > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <p class={styles.noGuildText}>
            {t('guild.pendingInvitations', { count: pendingInvitations })}
          </p>
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            {t('guild.showInvitations')}
          </Button>
        </div>
      )}
    </div>
  );
}
