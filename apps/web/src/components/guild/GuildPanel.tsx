/**
 * Guild Panel - Full-screen guild interface
 * Sci-fi themed with sidebar navigation
 */
import { useEffect, useCallback, useState } from 'preact/hooks';
import { useTranslation } from '../../i18n/useTranslation.js';
import {
  showGuildPanel,
  closeGuildPanel,
  guildPanelTab,
  playerGuild,
  guildBattles,
  receivedInvitations,
  guildLoading,
  treasuryLoading,
  battlesLoading,
  guildError,
  isInGuild,
  isGuildOfficer,
  invitationCount,
  pendingApplicationsCount,
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
import { GuildApplicationsTab } from './GuildApplicationsTab.js';
import { GuildMedalsTab } from './GuildMedalsTab.js';
import { GuildTrophiesTab } from './GuildTrophiesTab.js';
import styles from './GuildPanel.module.css';

type TabType = 'info' | 'members' | 'treasury' | 'battles' | 'roster' | 'tower-race' | 'boss' | 'applications' | 'medals' | 'trophies';

interface NavItem {
  id: TabType;
  label: string;
  icon: string;
  officerOnly?: boolean;
  badge?: number;
}

export function GuildPanel() {
  const { t } = useTranslation('common');
  const [refreshing, setRefreshing] = useState(false);

  // Load data when panel opens
  useEffect(() => {
    if (showGuildPanel.value) {
      loadGuildData();
    }
  }, [showGuildPanel.value]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showGuildPanel.value) {
        closeGuildPanel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadGuildData = useCallback(async () => {
    guildLoading.value = true;
    guildError.value = null;

    try {
      const myGuildData = await getMyGuild();
      setGuildData({
        guild: myGuildData.guild,
        membership: myGuildData.membership,
        bonuses: myGuildData.bonuses,
      });

      if (myGuildData.guild) {
        await Promise.all([
          loadTreasuryData(myGuildData.guild.id),
          loadBattlesData(myGuildData.guild.id),
        ]);
      }

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
  const pendingInvitations = invitationCount.value;

  // Navigation items
  const navItems: NavItem[] = [
    { id: 'info', label: t('guild.tabs.info'), icon: '📊' },
    { id: 'members', label: t('guild.tabs.members'), icon: '👥' },
    { id: 'treasury', label: t('guild.tabs.treasury'), icon: '💰' },
    { id: 'battles', label: t('guild.tabs.battles'), icon: '⚔️' },
    { id: 'trophies', label: 'Trofea', icon: '🏆' },
    { id: 'tower-race', label: t('guild.tabs.race'), icon: '🗼' },
    { id: 'medals', label: 'Medale', icon: '🥇' },
    { id: 'boss', label: t('guild.tabs.boss'), icon: '👹' },
    { id: 'roster', label: t('guild.tabs.roster'), icon: '📋', officerOnly: true },
    { id: 'applications', label: 'Podania', icon: '📨', officerOnly: true, badge: pendingApplicationsCount.value },
  ];

  return (
    <div class={styles.fullscreen}>
      {/* Animated background grid */}
      <div class={styles.bgGrid} />

      {/* Top Bar */}
      <header class={styles.topBar}>
        <div class={styles.topBarLeft}>
          <button class={styles.backBtn} onClick={closeGuildPanel} title="Zamknij">
            <span class={styles.backIcon}>←</span>
          </button>
          <div class={styles.guildIdentity}>
            <span class={styles.guildIcon}>🏰</span>
            <h1 class={styles.guildName}>
              {guild ? guild.name : t('guild.title')}
              {guild && <span class={styles.guildTag}>[{guild.tag}]</span>}
            </h1>
          </div>
        </div>
        <div class={styles.topBarRight}>
          <button
            class={`${styles.refreshBtn} ${refreshing ? styles.refreshing : ''}`}
            onClick={refreshData}
            disabled={refreshing}
            title={t('guild.refresh')}
          >
            <span class={styles.refreshIcon}>⟳</span>
          </button>
          <button class={styles.closeBtn} onClick={closeGuildPanel}>
            ✕
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div class={styles.layout}>
        {/* Sidebar */}
        {isInGuild.value && guild && (
          <aside class={styles.sidebar}>
            {/* Navigation */}
            <nav class={styles.nav}>
              <div class={styles.navLabel}>NAWIGACJA</div>
              {navItems
                .filter(item => !item.officerOnly || isGuildOfficer.value)
                .map(item => (
                  <button
                    key={item.id}
                    class={`${styles.navItem} ${activeTab === item.id ? styles.navItemActive : ''}`}
                    onClick={() => handleTabClick(item.id)}
                  >
                    <span class={styles.navIcon}>{item.icon}</span>
                    <span class={styles.navText}>{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span class={styles.navBadge}>{item.badge}</span>
                    )}
                    {activeTab === item.id && <span class={styles.navIndicator} />}
                  </button>
                ))}
            </nav>
          </aside>
        )}

        {/* Main Content */}
        <main class={styles.content}>
          {/* Loading state */}
          {guildLoading.value && (
            <div class={styles.loading}>
              <Spinner />
              <span>Ładowanie danych gildii...</span>
            </div>
          )}

          {/* Error state */}
          {guildError.value && (
            <div class={styles.error}>
              <span class={styles.errorIcon}>⚠️</span>
              <span>{guildError.value}</span>
              <Button variant="ghost" size="sm" onClick={refreshData}>
                Spróbuj ponownie
              </Button>
            </div>
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
            <div class={styles.tabContent}>
              {activeTab === 'info' && <GuildInfoTab onRefresh={refreshData} />}
              {activeTab === 'members' && <GuildMembersTab onRefresh={refreshData} />}
              {activeTab === 'treasury' && <GuildTreasuryTab onRefresh={refreshData} />}
              {activeTab === 'battles' && <GuildBattlesTab onRefresh={refreshData} />}
              {activeTab === 'tower-race' && <GuildTowerRaceTab onRefresh={refreshData} />}
              {activeTab === 'boss' && <GuildBossTab onRefresh={refreshData} />}
              {activeTab === 'medals' && <GuildMedalsTab onRefresh={refreshData} />}
              {activeTab === 'trophies' && <GuildTrophiesTab onRefresh={refreshData} />}
              {activeTab === 'roster' && <GuildRosterTab />}
              {activeTab === 'applications' && <GuildApplicationsTab onRefresh={refreshData} />}
            </div>
          )}
        </main>
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
      <div class={styles.noGuildCard}>
        <div class={styles.noGuildIcon}>🏰</div>
        <h2 class={styles.noGuildTitle}>{t('guild.notInGuild')}</h2>
        <p class={styles.noGuildText}>{t('guild.joinBenefits')}</p>

        <div class={styles.noGuildActions}>
          <Button
            variant="primary"
            size="lg"
            onClick={() => { closeGuildPanel(); openGuildSearch(); }}
          >
            <span style={{ marginRight: '0.5rem' }}>🔍</span>
            {t('guild.searchGuild')}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => { closeGuildPanel(); openGuildCreate(); }}
          >
            <span style={{ marginRight: '0.5rem' }}>➕</span>
            {t('guild.createGuild')}
          </Button>
        </div>

        {pendingInvitations > 0 && (
          <div class={styles.invitationsNotice}>
            <span class={styles.invitationsIcon}>📨</span>
            <span>{t('guild.pendingInvitations', { count: pendingInvitations })}</span>
            <Button variant="ghost" size="sm" onClick={onRefresh}>
              {t('guild.showInvitations')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
