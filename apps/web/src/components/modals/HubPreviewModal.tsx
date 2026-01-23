/**
 * HubPreviewModal - View other players' hub configurations
 * Shows visual preview of fortress with heroes/turrets + stats panel
 */
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { Modal } from '../shared/Modal.js';
import { Button } from '../shared/Button.js';
import { Spinner } from '../shared/Spinner.js';
import type { HubPreviewHero, HubPreviewTurret, ExclusiveItem } from '@arcade/protocol';
import {
  getHeroById,
  getTurretById,
  getArtifactById,
  calculateHeroStats,
  calculateTurretStats,
  ArenaSimulation,
  type ArenaBuildConfig,
} from '@arcade/sim-core';
import {
  hubPreviewData,
  hubPreviewLoading,
  hubPreviewError,
  hubPreviewModalOpen,
  hubPreviewHubState,
  hubPreviewFortressClass,
  closeHubPreview,
} from '../../state/hubPreview.signals.js';
import { getExclusiveItemById } from '../../state/leaderboard.signals.js';
import { useTranslation, currentLanguage } from '../../i18n/useTranslation.js';
import { HubPreviewRenderer } from '../../renderer/HubPreviewRenderer.js';
import { createChallenge, resolveChallenge, PvpApiError } from '../../api/pvp.js';
import type { PvpResolveRequest } from '@arcade/protocol';
import { getUserId } from '../../api/auth.js';
import { showErrorToast, showBattleResult } from '../../state/index.js';
import { GuildTag } from '../shared/GuildTag.js';
import { logger } from '../../utils/logger.js';
import styles from './HubPreviewModal.module.css';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Class colors matching FortressInfoPanel */
const CLASS_COLORS: Record<string, string> = {
  natural: '#228b22',
  ice: '#00bfff',
  fire: '#ff4500',
  lightning: '#9932cc',
  poison: '#32cd32',
  magic: '#ff69b4',
  tech: '#00f0ff',
};

/** Default color when class is not found */
const DEFAULT_CLASS_COLOR = '#888888';

/** Fixed-point scale for turret stats (different from position FP.ONE = 65536) */
const STAT_FP_SCALE = 16384;

// Helper to get localized item name
function getLocalizedItemName(item: ExclusiveItem): string {
  return currentLanguage.value === 'pl' ? item.polishName : item.name;
}

// Sanitize user-provided text to prevent XSS (basic HTML entity escaping)
function sanitizeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export function HubPreviewModal() {
  const { t } = useTranslation('modals');
  const isVisible = hubPreviewModalOpen.value;
  const data = hubPreviewData.value;
  const loading = hubPreviewLoading.value;
  const error = hubPreviewError.value;
  const hubState = hubPreviewHubState.value;
  const fortressClass = hubPreviewFortressClass.value;

  const [challengeLoading, setChallengeLoading] = useState(false);
  const [rendererReady, setRendererReady] = useState(false);
  const [rendererError, setRendererError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<HubPreviewRenderer | null>(null);

  // Check if this is the current user's profile
  const currentUserId = getUserId();
  const isOwnProfile = data?.userId === currentUserId;

  // Initialize renderer when modal opens and data is ready
  const initRenderer = useCallback(async () => {
    if (!canvasRef.current || !data || !hubState || !fortressClass) {
      return;
    }

    setRendererError(false);

    if (rendererRef.current) {
      rendererRef.current.destroy();
      rendererRef.current = null;
    }

    const renderer = new HubPreviewRenderer(canvasRef.current);
    rendererRef.current = renderer;

    try {
      await renderer.init();
      renderer.configure(fortressClass, data.level);
      renderer.startAnimation(hubState);
      setRendererReady(true);
    } catch (err) {
      logger.error('[HubPreviewModal] Failed to initialize renderer:', err);
      setRendererError(true);
      renderer.destroy();
      rendererRef.current = null;
    }
  }, [data, hubState, fortressClass]);

  useEffect(() => {
    if (!isVisible || !canvasRef.current || !data || !hubState || !fortressClass) {
      return;
    }

    // Check dimensions before initializing to ensure canvas is properly sized
    let timeoutId: ReturnType<typeof setTimeout>;
    const checkDimensions = () => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect && rect.width > 100 && rect.height > 100) {
        initRenderer();
      } else {
        // Retry until dimensions are valid
        timeoutId = setTimeout(checkDimensions, 50);
      }
    };

    timeoutId = setTimeout(checkDimensions, 50);

    return () => {
      clearTimeout(timeoutId);
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
      setRendererReady(false);
      setRendererError(false);
    };
  }, [isVisible, data?.userId, hubState, fortressClass, retryCount, initRenderer]);

  // Retry handler for renderer errors
  const handleRetryRenderer = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

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
      const response = await createChallenge(data.userId);
      if (response.battleData) {
        const seed = response.battleData.seed as number;
        const challengerBuild = response.battleData.challengerBuild as ArenaBuildConfig;
        const challengedBuild = response.battleData.challengedBuild as ArenaBuildConfig;
        const challenge = response.challenge;

        // Run simulation immediately (skip battle scene)
        const simulation = new ArenaSimulation(seed, challengerBuild, challengedBuild);
        const simResult = simulation.run();

        // Build client result for server verification
        const winnerId =
          simResult.winner === 'left'
            ? challenge.challengerId
            : simResult.winner === 'right'
              ? challenge.challengedId
              : null;

        const clientResult: PvpResolveRequest['result'] = {
          winnerId,
          winReason: simResult.winReason,
          challengerStats: {
            finalHp: simResult.leftStats.finalHp,
            damageDealt: simResult.leftStats.damageDealt,
            heroesAlive: simResult.leftStats.heroesAlive,
          },
          challengedStats: {
            finalHp: simResult.rightStats.finalHp,
            damageDealt: simResult.rightStats.damageDealt,
            heroesAlive: simResult.rightStats.heroesAlive,
          },
          duration: simResult.duration,
        };

        // Send result to server for verification
        const resolveResponse = await resolveChallenge(challenge.id, clientResult);

        closeHubPreview();

        // Show result modal directly
        showBattleResult(
          {
            ...challenge,
            status: resolveResponse.challenge.status,
            winnerId: resolveResponse.challenge.winnerId,
          },
          resolveResponse.result,
          resolveResponse.rewards
        );
      } else {
        showErrorToast(t('hubPreview.errors.battlePrepareFailed'));
      }
    } catch (err) {
      if (err instanceof PvpApiError) {
        if (err.code === 'COOLDOWN_ACTIVE') {
          showErrorToast(t('hubPreview.errors.cooldownActive'));
        } else if (err.code === 'POWER_OUT_OF_RANGE') {
          showErrorToast(t('hubPreview.errors.powerOutOfRange'));
        } else {
          showErrorToast(err.message);
        }
      } else {
        showErrorToast(t('hubPreview.errors.challengeFailed'));
      }
    } finally {
      setChallengeLoading(false);
    }
  };

  // Get fortress class name from i18n
  const getClassName = useCallback((fc: string): string => {
    const key = `hubPreview.fortressClasses.${fc}`;
    const translated = t(key);
    // If translation key not found, return original
    return translated === key ? fc : translated;
  }, [t]);

  if (!isVisible) return null;

  const classColor = data?.fortressClass
    ? CLASS_COLORS[data.fortressClass] ?? DEFAULT_CLASS_COLOR
    : DEFAULT_CLASS_COLOR;

  return (
    <Modal
      isOpen={isVisible}
      onClose={closeHubPreview}
      title={t('hubPreview.title')}
      size="xlarge"
      class={styles.modalLarge}
      bodyClass={styles.modalBody}
      aria-label={t('hubPreview.ariaLabel')}
    >
      <div class={styles.container} style={{ '--class-color': classColor } as React.CSSProperties}>
        {loading ? (
          <div class={styles.loading} role="status" aria-live="polite">
            <div class={styles.spinner} aria-hidden="true" />
            <span>{t('hubPreview.loading')}</span>
          </div>
        ) : error ? (
          <div class={styles.error} role="alert">
            <span class={styles.errorIcon} aria-hidden="true">!</span>
            <span>
              {error === 'PLAYER_NOT_FOUND'
                ? t('hubPreview.playerNotFound')
                : error === 'LOAD_FAILED'
                ? t('hubPreview.loadFailed')
                : error}
            </span>
          </div>
        ) : data ? (
          <>
            {/* Player Info Header */}
            <div class={styles.header}>
              <div class={styles.playerInfo}>
                <h2 class={styles.playerName}>
                  {sanitizeText(data.displayName)}
                  {data.guildId && data.guildTag && (
                    <GuildTag guildId={data.guildId} tag={data.guildTag} className={styles.guildTag} />
                  )}
                </h2>
                {data.description && (
                  <p class={styles.description}>{sanitizeText(data.description)}</p>
                )}
              </div>
            </div>

            {/* Visual Preview Layout */}
            <div class={styles.previewLayout}>
              {/* Canvas Section */}
              <div class={styles.canvasContainer}>
                <canvas
                  ref={canvasRef}
                  class={styles.previewCanvas}
                  aria-label={t('hubPreview.canvasAriaLabel', { name: data.displayName })}
                  role="img"
                />
                {!rendererReady && !rendererError && (
                  <div class={styles.canvasLoading} role="status" aria-live="polite">
                    <Spinner size="md" />
                    <span class={styles.canvasLoadingText}>{t('hubPreview.loadingRenderer')}</span>
                  </div>
                )}
                {rendererError && (
                  <div class={styles.canvasLoading} role="alert">
                    <span class={styles.canvasLoadingText}>{t('hubPreview.rendererError')}</span>
                    <Button variant="secondary" onClick={handleRetryRenderer}>
                      {t('hubPreview.retryRenderer')}
                    </Button>
                  </div>
                )}
              </div>

              {/* Stats Panel */}
              <div class={styles.statsPanel} role="region" aria-label="Player statistics">
                {/* Compact Stats */}
                <div class={styles.compactStatsGrid}>
                  <div class={styles.compactStat}>
                    <span class={styles.compactStatValue}>{data.level}</span>
                    <span class={styles.compactStatLabel}>{t('hubPreview.level')}</span>
                  </div>
                  <div class={styles.compactStat}>
                    <span class={styles.compactStatValue}>{data.highestWave}</span>
                    <span class={styles.compactStatLabel}>{t('hubPreview.wave')}</span>
                  </div>
                  <div class={styles.compactStat}>
                    <span class={styles.compactStatValue}>{formatPower(data.totalPower)}</span>
                    <span class={styles.compactStatLabel}>{t('hubPreview.power')}</span>
                  </div>
                </div>

                {/* Fortress Class */}
                <div class={styles.compactFortressClass} style={{ borderColor: classColor }}>
                  <span class={styles.compactFortressIcon} aria-hidden="true">🏰</span>
                  <span class={styles.compactClassName} style={{ color: classColor }}>
                    {getClassName(data.fortressClass)}
                  </span>
                </div>

                {/* Heroes List */}
                {data.heroes.length > 0 && (
                  <div class={styles.compactSection}>
                    <h4 class={styles.compactSectionTitle}>
                      {t('hubPreview.heroesCount', { count: data.heroes.length })}
                    </h4>
                    <div class={styles.compactList} role="list">
                      {data.heroes.map((hero) => (
                        <CompactHeroItem key={hero.heroId} hero={hero} t={t} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Turrets List */}
                {data.turrets.length > 0 && (
                  <div class={styles.compactSection}>
                    <h4 class={styles.compactSectionTitle}>
                      {t('hubPreview.turretsCount', { count: data.turrets.length })}
                    </h4>
                    <div class={styles.compactList} role="list">
                      {data.turrets.map((turret) => (
                        <CompactTurretItem
                          key={`${turret.turretType}-${turret.slotIndex}`}
                          turret={turret}
                          fortressClass={data.fortressClass}
                          t={t}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Exclusive Items */}
                {data.exclusiveItems.length > 0 && (
                  <div class={styles.compactSection}>
                    <h4 class={styles.compactSectionTitle}>{t('hubPreview.items')}</h4>
                    <div class={styles.exclusiveList} role="list">
                      {data.exclusiveItems
                        .map((id) => getExclusiveItemById(id))
                        .filter((item): item is ExclusiveItem => item !== undefined)
                        .map((item) => (
                          <span
                            key={item.id}
                            class={`${styles.exclusiveItem} ${styles[item.rarity] || ''}`}
                            title={getLocalizedItemName(item)}
                            role="listitem"
                          >
                            {item.icon} {getLocalizedItemName(item)}
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
                  aria-busy={challengeLoading}
                >
                  {challengeLoading ? (
                    <>
                      <Spinner size="sm" />
                      {t('hubPreview.sending')}
                    </>
                  ) : (
                    t('hubPreview.challengePvp')
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
  t: (key: string, options?: Record<string, unknown>) => string;
}

function CompactHeroItem({ hero, t }: CompactHeroItemProps) {
  const heroDef = getHeroById(hero.heroId);
  const heroName = heroDef?.name ?? hero.heroId;

  return (
    <div class={styles.compactItem} role="listitem">
      <span class={styles.compactItemIcon} aria-hidden="true">🦸</span>
      <div class={styles.compactItemInfo}>
        <span class={styles.compactItemName}>{heroName}</span>
        <div class={styles.compactItemMeta}>
          <span class={styles.compactItemTier}>{t('hubPreview.tier')}{hero.tier}</span>
          <span>Lv.{hero.level}</span>
          {hero.equippedArtifacts.length > 0 && (
            <span>{hero.equippedArtifacts.length} {t('hubPreview.artifacts')}</span>
          )}
        </div>
        {heroDef && (
          <div class={styles.compactItemMeta}>
            {(() => {
              const stats = calculateHeroStats(heroDef, hero.tier as 1 | 2 | 3, hero.level);
              return (
                <>
                  <span>HP {stats.hp}</span>
                  <span>DMG {stats.damage}</span>
                  <span>AS {stats.attackSpeed.toFixed(2)}/s</span>
                </>
              );
            })()}
          </div>
        )}
        {hero.equippedArtifacts.length > 0 && (
          <div class={styles.artifactList}>
            {hero.equippedArtifacts.map((artifact) => {
              const def = getArtifactById(artifact.artifactId);
              const name = def
                ? currentLanguage.value === 'pl'
                  ? def.polishName
                  : def.name
                : artifact.artifactId;
              const slotIcon =
                artifact.slotType === 'weapon'
                  ? '🗡'
                  : artifact.slotType === 'armor'
                  ? '🛡'
                  : '💍';

              return (
                <span
                  key={`${artifact.artifactId}-${artifact.slotType}`}
                  class={styles.artifactBadge}
                  title={name}
                >
                  <span class={styles.artifactSlotIcon} aria-hidden="true">{slotIcon}</span>
                  <span>{name}</span>
                  <span class={styles.artifactLevel}>Lv.{artifact.level}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface CompactTurretItemProps {
  turret: HubPreviewTurret;
  fortressClass: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function CompactTurretItem({ turret, fortressClass, t }: CompactTurretItemProps) {
  const turretDef = getTurretById(turret.turretType);
  const turretName = turretDef?.name ?? turret.turretType;

  return (
    <div class={styles.compactItem} role="listitem">
      <span class={styles.compactItemIcon} aria-hidden="true">🗼</span>
      <div class={styles.compactItemInfo}>
        <span class={styles.compactItemName}>{turretName}</span>
        <div class={styles.compactItemMeta}>
          <span class={styles.compactItemTier}>{t('hubPreview.tier')}{turret.tier}</span>
          <span>Lv.{turret.level}</span>
          <span>{t('hubPreview.slot')} {turret.slotIndex + 1}</span>
        </div>
        {turretDef && (
          <div class={styles.compactItemMeta}>
            {(() => {
              const stats = calculateTurretStats(
                turretDef,
                fortressClass as import('@arcade/sim-core').FortressClass,
                turret.tier
              );
              const damage = Number(stats.damage) / STAT_FP_SCALE;
              const attackSpeed = Number(stats.attackSpeed) / STAT_FP_SCALE;
              return (
                <>
                  <span>DMG {damage.toFixed(1)}</span>
                  <span>AS {attackSpeed.toFixed(2)}/s</span>
                </>
              );
            })()}
          </div>
        )}
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
