import type { GameState, Enemy, ActiveHero, ActiveTurret, TurretSlot, ActiveProjectile } from '@arcade/sim-core';
import { FP } from '@arcade/sim-core';

const COLORS = {
  background: '#16213e',
  fortress: '#00d9ff',
  fortressHp: '#00ff00',
  hitFlash: '#ffffff',
  hpBarBackground: 'rgba(0, 0, 0, 0.7)',
  hpBarBorder: 'rgba(0, 0, 0, 0.9)',
  hpBarHighlight: 'rgba(255, 255, 255, 0.3)',
  elite: '#ffcc00',
  eliteGlow: 'rgba(255, 204, 0, 0.4)',
  text: '#fff',
  // Heroes
  heroIdle: '#4488ff',
  heroCombat: '#ff4444',
  heroCommanded: '#00ffff',
  heroOutline: '#ffffff',
  // Turrets
  turretBase: '#555555',
  turretBarrel: '#888888',
  // Projectiles
  projectile: '#ffff00',
  projectileGlow: 'rgba(255, 255, 0, 0.5)',
  // Battlefield markers
  spawnZone: 'rgba(255, 68, 68, 0.15)',
  spawnBorder: 'rgba(255, 68, 68, 0.4)',
  targetZone: 'rgba(0, 229, 255, 0.1)',
  targetBorder: 'rgba(0, 229, 255, 0.3)',
  laneMarker: 'rgba(255, 255, 255, 0.08)',
  directionArrow: 'rgba(255, 100, 100, 0.3)',
} as const;

/** Hero colors by ID */
const HERO_COLORS: Record<string, string> = {
  thunderlord: '#1e90ff',
  iron_sentinel: '#b22222',
  jade_titan: '#228b22',
  spider_sentinel: '#ff0000',
  shield_captain: '#0000cd',
  scarlet_mage: '#dc143c',
  frost_archer: '#4b0082',
  flame_phoenix: '#ff4500',
  venom_assassin: '#1a1a1a',
  arcane_sorcerer: '#4b0082',
  frost_giant: '#00ced1',
  cosmic_guardian: '#8b4513',
};

/** Turret class colors */
const TURRET_CLASS_COLORS: Record<string, string> = {
  natural: '#228b22',
  ice: '#00bfff',
  fire: '#ff4500',
  lightning: '#9932cc',
  poison: '#9acd32',
  magic: '#8a2be2',
  tech: '#00f0ff',
};

/** Returns HP bar color based on percentage (green → yellow → red) */
function getHpColor(percent: number): string {
  if (percent > 0.6) {
    // Green to yellow (60-100%)
    const t = (percent - 0.6) / 0.4;
    const r = Math.round(255 * (1 - t));
    const g = 255;
    return `rgb(${r}, ${g}, 50)`;
  } else if (percent > 0.3) {
    // Yellow to orange (30-60%)
    const t = (percent - 0.3) / 0.3;
    const r = 255;
    const g = Math.round(180 + 75 * t);
    return `rgb(${r}, ${g}, 50)`;
  } else {
    // Orange to red (0-30%)
    const t = percent / 0.3;
    const r = 255;
    const g = Math.round(80 * t);
    return `rgb(${r}, ${g}, 30)`;
  }
}

const ENEMY_COLORS: Record<Enemy['type'], string> = {
  // Base enemies
  runner: '#44ff44',
  bruiser: '#ff4444',
  leech: '#aa44ff',
  // Streets
  gangster: '#888888',
  thug: '#666666',
  mafia_boss: '#222222',
  // Science
  robot: '#00ccff',
  drone: '#88ddff',
  ai_core: '#00ffff',
  // Mutants
  sentinel: '#ff6600',
  mutant_hunter: '#cc4400',
  // Cosmos
  kree_soldier: '#3366ff',
  skrull: '#33cc33',
  cosmic_beast: '#9900cc',
  // Magic
  demon: '#ff0066',
  sorcerer: '#cc00ff',
  dimensional_being: '#6600cc',
  // Gods
  einherjar: '#ffcc00',
  titan: '#996600',
  god: '#ffff00',
  // Special enemies
  catapult: '#8b4513',
  sapper: '#ff8c00',
  healer: '#00ff7f',
  shielder: '#4169e1',
  teleporter: '#9400d3',
} as const;

const ENEMY_SIZES: Record<Enemy['type'], number> = {
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
  // Special enemies
  catapult: 35,
  sapper: 20,
  healer: 18,
  shielder: 28,
  teleporter: 16,
} as const;

const SIZES = {
  eliteMultiplier: 1.3,
  fortress: { width: 80, height: 130 },
  hpBar: { height: 10, enemyHeight: 7, borderWidth: 1, borderRadius: 3 },
  hero: { radius: 20, outlineWidth: 2 },
  turret: { baseRadius: 18, barrelLength: 15, barrelWidth: 8 },
  projectile: { radius: 4 },
} as const;

const LAYOUT = {
  fortressPositionX: 2,
  enemyVerticalSpread: 40,
  enemyVerticalLanes: 7,
  fortressHpBarOffset: 20,
  enemyHpBarOffset: 8,
} as const;

const FONTS = {
  hpText: '12px sans-serif',
} as const;

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private fieldWidth: number;
  private resizeObserver: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement, fieldWidth = 40) {
    this.canvas = canvas;
    this.fieldWidth = fieldWidth;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2d context');
    this.ctx = ctx;

    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
  }

  /** Clean up observers to prevent memory leaks */
  destroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.width = rect.width;
    this.height = rect.height;

    // Reset transform before scaling
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
  }

  private toScreenX(fpX: number): number {
    const unitX = FP.toFloat(fpX);
    return (unitX / this.fieldWidth) * this.width;
  }

  /** Calculate vertical lane position for an enemy based on its ID */
  private calculateLaneY(enemyId: number): number {
    const laneOffset = (enemyId % LAYOUT.enemyVerticalLanes) - Math.floor(LAYOUT.enemyVerticalLanes / 2);
    return this.height / 2 + laneOffset * LAYOUT.enemyVerticalSpread;
  }

  render(state: GameState | null, alpha: number): void {
    // Alpha can be used for interpolation between frames for smooth rendering
    // Currently unused but available for future implementation
    void alpha;

    // Ensure canvas has proper dimensions (might be 0 if was hidden)
    if (this.width === 0 || this.height === 0) {
      this.resize();
    }

    const ctx = this.ctx;

    // Reset context state at start of each frame to prevent accumulated state bugs
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.lineWidth = 1;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';

    // Clear
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, this.width, this.height);

    // Draw battlefield markers (lanes, spawn zone, target zone)
    this.drawBattlefieldMarkers();

    // Always draw fortress (use default values if no state)
    this.drawFortress(state);

    // Draw game elements only if game is running
    if (state) {
      // Draw turret slots and turrets
      for (const slot of state.turretSlots) {
        const turret = state.turrets.find(t => t.slotIndex === slot.index);
        this.drawTurretSlot(slot, turret);
      }

      // Draw heroes
      for (const hero of state.heroes) {
        this.drawHero(hero);
      }

      // Draw projectiles
      for (const projectile of state.projectiles) {
        this.drawProjectile(projectile);
      }

      // Draw enemies
      for (const enemy of state.enemies) {
        this.drawEnemy(enemy);
      }
    }
  }

  /** Draw battlefield markers: spawn zone, target zone, lanes, and direction arrows */
  private drawBattlefieldMarkers(): void {
    const ctx = this.ctx;
    ctx.save();

    // Lane markers (horizontal stripes)
    const laneCount = LAYOUT.enemyVerticalLanes;
    for (let i = 0; i < laneCount; i++) {
      const laneY = this.height / 2 + (i - Math.floor(laneCount / 2)) * LAYOUT.enemyVerticalSpread;
      const laneHeight = 30;

      ctx.fillStyle = COLORS.laneMarker;
      ctx.fillRect(0, laneY - laneHeight / 2, this.width, laneHeight);
    }

    // Spawn zone (right side - where enemies enter)
    const spawnWidth = 80;
    const spawnX = this.width - spawnWidth;

    // Spawn zone gradient
    const spawnGradient = ctx.createLinearGradient(spawnX, 0, this.width, 0);
    spawnGradient.addColorStop(0, 'transparent');
    spawnGradient.addColorStop(0.3, COLORS.spawnZone);
    spawnGradient.addColorStop(1, COLORS.spawnZone);
    ctx.fillStyle = spawnGradient;
    ctx.fillRect(spawnX, 0, spawnWidth, this.height);

    // Spawn zone border line
    ctx.strokeStyle = COLORS.spawnBorder;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(spawnX + 10, 0);
    ctx.lineTo(spawnX + 10, this.height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Spawn label
    ctx.fillStyle = COLORS.spawnBorder;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(this.width - 20, this.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('SPAWN', 0, 0);
    ctx.restore();

    // Target zone (left side - fortress area)
    const targetWidth = 120;
    const targetGradient = ctx.createLinearGradient(0, 0, targetWidth, 0);
    targetGradient.addColorStop(0, COLORS.targetZone);
    targetGradient.addColorStop(0.7, COLORS.targetZone);
    targetGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = targetGradient;
    ctx.fillRect(0, 0, targetWidth, this.height);

    // Direction arrows (showing enemy movement direction)
    this.drawDirectionArrows();

    ctx.restore();
  }

  /** Draw direction arrows showing enemy movement */
  private drawDirectionArrows(): void {
    const ctx = this.ctx;
    const arrowCount = 5;
    const arrowSpacing = this.width / (arrowCount + 1);

    ctx.fillStyle = COLORS.directionArrow;

    for (let i = 1; i <= arrowCount; i++) {
      const x = this.width - (i * arrowSpacing);
      const y = this.height / 2;
      const size = 12;

      // Draw arrow pointing left (towards fortress)
      ctx.beginPath();
      ctx.moveTo(x + size, y - size / 2);
      ctx.lineTo(x, y);
      ctx.lineTo(x + size, y + size / 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** Draws a rounded rectangle path */
  private roundedRect(x: number, y: number, w: number, h: number, r: number): void {
    const ctx = this.ctx;
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  /** Draws an HP bar at the specified position with improved visuals */
  private drawHpBar(
    x: number,
    y: number,
    width: number,
    height: number,
    current: number,
    max: number,
    isElite = false
  ): void {
    const ctx = this.ctx;
    const barX = x - width / 2;
    const hpPercent = max > 0 ? current / max : 0;
    const radius = SIZES.hpBar.borderRadius;

    // Shadow for better visibility
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;

    // Background with border
    this.roundedRect(barX, y, width, height, radius);
    ctx.fillStyle = COLORS.hpBarBackground;
    ctx.fill();
    ctx.strokeStyle = COLORS.hpBarBorder;
    ctx.lineWidth = SIZES.hpBar.borderWidth;
    ctx.stroke();

    ctx.restore();

    // Elite glow effect
    if (isElite) {
      ctx.save();
      ctx.shadowColor = COLORS.eliteGlow;
      ctx.shadowBlur = 6;
    }

    // HP fill with dynamic color
    if (hpPercent > 0) {
      const fillWidth = Math.max(radius * 2, (width - 2) * hpPercent);
      const fillX = barX + 1;
      const fillY = y + 1;
      const fillH = height - 2;

      ctx.save();
      this.roundedRect(fillX, fillY, fillWidth, fillH, Math.max(0, radius - 1));
      ctx.clip();

      // Use dynamic color based on HP percentage (or elite gold)
      const fillColor = isElite ? COLORS.elite : getHpColor(hpPercent);
      ctx.fillStyle = fillColor;
      ctx.fillRect(fillX, fillY, fillWidth, fillH);

      // Highlight gradient on top
      const gradient = ctx.createLinearGradient(fillX, fillY, fillX, fillY + fillH);
      gradient.addColorStop(0, COLORS.hpBarHighlight);
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
      ctx.fillStyle = gradient;
      ctx.fillRect(fillX, fillY, fillWidth, fillH);

      ctx.restore();
    }

    if (isElite) {
      ctx.restore();
    }
  }

  private drawFortress(state: GameState | null): void {
    const ctx = this.ctx;
    const x = this.toScreenX(FP.fromInt(LAYOUT.fortressPositionX));
    const y = this.height / 2;
    const { width, height } = SIZES.fortress;

    // Default HP values when no state
    const fortressHp = state?.fortressHp ?? 100;
    const fortressMaxHp = state?.fortressMaxHp ?? 100;
    const fortressLevel = state?.commanderLevel ?? 1;
    const fortressClass = state?.fortressClass;

    // Determine visual tier (1-9: Tier 1, 10-24: Tier 2, 25+: Tier 3)
    const tier = fortressLevel >= 25 ? 3 : fortressLevel >= 10 ? 2 : 1;

    // Get class color for Tier 3
    const classColor = fortressClass ? (TURRET_CLASS_COLORS[fortressClass] || COLORS.fortress) : COLORS.fortress;

    ctx.save();

    // Draw fortress based on tier
    switch (tier) {
      case 1:
        this.drawFortressTier1(ctx, x, y, width, height);
        break;
      case 2:
        this.drawFortressTier2(ctx, x, y, width, height);
        break;
      case 3:
        this.drawFortressTier3(ctx, x, y, width, height, classColor);
        break;
    }

    ctx.restore();

    // HP bar
    const barWidth = width + LAYOUT.fortressHpBarOffset;
    const barY = y - height / 2 - LAYOUT.fortressHpBarOffset;
    this.drawHpBar(x, barY, barWidth, SIZES.hpBar.height, fortressHp, fortressMaxHp);

    // HP text
    ctx.fillStyle = COLORS.text;
    ctx.font = FONTS.hpText;
    ctx.textAlign = 'center';
    ctx.fillText(`${fortressHp}/${fortressMaxHp}`, x, barY - 5);
  }

  /** Draw Tier 1 Fortress: Basic Outpost */
  private drawFortressTier1(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
    // Simple rectangular fortress
    ctx.fillStyle = COLORS.fortress;
    ctx.fillRect(x - width / 2, y - height / 2, width, height);

    // Add a simple border
    ctx.strokeStyle = '#00a8cc';
    ctx.lineWidth = 3;
    ctx.strokeRect(x - width / 2, y - height / 2, width, height);
  }

  /** Draw Tier 2 Fortress: Stone Keep with battlements */
  private drawFortressTier2(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
    // Main body - darker, stronger look
    ctx.fillStyle = '#0099bb';
    ctx.fillRect(x - width / 2, y - height / 2, width, height);

    // Stone texture (simple lines)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const lineY = y - height / 2 + (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(x - width / 2, lineY);
      ctx.lineTo(x + width / 2, lineY);
      ctx.stroke();
    }

    // Battlements on top
    const battlement = {
      width: 12,
      height: 15,
      gap: 5,
    };
    const topY = y - height / 2;
    ctx.fillStyle = '#007799';

    let battX = x - width / 2;
    while (battX < x + width / 2) {
      ctx.fillRect(battX, topY - battlement.height, battlement.width, battlement.height);
      battX += battlement.width + battlement.gap;
    }

    // Corner towers
    const towerWidth = 20;
    const towerHeight = 30;
    ctx.fillStyle = '#005577';
    // Left tower
    ctx.fillRect(x - width / 2 - 5, y - height / 2 - 10, towerWidth, towerHeight);
    // Right tower
    ctx.fillRect(x + width / 2 - towerWidth + 5, y - height / 2 - 10, towerWidth, towerHeight);

    // Border
    ctx.strokeStyle = '#003344';
    ctx.lineWidth = 4;
    ctx.strokeRect(x - width / 2, y - height / 2, width, height);
  }

  /** Draw Tier 3 Fortress: Class Citadel with elemental theming */
  private drawFortressTier3(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    classColor: string
  ): void {
    // Glow effect
    ctx.shadowColor = classColor;
    ctx.shadowBlur = 25;

    // Main body with class color
    ctx.fillStyle = classColor;
    ctx.fillRect(x - width / 2, y - height / 2, width, height);

    // Reset shadow for details
    ctx.shadowBlur = 0;

    // Energy core in center
    const coreRadius = 15;
    ctx.save();
    ctx.shadowColor = classColor;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(x, y, coreRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    // Class-themed spires
    const spireWidth = 15;
    const spireHeight = 40;
    const darkerColor = this.darkenColor(classColor, 0.7);
    ctx.fillStyle = darkerColor;

    // Left spire
    ctx.beginPath();
    ctx.moveTo(x - width / 2 - 5, y - height / 2);
    ctx.lineTo(x - width / 2 - 5 - spireWidth / 2, y - height / 2);
    ctx.lineTo(x - width / 2 - 5 - spireWidth / 4, y - height / 2 - spireHeight);
    ctx.lineTo(x - width / 2 - 5 + spireWidth / 4, y - height / 2 - spireHeight);
    ctx.lineTo(x - width / 2 - 5 + spireWidth / 2, y - height / 2);
    ctx.closePath();
    ctx.fill();

    // Right spire
    ctx.beginPath();
    ctx.moveTo(x + width / 2 + 5, y - height / 2);
    ctx.lineTo(x + width / 2 + 5 - spireWidth / 2, y - height / 2);
    ctx.lineTo(x + width / 2 + 5 - spireWidth / 4, y - height / 2 - spireHeight);
    ctx.lineTo(x + width / 2 + 5 + spireWidth / 4, y - height / 2 - spireHeight);
    ctx.lineTo(x + width / 2 + 5 + spireWidth / 2, y - height / 2);
    ctx.closePath();
    ctx.fill();

    // Ornate border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(x - width / 2 + 2, y - height / 2 + 2, width - 4, height - 4);
  }

  /** Helper to darken a color */
  private darkenColor(color: string, factor: number): string {
    // Simple hex color darkening
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgb(${Math.floor(r * factor)}, ${Math.floor(g * factor)}, ${Math.floor(b * factor)})`;
    }
    return color;
  }

  /** Draw a filled circle, optionally with stroke for elites */
  private drawCircle(x: number, y: number, radius: number, stroke: boolean): void {
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();
    if (stroke) this.ctx.stroke();
  }

  /** Draw a filled square, optionally with stroke for elites */
  private drawSquare(x: number, y: number, halfSize: number, stroke: boolean): void {
    this.ctx.fillRect(x - halfSize, y - halfSize, halfSize * 2, halfSize * 2);
    if (stroke) this.ctx.strokeRect(x - halfSize, y - halfSize, halfSize * 2, halfSize * 2);
  }

  /** Draw a filled diamond, optionally with stroke for elites */
  private drawDiamond(x: number, y: number, size: number, stroke: boolean): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x, y - size);
    this.ctx.lineTo(x + size, y);
    this.ctx.lineTo(x, y + size);
    this.ctx.lineTo(x - size, y);
    this.ctx.closePath();
    this.ctx.fill();
    if (stroke) this.ctx.stroke();
  }

  private drawEnemy(enemy: Enemy): void {
    const ctx = this.ctx;

    // Save context state to prevent leaking between enemies
    ctx.save();

    // Calculate screen position with vertical lane spread
    const x = this.toScreenX(enemy.x);
    const y = this.calculateLaneY(enemy.id);

    // Size based on type
    let size = ENEMY_SIZES[enemy.type] ?? ENEMY_SIZES.runner;

    // Elite size bonus
    if (enemy.isElite) size *= SIZES.eliteMultiplier;

    // Color based on type with hit flash override
    let color = ENEMY_COLORS[enemy.type] ?? ENEMY_COLORS.runner;
    if (enemy.hitFlashTicks > 0) {
      color = COLORS.hitFlash;
    }

    // Elite stroke styling
    if (enemy.isElite) {
      ctx.strokeStyle = COLORS.elite;
      ctx.lineWidth = 3;
    }

    ctx.fillStyle = color;

    // Draw shape based on type with fallback
    switch (enemy.type) {
      case 'runner':
        this.drawCircle(x, y, size, enemy.isElite);
        break;
      case 'bruiser':
        this.drawSquare(x, y, size, enemy.isElite);
        break;
      case 'leech':
        this.drawDiamond(x, y, size, enemy.isElite);
        break;
      default:
        // Fallback for unknown types: draw as circle
        this.drawCircle(x, y, size, enemy.isElite);
    }

    // Restore before HP bar to ensure clean state
    ctx.restore();

    // HP bar for damaged enemies
    const hpPercent = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 0;
    if (hpPercent < 1) {
      const barWidth = size * 2.2;
      const barY = y - size - LAYOUT.enemyHpBarOffset;
      this.drawHpBar(x, barY, barWidth, SIZES.hpBar.enemyHeight, enemy.hp, enemy.maxHp, enemy.isElite);
    }
  }

  /** Draw a hero unit */
  private drawHero(hero: ActiveHero): void {
    const ctx = this.ctx;
    ctx.save();

    // Calculate screen position
    const x = this.toScreenX(hero.x);
    const y = this.toScreenY(hero.y);
    const radius = SIZES.hero.radius;

    // Get color based on hero ID and state
    let fillColor = HERO_COLORS[hero.definitionId] || COLORS.heroIdle;
    let glowColor = fillColor;

    // State-based styling
    switch (hero.state) {
      case 'combat':
        glowColor = COLORS.heroCombat;
        break;
      case 'commanded':
        glowColor = COLORS.heroCommanded || fillColor;
        break;
    }

    // Glow effect for active heroes
    if (hero.state !== 'idle') {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 15;
    }

    // Draw hero body
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Outline
    ctx.strokeStyle = COLORS.heroOutline;
    ctx.lineWidth = SIZES.hero.outlineWidth;
    ctx.stroke();

    ctx.restore();

    // HP bar
    const hpPercent = hero.maxHp > 0 ? hero.currentHp / hero.maxHp : 0;
    if (hpPercent < 1) {
      const barWidth = radius * 2.5;
      const barY = y - radius - LAYOUT.enemyHpBarOffset;
      this.drawHpBar(x, barY, barWidth, SIZES.hpBar.enemyHeight, hero.currentHp, hero.maxHp);
    }

    // Tier badge
    ctx.save();
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`T${hero.tier}`, x, y + 4);
    ctx.restore();
  }

  /** Draw a turret slot (empty or with turret) */
  private drawTurretSlot(slot: TurretSlot, turret: ActiveTurret | undefined): void {
    const ctx = this.ctx;
    ctx.save();

    const x = this.toScreenX(slot.x);
    const y = this.toScreenY(slot.y);
    const baseRadius = SIZES.turret.baseRadius;

    // Draw slot indicator (dashed circle for empty)
    if (!turret) {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Slot number
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`#${slot.index + 1}`, x, y + 4);
    } else {
      // Draw turret
      const classColor = TURRET_CLASS_COLORS[turret.currentClass] || COLORS.turretBase;

      // Base
      ctx.beginPath();
      ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.turretBase;
      ctx.fill();
      ctx.strokeStyle = classColor;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Barrel (pointing right towards enemies)
      ctx.fillStyle = classColor;
      ctx.fillRect(
        x,
        y - SIZES.turret.barrelWidth / 2,
        SIZES.turret.barrelLength,
        SIZES.turret.barrelWidth
      );

      // Tier indicator
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`T${turret.tier}`, x, y + 4);
    }

    ctx.restore();
  }

  /** Draw a projectile */
  private drawProjectile(projectile: ActiveProjectile): void {
    const ctx = this.ctx;
    ctx.save();

    const x = this.toScreenX(projectile.x);
    const y = this.toScreenY(projectile.y);
    const radius = SIZES.projectile.radius;

    // Glow effect
    ctx.shadowColor = COLORS.projectileGlow;
    ctx.shadowBlur = 8;

    // Projectile body
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.projectile;
    ctx.fill();

    ctx.restore();
  }

  /** Convert FP Y coordinate to screen Y */
  private toScreenY(fpY: number): number {
    const unitY = FP.toFloat(fpY);
    // Field height is typically 15 units, map to screen height
    return (unitY / 15) * this.height;
  }
}
