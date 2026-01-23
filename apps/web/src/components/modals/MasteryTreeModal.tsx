/**
 * MasteryTreeModal - Full-screen modal for Class Mastery Trees
 *
 * Displays skill trees for all 7 fortress classes.
 * Players invest Mastery Points to unlock permanent bonuses.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Modal } from '../shared/Modal.js';
import type { FortressClass, MasteryNodeDefinition, MasteryTreeDefinition } from '@arcade/sim-core';
import { canUnlockNode, calculateRespecReturn } from '@arcade/sim-core';
import { useTranslation } from '../../i18n/useTranslation.js';
import {
  masteryState,
  masteryModalVisible,
  selectedMasteryClass,
  hoveredMasteryNode,
  availableMasteryPoints,
  currentClassProgress,
  currentTreeDefinition,
  isNodeUnlocked,
  closeMasteryModal,
  selectMasteryClass,
} from '../../state/mastery.signals.js';
import {
  loadMasteryData,
  unlockNodeAndRefresh,
  respecClassAndRefresh,
} from '../../api/mastery.js';
import { DustIcon } from '../icons/index.js';
import styles from './MasteryTreeModal.module.css';

// ============================================================================
// CLASS CONFIGURATION
// ============================================================================

interface ClassConfig {
  id: FortressClass;
  name: string;
  icon: string;
  color: string;
}

const CLASS_CONFIGS: ClassConfig[] = [
  { id: 'fire', name: 'Ogien', icon: '🔥', color: '#ff6b35' },
  { id: 'ice', name: 'Lod', icon: '❄️', color: '#00d4ff' },
  { id: 'lightning', name: 'Blyskawica', icon: '⚡', color: '#ffd700' },
  { id: 'natural', name: 'Natura', icon: '🌿', color: '#4ade80' },
  { id: 'tech', name: 'Tech', icon: '⚙️', color: '#8b5cf6' },
  { id: 'void', name: 'Pustka', icon: '🌀', color: '#a855f7' },
  { id: 'plasma', name: 'Plazma', icon: '💜', color: '#ec4899' },
];

// Node type icons
const NODE_TYPE_ICONS: Record<string, string> = {
  stat_bonus: '📊',
  synergy_amplifier: '🔗',
  class_perk: '⭐',
  capstone: '👑',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatModifier(key: string, value: number): string {
  const percentKeys = ['damageBonus', 'critChance', 'critDamageBonus', 'attackSpeedBonus', 'splashDamagePercent', 'eliteDamageBonus', 'executeThreshold', 'executeBonusDamage'];
  const labels: Record<string, string> = {
    damageBonus: 'Obrazenia',
    critChance: 'Szansa na krytyka',
    critDamageBonus: 'Obrazenia krytyczne',
    attackSpeedBonus: 'Szybkosc ataku',
    splashDamagePercent: 'Obrazenia obszarowe',
    splashRadiusBonus: 'Zasieg obszarowy',
    eliteDamageBonus: 'Obrazenia vs elity',
    executeThreshold: 'Prog egzekucji',
    executeBonusDamage: 'Bonus egzekucji',
    heroSynergyBonus: 'Synergia bohaterow',
    turretSynergyBonus: 'Synergia wiezyczek',
    fullSynergyBonus: 'Pelna synergia',
  };

  const label = labels[key] || key;
  if (percentKeys.includes(key)) {
    return `${label}: +${Math.round(value * 100)}%`;
  }
  return `${label}: +${value}`;
}

function getNodeEffectsList(node: MasteryNodeDefinition): string[] {
  const effects: string[] = [];

  if (node.effects.modifiers) {
    for (const [key, value] of Object.entries(node.effects.modifiers)) {
      if (value !== undefined) {
        effects.push(formatModifier(key, value));
      }
    }
  }

  if (node.effects.synergyAmplifier) {
    const amp = node.effects.synergyAmplifier;
    if (amp.heroSynergyBonus) {
      effects.push(`Synergia bohaterow: +${Math.round(amp.heroSynergyBonus * 100)}%`);
    }
    if (amp.turretSynergyBonus) {
      effects.push(`Synergia wiezyczek: +${Math.round(amp.turretSynergyBonus * 100)}%`);
    }
    if (amp.fullSynergyBonus) {
      effects.push(`Pelna synergia: +${Math.round(amp.fullSynergyBonus * 100)}%`);
    }
  }

  if (node.effects.classPerk) {
    effects.push(node.effects.classPerk.description);
  }

  return effects;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function MasteryTreeModal() {
  const { t } = useTranslation('modals');
  const isVisible = masteryModalVisible.value;
  const state = masteryState.value;
  const selectedClass = selectedMasteryClass.value;
  const availablePoints = availableMasteryPoints.value;
  const classProgress = currentClassProgress.value;
  const treeDefinition = currentTreeDefinition.value;
  const hoveredNodeId = hoveredMasteryNode.value;

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [respeccing, setRespeccing] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Load data when modal opens
  useEffect(() => {
    if (isVisible && !state.progress && !state.isLoading) {
      loadMasteryData();
    }
  }, [isVisible, state.progress, state.isLoading]);

  // Get class summary for tabs
  const getClassSummary = useCallback((classId: FortressClass) => {
    const progress = state.progress?.classProgress[classId];
    if (!progress) return { spent: 0, unlocked: 0 };
    return {
      spent: progress.pointsSpent,
      unlocked: progress.unlockedNodes.length,
    };
  }, [state.progress]);

  // Handle class tab change
  const handleClassChange = useCallback((classId: FortressClass) => {
    selectMasteryClass(classId);
    setSelectedNodeId(null);
  }, []);

  // Handle node click
  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, []);

  // Handle node hover
  const handleNodeHover = useCallback((nodeId: string | null, event?: MouseEvent) => {
    hoveredMasteryNode.value = nodeId;
    if (event && nodeId) {
      const rect = (event.target as HTMLElement).getBoundingClientRect();
      setTooltipPos({
        x: rect.right + 10,
        y: rect.top,
      });
    }
  }, []);

  // Handle unlock
  const handleUnlock = useCallback(async (nodeId: string) => {
    if (unlocking) return;
    setUnlocking(true);
    try {
      const result = await unlockNodeAndRefresh(nodeId);
      if (!result.success) {
        console.error('Failed to unlock:', result.message);
      }
    } finally {
      setUnlocking(false);
    }
  }, [unlocking]);

  // Handle respec
  const handleRespec = useCallback(async () => {
    if (respeccing || !classProgress || classProgress.pointsSpent === 0) return;

    const pointsReturned = calculateRespecReturn(classProgress.pointsSpent);
    const pointsLost = classProgress.pointsSpent - pointsReturned;

    if (!confirm(`Reset drzewka ${selectedClass}?\n\nOdzyskasz: ${pointsReturned} MP\nStracisz: ${pointsLost} MP (50% kara)`)) {
      return;
    }

    setRespeccing(true);
    try {
      await respecClassAndRefresh(selectedClass);
      setSelectedNodeId(null);
    } finally {
      setRespeccing(false);
    }
  }, [respeccing, classProgress, selectedClass]);

  // Get selected node data
  const selectedNode = useMemo(() => {
    if (!selectedNodeId || !treeDefinition) return null;
    return treeDefinition.nodes.find(n => n.id === selectedNodeId) ?? null;
  }, [selectedNodeId, treeDefinition]);

  // Get hovered node data
  const hoveredNode = useMemo(() => {
    if (!hoveredNodeId || !treeDefinition) return null;
    return treeDefinition.nodes.find(n => n.id === hoveredNodeId) ?? null;
  }, [hoveredNodeId, treeDefinition]);

  if (!isVisible) return null;

  return (
    <Modal
      isOpen={isVisible}
      onClose={closeMasteryModal}
      size="fullscreen"
      bodyClass={styles.modalBody}
    >
      {/* Header */}
      <div class={styles.header}>
        <div class={styles.headerLeft}>
          <h2 class={styles.headerTitle}>{t('masteryTree.title')}</h2>
        </div>
        <div class={styles.headerRight}>
          <div class={styles.pointsDisplay}>
            <span class={styles.pointsLabel}>{t('masteryTree.availablePoints')}</span>
            <span class={styles.pointsValue}>{availablePoints}</span>
            <DustIcon size={16} className={styles.pointsIcon} />
          </div>
        </div>
      </div>

      {/* Class Tabs */}
      <div class={styles.classTabs}>
        {CLASS_CONFIGS.map(config => {
          const summary = getClassSummary(config.id);
          return (
            <button
              key={config.id}
              class={`${styles.classTab} ${selectedClass === config.id ? styles.active : ''}`}
              data-class={config.id}
              onClick={() => handleClassChange(config.id)}
            >
              <span class={styles.classTabIcon}>{config.icon}</span>
              <span class={styles.classTabName}>{config.name}</span>
              <span class={styles.classTabProgress}>
                {t('masteryTree.nodesUnlocked', { unlocked: summary.unlocked, total: treeDefinition?.totalNodes ?? 18 })}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Content */}
      <div class={styles.treeContainer}>
        {state.isLoading ? (
          <div class={styles.loading}>
            <div class={styles.loadingSpinner} />
            <span class={styles.loadingText}>{t('masteryTree.loading')}</span>
          </div>
        ) : state.error ? (
          <div class={styles.error}>
            <span class={styles.errorIcon}>⚠️</span>
            <span class={styles.errorText}>{state.error}</span>
            <button class={styles.retryButton} onClick={() => loadMasteryData()}>
              {t('masteryTree.retry')}
            </button>
          </div>
        ) : treeDefinition && classProgress ? (
          <>
            {/* Tree Canvas */}
            <div class={styles.treeCanvas}>
              <MasteryTree
                tree={treeDefinition}
                progress={classProgress}
                availablePoints={availablePoints}
                selectedNodeId={selectedNodeId}
                onNodeClick={handleNodeClick}
                onNodeHover={handleNodeHover}
              />
            </div>

            {/* Details Panel */}
            <div class={styles.detailsPanel}>
              <div class={styles.detailsHeader}>
                <div class={styles.detailsClassName}>{treeDefinition.name}</div>
                <div class={styles.detailsClassDesc}>{treeDefinition.description}</div>
              </div>

              <div class={styles.detailsStats}>
                <div class={styles.detailsStat}>
                  <span class={styles.detailsStatLabel}>{t('masteryTree.pointsSpent')}</span>
                  <span class={styles.detailsStatValue}>{classProgress.pointsSpent}</span>
                </div>
                <div class={styles.detailsStat}>
                  <span class={styles.detailsStatLabel}>{t('masteryTree.unlockedNodes')}</span>
                  <span class={styles.detailsStatValue}>
                    {classProgress.unlockedNodes.length}/{treeDefinition.totalNodes}
                  </span>
                </div>

                <div class={styles.progressBarContainer}>
                  <div class={styles.progressBarLabel}>
                    <span>{t('masteryTree.progress')}</span>
                    <span>{Math.round((classProgress.unlockedNodes.length / treeDefinition.totalNodes) * 100)}%</span>
                  </div>
                  <div class={styles.progressBar}>
                    <div
                      class={styles.progressBarFill}
                      style={{ width: `${(classProgress.unlockedNodes.length / treeDefinition.totalNodes) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Selected Node Info */}
              {selectedNode ? (
                <SelectedNodePanel
                  node={selectedNode}
                  isUnlocked={isNodeUnlocked(selectedNode.id)}
                  canUnlock={canUnlockNode(selectedNode, classProgress, availablePoints)}
                  onUnlock={() => handleUnlock(selectedNode.id)}
                  unlocking={unlocking}
                />
              ) : (
                <div class={styles.emptySelection}>
                  <span class={styles.emptyIcon}>🎯</span>
                  <span class={styles.emptyText}>{t('masteryTree.selectNode')}</span>
                </div>
              )}

              {/* Respec Section */}
              <div class={styles.respecSection}>
                <button
                  class={styles.respecButton}
                  onClick={handleRespec}
                  disabled={respeccing || classProgress.pointsSpent === 0}
                >
                  {respeccing ? t('masteryTree.respecInProgress') : t('masteryTree.respec')}
                </button>
                <div class={styles.respecWarning}>
                  {t('masteryTree.respecWarning')}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* Floating Tooltip */}
      {hoveredNode && (
        <div
          ref={tooltipRef}
          class={`${styles.tooltip} ${styles.visible}`}
          style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
        >
          <NodeTooltip
            node={hoveredNode}
            isUnlocked={isNodeUnlocked(hoveredNode.id)}
            canUnlock={classProgress ? canUnlockNode(hoveredNode, classProgress, availablePoints) : { canUnlock: false }}
          />
        </div>
      )}
    </Modal>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface MasteryTreeProps {
  tree: MasteryTreeDefinition;
  progress: { pointsSpent: number; unlockedNodes: string[] };
  availablePoints: number;
  selectedNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
  onNodeHover: (nodeId: string | null, event?: MouseEvent) => void;
}

function MasteryTree({ tree, progress, availablePoints, selectedNodeId, onNodeClick, onNodeHover }: MasteryTreeProps) {
  // Calculate node positions
  const nodesByTier = useMemo(() => {
    const tiers: Record<number, MasteryNodeDefinition[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    for (const node of tree.nodes) {
      tiers[node.tier].push(node);
    }
    return tiers;
  }, [tree.nodes]);

  // Calculate grid positions
  const nodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    const TIER_HEIGHT = 120;
    const NODE_WIDTH = 100;
    const START_Y = 40;

    for (let tier = 1; tier <= 5; tier++) {
      const nodesInTier = nodesByTier[tier];
      const tierY = START_Y + (tier - 1) * TIER_HEIGHT;
      const totalWidth = nodesInTier.length * NODE_WIDTH;
      const startX = (800 - totalWidth) / 2 + NODE_WIDTH / 2;

      nodesInTier.forEach((node, index) => {
        positions[node.id] = {
          x: startX + index * NODE_WIDTH,
          y: tierY,
        };
      });
    }

    return positions;
  }, [nodesByTier]);

  return (
    <div class={styles.treeContent}>
      {/* Tier Labels */}
      <div class={styles.tierLabels}>
        {[1, 2, 3, 4, 5].map(tier => (
          <div key={tier} class={styles.tierLabel}>
            Tier {tier}
          </div>
        ))}
      </div>

      {/* Nodes */}
      <div class={styles.nodesGrid}>
        {tree.nodes.map(node => {
          const pos = nodePositions[node.id];
          const unlocked = progress.unlockedNodes.includes(node.id);
          const { canUnlock: isAvailable } = canUnlockNode(node, progress, availablePoints);
          const isSelected = selectedNodeId === node.id;

          return (
            <div
              key={node.id}
              class={styles.nodeWrapper}
              style={{ left: `${pos.x - 40}px`, top: `${pos.y - 40}px` }}
            >
              <button
                class={[
                  styles.node,
                  unlocked ? styles.unlocked : '',
                  isAvailable && !unlocked ? styles.available : '',
                  !unlocked && !isAvailable ? styles.locked : '',
                  node.type === 'capstone' ? styles.capstone : '',
                  isSelected ? styles.selected : '',
                ].filter(Boolean).join(' ')}
                onClick={() => onNodeClick(node.id)}
                onMouseEnter={(e) => onNodeHover(node.id, e as unknown as MouseEvent)}
                onMouseLeave={() => onNodeHover(null)}
              >
                <span class={styles.nodeIcon}>{NODE_TYPE_ICONS[node.type] || '📊'}</span>
                <span class={styles.nodeCost}>
                  <span class={styles.nodeCostValue}>{node.cost}</span>
                </span>
              </button>
              <span class={styles.nodeName}>{node.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface SelectedNodePanelProps {
  node: MasteryNodeDefinition;
  isUnlocked: boolean;
  canUnlock: { canUnlock: boolean; reason?: string };
  onUnlock: () => void;
  unlocking: boolean;
}

function SelectedNodePanel({ node, isUnlocked, canUnlock, onUnlock, unlocking }: SelectedNodePanelProps) {
  const effects = getNodeEffectsList(node);

  return (
    <div class={styles.selectedNode}>
      <div class={styles.selectedNodeHeader}>
        <div class={styles.selectedNodeIcon}>
          {NODE_TYPE_ICONS[node.type] || '📊'}
        </div>
        <div class={styles.selectedNodeTitle}>
          <div class={styles.selectedNodeName}>{node.name}</div>
          <div class={styles.selectedNodeTier}>Tier {node.tier} • {node.cost} MP</div>
        </div>
      </div>

      <div class={styles.selectedNodeDesc}>{node.description}</div>

      {effects.length > 0 && (
        <div class={styles.selectedNodeEffects}>
          {effects.map((effect, i) => (
            <div key={i} class={styles.effectItem}>{effect}</div>
          ))}
        </div>
      )}

      <button
        class={`${styles.unlockButton} ${isUnlocked ? styles.unlocked : ''}`}
        onClick={onUnlock}
        disabled={isUnlocked || !canUnlock.canUnlock || unlocking}
      >
        {unlocking ? (
          'Odblokowywanie...'
        ) : isUnlocked ? (
          <>✓ Odblokowane</>
        ) : canUnlock.canUnlock ? (
          <>Odblokuj za {node.cost} MP</>
        ) : (
          canUnlock.reason || 'Niedostepne'
        )}
      </button>
    </div>
  );
}

interface NodeTooltipProps {
  node: MasteryNodeDefinition;
  isUnlocked: boolean;
  canUnlock: { canUnlock: boolean; reason?: string };
}

function NodeTooltip({ node, isUnlocked, canUnlock }: NodeTooltipProps) {
  const effects = getNodeEffectsList(node);

  return (
    <>
      <div class={styles.tooltipHeader}>
        <span class={styles.tooltipName}>{node.name}</span>
        <span class={styles.tooltipCost}>{node.cost} MP</span>
      </div>
      <div class={styles.tooltipTier}>Tier {node.tier} • {node.type.replace('_', ' ')}</div>
      <div class={styles.tooltipDescription}>{node.description}</div>

      {effects.length > 0 && (
        <div class={styles.tooltipEffects}>
          {effects.map((effect, i) => (
            <div key={i} class={styles.tooltipEffect}>{effect}</div>
          ))}
        </div>
      )}

      <div class={`${styles.tooltipStatus} ${isUnlocked ? styles.unlocked : canUnlock.canUnlock ? styles.available : styles.locked}`}>
        {isUnlocked ? '✓ Odblokowane' : canUnlock.canUnlock ? '⬆ Kliknij aby odblokowac' : canUnlock.reason || 'Zablokowane'}
      </div>
    </>
  );
}

export default MasteryTreeModal;
