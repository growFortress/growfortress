import { useState, useEffect, useCallback } from 'preact/hooks';
import { useTranslation } from '../../i18n/useTranslation.js';
import styles from './LoadingScreen.module.css';

// =============================================================================
// Types
// =============================================================================

export interface LoadingScreenProps {
  /** Loading message to display */
  message?: string;
  /** Progress percentage (0-100). If undefined, shows indeterminate progress */
  progress?: number;
  /** Error message if loading failed */
  error?: string;
  /** Callback when retry button is clicked */
  onRetry?: () => void;
  /** Version string to display */
  version?: string;
  /** Whether loading is complete (triggers exit animation) */
  isComplete?: boolean;
  /** Callback when exit animation finishes */
  onExitComplete?: () => void;
}

// =============================================================================
// SVG Components
// =============================================================================

interface SVGProps {
  class?: string;
}

/** Fortress icon matching the in-game Tier 1-2 visual */
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
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#00e5ff" />
          <stop offset="50%" stop-color="#00ffcc" />
          <stop offset="100%" stop-color="#00e5ff" />
        </linearGradient>
        <filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
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
        fill="url(#logoGradient)"
        filter="url(#logoGlow)"
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
        fill="url(#logoGradient)"
        filter="url(#logoGlow)"
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

export function LoadingScreen({
  message,
  progress,
  error,
  onRetry,
  version,
  isComplete = false,
  onExitComplete,
}: LoadingScreenProps) {
  const { t } = useTranslation();
  const [isExiting, setIsExiting] = useState(false);
  
  const displayMessage = message ?? t('shared.loading');

  // Handle exit animation
  useEffect(() => {
    if (isComplete && !isExiting) {
      setIsExiting(true);
      const timer = setTimeout(() => {
        onExitComplete?.();
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isComplete, isExiting, onExitComplete]);

  const containerClass = `${styles.container} ${isExiting ? styles.containerExiting : ''}`;

  const isIndeterminate = progress === undefined;
  const displayProgress = Math.min(100, Math.max(0, progress ?? 0));

  return (
    <div class={containerClass}>
      {/* Animated Background */}
      <div class={styles.background}>
        {/* Glow orbs */}
        <div class={styles.glowOrb} />
        <div class={styles.glowOrb} />

        {/* Grid overlay */}
        <div class={styles.gridOverlay} />

        {/* Floating particles */}
        <div class={styles.particles}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} class={styles.particle} />
          ))}
        </div>
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
        </div>

        {/* Progress Section */}
        <div class={styles.progressSection}>
          {error ? (
            <div class={styles.error}>
              <p class={styles.errorMessage}>{error}</p>
              {onRetry && (
                <button class={styles.retryButton} onClick={onRetry}>
                  {t('shared.retry')}
                </button>
              )}
            </div>
          ) : (
            <>
              <div class={styles.progressContainer}>
                <div
                  class={`${styles.progressBar} ${isIndeterminate ? styles.progressIndeterminate : ''}`}
                  style={isIndeterminate ? undefined : { width: `${displayProgress}%` }}
                />
              </div>
              <div class={styles.progressText}>
                <span class={styles.message}>{displayMessage}</span>
                {!isIndeterminate && (
                  <span class={styles.progressPercent}>{Math.round(displayProgress)}%</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Version Badge */}
      {version && <span class={styles.versionBadge}>v{version}</span>}
    </div>
  );
}

// =============================================================================
// Hook for managing loading state
// =============================================================================

interface LoadingState {
  isLoading: boolean;
  progress: number;
  message: string;
  error: string | null;
}

interface UseLoadingReturn {
  state: LoadingState;
  setProgress: (progress: number, message?: string) => void;
  setError: (error: string) => void;
  complete: () => void;
  reset: () => void;
}

/**
 * Hook for managing loading screen state
 */
export function useLoading(initialMessage = 'Ładowanie...'): UseLoadingReturn {
  const [state, setState] = useState<LoadingState>({
    isLoading: true,
    progress: 0,
    message: initialMessage,
    error: null,
  });

  const setProgress = useCallback((progress: number, message?: string) => {
    setState((prev) => ({
      ...prev,
      progress: Math.min(100, Math.max(0, progress)),
      message: message ?? prev.message,
      error: null,
    }));
  }, []);

  const setError = useCallback((error: string) => {
    setState((prev) => ({
      ...prev,
      error,
    }));
  }, []);

  const complete = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isLoading: false,
      progress: 100,
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      isLoading: true,
      progress: 0,
      message: initialMessage,
      error: null,
    });
  }, [initialMessage]);

  return { state, setProgress, setError, complete, reset };
}
