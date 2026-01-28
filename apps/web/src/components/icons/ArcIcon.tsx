export interface ArcIconProps {
  size?: number;
  className?: string;
  style?: Record<string, string | number>;
}

export function ArcIcon({ size = 20, className = '', style }: ArcIconProps) {
  const uniqueId = `arc-${Math.random().toString(36).slice(2, 11)}`;
  const scale = size / 32;
  
  // Colors matching TurretSystem.ts: arc
  const primary = '#4b0082';      // Indigo/purple
  const secondary = '#9932cc';    // Lighter purple
  const glow = '#00ffff';         // Cyan electricity
  const barrel = '#2f0052';       // Dark purple barrel
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
        <linearGradient id={`arcBase-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={base} />
          <stop offset="100%" stopColor="#1a1a2a" />
        </linearGradient>
        <linearGradient id={`arcPrimary-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={primary} />
          <stop offset="100%" stopColor={secondary} />
        </linearGradient>
        <radialGradient id={`arcGlow-${uniqueId}`} cx="50%" cy="50%">
          <stop offset="0%" stopColor={glow} stopOpacity="1" />
          <stop offset="50%" stopColor={glow} stopOpacity="0.6" />
          <stop offset="100%" stopColor={glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`arcBarrel-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={barrel} />
          <stop offset="100%" stopColor="#1a0033" />
        </linearGradient>
        <filter id={`arcGlow-${uniqueId}`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id={`arcSpark-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.8" />
          <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 2 0" />
        </filter>
      </defs>

      {/* Wide octagonal base platform shadow */}
      <polygon
        points={Array.from({ length: 8 }, (_, i) => {
          const angle = (i * Math.PI) / 4 - Math.PI / 8;
          const x = 16 + Math.cos(angle) * 5.6 * scale + 0.5 * scale;
          const y = 16 + 3.52 * scale + Math.sin(angle) * 2.24 * scale + 0.75 * scale;
          return `${x},${y}`;
        }).join(' ')}
        fill="#000000"
        opacity="0.25"
      />
      
      {/* Wide octagonal base platform */}
      <polygon
        points={Array.from({ length: 8 }, (_, i) => {
          const angle = (i * Math.PI) / 4 - Math.PI / 8;
          const x = 16 + Math.cos(angle) * 5.6 * scale;
          const y = 16 + 3.52 * scale + Math.sin(angle) * 2.24 * scale;
          return `${x},${y}`;
        }).join(' ')}
        fill={`url(#arcBase-${uniqueId})`}
        stroke={primary}
        strokeWidth={0.5 * scale}
        opacity="0.6"
      />

      {/* Lower base ring shadow */}
      <ellipse
        cx={16}
        cy={22}
        rx={4.5 * scale}
        ry={1.5 * scale}
        fill="#000000"
        opacity="0.4"
      />

      {/* Lower base ring */}
      <ellipse
        cx={16}
        cy={20}
        rx={4.5 * scale}
        ry={1.5 * scale}
        fill={`url(#arcPrimary-${uniqueId})`}
        stroke={secondary}
        strokeWidth={0.5 * scale}
      />

      {/* Coil base housing shadow */}
      <ellipse
        cx={16}
        cy={19}
        rx={3.6 * scale}
        ry={1.2 * scale}
        fill="#000000"
        opacity="0.4"
      />

      {/* Coil base housing */}
      <ellipse
        cx={16}
        cy={17}
        rx={3.6 * scale}
        ry={1.2 * scale}
        fill={secondary}
        stroke={glow}
        strokeWidth={0.3 * scale}
        opacity="0.4"
      />

      {/* Tesla coil pillar shadow */}
      <polygon
        points={`${16 - 2.2 * scale},${17} ${16 - 1.4 * scale},${10 - 8 * scale} ${16 + 1.4 * scale},${10 - 8 * scale} ${16 + 2.2 * scale},${17}`}
        fill="#000000"
        opacity="0.25"
      />

      {/* Tesla coil pillar */}
      <polygon
        points={`${16 - 2.2 * scale},${17} ${16 - 1.4 * scale},${10 - 8 * scale} ${16 + 1.4 * scale},${10 - 8 * scale} ${16 + 2.2 * scale},${17}`}
        fill={`url(#arcBarrel-${uniqueId})`}
        stroke={secondary}
        strokeWidth={0.5 * scale}
      />

      {/* Coil windings along pillar (more prominent) */}
      {[0, 1, 2, 3, 4].map((i) => {
        const y = 16 - 0.8 * scale - i * 1.76 * scale;
        const ringWidth = 2.56 * scale - i * 0.2 * scale;
        return (
          <g key={i}>
            <ellipse
              cx={16 + 0.25 * scale}
              cy={y + 0.25 * scale}
              rx={ringWidth}
              ry={0.48 * scale}
              fill="#000000"
              opacity="0.3"
            />
            <ellipse
              cx={16}
              cy={y}
              rx={ringWidth}
              ry={0.48 * scale}
              fill={secondary}
              opacity="0.8"
              stroke={glow}
              strokeWidth={0.25 * scale}
            />
          </g>
        );
      })}

      {/* Upper coil housing */}
      <ellipse
        cx={16}
        cy={16 - 8.8 * scale}
        rx={1.76 * scale}
        ry={0.64 * scale}
        fill={secondary}
      />

      {/* Tesla coil top sphere glow layers (pulsing) */}
      <circle
        cx={16}
        cy={16 - 11.2 * scale}
        r={2.56 * scale}
        fill={glow}
        opacity="0.15"
      />

      {/* Tesla coil top sphere shadow */}
      <circle
        cx={16 + 0.25 * scale}
        cy={16 - 11.04 * scale}
        r={2.08 * scale}
        fill="#000000"
        opacity="0.3"
      />

      {/* Tesla coil top sphere (larger, more prominent) */}
      <circle
        cx={16}
        cy={16 - 11.2 * scale}
        r={2.08 * scale}
        fill={secondary}
        stroke={glow}
        strokeWidth={0.75 * scale}
      />

      {/* Sphere highlight */}
      <path
        d={`M ${16 - 0.64 * scale} ${16 - 12.48 * scale} A ${0.96 * scale} ${0.96 * scale} 0 0 1 ${16 + 0.32 * scale} ${16 - 11.84 * scale}`}
        stroke={glow}
        strokeWidth={0.75 * scale}
        fill="none"
        opacity="0.3"
      />

      {/* Inner sphere glow layers (pulsing) */}
      <circle
        cx={16}
        cy={16 - 11.2 * scale}
        r={1.44 * scale}
        fill={glow}
        opacity="0.4"
      />
      <circle
        cx={16}
        cy={16 - 11.2 * scale}
        r={0.96 * scale}
        fill={glow}
        opacity="0.6"
      />
      <circle
        cx={16}
        cy={16 - 11.2 * scale}
        r={0.48 * scale}
        fill="#ffffff"
        opacity="0.9"
      />
      <circle
        cx={16 - 0.24 * scale}
        cy={16 - 11.68 * scale}
        r={0.2 * scale}
        fill="#ffffff"
        opacity="0.95"
      />

      {/* Electric arcs (static representation) */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const angle = (i * Math.PI * 2) / 8;
        const arcLength = 4 * scale;
        const startX = 16;
        const startY = 8 - 8 * scale;
        const endX = 16 + Math.cos(angle) * arcLength;
        const endY = 8 - 8 * scale + Math.sin(angle) * arcLength * 0.5;
        
        return (
          <g key={i}>
            <line
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke={glow}
              strokeWidth={0.5 * scale}
              opacity="0.85"
              filter={`url(#arcGlow-${uniqueId})`}
            />
            <circle
              cx={endX}
              cy={endY}
              r={0.4 * scale}
              fill={glow}
              opacity="0.5"
              filter={`url(#arcSpark-${uniqueId})`}
            />
          </g>
        );
      })}

      {/* Ground crackling effect (sparks at base) */}
      {[0, 1, 2, 3].map((i) => {
        const sparkAngle = (i * Math.PI) / 2;
        const sparkX = 16 + Math.cos(sparkAngle) * 3.2 * scale;
        const sparkY = 20 + Math.sin(sparkAngle * 2) * 0.4 * scale;
        return (
          <circle
            key={i}
            cx={sparkX}
            cy={sparkY}
            r={0.3 * scale}
            fill={glow}
            opacity="0.4"
            filter={`url(#arcSpark-${uniqueId})`}
          />
        );
      })}
    </svg>
  );
}
