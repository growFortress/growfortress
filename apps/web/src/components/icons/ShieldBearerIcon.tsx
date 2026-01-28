export interface ShieldBearerIconProps {
  size?: number;
  className?: string;
  style?: Record<string, string | number>;
}

/**
 * Shield Bearer Heavy Mech Icon
 * Based on in-game visual: Purple bulky mech with armored body, legs, and energy shield
 * Colors: Primary #221133, Secondary #8800ff, Weapon #cc88ff
 */
export function ShieldBearerIcon({ size = 32, className = '', style }: ShieldBearerIconProps) {
  const id = `shieldb-${Math.random().toString(36).slice(2, 11)}`;

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
        {/* Purple glow gradient */}
        <radialGradient id={`glow-${id}`} cx="50%" cy="50%">
          <stop offset="0%" stopColor="#8800ff" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#8800ff" stopOpacity="0" />
        </radialGradient>
        {/* Body gradient */}
        <linearGradient id={`body-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#332244" />
          <stop offset="50%" stopColor="#221133" />
          <stop offset="100%" stopColor="#110022" />
        </linearGradient>
        {/* Shield energy gradient */}
        <linearGradient id={`shield-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#cc88ff" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#aa66ff" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#8800ff" stopOpacity="0.4" />
        </linearGradient>
        {/* Visor gradient */}
        <linearGradient id={`visor-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#bb99ff" />
          <stop offset="100%" stopColor="#8800ff" />
        </linearGradient>
        {/* Glow filter */}
        <filter id={`filter-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        {/* Shield glow filter */}
        <filter id={`shieldGlow-${id}`} x="-100%" y="-50%" width="300%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Energy shield arc (front) */}
      <path
        d="M 4 6 Q 0 14, 4 22"
        fill="none"
        stroke={`url(#shield-${id})`}
        strokeWidth="4"
        strokeLinecap="round"
        filter={`url(#shieldGlow-${id})`}
      />
      <path
        d="M 4 6 Q 0 14, 4 22"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.4"
      />

      {/* Main body - boxy armored torso */}
      <rect
        x="8"
        y="4"
        width="18"
        height="16"
        rx="3"
        fill={`url(#body-${id})`}
        stroke="#8800ff"
        strokeWidth="2"
        filter={`url(#filter-${id})`}
      />

      {/* Armored visor */}
      <rect
        x="11"
        y="7"
        width="12"
        height="5"
        rx="2"
        fill={`url(#visor-${id})`}
        opacity="0.8"
      />
      {/* Visor glow dots */}
      <circle cx="14" cy="9.5" r="1" fill="#ffffff" opacity="0.9" />
      <circle cx="20" cy="9.5" r="1" fill="#ffffff" opacity="0.9" />

      {/* Left shoulder armor */}
      <rect
        x="4"
        y="6"
        width="5"
        height="8"
        rx="2"
        fill="#8800ff"
        opacity="0.7"
      />

      {/* Right shoulder armor */}
      <rect
        x="25"
        y="6"
        width="5"
        height="8"
        rx="2"
        fill="#8800ff"
        opacity="0.7"
      />

      {/* Left leg */}
      <rect
        x="10"
        y="20"
        width="5"
        height="8"
        rx="2"
        fill={`url(#body-${id})`}
        stroke="#8800ff"
        strokeWidth="1"
      />

      {/* Right leg */}
      <rect
        x="19"
        y="20"
        width="5"
        height="8"
        rx="2"
        fill={`url(#body-${id})`}
        stroke="#8800ff"
        strokeWidth="1"
      />

      {/* Chest detail lines */}
      <line x1="17" y1="13" x2="17" y2="18" stroke="#8800ff" strokeWidth="1" opacity="0.5" />
      <line x1="14" y1="15" x2="20" y2="15" stroke="#8800ff" strokeWidth="0.5" opacity="0.4" />

      {/* Knee joints */}
      <circle cx="12.5" cy="21" r="1.5" fill="#8800ff" opacity="0.6" />
      <circle cx="21.5" cy="21" r="1.5" fill="#8800ff" opacity="0.6" />

      {/* Foot accents */}
      <rect x="9" y="26" width="7" height="2" rx="1" fill="#8800ff" opacity="0.5" />
      <rect x="18" y="26" width="7" height="2" rx="1" fill="#8800ff" opacity="0.5" />
    </svg>
  );
}
