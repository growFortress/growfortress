import { getMaterialById } from '@arcade/sim-core';
import { recentDrops } from '../../state/materials.signals.js';
import styles from './MaterialDrop.module.css';

// Rarity colors
const RARITY_COLORS: Record<string, string> = {
  common: '#808080',
  uncommon: '#00ff00',
  rare: '#0088ff',
  epic: '#9932cc',
  legendary: '#ffd700',
};

// Material icons (emoji fallbacks)
const MATERIAL_ICONS: Record<string, string> = {
  adamantium: '🔩',
  vibranium: '💎',
  uru: '⚒️',
  darkforce: '🌑',
  cosmic_dust: '✨',
  mutant_dna: '🧬',
  pym_particles: '⚛️',
  extremis: '🧪',
  super_soldier_serum: '💉',
};

export function MaterialDrop() {
  const drops = recentDrops.value;

  if (drops.length === 0) {
    return null;
  }

  return (
    <div class={styles.container}>
      {drops.map((drop, index) => {
        const material = getMaterialById(drop.materialId);
        if (!material) return null;

        const color = RARITY_COLORS[material.rarity] || '#808080';
        const icon = MATERIAL_ICONS[drop.materialId] || '📦';

        return (
          <div
            key={`${drop.materialId}-${drop.timestamp}-${index}`}
            class={styles.dropNotification}
            style={{ '--rarity-color': color } as Record<string, string>}
          >
            <span class={styles.icon}>{icon}</span>
            <span class={styles.info}>
              <span class={styles.name}>{material.polishName}</span>
              <span class={styles.amount}>+{drop.amount}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
