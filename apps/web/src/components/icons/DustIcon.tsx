interface DustIconProps {
  size?: number;
  className?: string;
}

export function DustIcon({ size = 20, className = '' }: DustIconProps) {
  // Generate unique IDs for gradients/filters to avoid conflicts
  const uniqueId = `dust-${Math.random().toString(36).slice(2, 11)}`;
  
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
        {/* Main crystal gradient - premium purple to pink */}
        <linearGradient id={`crystalGradient-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="30%" stopColor="#c026d3" />
          <stop offset="70%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>

        {/* Inner glow gradient */}
        <radialGradient id={`innerGlow-${uniqueId}`} cx="50%" cy="50%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#f59e0b" stopOpacity="0.6" />
          <stop offset="70%" stopColor="#c026d3" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.2" />
        </radialGradient>

        {/* Outer glow for particles */}
        <radialGradient id={`particleGlow-${uniqueId}`} cx="50%" cy="50%">
          <stop offset="0%" stopColor="#f0abfc" stopOpacity="1" />
          <stop offset="50%" stopColor="#e879f9" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#d946ef" stopOpacity="0.4" />
        </radialGradient>

        {/* Crystal shine gradient */}
        <linearGradient id={`shine-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {/* Strong glow filter for crystal */}
        <filter id={`crystalGlow-${uniqueId}`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {/* Sparkle filter for particles */}
        <filter id={`sparkle-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.8" />
          <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1.5 0" />
        </filter>

        {/* Outer glow filter */}
        <filter id={`outerGlow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feOffset in="blur" dx="0" dy="0" result="offsetBlur" />
          <feMerge>
            <feMergeNode in="offsetBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer glow ring */}
      <circle
        cx="16"
        cy="16"
        r="14"
        fill={`url(#particleGlow-${uniqueId})`}
        opacity="0.2"
        filter={`url(#outerGlow-${uniqueId})`}
      />

      {/* Main crystal body - diamond/gem shape */}
      <path
        d="M16 6 L22 12 L16 26 L10 12 Z"
        fill={`url(#crystalGradient-${uniqueId})`}
        filter={`url(#crystalGlow-${uniqueId})`}
        stroke="#9333ea"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />

      {/* Inner glow core */}
      <circle
        cx="16"
        cy="16"
        r="5"
        fill={`url(#innerGlow-${uniqueId})`}
        opacity="0.8"
      />

      {/* Crystal shine/highlight */}
      <path
        d="M16 6 L20 12 L16 18 L12 12 Z"
        fill={`url(#shine-${uniqueId})`}
        opacity="0.6"
      />

      {/* Top highlight line */}
      <line
        x1="16"
        y1="6"
        x2="16"
        y2="12"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />

      {/* Side highlight lines */}
      <line
        x1="20"
        y1="12"
        x2="16"
        y2="16"
        stroke="white"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.5"
      />
      <line
        x1="12"
        y1="12"
        x2="16"
        y2="16"
        stroke="white"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.5"
      />

      {/* Floating dust particles around crystal - premium effect */}
      <circle cx="8" cy="10" r="1.2" fill="#f0abfc" filter={`url(#sparkle-${uniqueId})`} opacity="0.95" />
      <circle cx="24" cy="10" r="1" fill="#a5f3fc" filter={`url(#sparkle-${uniqueId})`} opacity="0.9" />
      <circle cx="6" cy="16" r="0.9" fill="#e879f9" filter={`url(#sparkle-${uniqueId})`} opacity="0.85" />
      <circle cx="26" cy="16" r="1.1" fill="#67e8f9" filter={`url(#sparkle-${uniqueId})`} opacity="0.9" />
      <circle cx="8" cy="22" r="1" fill="#f5d0fe" filter={`url(#sparkle-${uniqueId})`} opacity="0.9" />
      <circle cx="24" cy="22" r="1.2" fill="#d946ef" filter={`url(#sparkle-${uniqueId})`} opacity="0.95" />
      <circle cx="10" cy="8" r="0.8" fill="#22d3ee" filter={`url(#sparkle-${uniqueId})`} opacity="0.8" />
      <circle cx="22" cy="8" r="0.9" fill="#f472b6" filter={`url(#sparkle-${uniqueId})`} opacity="0.85" />
      <circle cx="5" cy="20" r="0.7" fill="#c084fc" filter={`url(#sparkle-${uniqueId})`} opacity="0.75" />
      <circle cx="27" cy="20" r="0.8" fill="#a78bfa" filter={`url(#sparkle-${uniqueId})`} opacity="0.8" />
    </svg>
  );
}
