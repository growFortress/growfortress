export interface RailgunIconProps {
  size?: number;
  className?: string;
  style?: Record<string, string | number>;
}

export function RailgunIcon({ size = 20, className = '', style }: RailgunIconProps) {
  const uniqueId = `railgun-${Math.random().toString(36).slice(2, 11)}`;
  const scale = size / 32;
  
  // Colors matching TurretSystem.ts: railgun
  const primary = '#4a5568';      // Slate gray
  const secondary = '#718096';    // Lighter gray
  const glow = '#00bfff';          // Cyan energy
  const barrel = '#2d3748';       // Dark gray barrel
  const base = '#2a2a3a';         // Base platform
  
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class={className}
      style={style}
    >
      <defs>
        <linearGradient id={`railgunBase-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={base} />
          <stop offset="100%" stopColor="#1a1a2a" />
        </linearGradient>
        <linearGradient id={`railgunPrimary-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={primary} />
          <stop offset="100%" stopColor={secondary} />
        </linearGradient>
        <radialGradient id={`railgunGlow-${uniqueId}`} cx="50%" cy="50%">
          <stop offset="0%" stopColor={glow} stopOpacity="0.8" />
          <stop offset="50%" stopColor={glow} stopOpacity="0.4" />
          <stop offset="100%" stopColor={glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`railgunBarrel-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={barrel} />
          <stop offset="100%" stopColor="#1a1f2e" />
        </linearGradient>
        <filter id={`railgunGlow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Wide base platform shadow */}
      <rect
        x={16 - 5.5 * scale + 0.5 * scale}
        y={16 + 3.2 * scale + 0.75 * scale}
        width={11 * scale}
        height={3.5 * scale}
        rx={1.5 * scale}
        fill="#000000"
        opacity="0.3"
      />
      
      {/* Wide base platform */}
      <rect
        x={16 - 5.5 * scale}
        y={16 + 3.2 * scale}
        width={11 * scale}
        height={3.5 * scale}
        rx={1.5 * scale}
        fill={`url(#railgunBase-${uniqueId})`}
        stroke={primary}
        strokeWidth={0.5 * scale}
        opacity="0.6"
      />

      {/* Base highlight */}
      <rect
        x={16 - 5 * scale}
        y={16 + 4.2 * scale}
        width={4 * scale}
        height={0.8 * scale}
        rx={0.5 * scale}
        fill="#3a3a4a"
        opacity="0.5"
      />

      {/* Tower body shadow */}
      <polygon
        points={`${16 - 4.5 * scale + 0.5 * scale},${16 + 4.8 * scale + 0.75 * scale} ${16 - 3.2 * scale + 0.5 * scale},${16 - 6.4 * scale + 0.75 * scale} ${16 + 3.2 * scale + 0.5 * scale},${16 - 6.4 * scale + 0.75 * scale} ${16 + 4.5 * scale + 0.5 * scale},${16 + 4.8 * scale + 0.75 * scale}`}
        fill="#000000"
        opacity="0.25"
      />

      {/* Tower body (trapezoid) */}
      <polygon
        points={`${16 - 4.5 * scale},${16 + 4.8 * scale} ${16 - 3.2 * scale},${16 - 6.4 * scale} ${16 + 3.2 * scale},${16 - 6.4 * scale} ${16 + 4.5 * scale},${16 + 4.8 * scale}`}
        fill={`url(#railgunPrimary-${uniqueId})`}
        stroke={secondary}
        strokeWidth={0.5 * scale}
      />

      {/* Tower highlight (left edge) */}
      <line
        x1={16 - 4.3 * scale}
        y1={16 + 3.2 * scale}
        x2={16 - 3.1 * scale}
        y2={16 - 5.6 * scale}
        stroke={glow}
        strokeWidth={0.75 * scale}
        opacity="0.35"
      />

      {/* Middle detail band with depth */}
      <rect
        x={16 - 3.8 * scale}
        y={16 - 2.4 * scale}
        width={7.6 * scale}
        height={1.2 * scale}
        rx={0.5 * scale}
        fill={primary}
        opacity="0.6"
      />
      <rect
        x={16 - 3.6 * scale}
        y={16 - 2.24 * scale}
        width={7.2 * scale}
        height={1 * scale}
        rx={0.5 * scale}
        fill={secondary}
        opacity="0.4"
      />

      {/* Top rotating turret head shadow */}
      <circle
        cx={16}
        cy={16 - 6.08 * scale}
        r={3.6 * scale}
        fill="#000000"
        opacity="0.4"
      />

      {/* Top rotating turret head with energy glow */}
      <circle
        cx={16}
        cy={16 - 6.4 * scale}
        r={3.8 * scale}
        fill={`url(#railgunGlow-${uniqueId})`}
        opacity="0.15"
      />
      <circle
        cx={16}
        cy={16 - 6.4 * scale}
        r={3.6 * scale}
        fill={secondary}
        stroke={glow}
        strokeWidth={0.5 * scale}
        opacity="0.6"
      />

      {/* Inner turret detail with depth */}
      <circle
        cx={16}
        cy={16 - 6.4 * scale}
        r={2.4 * scale}
        fill="#000000"
        opacity="0.3"
      />
      <circle
        cx={16}
        cy={16 - 6.4 * scale}
        r={2.2 * scale}
        fill={primary}
        stroke={glow}
        strokeWidth={0.3 * scale}
        opacity="0.4"
      />

      {/* Inner highlight */}
      <circle
        cx={16 - 0.6 * scale}
        cy={16 - 7.36 * scale}
        r={0.8 * scale}
        fill={glow}
        opacity="0.25"
      />

      {/* Barrel base shadow */}
      <rect
        x={16 - 1.26 * scale + 0.25 * scale}
        y={16 - 2.4 * scale + 0.25 * scale}
        width={1.76 * scale}
        height={2.88 * scale}
        rx={0.5 * scale}
        fill="#000000"
        opacity="0.4"
      />

      {/* Barrel base (where it connects to turret head) */}
      <rect
        x={16 - 1.26 * scale}
        y={16 - 2.4 * scale}
        width={1.76 * scale}
        height={2.88 * scale}
        rx={0.5 * scale}
        fill={`url(#railgunBarrel-${uniqueId})`}
        stroke={secondary}
        strokeWidth={0.25 * scale}
      />

      {/* Main barrel shadow */}
      <rect
        x={16 - 0.9 * scale + 0.25 * scale}
        y={16 - 11.2 * scale + 0.25 * scale}
        width={1.8 * scale}
        height={9.35 * scale}
        rx={0.75 * scale}
        fill="#000000"
        opacity="0.4"
      />

      {/* Main barrel */}
      <rect
        x={16 - 0.9 * scale}
        y={16 - 11.2 * scale}
        width={1.8 * scale}
        height={9.35 * scale}
        rx={0.75 * scale}
        fill={`url(#railgunBarrel-${uniqueId})`}
        stroke={secondary}
        strokeWidth={0.25 * scale}
      />

      {/* Barrel highlight */}
      <rect
        x={16 - 0.9 * scale + 0.25 * scale}
        y={16 - 10.4 * scale + 0.75 * scale}
        width={0.45 * scale}
        height={6.55 * scale}
        rx={0.5 * scale}
        fill={glow}
        opacity="0.25"
      />

      {/* Barrel reinforcement rings */}
      <rect
        x={16 - 1.17 * scale}
        y={16 - 5.6 * scale}
        width={2.34 * scale}
        height={1.25 * scale}
        rx={0.5 * scale}
        fill={secondary}
      />
      <rect
        x={16 - 1.08 * scale}
        y={16 - 10.4 * scale}
        width={2.16 * scale}
        height={1 * scale}
        rx={0.5 * scale}
        fill={secondary}
      />

      {/* Muzzle tip with glow */}
      <rect
        x={16 - 0.99 * scale}
        y={16 - 12.8 * scale}
        width={1.98 * scale}
        height={1.5 * scale}
        rx={0.5 * scale}
        fill="#333344"
        stroke={glow}
        strokeWidth={0.25 * scale}
        opacity="0.5"
      />

      {/* Muzzle inner glow */}
      <circle
        cx={16}
        cy={16 - 12.05 * scale}
        r={0.54 * scale}
        fill={glow}
        opacity="0.3"
      />
    </svg>
  );
}
