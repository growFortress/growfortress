import type { GameState, Enemy, ActiveHero, ActiveTurret, TurretSlot, ActiveProjectile } from '@arcade/sim-core';
import { FP, getTurretById } from '@arcade/sim-core';

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
  void: '#4b0082',
  plasma: '#ff00aa',
};

// Secondary/glow colors for Tesla Tower
const CLASS_SECONDARY_COLORS: Record<string, string> = {
  natural: '#8fbc8f',
  ice: '#e0ffff',
  fire: '#ff8c00',
  lightning: '#ffff00',
  tech: '#ff00aa',
  void: '#9400d3',
  plasma: '#00ffff',
};

/** Turret type specific colors */
const TURRET_TYPE_COLORS: Record<string, { primary: string; secondary: string; glow: string }> = {
  railgun: { primary: '#4A5568', secondary: '#718096', glow: '#00BFFF' },
  cryo: { primary: '#00CED1', secondary: '#87CEEB', glow: '#ADD8E6' },
  artillery: { primary: '#8B4513', secondary: '#A0522D', glow: '#FF6600' },
  arc: { primary: '#4B0082', secondary: '#9932CC', glow: '#00FFFF' },
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
    const fortressClass = state?.fortressClass ?? 'natural';

    // Determine visual tier (1-9: Tier 1, 10-24: Tier 2, 25+: Tier 3)
    const tier = fortressLevel >= 25 ? 3 : fortressLevel >= 10 ? 2 : 1;

    // Get class colors
    const primaryColor = TURRET_CLASS_COLORS[fortressClass] || COLORS.fortress;
    const secondaryColor = CLASS_SECONDARY_COLORS[fortressClass] || '#ffffff';

    ctx.save();

    // Draw Tesla Tower fortress
    this.drawTeslaTower(ctx, x, y, width, height, primaryColor, secondaryColor, tier);

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

  /** Draw Tesla Tower style fortress */
  private drawTeslaTower(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    primaryColor: string,
    secondaryColor: string,
    tier: number
  ): void {
    const darkerPrimary = this.darkenColor(primaryColor, 0.6);
    const metalColor = '#2a3a4a';
    const metalHighlight = '#4a5a6a';

    // Glow intensity based on tier
    const glowIntensity = 10 + tier * 8;

    // ============================================
    // 1. PLATFORM / FOUNDATION
    // ============================================
    const platformY = y + height * 0.4;
    const platformWidth = width * 0.9;
    const platformHeight = height * 0.08;

    // Platform shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(x - platformWidth / 2 + 3, platformY + 3, platformWidth, platformHeight);

    // Platform body
    ctx.fillStyle = metalColor;
    ctx.fillRect(x - platformWidth / 2, platformY, platformWidth, platformHeight);

    // Platform highlight
    ctx.fillStyle = metalHighlight;
    ctx.fillRect(x - platformWidth / 2, platformY, platformWidth, platformHeight * 0.3);

    // Platform border
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - platformWidth / 2, platformY, platformWidth, platformHeight);

    // ============================================
    // 2. BASE (Trapezoid)
    // ============================================
    const baseTopY = platformY;
    const baseBottomWidth = width * 0.5;
    const baseTopWidth = width * 0.25;
    const baseHeight = height * 0.25;
    const baseTopY2 = baseTopY - baseHeight;

    // Base shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.moveTo(x - baseBottomWidth / 2 + 3, baseTopY + 3);
    ctx.lineTo(x + baseBottomWidth / 2 + 3, baseTopY + 3);
    ctx.lineTo(x + baseTopWidth / 2 + 3, baseTopY2 + 3);
    ctx.lineTo(x - baseTopWidth / 2 + 3, baseTopY2 + 3);
    ctx.closePath();
    ctx.fill();

    // Base body
    ctx.fillStyle = metalColor;
    ctx.beginPath();
    ctx.moveTo(x - baseBottomWidth / 2, baseTopY);
    ctx.lineTo(x + baseBottomWidth / 2, baseTopY);
    ctx.lineTo(x + baseTopWidth / 2, baseTopY2);
    ctx.lineTo(x - baseTopWidth / 2, baseTopY2);
    ctx.closePath();
    ctx.fill();

    // Base highlight (left edge)
    ctx.fillStyle = metalHighlight;
    ctx.beginPath();
    ctx.moveTo(x - baseBottomWidth / 2, baseTopY);
    ctx.lineTo(x - baseBottomWidth / 2 + 8, baseTopY);
    ctx.lineTo(x - baseTopWidth / 2 + 5, baseTopY2);
    ctx.lineTo(x - baseTopWidth / 2, baseTopY2);
    ctx.closePath();
    ctx.fill();

    // Base border
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - baseBottomWidth / 2, baseTopY);
    ctx.lineTo(x + baseBottomWidth / 2, baseTopY);
    ctx.lineTo(x + baseTopWidth / 2, baseTopY2);
    ctx.lineTo(x - baseTopWidth / 2, baseTopY2);
    ctx.closePath();
    ctx.stroke();

    // ============================================
    // 3. COLUMN WITH COIL RINGS
    // ============================================
    const columnWidth = width * 0.12;
    const columnTop = y - height * 0.35;
    const columnBottom = baseTopY2;
    const columnHeight = columnBottom - columnTop;

    // Column body
    ctx.fillStyle = metalColor;
    ctx.fillRect(x - columnWidth / 2, columnTop, columnWidth, columnHeight);

    // Column highlight
    ctx.fillStyle = metalHighlight;
    ctx.fillRect(x - columnWidth / 2, columnTop, columnWidth * 0.3, columnHeight);

    // Column border
    ctx.strokeStyle = darkerPrimary;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - columnWidth / 2, columnTop, columnWidth, columnHeight);

    // Coil rings (number based on tier)
    const ringCount = tier + 1; // 2, 3, or 4 rings
    const ringSpacing = columnHeight / (ringCount + 1);
    const ringWidth = columnWidth * 2.2;
    const ringHeight = 6;

    for (let i = 1; i <= ringCount; i++) {
      const ringY = columnTop + ringSpacing * i;

      // Ring glow
      ctx.save();
      ctx.shadowColor = primaryColor;
      ctx.shadowBlur = glowIntensity;

      // Ring body
      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.ellipse(x, ringY, ringWidth / 2, ringHeight / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ring highlight
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.ellipse(x, ringY - 1, ringWidth / 2 - 2, ringHeight / 2 - 1, 0, 0, Math.PI);
      ctx.fill();

      ctx.restore();
    }

    // ============================================
    // 4. TOROID / ENERGY SPHERE
    // ============================================
    const toroidY = columnTop - height * 0.08;
    const toroidWidth = width * 0.45;
    const toroidHeight = height * 0.18;

    // Outer glow
    ctx.save();
    ctx.shadowColor = primaryColor;
    ctx.shadowBlur = glowIntensity * 1.5;

    // Toroid outer ring
    ctx.fillStyle = darkerPrimary;
    ctx.beginPath();
    ctx.ellipse(x, toroidY, toroidWidth / 2, toroidHeight / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Toroid inner (hole)
    ctx.fillStyle = metalColor;
    ctx.beginPath();
    ctx.ellipse(x, toroidY, toroidWidth / 4, toroidHeight / 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Energy core in center
    ctx.shadowBlur = glowIntensity * 2;
    ctx.fillStyle = secondaryColor;
    ctx.beginPath();
    ctx.arc(x, toroidY, toroidWidth * 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Core white center
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, toroidY, toroidWidth * 0.08, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Toroid highlight arc
    ctx.strokeStyle = secondaryColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, toroidY - 2, toroidWidth / 2 - 3, toroidHeight / 2 - 2, 0, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();

    // ============================================
    // 5. TOP ELECTRODE
    // ============================================
    const electrodeHeight = height * 0.08;
    const electrodeWidth = width * 0.04;
    const electrodeTop = toroidY - toroidHeight / 2 - electrodeHeight;

    // Electrode body
    ctx.fillStyle = metalHighlight;
    ctx.fillRect(x - electrodeWidth / 2, electrodeTop, electrodeWidth, electrodeHeight);

    // Electrode tip (glowing)
    ctx.save();
    ctx.shadowColor = primaryColor;
    ctx.shadowBlur = glowIntensity;
    ctx.fillStyle = primaryColor;
    ctx.beginPath();
    ctx.arc(x, electrodeTop, electrodeWidth, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ============================================
    // 6. TIER 3 EXTRA: Energy arcs
    // ============================================
    if (tier >= 3) {
      ctx.save();
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 2;
      ctx.shadowColor = secondaryColor;
      ctx.shadowBlur = 15;

      // Left arc
      ctx.beginPath();
      ctx.moveTo(x - toroidWidth / 2, toroidY);
      ctx.quadraticCurveTo(x - toroidWidth * 0.7, toroidY - 15, x - toroidWidth * 0.4, toroidY - 25);
      ctx.stroke();

      // Right arc
      ctx.beginPath();
      ctx.moveTo(x + toroidWidth / 2, toroidY);
      ctx.quadraticCurveTo(x + toroidWidth * 0.7, toroidY - 15, x + toroidWidth * 0.4, toroidY - 25);
      ctx.stroke();

      ctx.restore();
    }

    // ============================================
    // 7. TIER 2+ EXTRA: Side panels
    // ============================================
    if (tier >= 2) {
      const panelWidth = width * 0.12;
      const panelHeight = height * 0.15;
      const panelY = baseTopY2 + (baseHeight - panelHeight) / 2;

      // Left panel
      ctx.fillStyle = darkerPrimary;
      ctx.fillRect(x - baseBottomWidth / 2 - panelWidth - 5, panelY, panelWidth, panelHeight);
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(x - baseBottomWidth / 2 - panelWidth - 5, panelY, panelWidth, panelHeight);

      // Right panel
      ctx.fillRect(x + baseBottomWidth / 2 + 5, panelY, panelWidth, panelHeight);
      ctx.strokeRect(x + baseBottomWidth / 2 + 5, panelY, panelWidth, panelHeight);

      // Panel lights
      ctx.save();
      ctx.shadowColor = primaryColor;
      ctx.shadowBlur = 8;
      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.arc(x - baseBottomWidth / 2 - panelWidth / 2 - 5, panelY + panelHeight / 2, 3, 0, Math.PI * 2);
      ctx.arc(x + baseBottomWidth / 2 + panelWidth / 2 + 5, panelY + panelHeight / 2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
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
      // Draw turret based on type
      const turretDef = getTurretById(turret.definitionId);
      const turretType = turretDef?.id || 'railgun';

      switch (turretType) {
        case 'railgun':
          this.drawRailgunTurret(x, y, turret.tier);
          break;
        case 'cryo':
          this.drawCryoTurret(x, y, turret.tier);
          break;
        case 'artillery':
          this.drawArtilleryTurret(x, y, turret.tier);
          break;
        case 'arc':
          this.drawArcTurret(x, y, turret.tier);
          break;
        default:
          this.drawRailgunTurret(x, y, turret.tier);
      }
    }

    ctx.restore();
  }

  /** Draw Railgun turret - sleek sci-fi design with long electromagnetic barrel */
  private drawRailgunTurret(x: number, y: number, tier: number): void {
    const ctx = this.ctx;
    const colors = TURRET_TYPE_COLORS.railgun;
    const baseRadius = 16;

    // Platform base (darker)
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.ellipse(x, y + 8, baseRadius + 4, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Main body - angular sci-fi shape
    ctx.fillStyle = colors.primary;
    ctx.beginPath();
    ctx.moveTo(x - baseRadius, y + 4);
    ctx.lineTo(x - baseRadius + 4, y - 10);
    ctx.lineTo(x + baseRadius - 4, y - 10);
    ctx.lineTo(x + baseRadius, y + 4);
    ctx.closePath();
    ctx.fill();

    // Body highlight
    ctx.fillStyle = colors.secondary;
    ctx.beginPath();
    ctx.moveTo(x - baseRadius + 2, y + 2);
    ctx.lineTo(x - baseRadius + 6, y - 8);
    ctx.lineTo(x, y - 8);
    ctx.lineTo(x - 2, y + 2);
    ctx.closePath();
    ctx.fill();

    // Long railgun barrel
    const barrelLength = 28 + tier * 3;
    const barrelWidth = 6;

    // Barrel rails (two parallel rails)
    ctx.fillStyle = colors.secondary;
    ctx.fillRect(x + 4, y - barrelWidth - 1, barrelLength, 3);
    ctx.fillRect(x + 4, y + barrelWidth - 2, barrelLength, 3);

    // Center barrel
    ctx.fillStyle = colors.primary;
    ctx.fillRect(x + 4, y - barrelWidth / 2, barrelLength - 4, barrelWidth);

    // Energy glow between rails
    ctx.save();
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = 8 + tier * 2;
    ctx.fillStyle = colors.glow;
    ctx.fillRect(x + 8, y - 1, barrelLength - 10, 2);
    ctx.restore();

    // Barrel tip glow
    ctx.save();
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = 12;
    ctx.fillStyle = colors.glow;
    ctx.beginPath();
    ctx.arc(x + barrelLength + 2, y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Tech details - capacitors on sides
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x - 12, y - 6, 6, 8);
    ctx.fillRect(x + 6, y - 6, 6, 8);

    // Capacitor glow indicators
    ctx.save();
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = 6;
    ctx.fillStyle = colors.glow;
    ctx.fillRect(x - 11, y - 4, 4, 2);
    ctx.fillRect(x + 7, y - 4, 4, 2);
    ctx.restore();

    // Tier indicator
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`T${tier}`, x, y + 14);
  }

  /** Draw Cryo turret - ice crystal tower with freezing effect */
  private drawCryoTurret(x: number, y: number, tier: number): void {
    const ctx = this.ctx;
    const colors = TURRET_TYPE_COLORS.cryo;

    // Ice platform
    ctx.fillStyle = '#1a3a4a';
    ctx.beginPath();
    ctx.ellipse(x, y + 10, 18, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Frost effect on platform
    ctx.save();
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = colors.glow;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y + 10, 16, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Main cryo chamber - cylindrical shape
    const gradient = ctx.createLinearGradient(x - 12, y, x + 12, y);
    gradient.addColorStop(0, colors.secondary);
    gradient.addColorStop(0.5, colors.primary);
    gradient.addColorStop(1, colors.secondary);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(x - 12, y + 8);
    ctx.lineTo(x - 10, y - 12);
    ctx.lineTo(x + 10, y - 12);
    ctx.lineTo(x + 12, y + 8);
    ctx.closePath();
    ctx.fill();

    // Ice crystal emitter on top
    ctx.save();
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = 15;

    // Central crystal
    ctx.fillStyle = colors.glow;
    ctx.beginPath();
    ctx.moveTo(x, y - 22 - tier * 2);
    ctx.lineTo(x - 5, y - 12);
    ctx.lineTo(x + 5, y - 12);
    ctx.closePath();
    ctx.fill();

    // Side crystals
    ctx.fillStyle = colors.secondary;
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 16 - tier);
    ctx.lineTo(x - 12, y - 8);
    ctx.lineTo(x - 4, y - 8);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x + 8, y - 16 - tier);
    ctx.lineTo(x + 4, y - 8);
    ctx.lineTo(x + 12, y - 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Cryo barrel/emitter pointing right
    ctx.fillStyle = colors.primary;
    ctx.fillRect(x + 8, y - 4, 16, 8);

    // Emitter nozzle
    ctx.fillStyle = colors.secondary;
    ctx.beginPath();
    ctx.moveTo(x + 24, y - 6);
    ctx.lineTo(x + 30, y - 8);
    ctx.lineTo(x + 30, y + 8);
    ctx.lineTo(x + 24, y + 6);
    ctx.closePath();
    ctx.fill();

    // Frost particles effect
    ctx.save();
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = 8;
    ctx.fillStyle = 'rgba(173, 216, 230, 0.6)';
    for (let i = 0; i < tier + 2; i++) {
      const px = x + 28 + i * 4;
      const py = y + (Math.sin(i * 1.5) * 4);
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Tier indicator
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`T${tier}`, x, y + 18);
  }

  /** Draw Artillery turret - heavy cannon with thick barrel */
  private drawArtilleryTurret(x: number, y: number, tier: number): void {
    const ctx = this.ctx;
    const colors = TURRET_TYPE_COLORS.artillery;

    // Heavy base platform
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(x, y + 10, 20, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Armored base ring
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y + 10, 18, 6, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Main turret body - hexagonal armored shape
    ctx.fillStyle = colors.primary;
    ctx.beginPath();
    ctx.moveTo(x - 14, y + 6);
    ctx.lineTo(x - 16, y - 4);
    ctx.lineTo(x - 10, y - 12);
    ctx.lineTo(x + 10, y - 12);
    ctx.lineTo(x + 16, y - 4);
    ctx.lineTo(x + 14, y + 6);
    ctx.closePath();
    ctx.fill();

    // Armor plating highlight
    ctx.fillStyle = colors.secondary;
    ctx.beginPath();
    ctx.moveTo(x - 12, y + 4);
    ctx.lineTo(x - 14, y - 2);
    ctx.lineTo(x - 8, y - 10);
    ctx.lineTo(x, y - 10);
    ctx.lineTo(x - 2, y + 4);
    ctx.closePath();
    ctx.fill();

    // Heavy cannon barrel
    const barrelLength = 22 + tier * 2;
    const barrelWidth = 12;

    // Barrel base (thicker part)
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(x + 6, y - barrelWidth / 2 - 2, 10, barrelWidth + 4);

    // Main barrel
    ctx.fillStyle = colors.primary;
    ctx.fillRect(x + 8, y - barrelWidth / 2, barrelLength, barrelWidth);

    // Barrel rifling lines
    ctx.strokeStyle = colors.secondary;
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const lineX = x + 14 + i * 6;
      ctx.beginPath();
      ctx.moveTo(lineX, y - barrelWidth / 2 + 1);
      ctx.lineTo(lineX, y + barrelWidth / 2 - 1);
      ctx.stroke();
    }

    // Muzzle brake
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x + barrelLength + 4, y - barrelWidth / 2 - 2, 6, barrelWidth + 4);

    // Muzzle vents
    ctx.fillStyle = colors.glow;
    ctx.save();
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = 6;
    ctx.fillRect(x + barrelLength + 5, y - 6, 4, 2);
    ctx.fillRect(x + barrelLength + 5, y + 4, 4, 2);
    ctx.restore();

    // Ammo indicators on side
    ctx.fillStyle = '#ffa500';
    for (let i = 0; i < tier; i++) {
      ctx.beginPath();
      ctx.arc(x - 10 + i * 6, y - 6, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tier indicator
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`T${tier}`, x, y + 18);
  }

  /** Draw Arc turret - tesla coil style with electrical arcs */
  private drawArcTurret(x: number, y: number, tier: number): void {
    const ctx = this.ctx;
    const colors = TURRET_TYPE_COLORS.arc;

    // Base platform with energy ring
    ctx.fillStyle = '#1a1a2a';
    ctx.beginPath();
    ctx.ellipse(x, y + 10, 18, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Energy ring glow
    ctx.save();
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = colors.glow;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y + 10, 16, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Tesla coil column
    ctx.fillStyle = colors.primary;
    ctx.fillRect(x - 6, y - 16, 12, 24);

    // Column highlight
    ctx.fillStyle = colors.secondary;
    ctx.fillRect(x - 6, y - 16, 4, 24);

    // Coil rings (number based on tier)
    const ringCount = tier + 1;
    const ringSpacing = 20 / (ringCount + 1);

    ctx.save();
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = 12;

    for (let i = 1; i <= ringCount; i++) {
      const ringY = y + 6 - ringSpacing * i;

      // Ring body
      ctx.fillStyle = colors.glow;
      ctx.beginPath();
      ctx.ellipse(x, ringY, 10, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Top electrode sphere
    ctx.save();
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = 20;

    // Outer sphere
    ctx.fillStyle = colors.primary;
    ctx.beginPath();
    ctx.arc(x, y - 20, 10, 0, Math.PI * 2);
    ctx.fill();

    // Inner energy core
    ctx.fillStyle = colors.glow;
    ctx.beginPath();
    ctx.arc(x, y - 20, 6, 0, Math.PI * 2);
    ctx.fill();

    // Bright center
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y - 20, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Arc emitter pointing right
    ctx.fillStyle = colors.primary;
    ctx.fillRect(x + 8, y - 3, 14, 6);

    // Emitter tip with glow
    ctx.save();
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = 12;
    ctx.fillStyle = colors.glow;
    ctx.beginPath();
    ctx.arc(x + 24, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Electric arc effect (decorative)
    ctx.save();
    ctx.strokeStyle = colors.glow;
    ctx.lineWidth = 2;
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = 8;

    // Arc from top sphere
    ctx.beginPath();
    ctx.moveTo(x + 6, y - 16);
    ctx.quadraticCurveTo(x + 14, y - 12, x + 20, y - 4);
    ctx.stroke();

    if (tier >= 2) {
      ctx.beginPath();
      ctx.moveTo(x - 6, y - 16);
      ctx.quadraticCurveTo(x - 10, y - 8, x - 8, y);
      ctx.stroke();
    }
    ctx.restore();

    // Tier indicator
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`T${tier}`, x, y + 18);
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
