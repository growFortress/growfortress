export interface EnergyIconProps {
  size?: number;
  className?: string;
  style?: Record<string, string | number>;
}

export function EnergyIcon({ size = 20, className = '', style }: EnergyIconProps) {
  const uniqueId = `energy-${Math.random().toString(36).slice(2, 11)}`;

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
        {/* Main lightning gradient - electric cyan/green */}
        <linearGradient id={`boltMain-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5EEAD4" />
          <stop offset="30%" stopColor="#2DD4BF" />
          <stop offset="60%" stopColor="#14B8A6" />
          <stop offset="100%" stopColor="#0D9488" />
        </linearGradient>

        {/* Inner core - bright white/cyan */}
        <linearGradient id={`boltCore-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="50%" stopColor="#A7F3D0" />
          <stop offset="100%" stopColor="#6EE7B7" />
        </linearGradient>

        {/* Outer glow gradient */}
        <radialGradient id={`boltGlow-${uniqueId}`} cx="50%" cy="50%">
          <stop offset="0%" stopColor="#2DD4BF" stopOpacity="0.5" />
          <stop offset="60%" stopColor="#14B8A6" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#0D9488" stopOpacity="0" />
        </radialGradient>

        {/* Glow filter */}
        <filter id={`energyGlow-${uniqueId}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer glow circle */}
      <circle cx="16" cy="16" r="14" fill={`url(#boltGlow-${uniqueId})`} />

      {/* Lightning bolt - main shape */}
      <path
        d="M18 3 L8 17 L14 17 L12 29 L24 13 L17 13 L20 3 Z"
        fill={`url(#boltMain-${uniqueId})`}
        stroke="#0F766E"
        strokeWidth="1"
        strokeLinejoin="round"
        filter={`url(#energyGlow-${uniqueId})`}
      />

      {/* Inner bright core */}
      <path
        d="M17 6 L11 16 L15 16 L13 25 L21 14 L17 14 L19 6 Z"
        fill={`url(#boltCore-${uniqueId})`}
        opacity="0.9"
      />

      {/* Top highlight */}
      <path
        d="M17.5 5 L16 9 L18.5 5.5 Z"
        fill="#FFFFFF"
        opacity="0.9"
      />

      {/* Center bright spot */}
      <ellipse
        cx="15"
        cy="15"
        rx="2"
        ry="3"
        fill="#FFFFFF"
        opacity="0.6"
      />

      {/* Small energy sparks */}
      <circle cx="7" cy="12" r="1.2" fill="#5EEAD4" opacity="0.9" />
      <circle cx="25" cy="18" r="1" fill="#2DD4BF" opacity="0.85" />
      <circle cx="9" cy="22" r="0.9" fill="#6EE7B7" opacity="0.8" />
    </svg>
  );
}
