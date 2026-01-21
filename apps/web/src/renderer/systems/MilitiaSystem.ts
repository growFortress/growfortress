import { Container, Graphics } from 'pixi.js';
import type { GameState, Militia, MilitiaType, MilitiaState } from '@arcade/sim-core';
import { FP } from '@arcade/sim-core';
import { VFXSystem } from './VFXSystem.js';
import { fpXToScreen, fpYToScreen } from '../CoordinateSystem.js';

// --- CONSTANTS (Sci-Fi Drones/Mechs) ---
const MILITIA_COLORS: Record<MilitiaType, { primary: number; secondary: number; weapon: number; glow: number }> = {
  infantry: {
    primary: 0x1a3344,    // Dark teal base
    secondary: 0x00ccff,  // Cyan highlights
    weapon: 0x00ffff,     // Cyan energy blade
    glow: 0x00ccff,
  },
  archer: {
    primary: 0x332211,    // Dark orange/brown base
    secondary: 0xff6600,  // Orange highlights
    weapon: 0xff3300,     // Red laser
    glow: 0xff6600,
  },
  shield_bearer: {
    primary: 0x221133,    // Dark purple base
    secondary: 0x8800ff,  // Purple highlights
    weapon: 0xcc88ff,     // Purple shield
    glow: 0x8800ff,
  },
};

const MILITIA_SIZES: Record<MilitiaType, number> = {
  infantry: 18,      // Combat drone - compact
  archer: 16,        // Sniper drone - sleek
  shield_bearer: 26, // Heavy mech - bulky
};

const SIZES = {
  hpBar: {
    width: 30,
    height: 5,
    offsetY: -25,
  },
};

// --- VISUAL BUNDLE ---
export interface MilitiaVisualBundle {
  container: Container;
  body: Graphics;
  weapon: Graphics;
  hpBar: Graphics;
  stateIndicator: Graphics;
}

// --- MILITIA VISUAL POOL ---
export class MilitiaVisualPool {
  private pool: MilitiaVisualBundle[] = [];
  private activeCount = 0;
  private readonly maxSize: number;

  constructor(maxSize = 50) {
    this.maxSize = maxSize;
  }

  acquire(): MilitiaVisualBundle {
    this.activeCount++;

    const pooled = this.pool.pop();
    if (pooled) {
      pooled.container.visible = true;
      pooled.container.alpha = 1;
      pooled.container.scale.set(1, 1);
      return pooled;
    }

    const container = new Container();

    const body = new Graphics();
    body.label = 'body';
    container.addChild(body);

    const weapon = new Graphics();
    weapon.label = 'weapon';
    container.addChild(weapon);

    const stateIndicator = new Graphics();
    stateIndicator.label = 'stateIndicator';
    container.addChild(stateIndicator);

    const hpBar = new Graphics();
    hpBar.label = 'hpBar';
    container.addChild(hpBar);

    return { container, body, weapon, hpBar, stateIndicator };
  }

  release(bundle: MilitiaVisualBundle): void {
    this.activeCount--;

    if (this.pool.length >= this.maxSize) {
      bundle.container.destroy({ children: true });
      return;
    }

    bundle.body.clear();
    bundle.weapon.clear();
    bundle.hpBar.clear();
    bundle.stateIndicator.clear();
    bundle.container.position.set(0, 0);
    bundle.container.scale.set(1, 1);
    bundle.container.visible = false;

    this.pool.push(bundle);
  }

  prewarm(count: number): void {
    for (let i = 0; i < count && this.pool.length < this.maxSize; i++) {
      const bundle = this.acquire();
      this.release(bundle);
    }
  }

  clear(): void {
    for (const bundle of this.pool) {
      bundle.container.destroy({ children: true });
    }
    this.pool.length = 0;
    this.activeCount = 0;
  }
}

// --- MILITIA SYSTEM ---
export class MilitiaSystem {
  public container: Container;

  private visuals: Map<number, MilitiaVisualBundle> = new Map();
  private visualPool = new MilitiaVisualPool(50);

  // Track state for dirty flag optimization
  private lastHp: Map<number, number> = new Map();
  private visualHp: Map<number, number> = new Map();
  private lastState: Map<number, MilitiaState> = new Map();

  constructor() {
    this.container = new Container();
    this.visualPool.prewarm(15);
  }

  public update(
    state: GameState,
    viewWidth: number,
    viewHeight: number,
    vfx?: VFXSystem,
    alpha: number = 1
  ) {
    const currentIds = new Set<number>();
    const time = performance.now() / 1000;

    // 1. Update / Create Visuals
    for (const militia of state.militia) {
      currentIds.add(militia.id);

      let bundle = this.visuals.get(militia.id);
      if (!bundle) {
        bundle = this.createMilitiaVisual(militia);
        this.container.addChild(bundle.container);
        this.visuals.set(militia.id, bundle);
        this.lastHp.set(militia.id, militia.maxHp);
        this.visualHp.set(militia.id, militia.currentHp);
        this.lastState.set(militia.id, militia.state);
      }

      // Update position
      const interpolated = this.getInterpolatedPosition(militia, alpha);
      const x = fpXToScreen(interpolated.x, viewWidth);
      const y = fpYToScreen(interpolated.y, viewHeight);
      bundle.container.position.set(x, y);

      // Animation based on state
      const baseSize = MILITIA_SIZES[militia.type];
      const breatheSpeed = militia.state === 'attacking' ? 8 : 4;
      const breatheAmount = militia.state === 'attacking' ? 0.1 : 0.05;
      const phase = time * breatheSpeed + militia.id;
      const stretch = Math.sin(phase) * breatheAmount;
      bundle.container.scale.set(1 - stretch, 1 + stretch);

      // Handle damage visual
      const previousHp = this.lastHp.get(militia.id) ?? militia.currentHp;
      if (previousHp > militia.currentHp && vfx) {
        const damage = previousHp - militia.currentHp;
        if (damage >= 1) {
          vfx.spawnDamageNumber(x, y - 15, damage);
        }
      }
      this.lastHp.set(militia.id, militia.currentHp);

      // Smooth HP bar lerp
      let currentVisualHp = this.visualHp.get(militia.id) ?? militia.currentHp;
      if (Math.abs(currentVisualHp - militia.currentHp) > 0.5) {
        currentVisualHp += (militia.currentHp - currentVisualHp) * 0.2;
        this.visualHp.set(militia.id, currentVisualHp);
        this.updateHpBar(bundle.hpBar, currentVisualHp / militia.maxHp);
      }

      // Update state indicator if state changed
      const prevState = this.lastState.get(militia.id);
      if (prevState !== militia.state) {
        this.updateStateIndicator(bundle.stateIndicator, militia.state, baseSize);
        this.lastState.set(militia.id, militia.state);
      }

      // Weapon animation for attacking
      if (militia.state === 'attacking') {
        const attackPhase = (time * 10 + militia.id) % 1;
        bundle.weapon.rotation = Math.sin(attackPhase * Math.PI * 2) * 0.5;
      } else {
        bundle.weapon.rotation = 0;
      }

      // Fade out when about to expire
      const ticksRemaining = militia.expirationTick - state.tick;
      if (ticksRemaining < 60) { // Last 2 seconds
        bundle.container.alpha = Math.max(0.3, ticksRemaining / 60);
      } else {
        bundle.container.alpha = 1;
      }
    }

    // 2. Remove expired militia
    for (const [id, bundle] of this.visuals) {
      if (!currentIds.has(id)) {
        // Spawn death VFX
        if (vfx) {
          const colors = Object.values(MILITIA_COLORS);
          const color = colors[id % colors.length].primary;
          vfx.spawnExplosion(bundle.container.x, bundle.container.y, color);
        }
        this.container.removeChild(bundle.container);
        this.visualPool.release(bundle);
        this.visuals.delete(id);
        this.lastHp.delete(id);
        this.visualHp.delete(id);
        this.lastState.delete(id);
      }
    }
  }

  private createMilitiaVisual(militia: Militia): MilitiaVisualBundle {
    const bundle = this.visualPool.acquire();
    const colors = MILITIA_COLORS[militia.type];
    const size = MILITIA_SIZES[militia.type];

    // Draw body
    const body = bundle.body;
    body.clear();

    // Glow/hover effect
    body.ellipse(0, size / 2, size / 2, size / 5);
    body.fill({ color: colors.glow, alpha: 0.3 });

    if (militia.type === 'infantry') {
      // COMBAT DRONE - Compact hovering drone
      // Main body (hexagonal)
      body.poly([
        0, -size / 2,
        size / 2, -size / 4,
        size / 2, size / 4,
        0, size / 2,
        -size / 2, size / 4,
        -size / 2, -size / 4,
      ]);
      body.fill({ color: colors.primary });
      body.stroke({ width: 2, color: colors.secondary });

      // Central eye/sensor
      body.circle(0, 0, size / 5);
      body.fill({ color: colors.secondary, alpha: 0.8 });
      body.circle(0, 0, size / 8);
      body.fill({ color: 0xffffff });

      // Side thrusters
      body.rect(-size / 2 - 4, -size / 6, 4, size / 3);
      body.fill({ color: colors.secondary, alpha: 0.6 });
      body.rect(size / 2, -size / 6, 4, size / 3);
      body.fill({ color: colors.secondary, alpha: 0.6 });

    } else if (militia.type === 'archer') {
      // SNIPER DRONE - Sleek, angular drone
      // Main body (triangular/stealth shape)
      body.poly([
        size / 2, 0,
        -size / 3, -size / 2,
        -size / 2, 0,
        -size / 3, size / 2,
      ]);
      body.fill({ color: colors.primary });
      body.stroke({ width: 2, color: colors.secondary });

      // Targeting sensor
      body.circle(-size / 6, 0, size / 6);
      body.fill({ color: colors.secondary, alpha: 0.7 });
      body.circle(-size / 6, 0, size / 10);
      body.fill({ color: 0xff0000 }); // Red targeting dot

      // Rear fins
      body.poly([-size / 3, -size / 2, -size / 2, -size / 2 - 4, -size / 2, -size / 3]);
      body.fill({ color: colors.secondary, alpha: 0.5 });
      body.poly([-size / 3, size / 2, -size / 2, size / 2 + 4, -size / 2, size / 3]);
      body.fill({ color: colors.secondary, alpha: 0.5 });

    } else if (militia.type === 'shield_bearer') {
      // HEAVY MECH - Bulky armored robot
      // Main body (boxy)
      body.roundRect(-size / 2, -size / 2, size, size * 0.8, 4);
      body.fill({ color: colors.primary });
      body.stroke({ width: 3, color: colors.secondary });

      // Armored visor
      body.roundRect(-size / 3, -size / 3, size * 0.66, size / 4, 2);
      body.fill({ color: colors.secondary, alpha: 0.7 });

      // Leg segments
      body.roundRect(-size / 3, size / 4, size / 4, size / 3, 2);
      body.fill({ color: colors.primary });
      body.stroke({ width: 1, color: colors.secondary });
      body.roundRect(size / 12, size / 4, size / 4, size / 3, 2);
      body.fill({ color: colors.primary });
      body.stroke({ width: 1, color: colors.secondary });

      // Shoulder armor
      body.roundRect(-size / 2 - 4, -size / 3, 6, size / 3, 2);
      body.fill({ color: colors.secondary, alpha: 0.6 });
      body.roundRect(size / 2 - 2, -size / 3, 6, size / 3, 2);
      body.fill({ color: colors.secondary, alpha: 0.6 });
    }

    // Draw weapon based on type
    const weapon = bundle.weapon;
    weapon.clear();

    if (militia.type === 'infantry') {
      // Energy blade (extending from front)
      weapon.moveTo(size / 2 + 2, 0);
      weapon.lineTo(size / 2 + size / 2, 0);
      weapon.stroke({ width: 4, color: colors.weapon, alpha: 0.9 });
      weapon.moveTo(size / 2 + 2, 0);
      weapon.lineTo(size / 2 + size / 2, 0);
      weapon.stroke({ width: 2, color: 0xffffff, alpha: 0.6 });
    } else if (militia.type === 'archer') {
      // Laser cannon barrel
      weapon.rect(size / 2, -2, size / 3, 4);
      weapon.fill({ color: 0x333333 });
      weapon.stroke({ width: 1, color: colors.secondary });
      // Laser sight line
      weapon.moveTo(size / 2 + size / 3, 0);
      weapon.lineTo(size / 2 + size, 0);
      weapon.stroke({ width: 1, color: colors.weapon, alpha: 0.5 });
    } else if (militia.type === 'shield_bearer') {
      // Energy shield (front arc)
      weapon.arc(-size / 2 - 6, 0, size / 2, -Math.PI / 2, Math.PI / 2, true);
      weapon.stroke({ width: 4, color: colors.weapon, alpha: 0.7 });
      weapon.arc(-size / 2 - 6, 0, size / 2, -Math.PI / 2, Math.PI / 2, true);
      weapon.stroke({ width: 2, color: 0xffffff, alpha: 0.4 });
    }

    // Initialize HP bar
    this.updateHpBar(bundle.hpBar, 1);

    // Initialize state indicator (hidden by default)
    bundle.stateIndicator.clear();

    return bundle;
  }

  private updateHpBar(hpBar: Graphics, hpPercent: number): void {
    hpBar.clear();

    const barWidth = SIZES.hpBar.width;
    const barHeight = SIZES.hpBar.height;
    const offsetY = SIZES.hpBar.offsetY;

    // Background
    hpBar.roundRect(-barWidth / 2, offsetY, barWidth, barHeight, 2);
    hpBar.fill({ color: 0x000000, alpha: 0.6 });

    // HP fill
    const fillWidth = Math.max(0, (barWidth - 2) * hpPercent);
    const hpColor = hpPercent > 0.6 ? 0x00ff00 : hpPercent > 0.3 ? 0xffff00 : 0xff4444;

    if (fillWidth > 0) {
      hpBar.roundRect(-barWidth / 2 + 1, offsetY + 1, fillWidth, barHeight - 2, 1);
      hpBar.fill({ color: hpColor });
    }
  }

  private updateStateIndicator(indicator: Graphics, state: MilitiaState, size: number): void {
    indicator.clear();

    switch (state) {
      case 'attacking':
        // Red attack indicator
        indicator.circle(0, -size - 5, 4);
        indicator.fill({ color: 0xff4444, alpha: 0.8 });
        break;
      case 'moving':
        // Yellow movement indicator
        indicator.poly([0, -size - 8, -4, -size - 2, 4, -size - 2]);
        indicator.fill({ color: 0xffff00, alpha: 0.6 });
        break;
      case 'blocking':
        // Blue blocking indicator
        indicator.rect(-6, -size - 5, 12, 4);
        indicator.fill({ color: 0x4444ff, alpha: 0.7 });
        break;
      default:
        // No indicator for other states
        break;
    }
  }

  public clearAll(): void {
    for (const bundle of this.visuals.values()) {
      this.container.removeChild(bundle.container);
      this.visualPool.release(bundle);
    }
    this.visuals.clear();
    this.lastHp.clear();
    this.visualHp.clear();
    this.lastState.clear();
  }

  private getInterpolatedPosition(militia: Militia, alpha: number): { x: number; y: number } {
    const clampedAlpha = Math.max(0, Math.min(1, alpha));
    if (clampedAlpha >= 1) {
      return { x: militia.x, y: militia.y };
    }
    const backstep = FP.fromFloat(1 - clampedAlpha);
    return {
      x: FP.sub(militia.x, FP.mul(militia.vx, backstep)),
      y: FP.sub(militia.y, FP.mul(militia.vy, backstep)),
    };
  }
}
