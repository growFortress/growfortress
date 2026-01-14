import { useState } from 'preact/hooks';
import type { PlayerArtifact } from '@arcade/protocol';
import type { ArtifactDefinition } from '@arcade/sim-core';
import { unequippedArtifacts } from '../../../state/artifacts.signals.js';
import { Button } from '../../shared/Button.js';
import styles from './ArtifactPickerModal.module.css';

// Artifact slot icons
const SLOT_ICONS: Record<string, string> = {
  weapon: '⚔️',
  armor: '🛡️',
  accessory: '💍',
  gadget: '🔧',
  book: '📖',
  special: '⭐',
};

interface ArtifactPickerModalProps {
  visible: boolean;
  heroId: string;
  onClose: () => void;
  onEquip: (artifactInstanceId: string) => Promise<void>;
}

export function ArtifactPickerModal({
  visible,
  heroId: _heroId,
  onClose,
  onEquip,
}: ArtifactPickerModalProps) {
  const artifacts = unequippedArtifacts.value;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
            Wróć
          </button>
          <h3 class={styles.title}>Wybierz Artefakt</h3>
        </div>

        {/* Content */}
        <div class={styles.content}>
          {artifacts.length === 0 ? (
            <div class={styles.emptyState}>
              <span class={styles.emptyIcon}>📦</span>
              <p>Brak dostępnych artefaktów</p>
              <span class={styles.emptyHint}>
                Zdobywaj artefakty poprzez crafting lub gameplay
              </span>
            </div>
          ) : (
            <>
              <div class={styles.artifactList}>
                {artifacts.map((artifact) => (
                  <ArtifactOption
                    key={artifact.id}
                    artifact={artifact}
                    isSelected={selectedId === artifact.id}
                    onSelect={() => setSelectedId(artifact.id)}
                  />
                ))}
              </div>

              {selectedArtifact && (
                <div class={styles.previewSection}>
                  <h4 class={styles.previewTitle}>Podgląd efektów</h4>
                  <div class={styles.effectsList}>
                    {selectedArtifact.definition.effects.map((effect, idx) => (
                      <div key={idx} class={styles.effectItem}>
                        <span class={styles.effectIcon}>✦</span>
                        <span class={styles.effectDesc}>{effect.description}</span>
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
            Anuluj
          </Button>
          <Button
            variant="primary"
            disabled={!selectedId || isLoading}
            onClick={handleEquip}
          >
            {isLoading ? 'Zakładanie...' : 'Załóż'}
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
  onSelect: () => void;
}

function ArtifactOption({ artifact, isSelected, onSelect }: ArtifactOptionProps) {
  const { definition } = artifact;

  return (
    <button
      class={`${styles.artifactOption} ${styles[definition.rarity]} ${isSelected ? styles.selected : ''}`}
      onClick={onSelect}
    >
      <span class={styles.artifactIcon}>
        {SLOT_ICONS[definition.slot] || '📦'}
      </span>
      <div class={styles.artifactInfo}>
        <span class={styles.artifactName}>{definition.polishName}</span>
        <span class={styles.artifactSlot}>{definition.slot}</span>
      </div>
      <span class={styles.rarityBadge}>{definition.rarity}</span>
      {isSelected && <span class={styles.checkmark}>✓</span>}
    </button>
  );
}
