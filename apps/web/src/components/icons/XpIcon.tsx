export interface XpIconProps {
  size?: number;
  className?: string;
  style?: Record<string, string | number>;
}

export function XpIcon({ size = 20, className = '', style }: XpIconProps) {
  // Generate unique IDs for gradients/filters to avoid conflicts
  const uniqueId = `xp-${Math.random().toString(36).slice(2, 11)}`;
  
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
        {/* Main star gradient - experience gold to orange */}
        <radialGradient id={`starGradient-${uniqueId}`} cx="50%" cy="40%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="30%" stopColor="#f59e0b" />
          <stop offset="60%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#b45309" />
        </radialGradient>

        {/* Inner experience glow */}
        <radialGradient id={`xpGlow-${uniqueId}`} cx="50%" cy="50%">
          <stop offset="0%" stopColor="#fef3c7" stopOpacity="1" />
          <stop offset="40%" stopColor="#fde68a" stopOpacity="0.8" />
          <stop offset="70%" stopColor="#fbbf24" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.2" />
        </radialGradient>

        {/* Star shine gradient */}
        <linearGradient id={`starShine-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="50%" stopColor="#fef3c7" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.4" />
        </linearGradient>

        {/* Level badge gradient */}
        <linearGradient id={`badgeGradient-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#fef3c7" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#fde68a" stopOpacity="0.3" />
        </linearGradient>

        {/* Outer experience glow */}
        <radialGradient id={`xpOuterGlow-${uniqueId}`} cx="50%" cy="50%">
          <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.4" />
          <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>

        {/* Star glow filter */}
        <filter id={`starGlow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {/* Sparkle filter */}
        <filter id={`sparkle-${uniqueId}`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="0.5" />
          <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 2 0" />
        </filter>

        {/* Outer glow filter */}
        <filter id={`outerGlow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feOffset in="blur" dx="0" dy="0" result="offsetBlur" />
          <feMerge>
            <feMergeNode in="offsetBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer experience glow ring */}
      <circle
        cx="16"
        cy="16"
        r="15"
        fill={`url(#xpOuterGlow-${uniqueId})`}
        filter={`url(#outerGlow-${uniqueId})`}
      />

      {/* Main star - 5-pointed experience star */}
      <path
        d="M16 4 L19 12 L27 12 L20.5 17 L23 25 L16 20 L9 25 L11.5 17 L5 12 L13 12 Z"
        fill={`url(#starGradient-${uniqueId})`}
        filter={`url(#starGlow-${uniqueId})`}
        stroke="#92400e"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />

      {/* Inner glow core */}
      <circle
        cx="16"
        cy="16"
        r="6"
        fill={`url(#xpGlow-${uniqueId})`}
        opacity="0.7"
      />

      {/* Star shine highlight */}
      <path
        d="M16 4 L18 10 L16 14 L14 10 Z"
        fill={`url(#starShine-${uniqueId})`}
        opacity="0.8"
      />

      {/* Level badge circle in center */}
      <circle
        cx="16"
        cy="16"
        r="4"
        fill={`url(#badgeGradient-${uniqueId})`}
        stroke="#fbbf24"
        strokeWidth="0.5"
        opacity="0.9"
      />

      {/* Level indicator - "L" or level mark */}
      <path
        d="M13 14 L13 18 L15 18 L15 16 L17 16 L17 14 Z"
        fill="#d97706"
        opacity="0.8"
      />

      {/* Small sparkles around star */}
      <circle cx="8" cy="8" r="0.8" fill="#fef3c7" filter={`url(#sparkle-${uniqueId})`} opacity="0.9" />
      <circle cx="24" cy="8" r="0.7" fill="#fde68a" filter={`url(#sparkle-${uniqueId})`} opacity="0.85" />
      <circle cx="6" cy="16" r="0.6" fill="#fbbf24" filter={`url(#sparkle-${uniqueId})`} opacity="0.8" />
      <circle cx="26" cy="16" r="0.9" fill="#fef3c7" filter={`url(#sparkle-${uniqueId})`} opacity="0.95" />
      <circle cx="8" cy="24" r="0.7" fill="#fde68a" filter={`url(#sparkle-${uniqueId})`} opacity="0.85" />
      <circle cx="24" cy="24" r="0.8" fill="#fef3c7" filter={`url(#sparkle-${uniqueId})`} opacity="0.9" />

      {/* Progress rings - experience progression */}
      <circle
        cx="16"
        cy="16"
        r="7"
        fill="none"
        stroke="#fbbf24"
        strokeWidth="0.3"
        opacity="0.4"
      />
      <circle
        cx="16"
        cy="16"
        r="8.5"
        fill="none"
        stroke="#f59e0b"
        strokeWidth="0.3"
        opacity="0.3"
      />
    </svg>
  );
}
