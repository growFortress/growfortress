interface DustIconProps {
  size?: number;
  className?: string;
  style?: Record<string, string | number>;
}

export function DustIcon({ size = 20, className = '', style }: DustIconProps) {
  const uniqueId = `dust-${Math.random().toString(36).slice(2, 11)}`;

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
        {/* Main crystal gradient - vibrant purple/magenta */}
        <linearGradient id={`crystalMain-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E879F9" />
          <stop offset="40%" stopColor="#C026D3" />
          <stop offset="70%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>

        {/* Left facet - darker */}
        <linearGradient id={`crystalLeft-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9333EA" />
          <stop offset="100%" stopColor="#6B21A8" />
        </linearGradient>

        {/* Right facet - lighter */}
        <linearGradient id={`crystalRight-${uniqueId}`} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F0ABFC" />
          <stop offset="50%" stopColor="#D946EF" />
          <stop offset="100%" stopColor="#A855F7" />
        </linearGradient>

        {/* Inner glow */}
        <radialGradient id={`crystalGlow-${uniqueId}`} cx="50%" cy="40%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
          <stop offset="40%" stopColor="#F5D0FE" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#C026D3" stopOpacity="0" />
        </radialGradient>

        {/* Glow filter */}
        <filter id={`dustGlow-${uniqueId}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer glow */}
      <ellipse cx="16" cy="16" rx="13" ry="14" fill="#D946EF" opacity="0.2" />

      {/* Crystal body - hexagonal gem shape */}
      {/* Main center facet */}
      <path
        d="M16 4 L24 12 L24 22 L16 28 L8 22 L8 12 Z"
        fill={`url(#crystalMain-${uniqueId})`}
        stroke="#7C3AED"
        strokeWidth="0.8"
        filter={`url(#dustGlow-${uniqueId})`}
      />

      {/* Left dark facet */}
      <path
        d="M16 4 L8 12 L8 22 L16 16 Z"
        fill={`url(#crystalLeft-${uniqueId})`}
        opacity="0.9"
      />

      {/* Right light facet */}
      <path
        d="M16 4 L24 12 L24 22 L16 16 Z"
        fill={`url(#crystalRight-${uniqueId})`}
        opacity="0.85"
      />

      {/* Bottom point facet */}
      <path
        d="M8 22 L16 28 L24 22 L16 16 Z"
        fill="#6B21A8"
        opacity="0.7"
      />

      {/* Inner highlight */}
      <ellipse
        cx="16"
        cy="13"
        rx="4"
        ry="5"
        fill={`url(#crystalGlow-${uniqueId})`}
      />

      {/* Top shine line */}
      <path
        d="M12 8 L16 5 L20 8"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.8"
      />

      {/* Sparkle dots */}
      <circle cx="11" cy="10" r="1.2" fill="#FFFFFF" opacity="0.95" />
      <circle cx="21" cy="14" r="1" fill="#F5D0FE" opacity="0.9" />
      <circle cx="13" cy="20" r="0.8" fill="#E879F9" opacity="0.8" />
    </svg>
  );
}
