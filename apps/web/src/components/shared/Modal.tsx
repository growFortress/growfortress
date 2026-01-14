import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef, useState, useCallback } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import { announce } from './ScreenReaderAnnouncer.js';
import { Icon } from '../icons/Icon';
import styles from './Modal.module.css';

type ModalSize = 'small' | 'medium' | 'large' | 'xlarge' | 'fullscreen';
type ModalVariant = 'default' | 'danger';

interface ModalProps {
  /** Whether the modal is visible (supports both 'visible' and 'isOpen' for compatibility) */
  visible?: boolean;
  /** Alias for visible */
  isOpen?: boolean;
  /** Modal title - displays in header with close button */
  title?: string;
  /** Modal size variant */
  size?: ModalSize;
  /** Modal style variant */
  variant?: ModalVariant;
  /** Additional CSS class for the modal */
  class?: string;
  /** Additional CSS class for the modal body */
  bodyClass?: string;
  /** Modal content */
  children: ComponentChildren;
  /** Footer content (buttons, etc) */
  footer?: ComponentChildren;
  /** Click handler for the backdrop */
  onClick?: (e: JSX.TargetedMouseEvent<HTMLDivElement>) => void;
  /** Called when Escape key is pressed or backdrop clicked */
  onClose?: () => void;
  /** Accessible label for the modal */
  ariaLabel?: string;
  /** ID of the element that labels the modal */
  ariaLabelledBy?: string;
  /** ID of the element that describes the modal */
  ariaDescribedBy?: string;
  /** Initial element to focus when modal opens */
  initialFocusRef?: { current: HTMLElement | null };
  /** Whether clicking backdrop closes the modal (default: true) */
  closeOnBackdropClick?: boolean;
  /** Whether to show the close button (default: true if onClose provided) */
  showCloseButton?: boolean;
  /** Additional CSS class for the header */
  headerClass?: string;
}

export type { ModalProps, ModalSize, ModalVariant };

const sizeClasses: Record<ModalSize, string> = {
  small: styles.sizeSmall,
  medium: styles.sizeMedium,
  large: styles.sizeLarge,
  xlarge: styles.sizeXLarge,
  fullscreen: styles.sizeFullScreen,
};

const variantClasses: Record<ModalVariant, string> = {
  default: styles.variantDefault,
  danger: styles.variantDanger,
};

/**
 * Enhanced Modal component with glassmorphism, spring animations,
 * and proper accessibility support.
 */
export function Modal({
  visible,
  isOpen,
  title,
  size = 'medium',
  variant = 'default',
  class: className,
  bodyClass,
  children,
  footer,
  onClick,
  onClose,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  initialFocusRef,
  closeOnBackdropClick = true,
  showCloseButton,
  headerClass,
}: ModalProps) {
  // Support both 'visible' and 'isOpen' props
  const isVisible = visible ?? isOpen ?? false;
  const [isExiting, setIsExiting] = useState(false);
  const previouslyAnnouncedRef = useRef(false);
  const modalIdRef = useRef(`modal-${Math.random().toString(36).slice(2, 9)}`);

  // Determine if close button should be shown
  const shouldShowCloseButton = showCloseButton ?? !!onClose;

  // Focus trap for keyboard navigation
  const containerRef = useFocusTrap<HTMLDivElement>(isVisible && !isExiting, {
    initialFocus: initialFocusRef as { current: HTMLElement },
    onEscape: onClose,
  });

  // Handle close with exit animation
  const handleClose = useCallback(() => {
    if (!onClose) return;

    // Start exit animation
    setIsExiting(true);

    // Call onClose after animation
    setTimeout(() => {
      setIsExiting(false);
      onClose();
    }, 200);
  }, [onClose]);

  // Announce modal state changes
  useEffect(() => {
    if (isVisible && !previouslyAnnouncedRef.current) {
      const modalTitle = title || ariaLabel || 'Okno dialogowe';
      announce(`${modalTitle}. Naciśnij Escape aby zamknąć.`, 'polite');
      previouslyAnnouncedRef.current = true;
    } else if (!isVisible && previouslyAnnouncedRef.current) {
      announce('Okno zamknięte', 'polite');
      previouslyAnnouncedRef.current = false;
    }
  }, [isVisible, title, ariaLabel]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isVisible) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    } else {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, [isVisible]);

  // Handle backdrop click
  const handleBackdropClick = (e: JSX.TargetedMouseEvent<HTMLDivElement>) => {
    // Only close if clicking the backdrop itself, not children
    if (e.target === e.currentTarget && closeOnBackdropClick && onClose) {
      handleClose();
    }
    onClick?.(e);
  };

  // Handle escape key (backup for focus trap)
  useEffect(() => {
    if (!isVisible || !onClose) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, onClose, handleClose]);

  if (!isVisible && !isExiting) {
    return null;
  }

  const modalContent = (
    <div class={isExiting ? styles.exiting : undefined}>
      {/* Backdrop */}
      <div
        class={styles.backdrop}
        aria-hidden="true"
        onClick={handleBackdropClick}
      />

      {/* Modal container */}
      <div
        class={styles.container}
        onClick={handleBackdropClick}
      >
        {/* Modal dialog */}
        <div
          ref={containerRef}
          class={[
            styles.modal,
            sizeClasses[size],
            variantClasses[variant],
            className,
          ].filter(Boolean).join(' ')}
          role="dialog"
          aria-modal="true"
          aria-label={title || ariaLabel}
          aria-labelledby={title ? `${modalIdRef.current}-title` : ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          {(title || shouldShowCloseButton) && (
            <div class={[styles.header, headerClass].filter(Boolean).join(' ')}>
              {title && (
                <h2
                  id={`${modalIdRef.current}-title`}
                  class={styles.title}
                >
                  {title}
                </h2>
              )}
              {shouldShowCloseButton && (
                <button
                  type="button"
                  class={styles.closeButton}
                  onClick={handleClose}
                  aria-label="Zamknij"
                >
                  <Icon name="close" size={20} class={styles.closeIcon} />
                </button>
              )}
            </div>
          )}

          {/* Body */}
          <div class={[styles.body, bodyClass].filter(Boolean).join(' ')}>
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div class={styles.footer}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Render in portal to escape stacking context issues
  return createPortal(modalContent, document.body);
}
