interface DustIconProps {
  size?: number;
  className?: string;
}

export function DustIcon({ size = 20, className = '' }: DustIconProps) {
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
        {/* Glass gradient */}
        <linearGradient id="glassGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#bae6fd" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0.4" />
        </linearGradient>

        {/* Glowing dust gradient */}
        <linearGradient id="dustGlow" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#c026d3" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>

        {/* Inner glow filter */}
        <filter id="dustGlowFilter" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {/* Sparkle filter */}
        <filter id="sparkle">
          <feGaussianBlur stdDeviation="0.5" />
        </filter>
      </defs>

      {/* Vial body - glass */}
      <path
        d="M11 8 L11 22 Q11 26 16 26 Q21 26 21 22 L21 8"
        fill="url(#glassGradient)"
        stroke="#94a3b8"
        strokeWidth="0.75"
      />

      {/* Vial neck */}
      <rect x="12" y="4" width="8" height="5" rx="1" fill="url(#glassGradient)" stroke="#94a3b8" strokeWidth="0.75" />

      {/* Cork/stopper */}
      <rect x="12.5" y="2" width="7" height="3" rx="1" fill="#a16207" stroke="#854d0e" strokeWidth="0.5" />
      <rect x="13" y="2.5" width="2" height="2" rx="0.5" fill="#ca8a04" opacity="0.6" />

      {/* Glowing dust liquid */}
      <path
        d="M12 12 L12 21.5 Q12 24.5 16 24.5 Q20 24.5 20 21.5 L20 12 Q18 14 16 13 Q14 12 12 12"
        fill="url(#dustGlow)"
        filter="url(#dustGlowFilter)"
        opacity="0.9"
      />

      {/* Dust particles */}
      <circle cx="14" cy="16" r="1" fill="#f0abfc" filter="url(#sparkle)" opacity="0.9" />
      <circle cx="18" cy="18" r="0.8" fill="#67e8f9" filter="url(#sparkle)" opacity="0.9" />
      <circle cx="15" cy="20" r="0.6" fill="#e879f9" filter="url(#sparkle)" opacity="0.8" />
      <circle cx="17" cy="14" r="0.7" fill="#a5f3fc" filter="url(#sparkle)" opacity="0.85" />
      <circle cx="16" cy="22" r="0.5" fill="#f5d0fe" filter="url(#sparkle)" opacity="0.75" />
      <circle cx="14.5" cy="18.5" r="0.4" fill="#22d3ee" filter="url(#sparkle)" opacity="0.8" />
      <circle cx="17.5" cy="21" r="0.55" fill="#d946ef" filter="url(#sparkle)" opacity="0.85" />

      {/* Glass highlight */}
      <path
        d="M13 9 L13 20 Q13 22 14 23"
        fill="none"
        stroke="white"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.5"
      />

      {/* Top rim highlight */}
      <ellipse cx="16" cy="8" rx="4.5" ry="0.8" fill="white" opacity="0.3" />
    </svg>
  );
}
