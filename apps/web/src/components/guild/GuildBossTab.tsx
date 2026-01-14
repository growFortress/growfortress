/**
 * Guild Boss Tab - Weekly PvE boss that all guilds compete against
 */
import { useState, useEffect, useCallback } from 'preact/hooks';
import { playerGuild, playerMembership } from '../../state/guild.signals.js';
import {
  getGuildBossStatus,
  getBossLeaderboard,
  getBossBreakdown,
  attackGuildBoss,
  type GuildBoss,
  type BossAttempt,
  type BossLeaderboardEntry,
  type BossMemberDamage,
} from '../../api/guild.js';
import { Spinner } from '../shared/Spinner.js';
import { Button } from '../shared/Button.js';
import { GuildTag } from '../shared/GuildTag.js';
import styles from './GuildPanel.module.css';

interface GuildBossTabProps {
  onRefresh: () => void;
}

interface BossData {
  boss: GuildBoss;
  myTodaysAttempt: BossAttempt | null;
  canAttack: boolean;
  myTotalDamage: number;
  guildTotalDamage: number;
  guildRank: number | null;
  leaderboard: BossLeaderboardEntry[];
  guildBreakdown: BossMemberDamage[];
}

// Boss type to display name mapping
const BOSS_TYPE_NAMES: Record<string, string> = {
  dragon: 'Smok Chaosu',
  titan: 'Prastarzy Tytan',
  demon: 'Arcydiabel',
  leviathan: 'Lewiatan',
  phoenix: 'Ognisty Feniks',
};

// Weakness to display name mapping
const WEAKNESS_NAMES: Record<string, string> = {
  castle: 'Castle',
  arcane: 'Arcane',
  nature: 'Nature',
  shadow: 'Shadow',
  forge: 'Forge',
};

export function GuildBossTab({ onRefresh }: GuildBossTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bossData, setBossData] = useState<BossData | null>(null);
  const [showGuildBreakdown, setShowGuildBreakdown] = useState(false);
  const [attacking, setAttacking] = useState(false);
  const [attackResult, setAttackResult] = useState<{ damage: string; coins: number } | null>(null);

  const guild = playerGuild.value;
  const membership = playerMembership.value;

  const loadBossData = useCallback(async () => {
    if (!guild) return;

    setLoading(true);
    setError(null);

    try {
      const [status, leaderboard, breakdown] = await Promise.all([
        getGuildBossStatus(guild.id),
        getBossLeaderboard(undefined, 20, 0),
        getBossBreakdown(guild.id),
      ]);

      setBossData({
        boss: status.boss,
        myTodaysAttempt: status.myTodaysAttempt,
        canAttack: status.canAttack,
        myTotalDamage: status.myTotalDamage,
        guildTotalDamage: status.guildTotalDamage,
        guildRank: status.guildRank,
        leaderboard: leaderboard.entries,
        guildBreakdown: breakdown.members,
      });
    } catch (err: any) {
      console.error('Failed to load boss data:', err);
      setError(err.message || 'Nie udalo sie zaladowac danych bossa');
    } finally {
      setLoading(false);
    }
  }, [guild]);

  useEffect(() => {
    loadBossData();
  }, [loadBossData]);

  const handleAttack = async () => {
    if (!guild || !bossData?.canAttack || attacking) return;

    setAttacking(true);
    setAttackResult(null);
    setError(null);

    try {
      const result = await attackGuildBoss(guild.id);
      setAttackResult({
        damage: result.attempt.damage,
        coins: result.guildCoinsEarned,
      });
      // Reload data
      await loadBossData();
      onRefresh();
    } catch (err: any) {
      console.error('Failed to attack boss:', err);
      setError(err.message || 'Atak nie powiodl sie');
    } finally {
      setAttacking(false);
    }
  };

  if (!guild) return null;

  if (loading) {
    return (
      <div class={styles.loading}>
        <Spinner />
      </div>
    );
  }

  if (error && !bossData) {
    return <div class={styles.error}>{error}</div>;
  }

  if (!bossData) {
    return <div class={styles.empty}>Brak danych bossa</div>;
  }

  const { boss, myTodaysAttempt, canAttack, myTotalDamage, guildTotalDamage, guildRank, leaderboard, guildBreakdown } = bossData;
  const timeRemaining = new Date(boss.endsAt).getTime() - Date.now();
  const isActive = timeRemaining > 0;
  const hpPercent = Math.max(0, Math.min(100, (Number(BigInt(boss.currentHp)) / Number(BigInt(boss.totalHp))) * 100));

  const hasBattleHero = Boolean(membership?.battleHero);

  return (
    <div class={styles.tabContent}>
      {/* Boss Header */}
      <div class={styles.bossHeader}>
        <div class={styles.bossInfo}>
          <h3 class={styles.bossTitle}>{BOSS_TYPE_NAMES[boss.bossType] || boss.bossType}</h3>
          <span class={styles.bossWeek}>{boss.weekKey}</span>
        </div>
        <div class={styles.bossStatus}>
          <span class={`${styles.statusBadge} ${isActive ? styles.statusActive : styles.statusEnded}`}>
            {isActive ? 'AKTYWNY' : 'ZAKONCZONY'}
          </span>
          {isActive && (
            <span class={styles.timeRemaining}>
              {formatTimeRemaining(timeRemaining)}
            </span>
          )}
        </div>
      </div>

      {/* Boss HP Bar */}
      <div class={styles.bossHpSection}>
        <div class={styles.bossHpBar}>
          <div class={styles.bossHpFill} style={{ width: `${hpPercent}%` }} />
        </div>
        <div class={styles.bossHpText}>
          {formatNumber(boss.currentHp)} / {formatNumber(boss.totalHp)} HP
        </div>
        <div class={styles.bossWeakness}>
          Slablosc: <span class={styles.weaknessType}>{WEAKNESS_NAMES[boss.weakness] || boss.weakness}</span>
        </div>
      </div>

      {/* Attack Section */}
      {isActive && (
        <div class={styles.attackSection}>
          {!hasBattleHero ? (
            <div class={styles.noBattleHero}>
              Ustaw Battle Hero w zakladce Roster aby atakowac bossa
            </div>
          ) : canAttack ? (
            <Button
              onClick={handleAttack}
              disabled={attacking}
              variant="primary"
              size="lg"
              style={{ width: '100%' }}
            >
              {attacking ? 'Atakuje...' : 'Atakuj Bossa'}
            </Button>
          ) : (
            <div class={styles.alreadyAttacked}>
              Juz zaatakowales dzisiaj. Wroc jutro!
            </div>
          )}

          {attackResult && (
            <div class={styles.attackResult}>
              <div class={styles.attackDamage}>
                Zadano {Number(attackResult.damage).toLocaleString()} obrazen!
              </div>
              <div class={styles.attackCoins}>
                +{attackResult.coins} Guild Coins
              </div>
            </div>
          )}

          {myTodaysAttempt && !attackResult && (
            <div class={styles.todaysAttempt}>
              Dzisiejszy atak: {Number(myTodaysAttempt.damage).toLocaleString()} obrazen
            </div>
          )}

          {error && <div class={styles.attackError}>{error}</div>}
        </div>
      )}

      {/* My Stats */}
      <div class={styles.myBossStats}>
        <div class={styles.myGuildRow}>
          <span class={styles.myGuildLabel}>Twoj calkowity damage</span>
          <span class={styles.myGuildWaves}>{myTotalDamage.toLocaleString()}</span>
        </div>
        <div class={styles.myGuildRow}>
          <span class={styles.myGuildLabel}>Damage gildii</span>
          <span class={styles.myGuildWaves}>{guildTotalDamage.toLocaleString()}</span>
        </div>
        {guildRank && (
          <div class={styles.myGuildRow}>
            <span class={styles.myGuildLabel}>Pozycja gildii</span>
            <span class={styles.myGuildRank}>#{guildRank}</span>
          </div>
        )}
      </div>

      {/* Toggle for guild breakdown */}
      {guildBreakdown.length > 0 && (
        <button
          class={styles.toggleBtn}
          onClick={() => setShowGuildBreakdown(!showGuildBreakdown)}
        >
          {showGuildBreakdown ? 'Ukryj wklad czlonkow' : 'Pokaz wklad czlonkow'}
        </button>
      )}

      {/* Guild Member Damage Breakdown */}
      {showGuildBreakdown && guildBreakdown.length > 0 && (
        <div class={styles.contributionsList}>
          <div class={styles.sectionHeader}>
            <h4>Damage czlonkow</h4>
          </div>
          <div class={styles.contributionsTable}>
            {guildBreakdown.map((member) => (
              <div key={member.userId} class={styles.contributionRow}>
                <span class={styles.contributionRank}>#{member.rank}</span>
                <span class={styles.contributionName}>{member.displayName}</span>
                <span class={styles.contributionWaves}>
                  {member.damage.toLocaleString()} dmg
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div class={styles.sectionHeader}>
        <h4>Ranking Gildii</h4>
        <span class={styles.badge}>{leaderboard.length}</span>
      </div>

      {leaderboard.length === 0 ? (
        <div class={styles.empty}>
          <p>Brak uczestnikow w tym tygodniu</p>
          <p class={styles.hint}>
            Atakuj bossa codziennie aby zbierac punkty dla swojej gildii!
          </p>
        </div>
      ) : (
        <div class={styles.leaderboardList}>
          {leaderboard.map((entry) => (
            <BossLeaderboardRow
              key={entry.guildId}
              entry={entry}
              isMyGuild={entry.guildId === guild.id}
            />
          ))}
        </div>
      )}

      {/* Rewards Info */}
      <div class={styles.rewardsInfo}>
        <h4>Nagrody</h4>
        <div class={styles.rewardsList}>
          <div class={styles.rewardRow}>
            <span class={styles.rewardRank}>Uczestnictwo</span>
            <span class={styles.rewardAmount}>50 Guild Coins/atak</span>
          </div>
          <div class={styles.rewardRow}>
            <span class={styles.rewardRank}>Top dmg w gildii</span>
            <span class={styles.rewardAmount}>+200 Guild Coins</span>
          </div>
          <div class={styles.rewardRow}>
            <span class={styles.rewardRank}>1 miejsce</span>
            <span class={styles.rewardAmount}>500 Guild Coins</span>
          </div>
          <div class={styles.rewardRow}>
            <span class={styles.rewardRank}>2 miejsce</span>
            <span class={styles.rewardAmount}>300 Guild Coins</span>
          </div>
          <div class={styles.rewardRow}>
            <span class={styles.rewardRank}>3 miejsce</span>
            <span class={styles.rewardAmount}>200 Guild Coins</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface BossLeaderboardRowProps {
  entry: BossLeaderboardEntry;
  isMyGuild: boolean;
}

function BossLeaderboardRow({ entry, isMyGuild }: BossLeaderboardRowProps) {
  const getRankStyle = (rank: number) => {
    if (rank === 1) return styles.rankGold;
    if (rank === 2) return styles.rankSilver;
    if (rank === 3) return styles.rankBronze;
    return '';
  };

  return (
    <div class={`${styles.leaderboardEntry} ${isMyGuild ? styles.leaderboardEntryMine : ''}`}>
      <span class={`${styles.entryRank} ${getRankStyle(entry.rank)}`}>
        #{entry.rank}
      </span>
      <div class={styles.entryGuild}>
        <span class={styles.entryGuildName}>{entry.guildName}</span>
        <GuildTag guildId={entry.guildId} tag={entry.guildTag} clickable={!isMyGuild} />
      </div>
      <div class={styles.entryBossDamage}>
        <span class={styles.entryDamage}>{entry.totalDamage.toLocaleString()}</span>
        <span class={styles.entryParticipants}>{entry.participantCount} czl.</span>
      </div>
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Zakonczony';

  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatNumber(numStr: string): string {
  const num = BigInt(numStr);
  if (num >= BigInt(1_000_000_000)) {
    return `${(Number(num) / 1_000_000_000).toFixed(1)}B`;
  }
  if (num >= BigInt(1_000_000)) {
    return `${(Number(num) / 1_000_000).toFixed(1)}M`;
  }
  if (num >= BigInt(1_000)) {
    return `${(Number(num) / 1_000).toFixed(1)}K`;
  }
  return num.toString();
}
