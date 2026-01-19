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
} from '../../state/index.js';
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

  // Hide header during class selection for cleaner modal view
  if (classSelectionVisible.value) {
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
          {/* Resources Group */}
          <div class={styles.navGroupWrapper}>
            <span class={styles.groupLabel}>Zasoby</span>
            <div class={styles.resourceGroup}>
              <div class={styles.resource} aria-label={t('header.resourceGold', { amount: displayGold.value })}>
                <span class={styles.resourceIcon} aria-hidden="true">🪙</span>
                <span class={`${styles.resourceValue} ${styles.gold}`}>{displayGold.value}</span>
                <span class={styles.resourceLabel}>{t('common:resources.gold')}</span>
              </div>
              <div class={styles.resource} aria-label={t('header.resourceDust', { amount: displayDust.value })}>
                <span class={styles.resourceIcon} aria-hidden="true">✨</span>
                <span class={`${styles.resourceValue} ${styles.dust}`}>{displayDust.value}</span>
                <span class={styles.resourceLabel}>{t('common:resources.dust')}</span>
              </div>
              {/* Energy bar */}
              <EnergyBar compact />
            </div>
          </div>

          {/* Level Group */}
          <div class={styles.navGroupWrapper}>
            <span class={styles.groupLabel}>Poziom</span>
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

          {/* Quick Actions Group */}
          <div class={styles.navGroupWrapper}>
            <span class={styles.groupLabel}>Skróty</span>
            <div class={styles.buttonGroup}>
              <Tooltip content="Eksploracja Światów" position="bottom">
                <button
                  class={styles.headerBtn}
                  onClick={() => showPillarUnlockModal()}
                  aria-label="Eksploracja Światów"
                >
                  <span aria-hidden="true">🌍</span>
                </button>
              </Tooltip>

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

              <Tooltip content="Battle Pass" position="bottom">
                <button
                  class={styles.headerBtn}
                  onClick={() => showBattlePassModal()}
                  aria-label={hasUnclaimedBPRewards.value ? `Battle Pass (${totalUnclaimedCount.value} rewards)` : 'Battle Pass'}
                >
                  <span aria-hidden="true">🎖️</span>
                  {hasUnclaimedBPRewards.value && (
                    <span class={styles.badge} aria-hidden="true">
                      {totalUnclaimedCount.value}
                    </span>
                  )}
                </button>
              </Tooltip>

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

              <Tooltip content={t('common:navigation.shop')} position="bottom">
                <button
                  class={styles.headerBtn}
                  onClick={() => showShopModal()}
                  aria-label={t('common:navigation.shop')}
                >
                  <span aria-hidden="true">🛒</span>
                </button>
              </Tooltip>

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
        </nav>
      )}
    </header>
  );
}
