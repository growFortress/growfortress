export interface ArtifactIconProps {
  size?: number;
  className?: string;
}

export function ArtifactIcon({ size = 24, className = '' }: ArtifactIconProps) {
  const uniqueId = `artifact-${Math.random().toString(36).slice(2, 11)}`;

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
        {/* Ring gradient - gold */}
        <linearGradient id={`ring-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="30%" stopColor="#FFC000" />
          <stop offset="70%" stopColor="#DAA520" />
          <stop offset="100%" stopColor="#B8860B" />
        </linearGradient>

        {/* Gem gradient - magical purple */}
        <radialGradient id={`gem-${uniqueId}`} cx="40%" cy="40%">
          <stop offset="0%" stopColor="#FF88FF" />
          <stop offset="40%" stopColor="#CC44CC" />
          <stop offset="100%" stopColor="#8822AA" />
        </radialGradient>

        {/* Inner glow */}
        <radialGradient id={`gemGlow-${uniqueId}`} cx="30%" cy="30%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#FFAAFF" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#CC44CC" stopOpacity="0" />
        </radialGradient>

        {/* Glow filter */}
        <filter id={`artifactGlow-${uniqueId}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer magical glow */}
      <circle cx="16" cy="16" r="14" fill="#CC44CC" opacity="0.2" />

      {/* Ring/band */}
      <ellipse
        cx="16"
        cy="20"
        rx="10"
        ry="6"
        fill="none"
        stroke={`url(#ring-${uniqueId})`}
        strokeWidth="4"
        filter={`url(#artifactGlow-${uniqueId})`}
      />

      {/* Ring shine */}
      <ellipse
        cx="16"
        cy="20"
        rx="8"
        ry="4"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1"
        opacity="0.4"
      />

      {/* Gem setting */}
      <circle
        cx="16"
        cy="10"
        r="7"
        fill={`url(#ring-${uniqueId})`}
        stroke="#8B6914"
        strokeWidth="1"
      />

      {/* Main gem */}
      <circle
        cx="16"
        cy="10"
        r="5"
        fill={`url(#gem-${uniqueId})`}
        filter={`url(#artifactGlow-${uniqueId})`}
      />

      {/* Gem inner glow */}
      <circle
        cx="16"
        cy="10"
        r="4"
        fill={`url(#gemGlow-${uniqueId})`}
      />

      {/* Gem sparkle */}
      <circle cx="14" cy="8" r="1.5" fill="#FFFFFF" opacity="0.9" />
      <circle cx="17" cy="10" r="0.8" fill="#FFFFFF" opacity="0.6" />

      {/* Magic particles */}
      <circle cx="8" cy="14" r="1" fill="#FF88FF" opacity="0.8" />
      <circle cx="24" cy="14" r="0.8" fill="#CC66FF" opacity="0.7" />
      <circle cx="10" cy="24" r="0.7" fill="#AA44DD" opacity="0.6" />
      <circle cx="22" cy="24" r="0.9" fill="#DD66FF" opacity="0.7" />
    </svg>
  );
}
