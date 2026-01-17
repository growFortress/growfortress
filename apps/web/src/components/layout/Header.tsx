import {
  displayGold,
  displayDust,
  baseLevel,
  baseXp,
  baseXpToNextLevel,
  xpProgress,
  fortressHpPercent,
  fortressHp,
  fortressMaxHp,
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
} from '../../state/index.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import { Tooltip } from '../shared/Tooltip.js';
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

  const hpPercentValue = fortressHpPercent.value;
  const hpLevelKey = hpPercentValue > 50 ? 'healthy' : hpPercentValue > 25 ? 'damaged' : 'critical';
  const hpLevel = t(`header.hpLevel.${hpLevelKey}`);

  return (
    <header class={styles.header} role="banner">
      <div class={styles.leftSection}>
        <h1 class={styles.title}>
          <span class={styles.logoGrow}>Grow</span>
          <span class={styles.logoFortress}>Fortress</span>
        </h1>

        {/* HP bar - only show when playing */}
        {isPlaying && (
          <div class={styles.gameBars} role="region" aria-label={t('header.fortressStatus')}>
            <div class={styles.barContainer}>
              <span class={styles.barLabel} id="hp-label">{t('common:labels.hp')}</span>
              <div
                class={styles.barTrack}
                role="progressbar"
                aria-labelledby="hp-label"
                aria-valuenow={hpPercentValue}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuetext={t('header.hpValueText', { current: fortressHp.value, max: fortressMaxHp.value, level: hpLevel })}
              >
                <div
                  class={`${styles.barFill} ${styles.hpBar}`}
                  style={{ width: `${hpPercentValue}%` }}
                />
              </div>
              <span class={styles.barValue} aria-hidden="true">
                {fortressHp.value}/{fortressMaxHp.value}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Status bar - only show in Hub mode, hidden during gameplay */}
      {!isPlaying && (
        <nav class={styles.statusBar} role="navigation" aria-label={t('header.playerStatus')}>
          {/* Resources */}
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
          </div>

          {/* Level with XP bar */}
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

          {/* Buttons */}
          <div class={styles.buttonGroup}>
            <Tooltip content={t('common:navigation.dailyQuests')} position="bottom">
              <button
                class={styles.dailyQuestsBtn}
                onClick={() => showDailyQuestsPanel()}
                aria-label={hasUnclaimedQuestRewards.value ? t('header.dailyQuestsWithRewards', { count: unclaimedCompletedCount.value }) : t('common:navigation.dailyQuests')}
              >
                <span aria-hidden="true">📋</span>
                {hasUnclaimedQuestRewards.value && (
                  <span class={styles.questBadge} aria-hidden="true">
                    {unclaimedCompletedCount.value}
                  </span>
                )}
              </button>
            </Tooltip>

            <Tooltip content={t('common:navigation.leaderboards')} position="bottom">
              <button
                class={styles.leaderboardBtn}
                onClick={() => openLeaderboardModal()}
                aria-label={hasUnclaimedRewards.value ? t('header.leaderboardsWithRewards') : t('common:navigation.leaderboards')}
              >
                <span aria-hidden="true">🏆</span>
                {hasUnclaimedRewards.value && (
                  <span class={styles.rewardBadge} aria-label={t('header.rewardsToClaim')} />
                )}
              </button>
            </Tooltip>

            <Tooltip content={t('common:navigation.messages')} position="bottom">
              <button
                class={styles.messagesBtn}
                onClick={() => openMessagesModal()}
                aria-label={hasUnreadMessages.value ? t('header.messagesWithUnread', { count: unreadCounts.value.total }) : t('common:navigation.messages')}
              >
                <span aria-hidden="true">✉️</span>
                {hasUnreadMessages.value && (
                  <span class={styles.messagesBadge} aria-hidden="true">
                    {unreadCounts.value.total > 99 ? '99+' : unreadCounts.value.total}
                  </span>
                )}
              </button>
            </Tooltip>

            <Tooltip content={isInGuild.value ? (playerGuild.value?.name || t('common:navigation.guild')) : t('common:navigation.guild')} position="bottom">
              <button
                class={styles.guildBtn}
                onClick={() => openGuildPanel()}
                aria-label={t('header.openGuildPanel')}
              >
                <span aria-hidden="true">🏰</span>
                {isInGuild.value && playerGuild.value && (
                  <span class={styles.guildTag}>[{playerGuild.value.tag}]</span>
                )}
                {hasNewInvitations.value && !isInGuild.value && (
                  <span class={styles.guildBadge} aria-label={t('header.newInvitations')} />
                )}
              </button>
            </Tooltip>

            <Tooltip content={t('common:navigation.shop')} position="bottom">
              <button
                class={styles.shopBtn}
                onClick={() => showShopModal()}
                aria-label={t('common:navigation.shop')}
              >
                <span aria-hidden="true">🛒</span>
              </button>
            </Tooltip>

            <Tooltip content={t('common:navigation.settings')} position="bottom">
              <button
                class={styles.settingsBtn}
                onClick={openSettingsMenu}
                aria-label={t('common:navigation.settings')}
              >
                <span aria-hidden="true">⚙️</span>
              </button>
            </Tooltip>
          </div>
        </nav>
      )}
    </header>
  );
}
