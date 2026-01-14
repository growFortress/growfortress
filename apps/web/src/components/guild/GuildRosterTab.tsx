/**
 * Guild Roster Tab - Detailed member view for Leader/Officer
 *
 * Shows extended stats (Power, Wave, Battle Hero) with sorting and filtering.
 * Used for selecting members for Arena 5v5 battles.
 */
import { useState, useEffect, useCallback } from 'preact/hooks';
import type { BattleRosterMember } from '@arcade/protocol';
import { getHeroById } from '@arcade/sim-core';
import {
  playerGuild,
  isGuildOfficer,
} from '../../state/guild.signals.js';
import { getBattleRoster } from '../../api/guild.js';
import { Spinner } from '../shared/Spinner.js';
import styles from './GuildPanel.module.css';

type SortField = 'name' | 'role' | 'power' | 'wave' | 'battleHero';
type SortDir = 'asc' | 'desc';

export function GuildRosterTab() {
  const [roster, setRoster] = useState<BattleRosterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sorting
  const [sortField, setSortField] = useState<SortField>('power');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Filtering
  const [filterBattleHero, setFilterBattleHero] = useState<'all' | 'with' | 'without'>('all');

  const guild = playerGuild.value;

  const loadRoster = useCallback(async () => {
    if (!guild) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getBattleRoster(guild.id);
      setRoster(data.roster);
    } catch (err: any) {
      setError(err.message || 'Nie udalo sie zaladowac rostera');
    } finally {
      setLoading(false);
    }
  }, [guild?.id]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  if (!guild) return null;

  // Check permissions
  if (!isGuildOfficer.value) {
    return (
      <div class={styles.empty}>
        <p>Tylko Lider i Oficerowie moga przegladac roster.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div class={styles.loading}>
        <Spinner />
      </div>
    );
  }

  if (error) {
    return <div class={styles.error}>{error}</div>;
  }

  // Filter
  let filteredRoster = roster;
  if (filterBattleHero === 'with') {
    filteredRoster = roster.filter(m => m.battleHero !== null);
  } else if (filterBattleHero === 'without') {
    filteredRoster = roster.filter(m => m.battleHero === null);
  }

  // Sort
  const sortedRoster = [...filteredRoster].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'name':
        cmp = a.displayName.localeCompare(b.displayName);
        break;
      case 'role':
        const roleOrder = { LEADER: 0, OFFICER: 1, MEMBER: 2 };
        cmp = (roleOrder[a.role as keyof typeof roleOrder] ?? 2) -
              (roleOrder[b.role as keyof typeof roleOrder] ?? 2);
        break;
      case 'power':
        cmp = a.totalPower - b.totalPower;
        break;
      case 'wave':
        cmp = a.highestWave - b.highestWave;
        break;
      case 'battleHero':
        cmp = (a.battleHero?.power ?? 0) - (b.battleHero?.power ?? 0);
        break;
    }
    return sortDir === 'desc' ? -cmp : cmp;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const getSortIndicator = (field: SortField) => {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? ' ^' : ' v';
  };

  const readyCount = roster.filter(m => m.battleHero !== null).length;

  return (
    <div class={styles.tabContent}>
      {/* Header with stats */}
      <div class={styles.rosterHeader}>
        <div class={styles.rosterStats}>
          <span class={styles.rosterStatItem}>
            <span class={styles.rosterStatValue}>{roster.length}</span>
            <span class={styles.rosterStatLabel}>czlonkow</span>
          </span>
          <span class={styles.rosterStatItem}>
            <span class={`${styles.rosterStatValue} ${styles.rosterStatReady}`}>
              {readyCount}
            </span>
            <span class={styles.rosterStatLabel}>gotowych do bitwy</span>
          </span>
        </div>

        {/* Filter */}
        <div class={styles.rosterFilter}>
          <select
            value={filterBattleHero}
            onChange={(e) => setFilterBattleHero((e.target as HTMLSelectElement).value as any)}
            class={styles.filterSelect}
          >
            <option value="all">Wszyscy</option>
            <option value="with">Z Battle Hero</option>
            <option value="without">Bez Battle Hero</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div class={styles.rosterTable}>
        <div class={styles.rosterTableHeader}>
          <div
            class={`${styles.rosterCol} ${styles.rosterColName}`}
            onClick={() => handleSort('name')}
          >
            Gracz{getSortIndicator('name')}
          </div>
          <div
            class={`${styles.rosterCol} ${styles.rosterColRole}`}
            onClick={() => handleSort('role')}
          >
            Rola{getSortIndicator('role')}
          </div>
          <div
            class={`${styles.rosterCol} ${styles.rosterColPower}`}
            onClick={() => handleSort('power')}
          >
            Power{getSortIndicator('power')}
          </div>
          <div
            class={`${styles.rosterCol} ${styles.rosterColWave}`}
            onClick={() => handleSort('wave')}
          >
            Fala{getSortIndicator('wave')}
          </div>
          <div
            class={`${styles.rosterCol} ${styles.rosterColHero}`}
            onClick={() => handleSort('battleHero')}
          >
            Battle Hero{getSortIndicator('battleHero')}
          </div>
        </div>

        <div class={styles.rosterTableBody}>
          {sortedRoster.length === 0 ? (
            <div class={styles.rosterEmpty}>
              Brak czlonkow spelniajacych kryteria
            </div>
          ) : (
            sortedRoster.map((member) => (
              <RosterRow key={member.userId} member={member} />
            ))
          )}
        </div>
      </div>

      {/* Info hint */}
      <p class={styles.rosterHint}>
        Czlonkowie z ustawionym Battle Hero moga byc wybrani do bitwy Arena 5v5.
        Minimum 5 gotowych graczy wymaganych do ataku.
      </p>
    </div>
  );
}

// ============================================================================
// ROSTER ROW
// ============================================================================

interface RosterRowProps {
  member: BattleRosterMember;
}

function RosterRow({ member }: RosterRowProps) {
  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'LEADER': return 'Lider';
      case 'OFFICER': return 'Oficer';
      default: return 'Czlonek';
    }
  };

  const getRoleClass = (role: string) => {
    switch (role) {
      case 'LEADER': return styles.roleLeader;
      case 'OFFICER': return styles.roleOfficer;
      default: return styles.roleMember;
    }
  };

  const formatPower = (power: number) => {
    if (power >= 1_000_000) return `${(power / 1_000_000).toFixed(1)}M`;
    if (power >= 1_000) return `${(power / 1_000).toFixed(1)}K`;
    return power.toLocaleString();
  };

  const heroName = member.battleHero
    ? getHeroById(member.battleHero.heroId)?.name || member.battleHero.heroId
    : null;

  return (
    <div class={`${styles.rosterRow} ${member.battleHero ? styles.rosterRowReady : ''}`}>
      <div class={`${styles.rosterCol} ${styles.rosterColName}`}>
        {member.displayName}
      </div>
      <div class={`${styles.rosterCol} ${styles.rosterColRole}`}>
        <span class={getRoleClass(member.role)}>{getRoleLabel(member.role)}</span>
      </div>
      <div class={`${styles.rosterCol} ${styles.rosterColPower}`}>
        {formatPower(member.totalPower)}
      </div>
      <div class={`${styles.rosterCol} ${styles.rosterColWave}`}>
        {member.highestWave}
      </div>
      <div class={`${styles.rosterCol} ${styles.rosterColHero}`}>
        {member.battleHero ? (
          <div class={styles.battleHeroCell}>
            <span class={styles.battleHeroCellName}>{heroName}</span>
            <span class={styles.battleHeroCellStats}>
              T{member.battleHero.tier} | {formatPower(member.battleHero.power)}
            </span>
          </div>
        ) : (
          <span class={styles.noBattleHero}>-</span>
        )}
      </div>
    </div>
  );
}
