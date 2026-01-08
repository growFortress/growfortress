import type { ComponentChildren } from 'preact';
import type { JSX } from 'preact/jsx-runtime';
import styles from './Button.module.css';

type NativeButtonProps = JSX.IntrinsicElements['button'];

interface ButtonProps extends NativeButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'skill' | 'shop-start' | 'shop-cancel';
  children?: ComponentChildren;
}

const variantMap: Record<string, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  danger: styles.danger,
  skill: styles.skill,
  'shop-start': styles.primary, // mapping to primary temporarily
  'shop-cancel': styles.danger, // mapping to danger temporarily
};

export function Button({ variant = 'primary', class: className, children, ...props }: ButtonProps) {
  const variantClass = variantMap[variant] || styles.btn;
  // Combine base .btn class with variant class and any custom class
  const combinedClass = `${styles.btn} ${variantClass} ${className || ''}`.trim();

  return (
    <button class={combinedClass} {...props}>
      {children}
    </button>
  );
}
