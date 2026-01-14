import { memo, useMemo } from 'preact/compat';
import styles from './ProgressBar.module.css';

type ProgressBarVariant =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'health'
  | 'xp'
  | 'mana'
  | 'energy';

type ProgressBarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface ProgressBarProps {
  /** Current value (0-100) */
  percent: number;
  /** Visual variant */
  variant?: ProgressBarVariant;
  /** Size of the bar */
  size?: ProgressBarSize;
  /** Show label inside the bar */
  label?: string;
  /** Show percentage as label */
  showPercent?: boolean;
  /** Enable pulse animation when full */
  pulseWhenFull?: boolean;
  /** Add glow effect */
  glow?: boolean;
  /** Striped pattern */
  striped?: boolean;
  /** Indeterminate loading state */
  indeterminate?: boolean;
  /** Disable fill animation */
  instant?: boolean;
  /** Additional CSS class for container */
  class?: string;
  /** Additional CSS class for fill */
  fillClass?: string;
  /** Accessible label for screen readers */
  ariaLabel?: string;
}

export type { ProgressBarProps, ProgressBarVariant, ProgressBarSize };

const variantClasses: Record<ProgressBarVariant, string> = {
  primary: styles.variantPrimary,
  secondary: styles.variantSecondary,
  accent: styles.variantAccent,
  success: styles.variantSuccess,
  warning: styles.variantWarning,
  health: styles.variantHealth,
  xp: styles.variantXp,
  mana: styles.variantMana,
  energy: styles.variantEnergy,
};

const sizeClasses: Record<ProgressBarSize, string> = {
  xs: styles.sizeXs,
  sm: styles.sizeSm,
  md: styles.sizeMd,
  lg: styles.sizeLg,
  xl: styles.sizeXl,
};

function ProgressBarComponent({
  percent,
  variant = 'primary',
  size = 'md',
  label,
  showPercent = false,
  pulseWhenFull = true,
  glow = false,
  striped = false,
  indeterminate = false,
  instant = false,
  class: className,
  fillClass,
  ariaLabel,
}: ProgressBarProps) {
  const normalizedPercent = Math.min(100, Math.max(0, percent));
  const isFull = normalizedPercent >= 100;

  // For health variant, adjust background position based on value
  const healthStyle = useMemo(() => {
    if (variant === 'health') {
      // Background position: 100% = red (0%), 0% = green (100%)
      const bgPosition = 100 - normalizedPercent;
      return { backgroundPosition: `${bgPosition}% 0` };
    }
    return undefined;
  }, [variant, normalizedPercent]);

  const containerClasses = [
    styles.container,
    sizeClasses[size],
    striped && styles.striped,
    indeterminate && styles.indeterminate,
    className,
  ].filter(Boolean).join(' ');

  const fillClasses = [
    styles.fill,
    variantClasses[variant],
    instant ? styles.instant : styles.animated,
    pulseWhenFull && isFull && !indeterminate && styles.full,
    glow && styles.glow,
    fillClass,
  ].filter(Boolean).join(' ');

  const displayLabel = showPercent
    ? `${Math.round(normalizedPercent)}%`
    : label;

  return (
    <div
      class={containerClasses}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : normalizedPercent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel || label || 'Progress'}
      aria-busy={indeterminate}
    >
      <div
        class={fillClasses}
        style={{
          width: indeterminate ? undefined : `${normalizedPercent}%`,
          ...healthStyle,
        }}
      />
      {displayLabel && (
        <span class={styles.label} aria-hidden="true">
          {displayLabel}
        </span>
      )}
    </div>
  );
}

// Memoize to prevent unnecessary re-renders when parent updates
export const ProgressBar = memo(ProgressBarComponent);

/**
 * Segmented progress bar variant.
 * Useful for showing discrete steps or levels.
 */
interface SegmentedProgressBarProps {
  /** Total number of segments */
  segments: number;
  /** Number of filled segments (0 to segments) */
  filled: number;
  /** Visual variant */
  variant?: ProgressBarVariant;
  /** Size of the bar */
  size?: ProgressBarSize;
  /** Additional CSS class */
  class?: string;
  /** Accessible label */
  ariaLabel?: string;
}

export type { SegmentedProgressBarProps };

function SegmentedProgressBarComponent({
  segments,
  filled,
  variant = 'primary',
  size = 'md',
  class: className,
  ariaLabel,
}: SegmentedProgressBarProps) {
  const normalizedFilled = Math.min(segments, Math.max(0, filled));
  const percent = (normalizedFilled / segments) * 100;

  const containerClasses = [
    styles.segmented,
    sizeClasses[size],
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      class={containerClasses}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel || `${normalizedFilled} of ${segments}`}
    >
      {Array.from({ length: segments }, (_, i) => (
        <div key={i} class={styles.segment}>
          <div
            class={[
              styles.segmentFill,
              variantClasses[variant],
              i < normalizedFilled && styles.active,
            ].filter(Boolean).join(' ')}
          />
        </div>
      ))}
    </div>
  );
}

export const SegmentedProgressBar = memo(SegmentedProgressBarComponent);
