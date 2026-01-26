/**
 * Tag Badge Component
 *
 * Displays a synergy tag with icon and color.
 * Used on hero cards, turret cards, and perk cards.
 */

import type { JSX } from 'preact';
import { getTagById, type SynergyTag } from '@arcade/sim-core';
import styles from './TagBadge.module.css';

interface TagBadgeProps {
  tag: SynergyTag;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  active?: boolean;
  count?: number;
  onClick?: () => void;
}

export function TagBadge({
  tag,
  size = 'small',
  showLabel = false,
  active = false,
  count,
  onClick,
}: TagBadgeProps) {
  const tagDef = getTagById(tag);

  if (!tagDef) return null;

  return (
    <div
      class={`${styles.badge} ${styles[size]} ${active ? styles.active : ''} ${onClick ? styles.clickable : ''}`}
      style={{ '--tag-color': tagDef.color } as JSX.CSSProperties}
      onClick={onClick}
      title={tagDef.description}
    >
      <span class={styles.icon}>{tagDef.icon}</span>
      {showLabel && <span class={styles.label}>{tagDef.name}</span>}
      {count !== undefined && <span class={styles.count}>{count}</span>}
    </div>
  );
}

interface TagListProps {
  tags: SynergyTag[];
  size?: 'small' | 'medium' | 'large';
  showLabels?: boolean;
  maxVisible?: number;
  activeTags?: SynergyTag[];
}

export function TagList({
  tags,
  size = 'small',
  showLabels = false,
  maxVisible = 5,
  activeTags = [],
}: TagListProps) {
  const visibleTags = tags.slice(0, maxVisible);
  const hiddenCount = tags.length - maxVisible;

  return (
    <div class={styles.tagList}>
      {visibleTags.map((tag) => (
        <TagBadge
          key={tag}
          tag={tag}
          size={size}
          showLabel={showLabels}
          active={activeTags.includes(tag)}
        />
      ))}
      {hiddenCount > 0 && (
        <span class={styles.moreCount}>+{hiddenCount}</span>
      )}
    </div>
  );
}

interface ActiveSynergyBadgeProps {
  tag: SynergyTag;
  count: number;
  required: number;
  bonuses: string[];
}

export function ActiveSynergyBadge({
  tag,
  count,
  required,
  bonuses,
}: ActiveSynergyBadgeProps) {
  const tagDef = getTagById(tag);
  const isActive = count >= required;

  if (!tagDef) return null;

  return (
    <div
      class={`${styles.synergyBadge} ${isActive ? styles.active : ''}`}
      style={{ '--tag-color': tagDef.color } as JSX.CSSProperties}
    >
      <div class={styles.synergyHeader}>
        <span class={styles.icon}>{tagDef.icon}</span>
        <span class={styles.synergyName}>{tagDef.name}</span>
        <span class={styles.synergyProgress}>
          {count}/{required}
        </span>
      </div>
      {isActive && (
        <div class={styles.synergyBonuses}>
          {bonuses.map((bonus, i) => (
            <span key={i} class={styles.synergyBonus}>{bonus}</span>
          ))}
        </div>
      )}
    </div>
  );
}
