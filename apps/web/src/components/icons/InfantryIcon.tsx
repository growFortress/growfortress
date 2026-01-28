export interface InfantryIconProps {
  size?: number;
  className?: string;
  style?: Record<string, string | number>;
}

/**
 * Infantry Combat Drone Icon
 * Based on in-game visual: Cyan hexagonal drone with central sensor and side thrusters
 * Colors: Primary #1a3344, Secondary #00ccff, Glow #00ccff
 */
export function InfantryIcon({ size = 32, className = '', style }: InfantryIconProps) {
  const id = `infantry-${Math.random().toString(36).slice(2, 11)}`;

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
        {/* Cyan glow gradient */}
        <radialGradient id={`glow-${id}`} cx="50%" cy="50%">
          <stop offset="0%" stopColor="#00ccff" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#00ccff" stopOpacity="0" />
        </radialGradient>
        {/* Body gradient */}
        <linearGradient id={`body-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2a4455" />
          <stop offset="50%" stopColor="#1a3344" />
          <stop offset="100%" stopColor="#102030" />
        </linearGradient>
        {/* Sensor glow */}
        <radialGradient id={`sensor-${id}`} cx="50%" cy="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="40%" stopColor="#00ffff" />
          <stop offset="100%" stopColor="#00ccff" />
        </radialGradient>
        {/* Glow filter */}
        <filter id={`filter-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Hover glow effect */}
      <ellipse cx="16" cy="26" rx="8" ry="3" fill={`url(#glow-${id})`} opacity="0.5" />

      {/* Hexagonal main body */}
      <polygon
        points="16,4 24,8 24,18 16,22 8,18 8,8"
        fill={`url(#body-${id})`}
        stroke="#00ccff"
        strokeWidth="1.5"
        filter={`url(#filter-${id})`}
      />

      {/* Left thruster */}
      <rect x="4" y="10" width="4" height="6" rx="1" fill="#00ccff" opacity="0.7" />
      <rect x="5" y="11" width="2" height="4" fill="#00ffff" opacity="0.9" />

      {/* Right thruster */}
      <rect x="24" y="10" width="4" height="6" rx="1" fill="#00ccff" opacity="0.7" />
      <rect x="25" y="11" width="2" height="4" fill="#00ffff" opacity="0.9" />

      {/* Central sensor ring */}
      <circle cx="16" cy="13" r="4" fill="#00ccff" opacity="0.3" />
      <circle cx="16" cy="13" r="3" fill={`url(#sensor-${id})`} />
      <circle cx="16" cy="13" r="1.5" fill="#ffffff" />

      {/* Energy blade weapon */}
      <line
        x1="24"
        y1="13"
        x2="30"
        y2="13"
        stroke="#00ffff"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.9"
      />
      <line
        x1="24"
        y1="13"
        x2="30"
        y2="13"
        stroke="#ffffff"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />

      {/* Detail lines on body */}
      <line x1="12" y1="8" x2="12" y2="18" stroke="#00ccff" strokeWidth="0.5" opacity="0.4" />
      <line x1="20" y1="8" x2="20" y2="18" stroke="#00ccff" strokeWidth="0.5" opacity="0.4" />
    </svg>
  );
}
