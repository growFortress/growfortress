import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import type { ComponentChildren } from 'preact';
import styles from './Celebration.module.css';

// =============================================================================
// Types
// =============================================================================

type CelebrationVariant = 'default' | 'gold' | 'primary' | 'accent';

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  shape: 'square' | 'circle' | 'rect' | 'star';
  duration: number;
  delay: number;
  fallDistance: number;
  drift: number;
  rotation: number;
}

interface Sparkle {
  id: number;
  angle: number;
  distance: number;
  size: number;
  color: string;
  duration: number;
}

interface CelebrationProps {
  /** Trigger the celebration */
  active: boolean;
  /** Variant color scheme */
  variant?: CelebrationVariant;
  /** Show screen flash */
  flash?: boolean;
  /** Show starburst rays */
  starburst?: boolean;
  /** Show confetti */
  confetti?: boolean;
  /** Show sparkle burst */
  sparkles?: boolean;
  /** Show expanding rings */
  rings?: boolean;
  /** Number of confetti pieces */
  confettiCount?: number;
  /** Number of sparkles */
  sparkleCount?: number;
  /** Text to display (e.g., "LEVEL UP!") */
  text?: string;
  /** Duration before auto-cleanup (ms) */
  duration?: number;
  /** Callback when celebration ends */
  onComplete?: () => void;
  /** Center position (default: screen center) */
  position?: { x: number; y: number };
}

export type { CelebrationProps, CelebrationVariant };

// =============================================================================
// Color Palettes
// =============================================================================

const CONFETTI_COLORS = {
  default: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6fff', '#6bffff'],
  gold: ['#ffd700', '#ffec8b', '#daa520', '#f0e68c', '#fff8dc', '#ffa500'],
  primary: ['#00ffff', '#00d4ff', '#00aaff', '#40e0d0', '#7fffd4', '#00ff7f'],
  accent: ['#ff6b6b', '#ff8787', '#ffa8a8', '#ff4757', '#ff6348', '#ff7f50'],
};

// =============================================================================
// Utility Functions
// =============================================================================

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generateConfetti(
  count: number,
  colors: string[],
  startY: number = -50
): ConfettiPiece[] {
  const shapes: ConfettiPiece['shape'][] = ['square', 'circle', 'rect', 'star'];

  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: randomBetween(5, 95),
    y: startY + randomBetween(-20, 20),
    size: randomBetween(8, 16),
    color: randomChoice(colors),
    shape: randomChoice(shapes),
    duration: randomBetween(2.5, 4),
    delay: randomBetween(0, 0.5),
    fallDistance: randomBetween(100, 120),
    drift: randomBetween(-100, 100),
    rotation: randomBetween(360, 1080) * (Math.random() > 0.5 ? 1 : -1),
  }));
}

function generateSparkles(
  count: number,
  colors: string[],
  minDistance: number = 80,
  maxDistance: number = 200
): Sparkle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    angle: (i / count) * Math.PI * 2 + randomBetween(-0.2, 0.2),
    distance: randomBetween(minDistance, maxDistance),
    size: randomBetween(4, 10),
    color: randomChoice(colors),
    duration: randomBetween(0.6, 1.2),
  }));
}

// =============================================================================
// Sub-components
// =============================================================================

function Flash({ variant }: { variant: CelebrationVariant }) {
  const variantClass =
    variant === 'gold'
      ? styles.flashGold
      : variant === 'primary'
        ? styles.flashPrimary
        : variant === 'accent'
          ? styles.flashAccent
          : '';

  return <div class={`${styles.flash} ${variantClass}`} />;
}

function Starburst({ rayCount = 12 }: { rayCount?: number }) {
  return (
    <div class={styles.starburst}>
      {Array.from({ length: rayCount }, (_, i) => (
        <div
          key={i}
          class={styles.ray}
          style={{
            '--ray-angle': `${(i / rayCount) * 360}deg`,
            animationDelay: `${i * 0.02}s`,
          }}
        />
      ))}
    </div>
  );
}

function Confetti({ pieces }: { pieces: ConfettiPiece[] }) {
  const shapeClasses: Record<ConfettiPiece['shape'], string> = {
    square: styles.confettiSquare,
    circle: styles.confettiCircle,
    rect: styles.confettiRect,
    star: styles.confettiStar,
  };

  return (
    <div class={styles.confettiContainer}>
      {pieces.map((piece) => (
        <div
          key={piece.id}
          class={`${styles.confetti} ${shapeClasses[piece.shape]}`}
          style={{
            left: `${piece.x}%`,
            top: `${piece.y}%`,
            '--confetti-size': `${piece.size}px`,
            '--confetti-color': piece.color,
            '--confetti-duration': `${piece.duration}s`,
            '--confetti-delay': `${piece.delay}s`,
            '--confetti-fall-distance': `${piece.fallDistance}vh`,
            '--confetti-drift': `${piece.drift}px`,
            '--confetti-rotation': `${piece.rotation}deg`,
          }}
        />
      ))}
    </div>
  );
}

function Sparkles({
  sparkles,
  position,
}: {
  sparkles: Sparkle[];
  position?: { x: number; y: number };
}) {
  const style = position
    ? { left: `${position.x}px`, top: `${position.y}px` }
    : {};

  return (
    <div class={styles.sparkleContainer} style={style}>
      {sparkles.map((sparkle) => (
        <div
          key={sparkle.id}
          class={styles.sparkle}
          style={{
            '--sparkle-angle': `${sparkle.angle}rad`,
            '--sparkle-distance': `${sparkle.distance}px`,
            '--sparkle-size': `${sparkle.size}px`,
            '--sparkle-color': sparkle.color,
            '--sparkle-duration': `${sparkle.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

function Rings({
  count = 3,
  color,
  position,
}: {
  count?: number;
  color?: string;
  position?: { x: number; y: number };
}) {
  const style = {
    ...(position && { left: `${position.x}px`, top: `${position.y}px` }),
    ...(color && { '--ring-color': color }),
  };

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} class={styles.ring} style={style} />
      ))}
    </>
  );
}

function TextBurst({ text, position }: { text: string; position?: { x: number; y: number } }) {
  const style = position
    ? { left: `${position.x}px`, top: `${position.y}px`, transform: 'translate(-50%, -50%)' }
    : {};

  return (
    <div class={styles.textBurst} style={style}>
      {text}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function Celebration({
  active,
  variant = 'default',
  flash = true,
  starburst = false,
  confetti = true,
  sparkles = true,
  rings = false,
  confettiCount = 50,
  sparkleCount = 20,
  text,
  duration = 3000,
  onComplete,
  position,
}: CelebrationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [confettiPieces, setConfettiPieces] = useState<ConfettiPiece[]>([]);
  const [sparkleParticles, setSparkleParticles] = useState<Sparkle[]>([]);
  const timeoutRef = useRef<number | null>(null);

  const colors = CONFETTI_COLORS[variant];

  // Generate particles when activated
  useEffect(() => {
    if (active) {
      setIsVisible(true);

      if (confetti) {
        setConfettiPieces(generateConfetti(confettiCount, colors));
      }

      if (sparkles) {
        setSparkleParticles(generateSparkles(sparkleCount, colors));
      }

      // Auto cleanup
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        setIsVisible(false);
        setConfettiPieces([]);
        setSparkleParticles([]);
        onComplete?.();
      }, duration);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [active, confetti, sparkles, confettiCount, sparkleCount, colors, duration, onComplete]);

  if (!isVisible) {
    return null;
  }

  const content = (
    <div class={styles.container}>
      {flash && <Flash variant={variant} />}
      {starburst && <Starburst />}
      {rings && <Rings position={position} />}
      {confetti && confettiPieces.length > 0 && <Confetti pieces={confettiPieces} />}
      {sparkles && sparkleParticles.length > 0 && (
        <Sparkles sparkles={sparkleParticles} position={position} />
      )}
      {text && <TextBurst text={text} position={position} />}
    </div>
  );

  return createPortal(content, document.body);
}

// =============================================================================
// Preset Celebrations
// =============================================================================

interface LevelUpCelebrationProps {
  active: boolean;
  level?: number;
  onComplete?: () => void;
}

export function LevelUpCelebration({ active, level, onComplete }: LevelUpCelebrationProps) {
  return (
    <Celebration
      active={active}
      variant="gold"
      flash
      starburst
      confetti
      sparkles
      rings
      confettiCount={80}
      sparkleCount={30}
      text={level ? `LEVEL ${level}!` : 'LEVEL UP!'}
      duration={3500}
      onComplete={onComplete}
    />
  );
}

interface AchievementCelebrationProps {
  active: boolean;
  title?: string;
  onComplete?: () => void;
}

export function AchievementCelebration({
  active,
  title = 'Achievement Unlocked!',
  onComplete,
}: AchievementCelebrationProps) {
  return (
    <Celebration
      active={active}
      variant="primary"
      flash
      sparkles
      confetti
      confettiCount={40}
      sparkleCount={24}
      text={title}
      duration={3000}
      onComplete={onComplete}
    />
  );
}

interface VictoryCelebrationProps {
  active: boolean;
  onComplete?: () => void;
}

export function VictoryCelebration({ active, onComplete }: VictoryCelebrationProps) {
  return (
    <Celebration
      active={active}
      variant="gold"
      flash
      starburst
      confetti
      sparkles
      rings
      confettiCount={100}
      sparkleCount={40}
      text="VICTORY!"
      duration={4000}
      onComplete={onComplete}
    />
  );
}

// =============================================================================
// Hook for programmatic celebrations
// =============================================================================

interface UseCelebrationOptions {
  variant?: CelebrationVariant;
  flash?: boolean;
  starburst?: boolean;
  confetti?: boolean;
  sparkles?: boolean;
  rings?: boolean;
  confettiCount?: number;
  sparkleCount?: number;
  text?: string;
  duration?: number;
  position?: { x: number; y: number };
}

export function useCelebration() {
  const [isActive, setIsActive] = useState(false);
  const [options, setOptions] = useState<UseCelebrationOptions>({});

  const trigger = useCallback((opts: UseCelebrationOptions = {}) => {
    setOptions(opts);
    setIsActive(true);
  }, []);

  const handleComplete = useCallback(() => {
    setIsActive(false);
    setOptions({});
  }, []);

  const CelebrationComponent = useCallback(
    () => (
      <Celebration
        active={isActive}
        variant={options.variant}
        flash={options.flash ?? true}
        starburst={options.starburst}
        confetti={options.confetti ?? true}
        sparkles={options.sparkles ?? true}
        rings={options.rings}
        confettiCount={options.confettiCount}
        sparkleCount={options.sparkleCount}
        text={options.text}
        duration={options.duration}
        position={options.position}
        onComplete={handleComplete}
      />
    ),
    [isActive, options, handleComplete]
  );

  return {
    trigger,
    isActive,
    CelebrationComponent,
  };
}

// =============================================================================
// Achievement Badge Component (for more complex celebrations)
// =============================================================================

interface AchievementBadgeProps {
  visible: boolean;
  icon?: ComponentChildren;
  title: string;
  subtitle?: string;
  onComplete?: () => void;
  duration?: number;
}

export function AchievementBadge({
  visible,
  icon,
  title,
  subtitle,
  onComplete,
  duration = 3000,
}: AchievementBadgeProps) {
  const [isShowing, setIsShowing] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (visible) {
      setIsShowing(true);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        setIsShowing(false);
        onComplete?.();
      }, duration);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [visible, duration, onComplete]);

  if (!isShowing) {
    return null;
  }

  const content = (
    <div class={styles.container}>
      <Flash variant="primary" />
      <div class={styles.badge}>
        {icon && <div class={styles.badgeIcon}>{icon}</div>}
        <div class={styles.badgeTitle}>{title}</div>
        {subtitle && <div class={styles.badgeSubtitle}>{subtitle}</div>}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
