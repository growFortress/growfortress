import type { FortressClass, TurretType } from '@arcade/sim-core';
import styles from './LoadoutDisplay.module.css';

// Configuration info mapping
const CLASS_INFO: Record<FortressClass, { name: string; icon: string; color: string }> = {
  natural: { name: 'Standardowa', icon: '🌿', color: '#228b22' },
  ice: { name: 'Kriogeniczna', icon: '❄️', color: '#00bfff' },
  fire: { name: 'Termiczna', icon: '🔥', color: '#ff4500' },
  lightning: { name: 'Elektryczna', icon: '⚡', color: '#9932cc' },
  tech: { name: 'Kwantowa', icon: '🔧', color: '#00f0ff' },
  void: { name: 'Próżniowa', icon: '🌀', color: '#4b0082' },
  plasma: { name: 'Plazmowa', icon: '⚛️', color: '#00ffff' },
};

// Unit info mapping
const HERO_INFO: Record<string, { name: string; icon: string; color: string }> = {
  vanguard: { name: 'Unit-0 "Vanguard"', icon: '🛡️', color: '#228b22' },
  storm: { name: 'Unit-7 "Storm"', icon: '⚡', color: '#9932cc' },
  rift: { name: 'Unit-9 "Rift"', icon: '🔮', color: '#ff4500' },
  forge: { name: 'Unit-3 "Forge"', icon: '🤖', color: '#00f0ff' },
  titan: { name: 'Unit-1 "Titan"', icon: '🌀', color: '#4b0082' },
  frost: { name: 'Unit-5 "Frost"', icon: '🏹', color: '#00bfff' },
  spectre: { name: 'Unit-4 "Spectre"', icon: '⚛️', color: '#00ffff' },
  omega: { name: 'Unit-X "Omega"', icon: '⭐', color: '#ffd700' },
  // Legacy IDs
  shield_captain: { name: 'Unit-0 "Vanguard"', icon: '🛡️', color: '#228b22' },
  thunderlord: { name: 'Unit-7 "Storm"', icon: '⚡', color: '#9932cc' },
  scarlet_mage: { name: 'Unit-9 "Rift"', icon: '🔮', color: '#ff4500' },
  iron_sentinel: { name: 'Unit-3 "Forge"', icon: '🤖', color: '#00f0ff' },
  jade_titan: { name: 'Unit-1 "Titan"', icon: '💪', color: '#228b22' },
  spider_sentinel: { name: 'Unit-4 "Spider"', icon: '🕷️', color: '#dc143c' },
  frost_archer: { name: 'Unit-5 "Frost"', icon: '🏹', color: '#00bfff' },
  flame_phoenix: { name: 'Unit-8 "Phoenix"', icon: '🔥', color: '#ff4500' },
  venom_assassin: { name: 'Unit-6 "Venom"', icon: '🗡️', color: '#9acd32' },
  arcane_sorcerer: { name: 'Unit-2 "Arcane"', icon: '🧙', color: '#8a2be2' },
  frost_giant: { name: 'Unit-11 "Glacier"', icon: '❄️', color: '#00bfff' },
  cosmic_guardian: { name: 'Unit-10 "Cosmos"', icon: '🌟', color: '#9932cc' },
};

// Tower info mapping
const TURRET_INFO: Record<TurretType, { name: string; icon: string; color: string }> = {
  railgun: { name: 'Wieża Railgun', icon: '🎯', color: '#4a5568' },
  artillery: { name: 'Wieża Artyleryjska', icon: '💣', color: '#696969' },
  arc: { name: 'Wieża Łukowa', icon: '🔷', color: '#9932cc' },
  cryo: { name: 'Wieża Kriogeniczna', icon: '❄️', color: '#00bfff' },
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
              <span class={styles.itemLabel}>Konfiguracja</span>
              <span class={styles.itemName} style={{ color: classInfo.color }}>{classInfo.name}</span>
            </div>
          </div>
        )}
        {heroInfo && (
          <div class={styles.loadoutItem} style={{ borderColor: heroInfo.color }}>
            <span class={styles.itemIcon}>{heroInfo.icon}</span>
            <div class={styles.itemInfo}>
              <span class={styles.itemLabel}>Jednostka</span>
              <span class={styles.itemName} style={{ color: heroInfo.color }}>{heroInfo.name}</span>
            </div>
          </div>
        )}
        {turretInfo && (
          <div class={styles.loadoutItem} style={{ borderColor: turretInfo.color }}>
            <span class={styles.itemIcon}>{turretInfo.icon}</span>
            <div class={styles.itemInfo}>
              <span class={styles.itemLabel}>Wieża</span>
              <span class={styles.itemName} style={{ color: turretInfo.color }}>{turretInfo.name}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
