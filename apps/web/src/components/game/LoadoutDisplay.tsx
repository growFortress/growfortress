import type { FortressClass, TurretType } from '@arcade/sim-core';
import styles from './LoadoutDisplay.module.css';

// Class info mapping (simplified: 5 classes)
const CLASS_INFO: Record<FortressClass, { name: string; icon: string; color: string }> = {
  natural: { name: 'Natural', icon: '🌿', color: '#228b22' },
  ice: { name: 'Ice', icon: '❄️', color: '#00bfff' },
  fire: { name: 'Fire', icon: '🔥', color: '#ff4500' },
  lightning: { name: 'Lightning', icon: '⚡', color: '#9932cc' },
  tech: { name: 'Tech', icon: '🔧', color: '#00f0ff' },
};

// Hero info mapping
const HERO_INFO: Record<string, { name: string; icon: string; color: string }> = {
  shield_captain: { name: 'Shield Captain', icon: '🛡️', color: '#1e90ff' },
  thunderlord: { name: 'Thunderlord', icon: '⚡', color: '#ffd700' },
  scarlet_mage: { name: 'Scarlet Mage', icon: '🔮', color: '#dc143c' },
  iron_sentinel: { name: 'Iron Sentinel', icon: '🤖', color: '#ff4500' },
  jade_titan: { name: 'Jade Titan', icon: '💪', color: '#228b22' },
  spider_sentinel: { name: 'Spider Sentinel', icon: '🕷️', color: '#dc143c' },
  frost_archer: { name: 'Frost Archer', icon: '🏹', color: '#00bfff' },
  flame_phoenix: { name: 'Flame Phoenix', icon: '🔥', color: '#ff4500' },
  venom_assassin: { name: 'Venom Assassin', icon: '🗡️', color: '#9acd32' },
  arcane_sorcerer: { name: 'Arcane Sorcerer', icon: '🧙', color: '#8a2be2' },
  frost_giant: { name: 'Frost Giant', icon: '❄️', color: '#00bfff' },
  cosmic_guardian: { name: 'Cosmic Guardian', icon: '🌟', color: '#9932cc' },
};

// Turret info mapping (simplified: 4 turrets)
const TURRET_INFO: Record<TurretType, { name: string; icon: string; color: string }> = {
  arrow: { name: 'Łucznicza', icon: '🏹', color: '#8b4513' },
  cannon: { name: 'Armatnia', icon: '💣', color: '#696969' },
  tesla: { name: 'Tesla', icon: '⚡', color: '#9932cc' },
  frost: { name: 'Mrozu', icon: '❄️', color: '#00bfff' },
};

interface LoadoutDisplayProps {
  fortressClass: FortressClass | null;
  heroId: string | null;
  turretType: TurretType | null;
}

export function LoadoutDisplay({ fortressClass, heroId, turretType }: LoadoutDisplayProps) {
  if (!fortressClass && !heroId && !turretType) {
    return null;
  }

  const classInfo = fortressClass ? CLASS_INFO[fortressClass] : null;
  const heroInfo = heroId ? HERO_INFO[heroId] : null;
  const turretInfo = turretType ? TURRET_INFO[turretType] : null;

  return (
    <div class={styles.loadoutContainer}>
      <div class={styles.loadoutTitle}>Domyślny Loadout</div>
      <div class={styles.loadoutItems}>
        {classInfo && (
          <div class={styles.loadoutItem} style={{ borderColor: classInfo.color }}>
            <span class={styles.itemIcon}>{classInfo.icon}</span>
            <div class={styles.itemInfo}>
              <span class={styles.itemLabel}>Klasa</span>
              <span class={styles.itemName} style={{ color: classInfo.color }}>{classInfo.name}</span>
            </div>
          </div>
        )}
        {heroInfo && (
          <div class={styles.loadoutItem} style={{ borderColor: heroInfo.color }}>
            <span class={styles.itemIcon}>{heroInfo.icon}</span>
            <div class={styles.itemInfo}>
              <span class={styles.itemLabel}>Bohater</span>
              <span class={styles.itemName} style={{ color: heroInfo.color }}>{heroInfo.name}</span>
            </div>
          </div>
        )}
        {turretInfo && (
          <div class={styles.loadoutItem} style={{ borderColor: turretInfo.color }}>
            <span class={styles.itemIcon}>{turretInfo.icon}</span>
            <div class={styles.itemInfo}>
              <span class={styles.itemLabel}>Wieżyczka</span>
              <span class={styles.itemName} style={{ color: turretInfo.color }}>{turretInfo.name}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
