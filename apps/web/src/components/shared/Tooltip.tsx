import type { ComponentChildren, JSX } from 'preact';
import { useState, useRef, useCallback, useEffect, useId } from 'preact/hooks';
import styles from './Tooltip.module.css';

type TooltipPosition =
  | 'top'
  | 'topStart'
  | 'topEnd'
  | 'bottom'
  | 'bottomStart'
  | 'bottomEnd'
  | 'left'
  | 'right';

type TooltipVariant = 'default' | 'info' | 'warning' | 'error' | 'success';
type TooltipSize = 'sm' | 'md' | 'lg';

interface TooltipProps {
  /** Tooltip content */
  content: ComponentChildren;
  /** Element to wrap with tooltip trigger */
  children: ComponentChildren;
  /** Tooltip position relative to trigger */
  position?: TooltipPosition;
  /** Visual variant */
  variant?: TooltipVariant;
  /** Size variant */
  size?: TooltipSize;
  /** Optional title (bold, above content) */
  title?: string;
  /** Keyboard shortcut to display */
  shortcut?: string;
  /** Delay before showing (ms) */
  delay?: number;
  /** Hide arrow */
  noArrow?: boolean;
  /** Allow multiline content */
  multiline?: boolean;
  /** Allow interaction with tooltip content */
  interactive?: boolean;
  /** Disable tooltip entirely */
  disabled?: boolean;
  /** Additional class for tooltip */
  class?: string;
  /** Touch hold duration (ms) - default 500 */
  touchHoldDuration?: number;
}

export type { TooltipProps, TooltipPosition, TooltipVariant, TooltipSize };

const positionClasses: Record<TooltipPosition, string> = {
  top: styles.top,
  topStart: styles.topStart,
  topEnd: styles.topEnd,
  bottom: styles.bottom,
  bottomStart: styles.bottomStart,
  bottomEnd: styles.bottomEnd,
  left: styles.left,
  right: styles.right,
};

const variantClasses: Record<TooltipVariant, string> = {
  default: '',
  info: styles.variantInfo,
  warning: styles.variantWarning,
  error: styles.variantError,
  success: styles.variantSuccess,
};

const sizeClasses: Record<TooltipSize, string> = {
  sm: styles.sizeSm,
  md: '',
  lg: styles.sizeLg,
};

export function Tooltip({
  content,
  children,
  position = 'top',
  variant = 'default',
  size = 'md',
  title,
  shortcut,
  delay = 200,
  noArrow = false,
  multiline = false,
  interactive = false,
  disabled = false,
  class: className,
  touchHoldDuration = 500,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const tooltipId = useId();

  // Refs for timing
  const showTimeoutRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);
  const touchTimeoutRef = useRef<number | null>(null);
  const isTouchingRef = useRef(false);

  // Clear all timeouts
  const clearTimeouts = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    if (touchTimeoutRef.current) {
      clearTimeout(touchTimeoutRef.current);
      touchTimeoutRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimeouts();
  }, [clearTimeouts]);

  // Show tooltip with optional delay
  const show = useCallback(() => {
    if (disabled) return;

    clearTimeouts();

    if (delay > 0) {
      showTimeoutRef.current = window.setTimeout(() => {
        setIsExiting(false);
        setVisible(true);
      }, delay);
    } else {
      setIsExiting(false);
      setVisible(true);
    }
  }, [disabled, delay, clearTimeouts]);

  // Hide tooltip with exit animation
  const hide = useCallback(() => {
    clearTimeouts();

    if (visible) {
      setIsExiting(true);
      hideTimeoutRef.current = window.setTimeout(() => {
        setVisible(false);
        setIsExiting(false);
      }, 150); // Match exit animation duration
    }
  }, [visible, clearTimeouts]);

  // Mouse handlers
  const handleMouseEnter = useCallback(() => {
    if (!isTouchingRef.current) {
      show();
    }
  }, [show]);

  const handleMouseLeave = useCallback(() => {
    if (!isTouchingRef.current) {
      hide();
    }
  }, [hide]);

  // Touch handlers (long-press to show)
  const handleTouchStart = useCallback((e: JSX.TargetedTouchEvent<HTMLSpanElement>) => {
    if (disabled) return;

    isTouchingRef.current = true;
    clearTimeouts();

    touchTimeoutRef.current = window.setTimeout(() => {
      // Prevent click after long press
      e.preventDefault();
      setIsExiting(false);
      setVisible(true);
    }, touchHoldDuration);
  }, [disabled, touchHoldDuration, clearTimeouts]);

  const handleTouchEnd = useCallback(() => {
    clearTimeouts();
    isTouchingRef.current = false;

    // Hide after a brief delay on touch end
    if (visible) {
      hideTimeoutRef.current = window.setTimeout(() => {
        hide();
      }, 1500); // Keep visible for 1.5s after touch release
    }
  }, [visible, hide, clearTimeouts]);

  const handleTouchMove = useCallback(() => {
    // Cancel if user moves finger
    clearTimeouts();
    isTouchingRef.current = false;
  }, [clearTimeouts]);

  // Focus handlers
  const handleFocus = useCallback(() => {
    if (!isTouchingRef.current) {
      show();
    }
  }, [show]);

  const handleBlur = useCallback(() => {
    hide();
  }, [hide]);

  // Keyboard handler
  const handleKeyDown = useCallback((e: JSX.TargetedKeyboardEvent<HTMLSpanElement>) => {
    if (e.key === 'Escape' && visible) {
      e.preventDefault();
      hide();
    }
  }, [visible, hide]);

  // Build tooltip classes
  const tooltipClasses = [
    styles.tooltip,
    positionClasses[position],
    variantClasses[variant],
    sizeClasses[size],
    noArrow && styles.noArrow,
    multiline && styles.multiline,
    interactive && styles.tooltipInteractive,
    isExiting && styles.exiting,
    className,
  ].filter(Boolean).join(' ');

  const wrapperClasses = [
    styles.wrapper,
    interactive && styles.wrapperInteractive,
  ].filter(Boolean).join(' ');

  return (
    <span
      class={wrapperClasses}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-describedby={visible ? tooltipId : undefined}
    >
      {children}
      {visible && (
        <span
          id={tooltipId}
          class={tooltipClasses}
          role="tooltip"
          aria-live="polite"
        >
          {title && <span class={styles.title}>{title}</span>}
          {content}
          {shortcut && <span class={styles.shortcut}>{shortcut}</span>}
          <span class={styles.touchHint}>Przytrzymaj aby zobaczyc</span>
        </span>
      )}
    </span>
  );
}

/**
 * Simple tooltip wrapper for quick usage.
 * Just wraps children with a basic tooltip.
 */
interface SimpleTooltipProps {
  text: string;
  children: ComponentChildren;
  position?: TooltipPosition;
}

export function SimpleTooltip({ text, children, position = 'top' }: SimpleTooltipProps) {
  return (
    <Tooltip content={text} position={position}>
      {children}
    </Tooltip>
  );
}
