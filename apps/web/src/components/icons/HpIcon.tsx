export interface HpIconProps {
  size?: number;
  className?: string;
  style?: Record<string, string | number>;
}

export function HpIcon({ size = 20, className = '', style }: HpIconProps) {
  const uniqueId = `hp-${Math.random().toString(36).slice(2, 11)}`;

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
        {/* Main heart gradient - vibrant red */}
        <linearGradient id={`heartMain-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF6B6B" />
          <stop offset="40%" stopColor="#EE5A5A" />
          <stop offset="70%" stopColor="#DC3545" />
          <stop offset="100%" stopColor="#C82333" />
        </linearGradient>

        {/* Inner glow */}
        <radialGradient id={`heartGlow-${uniqueId}`} cx="40%" cy="35%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.7" />
          <stop offset="40%" stopColor="#FFAAAA" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#DC3545" stopOpacity="0" />
        </radialGradient>

        {/* Glow filter */}
        <filter id={`hpGlow-${uniqueId}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer glow */}
      <ellipse cx="16" cy="15" rx="13" ry="12" fill="#FF6B6B" opacity="0.25" />

      {/* Main heart shape - larger and bolder */}
      <path
        d="M16 7 C13 3, 5 4, 5 11 C5 18, 16 27, 16 27 C16 27, 27 18, 27 11 C27 4, 19 3, 16 7 Z"
        fill={`url(#heartMain-${uniqueId})`}
        stroke="#A71D2A"
        strokeWidth="1"
        filter={`url(#hpGlow-${uniqueId})`}
      />

      {/* Inner highlight */}
      <ellipse
        cx="12"
        cy="11"
        rx="4"
        ry="3"
        fill={`url(#heartGlow-${uniqueId})`}
      />

      {/* Top shine spots */}
      <circle cx="11" cy="10" r="2" fill="#FFFFFF" opacity="0.8" />
      <circle cx="14" cy="12" r="1" fill="#FFFFFF" opacity="0.5" />
    </svg>
  );
}
