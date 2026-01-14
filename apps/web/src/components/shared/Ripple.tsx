import { useRef, useCallback } from 'preact/hooks';
import { createElement } from 'preact';
import type { JSX } from 'preact';
import styles from './Ripple.module.css';

interface RippleInstance {
  id: number;
  x: number;
  y: number;
  size: number;
}

interface UseRippleOptions {
  /** Color of the ripple (default: currentColor with 30% opacity) */
  color?: string;
  /** Duration of ripple animation in ms (default: 600) */
  duration?: number;
  /** Whether ripple is disabled */
  disabled?: boolean;
}

/**
 * Hook for managing ripple effects on interactive elements.
 *
 * Usage:
 * ```tsx
 * function Button({ children, onClick }) {
 *   const { containerRef, ripples, createRipple } = useRipple();
 *
 *   return (
 *     <button
 *       ref={containerRef}
 *       onClick={(e) => {
 *         createRipple(e);
 *         onClick?.(e);
 *       }}
 *       style={{ position: 'relative', overflow: 'hidden' }}
 *     >
 *       {children}
 *       <RippleContainer ripples={ripples} />
 *     </button>
 *   );
 * }
 * ```
 */
export function useRipple(options: UseRippleOptions = {}) {
  const { color = 'var(--color-primary-30)', duration = 600, disabled = false } = options;

  const containerRef = useRef<HTMLElement>(null);
  const ripplesRef = useRef<RippleInstance[]>([]);
  const nextIdRef = useRef(0);
  const forceUpdateRef = useRef<() => void>(() => {});

  // Force re-render helper
  const setForceUpdate = useCallback((fn: () => void) => {
    forceUpdateRef.current = fn;
  }, []);

  const createRipple = useCallback(
    (event: JSX.TargetedMouseEvent<HTMLElement> | JSX.TargetedTouchEvent<HTMLElement>) => {
      if (disabled || !containerRef.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();

      // Get click/touch position
      let clientX: number;
      let clientY: number;

      if ('touches' in event && event.touches.length > 0) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
      } else if ('clientX' in event) {
        clientX = event.clientX;
        clientY = event.clientY;
      } else {
        return;
      }

      const x = clientX - rect.left;
      const y = clientY - rect.top;

      // Calculate ripple size to cover the entire element
      const size = Math.max(rect.width, rect.height) * 2;

      const ripple: RippleInstance = {
        id: nextIdRef.current++,
        x: x - size / 2,
        y: y - size / 2,
        size,
      };

      ripplesRef.current = [...ripplesRef.current, ripple];
      forceUpdateRef.current();

      // Remove ripple after animation
      setTimeout(() => {
        ripplesRef.current = ripplesRef.current.filter((r) => r.id !== ripple.id);
        forceUpdateRef.current();
      }, duration);
    },
    [disabled, duration]
  );

  return {
    containerRef,
    ripples: ripplesRef.current,
    createRipple,
    color,
    setForceUpdate,
  };
}

interface RippleContainerProps {
  /** Array of active ripples */
  ripples: RippleInstance[];
  /** Ripple color */
  color?: string;
}

/**
 * Container component that renders ripple effects.
 * Must be placed inside an element with position: relative and overflow: hidden.
 */
export function RippleContainer({ ripples, color = 'var(--color-primary-30)' }: RippleContainerProps) {
  if (ripples.length === 0) return null;

  return (
    <div class={styles.rippleContainer} aria-hidden="true">
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          class={styles.ripple}
          style={{
            left: `${ripple.x}px`,
            top: `${ripple.y}px`,
            width: `${ripple.size}px`,
            height: `${ripple.size}px`,
            backgroundColor: color,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Standalone Ripple component that can be used as a wrapper.
 * Automatically handles click events and positioning.
 */
interface RippleProps {
  /** Content to wrap */
  children: JSX.Element;
  /** Ripple color */
  color?: string;
  /** Whether ripple is disabled */
  disabled?: boolean;
}

export function Ripple({ children, color, disabled }: RippleProps) {
  const { containerRef, ripples, createRipple, color: defaultColor } = useRipple({
    color,
    disabled,
  });

  // Clone child element with ref and click handler
  const child = children;

  if (!child || typeof child !== 'object') {
    return children;
  }

  // Add ripple trigger to existing onClick
  const originalOnClick = child.props?.onClick;
  const originalOnTouchStart = child.props?.onTouchStart;

  const handleClick = (e: JSX.TargetedMouseEvent<HTMLElement>) => {
    createRipple(e);
    originalOnClick?.(e);
  };

  const handleTouchStart = (e: JSX.TargetedTouchEvent<HTMLElement>) => {
    createRipple(e);
    originalOnTouchStart?.(e);
  };

  return createElement(
    child.type,
    {
      ...child.props,
      ref: containerRef,
      onClick: handleClick,
      onTouchStart: handleTouchStart,
      style: {
        ...(child.props?.style || {}),
        position: 'relative',
        overflow: 'hidden',
      },
    },
    child.props?.children,
    <RippleContainer ripples={ripples} color={color || defaultColor} />
  );
}

export type { RippleInstance, UseRippleOptions, RippleContainerProps, RippleProps };
