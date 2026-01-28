export interface BossRushIconProps {
  size?: number;
  className?: string;
}

export function BossRushIcon({ size = 24, className = '' }: BossRushIconProps) {
  const uniqueId = `boss-${Math.random().toString(36).slice(2, 11)}`;

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
        {/* Demon face gradient - red/purple */}
        <linearGradient id={`demonFace-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF4444" />
          <stop offset="50%" stopColor="#CC2244" />
          <stop offset="100%" stopColor="#881133" />
        </linearGradient>

        {/* Horn gradient */}
        <linearGradient id={`horn-${uniqueId}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="50%" stopColor="#CC8800" />
          <stop offset="100%" stopColor="#8B4513" />
        </linearGradient>

        {/* Eye glow */}
        <radialGradient id={`eyeGlow-${uniqueId}`} cx="50%" cy="50%">
          <stop offset="0%" stopColor="#FFFF00" />
          <stop offset="50%" stopColor="#FF8800" />
          <stop offset="100%" stopColor="#FF4400" />
        </radialGradient>

        {/* Glow filter */}
        <filter id={`bossGlow-${uniqueId}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer glow */}
      <circle cx="16" cy="16" r="14" fill="#FF4444" opacity="0.2" />

      {/* Left horn */}
      <path
        d="M8 14 L4 4 L10 10 Z"
        fill={`url(#horn-${uniqueId})`}
        stroke="#5C3317"
        strokeWidth="0.5"
      />

      {/* Right horn */}
      <path
        d="M24 14 L28 4 L22 10 Z"
        fill={`url(#horn-${uniqueId})`}
        stroke="#5C3317"
        strokeWidth="0.5"
      />

      {/* Demon face */}
      <ellipse
        cx="16"
        cy="18"
        rx="10"
        ry="9"
        fill={`url(#demonFace-${uniqueId})`}
        stroke="#660022"
        strokeWidth="1"
        filter={`url(#bossGlow-${uniqueId})`}
      />

      {/* Left eye */}
      <ellipse
        cx="12"
        cy="16"
        rx="2.5"
        ry="3"
        fill={`url(#eyeGlow-${uniqueId})`}
      />
      <ellipse cx="12" cy="16" rx="1" ry="1.5" fill="#000000" />

      {/* Right eye */}
      <ellipse
        cx="20"
        cy="16"
        rx="2.5"
        ry="3"
        fill={`url(#eyeGlow-${uniqueId})`}
      />
      <ellipse cx="20" cy="16" rx="1" ry="1.5" fill="#000000" />

      {/* Angry eyebrows */}
      <path
        d="M9 13 L14 14"
        stroke="#440011"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M23 13 L18 14"
        stroke="#440011"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Mouth with fangs */}
      <path
        d="M11 22 Q16 26 21 22"
        fill="none"
        stroke="#440011"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Left fang */}
      <path
        d="M12 22 L12 25"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Right fang */}
      <path
        d="M20 22 L20 25"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
