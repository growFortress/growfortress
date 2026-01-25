import {
  displayGold,
  displayDust,
  baseLevel,
  baseXp,
  baseXpToNextLevel,
  xpProgress,
  gamePhase,
  classSelectionVisible,
  openSettingsMenu,
  openGuildPanel,
  isInGuild,
  playerGuild,
  hasNewInvitations,
  openMessagesModal,
  hasUnreadMessages,
  unreadCounts,
  openLeaderboardModal,
  openStatisticsDashboard,
  hasUnclaimedRewards,
  showShopModal,
  showPillarUnlockModal,
  openPvpPanel,
  pvpPendingChallenges,
  showAchievementsModal,
  hasUnclaimedAchievements,
} from '../../state/index.js';
import { colonySceneVisible } from '../../state/idle.signals.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import { Tooltip } from '../shared/Tooltip.js';
import { EnergyBar } from '../game/EnergyBar.js';
import { Icon, DustIcon, GoldIcon } from '../icons/index.js';
import styles from './Header.module.css';

interface HeaderProps {
  // Logout is now handled through settings menu
}

export function Header(_props: HeaderProps) {
  const { t } = useTranslation(['game', 'common']);
  const isPlaying = gamePhase.value !== 'idle';

  // Hide header during class selection or colony scene for cleaner view
  if (classSelectionVisible.value || colonySceneVisible.value) {
    return null;
  }

  return (
    <header class={styles.header} role="banner">
      {/* Left section - empty during gameplay (HP is now in game HUD) */}
      <div class={styles.leftSection}>
        {/* HP bar moved to Hud component for better game UI */}
      </div>

      {/* Status bar - only show in Hub mode, hidden during gameplay */}
      {!isPlaying && (
        <nav class={styles.statusBar} role="navigation" aria-label={t('header.playerStatus')}>
          {/* Left: Resources + Level */}
          <div class={styles.leftGroup}>
            {/* Resources Group */}
            <div class={styles.navGroupWrapper}>
              <span class={styles.groupLabel}>{t('header.resourcesLabel')}</span>
              <div class={styles.resourceGroup}>
                <div class={styles.resource} aria-label={t('header.resourceGold', { amount: displayGold.value })}>
                  <GoldIcon size={22} className={styles.resourceIcon} />
                  <span class={`${styles.resourceValue} ${styles.gold}`}>{displayGold.value}</span>
                </div>
                <div class={styles.resource} aria-label={t('header.resourceDust', { amount: displayDust.value })}>
                  <DustIcon size={22} className={styles.resourceIcon} />
                  <span class={`${styles.resourceValue} ${styles.dust}`}>{displayDust.value}</span>
                </div>
                {/* Energy bar */}
                <EnergyBar compact />
              </div>
            </div>

            {/* Level Group */}
            <div class={styles.navGroupWrapper}>
              <span class={styles.groupLabel}>{t('header.levelGroupLabel')}</span>
              <div class={styles.levelSection} aria-label={t('header.levelLabel', { level: baseLevel.value })}>
                <span class={styles.levelLabel}>{t('common:labels.lv')}</span>
                <span class={styles.levelValue}>{baseLevel.value}</span>
                <div
                  class={styles.xpTrack}
                  role="progressbar"
                  aria-label={t('header.xpProgress')}
                  aria-valuenow={xpProgress.value}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    class={styles.xpFill}
                    style={{ width: `${xpProgress.value}%` }}
                  />
                </div>
                <span class={styles.xpText}>
                  {baseXp.value}/{baseXp.value + baseXpToNextLevel.value}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Quick Actions Group */}
          <div class={styles.rightGroup}>
            <div class={styles.navGroupWrapper}>
            <span class={styles.groupLabel}>{t('header.shortcutsLabel')}</span>
            <div class={styles.buttonGroup}>
              {/* World Exploration - gameplay */}
              <Tooltip content={t('header.worldExploration')} position="bottom">
                <button
                  class={styles.headerBtn}
                  onClick={() => showPillarUnlockModal()}
                  aria-label={t('header.worldExploration')}
                >
                  <Icon name="globe" size={18} />
                </button>
              </Tooltip>

              {/* PvP Arena - competitive */}
              <Tooltip content={t('header.pvpArena')} position="bottom">
                <button
                  class={styles.headerBtn}
                  onClick={openPvpPanel}
                  aria-label={pvpPendingChallenges.value > 0
                    ? t('header.pvpArenaWithChallenges', { count: pvpPendingChallenges.value })
                    : t('header.pvpArena')}
                >
                  <Icon name="crossed-swords" size={18} />
                  {pvpPendingChallenges.value > 0 && (
                    <span class={styles.badge} aria-hidden="true">
                      {pvpPendingChallenges.value}
                    </span>
                  )}
                </button>
              </Tooltip>

              {/* Leaderboards - rankings */}
              <Tooltip content={t('common:navigation.leaderboards')} position="bottom">
                <button
                  class={styles.headerBtn}
                  onClick={() => openLeaderboardModal()}
                  aria-label={hasUnclaimedRewards.value ? t('header.leaderboardsWithRewards') : t('common:navigation.leaderboards')}
                >
                  <Icon name="trophy" size={18} />
                  {hasUnclaimedRewards.value && (
                    <span class={styles.dotBadge} aria-label={t('header.rewardsToClaim')} />
                  )}
                </button>
              </Tooltip>

              {/* Statistics dashboard */}
              <Tooltip content={t('common:navigation.statistics')} position="bottom">
                <button
                  class={styles.headerBtn}
                  onClick={() => openStatisticsDashboard()}
                  aria-label={t('common:navigation.statistics')}
                >
                  <Icon name="chart" size={18} />
                </button>
              </Tooltip>

              {/* Achievements - progression */}
              <Tooltip content={t('common:navigation.achievements')} position="bottom">
                <button
                  class={styles.headerBtn}
                  onClick={() => showAchievementsModal()}
                  aria-label={hasUnclaimedAchievements.value
                    ? t('header.achievementsWithRewards')
                    : t('common:navigation.achievements')}
                >
                  <Icon name="medal" size={18} />
                  {hasUnclaimedAchievements.value && (
                    <span class={styles.dotBadge} aria-label={t('header.rewardsToClaim')} />
                  )}
                </button>
              </Tooltip>

              {/* Guild - social */}
              <Tooltip content={isInGuild.value ? (playerGuild.value?.name || t('common:navigation.guild')) : t('common:navigation.guild')} position="bottom">
                <button
                  class={styles.headerBtn}
                  onClick={() => openGuildPanel()}
                  aria-label={t('header.openGuildPanel')}
                >
                  <Icon name="castle" size={18} />
                  {hasNewInvitations.value && !isInGuild.value && (
                    <span class={styles.dotBadge} aria-label={t('header.newInvitations')} />
                  )}
                </button>
              </Tooltip>

              {/* Messages - communication */}
              <Tooltip content={t('common:navigation.messages')} position="bottom">
                <button
                  class={styles.headerBtn}
                  onClick={() => openMessagesModal()}
                  aria-label={hasUnreadMessages.value ? t('header.messagesWithUnread', { count: unreadCounts.value.total }) : t('common:navigation.messages')}
                >
                  <Icon name="envelope" size={18} />
                  {hasUnreadMessages.value && (
                    <span class={styles.badge} aria-hidden="true">
                      {unreadCounts.value.total > 99 ? '99+' : unreadCounts.value.total}
                    </span>
                  )}
                </button>
              </Tooltip>

              {/* Shop - purchases */}
              <Tooltip content={t('common:navigation.shop')} position="bottom">
                <button
                  class={styles.headerBtn}
                  onClick={() => showShopModal()}
                  aria-label={t('common:navigation.shop')}
                >
                  <Icon name="cart" size={18} />
                </button>
              </Tooltip>

              {/* Settings - always last */}
              <Tooltip content={t('common:navigation.settings')} position="bottom">
                <button
                  class={styles.headerBtn}
                  onClick={openSettingsMenu}
                  aria-label={t('common:navigation.settings')}
                >
                  <Icon name="settings" size={18} />
                </button>
              </Tooltip>
            </div>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
