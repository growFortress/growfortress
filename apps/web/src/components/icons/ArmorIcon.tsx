export interface ArmorIconProps {
  size?: number;
  className?: string;
  style?: Record<string, string | number>;
}

export function ArmorIcon({ size = 20, className = '', style }: ArmorIconProps) {
  const uniqueId = `armor-${Math.random().toString(36).slice(2, 11)}`;

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
        {/* Main shield gradient - golden yellow */}
        <linearGradient id={`shieldMain-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="30%" stopColor="#FFC000" />
          <stop offset="60%" stopColor="#DAA520" />
          <stop offset="100%" stopColor="#B8860B" />
        </linearGradient>

        {/* Inner emblem gradient */}
        <linearGradient id={`emblem-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B6914" />
          <stop offset="50%" stopColor="#6B4E0A" />
          <stop offset="100%" stopColor="#5C4409" />
        </linearGradient>

        {/* Shine gradient */}
        <linearGradient id={`shieldShine-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#FFF8DC" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
        </linearGradient>

        {/* Glow filter */}
        <filter id={`shieldGlow-${uniqueId}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer glow */}
      <ellipse cx="16" cy="16" rx="13" ry="14" fill="#FFD700" opacity="0.25" />

      {/* Main shield shape - classic heraldic shield */}
      <path
        d="M16 4 L6 8 L6 16 C6 22 10 26 16 29 C22 26 26 22 26 16 L26 8 Z"
        fill={`url(#shieldMain-${uniqueId})`}
        stroke="#8B6914"
        strokeWidth="1"
        filter={`url(#shieldGlow-${uniqueId})`}
      />

      {/* Shield border/rim */}
      <path
        d="M16 6 L8 9 L8 16 C8 21 11 24 16 27 C21 24 24 21 24 16 L24 9 Z"
        fill="none"
        stroke="#6B4E0A"
        strokeWidth="1.5"
        opacity="0.6"
      />

      {/* Inner chevron/emblem */}
      <path
        d="M16 10 L11 16 L16 22 L21 16 Z"
        fill={`url(#emblem-${uniqueId})`}
        opacity="0.8"
      />

      {/* Top shine highlight */}
      <ellipse
        cx="12"
        cy="11"
        rx="4"
        ry="3"
        fill={`url(#shieldShine-${uniqueId})`}
      />

      {/* Sparkle */}
      <circle cx="10" cy="10" r="1.5" fill="#FFFFFF" opacity="0.9" />
    </svg>
  );
}
