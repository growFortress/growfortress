import type { JSX } from 'preact';
import type { FortressClass } from '@arcade/sim-core';

// Hero colors (based on Marvel inspirations) - same as in HeroSystem
const HERO_COLORS: Record<string, { primary: string; secondary: string; accent: string }> = {
  thunderlord: { primary: '#1e90ff', secondary: '#87ceeb', accent: '#ffd700' },
  iron_sentinel: { primary: '#b22222', secondary: '#ffd700', accent: '#00ffff' },
  jade_titan: { primary: '#228b22', secondary: '#32cd32', accent: '#9932cc' },
  spider_sentinel: { primary: '#ff0000', secondary: '#0000ff', accent: '#ffffff' },
  shield_captain: { primary: '#0000cd', secondary: '#ff0000', accent: '#ffffff' },
  scarlet_mage: { primary: '#dc143c', secondary: '#8b0000', accent: '#ff69b4' },
  frost_archer: { primary: '#4b0082', secondary: '#00bfff', accent: '#ffffff' },
  flame_phoenix: { primary: '#ff4500', secondary: '#ffd700', accent: '#ff0000' },
  venom_assassin: { primary: '#1a1a1a', secondary: '#8b0000', accent: '#00ff00' },
  arcane_sorcerer: { primary: '#4b0082', secondary: '#ff4500', accent: '#00ff00' },
  frost_giant: { primary: '#00ced1', secondary: '#228b22', accent: '#ffd700' },
  cosmic_guardian: { primary: '#8b4513', secondary: '#ff4500', accent: '#ffd700' },
};

interface HeroAvatarProps {
  heroId: string;
  tier: 1 | 2 | 3;
  size?: number;
  class?: FortressClass;
}

export function HeroAvatar({ heroId, tier, size = 80 }: HeroAvatarProps) {
  const colors = HERO_COLORS[heroId] || { primary: '#888888', secondary: '#aaaaaa', accent: '#ffffff' };
  const tierMultiplier = { 1: 1.0, 2: 1.15, 3: 1.3 }[tier];
  const actualSize = size * tierMultiplier;
  const glowIntensity = 0.2 + tier * 0.15;

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
    borderRadius: '50%',
    background: `radial-gradient(circle, ${colors.accent}${Math.round(glowIntensity * 255).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
    animation: 'heroGlow 2s ease-in-out infinite',
  };

  const bodyStyle: JSX.CSSProperties = {
    position: 'absolute',
    width: `${actualSize * 0.9}px`,
    height: `${actualSize * 0.9}px`,
    borderRadius: '50%',
    background: `radial-gradient(circle at 30% 30%, ${colors.secondary}, ${colors.primary})`,
    border: `3px solid ${colors.secondary}`,
    boxShadow: `0 0 ${10 + tier * 5}px ${colors.primary}, inset 0 0 20px rgba(0,0,0,0.3)`,
  };

  const emblemStyle: JSX.CSSProperties = {
    position: 'absolute',
    width: `${actualSize * 0.4}px`,
    height: `${actualSize * 0.4}px`,
    borderRadius: '50%',
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
