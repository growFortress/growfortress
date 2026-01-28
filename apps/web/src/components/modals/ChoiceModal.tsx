import { getRelicById, type ExtendedRelicDef } from "@arcade/sim-core";
import { useTranslation } from "../../i18n/useTranslation.js";
import {
  showChoiceModal,
  choiceOptions,
  hideChoice,
} from "../../state/index.js";
import { Modal } from "../shared/Modal.js";

interface ChoiceModalProps {
  onSelect: (index: number) => void;
}

// Rarity labels and icons
const RARITY_LABELS: Record<string, string> = {
  common: 'Zwykły',
  rare: 'Rzadki',
  epic: 'Epicki',
  legendary: 'Legendarny',
};

// Category icons (emoji for simplicity, could be replaced with SVG)
const CATEGORY_ICONS: Record<string, string> = {
  build_defining: '⚡',
  standard: '⚔️',
  class: '🏛️',
  pillar: '🔮',
  synergy: '🔗',
  economy: '💰',
  cursed: '💀',
};

function getRelicCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    build_defining: 'Definiujący Build',
    standard: 'Standardowy',
    class: 'Klasowy',
    pillar: 'Filarowy',
    synergy: 'Synergia',
    economy: 'Ekonomia',
    cursed: 'Przeklęty',
  };
  return labels[category] || category;
}

export function ChoiceModal({ onSelect }: ChoiceModalProps) {
  const { t } = useTranslation(["modals", "game"]);
  const modalTitle = t("choice.title", { ns: "modals" });

  const handleSelect = (index: number) => {
    hideChoice();
    onSelect(index);
  };

  return (
    <Modal
      visible={showChoiceModal.value}
      title={modalTitle}
      size="xlarge"
      class="choice-modal"
      ariaLabel={modalTitle}
      closeOnBackdropClick={false}
      showCloseButton={false}
    >
      <div class="choice-options" data-tutorial="relic-choice">
        {choiceOptions.value.map((relicId, index) => {
          const relic = getRelicById(relicId) as ExtendedRelicDef | undefined;
          if (!relic) return null;

          const relicName = t(`relicsCatalog.items.${relic.id}.name`, {
            ns: "game",
            defaultValue: relic.name,
          });
          const relicDescription = t(
            `relicsCatalog.items.${relic.id}.description`,
            {
              ns: "game",
              defaultValue: relic.description,
            },
          );

          const rarityClass = relic.rarity || 'common';
          const categoryIcon = CATEGORY_ICONS[relic.category] || '📦';
          const rarityLabel = RARITY_LABELS[rarityClass] || 'Zwykły';
          const categoryLabel = getRelicCategoryLabel(relic.category);

          return (
            <button
              type="button"
              key={relicId}
              class={`choice-option rarity-${rarityClass} ${relic.isBuildDefining ? "build-defining" : ""} ${relic.category === 'cursed' ? "cursed" : ""}`}
              onClick={() => handleSelect(index)}
              aria-label={`${relicName}: ${relicDescription}`}
            >
              {/* Rarity badge */}
              <div class={`relic-rarity-badge rarity-${rarityClass}`}>
                {rarityLabel}
              </div>

              {/* Category indicator */}
              <div class="relic-category">
                <span class="category-icon">{categoryIcon}</span>
                <span class="category-label">{categoryLabel}</span>
              </div>

              {/* Relic name */}
              <h3 class="relic-name">{relicName}</h3>

              {/* Relic description */}
              <p class="relic-description">{relicDescription}</p>

              {/* Curse warning */}
              {relic.curse && (
                <div class="relic-curse-warning">
                  <span class="curse-icon">⚠️</span>
                  <span class="curse-text">{relic.curse.description}</span>
                </div>
              )}

              {/* Visual effects overlay */}
              <div class="relic-glow-overlay"></div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
