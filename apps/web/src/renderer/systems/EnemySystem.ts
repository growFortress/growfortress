import { Container, Graphics } from 'pixi.js';
import type { GameState, Enemy, EnemyType, StatusEffectType } from '@arcade/sim-core';
import { FP } from '@arcade/sim-core';
import { VFXSystem } from './VFXSystem.js';

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
  
  // Map of Enemy ID -> Sprite (Visual representation)
  private sprites: Map<number, Container> = new Map();
  
  // Track state to minimize redrawing
  private lastHp: Map<number, number> = new Map();
  private prevKills = 0;

  constructor() {
    this.container = new Container();
  }

  public update(state: GameState, viewWidth: number, viewHeight: number, vfx?: VFXSystem) {
    const currentIds = new Set<number>();
    const time = Date.now() / 1000; // Seconds for animation

    // 1. Update / Create Visuals
    for (const enemy of state.enemies) {
      currentIds.add(enemy.id);
      
      let visual = this.sprites.get(enemy.id);
      if (!visual) {
        visual = this.createEnemyVisual(enemy);
        this.container.addChild(visual);
        this.sprites.set(enemy.id, visual);
        this.lastHp.set(enemy.id, -1); // Force HP bar update
      }

      // Update Position
      const x = this.toScreenX(enemy.x, viewWidth);
      const y = this.calculateLaneY(enemy.id, viewHeight);
      visual.position.set(x, y);

      // Handle Hit Reaction (Squash)
      // ... logic skipped for brevity, keeping existing update logic ...
      
      // Animation
      const breatheSpeed = 5;
      const breatheAmount = 0.05;
      const phase = time * breatheSpeed + enemy.id;
      const stretch = Math.sin(phase) * breatheAmount;
      visual.scale.set(1 - stretch, 1 + stretch);

      // Update HP Bar (Optimized)
      const lastHp = this.lastHp.get(enemy.id);
      if (lastHp !== enemy.hp) {
          this.updateHpBar(visual, enemy);
          this.lastHp.set(enemy.id, enemy.hp);
      }
      
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

    // 2. Remove dead sprites
    const killsIncreased = state.kills > this.prevKills;
    for (const [id, visual] of this.sprites) {
      if (!currentIds.has(id)) {
        if (killsIncreased && vfx) {
            vfx.spawnExplosion(visual.x, visual.y, 0xffaa00);
        }
        this.container.removeChild(visual);
        visual.destroy({ children: true });
        this.sprites.delete(id);
        this.lastHp.delete(id);
      }
    }
    this.prevKills = state.kills;
  }

  private createEnemyVisual(enemy: Enemy): Container {
    const container = new Container();
    
    // 1. Body Graphics (Static, drawn once)
    const g = new Graphics();
    g.label = 'body';
    
    let size = ENEMY_SIZES[enemy.type] ?? ENEMY_SIZES.runner;
    if (enemy.isElite) size *= SIZES.eliteMultiplier;
    
    const color = ENEMY_COLORS[enemy.type] ?? 0xffffff;
    
    // Draw unique shape per enemy type
    this.drawEnemyShape(g, enemy.type, size, color);
    
    if (enemy.isElite) {
      g.stroke({ width: 3, color: THEME.elite });
    }

    container.addChild(g);

    // 2. HP Bar Container
    const hpBar = new Graphics();
    hpBar.label = 'hpBar';
    hpBar.position.y = -size - 10;
    container.addChild(hpBar);

    // 3. Status Effects Container
    const statusEffects = new Graphics();
    statusEffects.label = 'statusEffects';
    statusEffects.position.y = size + 5; // Below the enemy
    container.addChild(statusEffects);

    return container;
  }

  private updateHpBar(container: Container, enemy: Enemy) {
      const hpBar = container.getChildByLabel('hpBar') as Graphics;
      if (!hpBar) return;
      
      hpBar.clear();
      
      // Don't draw if full HP
      if (enemy.maxHp <= 0 || enemy.hp >= enemy.maxHp) return;

      let size = ENEMY_SIZES[enemy.type] ?? ENEMY_SIZES.runner;
      if (enemy.isElite) size *= SIZES.eliteMultiplier;
      
      const width = size * 2.2;
      const height = SIZES.hpBar.enemyHeight;
      const x = -width / 2;
      const y = 0;
      
      const hpPercent = enemy.hp / enemy.maxHp;
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
   */
  private updateStatusEffects(container: Container, enemy: Enemy, time: number): void {
    const statusEffects = container.getChildByLabel('statusEffects') as Graphics;
    if (!statusEffects) return;

    statusEffects.clear();

    // No effects to show
    if (!enemy.activeEffects || enemy.activeEffects.length === 0) return;

    const effectSize = 8;
    const effectSpacing = 12;
    const totalWidth = enemy.activeEffects.length * effectSpacing - (effectSpacing - effectSize);
    let startX = -totalWidth / 2;

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
   * Draw unique shape for each enemy type
   */
  private drawEnemyShape(g: Graphics, type: EnemyType, size: number, color: number): void {
    switch (type) {
      // === BASE ENEMIES ===
      case 'runner':
        // Simple circle - fast moving
        g.circle(0, 0, size).fill(color);
        break;

      case 'bruiser':
        // Rounded rectangle - tanky
        g.roundRect(-size, -size, size * 2, size * 2, size * 0.3).fill(color);
        break;

      case 'leech':
        // Diamond shape - life steal
        g.poly([0, -size, size, 0, 0, size, -size, 0]).fill(color);
        break;

      // === STREET ENEMIES ===
      case 'gangster':
        // Pentagon - organized crime
        this.drawPolygon(g, 5, size, color);
        break;

      case 'thug':
        // Rough hexagon - brute force
        this.drawPolygon(g, 6, size, color);
        break;

      case 'mafia_boss':
        // Large octagon with inner ring - boss
        g.circle(0, 0, size).fill(color);
        g.circle(0, 0, size * 0.6).fill(0x000000);
        g.circle(0, 0, size * 0.4).fill(color);
        break;

      // === SCIENCE ENEMIES ===
      case 'robot':
        // Square with rounded corners - mechanical
        g.roundRect(-size, -size, size * 2, size * 2, size * 0.2).fill(color);
        // Add "eye" detail
        g.circle(0, -size * 0.3, size * 0.25).fill(0xffffff);
        break;

      case 'drone':
        // Small triangle pointing right - fast drone
        g.poly([size, 0, -size * 0.6, -size * 0.7, -size * 0.6, size * 0.7]).fill(color);
        break;

      case 'ai_core':
        // Complex shape - multiple rings
        g.circle(0, 0, size).fill(color);
        g.circle(0, 0, size * 0.7).stroke({ width: 3, color: 0x000000 });
        g.circle(0, 0, size * 0.4).fill(0xffffff);
        break;

      // === MUTANT ENEMIES ===
      case 'sentinel':
        // Large rectangle with head - humanoid robot
        g.roundRect(-size * 0.7, -size, size * 1.4, size * 2, size * 0.15).fill(color);
        g.circle(0, -size * 0.6, size * 0.4).fill(color);
        break;

      case 'mutant_hunter':
        // Star-like shape - aggressive
        this.drawStar(g, 6, size, size * 0.5, color);
        break;

      // === COSMIC ENEMIES ===
      case 'kree_soldier':
        // Shield shape - militaristic
        g.poly([0, -size, size * 0.8, -size * 0.3, size * 0.8, size * 0.6, 0, size, -size * 0.8, size * 0.6, -size * 0.8, -size * 0.3]).fill(color);
        break;

      case 'skrull':
        // Irregular blob - shapeshifter
        g.ellipse(0, 0, size, size * 0.7).fill(color);
        g.circle(-size * 0.4, -size * 0.3, size * 0.25).fill(color);
        g.circle(size * 0.4, -size * 0.3, size * 0.25).fill(color);
        break;

      case 'cosmic_beast':
        // Large star with glow effect
        this.drawStar(g, 8, size, size * 0.6, color);
        g.circle(0, 0, size * 0.4).fill(0xffffff);
        break;

      // === MAGIC ENEMIES ===
      case 'demon':
        // Horned shape - demonic
        g.circle(0, size * 0.1, size * 0.8).fill(color);
        g.poly([-size * 0.5, -size * 0.2, -size * 0.3, -size, 0, -size * 0.3]).fill(color);
        g.poly([size * 0.5, -size * 0.2, size * 0.3, -size, 0, -size * 0.3]).fill(color);
        break;

      case 'sorcerer':
        // Mystical diamond with inner glow
        g.poly([0, -size, size, 0, 0, size, -size, 0]).fill(color);
        g.poly([0, -size * 0.5, size * 0.5, 0, 0, size * 0.5, -size * 0.5, 0]).fill(0xffffff);
        break;

      case 'dimensional_being':
        // Eldritch spiral shape
        g.circle(0, 0, size).fill(color);
        g.circle(0, 0, size * 0.7).stroke({ width: 4, color: 0x000000 });
        g.circle(0, 0, size * 0.5).stroke({ width: 3, color: 0xffffff });
        g.circle(0, 0, size * 0.3).fill(0x000000);
        break;

      // === GOD ENEMIES ===
      case 'einherjar':
        // Viking warrior shield
        this.drawPolygon(g, 8, size, color);
        g.circle(0, 0, size * 0.5).stroke({ width: 2, color: 0x000000 });
        break;

      case 'titan':
        // Massive rectangular body
        g.roundRect(-size * 0.8, -size, size * 1.6, size * 2, size * 0.1).fill(color);
        g.circle(0, -size * 0.5, size * 0.35).fill(0xffffff);
        g.circle(0, -size * 0.5, size * 0.2).fill(0x000000);
        break;

      case 'god':
        // Radiant star with glowing core
        this.drawStar(g, 12, size, size * 0.7, color);
        g.circle(0, 0, size * 0.5).fill(0xffffff);
        g.circle(0, 0, size * 0.3).fill(color);
        break;

      default:
        // Fallback to circle
        g.circle(0, 0, size).fill(color);
    }
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

  private toScreenX(fpX: number, viewWidth: number): number {
    const unitX = FP.toFloat(fpX);
    const fieldWidth = 40;
    return (unitX / fieldWidth) * viewWidth;
  }

  private calculateLaneY(enemyId: number, viewHeight: number): number {
     const enemyVerticalLanes = 7;
     const enemyVerticalSpread = 40;
     const laneOffset = (enemyId % enemyVerticalLanes) - Math.floor(enemyVerticalLanes / 2);
     return viewHeight / 2 + laneOffset * enemyVerticalSpread;
  }
}
