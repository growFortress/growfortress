import type { ModifierSet } from '@arcade/sim-core';
import styles from './ModifierTooltip.module.css';

// Modifier display names and formatting (using actual ModifierSet keys)
const MODIFIER_CONFIG: Record<keyof ModifierSet, { name: string; format: 'percent' | 'flat' | 'count'; positive: boolean }> = {
  // Additive bonuses
  damageBonus: { name: 'Damage', format: 'percent', positive: true },
  attackSpeedBonus: { name: 'Attack Speed', format: 'percent', positive: true },
  cooldownReduction: { name: 'Cooldown', format: 'percent', positive: true },
  goldBonus: { name: 'Gold', format: 'percent', positive: true },
  dustBonus: { name: 'Dust', format: 'percent', positive: true },
  maxHpBonus: { name: 'Max HP', format: 'percent', positive: true },
  eliteDamageBonus: { name: 'Elite Damage', format: 'percent', positive: true },

  // Secondary stats
  splashRadiusBonus: { name: 'Splash Radius', format: 'flat', positive: true },
  splashDamagePercent: { name: 'Splash Damage', format: 'percent', positive: true },
  pierceCount: { name: 'Pierce', format: 'count', positive: true },
  chainChance: { name: 'Chain Chance', format: 'percent', positive: true },
  chainCount: { name: 'Chain Targets', format: 'count', positive: true },
  chainDamagePercent: { name: 'Chain Damage', format: 'percent', positive: true },
  executeThreshold: { name: 'Execute Threshold', format: 'percent', positive: true },
  executeBonusDamage: { name: 'Execute Damage', format: 'percent', positive: true },
  critChance: { name: 'Crit Chance', format: 'percent', positive: true },
  critDamageBonus: { name: 'Crit Damage', format: 'percent', positive: true },

  // Defense
  hpRegen: { name: 'HP Regen', format: 'flat', positive: true },
  incomingDamageReduction: { name: 'Damage Reduction', format: 'percent', positive: true },

  // Physics defense
  massBonus: { name: 'Mass', format: 'percent', positive: true },
  knockbackResistance: { name: 'Knockback Resist', format: 'percent', positive: true },
  ccResistance: { name: 'CC Resist', format: 'percent', positive: true },

  // Luck (meta-rewards)
  dropRateBonus: { name: 'Drop Rate', format: 'percent', positive: true },
  relicQualityBonus: { name: 'Relic Quality', format: 'percent', positive: true },
  goldFindBonus: { name: 'Gold Find', format: 'percent', positive: true },

  // Conditional
  waveDamageBonus: { name: 'Wave Damage', format: 'percent', positive: true },
  lowHpDamageBonus: { name: 'Low HP Damage', format: 'percent', positive: true },
  lowHpThreshold: { name: 'Low HP Threshold', format: 'percent', positive: false },
};

// Priority order for display
const MODIFIER_PRIORITY: (keyof ModifierSet)[] = [
  'damageBonus',
  'critChance',
  'critDamageBonus',
  'attackSpeedBonus',
  'pierceCount',
  'splashDamagePercent',
  'splashRadiusBonus',
  'chainChance',
  'chainCount',
  'chainDamagePercent',
  'executeThreshold',
  'executeBonusDamage',
  'eliteDamageBonus',
  'waveDamageBonus',
  'lowHpDamageBonus',
  'lowHpThreshold',
  'maxHpBonus',
  'hpRegen',
  'incomingDamageReduction',
  'massBonus',
  'knockbackResistance',
  'ccResistance',
  'cooldownReduction',
  'goldBonus',
  'dustBonus',
  'dropRateBonus',
  'relicQualityBonus',
  'goldFindBonus',
];

interface ModifierTooltipProps {
  modifiers: Partial<ModifierSet>;
  title?: string;
  showZero?: boolean;
  compact?: boolean;
}

export function ModifierTooltip({ modifiers, title, showZero = false, compact = false }: ModifierTooltipProps) {
  const entries = MODIFIER_PRIORITY
    .filter(key => {
      const value = modifiers[key];
      if (value === undefined) return false;
      if (!showZero && value === 0) return false;
      return true;
    })
    .map(key => {
      const config = MODIFIER_CONFIG[key];
      const value = modifiers[key] as number;
      return { key, config, value };
    });

  if (entries.length === 0) {
    return null;
  }

  return (
    <div class={`${styles.tooltip} ${compact ? styles.compact : ''}`}>
      {title && <div class={styles.title}>{title}</div>}
      <div class={styles.modifiers}>
        {entries.map(({ key, config, value }) => (
          <div key={key} class={styles.modifier}>
            <span class={styles.modName}>{config.name}</span>
            <span class={`${styles.modValue} ${getValueClass(value, config)}`}>
              {formatValue(value, config)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatValue(value: number, config: { format: 'percent' | 'flat' | 'count'; positive: boolean }): string {
  switch (config.format) {
    case 'percent': {
      // For multipliers (1.0 = 100%), show as percentage change
      if (value >= 0.9 && value <= 1.1) {
        const change = (value - 1) * 100;
        const sign = change >= 0 ? '+' : '';
        return `${sign}${change.toFixed(0)}%`;
      }
      // For chance values (0-1), show as percentage
      if (value >= 0 && value <= 1) {
        return `${(value * 100).toFixed(0)}%`;
      }
      // For larger multipliers
      const pctChange = (value - 1) * 100;
      const sign = pctChange >= 0 ? '+' : '';
      return `${sign}${pctChange.toFixed(0)}%`;
    }
    case 'flat':
      return value >= 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
    case 'count':
      return value >= 0 ? `+${value}` : `${value}`;
    default:
      return String(value);
  }
}

function getValueClass(value: number, config: { positive: boolean }): string {
  // For multipliers, positive > 1 or negative < 1 depending on config
  if (config.positive) {
    if (value > 1 || value > 0) return styles.positive;
    if (value < 1 || value < 0) return styles.negative;
  } else {
    // For cooldown, lower is better
    if (value < 1) return styles.positive;
    if (value > 1) return styles.negative;
  }
  return '';
}

// Simplified stat display component
interface StatDisplayProps {
  label: string;
  value: string | number;
  icon?: string;
  highlight?: boolean;
}

export function StatDisplay({ label, value, icon, highlight = false }: StatDisplayProps) {
  return (
    <div class={`${styles.stat} ${highlight ? styles.highlight : ''}`}>
      {icon && <span class={styles.statIcon}>{icon}</span>}
      <span class={styles.statLabel}>{label}</span>
      <span class={styles.statValue}>{value}</span>
    </div>
  );
}
