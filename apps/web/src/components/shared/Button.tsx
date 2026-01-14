import { useState, useRef, useCallback } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { JSX } from 'preact/jsx-runtime';
import { Icon, type IconName } from '../icons/Icon';
import styles from './Button.module.css';

type NativeButtonProps = JSX.IntrinsicElements['button'];

interface ButtonProps extends NativeButtonProps {
  /** Button style variant */
  variant?: 'primary' | 'secondary' | 'danger' | 'skill' | 'shop-start' | 'shop-cancel' | 'ghost';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Icon to show on the left side */
  iconLeft?: IconName;
  /** Icon to show on the right side */
  iconRight?: IconName;
  /** Loading state - shows spinner and disables button */
  loading?: boolean;
  /** Full width button */
  fullWidth?: boolean;
  /** Disable ripple effect */
  noRipple?: boolean;
  children?: ComponentChildren;
}

export type { ButtonProps };

const variantMap: Record<string, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  danger: styles.danger,
  skill: styles.skill,
  ghost: styles.ghost,
  'shop-start': styles.primary,
  'shop-cancel': styles.danger,
};

const sizeMap: Record<string, string> = {
  sm: styles.sm,
  md: '',
  lg: styles.lg,
};

const iconSizeMap: Record<string, number> = {
  sm: 14,
  md: 18,
  lg: 22,
};

/**
 * Enhanced Button component with ripple effect, icons, and loading state.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  iconLeft,
  iconRight,
  loading = false,
  fullWidth = false,
  noRipple = false,
  class: className,
  children,
  onClick,
  disabled,
  ...props
}: ButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number; size: number }>>([]);
  const nextIdRef = useRef(0);

  // Create ripple on click
  const createRipple = useCallback((event: JSX.TargetedMouseEvent<HTMLButtonElement>) => {
    if (noRipple || disabled || loading) return;

    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const size = Math.max(rect.width, rect.height) * 2;

    const ripple = {
      id: nextIdRef.current++,
      x: x - size / 2,
      y: y - size / 2,
      size,
    };

    setRipples(prev => [...prev, ripple]);

    // Remove ripple after animation
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== ripple.id));
    }, 600);
  }, [noRipple, disabled, loading]);

  // Handle click with ripple
  const handleClick = useCallback((event: JSX.TargetedMouseEvent<HTMLButtonElement>) => {
    createRipple(event);
    onClick?.(event);
  }, [createRipple, onClick]);

  const variantClass = variantMap[variant] || styles.btn;
  const sizeClass = sizeMap[size] || '';
  const iconSize = iconSizeMap[size] || 18;

  const combinedClass = [
    styles.btn,
    variantClass,
    sizeClass,
    fullWidth && styles.fullWidth,
    loading && styles.loading,
    (iconLeft || iconRight || loading) && styles.hasIcon,
    className,
  ].filter(Boolean).join(' ');

  const isDisabled = disabled || loading;

  return (
    <button
      ref={buttonRef}
      class={combinedClass}
      onClick={handleClick}
      disabled={isDisabled}
      aria-busy={loading}
      {...props}
    >
      {/* Loading spinner */}
      {loading && (
        <span class={styles.spinner} aria-hidden="true">
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              stroke-dasharray="31.4 31.4"
              class={styles.spinnerCircle}
            />
          </svg>
        </span>
      )}

      {/* Left icon */}
      {!loading && iconLeft && (
        <span class={styles.iconLeft} aria-hidden="true">
          <Icon name={iconLeft} size={iconSize} />
        </span>
      )}

      {/* Content */}
      <span class={styles.content}>{children}</span>

      {/* Right icon */}
      {iconRight && (
        <span class={styles.iconRight} aria-hidden="true">
          <Icon name={iconRight} size={iconSize} />
        </span>
      )}

      {/* Ripple container */}
      {!noRipple && ripples.length > 0 && (
        <span class={styles.rippleContainer} aria-hidden="true">
          {ripples.map(ripple => (
            <span
              key={ripple.id}
              class={styles.ripple}
              style={{
                left: `${ripple.x}px`,
                top: `${ripple.y}px`,
                width: `${ripple.size}px`,
                height: `${ripple.size}px`,
              }}
            />
          ))}
        </span>
      )}
    </button>
  );
}
