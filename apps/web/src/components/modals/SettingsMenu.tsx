import { settingsMenuVisible, closeSettingsMenu } from '../../state/index.js';
import styles from './SettingsMenu.module.css';

interface SettingsMenuProps {
  onLogout: () => void;
}

export function SettingsMenu({ onLogout }: SettingsMenuProps) {
  const isVisible = settingsMenuVisible.value;

  if (!isVisible) return null;

  const handleOverlayClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains(styles.overlay)) {
      closeSettingsMenu();
    }
  };

  const handleLogout = () => {
    closeSettingsMenu();
    onLogout();
  };

  return (
    <div class={styles.overlay} onClick={handleOverlayClick}>
      <div class={styles.menu}>
        <div class={styles.header}>
          <h2 class={styles.title}>Ustawienia</h2>
          <button class={styles.closeBtn} onClick={closeSettingsMenu}>
            ×
          </button>
        </div>

        <div class={styles.menuItems}>
          <button class={styles.menuItem} onClick={handleLogout}>
            <span class={styles.menuIcon}>🚪</span>
            <span class={styles.menuLabel}>Wyloguj</span>
          </button>
        </div>

        <div class={styles.footer}>
          <span class={styles.version}>Grow Fortress v0.1</span>
        </div>
      </div>
    </div>
  );
}
