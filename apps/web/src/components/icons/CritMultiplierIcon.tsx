export interface CritMultiplierIconProps {
  size?: number;
  className?: string;
  style?: Record<string, string | number>;
}

export function CritMultiplierIcon({ size = 20, className = '', style }: CritMultiplierIconProps) {
  const uniqueId = `critmult-${Math.random().toString(36).slice(2, 11)}`;
  
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
        <radialGradient id={`skullGradient-${uniqueId}`} cx="50%" cy="50%">
          <stop offset="0%" stopColor="#6b7280" />
          <stop offset="30%" stopColor="#4b5563" />
          <stop offset="70%" stopColor="#374151" />
          <stop offset="100%" stopColor="#1f2937" />
        </radialGradient>
        <radialGradient id={`skullGlow-${uniqueId}`} cx="50%" cy="50%">
          <stop offset="0%" stopColor="#9ca3af" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#4b5563" stopOpacity="0.2" />
        </radialGradient>
        <linearGradient id={`skullShine-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#9ca3af" stopOpacity="0.2" />
        </linearGradient>
        <filter id={`skullGlow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <circle cx="16" cy="16" r="14" fill={`url(#skullGlow-${uniqueId})`} opacity="0.2" />
      {/* Skull shape */}
      <ellipse
        cx="16"
        cy="14"
        rx="7"
        ry="8"
        fill={`url(#skullGradient-${uniqueId})`}
        filter={`url(#skullGlow-${uniqueId})`}
        stroke="#1f2937"
        strokeWidth="0.5"
      />
      {/* Eye sockets */}
      <circle cx="13" cy="12" r="1.5" fill="#1f2937" />
      <circle cx="19" cy="12" r="1.5" fill="#1f2937" />
      {/* Nose */}
      <path
        d="M16 15 L14 17 L16 17 Z"
        fill="#1f2937"
      />
      {/* Jaw */}
      <path
        d="M9 20 Q9 24, 12 24 Q16 24, 20 24 Q23 24, 23 20 Q23 22, 20 22 Q16 22, 12 22 Q9 22, 9 20 Z"
        fill={`url(#skullGradient-${uniqueId})`}
        stroke="#1f2937"
        strokeWidth="0.5"
      />
      {/* Shine highlight */}
      <ellipse
        cx="14"
        cy="11"
        rx="2"
        ry="1.5"
        fill={`url(#skullShine-${uniqueId})`}
        opacity="0.5"
      />
    </svg>
  );
}
