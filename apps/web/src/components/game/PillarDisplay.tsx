import { useRef, useEffect } from 'preact/hooks';
import type { JSX } from 'preact';
import { currentPillar, currentPillarInfo } from '../../state/index.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import styles from './PillarDisplay.module.css';

export function PillarDisplay() {
  const { t } = useTranslation('game');
  const containerRef = useRef<HTMLDivElement>(null);
  const prevPillarRef = useRef(currentPillar.value);

  // Trigger animation when pillar changes
  useEffect(() => {
    if (prevPillarRef.current !== currentPillar.value && containerRef.current) {
      containerRef.current.classList.add(styles.changing);
      const timeout = setTimeout(() => {
        containerRef.current?.classList.remove(styles.changing);
      }, 500);
      prevPillarRef.current = currentPillar.value;
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [currentPillar.value]);

  const info = currentPillarInfo.value;
  const pillarId = currentPillar.value;

  return (
    <div
      ref={containerRef}
      class={styles.pillarDisplay}
      style={{ '--pillar-color': info.color } as JSX.CSSProperties}
    >
      <span class={styles.icon}>{info.icon}</span>
      <div class={styles.textContainer}>
        <span class={styles.name}>{t(`pillars.${pillarId}.name`)}</span>
        <span class={styles.subtitle}>{t(`pillars.${pillarId}.subtitle`)}</span>
      </div>
    </div>
  );
}
