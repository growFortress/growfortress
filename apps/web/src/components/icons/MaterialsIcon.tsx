export interface MaterialsIconProps {
  size?: number;
  className?: string;
}

export function MaterialsIcon({ size = 24, className = '' }: MaterialsIconProps) {
  const uniqueId = `materials-${Math.random().toString(36).slice(2, 11)}`;

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
        {/* Box gradient - brown/orange crate */}
        <linearGradient id={`box-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#DDA050" />
          <stop offset="50%" stopColor="#CC8833" />
          <stop offset="100%" stopColor="#996622" />
        </linearGradient>

        {/* Box side gradient */}
        <linearGradient id={`boxSide-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#AA6622" />
          <stop offset="100%" stopColor="#885511" />
        </linearGradient>

        {/* Box top */}
        <linearGradient id={`boxTop-${uniqueId}`} x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#EEBB66" />
          <stop offset="100%" stopColor="#CC9944" />
        </linearGradient>

        {/* Glow filter */}
        <filter id={`boxGlow-${uniqueId}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer glow */}
      <rect x="4" y="8" width="24" height="20" rx="2" fill="#DDA050" opacity="0.2" />

      {/* Box front face */}
      <rect
        x="6"
        y="12"
        width="20"
        height="16"
        rx="1"
        fill={`url(#box-${uniqueId})`}
        stroke="#774411"
        strokeWidth="0.8"
        filter={`url(#boxGlow-${uniqueId})`}
      />

      {/* Box top face (3D effect) */}
      <path
        d="M6 12 L10 6 L26 6 L26 12 Z"
        fill={`url(#boxTop-${uniqueId})`}
        stroke="#885522"
        strokeWidth="0.5"
      />

      {/* Box right side (3D) */}
      <path
        d="M26 6 L30 10 L30 26 L26 28 Z"
        fill={`url(#boxSide-${uniqueId})`}
        stroke="#663311"
        strokeWidth="0.5"
      />

      {/* Horizontal wood planks */}
      <line x1="6" y1="18" x2="26" y2="18" stroke="#664422" strokeWidth="0.8" />
      <line x1="6" y1="24" x2="26" y2="24" stroke="#664422" strokeWidth="0.8" />

      {/* Metal band */}
      <rect x="14" y="12" width="4" height="16" fill="#888888" opacity="0.5" />
      <rect x="15" y="12" width="2" height="16" fill="#AAAAAA" opacity="0.4" />

      {/* Items peeking out - gem */}
      <path
        d="M10 8 L12 6 L14 8 L12 11 Z"
        fill="#FF66AA"
        stroke="#CC4488"
        strokeWidth="0.3"
      />

      {/* Items peeking out - crystal */}
      <path
        d="M20 8 L21 5 L22 8 L21 10 Z"
        fill="#66FFAA"
        stroke="#44CC88"
        strokeWidth="0.3"
      />

      {/* Shine highlight */}
      <ellipse cx="12" cy="16" rx="3" ry="2" fill="#FFFFFF" opacity="0.2" />
    </svg>
  );
}
