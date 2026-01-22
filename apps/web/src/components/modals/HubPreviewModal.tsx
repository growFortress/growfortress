/**
 * HubPreviewModal - View other players' hub configurations
 * Shows visual preview of fortress with heroes/turrets + stats panel
 */
import { useState, useEffect, useRef } from 'preact/hooks';
import { Modal } from '../shared/Modal.js';
import { Button } from '../shared/Button.js';
import { Spinner } from '../shared/Spinner.js';
import type { HubPreviewHero, HubPreviewTurret } from '@arcade/protocol';
import { getHeroById, getTurretById } from '@arcade/sim-core';
import {
  hubPreviewData,
  hubPreviewLoading,
  hubPreviewError,
  hubPreviewModalOpen,
  hubPreviewHubState,
  hubPreviewFortressClass,
  closeHubPreview,
} from '../../state/hubPreview.signals.js';
import { HubPreviewRenderer } from '../../renderer/HubPreviewRenderer.js';
import { createChallenge, PvpApiError } from '../../api/pvp.js';
import { getUserId } from '../../api/auth.js';
import { showErrorToast } from '../../state/index.js';
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
  const hubState = hubPreviewHubState.value;
  const fortressClass = hubPreviewFortressClass.value;

  const [challengeLoading, setChallengeLoading] = useState(false);
  const [rendererReady, setRendererReady] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<HubPreviewRenderer | null>(null);

  // Check if this is the current user's profile
  const currentUserId = getUserId();
  const isOwnProfile = data?.userId === currentUserId;

  // Initialize renderer when modal opens and data is ready
  useEffect(() => {
    if (!isVisible || !canvasRef.current || !data || !hubState || !fortressClass) {
      return;
    }

    let mounted = true;

    const initRenderer = async () => {
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }

      const renderer = new HubPreviewRenderer(canvasRef.current!);
      rendererRef.current = renderer;

      try {
        await renderer.init();
        if (!mounted) {
          renderer.destroy();
          return;
        }

        renderer.configure(fortressClass, data.level);
        renderer.startAnimation(hubState);
        setRendererReady(true);
      } catch (err) {
        console.error('Failed to initialize hub preview renderer:', err);
      }
    };

    // Small delay to ensure canvas is properly sized
    const timeoutId = setTimeout(initRenderer, 50);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
      setRendererReady(false);
    };
  }, [isVisible, data?.userId, hubState, fortressClass]);

  // Handle window resize
  useEffect(() => {
    if (!rendererRef.current || !rendererReady) return;

    const handleResize = () => {
      rendererRef.current?.resize();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [rendererReady]);

  const handleChallenge = async () => {
    if (!data || challengeLoading || isOwnProfile) return;

    setChallengeLoading(true);
    try {
      await createChallenge(data.userId);
      showErrorToast(`Wyzwanie wysłane do ${data.displayName}!`, 'info');
      closeHubPreview();
    } catch (err) {
      if (err instanceof PvpApiError) {
        if (err.code === 'COOLDOWN_ACTIVE') {
          showErrorToast('Musisz poczekać przed kolejnym wyzwaniem tego gracza');
        } else if (err.code === 'POWER_OUT_OF_RANGE') {
          showErrorToast('Moc przeciwnika poza zakresem');
        } else {
          showErrorToast(err.message);
        }
      } else {
        showErrorToast('Nie udało się wysłać wyzwania');
      }
    } finally {
      setChallengeLoading(false);
    }
  };

  if (!isVisible) return null;

  const classColor = data?.fortressClass ? CLASS_COLORS[data.fortressClass] ?? '#888888' : '#888888';

  return (
    <Modal
      isOpen={isVisible}
      onClose={closeHubPreview}
      title="Profil gracza"
      size="xlarge"
      class={styles.modalLarge}
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

            {/* Visual Preview Layout */}
            <div class={styles.previewLayout}>
              {/* Canvas Section */}
              <div class={styles.canvasContainer}>
                <canvas ref={canvasRef} class={styles.previewCanvas} />
                {!rendererReady && (
                  <div class={styles.canvasLoading}>
                    <Spinner size="md" />
                  </div>
                )}
              </div>

              {/* Stats Panel */}
              <div class={styles.statsPanel}>
                {/* Compact Stats */}
                <div class={styles.compactStatsGrid}>
                  <div class={styles.compactStat}>
                    <span class={styles.compactStatValue}>{data.level}</span>
                    <span class={styles.compactStatLabel}>Poziom</span>
                  </div>
                  <div class={styles.compactStat}>
                    <span class={styles.compactStatValue}>{data.highestWave}</span>
                    <span class={styles.compactStatLabel}>Fala</span>
                  </div>
                  <div class={styles.compactStat}>
                    <span class={styles.compactStatValue}>{formatPower(data.totalPower)}</span>
                    <span class={styles.compactStatLabel}>Moc</span>
                  </div>
                </div>

                {/* Fortress Class */}
                <div class={styles.compactFortressClass} style={{ borderColor: classColor }}>
                  <span class={styles.compactFortressIcon}>🏰</span>
                  <span class={styles.compactClassName} style={{ color: classColor }}>
                    {CLASS_NAMES[data.fortressClass] ?? data.fortressClass}
                  </span>
                </div>

                {/* Heroes List */}
                {data.heroes.length > 0 && (
                  <div class={styles.compactSection}>
                    <h4 class={styles.compactSectionTitle}>Bohaterowie ({data.heroes.length})</h4>
                    <div class={styles.compactList}>
                      {data.heroes.map((hero) => (
                        <CompactHeroItem key={hero.heroId} hero={hero} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Turrets List */}
                {data.turrets.length > 0 && (
                  <div class={styles.compactSection}>
                    <h4 class={styles.compactSectionTitle}>Wiezyczki ({data.turrets.length})</h4>
                    <div class={styles.compactList}>
                      {data.turrets.map((turret) => (
                        <CompactTurretItem key={`${turret.turretType}-${turret.slotIndex}`} turret={turret} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Exclusive Items */}
                {data.exclusiveItems.length > 0 && (
                  <div class={styles.compactSection}>
                    <h4 class={styles.compactSectionTitle}>Przedmioty</h4>
                    <div class={styles.exclusiveList}>
                      {data.exclusiveItems.map((itemId) => (
                        <span key={itemId} class={styles.exclusiveItem}>
                          {itemId}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* PvP Challenge Button - only show for other players */}
            {!isOwnProfile && (
              <div class={styles.actions}>
                <Button
                  variant="skill"
                  onClick={handleChallenge}
                  disabled={challengeLoading}
                  class={styles.challengeButton}
                >
                  {challengeLoading ? (
                    <>
                      <Spinner size="sm" />
                      Wysyłanie...
                    </>
                  ) : (
                    '⚔️ Wyzwij do PvP'
                  )}
                </Button>
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

interface CompactHeroItemProps {
  hero: HubPreviewHero;
}

function CompactHeroItem({ hero }: CompactHeroItemProps) {
  const heroDef = getHeroById(hero.heroId);
  const heroName = heroDef?.name ?? hero.heroId;

  return (
    <div class={styles.compactItem}>
      <span class={styles.compactItemIcon}>🦸</span>
      <div class={styles.compactItemInfo}>
        <span class={styles.compactItemName}>{heroName}</span>
        <div class={styles.compactItemMeta}>
          <span class={styles.compactItemTier}>T{hero.tier}</span>
          <span>Lv.{hero.level}</span>
          {hero.equippedArtifacts.length > 0 && (
            <span>{hero.equippedArtifacts.length} art.</span>
          )}
        </div>
      </div>
    </div>
  );
}

interface CompactTurretItemProps {
  turret: HubPreviewTurret;
}

function CompactTurretItem({ turret }: CompactTurretItemProps) {
  const turretDef = getTurretById(turret.turretType);
  const turretName = turretDef?.name ?? turret.turretType;

  return (
    <div class={styles.compactItem}>
      <span class={styles.compactItemIcon}>🗼</span>
      <div class={styles.compactItemInfo}>
        <span class={styles.compactItemName}>{turretName}</span>
        <div class={styles.compactItemMeta}>
          <span class={styles.compactItemTier}>T{turret.tier}</span>
          <span>Lv.{turret.level}</span>
          <span>Slot {turret.slotIndex + 1}</span>
        </div>
      </div>
    </div>
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
