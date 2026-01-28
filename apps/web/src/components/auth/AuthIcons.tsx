/**
 * Custom SVG icons for the auth screen
 * Sci-fi/cyberpunk style matching the game aesthetic
 */

interface IconProps {
  size?: number;
  className?: string;
}

/** Fortress/Tower icon - for "Build & upgrade" feature */
export function FortressIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      class={className}
      aria-hidden="true"
    >
      {/* Main tower */}
      <path
        d="M12 2L8 6V10H6V6L2 10V22H22V10L18 6V10H16V6L12 2Z"
        fill="currentColor"
        opacity="0.3"
      />
      {/* Tower details */}
      <path
        d="M12 2L8 6V10H6V6L2 10V22H22V10L18 6V10H16V6L12 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Windows */}
      <rect x="10" y="14" width="4" height="8" fill="currentColor" opacity="0.5" />
      <rect x="5" y="14" width="2" height="3" fill="currentColor" opacity="0.4" />
      <rect x="17" y="14" width="2" height="3" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

/** Hero/Warrior icon - for "Collect heroes" feature */
export function HeroIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      class={className}
      aria-hidden="true"
    >
      {/* Shield background */}
      <path
        d="M12 2L4 5V11C4 16.55 7.16 21.74 12 23C16.84 21.74 20 16.55 20 11V5L12 2Z"
        fill="currentColor"
        opacity="0.2"
      />
      {/* Shield outline */}
      <path
        d="M12 2L4 5V11C4 16.55 7.16 21.74 12 23C16.84 21.74 20 16.55 20 11V5L12 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Sword */}
      <path
        d="M12 7V15M9 12H15M10 17L12 15L14 17"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Guild/Group icon - for "Join guilds" feature */
export function GuildIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      class={className}
      aria-hidden="true"
    >
      {/* Crown/banner */}
      <path
        d="M4 7L7 4L12 7L17 4L20 7V17L17 20L12 17L7 20L4 17V7Z"
        fill="currentColor"
        opacity="0.2"
      />
      <path
        d="M4 7L7 4L12 7L17 4L20 7V17L17 20L12 17L7 20L4 17V7Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Star emblem */}
      <path
        d="M12 9L13 11.5H15.5L13.75 13L14.5 15.5L12 14L9.5 15.5L10.25 13L8.5 11.5H11L12 9Z"
        fill="currentColor"
        opacity="0.6"
      />
    </svg>
  );
}

/** User icon - for username input */
export function UserIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      class={className}
      aria-hidden="true"
    >
      {/* Head */}
      <circle
        cx="12"
        cy="8"
        r="4"
        stroke="currentColor"
        strokeWidth="2"
        fill="currentColor"
        fillOpacity="0.2"
      />
      {/* Body */}
      <path
        d="M4 20C4 17 7 14 12 14C17 14 20 17 20 20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** Lock icon - for password input */
export function LockIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      class={className}
      aria-hidden="true"
    >
      {/* Lock body */}
      <rect
        x="5"
        y="11"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        fill="currentColor"
        fillOpacity="0.2"
      />
      {/* Lock shackle */}
      <path
        d="M8 11V7C8 4.79 9.79 3 12 3C14.21 3 16 4.79 16 7V11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Keyhole */}
      <circle cx="12" cy="16" r="1.5" fill="currentColor" />
    </svg>
  );
}

/** Eye icon - for password visibility toggle */
export function EyeIcon({ size = 18, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      class={className}
      aria-hidden="true"
    >
      {/* Eye shape */}
      <path
        d="M2 12C2 12 5 5 12 5C19 5 22 12 22 12C22 12 19 19 12 19C5 19 2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.1"
      />
      {/* Pupil */}
      <circle
        cx="12"
        cy="12"
        r="3"
        stroke="currentColor"
        strokeWidth="2"
        fill="currentColor"
        fillOpacity="0.3"
      />
    </svg>
  );
}

/** Eye-off icon - for password hidden state */
export function EyeOffIcon({ size = 18, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      class={className}
      aria-hidden="true"
    >
      {/* Eye shape */}
      <path
        d="M2 12C2 12 5 5 12 5C19 5 22 12 22 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M2 12C2 12 5 19 12 19C19 19 22 12 22 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      {/* Strike through */}
      <path
        d="M4 4L20 20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Chart icon - for analytics info */
export function ChartIcon({ size = 14, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      class={className}
      aria-hidden="true"
    >
      <rect x="3" y="12" width="4" height="9" rx="1" fill="currentColor" opacity="0.6" />
      <rect x="10" y="7" width="4" height="14" rx="1" fill="currentColor" opacity="0.8" />
      <rect x="17" y="3" width="4" height="18" rx="1" fill="currentColor" />
    </svg>
  );
}

/** Building icon - for studio info */
export function BuildingIcon({ size = 14, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      class={className}
      aria-hidden="true"
    >
      <path
        d="M3 21H21M5 21V7L13 3V21M13 21V7L19 10V21"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Windows */}
      <rect x="7" y="9" width="2" height="2" fill="currentColor" opacity="0.6" />
      <rect x="7" y="13" width="2" height="2" fill="currentColor" opacity="0.6" />
      <rect x="7" y="17" width="2" height="2" fill="currentColor" opacity="0.6" />
      <rect x="15" y="12" width="2" height="2" fill="currentColor" opacity="0.6" />
      <rect x="15" y="16" width="2" height="2" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

/** Checkmark icon - for validation */
export function CheckIcon({ size = 14, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      class={className}
      aria-hidden="true"
    >
      <path
        d="M5 12L10 17L19 7"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Email icon - for email input */
export function EmailIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      class={className}
      aria-hidden="true"
    >
      {/* Envelope body */}
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        fill="currentColor"
        fillOpacity="0.15"
      />
      {/* Envelope flap */}
      <path
        d="M3 7L12 13L21 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
