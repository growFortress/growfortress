export interface RangeIconProps {
  size?: number;
  className?: string;
  style?: Record<string, string | number>;
}

export function RangeIcon({ size = 20, className = '', style }: RangeIconProps) {
  const uniqueId = `range-${Math.random().toString(36).slice(2, 11)}`;
  
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
        <radialGradient id={`targetGradient-${uniqueId}`} cx="50%" cy="50%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="50%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1e40af" />
        </radialGradient>
        <radialGradient id={`targetGlow-${uniqueId}`} cx="50%" cy="50%">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.2" />
        </radialGradient>
        <linearGradient id={`targetShine-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.3" />
        </linearGradient>
        <filter id={`targetGlow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <circle cx="16" cy="16" r="14" fill={`url(#targetGlow-${uniqueId})`} opacity="0.2" />
      {/* Outer target ring */}
      <circle
        cx="16"
        cy="16"
        r="11"
        fill="none"
        stroke={`url(#targetGradient-${uniqueId})`}
        strokeWidth="1.5"
        filter={`url(#targetGlow-${uniqueId})`}
      />
      {/* Middle target ring */}
      <circle
        cx="16"
        cy="16"
        r="7"
        fill="none"
        stroke={`url(#targetGradient-${uniqueId})`}
        strokeWidth="1.5"
        filter={`url(#targetGlow-${uniqueId})`}
      />
      {/* Inner target circle */}
      <circle
        cx="16"
        cy="16"
        r="4"
        fill={`url(#targetGradient-${uniqueId})`}
        filter={`url(#targetGlow-${uniqueId})`}
        stroke="#1e40af"
        strokeWidth="0.5"
      />
      {/* Center dot */}
      <circle
        cx="16"
        cy="16"
        r="1.5"
        fill={`url(#targetShine-${uniqueId})`}
        opacity="0.9"
      />
      {/* Crosshairs */}
      <line
        x1="16"
        y1="5"
        x2="16"
        y2="11"
        stroke={`url(#targetGradient-${uniqueId})`}
        strokeWidth="1.5"
        strokeLinecap="round"
        filter={`url(#targetGlow-${uniqueId})`}
      />
      <line
        x1="16"
        y1="21"
        x2="16"
        y2="27"
        stroke={`url(#targetGradient-${uniqueId})`}
        strokeWidth="1.5"
        strokeLinecap="round"
        filter={`url(#targetGlow-${uniqueId})`}
      />
      <line
        x1="5"
        y1="16"
        x2="11"
        y2="16"
        stroke={`url(#targetGradient-${uniqueId})`}
        strokeWidth="1.5"
        strokeLinecap="round"
        filter={`url(#targetGlow-${uniqueId})`}
      />
      <line
        x1="21"
        y1="16"
        x2="27"
        y2="16"
        stroke={`url(#targetGradient-${uniqueId})`}
        strokeWidth="1.5"
        strokeLinecap="round"
        filter={`url(#targetGlow-${uniqueId})`}
      />
    </svg>
  );
}
