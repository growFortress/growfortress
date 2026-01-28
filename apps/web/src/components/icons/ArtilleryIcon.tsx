export interface ArtilleryIconProps {
  size?: number;
  className?: string;
  style?: Record<string, string | number>;
}

export function ArtilleryIcon({ size = 20, className = '', style }: ArtilleryIconProps) {
  const uniqueId = `artillery-${Math.random().toString(36).slice(2, 11)}`;
  const scale = size / 32;
  
  // Colors matching TurretSystem.ts: artillery
  const primary = '#8b4513';      // Brown/bronze
  const secondary = '#a0522d';    // Lighter brown
  const glow = '#ff6600';         // Orange fire
  const barrel = '#5c3317';       // Dark brown barrel
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
        <linearGradient id={`artilleryBase-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={base} />
          <stop offset="100%" stopColor="#1a1a2a" />
        </linearGradient>
        <linearGradient id={`artilleryPrimary-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={primary} />
          <stop offset="100%" stopColor={secondary} />
        </linearGradient>
        <radialGradient id={`artilleryGlow-${uniqueId}`} cx="50%" cy="50%">
          <stop offset="0%" stopColor={glow} stopOpacity="0.8" />
          <stop offset="50%" stopColor={glow} stopOpacity="0.4" />
          <stop offset="100%" stopColor={glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`artilleryBarrel-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={barrel} />
          <stop offset="100%" stopColor="#3d1f0a" />
        </linearGradient>
        <filter id={`artilleryGlow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Hexagonal base platform shadow */}
      <polygon
        points={`${16 - 6 * scale},${16 + 3.2 * scale + 1} ${16 - 3 * scale},${16 + 3.2 * scale + 3 * scale + 1} ${16 + 3 * scale},${16 + 3.2 * scale + 3 * scale + 1} ${16 + 6 * scale},${16 + 3.2 * scale + 1} ${16 + 3 * scale},${16 + 3.2 * scale - 3 * scale + 1} ${16 - 3 * scale},${16 + 3.2 * scale - 3 * scale + 1}`}
        fill="#000000"
        opacity="0.3"
      />
      
      {/* Hexagonal base platform */}
      <polygon
        points={`${16 - 6 * scale},${16 + 3.2 * scale} ${16 - 3 * scale},${16 + 3.2 * scale + 3 * scale} ${16 + 3 * scale},${16 + 3.2 * scale + 3 * scale} ${16 + 6 * scale},${16 + 3.2 * scale} ${16 + 3 * scale},${16 + 3.2 * scale - 3 * scale} ${16 - 3 * scale},${16 + 3.2 * scale - 3 * scale}`}
        fill={`url(#artilleryBase-${uniqueId})`}
        stroke={primary}
        strokeWidth={0.5 * scale}
        opacity="0.6"
      />

      {/* Inner rotating platform shadow */}
      <circle
        cx={16}
        cy={16 + 0.4 * scale}
        r={5 * scale}
        fill="#000000"
        opacity="0.5"
      />

      {/* Inner rotating platform */}
      <circle
        cx={16}
        cy={16}
        r={5 * scale}
        fill={`url(#artilleryPrimary-${uniqueId})`}
        stroke={secondary}
        strokeWidth={0.5 * scale}
      />

      {/* Highlight arc */}
      <path
        d={`M ${16 - 4.4 * scale} ${16 - 2.4 * scale} A ${5.5 * scale} ${5.5 * scale} 0 0 1 ${16 + 1.6 * scale} ${16 - 1.6 * scale}`}
        stroke={glow}
        strokeWidth={0.75 * scale}
        fill="none"
        opacity="0.4"
      />

      {/* Armored turret housing shadow */}
      <circle
        cx={16}
        cy={16 + 0.25 * scale}
        r={4 * scale}
        fill="#000000"
        opacity="0.4"
      />

      {/* Armored turret housing */}
      <circle
        cx={16}
        cy={16}
        r={4 * scale}
        fill={secondary}
        stroke={glow}
        strokeWidth={0.5 * scale}
        opacity="0.4"
      />

      {/* Center turret core with energy pulse */}
      <circle
        cx={16}
        cy={16}
        r={3.2 * scale}
        fill={glow}
        opacity="0.3"
      />
      <circle
        cx={16}
        cy={16}
        r={3 * scale}
        fill={primary}
        stroke={glow}
        strokeWidth={0.3 * scale}
        opacity="0.5"
      />

      {/* Inner core glow */}
      <circle
        cx={16}
        cy={16 - 0.8 * scale}
        r={1.5 * scale}
        fill={glow}
        opacity="0.3"
      />

      {/* Barrel base/housing shadow */}
      <rect
        x={16 - 2.86 * scale + 0.5 * scale}
        y={16 - 3.2 * scale + 0.5 * scale}
        width={5.72 * scale}
        height={4 * scale}
        rx={1 * scale}
        fill="#000000"
        opacity="0.4"
      />

      {/* Barrel base/housing */}
      <rect
        x={16 - 2.86 * scale}
        y={16 - 3.2 * scale}
        width={5.72 * scale}
        height={4 * scale}
        rx={1 * scale}
        fill={`url(#artilleryBarrel-${uniqueId})`}
        stroke={secondary}
        strokeWidth={0.25 * scale}
      />

      {/* Main barrel shadow */}
      <rect
        x={16 - 2.2 * scale + 0.5 * scale}
        y={16 - 11.2 * scale + 0.5 * scale}
        width={4.4 * scale}
        height={8.5 * scale}
        rx={1 * scale}
        fill="#000000"
        opacity="0.4"
      />

      {/* Main barrel (thick) */}
      <rect
        x={16 - 2.2 * scale}
        y={16 - 11.2 * scale}
        width={4.4 * scale}
        height={8.5 * scale}
        rx={1 * scale}
        fill={`url(#artilleryBarrel-${uniqueId})`}
        stroke={secondary}
        strokeWidth={0.5 * scale}
      />

      {/* Barrel highlight */}
      <rect
        x={16 - 2.2 * scale + 0.5 * scale}
        y={16 - 10.4 * scale + 1 * scale}
        width={1.32 * scale}
        height={5.95 * scale}
        rx={0.5 * scale}
        fill={glow}
        opacity="0.3"
      />

      {/* Barrel reinforcement bands */}
      <rect
        x={16 - 2.6 * scale}
        y={16 - 5.6 * scale}
        width={5.2 * scale}
        height={1.5 * scale}
        rx={0.5 * scale}
        fill={secondary}
      />
      <rect
        x={16 - 2.3 * scale}
        y={16 - 8.8 * scale}
        width={4.6 * scale}
        height={1.25 * scale}
        rx={0.5 * scale}
        fill={secondary}
      />

      {/* Heavy muzzle brake with glow */}
      <rect
        x={16 - 3 * scale}
        y={16 - 12.8 * scale}
        width={6 * scale}
        height={2.5 * scale}
        rx={0.75 * scale}
        fill="#333344"
        stroke={glow}
        strokeWidth={0.5 * scale}
        opacity="0.5"
      />

      {/* Muzzle glow ring */}
      <circle
        cx={16}
        cy={16 - 11.55 * scale}
        r={1.32 * scale}
        stroke={glow}
        strokeWidth={0.5 * scale}
        fill="none"
        opacity="0.4"
      />

      {/* Muzzle vents */}
      <rect
        x={16 - 2.8 * scale}
        y={16 - 12.3 * scale}
        width={0.8 * scale}
        height={0.75 * scale}
        rx={0.25 * scale}
        fill="#222233"
      />
      <rect
        x={16 + 2 * scale}
        y={16 - 12.3 * scale}
        width={0.8 * scale}
        height={0.75 * scale}
        rx={0.25 * scale}
        fill="#222233"
      />

      {/* Core glow */}
      <circle
        cx={16}
        cy={16}
        r={1.5 * scale}
        fill={glow}
        opacity="0.4"
        filter={`url(#artilleryGlow-${uniqueId})`}
      />
    </svg>
  );
}
