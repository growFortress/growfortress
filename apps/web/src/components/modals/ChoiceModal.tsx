import { getRelicById } from "@arcade/sim-core";
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
      onClose={hideChoice}
      size="xlarge"
      class="choice-modal"
      ariaLabel={modalTitle}
    >
      <div class="choice-options">
        {choiceOptions.value.map((relicId, index) => {
          const relic = getRelicById(relicId);
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

          return (
            <button
              type="button"
              key={relicId}
              class={`choice-option ${relic.isBuildDefining ? "build-defining" : ""}`}
              onClick={() => handleSelect(index)}
              aria-label={`${relicName}: ${relicDescription}`}
            >
              <h3>{relicName}</h3>
              <p>{relicDescription}</p>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
