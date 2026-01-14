/**
 * GuildPreviewModal - View other guilds' public information
 * Shows guild stats, tech levels with bonuses, trophies, and top 5 members
 */
import { Modal } from '../shared/Modal.js';
import { ProgressBar } from '../shared/ProgressBar.js';
import type { GuildPreviewMember } from '@arcade/protocol';
import { GUILD_TROPHIES } from '@arcade/protocol';
import {
  guildPreviewData,
  guildPreviewLoading,
  guildPreviewError,
  guildPreviewModalOpen,
  closeGuildPreview,
} from '../../state/guildPreview.signals.js';
import styles from './GuildPreviewModal.module.css';

// Role display info
const ROLE_ICONS: Record<string, string> = {
  LEADER: '👑',
  OFFICER: '⚔️',
  MEMBER: '🛡️',
};

const ROLE_NAMES: Record<string, string> = {
  LEADER: 'Lider',
  OFFICER: 'Oficer',
  MEMBER: 'Czlonek',
};

export function GuildPreviewModal() {
  const isVisible = guildPreviewModalOpen.value;
  const data = guildPreviewData.value;
  const loading = guildPreviewLoading.value;
  const error = guildPreviewError.value;

  if (!isVisible) return null;

  return (
    <Modal
      isOpen={isVisible}
      onClose={closeGuildPreview}
      title={data ? `${data.name} [${data.tag}]` : 'Podglad gildii'}
      size="large"
      bodyClass={styles.modalBody}
    >
      <div class={styles.container}>
        {loading ? (
          <div class={styles.loading}>
            <div class={styles.spinner} />
            <span>Ladowanie...</span>
          </div>
        ) : error ? (
          <div class={styles.error}>
            <span class={styles.errorIcon}>!</span>
            <span>{error}</span>
          </div>
        ) : data ? (
          <>
            {/* Guild Info Header */}
            <div class={styles.header}>
              <div class={styles.guildInfo}>
                <h2 class={styles.guildName}>
                  {data.name}
                  <span class={styles.guildTag}>[{data.tag}]</span>
                </h2>
                {data.description && (
                  <p class={styles.description}>{data.description}</p>
                )}
              </div>
            </div>

            {/* Stats Grid */}
            <div class={styles.statsGrid}>
              <div class={styles.stat}>
                <span class={styles.statValue}>{data.level}</span>
                <span class={styles.statLabel}>Poziom</span>
                {data.level < 20 && data.xpToNextLevel > 0 && (
                  <div class={styles.xpProgress}>
                    <ProgressBar
                      percent={(data.xp / (data.xp + data.xpToNextLevel)) * 100}
                      variant="xp"
                      size="sm"
                    />
                    <span class={styles.xpText}>{formatNumber(data.xpToNextLevel)} XP do Lv.{data.level + 1}</span>
                  </div>
                )}
              </div>
              <div class={styles.stat}>
                <span class={styles.statValue}>{formatNumber(data.honor)}</span>
                <span class={styles.statLabel}>Honor</span>
              </div>
              <div class={styles.stat}>
                <span class={styles.statValue}>{data.memberCount}/{data.maxMembers}</span>
                <span class={styles.statLabel}>Czlonkowie</span>
              </div>
            </div>

            {/* Trophies Section */}
            {data.trophies.length > 0 && (
              <div class={styles.section}>
                <h3 class={styles.sectionTitle}>Trofea ({data.trophies.length})</h3>
                <div class={styles.trophyGrid}>
                  {data.trophies.map((trophyId) => (
                    <TrophyBadge key={trophyId} trophyId={trophyId} />
                  ))}
                </div>
              </div>
            )}

            {/* Tech Tree Bonuses */}
            <div class={styles.section}>
              <h3 class={styles.sectionTitle}>Bonusy gildyjne</h3>
              <div class={styles.techGrid}>
                <TechCategory
                  title="Twierdza"
                  icon="\u{1F3F0}"
                  levels={data.techLevels.fortress}
                  bonuses={{
                    hp: data.bonuses.fortressHpPercent,
                    damage: data.bonuses.fortressDamagePercent,
                    regen: data.bonuses.fortressRegenPercent,
                  }}
                />
                <TechCategory
                  title="Bohaterowie"
                  icon="\u{1F9B8}"
                  levels={data.techLevels.hero}
                  bonuses={{
                    hp: data.bonuses.heroHpPercent,
                    damage: data.bonuses.heroDamagePercent,
                    cooldown: data.bonuses.heroCooldownPercent,
                  }}
                />
                <TechCategory
                  title="Wiezyczki"
                  icon="\u{1F5FC}"
                  levels={data.techLevels.turret}
                  bonuses={{
                    damage: data.bonuses.turretDamagePercent,
                    speed: data.bonuses.turretSpeedPercent,
                    range: data.bonuses.turretRangePercent,
                  }}
                />
                <TechCategory
                  title="Ekonomia"
                  icon="\u{1F4B0}"
                  levels={data.techLevels.economy}
                  bonuses={{
                    gold: data.bonuses.goldPercent,
                    dust: data.bonuses.dustPercent,
                    xp: data.bonuses.xpPercent,
                  }}
                />
              </div>
            </div>

            {/* Top Members */}
            {data.topMembers.length > 0 && (
              <div class={styles.section}>
                <h3 class={styles.sectionTitle}>TOP {data.topMembers.length} czlonkow</h3>
                <div class={styles.memberList}>
                  {data.topMembers.map((member, index) => (
                    <MemberCard key={member.userId} member={member} rank={index + 1} />
                  ))}
                </div>
              </div>
            )}

            {/* Created Date */}
            <div class={styles.footer}>
              <span class={styles.createdAt}>
                Zalozono: {formatDate(data.createdAt)}
              </span>
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface TrophyBadgeProps {
  trophyId: string;
}

function TrophyBadge({ trophyId }: TrophyBadgeProps) {
  const trophy = Object.values(GUILD_TROPHIES).find(t => t.id === trophyId);
  if (!trophy) return null;

  return (
    <div class={styles.trophyBadge} title={trophy.description}>
      <span class={styles.trophyIcon}>🏆</span>
      <div class={styles.trophyInfo}>
        <span class={styles.trophyName}>{trophy.name}</span>
        <span class={styles.trophyBonus}>{trophy.bonus}</span>
      </div>
    </div>
  );
}

interface TechCategoryProps {
  title: string;
  icon: string;
  levels: { [key: string]: number };
  bonuses: { [key: string]: number };
}

function TechCategory({ title, icon, levels, bonuses }: TechCategoryProps) {
  const statLabels: Record<string, string> = {
    hp: 'HP',
    damage: 'Obrazenia',
    regen: 'Regeneracja',
    cooldown: 'Cooldown',
    speed: 'Szybkosc',
    range: 'Zasieg',
    gold: 'Zloto',
    dust: 'Pyl',
    xp: 'XP',
  };

  const entries = Object.entries(levels);

  return (
    <div class={styles.techCategory}>
      <div class={styles.techHeader}>
        <span class={styles.techIcon}>{icon}</span>
        <span class={styles.techTitle}>{title}</span>
      </div>
      <div class={styles.techStats}>
        {entries.map(([stat, level]) => {
          const bonus = bonuses[stat] ?? 0;
          return (
            <div key={stat} class={styles.techStat}>
              <span class={styles.techStatLabel}>{statLabels[stat] ?? stat}</span>
              <span class={styles.techStatValue}>
                Lv.{level}
                {bonus > 0 && (
                  <span class={styles.techBonus}>+{(bonus * 100).toFixed(0)}%</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface MemberCardProps {
  member: GuildPreviewMember;
  rank: number;
}

function MemberCard({ member, rank }: MemberCardProps) {
  const roleIcon = ROLE_ICONS[member.role] ?? '\u{1F6E1}\u{FE0F}';
  const roleName = ROLE_NAMES[member.role] ?? member.role;

  return (
    <div class={styles.memberCard}>
      <span class={styles.memberRank}>#{rank}</span>
      <span class={styles.memberRole} title={roleName}>{roleIcon}</span>
      <div class={styles.memberInfo}>
        <span class={styles.memberName}>{member.displayName}</span>
        <div class={styles.memberStats}>
          <span class={styles.memberLevel}>Lv.{member.level}</span>
          <span class={styles.memberPower}>{formatPower(member.power)} mocy</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// UTILS
// ============================================================================

function formatNumber(num: number): string {
  return num.toLocaleString('pl-PL');
}

function formatPower(power: number): string {
  if (power >= 1_000_000) {
    return `${(power / 1_000_000).toFixed(1)}M`;
  }
  if (power >= 1_000) {
    return `${(power / 1_000).toFixed(1)}K`;
  }
  return power.toString();
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default GuildPreviewModal;
