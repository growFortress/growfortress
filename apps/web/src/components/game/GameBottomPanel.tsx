import { gamePhase, selectedFortressClass } from '../../state/index.js';
import { MilitiaSpawnPanel } from './MilitiaSpawnPanel.js';
import styles from './GameBottomPanel.module.css';

/**
 * GameBottomPanel - Bottom panel shown during gameplay.
 * Contains action panel for militia/drones.
 */
export function GameBottomPanel() {
  const isPlaying = gamePhase.value !== 'idle';
  const hasClass = selectedFortressClass.value !== null;

  // Only show during gameplay
  if (!isPlaying || !hasClass) {
    return null;
  }

  return (
    <div class={styles.bottomPanel}>
      <div class={styles.panelContent}>
        <MilitiaSpawnPanel />
      </div>
    </div>
  );
}
