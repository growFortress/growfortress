/**
 * GuildPreviewModal - View other guilds' public information
 * Shows guild stats, structures with bonuses, trophies, and top 5 members
 */
import { Modal } from '../shared/Modal.js';
import type { GuildPreviewMember, GuildStructureLevels } from '@arcade/protocol';
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
                <span class={styles.statValue}>{formatNumber(data.honor)}</span>
                <span class={styles.statLabel}>Honor</span>
              </div>
              <div class={styles.stat}>
                <span class={styles.statValue}>{data.memberCount}/{data.maxMembers}</span>
                <span class={styles.statLabel}>Czlonkowie</span>
              </div>
              <div class={styles.stat}>
                <span class={styles.statValue}>{data.trophies.length}</span>
                <span class={styles.statLabel}>Trofea</span>
              </div>
            </div>

            {/* Structures */}
            <div class={styles.section}>
              <h3 class={styles.sectionTitle}>Struktury</h3>
              <StructuresDisplay structures={data.structures} bonuses={data.bonuses} />
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

// Structure display info
const STRUCTURE_INFO: Record<string, { name: string; icon: string; bonusLabel: string }> = {
  kwatera: { name: 'Kwatera', icon: '🏠', bonusLabel: 'Pojemnosc' },
  skarbiec: { name: 'Skarbiec', icon: '💰', bonusLabel: 'Gold Boost' },
  akademia: { name: 'Akademia', icon: '📚', bonusLabel: 'XP Boost' },
  zbrojownia: { name: 'Zbrojownia', icon: '⚔️', bonusLabel: 'Stat Boost' },
};

interface StructuresDisplayProps {
  structures: GuildStructureLevels;
  bonuses: { goldBoost: number; xpBoost: number; statBoost: number };
}

function StructuresDisplay({ structures, bonuses }: StructuresDisplayProps) {
  const structureData = [
    { type: 'kwatera', level: structures.kwatera, bonus: 10 + structures.kwatera, isCapacity: true },
    { type: 'skarbiec', level: structures.skarbiec, bonus: bonuses.goldBoost },
    { type: 'akademia', level: structures.akademia, bonus: bonuses.xpBoost },
    { type: 'zbrojownia', level: structures.zbrojownia, bonus: bonuses.statBoost },
  ];

  return (
    <div class={styles.structuresGrid}>
      {structureData.map(({ type, level, bonus, isCapacity }) => {
        const info = STRUCTURE_INFO[type];
        return (
          <div key={type} class={styles.structureCard}>
            <div class={styles.structureHeader}>
              <span class={styles.structureIcon}>{info.icon}</span>
              <span class={styles.structureName}>{info.name}</span>
            </div>
            <div class={styles.structureLevel}>Lv.{level}/20</div>
            <div class={styles.structureBonus}>
              {isCapacity
                ? `${bonus} miejsc`
                : `+${Math.round(bonus * 100)}%`
              }
            </div>
          </div>
        );
      })}
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
