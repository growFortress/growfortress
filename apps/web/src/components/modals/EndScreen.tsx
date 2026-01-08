import {
  showEndScreen,
  endScreenWon,
  endGameStats,
  hideEndScreen,
} from '../../state/index.js';
import { Button } from '../shared/Button.js';

interface EndScreenProps {
  onPlayAgain: () => Promise<void>;
}

export function EndScreen({ onPlayAgain }: EndScreenProps) {
  const handlePlayAgain = async () => {
    hideEndScreen();
    await onPlayAgain();
  };

  const won = endScreenWon.value;
  const stats = endGameStats.value;
  const resultClass = won ? 'victory' : 'defeat';
  const title = won ? 'Victory!' : 'Defeat';

  // Use actual XP earned from simulation
  const xpEarned = stats?.sessionXpEarned ?? 0;

  return (
    <div class={`end-screen ${showEndScreen.value ? 'visible' : ''} ${resultClass}`}>
      <h2>{title}</h2>

      {stats && (
        <>
          <div class="end-stats">
            <div class="end-stat">
              <span>Waves Cleared</span>
              <span>{stats.wavesCleared}</span>
            </div>
            <div class="end-stat">
              <span>Enemies Killed</span>
              <span>{stats.kills}</span>
            </div>
            <div class="end-stat">
              <span>Elite Kills</span>
              <span>{stats.eliteKills}</span>
            </div>
            <div class="end-stat">
              <span>Gold Earned</span>
              <span>{stats.goldEarned}</span>
            </div>
            <div class="end-stat">
              <span>Dust Earned</span>
              <span>{stats.dustEarned}</span>
            </div>
            <div class="end-stat">
              <span>Relics</span>
              <span>{stats.relics.length}</span>
            </div>
          </div>

          <div class="rewards">
            <div class="reward-item">
              <span>+{stats.goldEarned} Gold</span>
              <span>+{stats.dustEarned} Dust</span>
              <span>+{xpEarned} XP</span>
            </div>
          </div>
        </>
      )}

      <Button variant="primary" onClick={handlePlayAgain}>
        Play Again
      </Button>
    </div>
  );
}
