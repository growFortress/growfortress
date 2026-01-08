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
} from '../../state/index.js';
import { Modal } from '../shared/Modal.js';
import { Button } from '../shared/Button.js';
import styles from './UpgradeModal.module.css';

// Turret names and info (simplified: 4 turrets)
const TURRET_INFO: Record<string, { name: string; icon: string; role: string }> = {
  arrow: { name: 'Wieża Strzał', icon: '🏹', role: 'Szybkie Obrażenia' },
  cannon: { name: 'Wieża Armatnia', icon: '💣', role: 'Obszarowe' },
  tesla: { name: 'Wieża Tesli', icon: '⚡', role: 'Łańcuchowe' },
  frost: { name: 'Wieża Mrozu', icon: '❄️', role: 'Spowolnienie' },
};

// Upgrade costs
const TURRET_UPGRADE_COSTS = {
  '1_to_2': { gold: 150, dust: 15 },
  '2_to_3': { gold: 400, dust: 50 },
};

// Class colors (simplified: 5 classes)
const CLASS_COLORS: Record<FortressClass, string> = {
  natural: '#228b22',
  ice: '#00bfff',
  fire: '#ff4500',
  lightning: '#9932cc',
  tech: '#00f0ff',
};

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

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
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

    const info = TURRET_INFO[turret.definitionId] || {
      name: turret.definitionId,
      icon: '🗼',
      role: 'Nieznana',
    };

    const canUpgrade = turret.tier < 3;
    const upgradeCost = turret.tier === 1 ? TURRET_UPGRADE_COSTS['1_to_2'] : TURRET_UPGRADE_COSTS['2_to_3'];
    const canAfford = gold >= upgradeCost.gold && dust >= upgradeCost.dust;

    return (
      <Modal visible={visible} class={styles.upgradeModal} onClick={handleBackdropClick}>
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

          {/* Stats */}
          <div class={styles.statsSection}>
            <h4 class={styles.sectionTitle}>Statystyki</h4>
            <div class={styles.statGrid}>
              <div class={styles.stat}>
                <span class={styles.statLabel}>Slot</span>
                <span class={styles.statValue}>#{turret.slotIndex + 1}</span>
              </div>
              <div class={styles.stat}>
                <span class={styles.statLabel}>Klasa</span>
                <span class={styles.statValue}>{turret.currentClass}</span>
              </div>
            </div>
          </div>

          {/* Upgrade section */}
          {canUpgrade ? (
            <div class={styles.upgradeSection}>
              <h4 class={styles.sectionTitle}>Ulepszenie</h4>
              <div class={styles.upgradePreview}>
                <span>+25% OBR</span>
                <span>+15% SA</span>
              </div>
              <div class={styles.cost}>
                <span class={`${styles.costItem} ${gold >= upgradeCost.gold ? '' : styles.insufficient}`}>
                  Złoto: {upgradeCost.gold}
                </span>
                <span class={`${styles.costItem} ${dust >= upgradeCost.dust ? '' : styles.insufficient}`}>
                  Pył: {upgradeCost.dust}
                </span>
              </div>
              <Button
                variant="primary"
                disabled={!canAfford}
                onClick={() => onUpgrade({ type: 'turret', id: turret.slotIndex })}
              >
                {canAfford ? `Ulepsz do poziomu ${turret.tier + 1}` : 'Brak zasobów'}
              </Button>
            </div>
          ) : (
            <div class={styles.maxTier}>
              <span>Maksymalny poziom osiągnięty</span>
            </div>
          )}
        </div>
      </Modal>
    );
  }

  // Fortress panel is now permanently displayed in hub via FortressInfoPanel
  // No modal needed for fortress anymore

  return null;
}
