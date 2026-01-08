import styles from './Spinner.module.css';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

export function Spinner({ size = 'md', color }: SpinnerProps) {
  return (
    <div
      class={`${styles.spinner} ${styles[size]}`}
      style={color ? { borderTopColor: color } : undefined}
    />
  );
}
