/**
 * Arena Replay Component
 *
 * Visualizes a 5v5 arena battle replay using key moments and kill log.
 * Shows hero positions, HP bars, timeline with markers, and kill feed.
 */
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import type { GuildBattleWithResult, ArenaKeyMoment, ArenaKillLogEntry } from '@arcade/protocol';
import { getHeroById } from '@arcade/sim-core';
import styles from './ArenaReplay.module.css';

// ============================================================================
// TYPES
// ============================================================================

interface ArenaReplayProps {
  battle: GuildBattleWithResult;
  currentGuildId: string;
  onClose: () => void;
}

interface HeroState {
  ownerId: string;
  ownerName: string;
  heroId: string;
  tier: 1 | 2 | 3;
  power: number;
  side: 'attacker' | 'defender';
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
  hp: number; // 0-100 percentage
  alive: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TICK_RATE = 30; // 30 ticks per second

// Hero emoji map by class
const HERO_EMOJI: Record<string, string> = {
  frost_archer: '🏹',
  jade_titan: '🛡️',
  thunderlord: '⚡',
  flame_dancer: '🔥',
  storm_mage: '🌀',
  shadow_blade: '🗡️',
  nature_warden: '🌿',
  ice_witch: '❄️',
  iron_guardian: '🔰',
  blood_knight: '⚔️',
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ArenaReplay({ battle, currentGuildId, onClose }: ArenaReplayProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTick, setCurrentTick] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [heroes, setHeroes] = useState<HeroState[]>([]);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const result = battle.result;
  if (!result) return null;

  const duration = result.duration;
  const keyMoments = result.keyMoments || [];
  const killLog = result.killLog || [];
  const mvp = result.mvp;

  // Convert hero snapshots to internal format
  const attackerHeroes = convertHeroSnapshots(battle.attackerHeroes, 'attacker');
  const defenderHeroes = convertHeroSnapshots(battle.defenderHeroes, 'defender');

  // Determine if current guild won
  const didWin = result.winnerGuildId === currentGuildId;
  const didLose = result.winnerGuildId && result.winnerGuildId !== currentGuildId;

  // Initialize heroes
  useEffect(() => {
    const initialHeroes = [...attackerHeroes, ...defenderHeroes].map((hero) => {
      const isAttackerSide = hero.side === 'attacker';
      const sideIndex = isAttackerSide
        ? attackerHeroes.findIndex(h => h.ownerId === hero.ownerId)
        : defenderHeroes.findIndex(h => h.ownerId === hero.ownerId);

      // Initial positions: attackers on left, defenders on right
      const x = isAttackerSide ? 15 : 85;
      const ySpacing = 80 / 6; // Distribute vertically
      const y = 10 + ySpacing * (sideIndex + 1);

      return {
        ...hero,
        x,
        y,
        hp: 100,
        alive: true,
      };
    });

    setHeroes(initialHeroes);
    setCurrentTick(0);
    setIsPlaying(false);
  }, [battle.id]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const animate = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;

      const delta = time - lastTimeRef.current;
      const ticksToAdvance = Math.floor((delta / 1000) * TICK_RATE * speed);

      if (ticksToAdvance > 0) {
        lastTimeRef.current = time;
        setCurrentTick(prev => {
          const next = prev + ticksToAdvance;
          if (next >= duration) {
            setIsPlaying(false);
            return duration;
          }
          return next;
        });
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    lastTimeRef.current = 0;
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, speed, duration]);

  // Update hero states based on current tick
  useEffect(() => {
    setHeroes(prev => {
      return prev.map(hero => {
        // Check if hero died
        const deathEvent = killLog.find(
          k => k.victimUserId === hero.ownerId && k.tick <= currentTick
        );

        if (deathEvent && hero.alive) {
          return { ...hero, alive: false, hp: 0 };
        }

        // Simulate movement towards center during battle
        const progress = currentTick / duration;
        const baseX = hero.side === 'attacker' ? 15 : 85;
        const targetX = hero.side === 'attacker' ? 45 : 55;
        const newX = hero.alive
          ? baseX + (targetX - baseX) * Math.min(progress * 2, 1)
          : hero.x;

        // Simulate HP decay based on damage moments
        let hpPercent = 100;
        if (!deathEvent) {
          // Rough HP estimation based on progress and key moments
          const critHits = keyMoments.filter(
            m => m.type === 'critical_hit' &&
            m.data?.targetId === hero.ownerId &&
            m.tick <= currentTick
          ).length;

          const attacks = Math.floor(currentTick / 60); // Rough attack count
          const damageReceived = attacks * 5 + critHits * 15;
          hpPercent = Math.max(10, 100 - damageReceived);
        }

        return {
          ...hero,
          x: newX,
          hp: hero.alive ? hpPercent : 0,
        };
      });
    });
  }, [currentTick, killLog, keyMoments, duration]);

  // Playback controls
  const togglePlay = useCallback(() => {
    if (currentTick >= duration) {
      setCurrentTick(0);
    }
    setIsPlaying(prev => !prev);
  }, [currentTick, duration]);

  const handleTimelineClick = useCallback((e: MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const tick = Math.floor(percent * duration);
    setCurrentTick(Math.max(0, Math.min(duration, tick)));
    setIsPlaying(false);
  }, [duration]);

  const formatTime = (ticks: number) => {
    const seconds = Math.floor(ticks / TICK_RATE);
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  return (
    <div class={styles.overlay} onClick={onClose}>
      <div class={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div class={styles.header}>
          <h2 class={styles.title}>Replay bitwy</h2>
          <button class={styles.closeBtn} onClick={onClose}>x</button>
        </div>

        {/* Battle Summary */}
        <div class={styles.summary}>
          <div class={styles.summaryTeam}>
            <span class={styles.teamLabel}>Atakujacy</span>
            <span class={`${styles.teamName} ${styles.teamAttacker}`}>
              {battle.attackerGuildName} [{battle.attackerGuildTag}]
            </span>
          </div>

          <div class={styles.summaryResult}>
            <span class={`${styles.resultText} ${
              didWin ? styles.resultWin : didLose ? styles.resultLoss : styles.resultDraw
            }`}>
              {result.winnerSide === 'attacker' ? 'Atakujacy wygrywa' :
               result.winnerSide === 'defender' ? 'Obrona wygrywa' : 'Remis'}
            </span>
            <span class={styles.duration}>{formatTime(duration)}</span>
          </div>

          <div class={styles.summaryTeam}>
            <span class={styles.teamLabel}>Obrona</span>
            <span class={`${styles.teamName} ${styles.teamDefender}`}>
              {battle.defenderGuildName} [{battle.defenderGuildTag}]
            </span>
          </div>
        </div>

        {/* Arena View */}
        <div class={styles.arenaContainer}>
          <div class={styles.arenaGrid} />
          <div class={styles.centerLine} />

          {heroes.map(hero => (
            <HeroMarker key={hero.ownerId} hero={hero} />
          ))}
        </div>

        {/* Timeline */}
        <div class={styles.timeline}>
          <div class={styles.timelineBar} onClick={handleTimelineClick}>
            <div
              class={styles.timelineProgress}
              style={{ width: `${(currentTick / duration) * 100}%` }}
            />

            {/* Key moment markers */}
            {keyMoments.map((moment, i) => (
              <TimelineMarker
                key={i}
                moment={moment}
                duration={duration}
                onClick={(tick) => { setCurrentTick(tick); setIsPlaying(false); }}
              />
            ))}
          </div>

          <div class={styles.timelineTime}>
            <span>{formatTime(currentTick)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div class={styles.controls}>
          <button
            class={`${styles.controlBtn} ${isPlaying ? styles.controlBtnActive : ''}`}
            onClick={togglePlay}
          >
            {isPlaying ? '⏸ Pauza' : '▶ Odtwarzaj'}
          </button>

          <div>
            {[0.5, 1, 2].map(s => (
              <button
                key={s}
                class={`${styles.controlBtn} ${styles.speedBtn} ${speed === s ? styles.speedBtnActive : ''}`}
                onClick={() => setSpeed(s)}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Kill Feed */}
        <div class={styles.killFeed}>
          <div class={styles.killFeedTitle}>Zabojstwa ({killLog.length})</div>
          {killLog.length === 0 ? (
            <div style={{ color: 'var(--color-text-40)', fontSize: '0.8rem' }}>Brak zabitych</div>
          ) : (
            killLog.map((kill, i) => (
              <KillEntry
                key={i}
                kill={kill}
                isActive={kill.tick <= currentTick}
              />
            ))
          )}
        </div>

        {/* MVP */}
        {mvp && (
          <div class={styles.mvp}>
            <span class={styles.mvpLabel}>MVP</span>
            <div class={styles.mvpInfo}>
              <span class={styles.mvpName}>{mvp.displayName}</span>
              <span class={styles.mvpStats}>
                {mvp.damage.toLocaleString()} dmg, {mvp.kills} zabojstw
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function HeroMarker({ hero }: { hero: HeroState }) {
  const emoji = HERO_EMOJI[hero.heroId] || '👤';

  return (
    <div
      class={`${styles.hero} ${!hero.alive ? styles.heroDead : ''}`}
      style={{ left: `${hero.x}%`, top: `${hero.y}%` }}
    >
      <div class={`${styles.heroIcon} ${
        hero.side === 'attacker' ? styles.heroIconAttacker : styles.heroIconDefender
      }`}>
        {emoji}
        <span class={`${styles.heroTier} ${
          hero.tier === 1 ? styles.tierOne :
          hero.tier === 2 ? styles.tierTwo : styles.tierThree
        }`}>
          T{hero.tier}
        </span>
      </div>
      <span class={styles.heroName}>{hero.ownerName}</span>
      <div class={styles.hpBar}>
        <div
          class={`${styles.hpFill} ${hero.hp < 30 ? styles.hpFillLow : ''}`}
          style={{ width: `${hero.hp}%` }}
        />
      </div>
    </div>
  );
}

function TimelineMarker({
  moment,
  duration,
  onClick,
}: {
  moment: ArenaKeyMoment;
  duration: number;
  onClick: (tick: number) => void;
}) {
  const position = (moment.tick / duration) * 100;
  const markerClass =
    moment.type === 'kill' ? styles.markerKill :
    moment.type === 'critical_hit' ? styles.markerCrit :
    moment.type === 'battle_start' ? styles.markerStart :
    moment.type === 'battle_end' ? styles.markerEnd :
    styles.markerCrit;

  return (
    <div
      class={`${styles.timelineMarker} ${markerClass}`}
      style={{ left: `${position}%` }}
      onClick={(e) => { e.stopPropagation(); onClick(moment.tick); }}
      title={`${moment.type} @ ${Math.floor(moment.tick / 30)}s`}
    />
  );
}

function KillEntry({ kill, isActive }: { kill: ArenaKillLogEntry; isActive: boolean }) {
  const time = Math.floor(kill.tick / TICK_RATE);
  const killerHero = getHeroById(kill.killerHeroId);
  const victimHero = getHeroById(kill.victimHeroId);

  return (
    <div class={`${styles.killEntry} ${isActive ? styles.killEntryActive : ''}`}>
      <span class={styles.killTime}>{Math.floor(time / 60)}:{(time % 60).toString().padStart(2, '0')}</span>
      <span class={styles.killerName}>{killerHero?.name || kill.killerHeroId}</span>
      <span class={styles.killIcon}>x</span>
      <span class={styles.victimName}>{victimHero?.name || kill.victimHeroId}</span>
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

interface ConvertedHero {
  ownerId: string;
  ownerName: string;
  heroId: string;
  tier: 1 | 2 | 3;
  power: number;
  side: 'attacker' | 'defender';
}

interface BattleHeroSnapshot {
  heroId: string;
  userId: string;
  displayName: string;
  tier: number;
  power: number;
}

function convertHeroSnapshots(
  heroes: BattleHeroSnapshot[],
  side: 'attacker' | 'defender'
): ConvertedHero[] {
  if (!Array.isArray(heroes)) return [];

  return heroes.map(h => ({
    ownerId: h.userId || '',
    ownerName: h.displayName || 'Unknown',
    heroId: h.heroId || '',
    tier: (h.tier || 1) as 1 | 2 | 3,
    power: h.power || 0,
    side,
  }));
}
