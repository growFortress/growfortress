export interface DodgeIconProps {
  size?: number;
  className?: string;
  style?: Record<string, string | number>;
}

export function DodgeIcon({ size = 20, className = '', style }: DodgeIconProps) {
  const uniqueId = `dodge-${Math.random().toString(36).slice(2, 11)}`;
  
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
        <linearGradient id={`windGradient-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="50%" stopColor="#0891b2" />
          <stop offset="100%" stopColor="#0e7490" />
        </linearGradient>
        <radialGradient id={`windGlow-${uniqueId}`} cx="50%" cy="50%">
          <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.2" />
        </radialGradient>
        <linearGradient id={`windShine-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#67e8f9" stopOpacity="0.3" />
        </linearGradient>
        <filter id={`windGlow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id={`sparkle-${uniqueId}`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="0.5" />
          <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 2 0" />
        </filter>
      </defs>
      <circle cx="16" cy="16" r="14" fill={`url(#windGlow-${uniqueId})`} opacity="0.2" />
      {/* Wind/speed lines */}
      <path
        d="M6 12 Q10 14, 14 12 Q18 10, 22 12 Q26 14, 28 12"
        stroke={`url(#windGradient-${uniqueId})`}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        filter={`url(#windGlow-${uniqueId})`}
      />
      <path
        d="M4 18 Q10 20, 16 18 Q22 16, 28 18"
        stroke={`url(#windGradient-${uniqueId})`}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        filter={`url(#windGlow-${uniqueId})`}
      />
      <path
        d="M8 22 Q14 24, 20 22 Q24 20, 26 22"
        stroke={`url(#windGradient-${uniqueId})`}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        filter={`url(#windGlow-${uniqueId})`}
      />
      {/* Wind particles */}
      <circle cx="10" cy="10" r="0.8" fill="#67e8f9" filter={`url(#sparkle-${uniqueId})`} opacity="0.9" />
      <circle cx="22" cy="14" r="0.7" fill="#06b6d4" filter={`url(#sparkle-${uniqueId})`} opacity="0.85" />
      <circle cx="12" cy="20" r="0.6" fill="#22d3ee" filter={`url(#sparkle-${uniqueId})`} opacity="0.8" />
      <circle cx="24" cy="20" r="0.9" fill="#67e8f9" filter={`url(#sparkle-${uniqueId})`} opacity="0.95" />
    </svg>
  );
}
