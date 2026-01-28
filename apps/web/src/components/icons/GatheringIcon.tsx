export interface GatheringIconProps {
  size?: number;
  className?: string;
}

export function GatheringIcon({ size = 24, className = '' }: GatheringIconProps) {
  const uniqueId = `gathering-${Math.random().toString(36).slice(2, 11)}`;

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
        {/* Pickaxe handle */}
        <linearGradient id={`handle-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B4513" />
          <stop offset="50%" stopColor="#6B3510" />
          <stop offset="100%" stopColor="#4B2508" />
        </linearGradient>

        {/* Metal head */}
        <linearGradient id={`metal-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#C0C0C0" />
          <stop offset="50%" stopColor="#A0A0A0" />
          <stop offset="100%" stopColor="#707070" />
        </linearGradient>

        {/* Gem colors */}
        <linearGradient id={`gem1-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00FF88" />
          <stop offset="100%" stopColor="#00AA55" />
        </linearGradient>

        <linearGradient id={`gem2-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFAA00" />
          <stop offset="100%" stopColor="#CC7700" />
        </linearGradient>

        {/* Glow filter */}
        <filter id={`gatherGlow-${uniqueId}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer glow */}
      <circle cx="16" cy="16" r="14" fill="#00FF88" opacity="0.15" />

      {/* Pickaxe handle */}
      <rect
        x="14"
        y="10"
        width="4"
        height="18"
        rx="1"
        fill={`url(#handle-${uniqueId})`}
        stroke="#3B1F08"
        strokeWidth="0.5"
        transform="rotate(-30 16 19)"
      />

      {/* Pickaxe head */}
      <path
        d="M8 8 L16 4 L24 8 L22 10 L16 8 L10 10 Z"
        fill={`url(#metal-${uniqueId})`}
        stroke="#505050"
        strokeWidth="0.8"
        filter={`url(#gatherGlow-${uniqueId})`}
      />

      {/* Metal shine */}
      <path
        d="M10 7 L16 5 L14 7"
        fill="#FFFFFF"
        opacity="0.5"
      />

      {/* Gathered gems at bottom */}
      {/* Green gem */}
      <path
        d="M6 26 L8 22 L10 26 L8 28 Z"
        fill={`url(#gem1-${uniqueId})`}
        stroke="#008844"
        strokeWidth="0.5"
      />

      {/* Orange gem */}
      <path
        d="M12 28 L14 24 L16 28 L14 30 Z"
        fill={`url(#gem2-${uniqueId})`}
        stroke="#996600"
        strokeWidth="0.5"
      />

      {/* Blue gem */}
      <path
        d="M20 26 L22 23 L24 26 L22 29 Z"
        fill="#4488FF"
        stroke="#2255CC"
        strokeWidth="0.5"
      />

      {/* Sparkles */}
      <circle cx="8" cy="24" r="1" fill="#FFFFFF" opacity="0.9" />
      <circle cx="22" cy="25" r="0.8" fill="#AAFFFF" opacity="0.8" />
      <circle cx="14" cy="26" r="0.7" fill="#FFDD88" opacity="0.85" />
    </svg>
  );
}
