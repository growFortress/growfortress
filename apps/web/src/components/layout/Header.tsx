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
  hasUnclaimedRewards,
  showDailyQuestsPanel,
  hasUnclaimedQuestRewards,
  unclaimedCompletedCount,
  showShopModal,
  showPillarUnlockModal,
  showBattlePassModal,
  hasUnclaimedBPRewards,
  totalUnclaimedCount,
  openPvpPanel,
  pvpPendingChallenges,
} from '../../state/index.js';
import { colonySceneVisible } from '../../state/idle.signals.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import { Tooltip } from '../shared/Tooltip.js';
import { EnergyBar } from '../game/EnergyBar.js';
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
                  <span class={styles.resourceIcon} aria-hidden="true">🪙</span>
                  <span class={`${styles.resourceValue} ${styles.gold}`}>{displayGold.value}</span>
                </div>
                <div class={styles.resource} aria-label={t('header.resourceDust', { amount: displayDust.value })}>
                  <span class={styles.resourceIcon} aria-hidden="true">🌫️</span>
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
              {/* Daily Quests - frequent daily actions */}
              <Tooltip content={t('common:navigation.dailyQuests')} position="bottom">
                <button
                  class={styles.headerBtn}
                  onClick={() => showDailyQuestsPanel()}
                  aria-label={hasUnclaimedQuestRewards.value ? t('header.dailyQuestsWithRewards', { count: unclaimedCompletedCount.value }) : t('common:navigation.dailyQuests')}
                >
                  <span aria-hidden="true">📋</span>
                  {hasUnclaimedQuestRewards.value && (
                    <span class={styles.badge} aria-hidden="true">
                      {unclaimedCompletedCount.value}
                    </span>
                  )}
                </button>
              </Tooltip>

              {/* Battle Pass - progression */}
              <Tooltip content={t('header.battlePass')} position="bottom">
                <button
                  class={styles.headerBtn}
                  onClick={() => showBattlePassModal()}
                  aria-label={hasUnclaimedBPRewards.value ? t('header.battlePassWithRewards', { count: totalUnclaimedCount.value }) : t('header.battlePass')}
                >
                  <span aria-hidden="true">🎖️</span>
                  {hasUnclaimedBPRewards.value && (
                    <span class={styles.badge} aria-hidden="true">
                      {totalUnclaimedCount.value}
                    </span>
                  )}
                </button>
              </Tooltip>

              {/* World Exploration - gameplay */}
              <Tooltip content={t('header.worldExploration')} position="bottom">
                <button
                  class={styles.headerBtn}
                  onClick={() => showPillarUnlockModal()}
                  aria-label={t('header.worldExploration')}
                >
                  <span aria-hidden="true">🌍</span>
                </button>
              </Tooltip>

              {/* PvP Arena - competitive */}
              <Tooltip content={t('header.pvpArena')} position="bottom">
                <button
                  class={styles.headerBtn}
                  onClick={openPvpPanel}
                  aria-label={pvpPendingChallenges.value > 0 ? `${t('header.pvpArena')} (${t('header.pvpChallenges', { count: pvpPendingChallenges.value })})` : t('header.pvpArena')}
                >
                  <span aria-hidden="true">⚔️</span>
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
                  <span aria-hidden="true">🏆</span>
                  {hasUnclaimedRewards.value && (
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
                  <span aria-hidden="true">🏰</span>
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
                  <span aria-hidden="true">✉️</span>
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
                  <span aria-hidden="true">🛒</span>
                </button>
              </Tooltip>

              {/* Settings - always last */}
              <Tooltip content={t('common:navigation.settings')} position="bottom">
                <button
                  class={styles.headerBtn}
                  onClick={openSettingsMenu}
                  aria-label={t('common:navigation.settings')}
                >
                  <span aria-hidden="true">⚙️</span>
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
