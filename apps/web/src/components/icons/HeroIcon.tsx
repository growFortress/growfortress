export interface HeroIconProps {
  size?: number;
  className?: string;
}

export function HeroIcon({ size = 24, className = '' }: HeroIconProps) {
  const uniqueId = `hero-${Math.random().toString(36).slice(2, 11)}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class={className}
    >
      <defs>
        {/* Cape gradient - royal purple/blue */}
        <linearGradient id={`cape-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8855FF" />
          <stop offset="50%" stopColor="#6633CC" />
          <stop offset="100%" stopColor="#4422AA" />
        </linearGradient>

        {/* Armor gradient - cyan/teal */}
        <linearGradient id={`armor-${uniqueId}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#00DDDD" />
          <stop offset="50%" stopColor="#00AAAA" />
          <stop offset="100%" stopColor="#008888" />
        </linearGradient>

        {/* Skin tone */}
        <linearGradient id={`skin-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFCC99" />
          <stop offset="100%" stopColor="#DDAA77" />
        </linearGradient>

        {/* Glow */}
        <filter id={`heroGlow-${uniqueId}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer glow */}
      <circle cx="16" cy="16" r="14" fill="#8855FF" opacity="0.15" />

      {/* Cape - behind body */}
      <path
        d="M8 14 L6 28 L16 26 L26 28 L24 14"
        fill={`url(#cape-${uniqueId})`}
        opacity="0.9"
      />

      {/* Body/Armor */}
      <path
        d="M11 15 L11 24 L21 24 L21 15 Q16 18 11 15"
        fill={`url(#armor-${uniqueId})`}
        stroke="#006666"
        strokeWidth="0.8"
        filter={`url(#heroGlow-${uniqueId})`}
      />

      {/* Shoulders */}
      <ellipse cx="10" cy="15" rx="3" ry="2" fill={`url(#armor-${uniqueId})`} stroke="#006666" strokeWidth="0.5" />
      <ellipse cx="22" cy="15" rx="3" ry="2" fill={`url(#armor-${uniqueId})`} stroke="#006666" strokeWidth="0.5" />

      {/* Head */}
      <circle
        cx="16"
        cy="9"
        r="5"
        fill={`url(#skin-${uniqueId})`}
        stroke="#AA8866"
        strokeWidth="0.5"
      />

      {/* Hair */}
      <path
        d="M11 8 Q11 4 16 4 Q21 4 21 8 L20 7 Q16 5 12 7 Z"
        fill="#443322"
      />

      {/* Eyes */}
      <circle cx="14" cy="9" r="1" fill="#334455" />
      <circle cx="18" cy="9" r="1" fill="#334455" />

      {/* Star emblem on chest */}
      <path
        d="M16 17 L16.8 19 L19 19 L17.2 20.2 L17.8 22.5 L16 21 L14.2 22.5 L14.8 20.2 L13 19 L15.2 19 Z"
        fill="#FFD700"
        stroke="#CC9900"
        strokeWidth="0.3"
      />

      {/* Shine on armor */}
      <ellipse cx="14" cy="18" rx="2" ry="1.5" fill="#FFFFFF" opacity="0.3" />
    </svg>
  );
}
