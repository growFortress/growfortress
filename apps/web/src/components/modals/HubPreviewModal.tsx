/**
 * HubPreviewModal - View other players' hub configurations
 * Shows fortress class, heroes, turrets, and player stats
 */
import { Modal } from '../shared/Modal.js';
import type { HubPreviewHero, HubPreviewTurret, HubPreviewArtifact } from '@arcade/protocol';
import { getHeroById, getTurretById, getArtifactById } from '@arcade/sim-core';
import {
  hubPreviewData,
  hubPreviewLoading,
  hubPreviewError,
  hubPreviewModalOpen,
  closeHubPreview,
} from '../../state/hubPreview.signals.js';
import { GuildTag } from '../shared/GuildTag.js';
import styles from './HubPreviewModal.module.css';

// Class colors matching FortressInfoPanel
const CLASS_COLORS: Record<string, string> = {
  natural: '#228b22',
  ice: '#00bfff',
  fire: '#ff4500',
  lightning: '#9932cc',
  poison: '#32cd32',
  magic: '#ff69b4',
  tech: '#00f0ff',
};

// Class display names
const CLASS_NAMES: Record<string, string> = {
  natural: 'Natura',
  ice: 'Lod',
  fire: 'Ogien',
  lightning: 'Blyskawica',
  poison: 'Trucizna',
  magic: 'Magia',
  tech: 'Technologia',
};

export function HubPreviewModal() {
  const isVisible = hubPreviewModalOpen.value;
  const data = hubPreviewData.value;
  const loading = hubPreviewLoading.value;
  const error = hubPreviewError.value;

  if (!isVisible) return null;

  const classColor = data?.fortressClass ? CLASS_COLORS[data.fortressClass] ?? '#888888' : '#888888';

  return (
    <Modal
      isOpen={isVisible}
      onClose={closeHubPreview}
      title={data ? `${data.displayName}` : 'Podglad gracza'}
      size="large"
      bodyClass={styles.modalBody}
    >
      <div class={styles.container} style={{ '--class-color': classColor } as React.CSSProperties}>
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
            {/* Player Info Header */}
            <div class={styles.header}>
              <div class={styles.playerInfo}>
                <h2 class={styles.playerName}>
                  {data.displayName}
                  {data.guildId && data.guildTag && (
                    <GuildTag guildId={data.guildId} tag={data.guildTag} className={styles.guildTag} />
                  )}
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
              </div>
              <div class={styles.stat}>
                <span class={styles.statValue}>{data.highestWave}</span>
                <span class={styles.statLabel}>Najwyzsza fala</span>
              </div>
              <div class={styles.stat}>
                <span class={styles.statValue}>{formatPower(data.totalPower)}</span>
                <span class={styles.statLabel}>Moc</span>
              </div>
            </div>

            {/* Fortress Class */}
            <div class={styles.section}>
              <h3 class={styles.sectionTitle}>Twierdza</h3>
              <div class={styles.fortressClass} style={{ borderColor: classColor }}>
                <span class={styles.fortressIcon}>🏰</span>
                <span class={styles.className} style={{ color: classColor }}>
                  {CLASS_NAMES[data.fortressClass] ?? data.fortressClass}
                </span>
              </div>
            </div>

            {/* Heroes Section */}
            {data.heroes.length > 0 && (
              <div class={styles.section}>
                <h3 class={styles.sectionTitle}>Bohaterowie ({data.heroes.length})</h3>
                <div class={styles.heroGrid}>
                  {data.heroes.map((hero) => (
                    <HeroCard key={hero.heroId} hero={hero} />
                  ))}
                </div>
              </div>
            )}

            {/* Turrets Section */}
            {data.turrets.length > 0 && (
              <div class={styles.section}>
                <h3 class={styles.sectionTitle}>Wiezyczki ({data.turrets.length})</h3>
                <div class={styles.turretGrid}>
                  {data.turrets.map((turret) => (
                    <TurretCard key={`${turret.turretType}-${turret.slotIndex}`} turret={turret} />
                  ))}
                </div>
              </div>
            )}

            {/* Exclusive Items */}
            {data.exclusiveItems.length > 0 && (
              <div class={styles.section}>
                <h3 class={styles.sectionTitle}>Przedmioty ekskluzywne</h3>
                <div class={styles.exclusiveList}>
                  {data.exclusiveItems.map((itemId) => (
                    <span key={itemId} class={styles.exclusiveItem}>
                      {itemId}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </Modal>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface HeroCardProps {
  hero: HubPreviewHero;
}

function HeroCard({ hero }: HeroCardProps) {
  const heroDef = getHeroById(hero.heroId);
  const heroName = heroDef?.name ?? hero.heroId;

  return (
    <div class={styles.heroCard}>
      <div class={styles.heroHeader}>
        <span class={styles.heroAvatar}>
          🦸
        </span>
        <div class={styles.heroInfo}>
          <span class={styles.heroName}>{heroName}</span>
          <div class={styles.heroStats}>
            <span class={styles.heroTier}>T{hero.tier}</span>
            <span class={styles.heroLevel}>Lv.{hero.level}</span>
          </div>
        </div>
      </div>
      {hero.equippedArtifacts.length > 0 && (
        <div class={styles.artifactList}>
          {hero.equippedArtifacts.map((artifact) => (
            <ArtifactBadge key={artifact.artifactId} artifact={artifact} />
          ))}
        </div>
      )}
    </div>
  );
}

interface TurretCardProps {
  turret: HubPreviewTurret;
}

function TurretCard({ turret }: TurretCardProps) {
  const turretDef = getTurretById(turret.turretType);
  const turretName = turretDef?.name ?? turret.turretType;

  return (
    <div class={styles.turretCard}>
      <div class={styles.turretHeader}>
        <span class={styles.turretIcon}>
          🗼
        </span>
        <div class={styles.turretInfo}>
          <span class={styles.turretName}>{turretName}</span>
          <div class={styles.turretStats}>
            <span class={styles.turretSlot}>Slot {turret.slotIndex + 1}</span>
            <span class={styles.turretLevel}>Lv.{turret.level}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ArtifactBadgeProps {
  artifact: HubPreviewArtifact;
}

function ArtifactBadge({ artifact }: ArtifactBadgeProps) {
  const artifactDef = getArtifactById(artifact.artifactId);
  const artifactName = artifactDef?.name ?? artifact.artifactId;

  const slotIcons: Record<string, string> = {
    weapon: '⚔️',
    armor: '🛡️',
    accessory: '💍',
  };

  return (
    <span class={styles.artifactBadge} title={artifactName}>
      <span class={styles.artifactSlotIcon}>{slotIcons[artifact.slotType] ?? '📦'}</span>
      <span class={styles.artifactLevel}>+{artifact.level}</span>
    </span>
  );
}

// ============================================================================
// UTILS
// ============================================================================

function formatPower(power: number): string {
  if (power >= 1_000_000) {
    return `${(power / 1_000_000).toFixed(1)}M`;
  }
  if (power >= 1_000) {
    return `${(power / 1_000).toFixed(1)}K`;
  }
  return power.toString();
}

export default HubPreviewModal;
