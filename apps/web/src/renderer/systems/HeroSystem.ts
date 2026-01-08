import { Container, Graphics, Text } from 'pixi.js';
import type { GameState, ActiveHero, HeroState } from '@arcade/sim-core';
import { FP } from '@arcade/sim-core';
import { Tween, TweenManager } from '../animation/Tween.js';
import { easeOutQuad, easeOutElastic, easeOutCubic, easeInOutSine } from '../animation/easing.js';
import type { VFXSystem } from './VFXSystem.js';

// Hero-specific colors (based on Marvel inspirations)
const HERO_COLORS: Record<string, { primary: number; secondary: number; accent: number }> = {
  thunderlord: { primary: 0x1e90ff, secondary: 0x87ceeb, accent: 0xffd700 }, // Thor blue + gold
  iron_sentinel: { primary: 0xb22222, secondary: 0xffd700, accent: 0x00ffff }, // Iron Man red/gold
  jade_titan: { primary: 0x228b22, secondary: 0x32cd32, accent: 0x9932cc }, // Hulk green
  spider_sentinel: { primary: 0xff0000, secondary: 0x0000ff, accent: 0xffffff }, // Spider-Man
  shield_captain: { primary: 0x0000cd, secondary: 0xff0000, accent: 0xffffff }, // Cap blue/red/white
  scarlet_mage: { primary: 0xdc143c, secondary: 0x8b0000, accent: 0xff69b4 }, // Scarlet Witch
  frost_archer: { primary: 0x4b0082, secondary: 0x00bfff, accent: 0xffffff }, // Hawkeye + Ice
  flame_phoenix: { primary: 0xff4500, secondary: 0xffd700, accent: 0xff0000 }, // Phoenix
  venom_assassin: { primary: 0x1a1a1a, secondary: 0x8b0000, accent: 0x00ff00 }, // Black Widow + Poison
  arcane_sorcerer: { primary: 0x4b0082, secondary: 0xff4500, accent: 0x00ff00 }, // Doctor Strange
  frost_giant: { primary: 0x00ced1, secondary: 0x228b22, accent: 0xffd700 }, // Loki
  cosmic_guardian: { primary: 0x8b4513, secondary: 0xff4500, accent: 0xffd700 }, // Star-Lord
};

// State colors
const STATE_COLORS: Record<HeroState, number> = {
  idle: 0x888888,
  deploying: 0x00ff00,
  combat: 0xff4444,
  returning: 0xffaa00,
  cooldown: 0x4444ff,
  dead: 0x333333,
  commanded: 0x00ffff, // Cyan for player-commanded state
};

// Target visual properties for each state
const STATE_VISUALS: Record<HeroState, { scale: number; alpha: number }> = {
  idle: { scale: 1.0, alpha: 1.0 },
  deploying: { scale: 1.0, alpha: 1.0 },
  combat: { scale: 1.0, alpha: 1.0 },
  returning: { scale: 1.0, alpha: 1.0 },
  cooldown: { scale: 1.0, alpha: 0.6 },
  dead: { scale: 1.0, alpha: 0.3 },
  commanded: { scale: 1.0, alpha: 1.0 }, // Full visibility when commanded
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
}

interface HeroVisual {
  container: Container;
  lastState: HeroState;
  heroId: string;
  animation: HeroAnimationState;
  lastHp: number;
  tweenManager: TweenManager;
  scaleTween: Tween<number> | null;
  alphaTween: Tween<number> | null;
  hpTween: Tween<number> | null;
  // Track skill cooldowns to detect skill usage
  lastSkillCooldowns: Record<string, number>;
}

export class HeroSystem {
  public container: Container;
  private visuals: Map<string, HeroVisual> = new Map();
  private onHeroClick: ((heroId: string) => void) | null = null;
  private lastUpdateTime: number = 0;

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
      }

      // Handle HP changes
      const hpPercent = hero.maxHp > 0 ? hero.currentHp / hero.maxHp : 0;
      if (Math.abs(visual.lastHp - hpPercent) > 0.01) {
        this.startHpTransition(visual, visual.lastHp, hpPercent);
        visual.lastHp = hpPercent;
      }

      // Detect skill usage and trigger VFX
      if (vfx && hero.skillCooldowns) {
        const screenX = this.toScreenX(hero.x, viewWidth);
        const screenY = this.toScreenY(hero.y, viewHeight);
        this.detectAndTriggerSkillVFX(visual, hero, screenX, screenY, state, viewWidth, viewHeight, vfx);
      }

      // Update tweens
      visual.tweenManager.update(deltaMs);

      // Update animation state
      this.updateAnimationState(visual, hero, deltaMs, time);

      // Update position
      const screenX = this.toScreenX(hero.x, viewWidth);
      const screenY = this.toScreenY(hero.y, viewHeight);

      // Update visuals (which may apply animation offsets)
      const offset = this.updateHeroVisual(visual, hero, time);

      // Apply final position with animation offset
      visual.container.position.set(screenX + offset.x, screenY + offset.y);
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

    // Body graphics
    const body = new Graphics();
    body.label = 'body';
    container.addChild(body);

    // HP bar
    const hpBar = new Graphics();
    hpBar.label = 'hpBar';
    hpBar.position.y = -SIZES.heroBase - 15;
    container.addChild(hpBar);

    // State indicator
    const stateIndicator = new Graphics();
    stateIndicator.label = 'state';
    stateIndicator.position.y = SIZES.heroBase + 10;
    container.addChild(stateIndicator);

    // Name tag (small)
    const nameTag = new Text({
      text: this.getHeroDisplayName(hero.definitionId),
      style: {
        fontSize: 10,
        fill: 0xffffff,
        fontFamily: 'Arial',
      },
    });
    nameTag.label = 'name';
    nameTag.anchor.set(0.5, 1);
    nameTag.position.y = SIZES.nameTagOffset;
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
      tweenManager: new TweenManager(),
      scaleTween: null,
      alphaTween: null,
      hpTween: null,
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
      },
    };
  }

  /**
   * Start spawn animation
   */
  private startSpawnAnimation(visual: HeroVisual): void {
    visual.animation.isSpawning = true;
    visual.animation.spawnProgress = 0;

    // Scale from 0 to target with elastic bounce
    const targetVisuals = STATE_VISUALS[visual.lastState];
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
    deltaMs: number,
    time: number
  ): void {
    const anim = visual.animation;

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

    // State-specific continuous animations
    switch (hero.state) {
      case 'idle':
        // Static idle - no animation
        break;

      case 'deploying':
        // Static during deployment - no animation
        break;

      case 'combat': {
        // Combat shake with intensity falloff
        const shakeIntensity = 2 * easeInOutSine(Math.min(1, anim.combatIntensity));
        anim.offsetX = Math.sin(time * 20) * shakeIntensity;
        anim.offsetY = Math.cos(time * 25) * shakeIntensity * 0.3;

        // Decay combat intensity for initial burst
        if (anim.combatIntensity > 0) {
          anim.combatIntensity = Math.max(0.5, anim.combatIntensity - deltaMs / 500);
        }
        break;
      }

      case 'returning':
        // Static during return - no animation
        break;

      default:
        anim.offsetX = 0;
        anim.offsetY = 0;
    }
  }

  private updateHeroVisual(visual: HeroVisual, hero: ActiveHero, time: number): { x: number; y: number } {
    const body = visual.container.getChildByLabel('body') as Graphics;
    const hpBar = visual.container.getChildByLabel('hpBar') as Graphics;
    const stateIndicator = visual.container.getChildByLabel('state') as Graphics;
    const tierBadge = visual.container.getChildByLabel('tier') as Graphics;

    const anim = visual.animation;
    const offset = { x: anim.offsetX, y: anim.offsetY };

    if (!body || !hpBar || !stateIndicator || !tierBadge) return offset;

    // Clear and redraw
    body.clear();
    hpBar.clear();
    stateIndicator.clear();
    tierBadge.clear();

    const colors = HERO_COLORS[hero.definitionId] || { primary: 0x888888, secondary: 0xaaaaaa, accent: 0xffffff };
    const tierKey = hero.tier as 1 | 2 | 3;
    const size = SIZES.heroBase * SIZES.tierMultiplier[tierKey];

    // Apply animated scale and alpha
    visual.container.scale.set(anim.scale || 1);
    visual.container.alpha = anim.alpha || 1;

    // Draw hero body
    this.drawHeroBody(body, hero, size, colors, time, anim);

    // Draw HP bar with animated HP
    this.drawHpBar(hpBar, anim.hpPercent);

    // Draw state indicator with transition effect
    this.drawStateIndicator(stateIndicator, hero.state, anim);

    // Draw tier badge
    this.drawTierBadge(tierBadge, hero.tier);

    return offset;
  }

  private drawHeroBody(
    g: Graphics,
    hero: ActiveHero,
    size: number,
    colors: { primary: number; secondary: number; accent: number },
    time: number,
    anim: HeroAnimationState
  ) {
    // Outer glow (based on tier and state)
    const glowSize = size * (1 + hero.tier * 0.1);
    let glowAlpha = 0.2 + hero.tier * 0.1;

    // Enhanced glow during combat
    if (hero.state === 'combat') {
      glowAlpha += Math.sin(time * 10) * 0.1;
    }

    // Spawn glow
    if (anim.isSpawning && anim.spawnProgress < 1) {
      glowAlpha += (1 - anim.spawnProgress) * 0.3;
    }

    g.circle(0, 0, glowSize)
      .fill({ color: colors.accent, alpha: glowAlpha });

    // Main body - circular with hero colors
    g.circle(0, 0, size * 0.9)
      .fill({ color: colors.primary })
      .stroke({ width: 3, color: colors.secondary });

    // Inner emblem
    g.circle(0, 0, size * 0.4)
      .fill({ color: colors.accent, alpha: 0.8 });

    // Class-specific effect for Tier 3
    if (hero.tier === 3) {
      // Rotating particle ring
      for (let i = 0; i < 6; i++) {
        const angle = time * 2 + (i * Math.PI) / 3;
        const px = Math.cos(angle) * size * 1.3;
        const py = Math.sin(angle) * size * 1.3;
        g.circle(px, py, 3)
          .fill({ color: colors.accent, alpha: 0.6 });
      }
    }

    // Combat indicator - weapon flash
    if (hero.state === 'combat') {
      const flashAlpha = (Math.sin(time * 15) + 1) / 2 * anim.combatIntensity;
      g.circle(size * 0.7, -size * 0.7, 6)
        .fill({ color: 0xffff00, alpha: flashAlpha * 0.8 });
    }

    // Death effect - cracks
    if (anim.isDying && anim.deathProgress > 0) {
      const crackAlpha = anim.deathProgress * 0.8;
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2 + time;
        const innerR = size * 0.2 * (1 + anim.deathProgress);
        const outerR = size * 0.8 * (1 + anim.deathProgress * 0.5);
        g.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR)
          .lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR)
          .stroke({ width: 2, color: 0xff0000, alpha: crackAlpha });
      }
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
      1: 0xcd7f32, // Bronze
      2: 0xc0c0c0, // Silver
      3: 0xffd700, // Gold
    };

    const color = tierColors[tier];

    // Star shape for tier
    g.circle(0, 0, 8)
      .fill({ color })
      .stroke({ width: 1, color: 0xffffff });

    // Number inside (using simple graphics)
    for (let i = 0; i < tier; i++) {
      g.circle(-3 + i * 3, 0, 1.5)
        .fill({ color: 0xffffff });
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
      thunderlord: 'Thor',
      iron_sentinel: 'Iron',
      jade_titan: 'Hulk',
      spider_sentinel: 'Spider',
      shield_captain: 'Cap',
      scarlet_mage: 'Scarlet',
      frost_archer: 'Hawk',
      flame_phoenix: 'Phoenix',
      venom_assassin: 'Widow',
      arcane_sorcerer: 'Strange',
      frost_giant: 'Loki',
      cosmic_guardian: 'Star',
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
          x: this.toScreenX(enemy.x, viewWidth),
          y: this.toScreenY(enemy.y, viewHeight),
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
      // === THUNDERLORD (THOR) ===
      case 'thunderlord':
        switch (skillId) {
          case 'hammer_throw':
          case 'mjolnir':
          case 'stormbreaker':
            vfx.spawnHammerThrow(heroX, heroY, targetX, targetY);
            break;
          case 'godblast':
            vfx.spawnGodblast(heroX, heroY);
            break;
          default:
            // Generic lightning effect
            vfx.spawnLightningStrike(targetX, targetY);
        }
        break;

      // === IRON SENTINEL (IRON MAN) ===
      case 'iron_sentinel':
        switch (skillId) {
          case 'repulsor':
            vfx.spawnRepulsorBeam(heroX, heroY, targetX, targetY);
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
            vfx.spawnRepulsorBeam(heroX, heroY, targetX, targetY);
            break;
          case 'proton_cannon':
            vfx.spawnProtonCannon(heroX, heroY, targetX, targetY);
            break;
          default:
            vfx.spawnClassImpact(targetX, targetY, 'tech');
        }
        break;

      // === JADE TITAN (HULK) ===
      case 'jade_titan':
        switch (skillId) {
          case 'smash':
            vfx.spawnGroundSmash(heroX, heroY, 80);
            break;
          case 'worldbreaker_stomp':
            vfx.spawnGroundSmash(heroX, heroY, 120);
            break;
          case 'gamma_burst':
            vfx.spawnGammaBurst(heroX, heroY, 100);
            break;
          case 'worldbreaker_ultimate':
            vfx.spawnWorldbreaker(heroX, heroY);
            break;
          default:
            vfx.spawnGroundSmash(heroX, heroY, 60);
        }
        break;

      // === SHIELD CAPTAIN (CAPTAIN AMERICA) ===
      case 'shield_captain':
        switch (skillId) {
          case 'shield_throw':
          case 'dual_shields': {
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
          case 'mjolnir_cap':
            // Cap wielding Mjolnir - lightning + hammer!
            vfx.spawnHammerThrow(heroX, heroY, targetX, targetY);
            vfx.spawnLightningStrike(targetX, targetY);
            break;
          case 'assemble':
            // Assemble with placeholder hero positions (would need actual hero positions)
            vfx.spawnAvengersAssemble(heroX, heroY, []);
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

      // === SCARLET MAGE (SCARLET WITCH) ===
      case 'scarlet_mage':
        switch (skillId) {
          case 'hex_bolt':
            vfx.spawnHexBolt(heroX, heroY, targetX, targetY);
            break;
          case 'chaos_wave':
            vfx.spawnChaosImpact(targetX, targetY, 100);
            break;
          case 'hex_sphere':
            vfx.spawnChaosImpact(heroX, heroY, 60);
            break;
          case 'no_more_enemies':
            vfx.spawnRealityWarp(heroX, heroY);
            break;
          default:
            vfx.spawnHexBolt(heroX, heroY, targetX, targetY);
        }
        break;

      // === FROST ARCHER (HAWKEYE) ===
      case 'frost_archer':
        switch (skillId) {
          case 'frost_arrow':
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
            vfx.spawnFrostArrow(heroX, heroY, targetX, targetY);
            vfx.spawnFreezeImpact(targetX, targetY, 60);
            break;
          case 'blizzard_barrage':
            vfx.spawnBlizzardBarrage(targetX, targetY, 150);
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

  // --- Helpers ---
  private toScreenX(fpX: number, viewWidth: number): number {
    const unitX = FP.toFloat(fpX);
    const fieldWidth = 40;
    return (unitX / fieldWidth) * viewWidth;
  }

  private toScreenY(fpY: number, viewHeight: number): number {
    const unitY = FP.toFloat(fpY);
    const fieldHeight = 15;
    const pathTop = viewHeight * 0.35;
    const pathBottom = viewHeight * 0.65; // Path is 30% of screen (35% to 65%)
    return pathTop + (unitY / fieldHeight) * (pathBottom - pathTop);
  }
}
