import { Spinner } from './Spinner.js';
import styles from './LoadingScreen.module.css';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  return (
    <div class={styles.container}>
      <div class={styles.content}>
        <div class={styles.logo}>
          <span class={styles.icon}>🏰</span>
          <span class={styles.title}>ARCADE TD</span>
        </div>
        <Spinner size="lg" />
        <p class={styles.message}>{message}</p>
      </div>
    </div>
  );
}
