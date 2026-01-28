export interface CritChanceIconProps {
  size?: number;
  className?: string;
  style?: Record<string, string | number>;
}

export function CritChanceIcon({ size = 20, className = '', style }: CritChanceIconProps) {
  const uniqueId = `crit-${Math.random().toString(36).slice(2, 11)}`;
  
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
        <radialGradient id={`explosionGradient-${uniqueId}`} cx="50%" cy="50%">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="30%" stopColor="#ea580c" />
          <stop offset="70%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#991b1b" />
        </radialGradient>
        <radialGradient id={`explosionGlow-${uniqueId}`} cx="50%" cy="50%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="1" />
          <stop offset="50%" stopColor="#f97316" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#ea580c" stopOpacity="0.3" />
        </radialGradient>
        <linearGradient id={`explosionShine-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.5" />
        </linearGradient>
        <filter id={`explosionGlow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id={`sparkle-${uniqueId}`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="0.5" />
          <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 2 0" />
        </filter>
      </defs>
      <circle cx="16" cy="16" r="14" fill={`url(#explosionGlow-${uniqueId})`} opacity="0.3" />
      {/* Explosion burst */}
      <path
        d="M16 16 L20 8 L16 12 L12 8 Z M16 16 L24 12 L20 16 L24 20 Z M16 16 L20 24 L16 20 L12 24 Z M16 16 L8 20 L12 16 L8 12 Z"
        fill={`url(#explosionGradient-${uniqueId})`}
        filter={`url(#explosionGlow-${uniqueId})`}
        stroke="#991b1b"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
      {/* Center core */}
      <circle
        cx="16"
        cy="16"
        r="3"
        fill={`url(#explosionShine-${uniqueId})`}
        opacity="0.9"
      />
      {/* Sparkles */}
      <circle cx="10" cy="10" r="0.8" fill="#fbbf24" filter={`url(#sparkle-${uniqueId})`} opacity="0.9" />
      <circle cx="22" cy="10" r="0.7" fill="#f97316" filter={`url(#sparkle-${uniqueId})`} opacity="0.85" />
      <circle cx="10" cy="22" r="0.6" fill="#ea580c" filter={`url(#sparkle-${uniqueId})`} opacity="0.8" />
      <circle cx="22" cy="22" r="0.9" fill="#fbbf24" filter={`url(#sparkle-${uniqueId})`} opacity="0.95" />
    </svg>
  );
}
