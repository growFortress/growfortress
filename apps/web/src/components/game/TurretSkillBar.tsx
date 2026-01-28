import type { ActiveTurret, TurretTargetingMode } from '@arcade/sim-core';
import { getTurretById } from '@arcade/sim-core';
import { activeTurrets, gamePhase } from '../../state/index.js';
import { setTurretTargeting, activateOvercharge } from '../../state/gameActions.signals.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import { RailgunIcon, ArtilleryIcon, ArcIcon, CryoIcon } from '../icons/index.js';
import type { ComponentChildren } from 'preact';
import styles from './TurretSkillBar.module.css';

// Turret icon components - using SVG matching game models
function getTurretIcon(turretId: string, size: number = 24): ComponentChildren {
  switch (turretId) {
    case 'railgun':
    case 'arrow': // Legacy
    case 'sniper': // Legacy
      return <RailgunIcon size={size} />;
    case 'artillery':
    case 'cannon': // Legacy
      return <ArtilleryIcon size={size} />;
    case 'arc':
    case 'tesla': // Legacy
      return <ArcIcon size={size} />;
    case 'cryo':
    case 'frost': // Legacy
      return <CryoIcon size={size} />;
    case 'flame':
      return '🔥';
    case 'support':
      return '✨';
    case 'poison':
      return '☠️';
    default:
      return '🗼';
  }
}

// Targeting mode short labels
const TARGETING_LABEL_KEYS: Record<TurretTargetingMode, string> = {
  closest_to_fortress: 'game:turretSkills.targeting.closestToFortress',
  weakest: 'game:turretSkills.targeting.weakest',
  strongest: 'game:turretSkills.targeting.strongest',
  nearest_to_turret: 'game:turretSkills.targeting.nearestToTurret',
  fastest: 'game:turretSkills.targeting.fastest',
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
    <div class={`${styles.container} ${compact ? styles.compact : ''}`} data-tutorial="turret-targeting">
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
  const { t } = useTranslation('game');
  const turretDef = getTurretById(turret.definitionId as 'arrow' | 'cannon' | 'sniper' | 'tesla' | 'frost' | 'flame' | 'support' | 'poison');
  if (!turretDef) return null;

  const turretIcon = getTurretIcon(turret.definitionId, 24);

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
        title={overchargeActive
          ? t('turretSkills.overchargeActive')
          : overchargeReady
            ? t('turretSkills.overchargeReady')
            : t('turretSkills.cooldownSeconds', { seconds: Math.ceil(overchargeCooldown / 30) })}
      >
        {overchargeActive ? (
          <span class={styles.overchargeText}>2x</span>
        ) : overchargeReady ? (
          <span class={styles.overchargeIcon}>🔥</span>
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
        title={t('turretSkills.targetingTitle')}
      >
        {(Object.keys(TARGETING_LABEL_KEYS) as TurretTargetingMode[]).map((mode) => (
          <option key={mode} value={mode}>
            {t(TARGETING_LABEL_KEYS[mode])}
          </option>
        ))}
      </select>
    </div>
  );
}
