export interface GoldIconProps {
  size?: number;
  className?: string;
  style?: Record<string, string | number>;
}

export function GoldIcon({ size = 20, className = '', style }: GoldIconProps) {
  const uniqueId = `gold-${Math.random().toString(36).slice(2, 11)}`;

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
        {/* Main coin gradient - rich gold */}
        <linearGradient id={`coinGold-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFE066" />
          <stop offset="35%" stopColor="#FFD700" />
          <stop offset="65%" stopColor="#F5A623" />
          <stop offset="100%" stopColor="#D4880F" />
        </linearGradient>

        {/* Coin edge gradient */}
        <linearGradient id={`coinEdge-${uniqueId}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#B8860B" />
          <stop offset="50%" stopColor="#8B6914" />
          <stop offset="100%" stopColor="#6B4E0A" />
        </linearGradient>

        {/* Highlight shine */}
        <linearGradient id={`coinShine-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#FFFACD" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
        </linearGradient>

        {/* Glow filter */}
        <filter id={`goldGlow-${uniqueId}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer glow */}
      <circle cx="16" cy="16" r="14" fill="#FFD700" opacity="0.25" />

      {/* Back coin (stack effect) */}
      <ellipse
        cx="16"
        cy="19"
        rx="10"
        ry="4"
        fill={`url(#coinEdge-${uniqueId})`}
      />

      {/* Main coin face */}
      <ellipse
        cx="16"
        cy="15"
        rx="11"
        ry="11"
        fill={`url(#coinGold-${uniqueId})`}
        stroke="#B8860B"
        strokeWidth="1"
        filter={`url(#goldGlow-${uniqueId})`}
      />

      {/* Inner ring */}
      <ellipse
        cx="16"
        cy="15"
        rx="8"
        ry="8"
        fill="none"
        stroke="#D4880F"
        strokeWidth="1.5"
        opacity="0.7"
      />

      {/* Dollar/Currency symbol - bold and clear */}
      <text
        x="16"
        y="19"
        textAnchor="middle"
        fontFamily="Arial, sans-serif"
        fontSize="12"
        fontWeight="bold"
        fill="#8B6914"
      >
        $
      </text>

      {/* Top shine highlight */}
      <ellipse
        cx="13"
        cy="11"
        rx="5"
        ry="3"
        fill={`url(#coinShine-${uniqueId})`}
        opacity="0.8"
      />

      {/* Small sparkle */}
      <circle cx="10" cy="9" r="1.5" fill="#FFFFFF" opacity="0.9" />
    </svg>
  );
}
