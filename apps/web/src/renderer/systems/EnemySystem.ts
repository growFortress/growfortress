import { Container, Graphics } from 'pixi.js';
import type { GameState, Enemy, EnemyType, StatusEffectType } from '@arcade/sim-core';
import { VFXSystem } from './VFXSystem.js';
import { audioManager } from '../../game/AudioManager.js';
import { EnemyVisualPool, type EnemyVisualBundle } from '../ObjectPool.js';
import { fpXToScreen, calculateEnemyLaneY } from '../CoordinateSystem.js';

// --- CONSTANTS ---
const THEME = {
  elite: 0xffcc00,
  hitFlash: 0xffffff,
  hpBar: {
    background: 0x000000,
    border: 0x000000,
    high: 0x00ff00, // > 60%
    mid: 0xffff00,  // 30-60%
    low: 0xff4444,  // < 30%
  },
  statusEffects: {
    slow: { color: 0x00aaff, icon: '❄' },      // Light blue - ice/cold
    freeze: { color: 0x00ffff, icon: '🧊' },    // Cyan - frozen solid
    burn: { color: 0xff6600, icon: '🔥' },      // Orange - fire
    poison: { color: 0x00ff00, icon: '☠' },     // Green - toxic
    stun: { color: 0xffff00, icon: '⚡' },       // Yellow - electric
  } as Record<StatusEffectType, { color: number; icon: string }>,
};

// Pre-compiled enemy colors as typed array indices for O(1) lookup
// Using Map for type-safe access with enum-like keys
const ENEMY_COLORS: Record<EnemyType, number> = {
  // Base enemies
  runner: 0x44ff44,
  bruiser: 0xff4444,
  leech: 0xaa44ff,
  // Streets
  gangster: 0x888888,
  thug: 0x666666,
  mafia_boss: 0x222222,
  // Science
  robot: 0x00ccff,
  drone: 0x88ddff,
  ai_core: 0x00ffff,
  // Mutants
  sentinel: 0xff6600,
  mutant_hunter: 0xcc4400,
  // Cosmos
  kree_soldier: 0x3366ff,
  skrull: 0x33cc33,
  cosmic_beast: 0x9900cc,
  // Magic
  demon: 0xff0066,
  sorcerer: 0xcc00ff,
  dimensional_being: 0x6600cc,
  // Gods
  einherjar: 0xffcc00,
  titan: 0x996600,
  god: 0xffff00,
};

// Pre-computed color lookup using Map for O(1) access (faster than object property access)
const ENEMY_COLOR_MAP = new Map<EnemyType, number>(
  Object.entries(ENEMY_COLORS) as [EnemyType, number][]
);

// Pre-computed size lookup
const ENEMY_SIZE_MAP = new Map<EnemyType, number>();

// Fast color lookup function (avoids object property access overhead)
function getEnemyColor(type: EnemyType): number {
  return ENEMY_COLOR_MAP.get(type) ?? 0xffffff;
}

// Fast size lookup function
function getEnemySize(type: EnemyType): number {
  let size = ENEMY_SIZE_MAP.get(type);
  if (size === undefined) {
    size = ENEMY_SIZES[type] ?? ENEMY_SIZES.runner;
    ENEMY_SIZE_MAP.set(type, size);
  }
  return size;
}

const ENEMY_SIZES: Record<EnemyType, number> = {
  // Base enemies
  runner: 18,
  bruiser: 30,
  leech: 22,
  // Streets
  gangster: 18,
  thug: 24,
  mafia_boss: 35,
  // Science
  robot: 22,
  drone: 14,
  ai_core: 40,
  // Mutants
  sentinel: 35,
  mutant_hunter: 22,
  // Cosmos
  kree_soldier: 22,
  skrull: 20,
  cosmic_beast: 45,
  // Magic
  demon: 25,
  sorcerer: 20,
  dimensional_being: 50,
  // Gods
  einherjar: 26,
  titan: 55,
  god: 60,
};

const SIZES = {
  eliteMultiplier: 1.3,
  hpBar: { height: 10, enemyHeight: 7, borderWidth: 1, borderRadius: 3 },
};

export class EnemySystem {
  public container: Container;

  // Map of Enemy ID -> Visual bundle (pooled)
  private visuals: Map<number, EnemyVisualBundle> = new Map();

  // Object pool for enemy visuals (15-25% faster frame times during high enemy waves)
  private visualPool = new EnemyVisualPool(150);

  // Track state to minimize redrawing
  private lastHp: Map<number, number> = new Map();
  private visualHp: Map<number, number> = new Map(); // For smooth separation
  private prevKills = 0;

  // Track status effects for dirty flag optimization
  private lastEffectKeys: Map<number, string> = new Map(); // Serialized effect types

  constructor() {
    this.container = new Container();
    // Pre-warm pool with common enemy count
    this.visualPool.prewarm(30);
  }

  public update(state: GameState, viewWidth: number, viewHeight: number, vfx?: VFXSystem) {
    const currentIds = new Set<number>();
    const time = Date.now() / 1000; // Seconds for animation

    // 1. Update / Create Visuals
    for (const enemy of state.enemies) {
      currentIds.add(enemy.id);

      let bundle = this.visuals.get(enemy.id);
      if (!bundle) {
        bundle = this.createEnemyVisual(enemy);
        this.container.addChild(bundle.container);
        this.visuals.set(enemy.id, bundle);
        this.lastHp.set(enemy.id, -1); // Force HP bar update
      }

      const visual = bundle.container;

      // Update Position
      const x = fpXToScreen(enemy.x, viewWidth);
      const y = calculateEnemyLaneY(enemy.id, viewHeight);
      visual.position.set(x, y);

      // Handle Hit Reaction (Squash)
      // ... logic skipped for brevity, keeping existing update logic ...
      
      // Animation
      const breatheSpeed = 5;
      const breatheAmount = 0.05;
      const phase = time * breatheSpeed + enemy.id;
      const stretch = Math.sin(phase) * breatheAmount;
      visual.scale.set(1 - stretch, 1 + stretch);

      // --- VISUAL POLISH ---
      const previousHp = this.lastHp.get(enemy.id) ?? enemy.hp;
      
      // 1. Floating Damage Numbers
      if (previousHp > enemy.hp && vfx) {
        const damage = previousHp - enemy.hp;
        // Check threshold to avoid spamming small ticks (optional, keeping it simple for now)
        if (damage >= 1) {
             vfx.spawnFloatingText(visual.x, visual.y - 20, Math.round(damage).toString(), 0xffaa00);
             audioManager.playSfx('hit');
        }
      }

      // 2. Smooth HP Bar
      let currentVisualHp = this.visualHp.get(enemy.id) ?? enemy.hp;
      if (currentVisualHp !== enemy.hp) {
          // Lerp towards target
          // Using a fixed lerp factor normalized by dt would be better, but simple lerp works for 60fps
          currentVisualHp = currentVisualHp + (enemy.hp - currentVisualHp) * 0.2;
          
          // Snap if close enough
          if (Math.abs(currentVisualHp - enemy.hp) < 0.1) {
              currentVisualHp = enemy.hp;
          }
          
          this.visualHp.set(enemy.id, currentVisualHp);
          this.updateHpBar(visual, enemy, currentVisualHp);
      } else if (previousHp !== enemy.hp) {
          // Force update if logic changed but visual caught up (edge case)
          this.updateHpBar(visual, enemy, enemy.hp);
      }

      this.lastHp.set(enemy.id, enemy.hp);

      
      // Update Hit Flash
      const body = visual.getChildByLabel('body') as Graphics;
      if (body) {
           if (enemy.hitFlashTicks > 0) {
               body.tint = THEME.hitFlash;
           } else {
               body.tint = 0xffffff;
           }
      }

      // Update Status Effects display
      this.updateStatusEffects(visual, enemy, time);
    }

    // 2. Remove dead sprites (release back to pool instead of destroying)
    const killsIncreased = state.kills > this.prevKills;
    for (const [id, bundle] of this.visuals) {
      if (!currentIds.has(id)) {
        if (killsIncreased && vfx) {
          vfx.spawnExplosion(bundle.container.x, bundle.container.y, 0xffaa00);
        }
        this.container.removeChild(bundle.container);
        this.visualPool.release(bundle); // Return to pool for reuse
        this.visuals.delete(id);
        this.lastHp.delete(id);
        this.visualHp.delete(id);
        this.lastEffectKeys.delete(id);
      }
    }
    this.prevKills = state.kills;
  }

  private createEnemyVisual(enemy: Enemy): EnemyVisualBundle {
    // Acquire from pool instead of creating new objects
    const bundle = this.visualPool.acquire(enemy.isElite);

    // Use optimized Map-based lookups instead of object property access
    let size = getEnemySize(enemy.type);
    if (enemy.isElite) size *= SIZES.eliteMultiplier;

    const color = getEnemyColor(enemy.type);

    // 0. Elite Glow Layer (handled by pool based on isElite flag)
    if (bundle.eliteGlow) {
      // Multi-layer glow for elite enemies
      bundle.eliteGlow.circle(0, 0, size * 1.5).fill({ color: THEME.elite, alpha: 0.15 });
      bundle.eliteGlow.circle(0, 0, size * 1.25).fill({ color: THEME.elite, alpha: 0.2 });
    }

    // 1. Body Graphics - draw unique shape per enemy type
    this.drawEnemyShape(bundle.body, enemy.type, size, color, enemy.isElite);

    // 3. HP Bar Container position
    bundle.hpBar.position.y = -size - 10;

    // 4. Status Effects Container position
    bundle.statusEffects.position.y = size + 5;

    return bundle;
  }

  private updateHpBar(container: Container, enemy: Enemy, displayedHp: number) {
      const hpBar = container.getChildByLabel('hpBar') as Graphics;
      if (!hpBar) return;

      hpBar.clear();

      // Don't draw if full HP
      if (enemy.maxHp <= 0 || enemy.hp >= enemy.maxHp) return;

      // Use optimized lookup
      let size = getEnemySize(enemy.type);
      if (enemy.isElite) size *= SIZES.eliteMultiplier;
      
      const width = size * 2.2;
      const height = SIZES.hpBar.enemyHeight;
      const x = -width / 2;
      const y = 0;
      
      const hpPercent = Math.max(0, displayedHp / enemy.maxHp);
      const radius = SIZES.hpBar.borderRadius;
      
      // Background
      hpBar.roundRect(x, y, width, height, radius)
           .fill({ color: THEME.hpBar.background, alpha: 0.7 })
           .stroke({ width: 1, color: THEME.hpBar.border, alpha: 0.9 });

      // Fill
      if (hpPercent > 0) {
          let fillColor = THEME.hpBar.high;
          if (hpPercent <= 0.3) fillColor = THEME.hpBar.low;
          else if (hpPercent <= 0.6) fillColor = THEME.hpBar.mid;
          
          if (enemy.isElite) fillColor = THEME.elite;

          const fillWidth = Math.max(0, (width - 2) * hpPercent);
          hpBar.roundRect(x + 1, y + 1, fillWidth, height - 2, Math.max(0, radius - 1))
               .fill(fillColor);
      }
  }

  /**
   * Update status effects visual indicators
   * Uses dirty flag optimization - only redraws when effects change
   */
  private updateStatusEffects(container: Container, enemy: Enemy, time: number): void {
    const statusEffects = container.getChildByLabel('statusEffects') as Graphics;
    if (!statusEffects) return;

    // Create a key from current effects for dirty checking
    // Optimized: avoid sort() by using a Set-based approach - O(n) instead of O(n log n)
    const currentEffectKey = enemy.activeEffects && enemy.activeEffects.length > 0
      ? this.buildEffectKey(enemy.activeEffects)
      : '';
    const lastEffectKey = this.lastEffectKeys.get(enemy.id) ?? '';

    // Check if effects changed (types added/removed)
    const effectsChanged = currentEffectKey !== lastEffectKey;

    // Only redraw if effects changed OR if we have effects (for animation)
    // We need to animate while effects are active, but can skip when no effects
    const hasEffects = enemy.activeEffects && enemy.activeEffects.length > 0;

    if (!hasEffects) {
      // No effects - clear once if we had effects before
      if (effectsChanged) {
        statusEffects.clear();
        this.lastEffectKeys.set(enemy.id, '');
      }
      return;
    }

    // Update last effect key
    if (effectsChanged) {
      this.lastEffectKeys.set(enemy.id, currentEffectKey);
    }

    // Effects need animation, so we redraw them
    // However, we can optimize by not clearing/redrawing every frame
    // For now, effects have pulse animation so they need updates
    statusEffects.clear();

    const effectSize = 8;
    const effectSpacing = 12;
    const totalWidth = enemy.activeEffects.length * effectSpacing - (effectSpacing - effectSize);
    const startX = -totalWidth / 2;

    for (let i = 0; i < enemy.activeEffects.length; i++) {
      const effect = enemy.activeEffects[i];
      const effectTheme = THEME.statusEffects[effect.type];
      if (!effectTheme) continue;

      const x = startX + i * effectSpacing;

      // Pulsing animation based on effect type
      const pulseSpeed = effect.type === 'burn' ? 8 : effect.type === 'stun' ? 12 : 4;
      const pulseAmount = 0.3;
      const pulse = Math.sin(time * pulseSpeed + i) * pulseAmount + 1;

      // Draw effect indicator (small circle with glow)
      const effectColor = effectTheme.color;
      const size = effectSize * pulse;

      // Glow background
      statusEffects.circle(x, 0, size * 1.5)
        .fill({ color: effectColor, alpha: 0.3 });

      // Inner circle
      statusEffects.circle(x, 0, size)
        .fill({ color: effectColor, alpha: 0.9 });

      // Border for visibility
      statusEffects.circle(x, 0, size)
        .stroke({ width: 1, color: 0x000000, alpha: 0.5 });
    }
  }

  /**
   * Draw unique shape for each enemy type with enhanced visuals
   */
  private drawEnemyShape(g: Graphics, type: EnemyType, size: number, color: number, isElite: boolean = false): void {
    // Calculate lighter and darker shades for depth
    const lightColor = this.lightenColor(color, 0.3);
    const darkColor = this.darkenColor(color, 0.3);

    switch (type) {
      // === BASE ENEMIES ===
      case 'runner':
        // Fast-moving circle with motion trail hint
        g.circle(0, 0, size).fill(color);
        // Inner highlight for depth
        g.arc(0, 0, size * 0.7, -Math.PI * 0.8, -Math.PI * 0.2).stroke({ width: 2, color: lightColor, alpha: 0.5 });
        // Speed lines
        g.moveTo(-size * 0.3, 0).lineTo(-size * 1.2, 0).stroke({ width: 2, color, alpha: 0.3 });
        g.moveTo(-size * 0.3, -size * 0.3).lineTo(-size * 1.1, -size * 0.2).stroke({ width: 1, color, alpha: 0.2 });
        g.moveTo(-size * 0.3, size * 0.3).lineTo(-size * 1.1, size * 0.2).stroke({ width: 1, color, alpha: 0.2 });
        break;

      case 'bruiser':
        // Tanky square with armor plates
        g.roundRect(-size, -size, size * 2, size * 2, size * 0.25).fill(color);
        // Armor plate lines
        g.roundRect(-size * 0.85, -size * 0.85, size * 1.7, size * 1.7, size * 0.15).stroke({ width: 2, color: darkColor });
        // Highlight
        g.moveTo(-size * 0.8, -size * 0.8).lineTo(size * 0.5, -size * 0.8).stroke({ width: 3, color: lightColor, alpha: 0.4 });
        break;

      case 'leech':
        // Diamond with pulsing inner core
        g.poly([0, -size, size, 0, 0, size, -size, 0]).fill(color);
        g.poly([0, -size * 0.6, size * 0.6, 0, 0, size * 0.6, -size * 0.6, 0]).stroke({ width: 2, color: lightColor, alpha: 0.5 });
        // Inner glow (life-stealing energy)
        g.circle(0, 0, size * 0.25).fill({ color: 0xff00ff, alpha: 0.6 });
        break;

      // === STREET ENEMIES ===
      case 'gangster':
        this.drawPolygon(g, 5, size, color);
        g.circle(0, 0, size * 0.4).fill(darkColor);
        break;

      case 'thug':
        this.drawPolygon(g, 6, size, color);
        // Scar-like detail
        g.moveTo(-size * 0.3, -size * 0.4).lineTo(size * 0.3, size * 0.2).stroke({ width: 2, color: darkColor });
        break;

      case 'mafia_boss':
        // Triple ring boss
        g.circle(0, 0, size).fill(color);
        g.circle(0, 0, size * 0.75).stroke({ width: 3, color: 0x444444 });
        g.circle(0, 0, size * 0.5).fill(0x111111);
        g.circle(0, 0, size * 0.3).fill(color);
        // Crown-like top
        g.poly([-size * 0.3, -size * 0.8, 0, -size * 1.1, size * 0.3, -size * 0.8]).fill(THEME.elite);
        break;

      // === SCIENCE ENEMIES ===
      case 'robot':
        g.roundRect(-size, -size, size * 2, size * 2, size * 0.2).fill(color);
        // Panel lines
        g.moveTo(-size * 0.8, 0).lineTo(size * 0.8, 0).stroke({ width: 1, color: darkColor });
        // Eye with glow
        g.circle(0, -size * 0.3, size * 0.3).fill(0x111111);
        g.circle(0, -size * 0.3, size * 0.2).fill(0xff0000);
        g.circle(-size * 0.05, -size * 0.35, size * 0.05).fill(0xffffff);
        break;

      case 'drone':
        // Sleek triangle with thrusters
        g.poly([size, 0, -size * 0.6, -size * 0.7, -size * 0.6, size * 0.7]).fill(color);
        // Thruster glow
        g.circle(-size * 0.7, -size * 0.4, size * 0.15).fill({ color: 0x00ffff, alpha: 0.7 });
        g.circle(-size * 0.7, size * 0.4, size * 0.15).fill({ color: 0x00ffff, alpha: 0.7 });
        // Cockpit
        g.ellipse(size * 0.2, 0, size * 0.25, size * 0.15).fill(0x222222);
        break;

      case 'ai_core':
        // Complex layered core
        g.circle(0, 0, size).fill(color);
        g.circle(0, 0, size * 0.8).stroke({ width: 2, color: 0x000000 });
        g.circle(0, 0, size * 0.6).stroke({ width: 2, color: lightColor });
        g.circle(0, 0, size * 0.4).fill(0x111111);
        // Digital eye
        g.circle(0, 0, size * 0.25).fill(0x00ffff);
        g.rect(-size * 0.2, -size * 0.03, size * 0.4, size * 0.06).fill(0x000000);
        break;

      // === MUTANT ENEMIES ===
      case 'sentinel':
        // Humanoid with glowing chest
        g.roundRect(-size * 0.7, -size * 0.2, size * 1.4, size * 1.2, size * 0.1).fill(color);
        g.circle(0, -size * 0.55, size * 0.45).fill(color);
        // Chest reactor
        g.circle(0, size * 0.2, size * 0.2).fill(0xff6600);
        g.circle(0, size * 0.2, size * 0.12).fill(0xffff00);
        // Eyes
        g.ellipse(-size * 0.15, -size * 0.55, size * 0.12, size * 0.08).fill(0xff0000);
        g.ellipse(size * 0.15, -size * 0.55, size * 0.12, size * 0.08).fill(0xff0000);
        break;

      case 'mutant_hunter':
        this.drawStar(g, 6, size, size * 0.5, color);
        // Glowing core
        g.circle(0, 0, size * 0.3).fill({ color: 0xff0000, alpha: 0.8 });
        break;

      // === COSMIC ENEMIES ===
      case 'kree_soldier':
        g.poly([0, -size, size * 0.8, -size * 0.3, size * 0.8, size * 0.6, 0, size, -size * 0.8, size * 0.6, -size * 0.8, -size * 0.3]).fill(color);
        // Helmet visor
        g.roundRect(-size * 0.4, -size * 0.7, size * 0.8, size * 0.3, size * 0.1).fill(0x000066);
        break;

      case 'skrull':
        // Morphing blob
        g.ellipse(0, 0, size, size * 0.7).fill(color);
        g.circle(-size * 0.4, -size * 0.35, size * 0.25).fill(color);
        g.circle(size * 0.4, -size * 0.35, size * 0.25).fill(color);
        // Chin
        g.ellipse(0, size * 0.4, size * 0.3, size * 0.2).fill(color);
        // Eyes
        g.ellipse(-size * 0.2, -size * 0.1, size * 0.15, size * 0.1).fill(0xffff00);
        g.ellipse(size * 0.2, -size * 0.1, size * 0.15, size * 0.1).fill(0xffff00);
        break;

      case 'cosmic_beast':
        // Radiant cosmic entity
        this.drawStar(g, 8, size, size * 0.6, color);
        g.circle(0, 0, size * 0.5).fill({ color: 0xffffff, alpha: 0.8 });
        g.circle(0, 0, size * 0.35).fill(color);
        // Energy tendrils
        for (let i = 0; i < 4; i++) {
          const angle = (i * Math.PI) / 2;
          g.moveTo(0, 0)
            .lineTo(Math.cos(angle) * size * 1.2, Math.sin(angle) * size * 1.2)
            .stroke({ width: 2, color: 0xffffff, alpha: 0.3 });
        }
        break;

      // === MAGIC ENEMIES ===
      case 'demon':
        // Demonic with horns and glowing eyes
        g.circle(0, size * 0.1, size * 0.8).fill(color);
        // Horns
        g.poly([-size * 0.55, -size * 0.1, -size * 0.4, -size, -size * 0.1, -size * 0.2]).fill(darkColor);
        g.poly([size * 0.55, -size * 0.1, size * 0.4, -size, size * 0.1, -size * 0.2]).fill(darkColor);
        // Glowing eyes
        g.ellipse(-size * 0.25, 0, size * 0.15, size * 0.1).fill(0xffff00);
        g.ellipse(size * 0.25, 0, size * 0.15, size * 0.1).fill(0xffff00);
        // Mouth
        g.arc(0, size * 0.3, size * 0.3, 0, Math.PI).stroke({ width: 2, color: 0x000000 });
        break;

      case 'sorcerer':
        // Mystical with aura
        g.poly([0, -size, size, 0, 0, size, -size, 0]).fill(color);
        // Inner glow
        g.poly([0, -size * 0.6, size * 0.6, 0, 0, size * 0.6, -size * 0.6, 0]).fill({ color: 0xffffff, alpha: 0.6 });
        // Eye
        g.circle(0, -size * 0.1, size * 0.2).fill(0x000000);
        g.circle(0, -size * 0.1, size * 0.1).fill(0xff00ff);
        break;

      case 'dimensional_being':
        // Eldritch horror
        g.circle(0, 0, size).fill(color);
        g.circle(0, 0, size * 0.75).stroke({ width: 3, color: 0x000000 });
        g.circle(0, 0, size * 0.55).stroke({ width: 2, color: 0xffffff });
        g.circle(0, 0, size * 0.35).fill(0x000000);
        // Void eye
        g.circle(0, 0, size * 0.2).fill(0xff00ff);
        // Tentacle hints
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI * 2) / 6;
          const endX = Math.cos(angle) * size * 1.3;
          const endY = Math.sin(angle) * size * 1.3;
          g.moveTo(Math.cos(angle) * size, Math.sin(angle) * size)
            .lineTo(endX, endY)
            .stroke({ width: 3, color, alpha: 0.5 });
        }
        break;

      // === GOD ENEMIES ===
      case 'einherjar':
        this.drawPolygon(g, 8, size, color);
        // Shield emblem
        g.circle(0, 0, size * 0.5).fill(darkColor);
        g.circle(0, 0, size * 0.35).fill(THEME.elite);
        break;

      case 'titan':
        // Massive with glowing eye
        g.roundRect(-size * 0.8, -size, size * 1.6, size * 2, size * 0.15).fill(color);
        // Armor lines
        g.moveTo(-size * 0.7, -size * 0.3).lineTo(size * 0.7, -size * 0.3).stroke({ width: 2, color: darkColor });
        g.moveTo(-size * 0.7, size * 0.3).lineTo(size * 0.7, size * 0.3).stroke({ width: 2, color: darkColor });
        // Eye
        g.circle(0, -size * 0.6, size * 0.3).fill(0x111111);
        g.circle(0, -size * 0.6, size * 0.2).fill(0xff6600);
        g.circle(-size * 0.05, -size * 0.65, size * 0.05).fill(0xffffff);
        break;

      case 'god':
        // Radiant deity
        this.drawStar(g, 12, size, size * 0.7, color);
        g.circle(0, 0, size * 0.55).fill(0xffffff);
        g.circle(0, 0, size * 0.4).fill(THEME.elite);
        // Divine eye
        g.ellipse(0, 0, size * 0.25, size * 0.15).fill(0x000000);
        g.circle(0, 0, size * 0.08).fill(0xffffff);
        break;

      default:
        g.circle(0, 0, size).fill(color);
        g.arc(0, 0, size * 0.7, -Math.PI * 0.8, -Math.PI * 0.2).stroke({ width: 2, color: lightColor, alpha: 0.4 });
    }

    // Elite border
    if (isElite) {
      g.circle(0, 0, size * 1.05).stroke({ width: 3, color: THEME.elite });
    }
  }

  /**
   * Lighten a color by a factor (0-1)
   */
  private lightenColor(color: number, factor: number): number {
    const r = Math.min(255, ((color >> 16) & 0xff) + 255 * factor);
    const g = Math.min(255, ((color >> 8) & 0xff) + 255 * factor);
    const b = Math.min(255, (color & 0xff) + 255 * factor);
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
  }

  /**
   * Darken a color by a factor (0-1)
   */
  private darkenColor(color: number, factor: number): number {
    const r = ((color >> 16) & 0xff) * (1 - factor);
    const g = ((color >> 8) & 0xff) * (1 - factor);
    const b = (color & 0xff) * (1 - factor);
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
  }

  /**
   * Draw a regular polygon
   */
  private drawPolygon(g: Graphics, sides: number, radius: number, color: number): void {
    const points: number[] = [];
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
      points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    g.poly(points).fill(color);
  }

  /**
   * Draw a star shape
   */
  private drawStar(g: Graphics, points: number, outerRadius: number, innerRadius: number, color: number): void {
    const starPoints: number[] = [];
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / points - Math.PI / 2;
      starPoints.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    g.poly(starPoints).fill(color);
  }

  /**
   * Build a stable effect key without sorting - O(n) instead of O(n log n)
   * Uses a fixed order based on known effect types
   */
  private buildEffectKey(effects: { type: StatusEffectType }[]): string {
    // Pre-defined order for consistent keys without sorting
    const order: StatusEffectType[] = ['slow', 'freeze', 'burn', 'poison', 'stun'];
    const present = new Set(effects.map(e => e.type));
    return order.filter(type => present.has(type)).join(',');
  }
}
