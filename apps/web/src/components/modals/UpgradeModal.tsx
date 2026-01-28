import type { JSX } from 'preact';
import type { FortressClass } from '@arcade/sim-core';
import {
  upgradeTarget,
  upgradePanelVisible,
  activeTurrets,
  hubTurrets,
  gamePhase,
  displayGold,
  displayDust,
  powerState,
  baseGold,
  updateTurretStatLevel,
  updateTotalPower,
  showErrorToast,
  turretPlacementModalVisible,
  turretPlacementSlotIndex,
} from '../../state/index.js';
import { audioManager } from '../../game/AudioManager.js';
import {
  TURRET_STAT_UPGRADES,
  getTurretById,
} from '@arcade/sim-core';
import {
  type PowerStatUpgrades,
  TURRET_UPGRADE_COSTS,
} from '@arcade/protocol';
import { useState } from 'preact/hooks';
import { StatUpgradeRow } from '../shared/StatUpgradeRow.js';
import { Modal } from '../shared/Modal.js';
import { getAccessToken } from '../../api/auth.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import { DustIcon, GoldIcon, DamageIcon, SpeedIcon, RangeIcon, RailgunIcon, ArtilleryIcon, ArcIcon, CryoIcon } from '../icons/index.js';
import type { ComponentChildren } from 'preact';
import styles from './UpgradeModal.module.css';

// Timeout for async operations (10 seconds)
const ASYNC_TIMEOUT_MS = 10000;

/**
 * Wraps a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    ),
  ]);
}

// Turret icon components - using SVG matching game models
function getTurretIcon(turretId: string, size: number = 64): ComponentChildren {
  switch (turretId) {
    case 'railgun':
      return <RailgunIcon size={size} />;
    case 'artillery':
      return <ArtilleryIcon size={size} />;
    case 'arc':
      return <ArcIcon size={size} />;
    case 'cryo':
      return <CryoIcon size={size} />;
    default:
      return '🗼';
  }
}

// Turret names and info (4 turrets)
const TURRET_INFO: Record<string, { nameKey: string; roleKey: string; descriptionKey: string }> = {
  railgun: {
    nameKey: 'upgradeModal.turrets.railgun.name',
    roleKey: 'upgradeModal.turrets.railgun.role',
    descriptionKey: 'upgradeModal.turrets.railgun.description',
  },
  artillery: {
    nameKey: 'upgradeModal.turrets.artillery.name',
    roleKey: 'upgradeModal.turrets.artillery.role',
    descriptionKey: 'upgradeModal.turrets.artillery.description',
  },
  arc: {
    nameKey: 'upgradeModal.turrets.arc.name',
    roleKey: 'upgradeModal.turrets.arc.role',
    descriptionKey: 'upgradeModal.turrets.arc.description',
  },
  cryo: {
    nameKey: 'upgradeModal.turrets.cryo.name',
    roleKey: 'upgradeModal.turrets.cryo.role',
    descriptionKey: 'upgradeModal.turrets.cryo.description',
  },
};

// Class colors and labels (7 classes)
const CLASS_CONFIG: Record<FortressClass, { color: string; glow: string; element: FortressClass }> = {
  natural: { color: '#228b22', glow: 'rgba(34, 139, 34, 0.3)', element: 'natural' },
  ice: { color: '#00bfff', glow: 'rgba(0, 191, 255, 0.3)', element: 'ice' },
  fire: { color: '#ff4500', glow: 'rgba(255, 69, 0, 0.3)', element: 'fire' },
  lightning: { color: '#9932cc', glow: 'rgba(153, 50, 204, 0.3)', element: 'lightning' },
  tech: { color: '#00f0ff', glow: 'rgba(0, 240, 255, 0.3)', element: 'tech' },
  void: { color: '#4b0082', glow: 'rgba(75, 0, 130, 0.3)', element: 'void' },
  plasma: { color: '#00ffff', glow: 'rgba(0, 255, 255, 0.3)', element: 'plasma' },
};

// API functions
async function upgradeTurretStat(turretType: string, stat: string): Promise<{
  success: boolean;
  newLevel?: number;
  goldSpent?: number;
  newGold?: number;
  newTotalPower?: number;
  error?: string;
}> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch('/api/v1/power/turret', {
    method: 'POST',
    headers,
    body: JSON.stringify({ turretType, stat }),
  });
  return response.json();
}

interface UpgradeModalProps {
  onUpgrade: (target: { type: 'hero' | 'turret'; id: string | number }) => void;
}

export function UpgradeModal({ onUpgrade }: UpgradeModalProps) {
  const { t } = useTranslation(['modals', 'common']);
  const target = upgradeTarget.value;
  const visible = upgradePanelVisible.value;

  const gold = displayGold.value;
  const dust = displayDust.value;

  const handleClose = () => {
    upgradePanelVisible.value = false;
    upgradeTarget.value = null;
  };

  // Hero upgrade panel - now handled by HeroDetailsModal
  // Skip rendering for heroes here
  if (visible && target?.type === 'hero') {
    return null;
  }

  // Turret upgrade panel
  if (visible && target?.type === 'turret') {
    // In idle phase, look in hubTurrets; otherwise look in activeTurrets
    const turrets = gamePhase.value === 'idle' ? hubTurrets.value : activeTurrets.value;
    const turret = turrets.find(t => t.slotIndex === target.slotIndex);

    if (!turret) return null;

    const turretDef = getTurretById(turret.definitionId);
    const turretUpgrades = powerState.value.turretUpgrades.find(t => t.turretType === turret.definitionId);
    const [loadingStat, setLoadingStat] = useState<string | null>(null);

    const handleStatUpgrade = async (stat: string) => {
      setLoadingStat(stat);
      try {
        const result = await withTimeout(
          upgradeTurretStat(turret.definitionId, stat),
          ASYNC_TIMEOUT_MS,
          t('upgradeModal.errors.timeout')
        );
        if (result.success && result.newLevel !== undefined) {
          updateTurretStatLevel(turret.definitionId, stat as keyof PowerStatUpgrades, result.newLevel);
          if (result.newGold !== undefined) baseGold.value = result.newGold;
          if (result.newTotalPower !== undefined) updateTotalPower(result.newTotalPower);
          audioManager.playSfx('purchase');
        } else if (result.error) {
          showErrorToast(result.error);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : t('upgradeModal.errors.failed');
        showErrorToast(message);
      } finally {
        setLoadingStat(null);
      }
    };

    const info = TURRET_INFO[turret.definitionId] || {
      nameKey: 'upgradeModal.turrets.unknown.name',
      icon: '🗼',
      roleKey: 'upgradeModal.turrets.unknown.role',
      descriptionKey: 'upgradeModal.turrets.unknown.description',
    };
    const turretName = t(info.nameKey);
    const turretRole = t(info.roleKey);
    const turretDescription = t(info.descriptionKey);

    const classConfig = CLASS_CONFIG[turret.currentClass] || CLASS_CONFIG.natural;
    const canUpgrade = turret.tier < 3;
    const upgradeCost = turret.tier === 1 ? TURRET_UPGRADE_COSTS['1_to_2'] : TURRET_UPGRADE_COSTS['2_to_3'];
    const canAfford = gold >= upgradeCost.gold && dust >= upgradeCost.dust;

    const handleChangeTurret = () => {
      turretPlacementSlotIndex.value = target.slotIndex;
      turretPlacementModalVisible.value = true;
      upgradePanelVisible.value = false;
      upgradeTarget.value = null;
    };

    const cssVars = {
      '--class-color': classConfig.color,
      '--class-color-20': `${classConfig.color}33`,
      '--class-color-glow': classConfig.glow,
    } as JSX.CSSProperties;

    return (
      <Modal visible={visible} onClose={handleClose} showCloseButton={false} size="xlarge">
        <div class={styles.upgradePanel} style={cssVars}>
          {/* Header */}
          <div class={styles.modalHeader}>
            <h3 class={styles.modalTitle}>{t('upgradeModal.title')}</h3>
            <button class={styles.closeButton} onClick={handleClose}>×</button>
          </div>

          <div class={styles.content}>
            {/* Hero Section - Big turret display */}
            <div class={styles.heroSection}>
              <div class={styles.turretVisual}>
                {getTurretIcon(turret.definitionId, 64)}
              </div>

              <div class={styles.turretInfo}>
                <h2 class={styles.turretName}>{turretName}</h2>
                <div class={styles.turretMeta}>
                  <span class={styles.turretClass}>{t(`common:elements.${classConfig.element}`)}</span>
                  <span class={styles.turretRole}>{turretRole}</span>
                </div>
                <p class={styles.turretDescription}>{turretDescription}</p>
                {turretDef?.baseStats && (
                  <div class={styles.baseStats}>
                    <div class={styles.baseStat}>
                      <DamageIcon size={18} className={styles.baseStatIcon} />
                      <span class={styles.baseStatValue}>{Math.round(turretDef.baseStats.damage / 16384)}</span>
                      <span>{t('upgradeModal.stats.damageShort')}</span>
                    </div>
                    <div class={styles.baseStat}>
                      <SpeedIcon size={18} className={styles.baseStatIcon} />
                      <span class={styles.baseStatValue}>{(turretDef.baseStats.attackSpeed / 16384).toFixed(1)}</span>
                      <span>{t('upgradeModal.stats.attackSpeedShort')}</span>
                    </div>
                    <div class={styles.baseStat}>
                      <RangeIcon size={18} className={styles.baseStatIcon} />
                      <span class={styles.baseStatValue}>{Math.round(turretDef.baseStats.range / 16384)}</span>
                      <span>{t('upgradeModal.stats.range')}</span>
                    </div>
                  </div>
                )}
                {gamePhase.value === 'idle' && (
                  <div class={styles.turretActions}>
                    <button
                      class={styles.changeButton}
                      onClick={handleChangeTurret}
                      type="button"
                    >
                      {t('turretPlacement.change')}
                    </button>
                  </div>
                )}
              </div>

              <div class={styles.tierBadge}>
                <span class={styles.tierLabel}>{t('upgradeModal.tierLabel')}</span>
                <span class={styles.tierValue}>{turret.tier}</span>
                <span class={styles.tierMax}>/ 3</span>
              </div>
            </div>

            {/* Two columns: Upgrade + Stats */}
            <div class={styles.columnsWrapper}>
              {/* Left: Tier Upgrade */}
              {canUpgrade ? (
                <div class={styles.upgradeSection}>
                  <div class={styles.upgradeSectionHeader}>
                    <h4 class={styles.sectionTitle}>{t('upgradeModal.levelUpTitle')}</h4>
                    <span class={styles.nextTierBadge}>{t('upgradeModal.nextTier', { level: turret.tier + 1 })}</span>
                  </div>

                  <div class={styles.upgradePreview}>
                    <div class={styles.upgradeBonus}>
                      <DamageIcon size={18} className={styles.upgradeBonusIcon} />
                      <span class={styles.upgradeBonusText}>{t('upgradeModal.bonuses.damage')}</span>
                      <span class={styles.upgradeBonusValue}>+25%</span>
                    </div>
                    <div class={styles.upgradeBonus}>
                      <SpeedIcon size={18} className={styles.upgradeBonusIcon} />
                      <span class={styles.upgradeBonusText}>{t('upgradeModal.bonuses.attackSpeed')}</span>
                      <span class={styles.upgradeBonusValue}>+15%</span>
                    </div>
                  </div>

                  <div class={styles.upgradeCost}>
                    <span class={`${styles.costItem} ${gold < upgradeCost.gold ? styles.insufficient : ''}`}>
                      <GoldIcon size={16} className={styles.costIcon} />
                      {upgradeCost.gold.toLocaleString()}
                    </span>
                    <span class={`${styles.costItem} ${dust < upgradeCost.dust ? styles.insufficient : ''}`}>
                      <DustIcon size={14} className={styles.costIcon} />
                      {upgradeCost.dust}
                    </span>
                  </div>

                  <button
                    class={`${styles.upgradeButton} ${canAfford ? styles.canAfford : styles.cantAfford}`}
                    disabled={!canAfford}
                    onClick={() => onUpgrade({ type: 'turret', id: turret.slotIndex })}
                  >
                    {canAfford ? t('upgradeModal.upgrade') : t('upgradeModal.notEnoughResources')}
                  </button>
                </div>
              ) : (
                <div class={styles.maxTier}>
                  <span class={styles.maxTierIcon}>👑</span>
                  <span class={styles.maxTierText}>{t('upgradeModal.maxLevel')}</span>
                </div>
              )}

              {/* Right: Permanent Stat Bonuses */}
              <div class={styles.section}>
                <div class={styles.sectionHeader}>
                  <h4 class={styles.sectionTitle}>{t('upgradeModal.upgradesTitle')}</h4>
                  <span class={styles.sectionSubtitle}>{t('upgradeModal.permanentBonusesFor', { name: turretName })}</span>
                </div>
                <div class={styles.statList}>
                  {TURRET_STAT_UPGRADES.map(config => (
                    <StatUpgradeRow
                      key={config.stat}
                      config={config}
                      currentLevel={turretUpgrades?.statUpgrades[config.stat as keyof PowerStatUpgrades] || 0}
                      gold={gold}
                      onUpgrade={() => handleStatUpgrade(config.stat)}
                      isLoading={loadingStat === config.stat}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  // Fortress panel is now permanently displayed in hub via FortressInfoPanel
  // No modal needed for fortress anymore

  return null;
}
