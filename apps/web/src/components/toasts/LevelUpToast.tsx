import { useEffect, useState } from 'preact/hooks';
import { levelUpNotifications, dismissLevelUpNotification } from '../../state/ui.signals.js';
import styles from './LevelUpToast.module.css';

export function LevelUpToast() {
  const notifications = levelUpNotifications.value;
  const current = notifications[0];
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!current) return;

    setVisible(false);
    setExiting(false);

    const showTimer = setTimeout(() => setVisible(true), 30);
    const dismissTimer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => dismissLevelUpNotification(current.id), 250);
    }, 3200);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(dismissTimer);
    };
  }, [current?.id]);

  if (!current) return null;

  return (
    <div class={styles.container} role="status" aria-live="polite">
      <div
        class={`${styles.toast} ${visible ? styles.visible : ''} ${exiting ? styles.exiting : ''}`}
        onClick={() => dismissLevelUpNotification(current.id)}
      >
        <div class={styles.badge}>Poziom {current.level}</div>
        <div class={styles.icon}>⬆️</div>
        <div class={styles.content}>
          <div class={styles.title}>Nowy poziom!</div>
          <div class={styles.rewards}>
            <span class={styles.rewardDust}>+{current.dustReward} Dust</span>
            <span class={styles.rewardGold}>+{current.goldReward} Gold</span>
          </div>
        </div>
        <div class={styles.dismissHint}>Kliknij aby zamknąć</div>
      </div>
      {notifications.length > 1 && (
        <div class={styles.queueCount}>+{notifications.length - 1} więcej</div>
      )}
    </div>
  );
}
