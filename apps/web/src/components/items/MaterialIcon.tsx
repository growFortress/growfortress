/**
 * MaterialIcon - Preact component for displaying material icons
 *
 * Wraps the PixiJS MaterialRenderer for use in Preact UI.
 */

import type { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { Application, Container } from 'pixi.js';
import type { MaterialType } from '@arcade/sim-core';
import { MaterialRenderer, MATERIAL_VISUALS } from '../../renderer/items/index.js';
import styles from './MaterialIcon.module.css';

export interface MaterialIconProps {
  /** Material type to display */
  materialType: MaterialType;
  /** Quantity to display (optional badge) */
  quantity?: number;
  /** Size in pixels (default: 48) */
  size?: number;
  /** Whether to animate (default: true) */
  animated?: boolean;
  /** Optional click handler */
  onClick?: () => void;
  /** Optional custom class */
  class?: string;
  /** Whether the material is selected */
  selected?: boolean;
  /** Whether the material is disabled/unavailable */
  disabled?: boolean;
}

export function MaterialIcon({
  materialType,
  quantity,
  size = 48,
  animated = true,
  onClick,
  class: className,
  selected = false,
  disabled = false,
}: MaterialIconProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<Container | null>(null);
  const appRef = useRef<Application | null>(null);

  const visual = MATERIAL_VISUALS[materialType];

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

      const renderer = new MaterialRenderer();

      const container = renderer.createMaterial(materialType, materialType, {
        size,
        animated,
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
  }, [materialType, visual, size, animated]);

  if (!visual) {
    return (
      <div
        class={`${styles.materialIcon} ${styles.unknown} ${className || ''}`}
        style={{ width: size, height: size }}
        onClick={onClick}
      >
        ?
      </div>
    );
  }

  const containerClasses = [
    styles.materialContainer,
    onClick ? styles.clickable : '',
    selected ? styles.selected : '',
    disabled ? styles.disabled : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div class={containerClasses} style={{ width: size, height: size }}>
      <canvas
        ref={canvasRef}
        class={styles.materialIcon}
        style={{ width: size, height: size }}
        onClick={disabled ? undefined : onClick}
      />
      {quantity !== undefined && quantity > 0 && (
        <span class={styles.quantityBadge}>
          {quantity >= 1000 ? `${(quantity / 1000).toFixed(1)}k` : quantity}
        </span>
      )}
    </div>
  );
}

export default MaterialIcon;
