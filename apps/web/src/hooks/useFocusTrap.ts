import { useEffect, useRef } from 'preact/hooks';
import type { RefObject } from 'preact';

/**
 * Custom hook to trap focus within a container element.
 * Essential for modal dialogs to ensure keyboard users can't tab outside.
 *
 * @param isActive - Whether the focus trap is active
 * @param options - Configuration options
 * @returns RefObject to attach to the container element
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  isActive: boolean,
  options: {
    /** Element to focus when trap activates. Defaults to first focusable. */
    initialFocus?: RefObject<HTMLElement>;
    /** Element to return focus to when trap deactivates */
    returnFocus?: RefObject<HTMLElement>;
    /** Callback when Escape key is pressed */
    onEscape?: () => void;
  } = {}
): RefObject<T> {
  const containerRef = useRef<T>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const hasInitialFocusRef = useRef(false);
  const onEscapeRef = useRef(options.onEscape);

  // Keep onEscape ref updated without causing effect re-runs
  onEscapeRef.current = options.onEscape;

  useEffect(() => {
    if (!isActive || !containerRef.current) {
      // Reset initial focus flag when trap becomes inactive
      hasInitialFocusRef.current = false;
      return;
    }

    // Store the currently focused element to restore later (only on first activation)
    if (!hasInitialFocusRef.current) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    }

    const container = containerRef.current;

    // Find all focusable elements within the container
    const getFocusableElements = (): HTMLElement[] => {
      const focusableSelectors = [
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        'a[href]',
        '[tabindex]:not([tabindex="-1"])',
      ].join(', ');

      return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors))
        .filter(el => el.offsetParent !== null); // Filter out hidden elements
    };

    // Focus initial element (only on first activation, not on re-renders)
    if (!hasInitialFocusRef.current) {
      const focusInitial = () => {
        if (options.initialFocus?.current) {
          options.initialFocus.current.focus();
        } else {
          const focusable = getFocusableElements();
          if (focusable.length > 0) {
            focusable[0].focus();
          } else {
            // If no focusable elements, make container focusable and focus it
            container.setAttribute('tabindex', '-1');
            container.focus();
          }
        }
      };

      // Small delay to ensure DOM is ready
      requestAnimationFrame(focusInitial);
      hasInitialFocusRef.current = true;
    }

    // Handle keyboard navigation
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onEscapeRef.current) {
        event.preventDefault();
        onEscapeRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];
      const activeElement = document.activeElement;

      // Shift+Tab on first element -> go to last
      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
      // Tab on last element -> go to first
      else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      container.removeEventListener('keydown', handleKeyDown);

      // Restore focus to previous element (only when fully deactivating)
      if (!isActive) {
        const returnTarget = options.returnFocus?.current || previousFocusRef.current;
        if (returnTarget && typeof returnTarget.focus === 'function') {
          returnTarget.focus();
        }
      }
    };
  }, [isActive]); // Only depend on isActive, use refs for callbacks

  return containerRef;
}

/**
 * Hook to handle keyboard shortcuts within a component
 */
export function useKeyboardShortcuts(
  shortcuts: Record<string, () => void>,
  isActive: boolean = true
) {
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      const handler = shortcuts[key];

      if (handler) {
        event.preventDefault();
        handler();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, isActive]);
}
