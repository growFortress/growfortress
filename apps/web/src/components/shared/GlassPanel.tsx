import type { ComponentChildren, JSX } from 'preact';
import styles from './GlassPanel.module.css';

type BlurLevel = 'sm' | 'md' | 'lg';
type GlowColor = 'none' | 'primary' | 'accent' | 'skill';
type ElevationLevel = 0 | 1 | 2 | 3;
type PaddingSize = 'none' | 'sm' | 'md' | 'lg' | 'xl';
type BackgroundVariant = 'default' | 'light' | 'dark';

interface GlassPanelProps {
  /** Panel content */
  children: ComponentChildren;
  /** Blur intensity (default: md) */
  blur?: BlurLevel;
  /** Glow border color (default: none) */
  glow?: GlowColor;
  /** Shadow elevation level (default: 1) */
  elevation?: ElevationLevel;
  /** Internal padding (default: md) */
  padding?: PaddingSize;
  /** Background variant (default: default) */
  background?: BackgroundVariant;
  /** Makes panel interactive with hover effects */
  interactive?: boolean;
  /** Additional CSS class */
  class?: string;
  /** Click handler */
  onClick?: (e: JSX.TargetedMouseEvent<HTMLDivElement>) => void;
  /** Custom style */
  style?: JSX.CSSProperties;
  /** Accessibility role */
  role?: string;
  /** Tab index for keyboard navigation */
  tabIndex?: number;
  /** Aria label */
  'aria-label'?: string;
}

const blurMap: Record<BlurLevel, string> = {
  sm: styles['blur-sm'],
  md: styles['blur-md'],
  lg: styles['blur-lg'],
};

const glowMap: Record<GlowColor, string> = {
  none: '',
  primary: styles['glow-primary'],
  accent: styles['glow-accent'],
  skill: styles['glow-skill'],
};

const elevationMap: Record<ElevationLevel, string> = {
  0: '',
  1: styles['elevation-1'],
  2: styles['elevation-2'],
  3: styles['elevation-3'],
};

const paddingMap: Record<PaddingSize, string> = {
  none: '',
  sm: styles['padding-sm'],
  md: styles['padding-md'],
  lg: styles['padding-lg'],
  xl: styles['padding-xl'],
};

const bgMap: Record<BackgroundVariant, string> = {
  default: '',
  light: styles['bg-light'],
  dark: styles['bg-dark'],
};

export function GlassPanel({
  children,
  blur = 'md',
  glow = 'none',
  elevation = 1,
  padding = 'md',
  background = 'default',
  interactive = false,
  class: className,
  onClick,
  style,
  role,
  tabIndex,
  'aria-label': ariaLabel,
}: GlassPanelProps) {
  const classes = [
    styles.glass,
    blurMap[blur],
    bgMap[background],
    paddingMap[padding],
    // Only apply elevation if no glow (glow includes its own shadow)
    glow === 'none' ? elevationMap[elevation] : glowMap[glow],
    interactive ? styles.interactive : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      class={classes}
      onClick={onClick}
      style={style}
      role={role as JSX.HTMLAttributes<HTMLDivElement>['role']}
      tabIndex={tabIndex}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}

export type { GlassPanelProps, BlurLevel, GlowColor, ElevationLevel, PaddingSize, BackgroundVariant };
