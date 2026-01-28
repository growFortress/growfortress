export interface MilitiaIconProps {
  size?: number;
  className?: string;
  style?: Record<string, string | number>;
}

/**
 * Militia Panel Header Icon
 * Represents a squad/group symbol - three unit silhouettes
 * Distinct from individual unit icons
 */
export function MilitiaIcon({ size = 32, className = '', style }: MilitiaIconProps) {
  const id = `militia-${Math.random().toString(36).slice(2, 11)}`;

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
        <linearGradient id={`grad-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#66ddff" />
          <stop offset="50%" stopColor="#00aaff" />
          <stop offset="100%" stopColor="#0066cc" />
        </linearGradient>
        <filter id={`glow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Background circle */}
      <circle cx="16" cy="16" r="14" fill="#0a1520" stroke={`url(#grad-${id})`} strokeWidth="1.5" />

      {/* Left unit - small */}
      <polygon
        points="8,20 6,16 8,12 10,16"
        fill="#00ccff"
        opacity="0.6"
        filter={`url(#glow-${id})`}
      />

      {/* Center unit - large (leader) */}
      <polygon
        points="16,22 12,14 16,6 20,14"
        fill={`url(#grad-${id})`}
        stroke="#00ffff"
        strokeWidth="0.5"
        filter={`url(#glow-${id})`}
      />
      <circle cx="16" cy="12" r="2" fill="#ffffff" opacity="0.9" />

      {/* Right unit - small */}
      <polygon
        points="24,20 22,16 24,12 26,16"
        fill="#00ccff"
        opacity="0.6"
        filter={`url(#glow-${id})`}
      />

      {/* Connection lines (squad formation) */}
      <line x1="10" y1="16" x2="14" y2="14" stroke="#00ccff" strokeWidth="0.5" opacity="0.4" />
      <line x1="22" y1="16" x2="18" y2="14" stroke="#00ccff" strokeWidth="0.5" opacity="0.4" />

      {/* Bottom bar - squad indicator */}
      <rect x="10" y="25" width="12" height="2" rx="1" fill="#00ccff" opacity="0.5" />
    </svg>
  );
}
