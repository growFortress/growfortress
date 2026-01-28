export interface MarksmanIconProps {
  size?: number;
  className?: string;
  style?: Record<string, string | number>;
}

/**
 * Marksman Sniper Drone Icon
 * Based on in-game visual: Orange triangular stealth drone with targeting sensor
 * Colors: Primary #332211, Secondary #ff6600, Weapon #ff3300
 */
export function MarksmanIcon({ size = 32, className = '', style }: MarksmanIconProps) {
  const id = `marksman-${Math.random().toString(36).slice(2, 11)}`;

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
        {/* Orange glow gradient */}
        <radialGradient id={`glow-${id}`} cx="50%" cy="50%">
          <stop offset="0%" stopColor="#ff6600" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#ff6600" stopOpacity="0" />
        </radialGradient>
        {/* Body gradient */}
        <linearGradient id={`body-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#443322" />
          <stop offset="50%" stopColor="#332211" />
          <stop offset="100%" stopColor="#221100" />
        </linearGradient>
        {/* Targeting sensor */}
        <radialGradient id={`target-${id}`} cx="50%" cy="50%">
          <stop offset="0%" stopColor="#ff0000" />
          <stop offset="50%" stopColor="#ff3300" />
          <stop offset="100%" stopColor="#ff6600" />
        </radialGradient>
        {/* Glow filter */}
        <filter id={`filter-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Hover glow effect */}
      <ellipse cx="16" cy="26" rx="7" ry="2.5" fill={`url(#glow-${id})`} opacity="0.5" />

      {/* Stealth body - diamond/arrow shape */}
      <polygon
        points="28,14 10,6 6,14 10,22"
        fill={`url(#body-${id})`}
        stroke="#ff6600"
        strokeWidth="1.5"
        filter={`url(#filter-${id})`}
      />

      {/* Top rear fin */}
      <polygon
        points="10,6 6,3 6,8"
        fill="#ff6600"
        opacity="0.6"
      />

      {/* Bottom rear fin */}
      <polygon
        points="10,22 6,25 6,20"
        fill="#ff6600"
        opacity="0.6"
      />

      {/* Targeting sensor ring */}
      <circle cx="12" cy="14" r="4" fill="#ff6600" opacity="0.4" />
      <circle cx="12" cy="14" r="3" fill={`url(#target-${id})`} opacity="0.8" />

      {/* Crosshair lines */}
      <line x1="12" y1="10" x2="12" y2="18" stroke="#ff0000" strokeWidth="0.5" opacity="0.8" />
      <line x1="8" y1="14" x2="16" y2="14" stroke="#ff0000" strokeWidth="0.5" opacity="0.8" />

      {/* Red targeting dot */}
      <circle cx="12" cy="14" r="1.5" fill="#ff0000" />
      <circle cx="12" cy="14" r="0.8" fill="#ffffff" />

      {/* Laser cannon barrel */}
      <rect x="26" y="12" width="5" height="4" rx="1" fill="#444444" stroke="#ff6600" strokeWidth="0.5" />

      {/* Laser sight line */}
      <line
        x1="31"
        y1="14"
        x2="32"
        y2="14"
        stroke="#ff3300"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.7"
      />

      {/* Detail accents */}
      <line x1="14" y1="10" x2="22" y2="14" stroke="#ff6600" strokeWidth="0.5" opacity="0.3" />
      <line x1="14" y1="18" x2="22" y2="14" stroke="#ff6600" strokeWidth="0.5" opacity="0.3" />
    </svg>
  );
}
