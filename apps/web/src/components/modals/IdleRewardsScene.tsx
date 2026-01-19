/**
 * IdleRewardsScene - Mini preview of colony scene for the modal
 *
 * Shows a small preview of the colonies. For full management,
 * users should open the full-screen colony scene via GameApp.
 */

import type { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { Application } from 'pixi.js';
import type { ColonyStatus } from '@arcade/protocol';
import { ColonyScene } from '../../renderer/scenes/ColonyScene.js';
import styles from './IdleRewardsModal.module.css';

// Fixed dimensions for the modal preview
const PREVIEW_WIDTH = 400;
const PREVIEW_HEIGHT = 250;

export interface IdleRewardsSceneProps {
  /** Colonies to display */
  colonies: ColonyStatus[];
  /** Whether the scene is visible */
  visible: boolean;
  /** Callback when a building is clicked */
  onBuildingClick?: (colonyId: string) => void;
  /** Colony being upgraded (to trigger animation) */
  upgradingColonyId?: string | null;
}

export function IdleRewardsScene({
  colonies,
  visible,
  onBuildingClick,
  upgradingColonyId,
}: IdleRewardsSceneProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<ColonyScene | null>(null);
  const appRef = useRef<Application | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Initialize Pixi app
  useEffect(() => {
    if (!canvasRef.current || !visible) return;

    let destroyed = false;
    const app = new Application();
    appRef.current = app;

    const initScene = async () => {
      if (destroyed) return;

      try {
        await app.init({
          canvas: canvasRef.current!,
          width: PREVIEW_WIDTH,
          height: PREVIEW_HEIGHT,
          backgroundAlpha: 0,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        });

        if (destroyed) {
          app.destroy(true);
          return;
        }

        const scene = new ColonyScene();
        scene.onResize(PREVIEW_WIDTH, PREVIEW_HEIGHT);
        scene.setColonies(colonies);

        if (onBuildingClick) {
          scene.onBuildingClick = (colonyId) => onBuildingClick(colonyId);
        }

        app.stage.addChild(scene.container);
        sceneRef.current = scene;

        // Animation loop
        lastTimeRef.current = performance.now();
        const animate = (currentTime: number) => {
          if (destroyed) return;

          const deltaMS = currentTime - lastTimeRef.current;
          lastTimeRef.current = currentTime;

          scene.update(deltaMS);
          animationFrameRef.current = requestAnimationFrame(animate);
        };

        animationFrameRef.current = requestAnimationFrame(animate);
      } catch (e) {
        console.warn('Failed to initialize IdleRewardsScene:', e);
      }
    };

    initScene();

    return () => {
      destroyed = true;

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (sceneRef.current) {
        sceneRef.current.destroy();
        sceneRef.current = null;
      }

      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, [visible]);

  // Update colonies when they change
  useEffect(() => {
    if (sceneRef.current && colonies) {
      sceneRef.current.setColonies(colonies);
    }
  }, [colonies]);

  // Update building click callback
  useEffect(() => {
    if (sceneRef.current && onBuildingClick) {
      sceneRef.current.onBuildingClick = (colonyId) => onBuildingClick(colonyId);
    }
  }, [onBuildingClick]);

  // Handle upgrade animation
  useEffect(() => {
    if (upgradingColonyId && sceneRef.current) {
      sceneRef.current.playUpgradeAnimation(upgradingColonyId);
    }
  }, [upgradingColonyId]);

  return (
    <div class={styles.sceneContainer}>
      <canvas
        ref={canvasRef}
        class={styles.colonyCanvas}
        width={PREVIEW_WIDTH}
        height={PREVIEW_HEIGHT}
      />
    </div>
  );
}

export default IdleRewardsScene;
