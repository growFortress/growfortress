import { useState, useEffect, useRef } from 'preact/hooks';
import { Spinner } from '../shared/Spinner.js';
import { HeroAvatar } from '../shared/HeroAvatar.js';
import {
  arenaBattleActive,
  arenaBattleData,
  arenaBattlePhase,
  arenaBattleSpeed,
  arenaBattlePaused,
  setArenaBattlePhase,
  setArenaBattleSpeed,
  toggleArenaBattlePause,
  endArenaBattle,
  addSentChallenge,
} from '../../state/index.js';
import {
  ArenaSimulation,
  FP,
  type ArenaState,
  type ArenaBuildConfig,
  type ActiveHero,
  type ActiveProjectile,
  type FortressClass,
} from '@arcade/sim-core';
import { HEROES } from '@arcade/sim-core';
import styles from './ArenaBattleScene.module.css';

const TICKS_PER_SECOND = 30;

// Arena dimensions in game units (not fixed-point)
const ARENA_WIDTH = 20;
const ARENA_HEIGHT = 15;

// Debug flag
const DEBUG_BATTLE = true;

// Convert fixed-point position to percentage of viewport
function fpToPercent(fpValue: number, maxUnits: number): number {
  const units = FP.toFloat(fpValue);
  return (units / maxUnits) * 100;
}

// Get fortress class icon
function getFortressIcon(fortressClass: FortressClass): string {
  switch (fortressClass) {
    case 'fire': return '🔥';
    case 'ice': return '❄️';
    case 'lightning': return '⚡';
    case 'tech': return '⚙️';
    case 'natural': return '🌿';
    case 'void': return '🌀';
    case 'plasma': return '💫';
    default: return '🏰';
  }
}

// Get fortress class color
function getFortressColor(fortressClass: FortressClass): string {
  switch (fortressClass) {
    case 'fire': return '#ff4500';
    case 'ice': return '#00bfff';
    case 'lightning': return '#ffd700';
    case 'tech': return '#00ff88';
    case 'natural': return '#32cd32';
    case 'void': return '#9932cc';
    case 'plasma': return '#ff00ff';
    default: return '#888888';
  }
}

// Get projectile color based on type
function getProjectileColor(type: string): string {
  switch (type) {
    case 'fireball': return '#ff4500';
    case 'icicle': return '#00bfff';
    case 'bolt': return '#ffd700';
    case 'laser': return '#00ff88';
    default: return '#ffffff';
  }
}

export function ArenaBattleScene() {
  const [simulation, setSimulation] = useState<ArenaSimulation | null>(null);
  const [currentState, setCurrentState] = useState<ArenaState | null>(null);
  const [maxTicks, setMaxTicks] = useState(0);
  const battlefieldRef = useRef<HTMLDivElement>(null);

  const animationFrameRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef<number>(0);

  const data = arenaBattleData.value;
  const phase = arenaBattlePhase.value;
  const speed = arenaBattleSpeed.value;
  const paused = arenaBattlePaused.value;

  // Initialize simulation when data is available
  useEffect(() => {
    if (!data) return;

    const { seed, challengerBuild, challengedBuild } = data;

    // DEBUG: Log battle data to diagnose issues
    if (DEBUG_BATTLE) {
      console.log('[ArenaBattleScene] Battle data:', {
        seed,
        challengerBuild: {
          ownerName: challengerBuild.ownerName,
          fortressClass: challengerBuild.fortressClass,
          commanderLevel: challengerBuild.commanderLevel,
          heroIds: challengerBuild.heroIds,
          heroConfigs: challengerBuild.heroConfigs,
        },
        challengedBuild: {
          ownerName: challengedBuild.ownerName,
          fortressClass: challengedBuild.fortressClass,
          commanderLevel: challengedBuild.commanderLevel,
          heroIds: challengedBuild.heroIds,
          heroConfigs: challengedBuild.heroConfigs,
        },
      });
    }

    // Run simulation to completion to get max ticks
    const sim = new ArenaSimulation(
      seed,
      challengerBuild as ArenaBuildConfig,
      challengedBuild as ArenaBuildConfig
    );
    const result = sim.run();
    setMaxTicks(result.duration);

    // DEBUG: Log result
    console.log('[ArenaBattleScene] Simulation result:', result);

    // Create fresh simulation for playback
    const playbackSim = new ArenaSimulation(
      seed,
      challengerBuild as ArenaBuildConfig,
      challengedBuild as ArenaBuildConfig
    );
    setSimulation(playbackSim);
    const initialState = playbackSim.getState();
    setCurrentState(initialState);

    // DEBUG: Log initial state heroes and fortresses
    if (DEBUG_BATTLE) {
      console.log('[ArenaBattleScene] Initial state:', {
        leftFortress: {
          class: initialState.left.fortress.class,
          hp: initialState.left.fortress.hp,
          maxHp: initialState.left.fortress.maxHp,
          x: FP.toFloat(initialState.left.fortress.x),
          y: FP.toFloat(initialState.left.fortress.y),
        },
        rightFortress: {
          class: initialState.right.fortress.class,
          hp: initialState.right.fortress.hp,
          maxHp: initialState.right.fortress.maxHp,
          x: FP.toFloat(initialState.right.fortress.x),
          y: FP.toFloat(initialState.right.fortress.y),
        },
        leftHeroes: initialState.left.heroes.map(h => ({
          id: h.definitionId,
          tier: h.tier,
          hp: h.currentHp,
          maxHp: h.maxHp,
          x: FP.toFloat(h.x),
          y: FP.toFloat(h.y),
        })),
        rightHeroes: initialState.right.heroes.map(h => ({
          id: h.definitionId,
          tier: h.tier,
          hp: h.currentHp,
          maxHp: h.maxHp,
          x: FP.toFloat(h.x),
          y: FP.toFloat(h.y),
        })),
        heroCount: {
          left: initialState.left.heroes.length,
          right: initialState.right.heroes.length,
        },
      });
    }

    // Auto-start playback
    setArenaBattlePhase('fighting');

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [data]);

  // Animation loop
  useEffect(() => {
    if (phase !== 'fighting' || paused || !simulation) return;

    const msPerTick = 1000 / (TICKS_PER_SECOND * speed);

    const animate = (timestamp: number) => {
      if (!lastTickTimeRef.current) {
        lastTickTimeRef.current = timestamp;
      }

      const elapsed = timestamp - lastTickTimeRef.current;

      if (elapsed >= msPerTick) {
        const ticksToAdvance = Math.floor(elapsed / msPerTick);
        lastTickTimeRef.current = timestamp - (elapsed % msPerTick);

        for (let i = 0; i < ticksToAdvance && !simulation.getState().ended; i++) {
          simulation.step();
        }

        const newState = simulation.getState();
        setCurrentState({ ...newState });

        if (newState.ended) {
          setArenaBattlePhase('ended');
          return;
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [phase, paused, simulation, speed]);

  const handleSpeedChange = () => {
    const speeds: (1 | 2 | 4)[] = [1, 2, 4];
    const currentIndex = speeds.indexOf(speed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    setArenaBattleSpeed(speeds[nextIndex]);
  };

  const handleSkip = () => {
    if (simulation) {
      while (!simulation.getState().ended) {
        simulation.step();
      }
      setCurrentState({ ...simulation.getState() });
      setArenaBattlePhase('ended');
    }
  };

  const handleWatchAgain = () => {
    if (data) {
      const { seed, challengerBuild, challengedBuild } = data;
      const newSim = new ArenaSimulation(
        seed,
        challengerBuild as ArenaBuildConfig,
        challengedBuild as ArenaBuildConfig
      );
      setSimulation(newSim);
      setCurrentState(newSim.getState());
      setArenaBattlePhase('fighting');
      lastTickTimeRef.current = 0;
      arenaBattlePaused.value = false;
    }
  };

  const handleContinue = () => {
    if (data?.challenge) {
      addSentChallenge(data.challenge);
    }
    endArenaBattle();
  };

  if (!arenaBattleActive.value || !data) {
    return null;
  }

  const formatTime = (ticks: number) => {
    const seconds = Math.floor(ticks / TICKS_PER_SECOND);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getHeroName = (heroId: string): string => {
    const hero = HEROES.find(h => h.id === heroId);
    return hero?.name ?? heroId;
  };

  const isUserChallenger = true;

  const getResultText = (): { text: string; type: 'victory' | 'defeat' | 'draw'; icon: string } => {
    if (!data.result) return { text: 'Zakończono', type: 'draw', icon: '🤝' };

    const { winnerId, winReason } = data.result;

    if (winReason === 'draw' || !winnerId) {
      return { text: 'Remis!', type: 'draw', icon: '🤝' };
    }

    const userWon = winnerId === data.challenge.challengerId;
    return userWon
      ? { text: 'Zwycięstwo!', type: 'victory', icon: '🏆' }
      : { text: 'Porażka', type: 'defeat', icon: '💀' };
  };

  const getWinReasonText = (reason: string): string => {
    switch (reason) {
      case 'fortress_destroyed':
        return 'Forteca zniszczona';
      case 'timeout':
        return 'Limit czasu';
      case 'draw':
        return 'Remis - równe obrażenia';
      default:
        return reason;
    }
  };

  // Render a hero on the battlefield
  const renderBattleHero = (hero: ActiveHero, side: 'left' | 'right', index: number) => {
    const isAlive = hero.currentHp > 0;
    const hpPercent = (hero.currentHp / hero.maxHp) * 100;

    // Convert fixed-point position to percentage
    const xPercent = fpToPercent(hero.x, ARENA_WIDTH);
    const yPercent = fpToPercent(hero.y, ARENA_HEIGHT);

    const heroName = getHeroName(hero.definitionId);
    const tierStars = '★'.repeat(hero.tier);

    return (
      <div
        key={`${side}-hero-${hero.definitionId}-${index}`}
        class={`${styles.battleHero} ${isAlive ? '' : styles.deadHero}`}
        style={{
          position: 'absolute',
          left: `${xPercent}%`,
          top: `${yPercent}%`,
          transform: 'translate(-50%, -50%)',
          zIndex: isAlive ? 10 : 5,
        }}
      >
        <div class={styles.heroAvatarWrapper}>
          <HeroAvatar heroId={hero.definitionId} tier={hero.tier} size={40} />
        </div>
        <div class={styles.heroHpBarSmall}>
          <div
            class={`${styles.heroHpFillSmall} ${
              hpPercent < 25 ? styles.critical : hpPercent < 50 ? styles.low : ''
            }`}
            style={{ width: `${Math.max(0, hpPercent)}%` }}
          />
        </div>
        <div class={styles.heroNameSmall}>
          {heroName} <span style={{ color: '#ffd700', fontSize: '0.5rem' }}>{tierStars}</span>
        </div>
      </div>
    );
  };

  // Render a projectile
  const renderProjectile = (projectile: ActiveProjectile, side: 'left' | 'right', index: number) => {
    const xPercent = fpToPercent(projectile.x, ARENA_WIDTH);
    const yPercent = fpToPercent(projectile.y, ARENA_HEIGHT);
    const color = getProjectileColor(projectile.type);

    return (
      <div
        key={`${side}-projectile-${index}`}
        class={styles.projectile}
        style={{
          left: `${xPercent}%`,
          top: `${yPercent}%`,
          transform: 'translate(-50%, -50%)',
          backgroundColor: color,
          boxShadow: `0 0 10px ${color}, 0 0 20px ${color}`,
        }}
      />
    );
  };

  // Render fortress
  const renderFortress = (side: 'left' | 'right', fortressClass: FortressClass, hp: number, maxHp: number, x: number, y: number) => {
    const xPercent = fpToPercent(x, ARENA_WIDTH);
    const yPercent = fpToPercent(y, ARENA_HEIGHT);
    const hpPercent = (hp / maxHp) * 100;
    const isDestroyed = hp <= 0;
    const color = getFortressColor(fortressClass);

    if (DEBUG_BATTLE) {
      console.log(`[Fortress ${side}] FP: (${x}, ${y}) -> Percent: (${xPercent.toFixed(1)}%, ${yPercent.toFixed(1)}%)`);
    }

    return (
      <div
        key={`fortress-${side}`}
        class={`${styles.battleFortress} ${isDestroyed ? styles.destroyedFortress : ''}`}
        style={{
          position: 'absolute',
          left: `${xPercent}%`,
          top: `${yPercent}%`,
          transform: 'translate(-50%, -50%)',
          borderColor: color,
          zIndex: 5,
        }}
      >
        <div class={styles.fortressIconLarge} style={{ textShadow: `0 0 20px ${color}` }}>
          {getFortressIcon(fortressClass)}
        </div>
        <div class={styles.fortressHpBarBattle}>
          <div
            class={styles.fortressHpFillBattle}
            style={{
              width: `${Math.max(0, hpPercent)}%`,
              backgroundColor: color,
            }}
          />
        </div>
      </div>
    );
  };

  const leftBuild = data.challengerBuild as ArenaBuildConfig;
  const rightBuild = data.challengedBuild as ArenaBuildConfig;

  // Defensive fallbacks for fortress class
  const leftFortressClass: FortressClass = leftBuild?.fortressClass || 'natural';
  const rightFortressClass: FortressClass = rightBuild?.fortressClass || 'natural';

  return (
    <div class={styles.scene}>
      {!currentState ? (
        <div class={styles.loading}>
          <Spinner />
          <span>Przygotowanie areny...</span>
        </div>
      ) : (
        <>
          {/* Header with HP bars */}
          <div class={styles.header}>
            <div class={styles.playerPanel}>
              <div class={styles.playerName}>
                <span class={styles.fortressClassIcon}>{getFortressIcon(leftFortressClass)}</span>
                {data.challenge.challengerName}
                {isUserChallenger && <span class={styles.youBadge}>TY</span>}
              </div>
              <div class={styles.fortressHpBar}>
                <div
                  class={styles.fortressHpFill}
                  style={{
                    width: `${(currentState.left.fortress.hp / currentState.left.fortress.maxHp) * 100}%`,
                    backgroundColor: getFortressColor(leftFortressClass),
                  }}
                />
                <span class={styles.fortressHpText}>
                  {currentState.left.fortress.hp.toLocaleString()} / {currentState.left.fortress.maxHp.toLocaleString()}
                </span>
              </div>
            </div>

            <div class={styles.vsSection}>
              <div class={styles.vsText}>VS</div>
              <div class={styles.tickDisplay}>{formatTime(currentState.tick)}</div>
            </div>

            <div class={`${styles.playerPanel} ${styles.right}`}>
              <div class={styles.playerName}>
                {data.challenge.challengedName}
                <span class={styles.fortressClassIcon}>{getFortressIcon(rightFortressClass)}</span>
                {!isUserChallenger && <span class={styles.youBadge}>TY</span>}
              </div>
              <div class={styles.fortressHpBar}>
                <div
                  class={styles.fortressHpFill}
                  style={{
                    width: `${(currentState.right.fortress.hp / currentState.right.fortress.maxHp) * 100}%`,
                    backgroundColor: getFortressColor(rightFortressClass),
                  }}
                />
                <span class={styles.fortressHpText}>
                  {currentState.right.fortress.hp.toLocaleString()} / {currentState.right.fortress.maxHp.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div class={styles.progressBar}>
            <div
              class={styles.progressFill}
              style={{ width: `${(currentState.tick / maxTicks) * 100}%` }}
            />
          </div>

          {/* 2D Battlefield */}
          <div class={styles.battlefield2D} ref={battlefieldRef}>
            {/* Center divider line */}
            <div class={styles.centerLine} />

            {/* Left fortress */}
            {renderFortress(
              'left',
              leftFortressClass,
              currentState.left.fortress.hp,
              currentState.left.fortress.maxHp,
              currentState.left.fortress.x,
              currentState.left.fortress.y
            )}

            {/* Right fortress */}
            {renderFortress(
              'right',
              rightFortressClass,
              currentState.right.fortress.hp,
              currentState.right.fortress.maxHp,
              currentState.right.fortress.x,
              currentState.right.fortress.y
            )}

            {/* Left heroes */}
            {currentState.left.heroes.map((hero, i) => renderBattleHero(hero, 'left', i))}

            {/* Right heroes */}
            {currentState.right.heroes.map((hero, i) => renderBattleHero(hero, 'right', i))}

            {/* Left projectiles */}
            {currentState.left.projectiles.map((p, i) => renderProjectile(p, 'left', i))}

            {/* Right projectiles */}
            {currentState.right.projectiles.map((p, i) => renderProjectile(p, 'right', i))}

            {/* Debug: Show hero count */}
            {DEBUG_BATTLE && (
              <div style={{
                position: 'absolute',
                bottom: '10px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '0.7rem',
                color: 'rgba(255,255,255,0.5)',
                zIndex: 100,
              }}>
                L: {currentState.left.heroes.length} heroes | R: {currentState.right.heroes.length} heroes
              </div>
            )}
          </div>

          {/* Loadout panel - shows all heroes from both sides */}
          <div class={styles.loadoutPanel}>
            <div class={styles.loadoutSide}>
              {currentState.left.heroes.map((hero, i) => {
                const isAlive = hero.currentHp > 0;
                const hpPercent = (hero.currentHp / hero.maxHp) * 100;
                return (
                  <div key={`loadout-left-${i}`} class={`${styles.loadoutHero} ${isAlive ? '' : styles.loadoutHeroDead}`}>
                    <HeroAvatar heroId={hero.definitionId} tier={hero.tier} size={32} />
                    <div class={styles.loadoutHeroInfo}>
                      <div class={styles.loadoutHeroName}>{getHeroName(hero.definitionId)}</div>
                      <div class={styles.loadoutHeroHp}>
                        <div class={styles.loadoutHpBar}>
                          <div class={styles.loadoutHpFill} style={{ width: `${hpPercent}%` }} />
                        </div>
                        <span class={styles.loadoutHpText}>{hero.currentHp}/{hero.maxHp}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {currentState.left.heroes.length === 0 && (
                <div class={styles.loadoutEmpty}>Brak bohaterów</div>
              )}
            </div>

            <div class={styles.loadoutDivider}>
              <div class={styles.stat}>
                <span class={styles.statLabel}>DMG:</span>
                <span class={styles.statValue}>{currentState.left.stats.damageDealt.toLocaleString()}</span>
              </div>
              <div class={styles.loadoutVs}>VS</div>
              <div class={styles.stat}>
                <span class={styles.statLabel}>DMG:</span>
                <span class={styles.statValue}>{currentState.right.stats.damageDealt.toLocaleString()}</span>
              </div>
            </div>

            <div class={`${styles.loadoutSide} ${styles.loadoutSideRight}`}>
              {currentState.right.heroes.map((hero, i) => {
                const isAlive = hero.currentHp > 0;
                const hpPercent = (hero.currentHp / hero.maxHp) * 100;
                return (
                  <div key={`loadout-right-${i}`} class={`${styles.loadoutHero} ${isAlive ? '' : styles.loadoutHeroDead}`}>
                    <HeroAvatar heroId={hero.definitionId} tier={hero.tier} size={32} />
                    <div class={styles.loadoutHeroInfo}>
                      <div class={styles.loadoutHeroName}>{getHeroName(hero.definitionId)}</div>
                      <div class={styles.loadoutHeroHp}>
                        <div class={styles.loadoutHpBar}>
                          <div class={styles.loadoutHpFill} style={{ width: `${hpPercent}%` }} />
                        </div>
                        <span class={styles.loadoutHpText}>{hero.currentHp}/{hero.maxHp}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {currentState.right.heroes.length === 0 && (
                <div class={styles.loadoutEmpty}>Brak bohaterów</div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div class={styles.controls}>
            <button
              class={`${styles.controlBtn} ${paused ? '' : styles.active}`}
              onClick={() => toggleArenaBattlePause()}
              disabled={phase === 'ended'}
            >
              {paused ? '▶️ Play' : '⏸️ Pauza'}
            </button>
            <button
              class={`${styles.controlBtn} ${styles.speedBtn}`}
              onClick={handleSpeedChange}
              disabled={phase === 'ended'}
            >
              {speed}x
            </button>
            <button
              class={`${styles.controlBtn} ${styles.skipBtn}`}
              onClick={handleSkip}
              disabled={phase === 'ended'}
            >
              ⏭️ Pomiń
            </button>
          </div>

          {/* Result overlay */}
          {phase === 'ended' && (
            <div class={styles.resultOverlay}>
              <div class={styles.resultModal}>
                <div class={styles.resultIcon}>{getResultText().icon}</div>
                <div class={`${styles.resultBanner} ${styles[getResultText().type]}`}>
                  {getResultText().text}
                </div>
                <div class={styles.resultReason}>
                  {data.result && getWinReasonText(data.result.winReason)}
                </div>

                {data.rewards && (
                  <div class={styles.rewardsSection}>
                    <div class={styles.rewardsTitle}>Nagrody</div>
                    <div class={styles.rewardRow}>
                      <span class={styles.rewardLabel}>Honor</span>
                      <span
                        class={`${styles.rewardValue} ${
                          data.rewards.honorChange >= 0 ? styles.positive : styles.negative
                        }`}
                      >
                        {data.rewards.honorChange >= 0 ? '+' : ''}{data.rewards.honorChange}
                      </span>
                    </div>
                    {data.rewards.dust > 0 && (
                      <div class={styles.rewardRow}>
                        <span class={styles.rewardLabel}>Pył</span>
                        <span class={`${styles.rewardValue} ${styles.positive}`}>
                          +{data.rewards.dust}
                        </span>
                      </div>
                    )}
                    {data.rewards.gold > 0 && (
                      <div class={styles.rewardRow}>
                        <span class={styles.rewardLabel}>Złoto</span>
                        <span class={`${styles.rewardValue} ${styles.positive}`}>
                          +{data.rewards.gold}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div class={styles.resultActions}>
                  <button class={`${styles.actionBtn} ${styles.watchAgainBtn}`} onClick={handleWatchAgain}>
                    🔄 Obejrzyj ponownie
                  </button>
                  <button class={`${styles.actionBtn} ${styles.continueBtn}`} onClick={handleContinue}>
                    Kontynuuj
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
