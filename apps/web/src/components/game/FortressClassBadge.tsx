import type { JSX } from 'preact';
import type { FortressClass } from '@arcade/sim-core';
import { selectedFortressClass } from '../../state/index.js';
import styles from './FortressClassBadge.module.css';

// Class configuration (6 classes)
const CLASS_CONFIG: Record<FortressClass, { color: string; icon: string; bonuses: string[] }> = {
  natural: {
    color: '#228b22',
    icon: '🌿',
    bonuses: ['+10% DMG', '+15% HP', 'HP Regen'],
  },
  ice: {
    color: '#00bfff',
    icon: '❄️',
    bonuses: ['+20% DMG', '+25% Crit DMG'],
  },
  fire: {
    color: '#ff4500',
    icon: '🔥',
    bonuses: ['+25% DMG', '+10% Crit', '30% Splash'],
  },
  lightning: {
    color: '#9932cc',
    icon: '⚡',
    bonuses: ['+40% AS', '+25% Chain'],
  },
  tech: {
    color: '#00f0ff',
    icon: '🔧',
    bonuses: ['+2 Pierce', '+15% Gold'],
  },
  void: {
    color: '#4b0082',
    icon: '🌀',
    bonuses: ['+15% DMG', '+10% HP', '+10% CDR'],
  },
  plasma: { color: '#00ffff', icon: '⚛️', bonuses: ['+15% Crit', '+10% AS'] },
};

interface FortressClassBadgeProps {
  showBonuses?: boolean;
}

export function FortressClassBadge({ showBonuses = true }: FortressClassBadgeProps) {
  const fortressClass = selectedFortressClass.value;

  if (!fortressClass) return null;

  const config = CLASS_CONFIG[fortressClass];

  return (
    <div
      class={styles.badge}
      style={{ '--class-color': config.color } as JSX.CSSProperties}
    >
      <div class={styles.header}>
        <span class={styles.icon}>{config.icon}</span>
        <span class={styles.name}>{fortressClass}</span>
      </div>
      {showBonuses && (
        <div class={styles.bonuses}>
          {config.bonuses.map((bonus, i) => (
            <span key={i} class={styles.bonus}>{bonus}</span>
          ))}
        </div>
      )}
    </div>
  );
}
