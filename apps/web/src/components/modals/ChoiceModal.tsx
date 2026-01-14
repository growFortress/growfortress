import { getRelicById } from '@arcade/sim-core';
import { showChoiceModal, choiceOptions, hideChoice } from '../../state/index.js';
import { Modal } from '../shared/Modal.js';

interface ChoiceModalProps {
  onSelect: (index: number) => void;
}

export function ChoiceModal({ onSelect }: ChoiceModalProps) {
  const handleSelect = (index: number) => {
    hideChoice();
    onSelect(index);
  };

  return (
    <Modal
      visible={showChoiceModal.value}
      title="Wybierz Relikt"
      onClose={hideChoice}
      size="xlarge"
      class="choice-modal"
      ariaLabel="Relic Selection"
    >
      <div class="choice-options">
        {choiceOptions.value.map((relicId, index) => {
          const relic = getRelicById(relicId);
          if (!relic) return null;

          return (
            <button
              type="button"
              key={relicId}
              class={`choice-option ${relic.isBuildDefining ? 'build-defining' : ''}`}
              onClick={() => handleSelect(index)}
              aria-label={`Select ${relic.name}: ${relic.description}`}
            >
              <h3>{relic.name}</h3>
              <p>{relic.description}</p>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
