/**
 * Guild Info Tab - Shows guild details, bonuses, and progression
 */
import { useState } from 'preact/hooks';
import {
  playerGuild,
  guildBonuses,
  guildLevelInfo,
  isGuildLeader,
} from '../../state/guild.signals.js';
import { updateGuild, leaveGuild, disbandGuild } from '../../api/guild.js';
import { Button } from '../shared/Button.js';
import styles from './GuildPanel.module.css';

interface GuildInfoTabProps {
  onRefresh: () => void;
}

export function GuildInfoTab({ onRefresh }: GuildInfoTabProps) {
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [disbanding, setDisbanding] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const guild = playerGuild.value;
  const bonuses = guildBonuses.value;
  const levelInfo = guildLevelInfo.value;

  if (!guild) return null;

  const handleEditDescription = async () => {
    if (!editing) {
      setDescription(guild.description || '');
      setEditing(true);
      return;
    }

    setActionLoading(true);
    try {
      await updateGuild(guild.id, { description });
      setEditing(false);
      onRefresh();
    } catch (error) {
      console.error('Failed to update description:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveGuild = async () => {
    if (!leaving) {
      setLeaving(true);
      return;
    }

    setActionLoading(true);
    try {
      await leaveGuild(guild.id);
      onRefresh();
    } catch (error) {
      console.error('Failed to leave guild:', error);
    } finally {
      setActionLoading(false);
      setLeaving(false);
    }
  };

  const handleDisbandGuild = async () => {
    if (!disbanding) {
      setDisbanding(true);
      return;
    }

    setActionLoading(true);
    try {
      await disbandGuild(guild.id);
      onRefresh();
    } catch (error) {
      console.error('Failed to disband guild:', error);
    } finally {
      setActionLoading(false);
      setDisbanding(false);
    }
  };

  const xpProgress = levelInfo
    ? (guild.xp / levelInfo.xpToNextLevel) * 100
    : 0;

  return (
    <div class={styles.infoSection}>
      {/* Description */}
      <div class={styles.sectionHeader}>
        <span class={styles.sectionTitle}>Opis</span>
        {isGuildLeader.value && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEditDescription}
            disabled={actionLoading}
          >
            {editing ? 'Zapisz' : 'Edytuj'}
          </Button>
        )}
      </div>
      {editing ? (
        <textarea
          class={styles.guildDescription}
          value={description}
          onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
          rows={3}
          maxLength={500}
          style={{ resize: 'vertical', width: '100%' }}
        />
      ) : (
        <div class={styles.guildDescription}>
          {guild.description || 'Brak opisu'}
        </div>
      )}

      {/* Level Progress */}
      {levelInfo && guild.level < 20 && (
        <div class={styles.progressSection}>
          <div class={styles.progressLabel}>
            <span>Postep do poziomu {guild.level + 1}</span>
            <span>
              {guild.xp.toLocaleString()} / {levelInfo.xpToNextLevel.toLocaleString()} XP
            </span>
          </div>
          <div class={styles.progressBar}>
            <div
              class={styles.progressFill}
              style={{ width: `${Math.min(100, xpProgress)}%` }}
            />
          </div>
        </div>
      )}

      {/* Bonuses */}
      <div class={styles.sectionHeader}>
        <span class={styles.sectionTitle}>Bonusy gildii</span>
      </div>
      <div class={styles.bonusesGrid}>
        <div class={styles.bonusCard}>
          <span class={styles.bonusLabel}>Gold Boost</span>
          <span class={styles.bonusValue}>+{bonuses?.goldBoost || 0}%</span>
        </div>
        <div class={styles.bonusCard}>
          <span class={styles.bonusLabel}>Dust Boost</span>
          <span class={styles.bonusValue}>+{bonuses?.dustBoost || 0}%</span>
        </div>
        <div class={styles.bonusCard}>
          <span class={styles.bonusLabel}>XP Boost</span>
          <span class={styles.bonusValue}>+{bonuses?.xpBoost || 0}%</span>
        </div>
      </div>

      {/* Guild Stats */}
      <div class={styles.sectionHeader}>
        <span class={styles.sectionTitle}>Statystyki</span>
      </div>
      <div class={styles.bonusesGrid}>
        <div class={styles.bonusCard}>
          <span class={styles.bonusLabel}>Total XP</span>
          <span class={styles.bonusValue} style={{ color: 'var(--color-text)' }}>
            {guild.totalXp.toLocaleString()}
          </span>
        </div>
        <div class={styles.bonusCard}>
          <span class={styles.bonusLabel}>Honor</span>
          <span class={styles.bonusValue} style={{ color: 'var(--color-gold)' }}>
            {guild.honor.toLocaleString()}
          </span>
        </div>
        <div class={styles.bonusCard}>
          <span class={styles.bonusLabel}>Trofea</span>
          <span class={styles.bonusValue} style={{ color: 'var(--color-primary)' }}>
            {guild.trophies?.length || 0}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div class={styles.sectionHeader}>
        <span class={styles.sectionTitle}>Akcje</span>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {!isGuildLeader.value && (
          <Button
            variant={leaving ? 'danger' : 'secondary'}
            size="sm"
            onClick={handleLeaveGuild}
            disabled={actionLoading}
          >
            {leaving ? 'Potwierdz opuszczenie' : 'Opusc gildie'}
          </Button>
        )}
        {leaving && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLeaving(false)}
          >
            Anuluj
          </Button>
        )}
        {isGuildLeader.value && (
          <>
            <Button
              variant={disbanding ? 'danger' : 'secondary'}
              size="sm"
              onClick={handleDisbandGuild}
              disabled={actionLoading}
            >
              {disbanding ? 'Potwierdz rozwiazanie' : 'Rozwiaz gildie'}
            </Button>
            {disbanding && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDisbanding(false)}
              >
                Anuluj
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
