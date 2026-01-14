/**
 * CrystalMatrix - Displays all 6 Infinity Stones in a hexagonal arrangement
 *
 * Shows the player's crystal collection progress with fragment counts.
 */

import type { JSX } from 'preact';
import type { CrystalType } from '@arcade/sim-core';
import { CrystalIcon } from './CrystalIcon.js';
import styles from './CrystalMatrix.module.css';

export interface CrystalProgress {
  power: number;
  space: number;
  time: number;
  reality: number;
  soul: number;
  mind: number;
}

export interface CrystalMatrixProps {
  /** Fragment counts for each crystal (0-10) */
  progress: CrystalProgress;
  /** Size of individual crystals (default: 48) */
  crystalSize?: number;
  /** Whether the matrix is fully assembled */
  matrixComplete?: boolean;
  /** Callback when a crystal is clicked */
  onCrystalClick?: (crystalType: CrystalType) => void;
  /** Optional custom class */
  class?: string;
  /** Layout style */
  layout?: 'hexagon' | 'row' | 'grid';
  /** Show fragment counts */
  showCounts?: boolean;
}

const CRYSTAL_ORDER: CrystalType[] = ['power', 'space', 'time', 'reality', 'soul', 'mind'];

export function CrystalMatrix({
  progress,
  crystalSize = 48,
  matrixComplete = false,
  onCrystalClick,
  class: className,
  layout = 'hexagon',
  showCounts = true,
}: CrystalMatrixProps): JSX.Element {
  const totalFragments = Object.values(progress).reduce((sum, f) => sum + f, 0);
  const completeCrystals = Object.values(progress).filter(f => f >= 10).length;

  const containerClasses = [
    styles.crystalMatrix,
    styles[layout],
    matrixComplete ? styles.matrixComplete : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div class={containerClasses}>
      {/* Progress summary */}
      <div class={styles.progressSummary}>
        <span class={styles.progressText}>
          {completeCrystals}/6 Crystals
        </span>
        <span class={styles.fragmentText}>
          {totalFragments}/60 Fragments
        </span>
      </div>

      {/* Crystal arrangement */}
      <div class={styles.crystalArrangement}>
        {CRYSTAL_ORDER.map((crystalType, index) => (
          <div
            key={crystalType}
            class={`${styles.crystalSlot} ${styles[`slot${index}`]}`}
            data-crystal={crystalType}
          >
            <CrystalIcon
              crystalType={crystalType}
              fragments={progress[crystalType]}
              size={crystalSize}
              animated={!matrixComplete}
              showFragmentCount={showCounts}
              onClick={onCrystalClick ? () => onCrystalClick(crystalType) : undefined}
            />
          </div>
        ))}
      </div>

      {/* Matrix completion indicator */}
      {matrixComplete && (
        <div class={styles.matrixIndicator}>
          <span class={styles.matrixGlow}>∞</span>
          <span class={styles.matrixLabel}>MATRIX COMPLETE</span>
        </div>
      )}
    </div>
  );
}

export default CrystalMatrix;
