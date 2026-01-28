export interface DamageIconProps {
  size?: number;
  className?: string;
  style?: Record<string, string | number>;
}

export function DamageIcon({ size = 20, className = '', style }: DamageIconProps) {
  const uniqueId = `damage-${Math.random().toString(36).slice(2, 11)}`;

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
        {/* Blade gradient - steel */}
        <linearGradient id={`blade-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#E8E8E8" />
          <stop offset="30%" stopColor="#D0D0D0" />
          <stop offset="50%" stopColor="#F5F5F5" />
          <stop offset="70%" stopColor="#D0D0D0" />
          <stop offset="100%" stopColor="#B0B0B0" />
        </linearGradient>

        {/* Handle gradient - orange/gold */}
        <linearGradient id={`handle-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFB347" />
          <stop offset="50%" stopColor="#FF8C00" />
          <stop offset="100%" stopColor="#CC7000" />
        </linearGradient>

        {/* Guard gradient */}
        <linearGradient id={`guard-${uniqueId}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="50%" stopColor="#DAA520" />
          <stop offset="100%" stopColor="#B8860B" />
        </linearGradient>

        {/* Glow filter */}
        <filter id={`swordGlow-${uniqueId}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer glow */}
      <ellipse cx="16" cy="16" rx="13" ry="14" fill="#FF8C00" opacity="0.2" />

      {/* Sword blade - diagonal for more dynamic look */}
      <path
        d="M8 5 L10 7 L22 19 L24 17 L12 5 Z"
        fill={`url(#blade-${uniqueId})`}
        stroke="#808080"
        strokeWidth="0.8"
        filter={`url(#swordGlow-${uniqueId})`}
      />

      {/* Blade edge highlight */}
      <path
        d="M9 6 L11 8 L21 18"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.7"
      />

      {/* Cross guard */}
      <rect
        x="19"
        y="17"
        width="8"
        height="3"
        rx="1"
        fill={`url(#guard-${uniqueId})`}
        stroke="#8B6914"
        strokeWidth="0.5"
        transform="rotate(45 23 18.5)"
      />

      {/* Handle */}
      <path
        d="M22 20 L27 25 L25 27 L20 22 Z"
        fill={`url(#handle-${uniqueId})`}
        stroke="#8B4513"
        strokeWidth="0.8"
      />

      {/* Pommel */}
      <circle
        cx="26"
        cy="26"
        r="2.5"
        fill={`url(#guard-${uniqueId})`}
        stroke="#8B6914"
        strokeWidth="0.5"
      />

      {/* Blade tip sparkle */}
      <circle cx="9" cy="6" r="1.5" fill="#FFFFFF" opacity="0.9" />
    </svg>
  );
}
