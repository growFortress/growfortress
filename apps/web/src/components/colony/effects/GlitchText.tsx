/**
 * GlitchText - RGB split glitch effect for text
 * When active, creates a cyberpunk glitch animation
 */
import { cn } from '../../../utils/cn';
import styles from './effects.module.css';

interface GlitchTextProps {
  children: string;
  active?: boolean;
  className?: string;
}

export function GlitchText({ children, active = false, className }: GlitchTextProps) {
  return (
    <span
      className={cn(styles.glitch, active && styles.active, className)}
      data-text={children}
    >
      {children}
    </span>
  );
}
