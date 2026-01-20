import { useState, useMemo } from 'preact/hooks';
import type { PlayerArtifact } from '@arcade/protocol';
import type { ArtifactDefinition, FortressClass } from '@arcade/sim-core';
import {
  canHeroEquipArtifact,
  isHeroSpecificArtifact,
  getHeroById,
} from '@arcade/sim-core';
import { unequippedArtifacts } from '../../../state/artifacts.signals.js';
import { Button } from '../../shared/Button.js';
import styles from './ArtifactPickerModal.module.css';
import { useTranslation } from '../../../i18n/useTranslation.js';

// Artifact slot icons
const SLOT_ICONS: Record<string, string> = {
  weapon: '⚔️',
  armor: '🛡️',
  accessory: '💍',
  gadget: '🔧',
  book: '📖',
  special: '⭐',
};

type FilterMode = 'compatible' | 'all';

interface ArtifactPickerModalProps {
  visible: boolean;
  heroId: string;
  heroTier: number;
  onClose: () => void;
  onEquip: (artifactInstanceId: string) => Promise<void>;
}

export function ArtifactPickerModal({
  visible,
  heroId,
  heroTier,
  onClose,
  onEquip,
}: ArtifactPickerModalProps) {
  const { t } = useTranslation(['common', 'game']);
  const allArtifacts = unequippedArtifacts.value;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('compatible');

  // Get hero definition for class info
  const heroDef = getHeroById(heroId);
  const heroClass: FortressClass = heroDef?.class || 'natural';

  // Filter artifacts based on hero compatibility
  const compatibleArtifacts = useMemo(() => {
    const compatible: (PlayerArtifact & { definition: ArtifactDefinition })[] = [];

    for (const artifact of allArtifacts) {
      const canEquip = canHeroEquipArtifact(
        artifact.definition.id,
        heroId,
        heroClass,
        heroTier
      );
      if (canEquip) {
        compatible.push(artifact);
      }
    }

    // Sort: hero-specific first
    compatible.sort((a, b) => {
      const aHeroSpecific = isHeroSpecificArtifact(a.definition.id);
      const bHeroSpecific = isHeroSpecificArtifact(b.definition.id);
      if (aHeroSpecific && !bHeroSpecific) return -1;
      if (!aHeroSpecific && bHeroSpecific) return 1;
      return 0;
    });

    return compatible;
  }, [allArtifacts, heroId, heroClass, heroTier]);

  const artifacts = filterMode === 'compatible' ? compatibleArtifacts : allArtifacts;

  if (!visible) return null;

  const selectedArtifact = artifacts.find((a) => a.id === selectedId);

  const handleEquip = async () => {
    if (!selectedId) return;
    setIsLoading(true);
    try {
      await onEquip(selectedId);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div class={styles.overlay} onClick={handleBackdropClick}>
      <div class={styles.modal}>
        {/* Header */}
        <div class={styles.header}>
          <button class={styles.backButton} onClick={onClose}>
            <span class={styles.backIcon}>←</span>
            {t('common:heroDetails.upgrade.back')}
          </button>
          <h3 class={styles.title}>{t('common:heroDetails.artifactPicker.title')}</h3>
        </div>

        {/* Filter Toggle */}
        <div class={styles.filterBar}>
          <button
            class={`${styles.filterButton} ${filterMode === 'compatible' ? styles.filterActive : ''}`}
            onClick={() => setFilterMode('compatible')}
          >
            {t('common:heroDetails.artifactPicker.filterCompatible')} ({compatibleArtifacts.length})
          </button>
          <button
            class={`${styles.filterButton} ${filterMode === 'all' ? styles.filterActive : ''}`}
            onClick={() => setFilterMode('all')}
          >
            {t('common:heroDetails.artifactPicker.filterAll')} ({allArtifacts.length})
          </button>
        </div>

        {/* Content */}
        <div class={styles.content}>
          {artifacts.length === 0 ? (
            <div class={styles.emptyState}>
              <span class={styles.emptyIcon}>📦</span>
              <p>
                {filterMode === 'compatible' 
                  ? t('common:heroDetails.artifactPicker.emptyCompatible') 
                  : t('common:heroDetails.artifactPicker.emptyAll')}
              </p>
              <span class={styles.emptyHint}>
                {filterMode === 'compatible'
                  ? t('common:heroDetails.artifactPicker.emptyHintCompatible')
                  : t('common:heroDetails.artifactPicker.emptyHintAll')
                }
              </span>
            </div>
          ) : (
            <>
              <div class={styles.artifactList}>
                {artifacts.map((artifact) => {
                  const isCompatible = canHeroEquipArtifact(
                    artifact.definition.id,
                    heroId,
                    heroClass,
                    heroTier
                  );
                  const heroSpecific = isHeroSpecificArtifact(artifact.definition.id);
                  return (
                    <ArtifactOption
                      key={artifact.id}
                      artifact={artifact}
                      isSelected={selectedId === artifact.id}
                      isCompatible={isCompatible}
                      isHeroSpecific={heroSpecific}
                      onSelect={() => isCompatible && setSelectedId(artifact.id)}
                    />
                  );
                })}
              </div>

              {selectedArtifact && (
                <div class={styles.previewSection}>
                  <h4 class={styles.previewTitle}>{t('common:heroDetails.artifactPicker.previewTitle')}</h4>
                  <div class={styles.effectsList}>
                    {selectedArtifact.definition.effects.map((effect, idx) => (
                      <div key={idx} class={styles.effectItem}>
                        <span class={styles.effectIcon}>✦</span>
                        <span class={styles.effectDesc}>
                          {t(`common:artifacts.${selectedArtifact.definition.id}.effects.${idx}`, effect.description)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div class={styles.footer}>
          <Button variant="secondary" onClick={onClose}>
            {t('common:heroDetails.artifactPicker.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!selectedId || isLoading}
            onClick={handleEquip}
          >
            {isLoading ? t('common:heroDetails.artifactPicker.equipping') : t('common:heroDetails.artifactPicker.equip')}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Artifact option component
interface ArtifactOptionProps {
  artifact: PlayerArtifact & { definition: ArtifactDefinition };
  isSelected: boolean;
  isCompatible: boolean;
  isHeroSpecific: boolean;
  onSelect: () => void;
}

function ArtifactOption({ artifact, isSelected, isCompatible, isHeroSpecific, onSelect }: ArtifactOptionProps) {
  const { definition } = artifact;
  const { t } = useTranslation('common');

  const classNames = [
    styles.artifactOption,
    styles[definition.rarity],
    isSelected ? styles.selected : '',
    !isCompatible ? styles.incompatible : '',
    isHeroSpecific ? styles.heroSpecific : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      class={classNames}
      onClick={onSelect}
      disabled={!isCompatible}
      title={!isCompatible ? t('heroDetails.artifactPicker.incompatibleTooltip') : undefined}
    >
      {/* Hero-specific badge */}
      {isHeroSpecific && (
        <span class={styles.heroSpecificBadge} title={t('heroDetails.artifactPicker.artifactSpecific')}>
          ⭐
        </span>
      )}

      <span class={styles.artifactIcon}>
        {SLOT_ICONS[definition.slot] || '📦'}
      </span>
      <div class={styles.artifactInfo}>
        <span class={styles.artifactName}>{t(`artifacts.${definition.id}.name`)}</span>
        <span class={styles.artifactSlot}>{definition.slot}</span>
      </div>
      <span class={styles.rarityBadge}>{definition.rarity}</span>
      {isSelected && <span class={styles.checkmark}>✓</span>}
      {!isCompatible && <span class={styles.incompatibleIcon}>🚫</span>}
    </button>
  );
}
