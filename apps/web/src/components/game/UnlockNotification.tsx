import { useEffect, useState } from 'preact/hooks';
import type { FortressLevelReward } from '@arcade/sim-core';
import styles from './UnlockNotification.module.css';

// Icons for different unlock types
const UNLOCK_ICONS: Record<string, string> = {
  hero_unlock: '🦸',
  turret_unlock: '🗼',
  class_unlock: '🏰',
  hero_slot: '➕',
  turret_slot: '➕',
  skill_unlock: '✨',
  pillar_unlock: '🏛️',
  feature_unlock: '🎮',
  hp_bonus: '❤️',
  damage_bonus: '⚔️',
};

// Colors for different unlock types
const UNLOCK_COLORS: Record<string, string> = {
  hero_unlock: '#9C27B0',
  turret_unlock: '#2196F3',
  class_unlock: '#FF9800',
  hero_slot: '#4CAF50',
  turret_slot: '#4CAF50',
  skill_unlock: '#E91E63',
  pillar_unlock: '#673AB7',
  feature_unlock: '#00BCD4',
  hp_bonus: '#F44336',
  damage_bonus: '#FF5722',
};

interface UnlockNotificationProps {
  reward: FortressLevelReward;
  level: number;
  onDismiss: () => void;
}

export function UnlockNotification({ reward, level, onDismiss }: UnlockNotificationProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // Animate in
    const showTimer = setTimeout(() => setVisible(true), 50);

    // Auto-dismiss after 4 seconds
    const dismissTimer = setTimeout(() => {
      setExiting(true);
      setTimeout(onDismiss, 300);
    }, 4000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(dismissTimer);
    };
  }, [onDismiss]);

  const handleClick = () => {
    setExiting(true);
    setTimeout(onDismiss, 300);
  };

  const icon = UNLOCK_ICONS[reward.type] || '🎁';
  const color = UNLOCK_COLORS[reward.type] || 'var(--color-primary)';

  return (
    <div
      class={`${styles.notification} ${visible ? styles.visible : ''} ${exiting ? styles.exiting : ''}`}
      style={{ '--unlock-color': color }}
      onClick={handleClick}
    >
      <div class={styles.levelBadge}>Poziom {level}</div>
      <div class={styles.icon}>{icon}</div>
      <div class={styles.content}>
        <div class={styles.title}>Nowe Odblokowanie!</div>
        <div class={styles.description}>{reward.description}</div>
      </div>
      <div class={styles.dismissHint}>Kliknij aby zamknąć</div>
    </div>
  );
}

interface UnlockNotificationQueueProps {
  notifications: Array<{ reward: FortressLevelReward; level: number; id: string }>;
  onDismiss: (id: string) => void;
}

export function UnlockNotificationQueue({ notifications, onDismiss }: UnlockNotificationQueueProps) {
  if (notifications.length === 0) return null;

  // Show only the first notification
  const current = notifications[0];

  return (
    <div class={styles.queueContainer}>
      <UnlockNotification
        key={current.id}
        reward={current.reward}
        level={current.level}
        onDismiss={() => onDismiss(current.id)}
      />
      {notifications.length > 1 && (
        <div class={styles.queueCount}>
          +{notifications.length - 1} więcej
        </div>
      )}
    </div>
  );
}
