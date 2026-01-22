import type { JSX } from 'preact';
import { memo } from 'preact/compat';
import type { FortressClass } from '@arcade/sim-core';

// Tank heroes that should be rendered as hexagons
const TANK_HEROES = new Set(['titan', 'jade_titan', 'vanguard', 'shield_captain', 'glacier']);

// Unit colors (configuration-based) - same as in HeroSystem
const HERO_COLORS: Record<string, { primary: string; secondary: string; accent: string }> = {
  // Premium heroes
  inferno: { primary: '#ff4500', secondary: '#ff8c00', accent: '#ffd700' },
  glacier: { primary: '#1e90ff', secondary: '#b0e0e6', accent: '#87ceeb' },
  // New unit IDs
  storm: { primary: '#9932cc', secondary: '#dda0dd', accent: '#ffff00' },
  forge: { primary: '#00f0ff', secondary: '#ff00aa', accent: '#ccff00' },
  titan: { primary: '#4b0082', secondary: '#8b008b', accent: '#9400d3' },  // Void colors
  vanguard: { primary: '#228b22', secondary: '#8fbc8f', accent: '#98fb98' },
  rift: { primary: '#ff4500', secondary: '#ff8c00', accent: '#ffd700' },
  frost: { primary: '#00bfff', secondary: '#e0ffff', accent: '#87ceeb' },
  // Legacy IDs
  thunderlord: { primary: '#9932cc', secondary: '#dda0dd', accent: '#ffff00' },
  iron_sentinel: { primary: '#00f0ff', secondary: '#ff00aa', accent: '#ccff00' },
  jade_titan: { primary: '#4b0082', secondary: '#8b008b', accent: '#9400d3' },  // Void colors
  spider_sentinel: { primary: '#ff0000', secondary: '#0000ff', accent: '#ffffff' },
  shield_captain: { primary: '#228b22', secondary: '#8fbc8f', accent: '#98fb98' },
  scarlet_mage: { primary: '#ff4500', secondary: '#ff8c00', accent: '#ffd700' },
  frost_archer: { primary: '#00bfff', secondary: '#e0ffff', accent: '#87ceeb' },
  flame_phoenix: { primary: '#ff4500', secondary: '#ffd700', accent: '#ff0000' },
  venom_assassin: { primary: '#1a1a1a', secondary: '#8b0000', accent: '#00ff00' },
  arcane_sorcerer: { primary: '#4b0082', secondary: '#ff4500', accent: '#00ff00' },
  frost_giant: { primary: '#00ced1', secondary: '#228b22', accent: '#ffd700' },
  cosmic_guardian: { primary: '#8b4513', secondary: '#ff4500', accent: '#ffd700' },
  // Exclusive heroes
  spectre: { primary: '#00ffff', secondary: '#ff00ff', accent: '#00ffff' },
  omega: { primary: '#ffd700', secondary: '#1a1a2a', accent: '#ffd700' },
  // Starter heroes
  medic: { primary: '#00ff7f', secondary: '#98fb98', accent: '#00ff00' },
  pyro: { primary: '#ff4500', secondary: '#ff6347', accent: '#ffa500' },
  scout: { primary: '#228b22', secondary: '#90ee90', accent: '#32cd32' },
};

interface HeroAvatarProps {
  heroId: string;
  tier: 1 | 2 | 3;
  size?: number;
  class?: FortressClass;
}

// Generate hexagon clip-path points
function getHexagonClipPath(): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 - Math.PI / 2;
    const x = 50 + Math.cos(angle) * 50;
    const y = 50 + Math.sin(angle) * 50;
    points.push(`${x}% ${y}%`);
  }
  return `polygon(${points.join(', ')})`;
}

const HEXAGON_CLIP_PATH = getHexagonClipPath();

function HeroAvatarComponent({ heroId, tier, size = 80 }: HeroAvatarProps) {
  const colors = HERO_COLORS[heroId] || { primary: '#888888', secondary: '#aaaaaa', accent: '#ffffff' };
  const tierMultiplier = { 1: 1.0, 2: 1.15, 3: 1.3 }[tier];
  const actualSize = size * tierMultiplier;
  const glowIntensity = 0.2 + tier * 0.15;
  const isTank = TANK_HEROES.has(heroId);

  const containerStyle: JSX.CSSProperties = {
    position: 'relative',
    width: `${actualSize}px`,
    height: `${actualSize}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const glowStyle: JSX.CSSProperties = {
    position: 'absolute',
    width: `${actualSize * 1.3}px`,
    height: `${actualSize * 1.3}px`,
    borderRadius: isTank ? '0' : '50%',
    clipPath: isTank ? HEXAGON_CLIP_PATH : undefined,
    background: `radial-gradient(circle, ${colors.accent}${Math.round(glowIntensity * 255).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
    animation: 'heroGlow 2s ease-in-out infinite',
  };

  const bodyStyle: JSX.CSSProperties = {
    position: 'absolute',
    width: `${actualSize * 0.9}px`,
    height: `${actualSize * 0.9}px`,
    borderRadius: isTank ? '0' : '50%',
    clipPath: isTank ? HEXAGON_CLIP_PATH : undefined,
    background: `radial-gradient(circle at 30% 30%, ${colors.secondary}, ${colors.primary})`,
    border: isTank ? undefined : `3px solid ${colors.secondary}`,
    boxShadow: `0 0 ${10 + tier * 5}px ${colors.primary}, inset 0 0 20px rgba(0,0,0,0.3)`,
  };

  // For hexagons, we need a separate border element since clip-path clips borders
  const borderStyle: JSX.CSSProperties | null = isTank ? {
    position: 'absolute',
    width: `${actualSize * 0.9}px`,
    height: `${actualSize * 0.9}px`,
    clipPath: HEXAGON_CLIP_PATH,
    background: colors.secondary,
    transform: 'scale(1.08)',
    zIndex: -1,
  } : null;

  const emblemStyle: JSX.CSSProperties = {
    position: 'absolute',
    width: `${actualSize * 0.4}px`,
    height: `${actualSize * 0.4}px`,
    borderRadius: isTank ? '0' : '50%',
    clipPath: isTank ? HEXAGON_CLIP_PATH : undefined,
    background: `radial-gradient(circle, ${colors.accent}, ${colors.accent}aa)`,
    boxShadow: `0 0 10px ${colors.accent}`,
  };

  const particleContainerStyle: JSX.CSSProperties = {
    position: 'absolute',
    width: `${actualSize * 1.5}px`,
    height: `${actualSize * 1.5}px`,
    animation: tier === 3 ? 'heroRotate 4s linear infinite' : 'none',
  };

  return (
    <div style={containerStyle}>
      <style>{`
        @keyframes heroGlow {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes heroRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes heroPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
      `}</style>

      {/* Outer glow */}
      <div style={glowStyle} />

      {/* Hexagon border (for tank heroes) */}
      {borderStyle && <div style={borderStyle} />}

      {/* Tier 3 rotating particles */}
      {tier === 3 && (
        <div style={particleContainerStyle}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: colors.accent,
                boxShadow: `0 0 6px ${colors.accent}`,
                top: '50%',
                left: '50%',
                transform: `rotate(${i * 60}deg) translateX(${actualSize * 0.75}px) translateY(-50%)`,
              }}
            />
          ))}
        </div>
      )}

      {/* Main body */}
      <div style={{...bodyStyle, animation: 'heroPulse 3s ease-in-out infinite'}} />

      {/* Inner emblem */}
      <div style={emblemStyle} />
    </div>
  );
}

// Memoize to prevent unnecessary re-renders when parent updates
export const HeroAvatar = memo(HeroAvatarComponent);
