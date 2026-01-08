import {
  leaderboardEntries,
  leaderboardLoading,
  leaderboardError,
} from '../../state/index.js';
import { Spinner } from '../shared/Spinner.js';

export function Leaderboard() {
  const renderContent = () => {
    if (leaderboardLoading.value) {
      return (
        <div class="leaderboard-row" style={{ justifyContent: 'center' }}>
          <Spinner size="sm" />
        </div>
      );
    }
    if (leaderboardError.value) {
      return <div class="leaderboard-row">Failed to load leaderboard</div>;
    }
    if (leaderboardEntries.value.length === 0) {
      return <div class="leaderboard-row">No entries yet. Be the first!</div>;
    }
    return leaderboardEntries.value.map((entry) => (
      <div class="leaderboard-row" key={entry.userId}>
        <span class="leaderboard-rank">#{entry.rank}</span>
        <span class="leaderboard-user">Player {entry.userId.slice(-6)}</span>
        <span class="leaderboard-score">{entry.score.toLocaleString()}</span>
      </div>
    ));
  };

  return (
    <div class="leaderboard-panel">
      <h2>Weekly Leaderboard</h2>
      <div class="leaderboard-table">
        {renderContent()}
      </div>
    </div>
  );
}
