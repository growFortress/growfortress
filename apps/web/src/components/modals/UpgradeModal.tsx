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
} from '../../state/index.js';
import { audioManager } from '../../game/AudioManager.js';
import {
  TURRET_STAT_UPGRADES,
} from '@arcade/sim-core';
import {
  type PowerStatUpgrades,
  TURRET_UPGRADE_COSTS,
} from '@arcade/protocol';
import { useState } from 'preact/hooks';
import { StatUpgradeRow } from '../shared/StatUpgradeRow.js';
import { Modal } from '../shared/Modal.js';
import { Button } from '../shared/Button.js';
import { getAccessToken } from '../../api/auth.js';
import styles from './UpgradeModal.module.css';

// Timeout for async operations (10 seconds)
const ASYNC_TIMEOUT_MS = 10000;

/**
 * Wraps a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Przekroczono limit czasu operacji')), timeoutMs)
    ),
  ]);
}

// Turret names and info (simplified: 4 turrets)
const TURRET_INFO: Record<string, { name: string; icon: string; role: string }> = {
  arrow: { name: 'Wieża Strzał', icon: '🏹', role: 'Szybkie Obrażenia' },
  cannon: { name: 'Wieża Armatnia', icon: '💣', role: 'Obszarowe' },
  tesla: { name: 'Wieża Tesli', icon: '⚡', role: 'Łańcuchowe' },
  frost: { name: 'Wieża Mrozu', icon: '❄️', role: 'Spowolnienie' },
};

// Class colors (7 classes)
const CLASS_COLORS: Record<FortressClass, string> = {
  natural: '#228b22',
  ice: '#00bfff',
  fire: '#ff4500',
  lightning: '#9932cc',
  tech: '#00f0ff',
  void: '#4b0082',
  plasma: '#00ffff',
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

    const turretUpgrades = powerState.value.turretUpgrades.find(t => t.turretType === turret.definitionId);
    const [loadingStat, setLoadingStat] = useState<string | null>(null);

    const handleStatUpgrade = async (stat: string) => {
      setLoadingStat(stat);
      try {
        const result = await withTimeout(
          upgradeTurretStat(turret.definitionId, stat),
          ASYNC_TIMEOUT_MS
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
        const message = error instanceof Error ? error.message : 'Nie udało się ulepszyć statystyki';
        showErrorToast(message);
      } finally {
        setLoadingStat(null);
      }
    };

    const info = TURRET_INFO[turret.definitionId] || {
      name: turret.definitionId,
      icon: '🗼',
      role: 'Nieznana',
    };

    const canUpgrade = turret.tier < 3;
    const upgradeCost = turret.tier === 1 ? TURRET_UPGRADE_COSTS['1_to_2'] : TURRET_UPGRADE_COSTS['2_to_3'];
    const canAfford = gold >= upgradeCost.gold && dust >= upgradeCost.dust;

    return (
      <Modal visible={visible} onClose={handleClose} showCloseButton={false}>
        <div class={styles.upgradePanel} style={{ '--class-color': CLASS_COLORS[turret.currentClass] } as JSX.CSSProperties}>
          <div class={styles.modalHeader}>
            <h3 class={styles.modalTitle}>Szczegóły Wieżyczki</h3>
            <button class={styles.closeButton} onClick={handleClose}>×</button>
          </div>

          {/* Turret header */}
          <div class={styles.header}>
            <div class={styles.icon}>{info.icon}</div>
            <div class={styles.info}>
              <h3 class={styles.name}>{info.name}</h3>
              <div class={styles.meta}>
                <span class={styles.class}>{turret.currentClass}</span>
                <span class={styles.role}>{info.role}</span>
              </div>
            </div>
            <div class={styles.tierDisplay}>
              <span class={styles.tierLabel}>Poziom</span>
              <span class={styles.tierValue}>{turret.tier}</span>
            </div>
          </div>

          {/* Tier Upgrade section */}
          {canUpgrade ? (
            <div class={styles.upgradeSection}>
              <h4 class={styles.sectionTitle}>Awans na Poziom {turret.tier + 1}</h4>
              <div class={styles.upgradePreview}>
                <span>+25% Obrażeń</span>
                <span>+15% Sz. Ataku</span>
              </div>
              <div class={styles.cost}>
                <span class={`${styles.costItem} ${gold >= upgradeCost.gold ? '' : styles.insufficient}`}>
                  <span class={styles.costIcon}>💰</span>
                  {upgradeCost.gold}
                </span>
                <span class={`${styles.costItem} ${dust >= upgradeCost.dust ? '' : styles.insufficient}`}>
                  <span class={styles.costIcon}>✨</span>
                  {upgradeCost.dust}
                </span>
              </div>
              <Button
                variant="primary"
                disabled={!canAfford}
                onClick={() => onUpgrade({ type: 'turret', id: turret.slotIndex })}
              >
                {canAfford ? 'Awansuj' : 'Brak zasobów'}
              </Button>
            </div>
          ) : (
            <div class={styles.maxTier}>
              <span>Maksymalny poziom osiągnięty</span>
            </div>
          )}

          {/* Permanent Stat Bonuses */}
          <div class={styles.section}>
            <div class={styles.sectionHeader}>
              <h4 class={styles.sectionTitle}>Wzmocnienia</h4>
              <span class={styles.sectionSubtitle}>permanentne bonusy dla tego typu wieży</span>
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
      </Modal>
    );
  }

  // Fortress panel is now permanently displayed in hub via FortressInfoPanel
  // No modal needed for fortress anymore

  return null;
}
