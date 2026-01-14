import { useEffect, useState, useCallback, useMemo } from 'preact/hooks';
import type { JSX } from 'preact';

interface StaggeredEntranceOptions {
  /** Delay between each item in ms (default: 40) */
  delayPerItem?: number;
  /** Duration of each item's animation in ms (default: 400) */
  duration?: number;
  /** Initial delay before first item appears in ms (default: 0) */
  initialDelay?: number;
  /** Easing function name (default: 'ease-spring') */
  easing?: string;
  /** Whether to trigger entrance automatically on mount (default: true) */
  autoTrigger?: boolean;
  /** Direction of stagger: 'forward' | 'reverse' | 'center' (default: 'forward') */
  direction?: 'forward' | 'reverse' | 'center';
}

interface StaggeredItemStyle extends JSX.CSSProperties {
  opacity: number;
  transform: string;
  transition: string;
}

interface UseStaggeredEntranceReturn {
  /** Get style object for an item at given index */
  getItemStyle: (index: number) => StaggeredItemStyle;
  /** Whether all items have finished animating in */
  isComplete: boolean;
  /** Manually trigger the entrance animation */
  triggerEntrance: () => void;
  /** Reset to initial hidden state */
  reset: () => void;
}

/**
 * Hook for creating staggered entrance animations for lists and grids.
 *
 * Usage:
 * ```tsx
 * function ItemList({ items }) {
 *   const { getItemStyle, isComplete } = useStaggeredEntrance(items.length);
 *
 *   return (
 *     <ul>
 *       {items.map((item, index) => (
 *         <li key={item.id} style={getItemStyle(index)}>
 *           {item.name}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useStaggeredEntrance(
  itemCount: number,
  options: StaggeredEntranceOptions = {}
): UseStaggeredEntranceReturn {
  const {
    delayPerItem = 40,
    duration = 400,
    initialDelay = 0,
    easing = 'var(--ease-spring)',
    autoTrigger = true,
    direction = 'forward',
  } = options;

  const [isTriggered, setIsTriggered] = useState(autoTrigger);
  const [visibleCount, setVisibleCount] = useState(autoTrigger ? 0 : -1);

  // Calculate delays based on direction
  const getDelay = useCallback(
    (index: number): number => {
      let adjustedIndex: number;

      switch (direction) {
        case 'reverse':
          adjustedIndex = itemCount - 1 - index;
          break;
        case 'center': {
          const center = (itemCount - 1) / 2;
          adjustedIndex = Math.abs(index - center);
          break;
        }
        default:
          adjustedIndex = index;
      }

      return initialDelay + adjustedIndex * delayPerItem;
    },
    [itemCount, direction, initialDelay, delayPerItem]
  );

  // Trigger animation sequence
  useEffect(() => {
    if (!isTriggered || itemCount === 0) return;

    // Start from 0 and animate all items
    setVisibleCount(0);

    // Calculate total animation time
    const totalTime = initialDelay + (itemCount - 1) * delayPerItem + duration;

    // Set visible count to all after total time
    const timer = setTimeout(() => {
      setVisibleCount(itemCount);
    }, totalTime);

    return () => clearTimeout(timer);
  }, [isTriggered, itemCount, initialDelay, delayPerItem, duration]);

  const getItemStyle = useCallback(
    (index: number): StaggeredItemStyle => {
      if (!isTriggered || visibleCount === -1) {
        // Hidden state (before trigger)
        return {
          opacity: 0,
          transform: 'translateY(20px) scale(0.95)',
          transition: 'none',
        };
      }

      const delay = getDelay(index);

      // Animating or complete
      return {
        opacity: 1,
        transform: 'translateY(0) scale(1)',
        transition: `opacity ${duration}ms ${easing} ${delay}ms, transform ${duration}ms ${easing} ${delay}ms`,
      };
    },
    [isTriggered, visibleCount, getDelay, duration, easing]
  );

  const isComplete = useMemo(() => {
    return visibleCount >= itemCount;
  }, [visibleCount, itemCount]);

  const triggerEntrance = useCallback(() => {
    setVisibleCount(-1);
    // Small delay to ensure CSS resets
    requestAnimationFrame(() => {
      setIsTriggered(true);
      setVisibleCount(0);
    });
  }, []);

  const reset = useCallback(() => {
    setIsTriggered(false);
    setVisibleCount(-1);
  }, []);

  return {
    getItemStyle,
    isComplete,
    triggerEntrance,
    reset,
  };
}

/**
 * Simplified hook for basic fade-in stagger
 */
export function useSimpleStagger(
  _itemCount: number,
  options: { delay?: number; duration?: number } = {}
): (index: number) => JSX.CSSProperties {
  const { delay = 50, duration = 300 } = options;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  return useCallback(
    (index: number): JSX.CSSProperties => ({
      opacity: mounted ? 1 : 0,
      transform: mounted ? 'translateY(0)' : 'translateY(10px)',
      transition: `opacity ${duration}ms ease-out ${index * delay}ms, transform ${duration}ms ease-out ${index * delay}ms`,
    }),
    [mounted, delay, duration]
  );
}

export type { StaggeredEntranceOptions, StaggeredItemStyle, UseStaggeredEntranceReturn };
