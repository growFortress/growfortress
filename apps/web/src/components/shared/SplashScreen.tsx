import { useState, useEffect } from 'preact/hooks';
import styles from './SplashScreen.module.css';

// =============================================================================
// Types
// =============================================================================

export interface SplashScreenProps {
  /** Duration in milliseconds before triggering exit */
  durationMs?: number;
  /** Callback when splash is complete (after exit animation) */
  onComplete?: () => void;
}

// =============================================================================
// SVG Components
// =============================================================================

interface SVGProps {
  class?: string;
}

/** Fortress icon matching the in-game visual */
function FortressIcon({ class: className }: SVGProps) {
  return (
    <svg
      class={className}
      viewBox="0 0 80 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Main fortress body */}
      <rect x="10" y="30" width="60" height="70" fill="#00d9ff" />

      {/* Battlements (top crenellations) */}
      <rect x="10" y="20" width="12" height="15" fill="#00b8d9" />
      <rect x="34" y="20" width="12" height="15" fill="#00b8d9" />
      <rect x="58" y="20" width="12" height="15" fill="#00b8d9" />

      {/* Corner towers */}
      <rect x="5" y="25" width="15" height="20" fill="#0099bb" />
      <rect x="60" y="25" width="15" height="20" fill="#0099bb" />

      {/* Tower tops (pointed) */}
      <polygon points="12.5,10 5,25 20,25" fill="#007799" />
      <polygon points="67.5,10 60,25 75,25" fill="#007799" />

      {/* Gate */}
      <rect x="30" y="65" width="20" height="35" rx="10" fill="#0a0a12" />

      {/* Windows */}
      <rect x="18" y="45" width="8" height="12" rx="4" fill="#0a0a12" />
      <rect x="54" y="45" width="8" height="12" rx="4" fill="#0a0a12" />

      {/* Stone texture lines */}
      <line x1="10" y1="50" x2="70" y2="50" stroke="rgba(0,0,0,0.15)" stroke-width="1" />
      <line x1="10" y1="70" x2="70" y2="70" stroke="rgba(0,0,0,0.15)" stroke-width="1" />

      {/* Border/outline */}
      <rect x="10" y="30" width="60" height="70" stroke="#00a8cc" stroke-width="3" fill="none" />
    </svg>
  );
}

/** Game logo SVG */
function GameLogo({ class: className }: SVGProps) {
  return (
    <svg
      class={className}
      viewBox="0 0 360 50"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="splashLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#00e5ff" />
          <stop offset="50%" stop-color="#00ffcc" />
          <stop offset="100%" stop-color="#00e5ff" />
        </linearGradient>
        <filter id="splashLogoGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* GROW text */}
      <text
        x="70"
        y="32"
        font-family="Orbitron, sans-serif"
        font-size="28"
        font-weight="700"
        fill="url(#splashLogoGradient)"
        filter="url(#splashLogoGlow)"
        text-anchor="middle"
        letter-spacing="4"
      >
        GROW
      </text>

      {/* FORTRESS text */}
      <text
        x="250"
        y="32"
        font-family="Orbitron, sans-serif"
        font-size="28"
        font-weight="700"
        fill="url(#splashLogoGradient)"
        filter="url(#splashLogoGlow)"
        text-anchor="middle"
        letter-spacing="4"
      >
        FORTRESS
      </text>
    </svg>
  );
}

// =============================================================================
// Component
// =============================================================================

export function SplashScreen({
  durationMs = 4000,
  onComplete,
}: SplashScreenProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Start exit animation before duration ends
    const exitDelay = durationMs - 500; // 500ms for exit animation
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, exitDelay);

    // Call onComplete after full duration
    const completeTimer = setTimeout(() => {
      onComplete?.();
    }, durationMs);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [durationMs, onComplete]);

  const containerClass = `${styles.container} ${isExiting ? styles.containerExiting : ''}`;

  return (
    <div class={containerClass}>
      {/* Animated Background */}
      <div class={styles.background}>
        {/* Glow orbs */}
        <div class={styles.glowOrb} />
        <div class={styles.glowOrb} />

        {/* Grid overlay */}
        <div class={styles.gridOverlay} />
      </div>

      {/* Main Content */}
      <div class={styles.content}>
        {/* Logo Section */}
        <div class={styles.logo}>
          <div class={styles.iconContainer}>
            <div class={styles.iconRing} />
            <div class={styles.iconGlow} />
            <FortressIcon class={styles.fortressIcon} />
          </div>
          <GameLogo class={styles.gameLogo} />
          <p class={styles.tagline}>Tower Defense Roguelite</p>
        </div>
      </div>
    </div>
  );
}
