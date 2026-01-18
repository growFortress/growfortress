/**
 * ArtifactIcon - Preact component for displaying artifact icons
 *
 * Wraps the PixiJS ArtifactRenderer for use in Preact UI.
 */

import type { JSX } from 'preact';
import { useEffect, useRef, useMemo } from 'preact/hooks';
import { Application, Container } from 'pixi.js';
import type { ArtifactVisualDefinition } from '@arcade/sim-core';
import { isHeroSpecificArtifact, getArtifactById } from '@arcade/sim-core';
import { ArtifactRenderer, ARTIFACT_VISUALS } from '../../renderer/items/index.js';
import styles from './ArtifactIcon.module.css';

export interface ArtifactIconProps {
  /** Artifact ID to display */
  artifactId: string;
  /** Size in pixels (default: 64) */
  size?: number;
  /** Whether to show glow effects (default: true) */
  showGlow?: boolean;
  /** Whether to animate (default: true) */
  animated?: boolean;
  /** Optional click handler */
  onClick?: () => void;
  /** Optional custom class */
  class?: string;
  /** Show tooltip on hover */
  showTooltip?: boolean;
  /** Show hero-specific badge (default: true) */
  showHeroSpecificBadge?: boolean;
}

// Track active icons for cleanup
let activeIcons = 0;

export function ArtifactIcon({
  artifactId,
  size = 64,
  showGlow = true,
  animated = true,
  onClick,
  class: className,
  showHeroSpecificBadge = true,
}: ArtifactIconProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<Container | null>(null);
  const appRef = useRef<Application | null>(null);

  // Get visual definition for this artifact
  const visual = useMemo<ArtifactVisualDefinition | undefined>(() => {
    return ARTIFACT_VISUALS[artifactId];
  }, [artifactId]);

  // Check if this is a hero-specific artifact
  const heroSpecificInfo = useMemo(() => {
    if (!showHeroSpecificBadge) return null;
    const isSpecific = isHeroSpecificArtifact(artifactId);
    if (!isSpecific) return null;

    const artifact = getArtifactById(artifactId);
    if (!artifact) return null;

    const heroIds = artifact.requirements.heroIds || (artifact.requirements.heroId ? [artifact.requirements.heroId] : []);
    return { heroIds };
  }, [artifactId, showHeroSpecificBadge]);

  useEffect(() => {
    if (!canvasRef.current || !visual) return;

    activeIcons++;

    // Create a dedicated app for this icon
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

      const renderer = new ArtifactRenderer();

      // Create artifact container
      const container = renderer.createArtifact(artifactId, visual, {
        size,
        showGlow,
        animated,
      });

      // Center in view
      container.x = size / 2;
      container.y = size / 2;

      app.stage.addChild(container);
      containerRef.current = container;

      // Start animation loop if animated
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
      activeIcons--;
    };
  }, [artifactId, visual, size, showGlow, animated]);

  if (!visual) {
    // Fallback for unknown artifacts
    return (
      <div
        class={`${styles.artifactIcon} ${styles.unknown} ${className || ''}`}
        style={{ width: size, height: size }}
        onClick={onClick}
      >
        ?
      </div>
    );
  }

  // Calculate badge size based on icon size
  const badgeSize = Math.max(16, Math.floor(size * 0.35));

  return (
    <div
      class={`${styles.artifactWrapper} ${onClick ? styles.clickable : ''} ${className || ''}`}
      style={{ width: size, height: size, position: 'relative' }}
      onClick={onClick}
    >
      <canvas
        ref={canvasRef}
        class={styles.artifactIcon}
        style={{ width: size, height: size }}
      />
      {heroSpecificInfo && (
        <div
          class={styles.heroSpecificBadge}
          style={{
            width: badgeSize,
            height: badgeSize,
            fontSize: `${badgeSize * 0.7}px`,
          }}
          title={`Hero-specific: ${heroSpecificInfo.heroIds.join(', ')}`}
        >
          ⭐
        </div>
      )}
    </div>
  );
}

export default ArtifactIcon;
