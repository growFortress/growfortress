import { Container, Text, TextStyle } from 'pixi.js';
import type { Particle, FloatingText } from '../types.js';
import type { ParticleFactory } from '../particleFactory.js';
import type { ParticlePool } from '../particlePool.js';
import { DAMAGE_TEXT_CONFIG, CRIT_TEXT_CONFIG, STREAK_CONFIGS, COMBO_CONFIGS } from '../config.js';
import { filterManager } from '../../../effects/FilterManager.js';
import i18n from '../../../../i18n/index.js';
import { isFirstSession, FIRST_SESSION_WAVE_THRESHOLD, gameState } from '../../../../state/game.signals.js';
import { FIRST_SESSION_SHAKE_THRESHOLD } from '../../../../state/settings.signals.js';

/**
 * Text effect handlers for damage numbers, combos, kill streaks.
 * Handles floating text creation and visual styles.
 */
export class TextEffects {
  constructor(
    private pool: ParticlePool,
    private particles: Particle[],
    private factory: ParticleFactory,
    private container: Container,
    private floatingTexts: FloatingText[],
    private triggerScreenShake: (intensity: number, duration: number) => void,
    private damageNumbersEnabled: () => boolean
  ) {}

  /**
   * Spawn generic floating text
   */
  spawnFloatingText(x: number, y: number, text: string, color: number = 0xffffff): void {
    if (!this.damageNumbersEnabled()) return;

    const style = new TextStyle({
      fontFamily: 'Arial Black, Impact, sans-serif',
      fontSize: 22,
      fontWeight: 'bold',
      fill: color,
      stroke: { width: 4, color: '#000000' },
      dropShadow: {
        color: '#000000',
        blur: 4,
        angle: Math.PI / 4,
        distance: 3,
        alpha: 0.85,
      },
    });

    const pixiText = new Text({ text, style });
    pixiText.x = x;
    pixiText.y = y;
    pixiText.anchor.set(0.5);
    pixiText.scale.set(0.6);

    this.container.addChild(pixiText);
    this.floatingTexts.push({
      text: pixiText,
      life: 1.0,
      maxLife: 1.0,
      vy: -40,
      vx: (Math.random() - 0.5) * 10, // Slight horizontal drift
      scale: 0.6,
      targetScale: 0.5,
    });
  }

  /**
   * Spawn damage number with scaling based on damage amount.
   * Bigger damage = bigger text for more satisfying feedback.
   */
  spawnDamageNumber(
    x: number,
    y: number,
    damage: number,
    options: { isCrit?: boolean; color?: number } = {}
  ): void {
    if (!this.damageNumbersEnabled()) return;

    const { isCrit = false, color } = options;
    const config = isCrit ? CRIT_TEXT_CONFIG : DAMAGE_TEXT_CONFIG;

    // Scale font size with damage (logarithmic scaling for balance)
    const scaledSize = config.baseFontSize + Math.pow(damage, 0.25) * 2.5;
    const fontSize = Math.min(scaledSize, config.maxFontSize);

    // Crit gets yellow color and "!" suffix
    const textColor = isCrit ? 0xffff00 : (color ?? 0xffaa00);
    const displayText = isCrit ? `${Math.round(damage)}!` : Math.round(damage).toString();

    const style = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: fontSize,
      fontWeight: 'bold',
      fill: textColor,
      stroke: { width: config.strokeWidth, color: '#000000' },
      dropShadow: {
        color: '#000000',
        blur: config.shadowBlur,
        angle: Math.PI / 4,
        distance: isCrit ? 4 : 2,
        alpha: 0.85,
      },
    });

    const pixiText = new Text({ text: displayText, style });
    pixiText.x = x + (Math.random() - 0.5) * config.driftX;
    pixiText.y = y;
    pixiText.anchor.set(0.5);

    // Crits start bigger for pop-in effect
    const startScale = isCrit ? 0.7 : 0.4;
    pixiText.scale.set(startScale);

    this.container.addChild(pixiText);
    this.floatingTexts.push({
      text: pixiText,
      life: config.floatLife,
      maxLife: config.floatLife,
      vy: config.floatSpeed,
      vx: (Math.random() - 0.5) * 8,
      scale: startScale,
      targetScale: isCrit ? 0.6 : 0.45,
    });

    // Screen shake for high damage - lower threshold during first session
    const shakeThreshold = this.isInFirstSessionBoostWindow() ? FIRST_SESSION_SHAKE_THRESHOLD : 1000;
    if (damage >= shakeThreshold) {
      // Slightly stronger shake during first session
      const intensity = this.isInFirstSessionBoostWindow() ? 3 : 2;
      this.triggerScreenShake(intensity, 100);
    }
  }

  /**
   * Check if we're in the first session boost window.
   */
  private isInFirstSessionBoostWindow(): boolean {
    if (!isFirstSession.value) return false;
    const state = gameState.value;
    if (!state) return true;
    return state.wave <= FIRST_SESSION_WAVE_THRESHOLD;
  }

  /**
   * Spawn kill streak effect based on streak count.
   * Escalating feedback: text -> flash -> shake
   */
  spawnKillStreakEffect(x: number, y: number, streak: number): void {
    // Find the highest matching streak tier
    let matchedConfig: typeof STREAK_CONFIGS[0] | null = null;
    for (const config of STREAK_CONFIGS) {
      if (streak >= config.threshold) {
        matchedConfig = config;
      }
    }

    if (!matchedConfig) return;

    const style = new TextStyle({
      fontFamily: 'Arial Black, Impact, sans-serif',
      fontSize: matchedConfig.fontSize + (streak * 0.5),
      fontWeight: 'bold',
      fill: matchedConfig.color,
      stroke: { width: 5, color: '#000000' },
      dropShadow: {
        color: '#000000',
        blur: 6,
        angle: Math.PI / 4,
        distance: 4,
        alpha: 0.9,
      },
      letterSpacing: 1,
    });

    const pixiText = new Text({ text: i18n.t(matchedConfig.nameKey), style });
    pixiText.x = x;
    pixiText.y = y - 40;
    pixiText.anchor.set(0.5);
    pixiText.scale.set(0.5);

    this.container.addChild(pixiText);
    this.floatingTexts.push({
      text: pixiText,
      life: 1.2,
      maxLife: 1.2,
      vy: -30,
      vx: 0,
      scale: 0.5,
      targetScale: 0.55,
    });

    // Flash for 5+ kills
    if (matchedConfig.flash) {
      const flashColor: 'yellow' | 'red' | 'white' = streak >= 15 ? 'red' : 'yellow';
      filterManager.applyScreenFlash(flashColor, 150, 0.2);
    }

    // Screen shake for 10+ kills
    if (matchedConfig.shake > 0) {
      this.triggerScreenShake(matchedConfig.shake, 200);
    }
  }

  /**
   * Spawn combo effect when elemental combo triggers.
   */
  spawnComboEffect(
    x: number,
    y: number,
    comboId: string,
    bonusDamage?: number
  ): void {
    const config = COMBO_CONFIGS[comboId];
    if (!config) return;

    // Floating combo text
    this.spawnFloatingText(x, y - 20, i18n.t(config.nameKey), config.color);

    // Show bonus damage if provided
    if (bonusDamage && bonusDamage > 0) {
      setTimeout(() => {
        this.spawnDamageNumber(x, y, bonusDamage, { isCrit: true });
      }, 100);
    }

    // Subtle screen flash
    filterManager.applyScreenFlash('white', 80, 0.1);

    // Expanding ring
    this.factory.ring({
      x, y,
      color: config.color,
      startSize: 10,
      endSize: config.ringSize,
      life: 0.3,
      alpha: 0.7,
    });
  }

  /**
   * Update floating texts (called from main update loop)
   */
  updateFloatingTexts(dt: number): void {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;

      // Move
      ft.text.y += ft.vy * dt;
      if (ft.vx) {
        ft.text.x += ft.vx * dt;
      }

      // Fade out
      const lifeRatio = ft.life / ft.maxLife;
      ft.text.alpha = Math.max(0, lifeRatio);

      // Pop-in scaling effect
      if (ft.scale !== undefined && ft.targetScale !== undefined) {
        const scaleProgress = 1 - lifeRatio;
        const currentScale = ft.scale + (ft.targetScale - ft.scale) * Math.min(scaleProgress * 3, 1);
        ft.text.scale.set(currentScale * lifeRatio + 0.3 * (1 - lifeRatio));
      }

      if (ft.life <= 0) {
        this.container.removeChild(ft.text);
        ft.text.destroy();
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  /**
   * Spawn confetti particles for celebrations
   */
  spawnConfetti(x: number, y: number, particleMultiplier: number): void {
    const count = Math.floor(50 * particleMultiplier);
    const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];

    for (let i = 0; i < count; i++) {
      const p = this.pool.acquire();
      p.x = x;
      p.y = y;

      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 200;

      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 100; // Upward bias

      p.life = 1.5 + Math.random();
      p.maxLife = p.life;
      p.size = 4 + Math.random() * 4;
      p.color = colors[Math.floor(Math.random() * colors.length)];
      p.shape = 'confetti';
      p.gravity = 100;
      p.drag = 0.95;

      p.rotation = Math.random() * Math.PI * 2;
      p.rotationSpeed = (Math.random() - 0.5) * 10;

      this.particles.push(p);
    }
  }

  /**
   * Critical hit effect with flash and particles
   */
  spawnCriticalHit(x: number, y: number): void {
    // Yellow flash
    this.factory.flash({ x, y, color: 0xffff00, size: 30 });

    // Star burst particles
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const p = this.pool.acquire();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * 100;
      p.vy = Math.sin(angle) * 100;
      p.life = 0.25;
      p.maxLife = 0.25;
      p.size = 4;
      p.color = 0xffff00;
      p.shape = 'star';
      p.rotation = angle;
      p.drag = 0.9;
      this.particles.push(p);
    }
  }
}
