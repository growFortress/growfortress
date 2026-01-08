import { useState, useEffect, useRef } from 'preact/hooks';
import { Button } from '../shared/Button.js';
import { Spinner } from '../shared/Spinner.js';
import {
  showPvpReplay,
  pvpSelectedChallenge,
  pvpBattleData,
  closeReplayViewer,
  setPvpBattleData,
  showErrorToast,
} from '../../state/index.js';
import { getReplayData } from '../../api/pvp.js';
import {
  ArenaSimulation,
  type ArenaState,
  type ArenaBuildConfig,
} from '@arcade/sim-core';
import styles from './PvpReplayViewer.module.css';

const REPLAY_SPEEDS = [0.5, 1, 2, 4, 8];
const TICKS_PER_SECOND = 30;

export function PvpReplayViewer() {
  const [loading, setLoading] = useState(false);
  const [simulation, setSimulation] = useState<ArenaSimulation | null>(null);
  const [currentState, setCurrentState] = useState<ArenaState | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(1); // Default 1x speed
  const [currentTick, setCurrentTick] = useState(0);
  const [maxTicks, setMaxTicks] = useState(0);

  const animationFrameRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef<number>(0);

  const challenge = pvpSelectedChallenge.value;

  // Load replay data when modal opens
  useEffect(() => {
    if (showPvpReplay.value && challenge && !pvpBattleData.value) {
      loadReplayData();
    }
  }, [showPvpReplay.value, challenge]);

  // Initialize simulation when battle data is available
  useEffect(() => {
    if (pvpBattleData.value) {
      const { seed, challengerBuild, challengedBuild } = pvpBattleData.value;
      const sim = new ArenaSimulation(
        seed,
        challengerBuild as ArenaBuildConfig,
        challengedBuild as ArenaBuildConfig
      );

      // Run simulation to completion to get max ticks
      const result = sim.run();
      setMaxTicks(result.duration);

      // Create fresh simulation for playback
      const playbackSim = new ArenaSimulation(
        seed,
        challengerBuild as ArenaBuildConfig,
        challengedBuild as ArenaBuildConfig
      );
      setSimulation(playbackSim);
      setCurrentState(playbackSim.getState());
      setCurrentTick(0);
    }
  }, [pvpBattleData.value]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying || !simulation) return;

    const speed = REPLAY_SPEEDS[speedIndex];
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
        setCurrentTick(newState.tick);

        if (newState.ended) {
          setIsPlaying(false);
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
  }, [isPlaying, simulation, speedIndex]);

  const loadReplayData = async () => {
    if (!challenge) return;

    setLoading(true);
    try {
      const data = await getReplayData(challenge.id);
      if (data) {
        setPvpBattleData(
          data.seed,
          data.challengerBuild as ArenaBuildConfig,
          data.challengedBuild as ArenaBuildConfig
        );
      }
    } catch (error) {
      showErrorToast('Nie udało się załadować danych replay');
      closeReplayViewer();
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPause = () => {
    if (currentState?.ended) {
      // Reset simulation
      if (pvpBattleData.value) {
        const { seed, challengerBuild, challengedBuild } = pvpBattleData.value;
        const newSim = new ArenaSimulation(
          seed,
          challengerBuild as ArenaBuildConfig,
          challengedBuild as ArenaBuildConfig
        );
        setSimulation(newSim);
        setCurrentState(newSim.getState());
        setCurrentTick(0);
      }
    }
    lastTickTimeRef.current = 0;
    setIsPlaying(!isPlaying);
  };

  const handleSpeedChange = () => {
    setSpeedIndex((prev) => (prev + 1) % REPLAY_SPEEDS.length);
  };

  const handleSeek = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const targetTick = parseInt(target.value, 10);

    if (pvpBattleData.value && simulation) {
      // Recreate simulation and advance to target tick
      const { seed, challengerBuild, challengedBuild } = pvpBattleData.value;
      const newSim = new ArenaSimulation(
        seed,
        challengerBuild as ArenaBuildConfig,
        challengedBuild as ArenaBuildConfig
      );

      for (let i = 0; i < targetTick && !newSim.getState().ended; i++) {
        newSim.step();
      }

      setSimulation(newSim);
      setCurrentState(newSim.getState());
      setCurrentTick(newSim.getState().tick);
      setIsPlaying(false);
    }
  };

  const handleClose = () => {
    setIsPlaying(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    closeReplayViewer();
  };

  if (!showPvpReplay.value) {
    return null;
  }

  const formatTime = (ticks: number) => {
    const seconds = Math.floor(ticks / TICKS_PER_SECOND);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div class={styles.overlay}>
      <div class={styles.modal}>
        {/* Header */}
        <div class={styles.header}>
          <h2 class={styles.title}>🎬 Replay</h2>
          <button class={styles.closeBtn} onClick={handleClose}>×</button>
        </div>

        {loading ? (
          <div class={styles.loading}>
            <Spinner />
            <span>Ładowanie replay...</span>
          </div>
        ) : currentState ? (
          <>
            {/* Battle Visualization */}
            <div class={styles.battlefield}>
              {/* Left Side (Challenger) */}
              <div class={styles.side}>
                <div class={styles.fortress}>
                  <div class={styles.fortressIcon}>🏰</div>
                  <div class={styles.fortressHp}>
                    <div
                      class={styles.hpBar}
                      style={{
                        width: `${(currentState.left.fortress.hp / currentState.left.fortress.maxHp) * 100}%`,
                        backgroundColor: 'var(--color-primary)',
                      }}
                    />
                  </div>
                  <div class={styles.hpText}>
                    {currentState.left.fortress.hp} / {currentState.left.fortress.maxHp}
                  </div>
                </div>
                <div class={styles.heroes}>
                  {currentState.left.heroes.map((hero, i) => (
                    <div
                      key={i}
                      class={`${styles.hero} ${hero.currentHp <= 0 ? styles.heroDead : ''}`}
                      title={`${hero.definitionId}: ${hero.currentHp} HP`}
                    >
                      ⚔️
                    </div>
                  ))}
                </div>
                <div class={styles.sideName}>{challenge?.challengerName}</div>
              </div>

              {/* Center - VS */}
              <div class={styles.center}>
                <div class={styles.vsText}>VS</div>
                <div class={styles.tickCounter}>
                  Tick: {currentTick}
                </div>
              </div>

              {/* Right Side (Challenged) */}
              <div class={styles.side}>
                <div class={styles.fortress}>
                  <div class={styles.fortressIcon}>🏰</div>
                  <div class={styles.fortressHp}>
                    <div
                      class={styles.hpBar}
                      style={{
                        width: `${(currentState.right.fortress.hp / currentState.right.fortress.maxHp) * 100}%`,
                        backgroundColor: 'var(--color-danger)',
                      }}
                    />
                  </div>
                  <div class={styles.hpText}>
                    {currentState.right.fortress.hp} / {currentState.right.fortress.maxHp}
                  </div>
                </div>
                <div class={styles.heroes}>
                  {currentState.right.heroes.map((hero, i) => (
                    <div
                      key={i}
                      class={`${styles.hero} ${hero.currentHp <= 0 ? styles.heroDead : ''}`}
                      title={`${hero.definitionId}: ${hero.currentHp} HP`}
                    >
                      ⚔️
                    </div>
                  ))}
                </div>
                <div class={styles.sideName}>{challenge?.challengedName}</div>
              </div>
            </div>

            {/* Stats Panel */}
            <div class={styles.statsPanel}>
              <div class={styles.statsSide}>
                <span>DMG: {currentState.left.stats.damageDealt.toLocaleString()}</span>
              </div>
              <div class={styles.statsSide}>
                <span>DMG: {currentState.right.stats.damageDealt.toLocaleString()}</span>
              </div>
            </div>

            {/* Controls */}
            <div class={styles.controls}>
              <div class={styles.timeline}>
                <span class={styles.timeLabel}>{formatTime(currentTick)}</span>
                <input
                  type="range"
                  min="0"
                  max={maxTicks}
                  value={currentTick}
                  onInput={handleSeek}
                  class={styles.seekBar}
                />
                <span class={styles.timeLabel}>{formatTime(maxTicks)}</span>
              </div>

              <div class={styles.buttons}>
                <Button
                  variant="skill"
                                    onClick={handlePlayPause}
                >
                  {currentState.ended ? '🔄 Restart' : isPlaying ? '⏸️ Pauza' : '▶️ Play'}
                </Button>
                <Button
                  variant="secondary"
                                    onClick={handleSpeedChange}
                >
                  {REPLAY_SPEEDS[speedIndex]}x
                </Button>
              </div>
            </div>

            {/* End State */}
            {currentState.ended && (
              <div class={styles.endState}>
                <span class={styles.endIcon}>
                  {currentState.winner === 'left' ? '🏆' : currentState.winner === 'right' ? '💀' : '🤝'}
                </span>
                <span class={styles.endText}>
                  {currentState.winner === 'left'
                    ? `${challenge?.challengerName} wygrywa!`
                    : currentState.winner === 'right'
                    ? `${challenge?.challengedName} wygrywa!`
                    : 'Remis!'}
                </span>
              </div>
            )}
          </>
        ) : (
          <div class={styles.loading}>
            <span>Brak danych replay</span>
          </div>
        )}
      </div>
    </div>
  );
}
