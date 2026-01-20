import { Container, Graphics, Text } from 'pixi.js';
import type { GameState, ActiveHero, HeroState } from '@arcade/sim-core';
import { FP, STORM_FORGE_SYNERGY_RANGE_SQ } from '@arcade/sim-core';
import { Tween, TweenManager, TweenSequence } from '../animation/Tween.js';
import { easeOutQuad, easeOutElastic, easeOutCubic } from '../animation/easing.js';
import type { VFXSystem } from './VFXSystem.js';
import { fpXToScreen, fpYToScreen } from '../CoordinateSystem.js';

// Unit-specific colors (configuration-based)
const HERO_COLORS: Record<string, { primary: number; secondary: number; accent: number }> = {
  // Premium heroes
  inferno: { primary: 0xff4500, secondary: 0xff8c00, accent: 0xffd700 }, // Fire DPS - orange/gold
  glacier: { primary: 0x1e90ff, secondary: 0xb0e0e6, accent: 0x87ceeb }, // Ice Tank - blue
  // New unit IDs
  storm: { primary: 0x9932cc, secondary: 0xdda0dd, accent: 0xffff00 }, // Elektryczna - purple/yellow
  forge: { primary: 0x00f0ff, secondary: 0xff00aa, accent: 0xccff00 }, // Kwantowa - cyan/pink
  titan: { primary: 0x228b22, secondary: 0x8fbc8f, accent: 0x98fb98 }, // Standardowa - green
  vanguard: { primary: 0x228b22, secondary: 0x8fbc8f, accent: 0x98fb98 }, // Standardowa - green
  rift: { primary: 0xff4500, secondary: 0xff8c00, accent: 0xffd700 }, // Termiczna - orange/gold
  frost_unit: { primary: 0x00bfff, secondary: 0xe0ffff, accent: 0x87ceeb }, // Kriogeniczna - blue
  // Exclusive heroes
  spectre: { primary: 0x00ffff, secondary: 0xff00ff, accent: 0xffffff }, // Plasma - cyan/magenta/white
  omega: { primary: 0xffd700, secondary: 0x1a1a2a, accent: 0xffaa00 }, // Legendary - gold/black/orange
  // Legacy IDs for backwards compatibility
  thunderlord: { primary: 0x9932cc, secondary: 0xdda0dd, accent: 0xffff00 },
  iron_sentinel: { primary: 0x00f0ff, secondary: 0xff00aa, accent: 0xccff00 },
  jade_titan: { primary: 0x228b22, secondary: 0x8fbc8f, accent: 0x98fb98 },
  spider_sentinel: { primary: 0xff0000, secondary: 0x0000ff, accent: 0xffffff },
  shield_captain: { primary: 0x228b22, secondary: 0x8fbc8f, accent: 0x98fb98 },
  scarlet_mage: { primary: 0xff4500, secondary: 0xff8c00, accent: 0xffd700 },
  frost_archer: { primary: 0x00bfff, secondary: 0xe0ffff, accent: 0x87ceeb },
  flame_phoenix: { primary: 0xff4500, secondary: 0xffd700, accent: 0xff0000 },
  venom_assassin: { primary: 0x1a1a1a, secondary: 0x8b0000, accent: 0x00ff00 },
  arcane_sorcerer: { primary: 0x4b0082, secondary: 0xff4500, accent: 0x00ff00 },
  frost_giant: { primary: 0x00ced1, secondary: 0x228b22, accent: 0xffd700 },
  cosmic_guardian: { primary: 0x8b4513, secondary: 0xff4500, accent: 0xffd700 },
};

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
  retargetDistance: 3.0,
  anticipationRatio: 0.12,
  overshootRatio: 0.15,
  anticipationMax: 10,
  overshootMax: 12,
  anticipationDuration: 50,
  settleDuration: 90,
  minDuration: 90,
  maxDuration: 240,
  durationPerPixel: 0.6,
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
}

interface HeroVisual {
  container: Container;
  lastState: HeroState;
  heroId: string;
  animation: HeroAnimationState;
  lastHp: number;
  lastTier: 1 | 2 | 3;  // Track tier for dirty flagging
  tweenManager: TweenManager;
  scaleTween: Tween<number> | null;
  alphaTween: Tween<number> | null;
  hpTween: Tween<number> | null;
  motionSequence: TweenSequence | null;
  motionTarget: { x: number; y: number };
  motionInitialized: boolean;
  lastVisualX: number;
  lastVisualY: number;
  breathingPhase: number;
  // Track skill cooldowns to detect skill usage
  lastSkillCooldowns: Record<string, number>;
  // Dirty flags for optimized rendering
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
    this.lastUpdateTime = Date.now();
  }

  /**
   * Set callback for hero click events
   */
  public setOnHeroClick(callback: (heroId: string) => void) {
    this.onHeroClick = callback;
  }

  public update(state: GameState, viewWidth: number, viewHeight: number, vfx?: VFXSystem) {
    const currentIds = new Set<string>();
    const now = Date.now();
    const deltaMs = now - this.lastUpdateTime;
    this.lastUpdateTime = now;
    const time = now / 1000;

    for (const hero of state.heroes) {
      currentIds.add(hero.definitionId);

      let visual = this.visuals.get(hero.definitionId);
      if (!visual) {
        visual = this.createHeroVisual(hero);
        this.container.addChild(visual.container);
        this.visuals.set(hero.definitionId, visual);
        // Start spawn animation
        this.startSpawnAnimation(visual);
      }

      // Handle state changes
      if (visual.lastState !== hero.state) {
        this.onStateChange(visual, visual.lastState, hero.state);
        visual.lastState = hero.state;
        visual.dirty.stateIndicator = true;
        visual.dirty.body = true; // Body glow changes with combat state
      }

      // Handle tier changes
      const currentTier = hero.tier as 1 | 2 | 3;
      if (visual.lastTier !== currentTier) {
        visual.lastTier = currentTier;
        visual.dirty.tierBadge = true;
        visual.dirty.body = true; // Body size changes with tier
      }

      // Handle HP changes
      const hpPercent = hero.maxHp > 0 ? hero.currentHp / hero.maxHp : 0;
      if (Math.abs(visual.lastHp - hpPercent) > 0.01) {
        this.startHpTransition(visual, visual.lastHp, hpPercent);
        visual.lastHp = hpPercent;
        visual.dirty.hpBar = true;
      }

      // Detect skill usage and trigger VFX
      if (vfx && hero.skillCooldowns) {
        const screenX = fpXToScreen(hero.x, viewWidth);
        const screenY = fpYToScreen(hero.y, viewHeight);
        this.detectAndTriggerSkillVFX(visual, hero, screenX, screenY, state, viewWidth, viewHeight, vfx);
      }

      // Update position target (screen space)
      const screenX = fpXToScreen(hero.x, viewWidth);
      const screenY = fpYToScreen(hero.y, viewHeight);

      // Motion smoothing with anticipation/overshoot
      this.updateMotion(visual, screenX, screenY, deltaMs);

      // Update tweens
      visual.tweenManager.update(deltaMs);

      // Update animation state
      this.updateAnimationState(visual, hero, deltaMs);

      // Update visuals (which may apply animation offsets)
      const offset = this.updateHeroVisual(visual, hero, time);

      // Apply final position with animation offset
      visual.container.position.set(visual.animation.visualX + offset.x, visual.animation.visualY + offset.y);
    }

    if (vfx) {
      this.updateStormForgeBond(state, viewWidth, viewHeight, now, vfx);
    }

    // Remove dead/removed heroes with death animation
    for (const [id, visual] of this.visuals) {
      if (!currentIds.has(id)) {
        if (!visual.animation.isDying) {
          this.startDeathAnimation(visual);
        } else if (visual.animation.deathProgress >= 1) {
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
      lastHp: hpPercent,
      lastTier: hero.tier as 1 | 2 | 3,
      tweenManager: new TweenManager(),
      scaleTween: null,
      alphaTween: null,
      hpTween: null,
      motionSequence: null,
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
      easing: easeOutCubic,
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
    const shadow = visual.container.getChildByLabel('shadow') as Graphics;
    const body = visual.container.getChildByLabel('body') as Graphics;
    const hpBar = visual.container.getChildByLabel('hpBar') as Graphics;
    const stateIndicator = visual.container.getChildByLabel('state') as Graphics;
    const tierBadge = visual.container.getChildByLabel('tier') as Graphics;

    const anim = visual.animation;
    const offset = { x: anim.offsetX, y: anim.offsetY };

    if (!body || !hpBar || !stateIndicator || !tierBadge) return offset;

    const colors = HERO_COLORS[hero.definitionId] || { primary: 0x888888, secondary: 0xaaaaaa, accent: 0xffffff };
    const tierKey = hero.tier as 1 | 2 | 3;
    const size = SIZES.heroBase * SIZES.tierMultiplier[tierKey];

    // Apply animated scale and alpha
    const baseScale = anim.scale || 1;
    const breatheStrength = hero.state === 'idle' ? 0.035 : 0.02;
    const breathe = 1 + Math.sin(time * 2 + visual.breathingPhase) * breatheStrength;
    const stretch = anim.stretch || 0;
    const horizontalDominant = Math.abs(anim.motionDirX) >= Math.abs(anim.motionDirY);
    const stretchX = horizontalDominant ? 1 + stretch : 1 - stretch * 0.6;
    const stretchY = horizontalDominant ? 1 - stretch * 0.6 : 1 + stretch;

    visual.container.scale.set(baseScale * breathe * stretchX, baseScale * breathe * stretchY);
    visual.container.alpha = anim.alpha || 1;

    // Draw shadow (ground indicator for depth)
    if (shadow && !anim.isDying) {
      shadow.clear();
      // Elliptical shadow below the hero
      const shadowOffsetY = size * 0.9;
      const shadowWidth = size * 0.8;
      const shadowHeight = size * 0.25;
      // Subtle breathing animation for shadow
      const shadowPulse = 1 + Math.sin(time * 2) * 0.05;
      shadow.ellipse(0, shadowOffsetY, shadowWidth * shadowPulse, shadowHeight)
        .fill({ color: 0x000000, alpha: 0.35 });
    } else if (shadow && anim.isDying) {
      // Fade shadow during death
      shadow.clear();
      const shadowOffsetY = size * 0.9;
      const shadowWidth = size * 0.8 * (1 - anim.deathProgress);
      const shadowHeight = size * 0.25 * (1 - anim.deathProgress);
      shadow.ellipse(0, shadowOffsetY, shadowWidth, shadowHeight)
        .fill({ color: 0x000000, alpha: 0.35 * (1 - anim.deathProgress) });
    }

    // Body needs redraw if dirty, in combat (animated), spawning, or dying
    // Combat state has continuous animation (glow, shake, tier 3 particles)
    const needsBodyRedraw = visual.dirty.body ||
                            hero.state === 'combat' ||
                            anim.isSpawning ||
                            anim.isDying ||
                            hero.tier === 3; // Tier 3 has rotating particles

    if (needsBodyRedraw) {
      body.clear();
      this.drawHeroBody(body, hero, size, colors, time, anim);
      visual.dirty.body = false;
    }

    // HP bar only redraws when HP is transitioning or dirty
    const isHpAnimating = visual.hpTween && !visual.hpTween.isComplete();
    if (visual.dirty.hpBar || isHpAnimating) {
      hpBar.clear();
      this.drawHpBar(hpBar, anim.hpPercent);
      if (!isHpAnimating) {
        visual.dirty.hpBar = false;
      }
    }

    // State indicator only redraws when state changes or transitioning
    if (visual.dirty.stateIndicator || anim.isTransitioning || hero.state === 'combat') {
      stateIndicator.clear();
      this.drawStateIndicator(stateIndicator, hero.state, anim);
      if (!anim.isTransitioning && hero.state !== 'combat') {
        visual.dirty.stateIndicator = false;
      }
    }

    // Tier badge is static - only redraw on tier change
    if (visual.dirty.tierBadge) {
      tierBadge.clear();
      this.drawTierBadge(tierBadge, hero.tier);
      visual.dirty.tierBadge = false;
    }

    return offset;
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

    if (visual.motionSequence) {
      visual.motionSequence.update(deltaMs);
      if (visual.motionSequence.isComplete()) {
        visual.motionSequence = null;
      }
    }

    const targetShift = Math.hypot(
      targetX - visual.motionTarget.x,
      targetY - visual.motionTarget.y
    );

    if (targetShift > MOTION.retargetDistance) {
      this.startMotionSequence(visual, targetX, targetY);
      return;
    }

    if (!visual.motionSequence) {
      const dist = Math.hypot(targetX - anim.visualX, targetY - anim.visualY);
      if (dist > MOTION.snapDistance) {
        this.startMotionSequence(visual, targetX, targetY);
      } else {
        anim.visualX = targetX;
        anim.visualY = targetY;
      }
    }
  }

  private startMotionSequence(
    visual: HeroVisual,
    targetX: number,
    targetY: number
  ): void {
    const anim = visual.animation;
    const startX = anim.visualX;
    const startY = anim.visualY;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const dist = Math.hypot(dx, dy);

    visual.motionTarget = { x: targetX, y: targetY };

    if (dist <= MOTION.snapDistance) {
      anim.visualX = targetX;
      anim.visualY = targetY;
      return;
    }

    const dirX = dx / dist;
    const dirY = dy / dist;
    const anticipation = Math.min(MOTION.anticipationMax, dist * MOTION.anticipationRatio);
    const overshoot = Math.min(MOTION.overshootMax, dist * MOTION.overshootRatio);
    const moveDuration = Math.min(
      MOTION.maxDuration,
      Math.max(MOTION.minDuration, dist * MOTION.durationPerPixel)
    );

    const applyPosition = (value: { x: number; y: number }) => {
      anim.visualX = value.x;
      anim.visualY = value.y;
    };

    const sequence = new TweenSequence();

    if (dist > 10) {
      const anticipateX = startX - dirX * anticipation;
      const anticipateY = startY - dirY * anticipation;

      sequence.add(
        new Tween(
          { x: startX, y: startY },
          { x: anticipateX, y: anticipateY },
          MOTION.anticipationDuration,
          { easing: easeOutQuad, onUpdate: (value) => applyPosition(value as { x: number; y: number }) }
        )
      );

      sequence.add(
        new Tween(
          { x: anticipateX, y: anticipateY },
          { x: targetX + dirX * overshoot, y: targetY + dirY * overshoot },
          moveDuration,
          { easing: easeOutCubic, onUpdate: (value) => applyPosition(value as { x: number; y: number }) }
        )
      );

      sequence.add(
        new Tween(
          { x: targetX + dirX * overshoot, y: targetY + dirY * overshoot },
          { x: targetX, y: targetY },
          MOTION.settleDuration,
          { easing: easeOutQuad, onUpdate: (value) => applyPosition(value as { x: number; y: number }) }
        )
      );
    } else {
      sequence.add(
        new Tween(
          { x: startX, y: startY },
          { x: targetX, y: targetY },
          moveDuration,
          { easing: easeOutCubic, onUpdate: (value) => applyPosition(value as { x: number; y: number }) }
        )
      );
    }

    visual.motionSequence = sequence;
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

    // === LAYER 1: Pulsating Ring (Tier 2+) ===
    if (hero.tier >= 2) {
      const ringRadius = size * (1.05 + Math.sin(time * 4) * 0.03);
      const ringAlpha = 0.4 + Math.sin(time * 6) * 0.1;
      g.circle(0, 0, ringRadius).stroke({ width: 2, color: colors.secondary, alpha: ringAlpha });
    }

    // === LAYER 3: Class-Specific Body Shape ===
    this.drawHeroShape(g, heroId, size, colors, time);

    // === LAYER 4: Inner Core/Emblem ===
    const coreSize = size * 0.35;
    const corePulse = 1 + Math.sin(time * 5) * 0.05;
    g.circle(0, 0, coreSize * corePulse).fill({ color: colors.accent, alpha: 0.9 });

    // Inner detail - energy lines
    for (let i = 0; i < 3; i++) {
      const angle = time * 2 + (i * Math.PI * 2) / 3;
      const lineLength = coreSize * 0.8;
      g.moveTo(0, 0)
        .lineTo(Math.cos(angle) * lineLength, Math.sin(angle) * lineLength)
        .stroke({ width: 1, color: 0xffffff, alpha: 0.5 });
    }

    // === LAYER 5: Tier 3 Rotating Particles ===
    if (hero.tier === 3) {
      const particleCount = 8;
      for (let i = 0; i < particleCount; i++) {
        const angle = time * 2.5 + (i * Math.PI * 2) / particleCount;
        const orbitRadius = size * 1.4;
        const particleSize = 3 + Math.sin(time * 8 + i) * 1;
        const px = Math.cos(angle) * orbitRadius;
        const py = Math.sin(angle) * orbitRadius;

        // Particle trail
        const trailAngle = angle - 0.3;
        g.moveTo(Math.cos(trailAngle) * orbitRadius, Math.sin(trailAngle) * orbitRadius)
          .lineTo(px, py)
          .stroke({ width: 2, color: colors.accent, alpha: 0.4 });

        g.circle(px, py, particleSize).fill({ color: colors.accent, alpha: 0.8 });
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

    switch (heroId) {
      // Tank classes - Hexagonal shield shape
      case 'titan':
      case 'jade_titan':
      case 'vanguard':
      case 'shield_captain':
      case 'glacier':
        this.drawHexagon(g, bodySize, colors);
        break;

      // Fire classes - Star/Flame shape
      case 'inferno':
        this.drawFlameShape(g, bodySize, colors, time);
        break;

      // Mage classes - Diamond/Crystal shape
      case 'rift':
      case 'scarlet_mage':
      case 'arcane_sorcerer':
        this.drawDiamond(g, bodySize, colors, time);
        break;

      // Tech classes - Octagonal gear shape
      case 'forge':
      case 'iron_sentinel':
        this.drawOctagonGear(g, bodySize, colors, time);
        break;

      // Electric classes - Lightning bolt inner shape
      case 'storm':
      case 'thunderlord':
        this.drawLightningShape(g, bodySize, colors, time);
        break;

      // Ice classes - Crystal/Snowflake shape
      case 'frost_unit':
      case 'frost_archer':
      case 'frost_giant':
        this.drawFrostShape(g, bodySize, colors, time);
        break;

      // Default - Enhanced circle
      default:
        g.circle(0, 0, bodySize)
          .fill({ color: colors.primary })
          .stroke({ width: 3, color: colors.secondary });
    }
  }

  private drawHexagon(g: Graphics, size: number, colors: { primary: number; secondary: number; accent: number }): void {
    const points: number[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 - Math.PI / 2;
      points.push(Math.cos(angle) * size, Math.sin(angle) * size);
    }
    g.poly(points).fill({ color: colors.primary }).stroke({ width: 4, color: colors.secondary });

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
    g.poly(points).fill({ color: colors.primary }).stroke({ width: 3, color: colors.secondary });

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
    g.poly(points).fill({ color: colors.primary }).stroke({ width: 3, color: colors.secondary });

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
    // Circle base
    g.circle(0, 0, size).fill({ color: colors.primary }).stroke({ width: 3, color: colors.secondary });

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
    // Circle base with icy gradient feel
    g.circle(0, 0, size).fill({ color: colors.primary }).stroke({ width: 3, color: colors.secondary });

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
    // Circle base with fire gradient
    g.circle(0, 0, size).fill({ color: colors.primary }).stroke({ width: 3, color: colors.secondary });

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
      indicatorAlpha = 0.7 + Math.sin(Date.now() / 150) * 0.3;
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
    switch (heroId) {
      // === UNIT-7 "STORM" ===
      case 'storm':
        switch (skillId) {
          case 'arc_strike':
            // Cast effect at hero - projectile carries the damage
            vfx.spawnClassImpact(heroX, heroY, 'lightning');
            break;
          case 'chain_lightning':
            // Cast effect at hero - projectile carries the damage
            vfx.spawnClassImpact(heroX, heroY, 'lightning');
            break;
          case 'ion_cannon':
            vfx.spawnEmpBlast(heroX, heroY);
            break;
          default:
            // Generic cast effect at hero
            vfx.spawnClassImpact(heroX, heroY, 'lightning');
        }
        break;

      // === UNIT-3 "FORGE" ===
      case 'forge':
        switch (skillId) {
          case 'laser_burst':
            vfx.spawnLaserBeam(heroX, heroY, targetX, targetY);
            break;
          case 'missile_barrage': {
            // Generate spread of targets
            const missileTargets = [];
            for (let i = 0; i < 5; i++) {
              missileTargets.push({
                x: targetX + (Math.random() - 0.5) * 100,
                y: targetY + (Math.random() - 0.5) * 60,
              });
            }
            vfx.spawnMissileBarrage(heroX, heroY, missileTargets);
            break;
          }
          case 'nano_swarm':
            vfx.spawnLaserBeam(heroX, heroY, targetX, targetY);
            break;
          default:
            vfx.spawnClassImpact(targetX, targetY, 'tech');
        }
        break;

      // === UNIT-1 "TITAN" ===
      case 'titan':
        switch (skillId) {
          case 'smash':
            vfx.spawnGroundSmash(heroX, heroY, 80);
            break;
          case 'seismic_stomp':
            vfx.spawnGroundSmash(heroX, heroY, 120);
            break;
          case 'kinetic_burst':
            vfx.spawnKineticBurst(heroX, heroY, 100);
            break;
          default:
            vfx.spawnGroundSmash(heroX, heroY, 60);
        }
        break;

      // === UNIT-0 "VANGUARD" ===
      case 'vanguard':
        switch (skillId) {
          case 'barrier_pulse':
          case 'dual_barrier': {
            // Create bounce path from hero to target and back
            const shieldPath = [
              { x: heroX, y: heroY },
              { x: targetX, y: targetY },
              { x: heroX + 50, y: heroY - 50 }, // Bounce point
              { x: heroX, y: heroY }, // Return
            ];
            vfx.spawnShieldThrow(shieldPath);
            break;
          }
          case 'kinetic_hammer':
            // Kinetic hammer - thrown projectile (impact VFX triggers on hit)
            vfx.spawnHammerThrow(heroX, heroY, targetX, targetY);
            break;
          default: {
            const defaultPath = [
              { x: heroX, y: heroY },
              { x: targetX, y: targetY },
            ];
            vfx.spawnShieldThrow(defaultPath);
          }
        }
        break;

      // === UNIT-9 "RIFT" ===
      case 'rift':
        switch (skillId) {
          case 'plasma_bolt':
            vfx.spawnPlasmaBolt(heroX, heroY, targetX, targetY);
            break;
          case 'plasma_wave':
            // Cast effect at hero - projectile carries the damage
            vfx.spawnThermalImpact(heroX, heroY, 60);
            break;
          case 'plasma_shield':
            // Shield spawns at hero position - not a projectile
            vfx.spawnThermalImpact(heroX, heroY, 60);
            break;
          default:
            vfx.spawnPlasmaBolt(heroX, heroY, targetX, targetY);
        }
        break;

      // === UNIT-5 "FROST" ===
      case 'frost':
        switch (skillId) {
          case 'cryo_shot':
            vfx.spawnFrostArrow(heroX, heroY, targetX, targetY);
            break;
          case 'multi_shot': {
            // Create spread of targets
            const arrowTargets = [
              { x: targetX - 40, y: targetY - 20 },
              { x: targetX, y: targetY },
              { x: targetX + 40, y: targetY + 20 },
            ];
            vfx.spawnMultiShot(heroX, heroY, arrowTargets);
            break;
          }
          case 'shatter_shot':
            // Frost arrow travels - freeze impact happens when projectile hits
            vfx.spawnFrostArrow(heroX, heroY, targetX, targetY);
            break;
          default:
            vfx.spawnFrostArrow(heroX, heroY, targetX, targetY);
        }
        break;

      default:
        // Unknown hero - use generic class effect based on projectile class
        vfx.spawnSkillActivation(heroX, heroY, 'natural');
    }
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
