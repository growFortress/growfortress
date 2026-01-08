import type { JSX } from 'preact';
import type { FortressClass } from '@arcade/sim-core';
import { isClassUnlockedAtLevel, getClassUnlockLevel } from '@arcade/sim-core';
import { classSelectionVisible, selectedFortressClass, baseLevel } from '../../state/index.js';
import { Modal } from '../shared/Modal.js';
import styles from './ClassSelectionModal.module.css';

// Class definitions with descriptions and colors (simplified: 5 classes)
const FORTRESS_CLASSES: Array<{
  id: FortressClass;
  name: string;
  description: string;
  bonuses: string[];
  color: string;
  icon: string;
}> = [
  {
    id: 'natural',
    name: 'Natural',
    description: 'Harness the raw power of nature. Balanced offense and defense with regeneration.',
    bonuses: ['+10% DMG', '+15% HP', 'HP Regeneration'],
    color: '#228b22',
    icon: '🌿',
  },
  {
    id: 'ice',
    name: 'Ice',
    description: 'Freeze your enemies with devastating cold. High damage with crowd control.',
    bonuses: ['+20% DMG', '-10% AS', '+25% Crit DMG'],
    color: '#00bfff',
    icon: '❄️',
  },
  {
    id: 'fire',
    name: 'Fire',
    description: 'Burn everything in your path. Pure destruction with splash damage.',
    bonuses: ['+25% DMG', '+10% Crit', '30% Splash'],
    color: '#ff4500',
    icon: '🔥',
  },
  {
    id: 'lightning',
    name: 'Lightning',
    description: 'Strike with the speed of thunder. Fast attacks that chain between enemies.',
    bonuses: ['+40% AS', '+25% Chain Chance', 'Chain Lightning'],
    color: '#9932cc',
    icon: '⚡',
  },
  {
    id: 'tech',
    name: 'Tech',
    description: 'Advanced technology dominates. Pierce through enemies and earn bonus gold.',
    bonuses: ['+2 Pierce', '+15% Crit', '+15% Gold'],
    color: '#00f0ff',
    icon: '🔧',
  },
];

interface ClassSelectionModalProps {
  onSelect: (fortressClass: FortressClass) => void;
}

export function ClassSelectionModal({ onSelect }: ClassSelectionModalProps) {
  const currentLevel = baseLevel.value;

  const handleSelect = (classId: FortressClass) => {
    // Check if class is unlocked
    if (!isClassUnlockedAtLevel(classId, currentLevel)) {
      return;
    }
    selectedFortressClass.value = classId;
    classSelectionVisible.value = false;
    onSelect(classId);
  };

  return (
    <Modal visible={classSelectionVisible.value} class={styles.modal}>
      <div class={styles.container}>
        <h2 class={styles.title}>Wybierz Klasę Twierdzy</h2>
        <p class={styles.subtitle}>
          Wybierz klasę elementalną dla swojej twierdzy. To określi twoje umiejętności i bonusy.
        </p>

        <div class={styles.classGrid}>
          {FORTRESS_CLASSES.map((fc) => {
            const isUnlocked = isClassUnlockedAtLevel(fc.id, currentLevel);
            const requiredLevel = getClassUnlockLevel(fc.id);

            return (
              <button
                key={fc.id}
                class={`${styles.classCard} ${!isUnlocked ? styles.locked : ''}`}
                style={{ '--class-color': fc.color } as JSX.CSSProperties}
                onClick={() => handleSelect(fc.id)}
                disabled={!isUnlocked}
              >
                <div class={styles.classIcon}>{isUnlocked ? fc.icon : '🔒'}</div>
                <div class={styles.className}>{fc.name}</div>
                {isUnlocked ? (
                  <>
                    <div class={styles.classDescription}>{fc.description}</div>
                    <div class={styles.bonusList}>
                      {fc.bonuses.map((bonus, i) => (
                        <span key={i} class={styles.bonus}>{bonus}</span>
                      ))}
                    </div>
                  </>
                ) : (
                  <div class={styles.lockedInfo}>
                    <span class={styles.lockIcon}>🔒</span>
                    <span>Odblokujesz na poziomie {requiredLevel}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
