/**
 * CrystalIcon - Preact component for displaying crystal/Infinity Stone icons
 *
 * Supports full crystals and fragment states (0-10 fragments = 1 full crystal).
 */

import type { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { Application, Container } from 'pixi.js';
import type { CrystalType } from '@arcade/sim-core';
import { CrystalRenderer, CRYSTAL_VISUALS } from '../../renderer/items/index.js';
import styles from './CrystalIcon.module.css';

export interface CrystalIconProps {
  /** Crystal type to display */
  crystalType: CrystalType;
  /** Number of fragments (0-10, 10 = full crystal) */
  fragments?: number;
  /** Whether the crystal is fully acquired */
  isComplete?: boolean;
  /** Size in pixels (default: 56) */
  size?: number;
  /** Whether to animate (default: true) */
  animated?: boolean;
  /** Optional click handler */
  onClick?: () => void;
  /** Optional custom class */
  class?: string;
  /** Show fragment count badge */
  showFragmentCount?: boolean;
}

// Crystal display names for tooltips
const CRYSTAL_NAMES: Record<CrystalType, string> = {
  power: 'Power Stone',
  space: 'Space Stone',
  time: 'Time Stone',
  reality: 'Reality Stone',
  soul: 'Soul Stone',
  mind: 'Mind Stone',
};

export function CrystalIcon({
  crystalType,
  fragments = 0,
  isComplete,
  size = 56,
  animated = true,
  onClick,
  class: className,
  showFragmentCount = true,
}: CrystalIconProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<Container | null>(null);
  const appRef = useRef<Application | null>(null);

  const visual = CRYSTAL_VISUALS[crystalType];
  const complete = isComplete ?? fragments >= 10;

  useEffect(() => {
    if (!canvasRef.current || !visual) return;

    const app = new Application();
    appRef.current = app;

    const initApp = async () => {
      await app.init({
        canvas: canvasRef.current!,
        width: size,
        height: size,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      const renderer = new CrystalRenderer();

      const container = renderer.createCrystal(crystalType, crystalType, {
        size,
        animated,
        fragmentCount: complete ? 10 : fragments,
        isFullCrystal: complete,
      });

      container.x = size / 2;
      container.y = size / 2;

      app.stage.addChild(container);
      containerRef.current = container;

      if (animated) {
        app.ticker.add(() => {
          renderer.update(app.ticker.deltaMS / 1000);
        });
      }
    };

    initApp();

    return () => {
      if (containerRef.current) {
        containerRef.current.destroy({ children: true });
        containerRef.current = null;
      }
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, [crystalType, visual, size, animated, complete, fragments]);

  if (!visual) {
    return (
      <div
        class={`${styles.crystalIcon} ${styles.unknown} ${className || ''}`}
        style={{ width: size, height: size }}
        onClick={onClick}
      >
        ?
      </div>
    );
  }

  const containerClasses = [
    styles.crystalContainer,
    complete ? styles.complete : styles.incomplete,
    onClick ? styles.clickable : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      class={containerClasses}
      style={{ width: size, height: size }}
      data-tooltip={CRYSTAL_NAMES[crystalType]}
    >
      <canvas
        ref={canvasRef}
        class={styles.crystalIcon}
        style={{ width: size, height: size }}
        onClick={onClick}
      />
      {showFragmentCount && !complete && (
        <span class={styles.fragmentBadge}>
          {fragments}/10
        </span>
      )}
      {complete && (
        <span class={styles.completeBadge}>✓</span>
      )}
    </div>
  );
}

export default CrystalIcon;
