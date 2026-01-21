import type { VFXSystem } from './VFXSystem.js';

export type HeroColors = { primary: number; secondary: number; accent: number };

export const DEFAULT_HERO_COLORS: HeroColors = {
  primary: 0x888888,
  secondary: 0xaaaaaa,
  accent: 0xffffff,
};

// Unit-specific colors (configuration-based)
export const HERO_COLORS: Record<string, HeroColors> = {
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

export const getHeroColors = (heroId: string): HeroColors =>
  HERO_COLORS[heroId] ?? DEFAULT_HERO_COLORS;

export type HeroShapeType =
  | 'hexagon'
  | 'flame'
  | 'diamond'
  | 'octagonGear'
  | 'lightning'
  | 'frost'
  | 'voidPortal'
  | 'phantom'
  | 'voidStar'
  | 'circle';

const HERO_SHAPES: Record<string, HeroShapeType> = {
  // Tank classes - Hexagonal shield shape
  vanguard: 'hexagon',
  shield_captain: 'hexagon',
  glacier: 'hexagon',
  // Void Tank - Portal shape with void effect
  titan: 'voidPortal',
  jade_titan: 'voidPortal',
  // Fire classes - Star/Flame shape
  inferno: 'flame',
  // Mage classes - Diamond/Crystal shape
  rift: 'diamond',
  scarlet_mage: 'diamond',
  arcane_sorcerer: 'diamond',
  // Tech classes - Octagonal gear shape
  forge: 'octagonGear',
  iron_sentinel: 'octagonGear',
  // Electric classes - Lightning bolt inner shape
  storm: 'lightning',
  thunderlord: 'lightning',
  // Ice classes - Crystal/Snowflake shape
  frost_unit: 'frost',
  frost_archer: 'frost',
  frost_giant: 'frost',
  // Plasma classes - Phantom/Ghost shape
  spectre: 'phantom',
  // Void Assassin - Void Star shape
  omega: 'voidStar',
};

export const getHeroShapeType = (heroId: string): HeroShapeType =>
  HERO_SHAPES[heroId] ?? 'circle';

type SkillVfxHandler = (context: {
  heroX: number;
  heroY: number;
  targetX: number;
  targetY: number;
  vfx: VFXSystem;
}) => void;

type HeroSkillVfxHandlers = {
  default: SkillVfxHandler;
  skills: Record<string, SkillVfxHandler>;
};

const DEFAULT_SKILL_VFX: SkillVfxHandler = ({ heroX, heroY, vfx }) => {
  vfx.spawnSkillActivation(heroX, heroY, 'natural');
};

const HERO_SKILL_VFX: Record<string, HeroSkillVfxHandlers> = {
  storm: {
    default: ({ heroX, heroY, vfx }) => {
      vfx.spawnClassImpact(heroX, heroY, 'lightning');
    },
    skills: {
      arc_strike: ({ heroX, heroY, vfx }) => {
        vfx.spawnClassImpact(heroX, heroY, 'lightning');
      },
      chain_lightning: ({ heroX, heroY, vfx }) => {
        vfx.spawnClassImpact(heroX, heroY, 'lightning');
      },
      ion_cannon: ({ heroX, heroY, vfx }) => {
        vfx.spawnEmpBlast(heroX, heroY);
      },
    },
  },
  forge: {
    default: ({ targetX, targetY, vfx }) => {
      vfx.spawnClassImpact(targetX, targetY, 'tech');
    },
    skills: {
      laser_burst: ({ heroX, heroY, targetX, targetY, vfx }) => {
        vfx.spawnLaserBeam(heroX, heroY, targetX, targetY);
      },
      missile_barrage: ({ heroX, heroY, targetX, targetY, vfx }) => {
        const missileTargets = [];
        for (let i = 0; i < 5; i++) {
          missileTargets.push({
            x: targetX + (Math.random() - 0.5) * 100,
            y: targetY + (Math.random() - 0.5) * 60,
          });
        }
        vfx.spawnMissileBarrage(heroX, heroY, missileTargets);
      },
      nano_swarm: ({ heroX, heroY, targetX, targetY, vfx }) => {
        vfx.spawnLaserBeam(heroX, heroY, targetX, targetY);
      },
    },
  },
  titan: {
    default: ({ heroX, heroY, vfx }) => {
      vfx.spawnGroundSmash(heroX, heroY, 60);
    },
    skills: {
      smash: ({ heroX, heroY, vfx }) => {
        vfx.spawnGroundSmash(heroX, heroY, 80);
      },
      seismic_stomp: ({ heroX, heroY, vfx }) => {
        vfx.spawnGroundSmash(heroX, heroY, 120);
      },
      kinetic_burst: ({ heroX, heroY, vfx }) => {
        vfx.spawnKineticBurst(heroX, heroY, 100);
      },
    },
  },
  vanguard: {
    default: ({ heroX, heroY, targetX, targetY, vfx }) => {
      const defaultPath = [
        { x: heroX, y: heroY },
        { x: targetX, y: targetY },
      ];
      vfx.spawnShieldThrow(defaultPath);
    },
    skills: {
      barrier_pulse: ({ heroX, heroY, targetX, targetY, vfx }) => {
        const shieldPath = [
          { x: heroX, y: heroY },
          { x: targetX, y: targetY },
          { x: heroX + 50, y: heroY - 50 },
          { x: heroX, y: heroY },
        ];
        vfx.spawnShieldThrow(shieldPath);
      },
      dual_barrier: ({ heroX, heroY, targetX, targetY, vfx }) => {
        const shieldPath = [
          { x: heroX, y: heroY },
          { x: targetX, y: targetY },
          { x: heroX + 50, y: heroY - 50 },
          { x: heroX, y: heroY },
        ];
        vfx.spawnShieldThrow(shieldPath);
      },
      kinetic_hammer: ({ heroX, heroY, targetX, targetY, vfx }) => {
        vfx.spawnHammerThrow(heroX, heroY, targetX, targetY);
      },
    },
  },
  rift: {
    default: ({ heroX, heroY, targetX, targetY, vfx }) => {
      vfx.spawnPlasmaBolt(heroX, heroY, targetX, targetY);
    },
    skills: {
      plasma_bolt: ({ heroX, heroY, targetX, targetY, vfx }) => {
        vfx.spawnPlasmaBolt(heroX, heroY, targetX, targetY);
      },
      plasma_wave: ({ heroX, heroY, vfx }) => {
        vfx.spawnThermalImpact(heroX, heroY, 60);
      },
      plasma_shield: ({ heroX, heroY, vfx }) => {
        vfx.spawnThermalImpact(heroX, heroY, 60);
      },
    },
  },
  frost: {
    default: ({ heroX, heroY, targetX, targetY, vfx }) => {
      vfx.spawnFrostArrow(heroX, heroY, targetX, targetY);
    },
    skills: {
      cryo_shot: ({ heroX, heroY, targetX, targetY, vfx }) => {
        vfx.spawnFrostArrow(heroX, heroY, targetX, targetY);
      },
      multi_shot: ({ heroX, heroY, targetX, targetY, vfx }) => {
        const arrowTargets = [
          { x: targetX - 40, y: targetY - 20 },
          { x: targetX, y: targetY },
          { x: targetX + 40, y: targetY + 20 },
        ];
        vfx.spawnMultiShot(heroX, heroY, arrowTargets);
      },
      shatter_shot: ({ heroX, heroY, targetX, targetY, vfx }) => {
        vfx.spawnFrostArrow(heroX, heroY, targetX, targetY);
      },
    },
  },
};

export const getSkillVfxHandler = (heroId: string, skillId: string): SkillVfxHandler => {
  const heroHandlers = HERO_SKILL_VFX[heroId];
  if (!heroHandlers) {
    return DEFAULT_SKILL_VFX;
  }

  return heroHandlers.skills[skillId] ?? heroHandlers.default;
};
