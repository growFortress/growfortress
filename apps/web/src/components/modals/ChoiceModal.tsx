import { getRelicById } from '@arcade/sim-core';
import { showChoiceModal, choiceOptions, hideChoice } from '../../state/index.js';

interface ChoiceModalProps {
  onSelect: (index: number) => void;
}

export function ChoiceModal({ onSelect }: ChoiceModalProps) {
  const handleSelect = (index: number) => {
    hideChoice();
    onSelect(index);
  };

  return (
    <div class={`choice-modal ${showChoiceModal.value ? 'visible' : ''}`}>
      <h2>Choose a Relic</h2>
      <div class="choice-options">
        {choiceOptions.value.map((relicId, index) => {
          const relic = getRelicById(relicId);
          if (!relic) return null;

          return (
            <div
              key={relicId}
              class={`choice-option ${relic.isBuildDefining ? 'build-defining' : ''}`}
              onClick={() => handleSelect(index)}
            >
              <h3>{relic.name}</h3>
              <p>{relic.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
