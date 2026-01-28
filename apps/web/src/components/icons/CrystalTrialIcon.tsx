export interface CrystalTrialIconProps {
  size?: number;
  className?: string;
}

export function CrystalTrialIcon({ size = 24, className = '' }: CrystalTrialIconProps) {
  const uniqueId = `crystal-trial-${Math.random().toString(36).slice(2, 11)}`;

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
        {/* Crystal gradient - cyan/blue */}
        <linearGradient id={`crystalMain-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00FFFF" />
          <stop offset="40%" stopColor="#00CCFF" />
          <stop offset="70%" stopColor="#0088FF" />
          <stop offset="100%" stopColor="#0055CC" />
        </linearGradient>

        {/* Left facet */}
        <linearGradient id={`crystalLeft-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0088CC" />
          <stop offset="100%" stopColor="#004488" />
        </linearGradient>

        {/* Right facet */}
        <linearGradient id={`crystalRight-${uniqueId}`} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#66FFFF" />
          <stop offset="50%" stopColor="#33CCFF" />
          <stop offset="100%" stopColor="#0099CC" />
        </linearGradient>

        {/* Shine */}
        <linearGradient id={`shine-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#00FFFF" stopOpacity="0" />
        </linearGradient>

        {/* Glow filter */}
        <filter id={`crystalGlow-${uniqueId}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer glow */}
      <ellipse cx="16" cy="16" rx="14" ry="14" fill="#00CCFF" opacity="0.25" />

      {/* Main crystal body */}
      <path
        d="M16 2 L24 10 L24 22 L16 30 L8 22 L8 10 Z"
        fill={`url(#crystalMain-${uniqueId})`}
        stroke="#0055AA"
        strokeWidth="0.8"
        filter={`url(#crystalGlow-${uniqueId})`}
      />

      {/* Left dark facet */}
      <path
        d="M16 2 L8 10 L8 22 L16 16 Z"
        fill={`url(#crystalLeft-${uniqueId})`}
        opacity="0.9"
      />

      {/* Right light facet */}
      <path
        d="M16 2 L24 10 L24 22 L16 16 Z"
        fill={`url(#crystalRight-${uniqueId})`}
        opacity="0.85"
      />

      {/* Bottom facet */}
      <path
        d="M8 22 L16 30 L24 22 L16 16 Z"
        fill="#003366"
        opacity="0.7"
      />

      {/* Inner highlight */}
      <ellipse
        cx="14"
        cy="12"
        rx="3"
        ry="4"
        fill={`url(#shine-${uniqueId})`}
      />

      {/* Top shine */}
      <path
        d="M12 6 L16 3 L20 6"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.9"
      />

      {/* Sparkles */}
      <circle cx="11" cy="8" r="1.5" fill="#FFFFFF" opacity="0.95" />
      <circle cx="21" cy="14" r="1.2" fill="#99FFFF" opacity="0.9" />
      <circle cx="12" cy="20" r="1" fill="#66CCFF" opacity="0.8" />

      {/* Rotating energy ring suggestion */}
      <ellipse
        cx="16"
        cy="16"
        rx="12"
        ry="4"
        fill="none"
        stroke="#00FFFF"
        strokeWidth="0.8"
        strokeDasharray="4 3"
        opacity="0.5"
        transform="rotate(-15 16 16)"
      />
    </svg>
  );
}
