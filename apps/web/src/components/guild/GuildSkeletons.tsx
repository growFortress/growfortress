/**
 * Skeleton loaders for guild UI components
 */
import { Skeleton } from '../shared/Skeleton.js';
import styles from './GuildPanel.module.css';

/**
 * Skeleton for guild info tab content
 */
export function GuildInfoSkeleton() {
  return (
    <div class={styles.tabContent}>
      {/* Emblem section */}
      <section class={styles.section}>
        <div class={styles.sectionHeader}>
          <Skeleton variant="text" width={100} height={16} />
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Skeleton variant="circle" width={64} height={64} />
          <Skeleton variant="text" width={100} height={32} />
        </div>
      </section>

      {/* Description section */}
      <section class={styles.section}>
        <div class={styles.sectionHeader}>
          <Skeleton variant="text" width={120} height={16} />
        </div>
        <Skeleton variant="rect" width="100%" height={80} />
      </section>

      {/* Structures section */}
      <section class={styles.section}>
        <div class={styles.sectionHeader}>
          <Skeleton variant="text" width={100} height={16} />
        </div>
        <div class={styles.structuresGrid}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} class={styles.structureCard}>
              <Skeleton variant="rect" width="100%" height={100} />
            </div>
          ))}
        </div>
      </section>

      {/* Bonuses section */}
      <section class={styles.section}>
        <div class={styles.sectionHeader}>
          <Skeleton variant="text" width={80} height={16} />
        </div>
        <div class={styles.bonusesGrid}>
          {[1, 2, 3].map((i) => (
            <div key={i} class={styles.bonusCard}>
              <Skeleton variant="text" width={80} height={14} />
              <Skeleton variant="text" width={50} height={24} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/**
 * Skeleton for member list
 */
export function MemberListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div class={styles.membersList}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          class={styles.memberCard}
          style={{ opacity: 1 - i * 0.12 }}
        >
          <Skeleton variant="circle" width={40} height={40} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Skeleton variant="text" width={120} height={16} />
            <Skeleton variant="text" width={60} height={12} />
          </div>
          <Skeleton variant="text" width={80} height={20} />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for treasury logs
 */
export function TreasuryLogsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div class={styles.treasuryLogs}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          class={styles.logEntry}
          style={{ opacity: 1 - i * 0.12 }}
        >
          <Skeleton variant="text" width={100} height={14} />
          <div style={{ flex: 1 }} />
          <Skeleton variant="text" width={60} height={14} />
          <Skeleton variant="text" width={40} height={14} />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for battle history
 */
export function BattleHistorySkeleton({ count = 3 }: { count?: number }) {
  return (
    <div class={styles.battleList}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          class={styles.battleCard}
          style={{ opacity: 1 - i * 0.15 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
            <Skeleton variant="text" width={80} height={16} />
            <Skeleton variant="text" width={30} height={20} />
            <Skeleton variant="text" width={80} height={16} />
          </div>
          <Skeleton variant="rect" width={60} height={28} />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for structures grid only
 */
export function StructuresGridSkeleton() {
  return (
    <div class={styles.structuresGrid}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} class={styles.structureCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <Skeleton variant="circle" width={32} height={32} />
            <Skeleton variant="text" width={80} height={18} />
          </div>
          <Skeleton variant="text" width="100%" height={14} />
          <Skeleton variant="text" width="60%" height={14} />
          <div style={{ marginTop: '0.75rem' }}>
            <Skeleton variant="rect" width="100%" height={32} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for bonuses grid only
 */
export function BonusesGridSkeleton() {
  return (
    <div class={styles.bonusesGrid}>
      {[1, 2, 3].map((i) => (
        <div key={i} class={styles.bonusCard}>
          <Skeleton variant="text" width={80} height={14} />
          <Skeleton variant="text" width={50} height={24} />
        </div>
      ))}
    </div>
  );
}
