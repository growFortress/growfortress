export interface SpeedIconProps {
  size?: number;
  className?: string;
  style?: Record<string, string | number>;
}

export function SpeedIcon({ size = 20, className = '', style }: SpeedIconProps) {
  const uniqueId = `speed-${Math.random().toString(36).slice(2, 11)}`;
  
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
        <linearGradient id={`boltGradient-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <radialGradient id={`boltGlow-${uniqueId}`} cx="50%" cy="50%">
          <stop offset="0%" stopColor="#fef3c7" stopOpacity="1" />
          <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.2" />
        </radialGradient>
        <linearGradient id={`boltShine-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="100%" stopColor="#fef3c7" stopOpacity="0.5" />
        </linearGradient>
        <filter id={`boltGlow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id={`sparkle-${uniqueId}`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="0.5" />
          <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 2 0" />
        </filter>
      </defs>
      <circle cx="16" cy="16" r="14" fill={`url(#boltGlow-${uniqueId})`} opacity="0.3" />
      {/* Lightning bolt */}
      <path
        d="M16 6 L20 16 L14 16 L18 26 L12 16 L16 6 Z"
        fill={`url(#boltGradient-${uniqueId})`}
        filter={`url(#boltGlow-${uniqueId})`}
        stroke="#d97706"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
      {/* Bolt shine */}
      <path
        d="M16 6 L19 14 L15 14 L18 22 L13 16 L16 6 Z"
        fill={`url(#boltShine-${uniqueId})`}
        opacity="0.7"
      />
      {/* Small sparks */}
      <circle cx="8" cy="12" r="0.8" fill="#fef3c7" filter={`url(#sparkle-${uniqueId})`} opacity="0.9" />
      <circle cx="24" cy="12" r="0.7" fill="#fbbf24" filter={`url(#sparkle-${uniqueId})`} opacity="0.85" />
      <circle cx="10" cy="20" r="0.6" fill="#f59e0b" filter={`url(#sparkle-${uniqueId})`} opacity="0.8" />
      <circle cx="22" cy="20" r="0.9" fill="#fef3c7" filter={`url(#sparkle-${uniqueId})`} opacity="0.95" />
    </svg>
  );
}
