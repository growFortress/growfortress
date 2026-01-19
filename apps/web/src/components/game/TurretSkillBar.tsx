import type { ActiveTurret, TurretTargetingMode } from '@arcade/sim-core';
import { getTurretById } from '@arcade/sim-core';
import { activeTurrets, gamePhase } from '../../state/index.js';
import { setTurretTargeting, activateOvercharge } from '../../state/gameActions.signals.js';
import styles from './TurretSkillBar.module.css';

// Turret icons
const TURRET_ICONS: Record<string, string> = {
  arrow: '🏹',
  cannon: '💣',
  sniper: '🎯',
  tesla: '⚡',
  frost: '❄️',
  flame: '🔥',
  support: '✨',
  poison: '☠️',
};

// Targeting mode short labels
const TARGETING_SHORT: Record<TurretTargetingMode, string> = {
  closest_to_fortress: 'Bliż.',
  weakest: 'Słab.',
  strongest: 'Siln.',
  nearest_to_turret: 'Blisk.',
  fastest: 'Szyb.',
};

interface TurretSkillBarProps {
  compact?: boolean;
}

export function TurretSkillBar({ compact = false }: TurretSkillBarProps) {
  const turrets = activeTurrets.value;
  const phase = gamePhase.value;

  // Only show during gameplay
  if (phase === 'idle' || turrets.length === 0) {
    return null;
  }

  return (
    <div class={`${styles.container} ${compact ? styles.compact : ''}`}>
      {!compact && (
        <div class={styles.header}>
          <span class={styles.title}>Wieżyczki</span>
        </div>
      )}
      <div class={styles.turretList}>
        {turrets.map((turret) => (
          <TurretCard key={turret.slotIndex} turret={turret} compact={compact} />
        ))}
      </div>
    </div>
  );
}

interface TurretCardProps {
  turret: ActiveTurret;
  compact?: boolean;
}

function TurretCard({ turret, compact }: TurretCardProps) {
  const turretDef = getTurretById(turret.definitionId as 'arrow' | 'cannon' | 'sniper' | 'tesla' | 'frost' | 'flame' | 'support' | 'poison');
  if (!turretDef) return null;

  const turretIcon = TURRET_ICONS[turret.definitionId] || '🗼';

  // Overcharge state
  const overchargeCooldown = turret.overchargeCooldownTick || 0;
  const overchargeMaxCooldown = 1800; // 60 seconds at 30Hz
  const overchargePercent = overchargeCooldown / overchargeMaxCooldown;
  const overchargeReady = overchargeCooldown === 0;
  const overchargeActive = turret.overchargeActive || false;

  // Current targeting mode
  const targetingMode = turret.targetingMode || 'closest_to_fortress';

  const handleTargetingChange = (e: Event) => {
    const select = e.target as HTMLSelectElement;
    const newMode = select.value as TurretTargetingMode;
    setTurretTargeting(turret.slotIndex, newMode);
  };

  const handleOverchargeClick = () => {
    if (overchargeReady && !overchargeActive) {
      activateOvercharge(turret.slotIndex);
    }
  };

  if (compact) {
    return (
      <div class={styles.compactCard}>
        <span class={styles.compactIcon}>{turretIcon}</span>
      </div>
    );
  }

  return (
    <div class={`${styles.turretCard} ${overchargeActive ? styles.overchargeActiveCard : ''}`}>
      {/* Turret icon */}
      <span class={styles.turretIcon}>{turretIcon}</span>

      {/* Overcharge button */}
      <button
        class={`${styles.overchargeBtn} ${overchargeActive ? styles.active : ''} ${overchargeReady && !overchargeActive ? styles.ready : ''}`}
        onClick={handleOverchargeClick}
        disabled={!overchargeReady || overchargeActive}
        title={overchargeActive ? 'AKTYWNY!' : overchargeReady ? 'Overcharge: 2x DMG przez 5s' : `${Math.ceil(overchargeCooldown / 30)}s`}
      >
        {overchargeActive ? (
          <span class={styles.overchargeText}>2x</span>
        ) : overchargeReady ? (
          <span class={styles.overchargeIcon}>⚡</span>
        ) : (
          <>
            <div class={styles.cooldownBar} style={{ width: `${(1 - overchargePercent) * 100}%` }} />
            <span class={styles.cooldownNum}>{Math.ceil(overchargeCooldown / 30)}</span>
          </>
        )}
      </button>

      {/* Targeting selector */}
      <select
        class={styles.targetSelect}
        value={targetingMode}
        onChange={handleTargetingChange}
        title="Cel wieżyczki"
      >
        {(Object.keys(TARGETING_SHORT) as TurretTargetingMode[]).map((mode) => (
          <option key={mode} value={mode}>
            {TARGETING_SHORT[mode]}
          </option>
        ))}
      </select>
    </div>
  );
}
