import { Container, Graphics, Text } from 'pixi.js';
import type { GameState, ActiveHero, HeroState } from '@arcade/sim-core';
import { FP, STORM_FORGE_SYNERGY_RANGE_SQ } from '@arcade/sim-core';
import { Tween, TweenManager } from '../animation/Tween.js';
import { easeOutQuad, easeOutElastic } from '../animation/easing.js';
import type { VFXSystem } from './VFXSystem.js';
import { getHeroColors, getHeroShapeType, getSkillVfxHandler } from './hero-config.js';
import { fpXToScreen, fpYToScreen } from '../CoordinateSystem.js';

// State colors
const STATE_COLORS: Record<HeroState, number> = {
  idle: 0x888888,
  combat: 0xff4444,
  commanded: 0x00ffff,
};

// Target visual properties for each state
const STATE_VISUALS: Record<HeroState, { scale: number; alpha: number }> = {
  idle: { scale: 1.0, alpha: 1.0 },
  combat: { scale: 1.0, alpha: 1.0 },
  commanded: { scale: 1.0, alpha: 1.0 },
};

// HP bar colors
const HP_COLORS = {
  high: 0x00ff00,
  mid: 0xffcc00,
  low: 0xff4444,
  background: 0x222222,
  border: 0x444444,
};

// Manual control indicator
const MANUAL_CONTROL_COLOR = 0x00f5ff;

// Size constants
const SIZES = {
  heroBase: 30,
  tierMultiplier: { 1: 1.0, 2: 1.15, 3: 1.3 },
  hpBarWidth: 50,
  hpBarHeight: 6,
  nameTagOffset: -50,
};

// Animation durations (ms)
const ANIMATION = {
  stateTransition: 300,
  spawn: 500,
  death: 400,
  hpChange: 200,
  combatPulse: 150,
};

const MOTION = {
  snapDistance: 0.6,
  retargetDistance: 2.0,
  forceSnapDistance: 80,
  anticipationRatio: 0.0,
  overshootRatio: 0.0,
  anticipationMax: 0,
  overshootMax: 0,
  anticipationMaxDistance: 0,
  anticipationDuration: 0,
  settleDuration: 30,
  minDuration: 16,
  maxDuration: 50,
  durationPerPixel: 0.15,
  lerpSpeed: 0.25,
};

/**
 * Animation state for smooth transitions
 */
interface HeroAnimationState {
  // Current interpolated values
  scale: number;
  alpha: number;
  hpPercent: number;

  // State transition
  isTransitioning: boolean;
  transitionProgress: number;

  // Spawn animation
  spawnProgress: number;
  isSpawning: boolean;

  // Death animation
  deathProgress: number;
  isDying: boolean;

  // Combat effects
  combatIntensity: number;

  // Offset for effects (shake, etc.)
  offsetX: number;
  offsetY: number;

  // Motion smoothing & squash/stretch
  visualX: number;
  visualY: number;
  motionSpeed: number;
  motionDirX: number;
  motionDirY: number;
  stretch: number;
}

/**
 * Dirty flags for optimized rendering
 * Only redraw components when they actually change
 */
interface DirtyFlags {
  body: boolean;      // Tier, class, or visual state changed
  hpBar: boolean;     // HP value changed
  stateIndicator: boolean;  // Combat state changed
  tierBadge: boolean; // Tier level changed
  manualIndicator: boolean; // Manual control indicator changed
}

interface HeroVisual {
  container: Container;
  lastState: HeroState;
  heroId: string;
  lastManualControlled: boolean;
  animation: HeroAnimationState;
  lastHp: number;
  lastTier: 1 | 2 | 3;
  tweenManager: TweenManager;
  scaleTween: Tween<number> | null;
  alphaTween: Tween<number> | null;
  hpTween: Tween<number> | null;
  motionTarget: { x: number; y: number };
  motionInitialized: boolean;
  lastVisualX: number;
  lastVisualY: number;
  breathingPhase: number;
  lastSkillCooldowns: Record<string, number>;
  dirty: DirtyFlags;
}

export class HeroSystem {
  public container: Container;
  private visuals: Map<string, HeroVisual> = new Map();
  private onHeroClick: ((heroId: string) => void) | null = null;
  private lastUpdateTime: number = 0;
  private lastSynergyBondTime: number = 0;

  constructor() {
    this.container = new Container();
    this.container.interactiveChildren = true;
    this.lastUpdateTime = performance.now();
  }

  /**
   * Set callback for hero click events
   */
  public setOnHeroClick(callback: (heroId: string) => void) {
    this.onHeroClick = callback;
  }

  public update(
    state: GameState,
    viewWidth: number,
    viewHeight: number,
    vfx?: VFXSystem,
    alpha: number = 1
  ) {
    const currentIds = new Set<string>();
    const { now, deltaMs, time } = this.getFrameTiming();
    // Hub mode (no VFX) = instant removal, combat mode = death animation
    const isHubMode = !vfx;

    for (const hero of state.heroes) {
      currentIds.add(hero.definitionId);

      const visual = this.syncHeroVisual(hero);
      this.applyHeroStateChanges(visual, hero);
      const screenPosition = this.getHeroScreenPosition(hero, viewWidth, viewHeight, alpha);
      this.handleSkillVfx(visual, hero, screenPosition.x, screenPosition.y, state, viewWidth, viewHeight, vfx);

      // Motion smoothing with anticipation/overshoot
      this.updateMotion(visual, screenPosition.x, screenPosition.y, deltaMs);

      // Update tweens
      visual.tweenManager.update(deltaMs);

      // Update animation state
      this.updateAnimationState(visual, hero, deltaMs);

      // Update visuals (which may apply animation offsets)
      const offset = this.updateHeroVisual(visual, hero, time);

      // Apply final position with animation offset
      this.applyHeroPosition(visual, offset);
    }

    if (vfx) {
      this.updateStormForgeBond(state, viewWidth, viewHeight, now, vfx);
    }

    // Remove dead/removed heroes (instant in hub, animated in combat)
    this.cleanupMissingHeroes(currentIds, deltaMs, isHubMode);
  }

  private getFrameTiming(): { now: number; deltaMs: number; time: number } {
    const now = performance.now();
    const deltaMs =
      this.lastUpdateTime > 0
        ? Math.min(50, Math.max(8, now - this.lastUpdateTime))
        : 16.66;
    this.lastUpdateTime = now;
    return { now, deltaMs, time: now / 1000 };
  }

  private getHeroScreenPosition(
    hero: ActiveHero,
    viewWidth: number,
    viewHeight: number,
    alpha: number
  ): { x: number; y: number } {
    const interpolated = this.getInterpolatedPosition(hero, alpha);
    return {
      x: fpXToScreen(interpolated.x, viewWidth),
      y: fpYToScreen(interpolated.y, viewHeight),
    };
  }

  private getInterpolatedPosition(hero: ActiveHero, alpha: number): { x: number; y: number } {
    const clampedAlpha = Math.max(0, Math.min(1, alpha));
    if (clampedAlpha >= 1) {
      return { x: hero.x, y: hero.y };
    }
    const backstep = FP.fromFloat(1 - clampedAlpha);
    return {
      x: FP.sub(hero.x, FP.mul(hero.vx, backstep)),
      y: FP.sub(hero.y, FP.mul(hero.vy, backstep)),
    };
  }

  private getTierKey(tier: number): 1 | 2 | 3 {
    if (tier === 1 || tier === 2 || tier === 3) {
      return tier;
    }
    return 1;
  }

  private syncHeroVisual(hero: ActiveHero): HeroVisual {
    let visual = this.visuals.get(hero.definitionId);
    if (!visual) {
      visual = this.createHeroVisual(hero);
      this.container.addChild(visual.container);
      this.visuals.set(hero.definitionId, visual);
      // Start spawn animation
      this.startSpawnAnimation(visual);
    }
    return visual;
  }

  private applyHeroStateChanges(visual: HeroVisual, hero: ActiveHero): void {
    if (visual.lastState !== hero.state) {
      this.onStateChange(visual, visual.lastState, hero.state);
      visual.lastState = hero.state;
      visual.dirty.stateIndicator = true;
      visual.dirty.body = true; // Body glow changes with combat state
    }

    const manualControlled = hero.isManualControlled === true;
    if (visual.lastManualControlled !== manualControlled) {
      visual.lastManualControlled = manualControlled;
      visual.dirty.manualIndicator = true;
    }

    const currentTier = this.getTierKey(hero.tier);
    if (visual.lastTier !== currentTier) {
      visual.lastTier = currentTier;
      visual.dirty.tierBadge = true;
      visual.dirty.body = true; // Body size changes with tier
      visual.dirty.manualIndicator = true;
    }

    const hpPercent = hero.maxHp > 0 ? hero.currentHp / hero.maxHp : 0;
    if (Math.abs(visual.lastHp - hpPercent) > 0.01) {
      this.startHpTransition(visual, visual.lastHp, hpPercent);
      visual.lastHp = hpPercent;
      visual.dirty.hpBar = true;
    }
  }

  private handleSkillVfx(
    visual: HeroVisual,
    hero: ActiveHero,
    screenX: number,
    screenY: number,
    state: GameState,
    viewWidth: number,
    viewHeight: number,
    vfx?: VFXSystem
  ): void {
    if (!vfx || !hero.skillCooldowns) {
      return;
    }

    this.detectAndTriggerSkillVFX(visual, hero, screenX, screenY, state, viewWidth, viewHeight, vfx);
  }

  private applyHeroPosition(visual: HeroVisual, offset: { x: number; y: number }): void {
    visual.container.position.set(
      visual.animation.visualX + offset.x,
      visual.animation.visualY + offset.y
    );
  }

  private cleanupMissingHeroes(currentIds: Set<string>, deltaMs: number, instant: boolean): void {
    for (const [id, visual] of this.visuals) {
      if (!currentIds.has(id)) {
        // In hub mode, remove instantly without animation
        if (instant) {
          this.container.removeChild(visual.container);
          visual.container.destroy({ children: true });
          this.visuals.delete(id);
          continue;
        }

        // In combat mode, play death animation
        if (!visual.animation.isDying) {
          this.startDeathAnimation(visual);
        }
        // Update tweens for dying heroes so death animation can complete
        visual.tweenManager.update(deltaMs);

        if (visual.animation.deathProgress >= 1) {
          this.container.removeChild(visual.container);
          visual.container.destroy({ children: true });
          this.visuals.delete(id);
        }
      }
    }
  }

  private updateStormForgeBond(
    state: GameState,
    viewWidth: number,
    viewHeight: number,
    now: number,
    vfx: VFXSystem
  ) {
    const storm = state.heroes.find(hero => hero.definitionId === 'storm' && hero.currentHp > 0);
    const forge = state.heroes.find(hero => hero.definitionId === 'forge' && hero.currentHp > 0);
    if (!storm || !forge) return;

    const distSq = FP.distSq(storm.x, storm.y, forge.x, forge.y);
    if (distSq > STORM_FORGE_SYNERGY_RANGE_SQ) return;

    if (now - this.lastSynergyBondTime < 120) return;
    this.lastSynergyBondTime = now;

    const startX = fpXToScreen(storm.x, viewWidth);
    const startY = fpYToScreen(storm.y, viewHeight);
    const endX = fpXToScreen(forge.x, viewWidth);
    const endY = fpYToScreen(forge.y, viewHeight);

    vfx.spawnSynergyBond(startX, startY, endX, endY, 1);
  }

  private createHeroVisual(hero: ActiveHero): HeroVisual {
    const container = new Container();

    // Make container interactive for click events
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointerdown', () => {
      if (this.onHeroClick) {
        this.onHeroClick(hero.definitionId);
      }
    });

    // Shadow layer (rendered below body for depth)
    const shadow = new Graphics();
    shadow.label = 'shadow';
    container.addChild(shadow);

    // Body graphics
    const body = new Graphics();
    body.label = 'body';
    container.addChild(body);

    // Manual control indicator (ring)
    const manualIndicator = new Graphics();
    manualIndicator.label = 'manual';
    manualIndicator.visible = false;
    container.addChild(manualIndicator);

    // HP bar (hidden - heroes are immortal)
    const hpBar = new Graphics();
    hpBar.label = 'hpBar';
    hpBar.position.y = -SIZES.heroBase - 15;
    hpBar.visible = false;
    container.addChild(hpBar);

    // State indicator
    const stateIndicator = new Graphics();
    stateIndicator.label = 'state';
    stateIndicator.position.y = SIZES.heroBase + 10;
    container.addChild(stateIndicator);

    // Name tag with improved styling
    const nameTag = new Text({
      text: this.getHeroDisplayName(hero.definitionId),
      style: {
        fontSize: 11,
        fill: 0xffffff,
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold',
        dropShadow: {
          color: 0x000000,
          blur: 2,
          distance: 1,
          alpha: 0.8,
        },
        letterSpacing: 0.5,
      },
    });
    nameTag.label = 'name';
    nameTag.anchor.set(0.5, 1);
    nameTag.position.y = SIZES.nameTagOffset - 5;
    container.addChild(nameTag);

    // Tier badge
    const tierBadge = new Graphics();
    tierBadge.label = 'tier';
    tierBadge.position.set(SIZES.heroBase * 0.8, -SIZES.heroBase * 0.8);
    container.addChild(tierBadge);

    const hpPercent = hero.maxHp > 0 ? hero.currentHp / hero.maxHp : 1;

    return {
      container,
      lastState: hero.state,
      heroId: hero.definitionId,
      lastManualControlled: hero.isManualControlled === true,
      lastHp: hpPercent,
      lastTier: this.getTierKey(hero.tier),
      tweenManager: new TweenManager(),
      scaleTween: null,
      alphaTween: null,
      hpTween: null,
      motionTarget: { x: 0, y: 0 },
      motionInitialized: false,
      lastVisualX: 0,
      lastVisualY: 0,
      breathingPhase: Math.random() * Math.PI * 2,
      lastSkillCooldowns: { ...hero.skillCooldowns },
      animation: {
        scale: 0, // Start at 0 for spawn animation
        alpha: 0,
        hpPercent,
        isTransitioning: false,
        transitionProgress: 0,
        spawnProgress: 0,
        isSpawning: true,
        deathProgress: 0,
        isDying: false,
        combatIntensity: 0,
        offsetX: 0,
        offsetY: 0,
        visualX: 0,
        visualY: 0,
        motionSpeed: 0,
        motionDirX: 1,
        motionDirY: 0,
        stretch: 0,
      },
      // Initialize all as dirty to force initial draw
      dirty: {
        body: true,
        hpBar: true,
        stateIndicator: true,
        tierBadge: true,
        manualIndicator: true,
      },
    };
  }

  /**
   * Start spawn animation
   * @param targetState - Optional target state to animate to (defaults to visual.lastState)
   */
  private startSpawnAnimation(visual: HeroVisual, targetState?: HeroState): void {
    visual.animation.isSpawning = true;
    visual.animation.spawnProgress = 0;

    // Use provided target state or fall back to lastState
    const targetVisuals = STATE_VISUALS[targetState ?? visual.lastState];

    // Scale from 0 to target with elastic bounce
    visual.scaleTween = new Tween(0, targetVisuals.scale, ANIMATION.spawn, {
      easing: easeOutElastic,
      onComplete: () => {
        visual.animation.isSpawning = false;
      },
    });
    visual.tweenManager.add(visual.scaleTween);

    // Fade in
    visual.alphaTween = new Tween(0, targetVisuals.alpha, ANIMATION.spawn * 0.5, {
      easing: easeOutQuad,
    });
    visual.tweenManager.add(visual.alphaTween);
  }

  /**
   * Start death animation
   */
  private startDeathAnimation(visual: HeroVisual): void {
    visual.animation.isDying = true;
    visual.animation.deathProgress = 0;

    // Scale down
    visual.scaleTween = new Tween(visual.animation.scale, 0, ANIMATION.death, {
      easing: easeOutQuad,
      onUpdate: (value) => {
        visual.animation.scale = value as number;
      },
      onComplete: () => {
        visual.animation.deathProgress = 1;
      },
    });
    visual.tweenManager.add(visual.scaleTween);

    // Fade out
    visual.alphaTween = new Tween(visual.animation.alpha, 0, ANIMATION.death, {
      easing: easeOutQuad,
      onUpdate: (value) => {
        visual.animation.alpha = value as number;
      },
    });
    visual.tweenManager.add(visual.alphaTween);
  }

  /**
   * Handle state changes with smooth transition
   */
  private onStateChange(visual: HeroVisual, fromState: HeroState, toState: HeroState): void {
    visual.animation.isTransitioning = true;
    visual.animation.transitionProgress = 0;

    const fromVisuals = STATE_VISUALS[fromState];
    const toVisuals = STATE_VISUALS[toState];

    // Smooth scale transition
    const currentScale = visual.animation.scale || fromVisuals.scale;
    visual.scaleTween = new Tween(currentScale, toVisuals.scale, ANIMATION.stateTransition, {
      easing: easeOutQuad,
      onUpdate: (value) => {
        visual.animation.scale = value as number;
      },
      onComplete: () => {
        visual.animation.isTransitioning = false;
        visual.animation.transitionProgress = 1;
      },
    });
    visual.tweenManager.add(visual.scaleTween);

    // Smooth alpha transition
    const currentAlpha = visual.animation.alpha || fromVisuals.alpha;
    visual.alphaTween = new Tween(currentAlpha, toVisuals.alpha, ANIMATION.stateTransition, {
      easing: easeOutQuad,
      onUpdate: (value) => {
        visual.animation.alpha = value as number;
      },
    });
    visual.tweenManager.add(visual.alphaTween);

    // Combat intensity pulse when entering combat
    if (toState === 'combat') {
      visual.animation.combatIntensity = 1;
    } else if (fromState === 'combat') {
      visual.animation.combatIntensity = 0;
    }
  }

  /**
   * Start HP bar transition
   */
  private startHpTransition(visual: HeroVisual, fromHp: number, toHp: number): void {
    visual.hpTween = new Tween(fromHp, toHp, ANIMATION.hpChange, {
      easing: easeOutQuad,
      onUpdate: (value) => {
        visual.animation.hpPercent = value as number;
      },
    });
    visual.tweenManager.add(visual.hpTween);
  }

  /**
   * Update animation state each frame
   */
  private updateAnimationState(
    visual: HeroVisual,
    hero: ActiveHero,
    deltaMs: number
  ): void {
    const anim = visual.animation;
    const deltaSec = Math.max(0.001, deltaMs / 1000);

    // Update spawn progress
    if (anim.isSpawning) {
      anim.spawnProgress = Math.min(1, anim.spawnProgress + deltaMs / ANIMATION.spawn);
    }

    // Update death progress
    if (anim.isDying) {
      anim.deathProgress = Math.min(1, anim.deathProgress + deltaMs / ANIMATION.death);
    }

    // Update transition progress
    if (anim.isTransitioning) {
      anim.transitionProgress = Math.min(1, anim.transitionProgress + deltaMs / ANIMATION.stateTransition);
    }

    // Get current values from tweens or calculate
    if (visual.scaleTween && !visual.scaleTween.isComplete()) {
      anim.scale = visual.scaleTween.getValue();
    }
    if (visual.alphaTween && !visual.alphaTween.isComplete()) {
      anim.alpha = visual.alphaTween.getValue();
    }
    if (visual.hpTween && !visual.hpTween.isComplete()) {
      anim.hpPercent = visual.hpTween.getValue();
    }

    // Update movement-driven stretch
    const dx = anim.visualX - visual.lastVisualX;
    const dy = anim.visualY - visual.lastVisualY;
    const dist = Math.hypot(dx, dy);
    const speed = dist / deltaSec;
    anim.motionSpeed = speed;
    if (dist > 0.001) {
      anim.motionDirX = dx / dist;
      anim.motionDirY = dy / dist;
    }

    const stretchTarget = Math.min(0.16, (speed / 520) * 0.16);
    anim.stretch += (stretchTarget - anim.stretch) * 0.18;

    visual.lastVisualX = anim.visualX;
    visual.lastVisualY = anim.visualY;

    // State-specific continuous animations
    switch (hero.state) {
      case 'idle':
        // Static idle - no animation
        break;

      case 'combat':
        // No shake - heroes move smoothly while attacking
        anim.offsetX = 0;
        anim.offsetY = 0;
        break;

      default:
        anim.offsetX = 0;
        anim.offsetY = 0;
    }
  }

  private updateHeroVisual(visual: HeroVisual, hero: ActiveHero, time: number): { x: number; y: number } {
    const { shadow, body, hpBar, stateIndicator, tierBadge, manualIndicator } = this.getHeroVisualParts(visual);
    const anim = visual.animation;
    const offset = { x: anim.offsetX, y: anim.offsetY };

    if (!body || !hpBar || !stateIndicator || !tierBadge) {
      return offset;
    }

    const colors = getHeroColors(hero.definitionId);
    const tierKey = this.getTierKey(hero.tier);
    const size = SIZES.heroBase * SIZES.tierMultiplier[tierKey];

    this.applyHeroTransforms(visual, hero, time);
    this.renderShadow(shadow, size, time, anim);
    this.renderBody(visual, body, hero, size, colors, time, anim);
    this.renderManualIndicator(visual, manualIndicator, hero, size, time);
    this.renderHpBar(visual, hpBar, anim);
    this.renderStateIndicator(visual, stateIndicator, hero.state, anim);
    this.renderTierBadge(visual, tierBadge, tierKey);

    return offset;
  }

  private getHeroVisualParts(visual: HeroVisual): {
    shadow: Graphics | null;
    body: Graphics | null;
    manualIndicator: Graphics | null;
    hpBar: Graphics | null;
    stateIndicator: Graphics | null;
    tierBadge: Graphics | null;
  } {
    return {
      shadow: visual.container.getChildByLabel('shadow') as Graphics | null,
      body: visual.container.getChildByLabel('body') as Graphics | null,
      manualIndicator: visual.container.getChildByLabel('manual') as Graphics | null,
      hpBar: visual.container.getChildByLabel('hpBar') as Graphics | null,
      stateIndicator: visual.container.getChildByLabel('state') as Graphics | null,
      tierBadge: visual.container.getChildByLabel('tier') as Graphics | null,
    };
  }

  private applyHeroTransforms(visual: HeroVisual, hero: ActiveHero, time: number): void {
    const anim = visual.animation;
    const baseScale = anim.scale || 1;
    const breatheStrength = hero.state === 'idle' ? 0.035 : 0.02;
    const breathe = 1 + Math.sin(time * 2 + visual.breathingPhase) * breatheStrength;
    const stretch = anim.stretch || 0;
    const horizontalDominant = Math.abs(anim.motionDirX) >= Math.abs(anim.motionDirY);
    const stretchX = horizontalDominant ? 1 + stretch : 1 - stretch * 0.6;
    const stretchY = horizontalDominant ? 1 - stretch * 0.6 : 1 + stretch;

    visual.container.scale.set(baseScale * breathe * stretchX, baseScale * breathe * stretchY);
    visual.container.alpha = anim.alpha || 1;
  }

  private renderShadow(
    shadow: Graphics | null,
    size: number,
    time: number,
    anim: HeroAnimationState
  ): void {
    if (!shadow) {
      return;
    }

    shadow.clear();
    if (!anim.isDying) {
      const shadowOffsetY = size * 0.9;
      const shadowWidth = size * 0.8;
      const shadowHeight = size * 0.25;
      const shadowPulse = 1 + Math.sin(time * 2) * 0.05;
      shadow.ellipse(0, shadowOffsetY, shadowWidth * shadowPulse, shadowHeight)
        .fill({ color: 0x000000, alpha: 0.35 });
    } else {
      const shadowOffsetY = size * 0.9;
      const shadowWidth = size * 0.8 * (1 - anim.deathProgress);
      const shadowHeight = size * 0.25 * (1 - anim.deathProgress);
      shadow.ellipse(0, shadowOffsetY, shadowWidth, shadowHeight)
        .fill({ color: 0x000000, alpha: 0.35 * (1 - anim.deathProgress) });
    }
  }

  private renderBody(
    visual: HeroVisual,
    body: Graphics,
    hero: ActiveHero,
    size: number,
    colors: { primary: number; secondary: number; accent: number },
    time: number,
    anim: HeroAnimationState
  ): void {
    const needsBodyRedraw = visual.dirty.body ||
                            hero.state === 'combat' ||
                            anim.isSpawning ||
                            anim.isDying ||
                            hero.tier === 3;

    if (!needsBodyRedraw) {
      return;
    }

    body.clear();
    this.drawHeroBody(body, hero, size, colors, time, anim);
    visual.dirty.body = false;
  }

  private renderManualIndicator(
    visual: HeroVisual,
    manualIndicator: Graphics | null,
    hero: ActiveHero,
    size: number,
    time: number
  ): void {
    if (!manualIndicator) {
      return;
    }

    const isManual = hero.isManualControlled === true;
    manualIndicator.visible = isManual;
    if (!isManual) {
      return;
    }

    const pulse = 0.65 + Math.sin(time * 6) * 0.2;
    manualIndicator.alpha = pulse;

    if (!visual.dirty.manualIndicator) {
      return;
    }

    manualIndicator.clear();
    const radius = size * 0.95;
    manualIndicator.circle(0, 0, radius)
      .stroke({ width: 3, color: MANUAL_CONTROL_COLOR, alpha: 0.9 });
    manualIndicator.circle(0, 0, radius * 0.55)
      .stroke({ width: 2, color: MANUAL_CONTROL_COLOR, alpha: 0.5 });
    visual.dirty.manualIndicator = false;
  }

  private renderHpBar(visual: HeroVisual, hpBar: Graphics, anim: HeroAnimationState): void {
    const isHpAnimating = visual.hpTween && !visual.hpTween.isComplete();
    if (visual.dirty.hpBar || isHpAnimating) {
      hpBar.clear();
      this.drawHpBar(hpBar, anim.hpPercent);
      if (!isHpAnimating) {
        visual.dirty.hpBar = false;
      }
    }
  }

  private renderStateIndicator(
    visual: HeroVisual,
    stateIndicator: Graphics,
    state: HeroState,
    anim: HeroAnimationState
  ): void {
    if (visual.dirty.stateIndicator || anim.isTransitioning || state === 'combat') {
      stateIndicator.clear();
      this.drawStateIndicator(stateIndicator, state, anim);
      if (!anim.isTransitioning && state !== 'combat') {
        visual.dirty.stateIndicator = false;
      }
    }
  }

  private renderTierBadge(visual: HeroVisual, tierBadge: Graphics, tier: 1 | 2 | 3): void {
    if (visual.dirty.tierBadge) {
      tierBadge.clear();
      this.drawTierBadge(tierBadge, tier);
      visual.dirty.tierBadge = false;
    }
  }

  private updateMotion(
    visual: HeroVisual,
    targetX: number,
    targetY: number,
    deltaMs: number
  ): void {
    const anim = visual.animation;

    if (!visual.motionInitialized) {
      anim.visualX = targetX;
      anim.visualY = targetY;
      visual.motionTarget = { x: targetX, y: targetY };
      visual.lastVisualX = targetX;
      visual.lastVisualY = targetY;
      visual.motionInitialized = true;
      return;
    }

    visual.motionTarget = { x: targetX, y: targetY };

    const dist = Math.hypot(targetX - anim.visualX, targetY - anim.visualY);

    if (dist > MOTION.forceSnapDistance) {
      anim.visualX = targetX;
      anim.visualY = targetY;
      return;
    }

    if (dist <= MOTION.snapDistance) {
      anim.visualX = targetX;
      anim.visualY = targetY;
      return;
    }

    const lerpFactor = Math.min(1, MOTION.lerpSpeed * (deltaMs / 16.67));
    anim.visualX += (targetX - anim.visualX) * lerpFactor;
    anim.visualY += (targetY - anim.visualY) * lerpFactor;
  }

  private drawHeroBody(
    g: Graphics,
    hero: ActiveHero,
    size: number,
    colors: { primary: number; secondary: number; accent: number },
    time: number,
    anim: HeroAnimationState
  ) {
    const heroId = hero.definitionId;

    // === LAYER 0: Tier 1 Subtle Edge Glow ===
    if (hero.tier === 1) {
      const glowAlpha = 0.15 + Math.sin(time * 2) * 0.05;
      g.circle(0, 0, size * 1.08).fill({ color: colors.accent, alpha: glowAlpha });
    }

    // === LAYER 1: Tier 2+ Pulsating Ring with Background Particles ===
    if (hero.tier >= 2) {
      // Outer pulsing ring
      const ringRadius = size * (1.1 + Math.sin(time * 4) * 0.04);
      const ringAlpha = 0.5 + Math.sin(time * 6) * 0.15;
      g.circle(0, 0, ringRadius).stroke({ width: 3, color: colors.secondary, alpha: ringAlpha });

      // Inner secondary ring
      const innerRingRadius = size * (1.02 + Math.sin(time * 5 + 1) * 0.02);
      g.circle(0, 0, innerRingRadius).stroke({ width: 1, color: colors.accent, alpha: ringAlpha * 0.6 });

      // Background ambient particles (Tier 2)
      const bgParticleCount = 6;
      for (let i = 0; i < bgParticleCount; i++) {
        const angle = time * 1.5 + (i * Math.PI * 2) / bgParticleCount;
        const radius = size * (1.15 + Math.sin(time * 3 + i) * 0.1);
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        const pAlpha = 0.3 + Math.sin(time * 5 + i * 2) * 0.15;
        g.circle(px, py, 2).fill({ color: colors.accent, alpha: pAlpha });
      }
    }

    // === LAYER 2: Tier 3 Class Aura ===
    if (hero.tier === 3) {
      this.drawTier3Aura(g, heroId, size, colors, time);
    }

    // === LAYER 3: Class-Specific Body Shape ===
    this.drawHeroShape(g, heroId, size, colors, time);

    // === LAYER 4: Inner Core/Emblem ===
    const coreSize = size * 0.35;
    const corePulse = 1 + Math.sin(time * 5) * 0.05;
    g.circle(0, 0, coreSize * corePulse).fill({ color: colors.accent, alpha: 0.9 });

    // Inner detail - energy lines (more for higher tiers)
    const lineCount = hero.tier + 2;
    for (let i = 0; i < lineCount; i++) {
      const angle = time * 2 + (i * Math.PI * 2) / lineCount;
      const lineLength = coreSize * (0.7 + hero.tier * 0.1);
      const lineAlpha = 0.4 + hero.tier * 0.1;
      g.moveTo(0, 0)
        .lineTo(Math.cos(angle) * lineLength, Math.sin(angle) * lineLength)
        .stroke({ width: 1 + hero.tier * 0.3, color: 0xffffff, alpha: lineAlpha });
    }

    // === LAYER 5: Tier 3 Rotating Particles with Trails ===
    if (hero.tier === 3) {
      const particleCount = 10;
      for (let i = 0; i < particleCount; i++) {
        const angle = time * 2.5 + (i * Math.PI * 2) / particleCount;
        const orbitRadius = size * 1.5;
        const particleSize = 3.5 + Math.sin(time * 8 + i) * 1.5;
        const px = Math.cos(angle) * orbitRadius;
        const py = Math.sin(angle) * orbitRadius;

        // Extended particle trail
        const trailLength = 0.5;
        for (let t = 0; t < 3; t++) {
          const trailAngle = angle - trailLength * (t + 1) * 0.15;
          const trailAlpha = 0.4 - t * 0.12;
          const trailSize = particleSize * (1 - t * 0.2);
          g.circle(
            Math.cos(trailAngle) * orbitRadius,
            Math.sin(trailAngle) * orbitRadius,
            trailSize
          ).fill({ color: colors.accent, alpha: trailAlpha });
        }

        // Main particle with glow
        g.circle(px, py, particleSize * 1.5).fill({ color: colors.accent, alpha: 0.3 });
        g.circle(px, py, particleSize).fill({ color: colors.accent, alpha: 0.9 });
      }
    }

    // === LAYER 6: Combat Effects ===
    if (hero.state === 'combat') {
      // Energy burst effect
      const burstAlpha = (Math.sin(time * 12) + 1) / 4 * anim.combatIntensity;
      const burstSize = size * (0.5 + Math.sin(time * 15) * 0.1);
      g.star(0, 0, 4, burstSize, burstSize * 0.5, time * 3)
        .fill({ color: colors.accent, alpha: burstAlpha });

      // Weapon flash indicator
      const flashAlpha = (Math.sin(time * 15) + 1) / 2 * anim.combatIntensity * 0.8;
      g.circle(size * 0.6, -size * 0.6, 5).fill({ color: 0xffff00, alpha: flashAlpha });

      // Combat intensity ring (Tier 2+)
      if (hero.tier >= 2) {
        const combatRingAlpha = anim.combatIntensity * 0.3 * (Math.sin(time * 10) + 1) / 2;
        g.circle(0, 0, size * 1.3).stroke({ width: 2, color: 0xff4444, alpha: combatRingAlpha });
      }
    }

    // === LAYER 7: Death Effect ===
    if (anim.isDying && anim.deathProgress > 0) {
      const crackAlpha = anim.deathProgress * 0.9;
      const crackExpand = 1 + anim.deathProgress * 0.5;

      // Fragmentation cracks
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + time * 0.5;
        const innerR = size * 0.15 * crackExpand;
        const outerR = size * 0.9 * crackExpand;
        g.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR)
          .lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR)
          .stroke({ width: 2, color: 0xff3333, alpha: crackAlpha });
      }

      // Dissolve particles
      for (let i = 0; i < 4; i++) {
        const pAngle = time * 3 + i * 1.5;
        const pDist = size * anim.deathProgress * 1.5;
        g.circle(Math.cos(pAngle) * pDist, Math.sin(pAngle) * pDist, 2)
          .fill({ color: colors.primary, alpha: 1 - anim.deathProgress });
      }
    }
  }

  /**
   * Draw Tier 3 class-specific aura effect
   */
  private drawTier3Aura(
    g: Graphics,
    heroId: string,
    size: number,
    colors: { primary: number; secondary: number; accent: number },
    time: number
  ): void {
    const shapeType = getHeroShapeType(heroId);

    switch (shapeType) {
      case 'lightning':
        // Electric sparks aura
        for (let i = 0; i < 8; i++) {
          const sparkAngle = time * 4 + (i * Math.PI * 2) / 8;
          const sparkDist = size * (1.3 + Math.random() * 0.2);
          const sparkLength = size * 0.15;
          const sx = Math.cos(sparkAngle) * sparkDist;
          const sy = Math.sin(sparkAngle) * sparkDist;
          const sparkAlpha = 0.5 + Math.sin(time * 15 + i * 3) * 0.3;

          g.moveTo(sx, sy)
            .lineTo(sx + Math.random() * sparkLength - sparkLength / 2, sy + Math.random() * sparkLength - sparkLength / 2)
            .stroke({ width: 2, color: 0xffff00, alpha: sparkAlpha });
        }
        break;

      case 'flame':
        // Flame particles rising
        for (let i = 0; i < 6; i++) {
          const flameX = (Math.sin(time * 3 + i * 2) * size * 0.8);
          const flameY = -size * (1.2 + ((time * 2 + i) % 1) * 0.5);
          const flameAlpha = 0.4 - ((time * 2 + i) % 1) * 0.3;
          g.circle(flameX, flameY, 3).fill({ color: colors.accent, alpha: flameAlpha });
        }
        break;

      case 'frost':
        // Snowflake particles floating
        for (let i = 0; i < 6; i++) {
          const snowAngle = time * 0.5 + (i * Math.PI * 2) / 6;
          const snowDist = size * (1.3 + Math.sin(time * 2 + i) * 0.15);
          const sx = Math.cos(snowAngle) * snowDist;
          const sy = Math.sin(snowAngle) * snowDist;
          // Mini snowflake
          for (let j = 0; j < 6; j++) {
            const armAngle = (j * Math.PI) / 3;
            g.moveTo(sx, sy)
              .lineTo(sx + Math.cos(armAngle) * 4, sy + Math.sin(armAngle) * 4)
              .stroke({ width: 1, color: 0xadd8e6, alpha: 0.5 });
          }
        }
        break;

      case 'voidPortal':
      case 'voidStar':
        // Dark matter particles being pulled in
        for (let i = 0; i < 8; i++) {
          const voidAngle = time * -2 + (i * Math.PI * 2) / 8;
          const voidDist = size * (1.6 - ((time + i * 0.3) % 1) * 0.4);
          const vx = Math.cos(voidAngle) * voidDist;
          const vy = Math.sin(voidAngle) * voidDist;
          const voidAlpha = ((time + i * 0.3) % 1) * 0.5;
          g.circle(vx, vy, 2).fill({ color: 0x4b0082, alpha: voidAlpha });
        }
        break;

      case 'phantom':
        // Phase echoes
        for (let i = 0; i < 3; i++) {
          const echoAlpha = 0.1 - i * 0.03;
          const echoOffset = Math.sin(time * 4 + i) * (3 + i * 2);
          g.circle(echoOffset, 0, size * 0.9).stroke({ width: 1, color: colors.accent, alpha: echoAlpha });
        }
        break;

      case 'octagonGear':
        // Tech holographic rings
        for (let i = 0; i < 2; i++) {
          const techRingRadius = size * (1.25 + i * 0.15);
          const techRotation = time * (i % 2 === 0 ? 1 : -1);
          const dashCount = 8;
          for (let j = 0; j < dashCount; j++) {
            const dashAngle = techRotation + (j * Math.PI * 2) / dashCount;
            const dashLength = Math.PI / dashCount * 0.6;
            g.arc(0, 0, techRingRadius, dashAngle, dashAngle + dashLength)
              .stroke({ width: 1, color: 0x00ffff, alpha: 0.4 });
          }
        }
        break;

      default:
        // Generic power aura
        const auraAlpha = 0.2 + Math.sin(time * 3) * 0.1;
        g.circle(0, 0, size * 1.35).stroke({ width: 2, color: colors.accent, alpha: auraAlpha });
    }
  }

  /**
   * Draw class-specific hero shape
   */
  private drawHeroShape(
    g: Graphics,
    heroId: string,
    size: number,
    colors: { primary: number; secondary: number; accent: number },
    time: number
  ): void {
    const bodySize = size * 0.85;
    const shapeType = getHeroShapeType(heroId);

    switch (shapeType) {
      case 'hexagon':
        this.drawHexagon(g, bodySize, colors);
        break;
      case 'flame':
        this.drawFlameShape(g, bodySize, colors, time);
        break;
      case 'diamond':
        this.drawDiamond(g, bodySize, colors, time);
        break;
      case 'octagonGear':
        this.drawOctagonGear(g, bodySize, colors, time);
        break;
      case 'lightning':
        this.drawLightningShape(g, bodySize, colors, time);
        break;
      case 'frost':
        this.drawFrostShape(g, bodySize, colors, time);
        break;
      case 'voidPortal':
        this.drawVoidPortal(g, bodySize, colors, time);
        break;
      case 'phantom':
        this.drawPhantom(g, bodySize, colors, time);
        break;
      case 'voidStar':
        this.drawVoidStar(g, bodySize, colors, time);
        break;
      default:
        // Dark outline for contrast
        g.circle(0, 0, bodySize).stroke({ width: 8, color: 0x000000, alpha: 0.6 });
        g.circle(0, 0, bodySize)
          .fill({ color: colors.primary })
          .stroke({ width: 5, color: colors.secondary });
    }
  }

  private drawHexagon(g: Graphics, size: number, colors: { primary: number; secondary: number; accent: number }): void {
    const points: number[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 - Math.PI / 2;
      points.push(Math.cos(angle) * size, Math.sin(angle) * size);
    }
    // Dark outline for contrast
    g.poly(points).stroke({ width: 8, color: 0x000000, alpha: 0.6 });
    g.poly(points).fill({ color: colors.primary }).stroke({ width: 5, color: colors.secondary });

    // Inner depth layers (gradient simulation)
    const midPoints: number[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 - Math.PI / 2;
      midPoints.push(Math.cos(angle) * size * 0.8, Math.sin(angle) * size * 0.8);
    }
    g.poly(midPoints).fill({ color: colors.secondary, alpha: 0.2 });

    // Inner hexagon highlight
    const innerPoints: number[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 - Math.PI / 2;
      innerPoints.push(Math.cos(angle) * size * 0.6, Math.sin(angle) * size * 0.6);
    }
    g.poly(innerPoints).fill({ color: colors.secondary, alpha: 0.15 });
    g.poly(innerPoints).stroke({ width: 2, color: colors.accent, alpha: 0.5 });
  }

  private drawDiamond(
    g: Graphics,
    size: number,
    colors: { primary: number; secondary: number; accent: number },
    time: number
  ): void {
    const stretch = 1.2;
    const points = [0, -size * stretch, size, 0, 0, size * stretch, -size, 0];
    // Dark outline for contrast
    g.poly(points).stroke({ width: 8, color: 0x000000, alpha: 0.6 });
    g.poly(points).fill({ color: colors.primary }).stroke({ width: 5, color: colors.secondary });

    // Inner depth layers
    const midPoints = [0, -size * stretch * 0.8, size * 0.8, 0, 0, size * stretch * 0.8, -size * 0.8, 0];
    g.poly(midPoints).fill({ color: colors.secondary, alpha: 0.2 });
    const innerDepth = [0, -size * stretch * 0.6, size * 0.6, 0, 0, size * stretch * 0.6, -size * 0.6, 0];
    g.poly(innerDepth).fill({ color: colors.secondary, alpha: 0.15 });

    // Inner crystal facets
    const facetAlpha = 0.4 + Math.sin(time * 4) * 0.1;
    g.moveTo(0, -size * stretch * 0.7).lineTo(size * 0.5, 0).lineTo(0, size * stretch * 0.7);
    g.stroke({ width: 1, color: 0xffffff, alpha: facetAlpha });
    g.moveTo(0, -size * stretch * 0.7).lineTo(-size * 0.5, 0).lineTo(0, size * stretch * 0.7);
    g.stroke({ width: 1, color: 0xffffff, alpha: facetAlpha });
  }

  private drawOctagonGear(
    g: Graphics,
    size: number,
    colors: { primary: number; secondary: number; accent: number },
    time: number
  ): void {
    // Octagon base
    const points: number[] = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4 + time * 0.5;
      const r = i % 2 === 0 ? size : size * 0.85;
      points.push(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    // Dark outline for contrast
    g.poly(points).stroke({ width: 8, color: 0x000000, alpha: 0.6 });
    g.poly(points).fill({ color: colors.primary }).stroke({ width: 5, color: colors.secondary });

    // Inner depth layers
    const innerPoints: number[] = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4 + time * 0.5;
      const r = (i % 2 === 0 ? size : size * 0.85) * 0.75;
      innerPoints.push(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    g.poly(innerPoints).fill({ color: colors.secondary, alpha: 0.2 });

    // Rotating inner gear
    const gearAngle = time * -1;
    for (let i = 0; i < 4; i++) {
      const angle = gearAngle + (i * Math.PI) / 2;
      g.moveTo(0, 0)
        .lineTo(Math.cos(angle) * size * 0.6, Math.sin(angle) * size * 0.6)
        .stroke({ width: 2, color: colors.accent, alpha: 0.6 });
    }
  }

  private drawLightningShape(
    g: Graphics,
    size: number,
    colors: { primary: number; secondary: number; accent: number },
    time: number
  ): void {
    // Dark outline for contrast
    g.circle(0, 0, size).stroke({ width: 8, color: 0x000000, alpha: 0.6 });
    // Circle base
    g.circle(0, 0, size).fill({ color: colors.primary }).stroke({ width: 5, color: colors.secondary });

    // Inner depth layers (gradient simulation)
    g.circle(0, 0, size * 0.8).fill({ color: colors.secondary, alpha: 0.2 });
    g.circle(0, 0, size * 0.6).fill({ color: colors.secondary, alpha: 0.15 });

    // Lightning bolt inner design
    const boltAlpha = 0.7 + Math.sin(time * 10) * 0.2;
    const boltScale = size * 0.5;
    g.moveTo(0, -boltScale)
      .lineTo(-boltScale * 0.3, 0)
      .lineTo(boltScale * 0.2, 0)
      .lineTo(0, boltScale)
      .stroke({ width: 3, color: colors.accent, alpha: boltAlpha });

    // Electric arcs
    for (let i = 0; i < 3; i++) {
      const arcAngle = time * 5 + i * 2;
      const arcR = size * 0.8;
      g.circle(Math.cos(arcAngle) * arcR, Math.sin(arcAngle) * arcR, 2)
        .fill({ color: colors.accent, alpha: 0.5 + Math.sin(time * 15 + i) * 0.3 });
    }
  }

  private drawFrostShape(
    g: Graphics,
    size: number,
    colors: { primary: number; secondary: number; accent: number },
    time: number
  ): void {
    // Dark outline for contrast
    g.circle(0, 0, size).stroke({ width: 8, color: 0x000000, alpha: 0.6 });
    // Circle base with icy gradient feel
    g.circle(0, 0, size).fill({ color: colors.primary }).stroke({ width: 5, color: colors.secondary });

    // Inner depth layers (icy gradient)
    g.circle(0, 0, size * 0.8).fill({ color: colors.secondary, alpha: 0.2 });
    g.circle(0, 0, size * 0.6).fill({ color: colors.secondary, alpha: 0.15 });
    g.circle(0, 0, size * 0.4).fill({ color: 0xffffff, alpha: 0.1 });

    // Snowflake/crystal arms
    const armCount = 6;
    const armAlpha = 0.6 + Math.sin(time * 3) * 0.1;
    for (let i = 0; i < armCount; i++) {
      const angle = (i * Math.PI * 2) / armCount;
      const armLength = size * 0.7;
      const endX = Math.cos(angle) * armLength;
      const endY = Math.sin(angle) * armLength;

      // Main arm
      g.moveTo(0, 0).lineTo(endX, endY).stroke({ width: 2, color: colors.accent, alpha: armAlpha });

      // Crystal branches
      const branchLength = armLength * 0.4;
      const branchAngle1 = angle + Math.PI / 6;
      const branchAngle2 = angle - Math.PI / 6;
      const midX = endX * 0.6;
      const midY = endY * 0.6;
      g.moveTo(midX, midY)
        .lineTo(midX + Math.cos(branchAngle1) * branchLength, midY + Math.sin(branchAngle1) * branchLength)
        .stroke({ width: 1, color: colors.accent, alpha: armAlpha * 0.7 });
      g.moveTo(midX, midY)
        .lineTo(midX + Math.cos(branchAngle2) * branchLength, midY + Math.sin(branchAngle2) * branchLength)
        .stroke({ width: 1, color: colors.accent, alpha: armAlpha * 0.7 });
    }
  }

  private drawFlameShape(
    g: Graphics,
    size: number,
    colors: { primary: number; secondary: number; accent: number },
    time: number
  ): void {
    // Dark outline for contrast
    g.circle(0, 0, size).stroke({ width: 8, color: 0x000000, alpha: 0.6 });
    // Circle base with fire gradient
    g.circle(0, 0, size).fill({ color: colors.primary }).stroke({ width: 5, color: colors.secondary });

    // Inner depth layers (fiery gradient)
    g.circle(0, 0, size * 0.8).fill({ color: colors.secondary, alpha: 0.25 });
    g.circle(0, 0, size * 0.6).fill({ color: colors.accent, alpha: 0.2 });
    g.circle(0, 0, size * 0.4).fill({ color: 0xffff00, alpha: 0.15 });

    // Animated flame tongues
    const flameCount = 5;
    const flameAlpha = 0.7 + Math.sin(time * 4) * 0.2;
    for (let i = 0; i < flameCount; i++) {
      const baseAngle = (i * Math.PI * 2) / flameCount - Math.PI / 2;
      const flickerOffset = Math.sin(time * 8 + i * 2) * 0.15;
      const angle = baseAngle + flickerOffset;
      const flameHeight = size * (0.6 + Math.sin(time * 6 + i * 1.5) * 0.15);

      // Flame tongue points (teardrop shape pointing outward)
      const baseX = Math.cos(angle) * size * 0.5;
      const baseY = Math.sin(angle) * size * 0.5;
      const tipX = Math.cos(angle) * (size * 0.5 + flameHeight);
      const tipY = Math.sin(angle) * (size * 0.5 + flameHeight);
      const perpAngle = angle + Math.PI / 2;
      const width = size * 0.2;

      const points = [
        baseX + Math.cos(perpAngle) * width, baseY + Math.sin(perpAngle) * width,
        tipX, tipY,
        baseX - Math.cos(perpAngle) * width, baseY - Math.sin(perpAngle) * width,
      ];

      g.poly(points).fill({ color: colors.accent, alpha: flameAlpha * (0.6 + i * 0.08) });
    }

    // Inner glow circle
    g.circle(0, 0, size * 0.4)
      .fill({ color: colors.accent, alpha: 0.4 + Math.sin(time * 5) * 0.1 });
  }

  /**
   * Draw Void Portal shape for Titan (void tank)
   * Hexagon base with swirling void particles being pulled inward
   */
  private drawVoidPortal(
    g: Graphics,
    size: number,
    colors: { primary: number; secondary: number; accent: number },
    time: number
  ): void {
    // Outer hexagon shell
    const outerPoints: number[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 - Math.PI / 2;
      outerPoints.push(Math.cos(angle) * size, Math.sin(angle) * size);
    }
    // Dark outline for contrast
    g.poly(outerPoints).stroke({ width: 8, color: 0x000000, alpha: 0.6 });
    g.poly(outerPoints).fill({ color: colors.primary }).stroke({ width: 5, color: colors.secondary });

    // Inner void gradient layers (dark center)
    const midPoints: number[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 - Math.PI / 2;
      midPoints.push(Math.cos(angle) * size * 0.75, Math.sin(angle) * size * 0.75);
    }
    g.poly(midPoints).fill({ color: 0x1a0a2e, alpha: 0.6 });

    // Dark core (void center)
    g.circle(0, 0, size * 0.4).fill({ color: 0x0a0014, alpha: 0.9 });

    // Swirling void particles being pulled inward
    const particleCount = 12;
    for (let i = 0; i < particleCount; i++) {
      const baseAngle = (i * Math.PI * 2) / particleCount + time * 1.5;
      const spiralProgress = ((time * 0.8 + i * 0.3) % 1);
      const radius = size * (0.8 - spiralProgress * 0.5);
      const angle = baseAngle + spiralProgress * Math.PI;

      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      const particleSize = 2 + (1 - spiralProgress) * 2;
      const particleAlpha = 0.3 + (1 - spiralProgress) * 0.5;

      g.circle(px, py, particleSize).fill({ color: colors.accent, alpha: particleAlpha });
    }

    // Pulsing void ring
    const ringRadius = size * (0.5 + Math.sin(time * 3) * 0.05);
    const ringAlpha = 0.4 + Math.sin(time * 4) * 0.15;
    g.circle(0, 0, ringRadius).stroke({ width: 2, color: colors.accent, alpha: ringAlpha });

    // Inner energy tendrils reaching outward
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 + time * 0.5;
      const tendrilLength = size * (0.3 + Math.sin(time * 4 + i) * 0.1);
      const tendrilAlpha = 0.5 + Math.sin(time * 5 + i * 2) * 0.2;

      g.moveTo(0, 0)
        .lineTo(Math.cos(angle) * tendrilLength, Math.sin(angle) * tendrilLength)
        .stroke({ width: 2, color: colors.accent, alpha: tendrilAlpha });
    }
  }

  /**
   * Draw Phantom shape for Spectre (plasma DPS)
   * Translucent ghostly form with flickering edges and phase effect
   */
  private drawPhantom(
    g: Graphics,
    size: number,
    colors: { primary: number; secondary: number; accent: number },
    time: number
  ): void {
    // Outer ghostly glow
    const glowAlpha = 0.15 + Math.sin(time * 3) * 0.05;
    g.circle(0, 0, size * 1.15).fill({ color: colors.accent, alpha: glowAlpha });

    // Main phantom body - irregular wobbling shape
    const bodyPoints: number[] = [];
    const segments = 16;
    for (let i = 0; i < segments; i++) {
      const angle = (i * Math.PI * 2) / segments;
      const wobble = Math.sin(time * 6 + i * 1.2) * 0.08;
      const phaseShift = Math.sin(time * 4 + i * 0.8) * 0.05;
      const r = size * (0.85 + wobble + phaseShift);
      bodyPoints.push(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    // Dark outline for contrast
    g.poly(bodyPoints).stroke({ width: 7, color: 0x000000, alpha: 0.5 });
    g.poly(bodyPoints).fill({ color: colors.primary, alpha: 0.7 }).stroke({ width: 4, color: colors.secondary, alpha: 0.9 });

    // Inner translucent layers
    g.circle(0, 0, size * 0.65).fill({ color: colors.secondary, alpha: 0.25 });
    g.circle(0, 0, size * 0.45).fill({ color: colors.accent, alpha: 0.2 });

    // Phase flickering effect - multiple offset copies
    const flickerIntensity = Math.sin(time * 10) * 0.5 + 0.5;
    if (flickerIntensity > 0.7) {
      const offsetX = Math.sin(time * 15) * 3;
      const offsetY = Math.cos(time * 12) * 2;
      g.circle(offsetX, offsetY, size * 0.6).fill({ color: colors.accent, alpha: 0.15 });
    }

    // Plasma energy wisps
    const wispCount = 5;
    for (let i = 0; i < wispCount; i++) {
      const wispAngle = time * 2 + (i * Math.PI * 2) / wispCount;
      const wispRadius = size * (0.5 + Math.sin(time * 3 + i) * 0.15);
      const wispX = Math.cos(wispAngle) * wispRadius;
      const wispY = Math.sin(wispAngle) * wispRadius;
      const wispAlpha = 0.4 + Math.sin(time * 8 + i * 2) * 0.2;

      // Wisp trail
      const trailAngle = wispAngle - 0.4;
      const trailX = Math.cos(trailAngle) * wispRadius * 0.8;
      const trailY = Math.sin(trailAngle) * wispRadius * 0.8;
      g.moveTo(trailX, trailY).lineTo(wispX, wispY)
        .stroke({ width: 2, color: colors.accent, alpha: wispAlpha * 0.5 });

      g.circle(wispX, wispY, 3).fill({ color: colors.accent, alpha: wispAlpha });
    }

    // Central plasma core
    const coreFlicker = 0.8 + Math.sin(time * 12) * 0.2;
    g.circle(0, 0, size * 0.2 * coreFlicker).fill({ color: 0xffffff, alpha: 0.6 });

    // Stealth shimmer lines
    for (let i = 0; i < 3; i++) {
      const shimmerY = -size * 0.5 + (i * size * 0.5);
      const shimmerWidth = size * (0.4 + Math.sin(time * 6 + i) * 0.2);
      const shimmerAlpha = 0.2 + Math.sin(time * 8 + i * 3) * 0.1;
      g.moveTo(-shimmerWidth, shimmerY).lineTo(shimmerWidth, shimmerY)
        .stroke({ width: 1, color: 0xffffff, alpha: shimmerAlpha });
    }
  }

  /**
   * Draw Void Star shape for Omega (void assassin)
   * Dynamic star with dark matter core and deadly energy
   */
  private drawVoidStar(
    g: Graphics,
    size: number,
    colors: { primary: number; secondary: number; accent: number },
    time: number
  ): void {
    // Outer deadly aura
    const auraAlpha = 0.2 + Math.sin(time * 4) * 0.08;
    g.star(0, 0, 8, size * 1.2, size * 0.6, time * 0.3)
      .fill({ color: colors.accent, alpha: auraAlpha });

    // Main star body - 5-pointed assassin star
    const starRotation = time * 0.8;
    // Dark outline for contrast
    g.star(0, 0, 5, size, size * 0.45, starRotation)
      .stroke({ width: 8, color: 0x000000, alpha: 0.6 });
    g.star(0, 0, 5, size, size * 0.45, starRotation)
      .fill({ color: colors.primary })
      .stroke({ width: 5, color: colors.secondary });

    // Inner star layer
    g.star(0, 0, 5, size * 0.7, size * 0.35, starRotation)
      .fill({ color: colors.secondary, alpha: 0.4 });

    // Dark matter core (black hole effect)
    g.circle(0, 0, size * 0.35).fill({ color: 0x0a0a0a, alpha: 0.95 });
    g.circle(0, 0, size * 0.25).fill({ color: 0x000000 });

    // Golden energy ring around core
    const ringPulse = 1 + Math.sin(time * 5) * 0.1;
    g.circle(0, 0, size * 0.3 * ringPulse)
      .stroke({ width: 2, color: colors.accent, alpha: 0.8 });

    // Rotating energy blades (assassin motif)
    const bladeCount = 5;
    for (let i = 0; i < bladeCount; i++) {
      const bladeAngle = starRotation + (i * Math.PI * 2) / bladeCount;
      const bladeLength = size * 0.6;
      const bladeWidth = size * 0.08;
      const bladeAlpha = 0.6 + Math.sin(time * 6 + i * 2) * 0.2;

      // Blade points (elongated diamond)
      const tipX = Math.cos(bladeAngle) * bladeLength;
      const tipY = Math.sin(bladeAngle) * bladeLength;
      const perpAngle = bladeAngle + Math.PI / 2;
      const sideX = Math.cos(perpAngle) * bladeWidth;
      const sideY = Math.sin(perpAngle) * bladeWidth;
      const baseX = Math.cos(bladeAngle) * size * 0.25;
      const baseY = Math.sin(bladeAngle) * size * 0.25;

      const bladePoints = [
        baseX + sideX, baseY + sideY,
        tipX, tipY,
        baseX - sideX, baseY - sideY,
      ];
      g.poly(bladePoints).fill({ color: colors.accent, alpha: bladeAlpha });
    }

    // Dark matter particles orbiting
    const particleCount = 6;
    for (let i = 0; i < particleCount; i++) {
      const orbitAngle = time * 3 + (i * Math.PI * 2) / particleCount;
      const orbitRadius = size * 0.5;
      const px = Math.cos(orbitAngle) * orbitRadius;
      const py = Math.sin(orbitAngle) * orbitRadius;
      const pSize = 2 + Math.sin(time * 8 + i) * 1;

      g.circle(px, py, pSize).fill({ color: 0x1a1a2a, alpha: 0.8 });
      // Particle glow
      g.circle(px, py, pSize * 2).fill({ color: colors.accent, alpha: 0.2 });
    }

    // Execute indicator - pulsing red when ready
    const executeGlow = (Math.sin(time * 8) + 1) / 2;
    if (executeGlow > 0.7) {
      g.circle(0, 0, size * 0.15).fill({ color: 0xff0000, alpha: executeGlow * 0.4 });
    }
  }

  private drawHpBar(g: Graphics, hpPercent: number) {
    const width = SIZES.hpBarWidth;
    const height = SIZES.hpBarHeight;
    const x = -width / 2;
    const y = 0;

    const clampedHp = Math.max(0, Math.min(1, hpPercent));

    // Background
    g.roundRect(x, y, width, height, 2)
      .fill({ color: HP_COLORS.background })
      .stroke({ width: 1, color: HP_COLORS.border });

    // Fill with smooth color transition
    if (clampedHp > 0) {
      let fillColor: number;
      if (clampedHp <= 0.3) {
        fillColor = HP_COLORS.low;
      } else if (clampedHp <= 0.6) {
        // Interpolate between low and mid
        const t = (clampedHp - 0.3) / 0.3;
        fillColor = this.lerpColor(HP_COLORS.low, HP_COLORS.mid, t);
      } else {
        // Interpolate between mid and high
        const t = (clampedHp - 0.6) / 0.4;
        fillColor = this.lerpColor(HP_COLORS.mid, HP_COLORS.high, t);
      }

      const fillWidth = (width - 2) * clampedHp;
      g.roundRect(x + 1, y + 1, fillWidth, height - 2, 1)
        .fill({ color: fillColor });
    }
  }

  private drawStateIndicator(g: Graphics, state: HeroState, anim: HeroAnimationState) {
    const stateColor = STATE_COLORS[state];
    let indicatorAlpha = 1;
    let indicatorScale = 1;

    // Pulse during transitions
    if (anim.isTransitioning) {
      indicatorScale = 1 + Math.sin(anim.transitionProgress * Math.PI) * 0.3;
    }

    // Glow effect for combat
    if (state === 'combat') {
      indicatorAlpha = 0.7 + Math.sin(performance.now() / 150) * 0.3;
    }

    const radius = 4 * indicatorScale;
    g.circle(0, 0, radius)
      .fill({ color: stateColor, alpha: indicatorAlpha });

    // Outer ring during transition
    if (anim.isTransitioning && anim.transitionProgress < 1) {
      const ringRadius = radius + 4 * (1 - anim.transitionProgress);
      const ringAlpha = (1 - anim.transitionProgress) * 0.5;
      g.circle(0, 0, ringRadius)
        .stroke({ width: 2, color: stateColor, alpha: ringAlpha });
    }
  }

  private drawTierBadge(g: Graphics, tier: 1 | 2 | 3) {
    const tierColors = {
      1: { main: 0xcd7f32, light: 0xe8a95e, dark: 0x8b5a2b }, // Bronze
      2: { main: 0xc0c0c0, light: 0xe8e8e8, dark: 0x808080 }, // Silver
      3: { main: 0xffd700, light: 0xffec8b, dark: 0xdaa520 }, // Gold
    };

    const colors = tierColors[tier];
    const size = 10;

    // Outer glow
    g.circle(0, 0, size + 3).fill({ color: colors.main, alpha: 0.3 });

    // Base circle with metallic gradient simulation
    g.circle(0, 0, size).fill({ color: colors.main });

    // Highlight (top-left)
    g.arc(0, 0, size * 0.7, -Math.PI, -Math.PI / 2)
      .stroke({ width: 2, color: colors.light, alpha: 0.6 });

    // Shadow (bottom-right)
    g.arc(0, 0, size * 0.7, 0, Math.PI / 2)
      .stroke({ width: 2, color: colors.dark, alpha: 0.4 });

    // Border
    g.circle(0, 0, size).stroke({ width: 2, color: colors.light });

    // Tier indicator - Roman numeral style
    if (tier === 1) {
      // I
      g.rect(-1, -5, 2, 10).fill({ color: 0xffffff });
    } else if (tier === 2) {
      // II
      g.rect(-4, -5, 2, 10).fill({ color: 0xffffff });
      g.rect(2, -5, 2, 10).fill({ color: 0xffffff });
    } else {
      // III
      g.rect(-6, -5, 2, 10).fill({ color: 0xffffff });
      g.rect(-1, -5, 2, 10).fill({ color: 0xffffff });
      g.rect(4, -5, 2, 10).fill({ color: 0xffffff });
    }
  }

  /**
   * Linear interpolation between two colors
   */
  private lerpColor(colorA: number, colorB: number, t: number): number {
    const rA = (colorA >> 16) & 0xff;
    const gA = (colorA >> 8) & 0xff;
    const bA = colorA & 0xff;

    const rB = (colorB >> 16) & 0xff;
    const gB = (colorB >> 8) & 0xff;
    const bB = colorB & 0xff;

    const r = Math.round(rA + (rB - rA) * t);
    const g = Math.round(gA + (gB - gA) * t);
    const b = Math.round(bA + (bB - bA) * t);

    return (r << 16) | (g << 8) | b;
  }

  private getHeroDisplayName(definitionId: string): string {
    const names: Record<string, string> = {
      // New unit IDs
      storm: 'Storm',
      forge: 'Forge',
      titan: 'Titan',
      vanguard: 'Vanguard',
      rift: 'Rift',
      frost_unit: 'Frost',
      // Legacy IDs for backwards compatibility
      thunderlord: 'Storm',
      iron_sentinel: 'Forge',
      jade_titan: 'Titan',
      spider_sentinel: 'Spider',
      shield_captain: 'Vanguard',
      scarlet_mage: 'Rift',
      frost_archer: 'Frost',
      flame_phoenix: 'Phoenix',
      venom_assassin: 'Widow',
      arcane_sorcerer: 'Sorcerer',
      frost_giant: 'Giant',
      cosmic_guardian: 'Guardian',
    };
    return names[definitionId] || definitionId.substring(0, 6);
  }

  /**
   * Detect when a skill was just used and trigger the appropriate VFX
   */
  private detectAndTriggerSkillVFX(
    visual: HeroVisual,
    hero: ActiveHero,
    heroScreenX: number,
    heroScreenY: number,
    state: GameState,
    viewWidth: number,
    viewHeight: number,
    vfx: VFXSystem
  ): void {
    for (const skillId of Object.keys(hero.skillCooldowns)) {
      const currentCooldown = hero.skillCooldowns[skillId];
      const lastCooldown = visual.lastSkillCooldowns[skillId] ?? 0;

      // Skill was just used: cooldown went from 0 (or undefined) to > 0
      if (currentCooldown > 0 && lastCooldown === 0) {
        // Find a target for directional effects
        const target = this.findNearestEnemy(state, hero, viewWidth, viewHeight);
        const targetX = target?.x ?? heroScreenX + 200;
        const targetY = target?.y ?? heroScreenY;

        // Trigger VFX based on hero and skill
        this.triggerSkillVFX(hero.definitionId, skillId, heroScreenX, heroScreenY, targetX, targetY, vfx);
      }

      // Update tracked cooldown
      visual.lastSkillCooldowns[skillId] = currentCooldown;
    }
  }

  /**
   * Find the nearest enemy for targeting VFX
   */
  private findNearestEnemy(
    state: GameState,
    hero: ActiveHero,
    viewWidth: number,
    viewHeight: number
  ): { x: number; y: number } | null {
    if (!state.enemies || state.enemies.length === 0) return null;

    const heroX = FP.toFloat(hero.x);
    const heroY = FP.toFloat(hero.y);
    let nearest: { x: number; y: number; dist: number } | null = null;

    for (const enemy of state.enemies) {
      const ex = FP.toFloat(enemy.x);
      const ey = FP.toFloat(enemy.y);
      const dist = Math.sqrt((ex - heroX) ** 2 + (ey - heroY) ** 2);

      if (!nearest || dist < nearest.dist) {
        nearest = {
          x: fpXToScreen(enemy.x, viewWidth),
          y: fpYToScreen(enemy.y, viewHeight),
          dist,
        };
      }
    }

    return nearest ? { x: nearest.x, y: nearest.y } : null;
  }

  /**
   * Trigger the appropriate VFX for a hero's skill
   */
  private triggerSkillVFX(
    heroId: string,
    skillId: string,
    heroX: number,
    heroY: number,
    targetX: number,
    targetY: number,
    vfx: VFXSystem
  ): void {
    const handler = getSkillVfxHandler(heroId, skillId);
    handler({ heroX, heroY, targetX, targetY, vfx });
  }

  /**
   * Clear all hero visuals - used when transitioning between scenes
   */
  public clearAll(): void {
    for (const visual of this.visuals.values()) {
      this.container.removeChild(visual.container);
      visual.container.destroy({ children: true });
    }
    this.visuals.clear();
  }
}
