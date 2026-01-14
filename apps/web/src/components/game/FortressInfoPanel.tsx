import type { JSX } from 'preact';
import type { FortressClass } from '@arcade/sim-core';
import { useState, useMemo, useCallback, useEffect } from 'preact/hooks';
import {
  calculateTotalHpBonus,
  calculateTotalDamageBonus,
  calculateFortressPower,
  createDefaultStatUpgrades,
  getFortressTier,
  getFortressTierName,
  getStatBonusPercent,
  FORTRESS_STAT_UPGRADES,
  getUpgradeCost,
} from '@arcade/sim-core';
import type { PowerStatUpgrades } from '@arcade/protocol';
import {
  selectedFortressClass,
  baseLevel,
  powerState,
  baseGold,
  displayGold,
  displayName,
  playerDescription,
  descriptionUpdating,
  playerPrimaryRank,
  openLeaderboardModal,
  playerGuild,
  playerMembership,
  isInGuild,
  openGuildPanel,
  openGuildSearch,
  showErrorToast,
  classSelectionVisible,
} from '../../state/index.js';
import { updatePlayerDescription } from '../../api/client.js';
import { fetchUserRanks } from '../../api/leaderboard.js';
import { getAccessToken } from '../../api/auth.js';
import { setUserRanks } from '../../state/leaderboard.signals.js';
import { TierEvolutionModal } from '../modals/TierEvolutionModal.js';
import { Button } from '../shared/Button.js';
import { announce } from '../shared/ScreenReaderAnnouncer.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import styles from './FortressInfoPanel.module.css';

// Class colors
const CLASS_COLORS: Record<FortressClass, string> = {
  natural: '#228b22',
  ice: '#00bfff',
  fire: '#ff4500',
  lightning: '#9932cc',
  tech: '#00f0ff',
  void: '#4b0082',
  plasma: '#00ffff',
};

// Stat icons
const STAT_ICONS: Record<string, string> = {
  hp: '❤️',
  damage: '⚔️',
  armor: '🛡️',
};

// API function for fortress upgrades
async function upgradeFortressStat(stat: string): Promise<{
  success: boolean;
  newLevel?: number;
  goldSpent?: number;
  newGold?: number;
  newTotalPower?: number;
  error?: string;
}> {
  const token = getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch('/api/v1/power/fortress', {
    method: 'POST',
    headers,
    body: JSON.stringify({ stat }),
  });
  return response.json();
}

export function FortressInfoPanel() {
  const { t } = useTranslation('common');
  const fortressClass = selectedFortressClass.value;
  const fortressLevel = baseLevel.value;
  const currentTier = getFortressTier(fortressLevel);
  const state = powerState.value;
  const gold = displayGold.value;

  // Local state
  const [evolutionModalOpen, setEvolutionModalOpen] = useState(false);
  const [loadingStat, setLoadingStat] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState(false);
  const [localDescription, setLocalDescription] = useState(playerDescription.value);

  // Sync local description with global state
  useEffect(() => {
    setLocalDescription(playerDescription.value);
  }, []);

  // Fetch user ranks on mount
  useEffect(() => {
    fetchUserRanks().then((data) => {
      if (data) {
        setUserRanks(data.ranks, data.weekKey, data.timeUntilReset);
      }
    }).catch(() => {
      // Silent fail - ranks are optional
    });
  }, []);

  // Memoized calculations
  const fortressPower = useMemo(() => {
    const fortressUpgrades = {
      ...createDefaultStatUpgrades(),
      hp: state.fortressUpgrades.hp || 0,
      damage: state.fortressUpgrades.damage || 0,
      armor: state.fortressUpgrades.armor || 0,
    };
    return calculateFortressPower(fortressUpgrades, fortressLevel).totalPower;
  }, [state.fortressUpgrades, fortressLevel]);

  const totalBonuses = useMemo(() => {
    const levelHpBonus = calculateTotalHpBonus(fortressLevel);
    const levelDmgBonus = calculateTotalDamageBonus(fortressLevel);
    const levelHpPercent = Math.round(((levelHpBonus / 16384) - 1) * 100);
    const levelDmgPercent = Math.round(((levelDmgBonus / 16384) - 1) * 100);

    const upgradeHpPercent = getStatBonusPercent(
      FORTRESS_STAT_UPGRADES.find(u => u.stat === 'hp')!,
      state.fortressUpgrades.hp || 0
    );
    const upgradeDmgPercent = getStatBonusPercent(
      FORTRESS_STAT_UPGRADES.find(u => u.stat === 'damage')!,
      state.fortressUpgrades.damage || 0
    );
    const upgradeArmorPercent = getStatBonusPercent(
      FORTRESS_STAT_UPGRADES.find(u => u.stat === 'armor')!,
      state.fortressUpgrades.armor || 0
    );

    return {
      hp: levelHpPercent + upgradeHpPercent,
      damage: levelDmgPercent + upgradeDmgPercent,
      armor: upgradeArmorPercent,
    };
  }, [fortressLevel, state.fortressUpgrades]);

  const classColor = fortressClass ? CLASS_COLORS[fortressClass] : '#888888';

  // Handlers
  const handleUpgrade = useCallback(async (stat: string) => {
    setLoadingStat(stat);
    try {
      const result = await upgradeFortressStat(stat);
      if (result.success && result.newLevel !== undefined) {
        // Update state
        powerState.value = {
          ...powerState.value,
          fortressUpgrades: {
            ...powerState.value.fortressUpgrades,
            [stat]: result.newLevel,
          },
        };
        if (result.newGold !== undefined) baseGold.value = result.newGold;
        if (result.newTotalPower !== undefined) {
          powerState.value = {
            ...powerState.value,
            totalPower: result.newTotalPower,
          };
        }
        announce(t('fortressPanel.upgradedTo', { stat, level: result.newLevel }), 'polite');
      } else if (result.error) {
        showErrorToast(result.error, 'error');
      }
    } catch (error) {
      showErrorToast(t('fortressPanel.upgradeFailed'), 'error');
    } finally {
      setLoadingStat(null);
    }
  }, [t]);

  const handleSaveDescription = useCallback(async () => {
    descriptionUpdating.value = true;
    try {
      const result = await updatePlayerDescription(localDescription);
      playerDescription.value = result.description;
      setEditingDescription(false);
      announce(t('fortressPanel.descSaved'), 'polite');
    } catch (error) {
      showErrorToast(t('fortressPanel.descSaveFailed'), 'error');
    } finally {
      descriptionUpdating.value = false;
    }
  }, [localDescription, t]);

  const handleCancelDescription = useCallback(() => {
    setLocalDescription(playerDescription.value);
    setEditingDescription(false);
  }, []);

  const handleOpenClassSelection = useCallback(() => {
    classSelectionVisible.value = true;
  }, []);

  const handleLeaderboardClick = useCallback(() => {
    openLeaderboardModal('permanent');
  }, []);

  const handleGuildClick = useCallback(() => {
    if (isInGuild.value) {
      openGuildPanel('info');
    } else {
      openGuildSearch();
    }
  }, []);

  // Guild info
  const guild = playerGuild.value;
  const membership = playerMembership.value;
  const rank = playerPrimaryRank.value;

  return (
    <div class={styles.panel} style={{ '--class-color': classColor } as JSX.CSSProperties}>
      {/* PLAYER PROFILE SECTION - Now at top */}
      <section class={styles.section} aria-labelledby="profile-title">
        <div class={styles.sectionHeader}>
          <span id="profile-title" class={styles.sectionTitle}>{t('fortressPanel.profile')}</span>
          <div class={styles.sectionLine} />
        </div>

        <div class={styles.profileContent}>
          {/* Player Name Row */}
          <div class={styles.profileRow}>
            <span class={styles.profileLabel}>{t('fortressPanel.player')}</span>
            <span class={styles.playerNameValue}>{displayName.value || t('fortressPanel.defaultPlayer')}</span>
          </div>

          {/* Guild Row */}
          <div class={styles.profileRow}>
            <span class={styles.profileLabel}>{t('fortressPanel.guild')}</span>
            {guild ? (
              <button
                class={styles.guildTag}
                onClick={handleGuildClick}
                aria-label={t('fortressPanel.openGuildPanel', { name: guild.name })}
              >
                [{guild.tag}] {t(`fortressPanel.guildRoles.${membership?.role || 'MEMBER'}`, { defaultValue: membership?.role })}
              </button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGuildClick}
              >
                {t('fortressPanel.joinGuild')}
              </Button>
            )}
          </div>

          {/* Rank Row */}
          <div class={styles.profileRow}>
            <span class={styles.profileLabel}>{t('fortressPanel.ranking')}</span>
            <button
              class={styles.rankButton}
              onClick={handleLeaderboardClick}
              aria-label={t('fortressPanel.rankPosition', { rank: rank ?? '—' })}
            >
              #{rank ?? '—'}
            </button>
          </div>

          {/* Description */}
          <div class={styles.descriptionSection}>
            <div class={styles.descriptionHeader}>
              <span class={styles.profileLabel}>{t('fortressPanel.description')}</span>
              {editingDescription ? (
                <div class={styles.descriptionActions}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelDescription}
                    disabled={descriptionUpdating.value}
                  >
                    {t('fortressPanel.cancel')}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveDescription}
                    loading={descriptionUpdating.value}
                  >
                    {t('fortressPanel.save')}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingDescription(true)}
                >
                  {t('fortressPanel.edit')}
                </Button>
              )}
            </div>
            {editingDescription ? (
              <textarea
                class={styles.descriptionInput}
                value={localDescription}
                onInput={(e) => setLocalDescription((e.target as HTMLTextAreaElement).value)}
                maxLength={500}
                rows={3}
                placeholder={t('fortressPanel.descPlaceholder')}
                aria-label={t('fortressPanel.playerDescription')}
              />
            ) : (
              <p class={styles.descriptionText}>
                {playerDescription.value || t('fortressPanel.noDescription')}
              </p>
            )}
            {editingDescription && (
              <span class={styles.charCount}>{localDescription.length}/500</span>
            )}
          </div>
        </div>
      </section>

      {/* FORTRESS SECTION */}
      <section class={styles.section} aria-labelledby="fortress-title">
        <div class={styles.sectionHeader}>
          <span id="fortress-title" class={styles.sectionTitle}>{t('fortressPanel.fortress')}</span>
          <div class={styles.sectionLine} />
        </div>

        <div class={styles.fortressContent}>
          <div class={styles.fortressHeader}>
            <div class={styles.fortressInfo}>
              <div class={styles.fortressClassRow}>
                <span class={styles.fortressLabel}>{t('fortressPanel.class')}</span>
                <span class={styles.fortressClassName}>
                  {fortressClass ? t(`elements.${fortressClass}`) : t('fortressPanel.noClass')}
                </span>
              </div>
              <button
                class={styles.tierButton}
                onClick={() => setEvolutionModalOpen(true)}
                aria-label={t('fortressPanel.tierClick', { tier: currentTier })}
                aria-expanded={evolutionModalOpen}
              >
                <span class={styles.tierLabel}>{getFortressTierName(currentTier)}</span>
                <span class={styles.tierArrow}>→</span>
              </button>
            </div>
            <div class={styles.powerBadge}>
              <span class={styles.powerLabel}>{t('fortressPanel.power')}</span>
              <div class={styles.powerValueWrapper}>
                <span class={styles.powerIcon}>⚡</span>
                <span class={styles.powerValue}>{fortressPower.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div class={styles.fortressActions}>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenClassSelection}
              aria-label={t('fortressPanel.changeClassAria')}
            >
              {t('fortressPanel.changeClass')}
            </Button>
          </div>
        </div>
      </section>

      {/* FORTRESS UPGRADES SECTION */}
      <section class={styles.section} aria-labelledby="upgrades-title">
        <div class={styles.sectionHeader}>
          <span id="upgrades-title" class={styles.sectionTitle}>{t('fortressPanel.fortressUpgrades')}</span>
          <div class={styles.sectionLine} />
        </div>
        <div class={styles.upgradeList}>
          {FORTRESS_STAT_UPGRADES.map((config) => {
            const currentLevel = state.fortressUpgrades[config.stat as keyof PowerStatUpgrades] || 0;
            const cost = getUpgradeCost(config, currentLevel);
            const canAfford = gold >= cost && currentLevel < config.maxLevel;
            const isMaxed = currentLevel >= config.maxLevel;
            const currentBonus = getStatBonusPercent(config, currentLevel);
            const nextBonus = getStatBonusPercent(config, currentLevel + 1);
            const progressPercent = (currentLevel / config.maxLevel) * 100;
            const isLoading = loadingStat === config.stat;
            const totalBonus = totalBonuses[config.stat as keyof typeof totalBonuses] || currentBonus;

            const upgradeName = t(`fortressPanel.statUpgrades.${config.stat}`, { defaultValue: config.name });

            return (
              <div key={config.stat} class={styles.upgradeCard}>
                <div class={styles.upgradeCardHeader}>
                  <span class={styles.upgradeIcon}>{STAT_ICONS[config.stat] || '📊'}</span>
                  <span class={styles.upgradeName}>{upgradeName}</span>
                  <span class={styles.upgradeLevel}>{currentLevel}/{config.maxLevel}</span>
                </div>

                <div class={styles.upgradeProgressWrapper}>
                  <div class={styles.upgradeProgressBar}>
                    <div
                      class={styles.upgradeProgressFill}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                <div class={styles.upgradeBonusRow}>
                  <span class={styles.totalBonusLabel}>{t('fortressPanel.total')}</span>
                  <span class={styles.totalBonusValue}>+{totalBonus.toFixed(0)}%</span>
                  {!isMaxed && (
                    <span class={styles.nextBonusHint}>(+{(nextBonus - currentBonus).toFixed(1)}%)</span>
                  )}
                </div>

                <div class={styles.upgradeAction}>
                  {isMaxed ? (
                    <span class={styles.maxedLabel}>MAX</span>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleUpgrade(config.stat)}
                      disabled={!canAfford || isLoading}
                      loading={isLoading}
                      aria-label={t('fortressPanel.upgradeFor', { name: upgradeName, cost })}
                    >
                      {cost} 💰
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Evolution Modal */}
      <TierEvolutionModal
        isOpen={evolutionModalOpen}
        onClose={() => setEvolutionModalOpen(false)}
        fortressLevel={fortressLevel}
      />
    </div>
  );
}
