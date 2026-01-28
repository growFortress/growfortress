export interface CryoIconProps {
  size?: number;
  className?: string;
  style?: Record<string, string | number>;
}

export function CryoIcon({ size = 20, className = '', style }: CryoIconProps) {
  const uniqueId = `cryo-${Math.random().toString(36).slice(2, 11)}`;
  const scale = size / 32;
  
  // Colors matching TurretSystem.ts: cryo
  const primary = '#00ced1';      // Turquoise
  const secondary = '#87ceeb';    // Sky blue
  const glow = '#add8e6';         // Ice blue glow
  const barrel = '#1a5f5f';       // Dark teal barrel
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
        <linearGradient id={`cryoBase-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={base} />
          <stop offset="100%" stopColor="#1a1a2a" />
        </linearGradient>
        <linearGradient id={`cryoPrimary-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={primary} />
          <stop offset="100%" stopColor={secondary} />
        </linearGradient>
        <radialGradient id={`cryoGlow-${uniqueId}`} cx="50%" cy="50%">
          <stop offset="0%" stopColor={glow} stopOpacity="1" />
          <stop offset="50%" stopColor={glow} stopOpacity="0.6" />
          <stop offset="100%" stopColor={glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`cryoBarrel-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={barrel} />
          <stop offset="100%" stopColor="#0d3d3d" />
        </linearGradient>
        <filter id={`cryoGlow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id={`cryoSparkle-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.5" />
          <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 2 0" />
        </filter>
      </defs>

      {/* Wide circular base platform shadow */}
      <ellipse
        cx={16 + 0.5 * scale}
        cy={16 + 4 * scale + 0.75 * scale}
        rx={5.6 * scale}
        ry={2 * scale}
        fill="#000000"
        opacity="0.25"
      />
      
      {/* Wide circular base platform */}
      <ellipse
        cx={16}
        cy={16 + 4 * scale}
        rx={5.6 * scale}
        ry={2 * scale}
        fill={`url(#cryoBase-${uniqueId})`}
        stroke={primary}
        strokeWidth={0.5 * scale}
        opacity="0.6"
      />

      {/* Base ring shadow */}
      <ellipse
        cx={16 + 0.25 * scale}
        cy={16 + 2.72 * scale + 0.5 * scale}
        rx={4.8 * scale}
        ry={1.28 * scale}
        fill="#000000"
        opacity="0.4"
      />

      {/* Base ring */}
      <ellipse
        cx={16}
        cy={16 + 2.72 * scale}
        rx={4.8 * scale}
        ry={1.28 * scale}
        fill={`url(#cryoPrimary-${uniqueId})`}
        stroke={secondary}
        strokeWidth={0.5 * scale}
      />

      {/* Main dome body shadow */}
      <ellipse
        cx={16 + 0.5 * scale}
        cy={16 - 0.48 * scale + 0.5 * scale}
        rx={4.4 * scale}
        ry={3.6 * scale}
        fill="#000000"
        opacity="0.3"
      />

      {/* Main dome body (taller, more spherical) */}
      <ellipse
        cx={16}
        cy={16 - 0.8 * scale}
        rx={4.4 * scale}
        ry={3.6 * scale}
        fill={`url(#cryoPrimary-${uniqueId})`}
        stroke={secondary}
        strokeWidth={0.5 * scale}
      />

      {/* Dome highlight arc (upper left) */}
      <path
        d={`M ${16 - 1.2 * scale} ${16 - 1.2 * scale} A ${3.2 * scale} ${3.2 * scale} 0 0 1 ${16 + 0.8 * scale} ${16 - 1.6 * scale}`}
        stroke={glow}
        strokeWidth={1 * scale}
        fill="none"
        opacity="0.25"
      />

      {/* Upper dome layer (highlight) */}
      <ellipse
        cx={16}
        cy={13}
        rx={3.6 * scale}
        ry={3 * scale}
        fill={secondary}
        opacity="0.4"
        stroke={glow}
        strokeWidth={0.3 * scale}
      />

      {/* Dome cap with pulsing glow */}
      <ellipse
        cx={16}
        cy={10}
        rx={2.7 * scale}
        ry={2.4 * scale}
        fill={glow}
        opacity="0.5"
      />
      <ellipse
        cx={16}
        cy={10}
        rx={2.6 * scale}
        ry={2.3 * scale}
        fill={glow}
        opacity="0.25"
      />

      {/* Inner energy core (glowing) */}
      <circle
        cx={16}
        cy={12}
        r={1.8 * scale}
        fill={glow}
        opacity="0.3"
      />
      <circle
        cx={16}
        cy={12}
        r={1.4 * scale}
        fill={glow}
        opacity="0.5"
      />
      <circle
        cx={16}
        cy={12}
        r={1 * scale}
        fill="#ffffff"
        opacity="0.8"
      />
      <circle
        cx={16}
        cy={11.5}
        r={0.5 * scale}
        fill="#ffffff"
        opacity="0.9"
      />

      {/* Decorative panels around dome base with depth */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const angle = (i * Math.PI) / 4;
        const px = 16 + Math.cos(angle) * 4 * scale;
        const py = 16 + 1.44 * scale + Math.sin(angle) * 1.44 * scale;
        return (
          <g key={i}>
            <circle
              cx={px + 0.25 * scale}
              cy={py + 0.25 * scale}
              r={0.48 * scale}
              fill="#000000"
              opacity="0.3"
            />
            <circle
              cx={px}
              cy={py}
              r={0.48 * scale}
              fill={secondary}
              opacity="0.4"
              stroke={glow}
              strokeWidth={0.25 * scale}
            />
            <circle
              cx={px - 0.25 * scale}
              cy={py - 0.25 * scale}
              r={0.2 * scale}
              fill={glow}
              opacity="0.3"
            />
          </g>
        );
      })}

      {/* Frost/ice particles effect */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (i * Math.PI) / 2;
        const dist = 2.8 * scale;
        const px = 16 + Math.cos(angle) * dist;
        const py = 16 - 3.2 * scale + Math.sin(angle) * dist * 0.5;
        return (
          <circle
            key={i}
            cx={px}
            cy={py}
            r={0.24 * scale}
            fill={glow}
            opacity="0.4"
            filter={`url(#cryoSparkle-${uniqueId})`}
          />
        );
      })}

      {/* Emitter housing (if has barrel) */}
      <rect
        x={16 - 1.1 * scale}
        y={8}
        width={2.2 * scale}
        height={1.8 * scale}
        rx={0.4 * scale}
        fill={`url(#cryoBarrel-${uniqueId})`}
        stroke={glow}
        strokeWidth={0.3 * scale}
        opacity="0.6"
      />

      {/* Emitter nozzle outer glow */}
      <circle
        cx={16}
        cy={7}
        r={1.1 * scale}
        fill={glow}
        opacity="0.2"
      />

      {/* Emitter nozzle */}
      <circle
        cx={16}
        cy={7}
        r={0.8 * scale}
        fill={secondary}
        stroke={glow}
        strokeWidth={0.5 * scale}
      />

      {/* Glowing emitter core */}
      <circle
        cx={16}
        cy={7}
        r={0.5 * scale}
        fill={glow}
        opacity="0.9"
      />
      <circle
        cx={16}
        cy={7}
        r={0.25 * scale}
        fill="#ffffff"
        opacity="0.95"
      />
    </svg>
  );
}
