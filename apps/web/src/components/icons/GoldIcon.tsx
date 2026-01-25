export interface GoldIconProps {
  size?: number;
  className?: string;
  style?: Record<string, string | number>;
}

export function GoldIcon({ size = 20, className = '', style }: GoldIconProps) {
  // Generate unique IDs for gradients/filters to avoid conflicts
  const uniqueId = `gold-${Math.random().toString(36).slice(2, 11)}`;
  
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
        {/* Main coin gradient - cosmic gold */}
        <radialGradient id={`coinGradient-${uniqueId}`} cx="40%" cy="30%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="30%" stopColor="#f59e0b" />
          <stop offset="60%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#b45309" />
        </radialGradient>

        {/* Inner cosmic glow */}
        <radialGradient id={`cosmicGlow-${uniqueId}`} cx="50%" cy="50%">
          <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#fde68a" stopOpacity="0.6" />
          <stop offset="70%" stopColor="#fbbf24" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.1" />
        </radialGradient>

        {/* Star glow gradient */}
        <radialGradient id={`starGlow-${uniqueId}`} cx="50%" cy="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="50%" stopColor="#fef3c7" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.4" />
        </radialGradient>

        {/* Metallic shine */}
        <linearGradient id={`shine-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="30%" stopColor="#fef3c7" stopOpacity="0.6" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {/* Outer space glow */}
        <radialGradient id={`spaceGlow-${uniqueId}`} cx="50%" cy="50%">
          <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.3" />
          <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>

        {/* Coin glow filter */}
        <filter id={`coinGlow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {/* Star sparkle filter */}
        <filter id={`starSparkle-${uniqueId}`} x="-100%" y="-100%" width="300%" height="300%">
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

      {/* Outer cosmic glow ring */}
      <circle
        cx="16"
        cy="16"
        r="15"
        fill={`url(#spaceGlow-${uniqueId})`}
        filter={`url(#outerGlow-${uniqueId})`}
      />

      {/* Main coin body - circular with cosmic design */}
      <circle
        cx="16"
        cy="16"
        r="11"
        fill={`url(#coinGradient-${uniqueId})`}
        filter={`url(#coinGlow-${uniqueId})`}
        stroke="#92400e"
        strokeWidth="0.5"
      />

      {/* Inner cosmic glow */}
      <circle
        cx="16"
        cy="16"
        r="8"
        fill={`url(#cosmicGlow-${uniqueId})`}
        opacity="0.7"
      />

      {/* Metallic shine highlight */}
      <ellipse
        cx="12"
        cy="12"
        rx="6"
        ry="4"
        fill={`url(#shine-${uniqueId})`}
        opacity="0.8"
        transform="rotate(-30 16 16)"
      />

      {/* Central star symbol - interstellar currency mark */}
      <path
        d="M16 8 L17.5 13 L23 13 L18.5 16.5 L20 22 L16 18.5 L12 22 L13.5 16.5 L9 13 L14.5 13 Z"
        fill={`url(#starGlow-${uniqueId})`}
        filter={`url(#starSparkle-${uniqueId})`}
        stroke="#fef3c7"
        strokeWidth="0.3"
        strokeLinejoin="round"
      />

      {/* Inner circle detail */}
      <circle
        cx="16"
        cy="16"
        r="5"
        fill="none"
        stroke="#fef3c7"
        strokeWidth="0.4"
        opacity="0.6"
      />

      {/* Orbital rings - cosmic detail */}
      <ellipse
        cx="16"
        cy="16"
        rx="9"
        ry="3"
        fill="none"
        stroke="#fbbf24"
        strokeWidth="0.3"
        opacity="0.4"
        transform="rotate(45 16 16)"
      />
      <ellipse
        cx="16"
        cy="16"
        rx="9"
        ry="3"
        fill="none"
        stroke="#fbbf24"
        strokeWidth="0.3"
        opacity="0.4"
        transform="rotate(-45 16 16)"
      />

      {/* Small stars around coin - interstellar theme */}
      <circle cx="6" cy="8" r="0.8" fill="#fef3c7" filter={`url(#starSparkle-${uniqueId})`} opacity="0.9" />
      <circle cx="26" cy="8" r="0.7" fill="#fde68a" filter={`url(#starSparkle-${uniqueId})`} opacity="0.85" />
      <circle cx="4" cy="16" r="0.6" fill="#fbbf24" filter={`url(#starSparkle-${uniqueId})`} opacity="0.8" />
      <circle cx="28" cy="16" r="0.9" fill="#fef3c7" filter={`url(#starSparkle-${uniqueId})`} opacity="0.95" />
      <circle cx="6" cy="24" r="0.7" fill="#fde68a" filter={`url(#starSparkle-${uniqueId})`} opacity="0.85" />
      <circle cx="26" cy="24" r="0.8" fill="#fef3c7" filter={`url(#starSparkle-${uniqueId})`} opacity="0.9" />

      {/* Top highlight for 3D effect */}
      <ellipse
        cx="16"
        cy="10"
        rx="3"
        ry="1.5"
        fill="white"
        opacity="0.5"
      />
    </svg>
  );
}
