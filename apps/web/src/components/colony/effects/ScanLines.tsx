/**
 * ScanLines - CRT monitor scan lines effect
 * Creates a retro terminal feel with moving scan line
 */
import styles from './effects.module.css';

export function ScanLines() {
  return (
    <div className={styles.scanlines}>
      <div className={styles.movingLine} />
    </div>
  );
}
