/**
 * GuildTag - Reusable clickable guild tag component
 * Displays [TAG] and opens GuildPreviewModal when clicked
 */
import { openGuildPreview } from '../../state/guildPreview.signals.js';
import styles from './GuildTag.module.css';

interface GuildTagProps {
  /** The guild ID for fetching preview data */
  guildId: string;
  /** The guild tag to display (e.g., "PRO", "BEST") */
  tag: string;
  /** Whether the tag should be clickable (default: true) */
  clickable?: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * Displays a guild tag [TAG] that can be clicked to view guild details
 */
export function GuildTag({ guildId, tag, clickable = true, className }: GuildTagProps) {
  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (clickable) {
      openGuildPreview(guildId);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (clickable && (e.key === 'Enter' || e.key === ' ')) {
      e.stopPropagation();
      e.preventDefault();
      openGuildPreview(guildId);
    }
  };

  const classNames = [
    styles.guildTag,
    clickable && styles.clickable,
    className,
  ].filter(Boolean).join(' ');

  return (
    <span
      class={classNames}
      onClick={clickable ? handleClick : undefined}
      onKeyDown={clickable ? handleKeyDown : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `Zobacz gildię ${tag}` : undefined}
    >
      [{tag}]
    </span>
  );
}

export default GuildTag;
