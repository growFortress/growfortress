import type { GameEvent, Checkpoint, BossRushStartResponse, BossRushFinishResponse } from '@arcade/protocol';
import type { FortressClass, Enemy } from '@arcade/sim-core';
import {
  Simulation,
  getDefaultConfig,
  createCheckpoint,
  getBossRushBossStats,
  DEFAULT_BOSS_RUSH_CONFIG,
  createBossRushState,
  recordBossRushDamage,
  processBossKill,
  startIntermission as startBossRushIntermission,
  endIntermission as endBossRushIntermission,
  generateBossRushSummary,
  ENEMY_PHYSICS,
  FP,
  type BossRushState,
  type BossRushBossStats,
} from '@arcade/sim-core';
import { audioManager } from './AudioManager.js';
import { CONFIG } from '../config.js';
import { startSession, submitSegment, endSession, SessionStartResponse, SegmentSubmitResponse } from '../api/client.js';
import { startBossRush as apiStartBossRush, finishBossRush as apiFinishBossRush } from '../api/boss-rush.js';
import type { PartialRewards } from '../api/client.js';
import { saveActiveSession, clearActiveSession, type ActiveSessionSnapshot } from '../storage/idb.js';
import { deferTask } from '../utils/scheduler.js';
import {
  bossRushActive,
  initBossRushSession,
  updateBossState,
  updateDamageDealt,
  recordBossKill as signalRecordBossKill,
  recordBossDeath,
  startIntermission as signalStartIntermission,
  endIntermission as signalEndIntermission,
  updateIntermissionCountdown,
  updateBossRushRewards,
  showBossRushEnd,
  resetBossRushState,
  bossRushStartTime,
} from '../state/index.js';

/** Options for starting an endless session */
export interface SessionStartOptions {
  fortressClass?: FortressClass;
  startingHeroes?: string[];
  startingTurrets?: string[];
}

/** Save session snapshot every N ticks (10 seconds at 30Hz) */
const SESSION_SNAPSHOT_INTERVAL = 300;

export type GamePhase = 'idle' | 'shop' | 'playing' | 'choice' | 'segment_submit' | 'ended' | 'boss_rush';

export interface GameCallbacks {
  onStateChange: () => void;
  onChoiceRequired: (options: string[]) => void;
  onGameEnd: (
    won: boolean,
    newInventory?: { gold: number; dust: number },
    newProgression?: { level: number; xp: number; totalXp: number; xpToNextLevel: number },
    finalWave?: number
  ) => void;
  onSegmentComplete?: (result: SegmentSubmitResponse) => void;
  onRewardsReceived?: (gold: number, dust: number, xp: number) => void;
  onBossRushEnd?: (result: BossRushFinishResponse) => void;
}

export class Game {
  private simulation: Simulation | null = null;
  private sessionInfo: SessionStartResponse | null = null;
  private events: GameEvent[] = [];
  private checkpoints: Checkpoint[] = [];
  private lastChainHash = 0;
  private phase: GamePhase = 'idle';
  private callbacks: GameCallbacks;
  private auditTickSet: Set<number> = new Set();
  private lastCheckpointTick = 0;

  // Endless mode state
  private pendingSegmentSubmit = false;
  private segmentSubmitRetryCount = 0;
  private segmentSubmitLastAttempt = 0;
  private static readonly MAX_SEGMENT_RETRIES = 5;
  private static readonly BASE_RETRY_DELAY_MS = 2000; // 2 seconds base delay

  // Session persistence state
  private lastSnapshotTick = 0;
  private sessionOptions: SessionStartOptions = {};

  // Boss Rush state
  private bossRushState: BossRushState | null = null;
  private bossRushSessionInfo: BossRushStartResponse | null = null;
  private currentBossStats: BossRushBossStats | null = null;
  private bossEntityId: number | null = null;
  private lastBossDamageCheck = 0;
  private lastFortressHp = 0;
  private lastLevel = 0;

  constructor(callbacks: GameCallbacks) {
    this.callbacks = callbacks;
  }

  /** Get the current game phase */
  getPhase(): GamePhase {
    return this.phase;
  }

  /** Get the current simulation state, or null if not running */
  getState() {
    return this.simulation?.state ?? null;
  }

  /** Get the session info for endless mode */
  getSessionInfo() {
    return this.sessionInfo;
  }

  /** Check if the game is running in endless mode (always true) */
  isEndless(): boolean {
    return true;
  }

  /** Start a new endless mode session with options */
  async startEndlessSession(options: SessionStartOptions = {}): Promise<SessionStartResponse | null> {
    const {
      fortressClass = 'natural',
      startingHeroes = [],
      startingTurrets = [],
    } = options;

    // Store options for session persistence
    this.sessionOptions = { fortressClass, startingHeroes, startingTurrets };

    try {
      // Request new session from server
      const sessionInfo = await startSession({
        fortressClass,
        startingHeroes,
        startingTurrets,
      });
      this.sessionInfo = sessionInfo;

      // Create simulation with endless config (all relics available for choices)
      const config = getDefaultConfig();
      config.tickHz = sessionInfo.tickHz;
      config.startingWave = sessionInfo.startingWave;

      // Apply unified progression bonuses
      config.commanderLevel = sessionInfo.commanderLevel;
      config.progressionDamageBonus = sessionInfo.progressionBonuses.damageMultiplier;
      config.progressionGoldBonus = sessionInfo.progressionBonuses.goldMultiplier;
      config.startingGold = sessionInfo.progressionBonuses.startingGold;
      config.maxHeroSlots = sessionInfo.progressionBonuses.maxHeroSlots;

      // Apply remote config values for simulation determinism
      config.fortressBaseHp = sessionInfo.fortressBaseHp;
      config.fortressBaseDamage = sessionInfo.fortressBaseDamage;
      config.waveIntervalTicks = sessionInfo.waveIntervalTicks;

      // Set fortress class and heroes
      config.fortressClass = fortressClass;
      config.startingHeroes = startingHeroes;

      // Set turrets - convert turret type IDs to turret config
      // Each unlocked turret type goes to sequential slots
      config.startingTurrets = startingTurrets.map((turretId, index) => ({
        definitionId: turretId,
        slotIndex: index + 1, // Slots are 1-indexed
        class: fortressClass,
      }));

      // Apply power upgrades for permanent stat bonuses
      config.powerData = sessionInfo.powerData;

      this.simulation = new Simulation(sessionInfo.seed, config);
      this.simulation.setAuditTicks(sessionInfo.segmentAuditTicks);

      // Initialize tracking
      this.events = [];
      this.checkpoints = [];
      this.lastChainHash = 0;
      this.lastCheckpointTick = 0;
      this.auditTickSet = new Set(sessionInfo.segmentAuditTicks);
      this.pendingSegmentSubmit = false;
      this.lastSnapshotTick = 0;
      this.lastFortressHp = sessionInfo.fortressBaseHp;
      this.lastLevel = sessionInfo.commanderLevel;

      this.phase = 'playing';
      this.callbacks.onStateChange();
      
      // Start background ambience
      audioManager.playSfx('ui_click');
      audioManager.playMusic('main');

      // Save initial session snapshot for recovery
      this.saveSessionSnapshot();

      return sessionInfo;
    } catch (error) {
      console.error('Failed to start session:', error);
      return null;
    }
  }

  /** Resume an existing endless session from a saved snapshot */
  async resumeEndlessSession(snapshot: ActiveSessionSnapshot): Promise<SessionStartResponse | null> {
    if (!snapshot.simulationState) {
      console.warn('Missing simulation state in snapshot; cannot resume session.');
      return null;
    }

    const config = getDefaultConfig();
    config.tickHz = snapshot.tickHz;
    config.startingWave = snapshot.startingWave;

    config.commanderLevel = snapshot.commanderLevel;
    config.progressionDamageBonus = snapshot.progressionBonuses.damageMultiplier;
    config.progressionGoldBonus = snapshot.progressionBonuses.goldMultiplier;
    config.startingGold = snapshot.progressionBonuses.startingGold;
    config.maxHeroSlots = snapshot.progressionBonuses.maxHeroSlots;

    const fortressClass = snapshot.fortressClass as FortressClass;
    config.fortressClass = fortressClass;
    config.startingHeroes = snapshot.startingHeroes;
    config.startingTurrets = snapshot.startingTurrets.map((turretId, index) => ({
      definitionId: turretId,
      slotIndex: index + 1,
      class: fortressClass,
    }));

    // Apply power upgrades from snapshot
    config.powerData = snapshot.powerData ? {
      ...snapshot.powerData,
      heroTiers: snapshot.powerData.heroTiers || {},
      turretTiers: snapshot.powerData.turretTiers || {},
    } : undefined;

    this.simulation = new Simulation(snapshot.seed, config);
    this.simulation.setAuditTicks(snapshot.segmentAuditTicks);
    this.simulation.state = snapshot.simulationState;
    this.simulation.setEvents(snapshot.events || []);

    this.sessionInfo = {
      sessionId: snapshot.sessionId,
      sessionToken: snapshot.sessionToken,
      seed: snapshot.seed,
      simVersion: snapshot.simVersion,
      tickHz: snapshot.tickHz,
      startingWave: snapshot.startingWave,
      segmentAuditTicks: snapshot.segmentAuditTicks,
      inventory: snapshot.inventory || { gold: 0, dust: 0 },
      commanderLevel: snapshot.commanderLevel,
      progressionBonuses: snapshot.progressionBonuses,
      fortressBaseHp: snapshot.fortressBaseHp,
      fortressBaseDamage: snapshot.fortressBaseDamage,
      waveIntervalTicks: snapshot.waveIntervalTicks,
      powerData: snapshot.powerData ? {
        ...snapshot.powerData,
        heroTiers: snapshot.powerData.heroTiers || {},
        turretTiers: snapshot.powerData.turretTiers || {},
      } : {
        fortressUpgrades: { statUpgrades: { hp: 0, damage: 0, attackSpeed: 0, range: 0, critChance: 0, critMultiplier: 0, armor: 0, dodge: 0 } },
        heroUpgrades: [],
        turretUpgrades: [],
        itemTiers: [],
        heroTiers: {},
        turretTiers: {},
      },
    };

    this.events = snapshot.events || [];
    this.checkpoints = snapshot.checkpoints || [];
    const fallbackChainHash = this.checkpoints.length > 0
      ? this.checkpoints[this.checkpoints.length - 1].chainHash32
      : 0;
    this.lastChainHash = snapshot.lastChainHash ?? fallbackChainHash;
    this.lastCheckpointTick = snapshot.lastCheckpointTick ?? 0;
    this.auditTickSet = new Set(snapshot.segmentAuditTicks);
    this.pendingSegmentSubmit = false;
    this.lastSnapshotTick = snapshot.lastSnapshotTick ?? snapshot.simulationState.tick;
    this.sessionOptions = {
      fortressClass,
      startingHeroes: snapshot.startingHeroes,
      startingTurrets: snapshot.startingTurrets,
    };

    this.phase = snapshot.phase === 'segment_submit' ? 'playing' : (snapshot.phase || 'playing');
    this.callbacks.onStateChange();

    return this.sessionInfo;
  }


  /** Advance the game simulation by one tick */
  step(): void {
    // Delegate to Boss Rush step if in boss_rush phase
    if (this.phase === 'boss_rush') {
      this.stepBossRush();
      return;
    }

    // Allow stepping during segment_submit to prevent game freeze
    if (!this.simulation || !['playing', 'segment_submit'].includes(this.phase)) return;

    const state = this.simulation.state;

    // Monitor fortress damage
    if (this.lastFortressHp > state.fortressHp) {
      audioManager.playSfx('fortress_damage');
    }
    this.lastFortressHp = state.fortressHp;

    // Monitor level up
    if (state.commanderLevel > this.lastLevel && this.lastLevel > 0) {
      audioManager.playSfx('level_up');
    }
    this.lastLevel = state.commanderLevel;

    // Check if we need to create a checkpoint
    const shouldCheckpoint =
      this.auditTickSet.has(state.tick) ||
      (state.tick > 0 && state.tick - this.lastCheckpointTick >= CONFIG.CHECKPOINT_INTERVAL);

    if (shouldCheckpoint) {
      const checkpoint = createCheckpoint(state, this.lastChainHash);
      this.checkpoints.push(checkpoint);
      this.lastChainHash = checkpoint.chainHash32;
      this.lastCheckpointTick = state.tick;
    }

    // Step simulation
    this.simulation.step();

    // Check for choice
    if (state.inChoice && state.pendingChoice && this.phase === 'playing') {
      this.phase = 'choice';
      this.callbacks.onChoiceRequired(state.pendingChoice.options);
    }

    // Check for segment boundary - but only if not in choice phase
    // We must wait for the player to choose a relic before submitting the segment
    // otherwise the choice gets blocked by segment_submit phase
    if (this.simulation.isSegmentBoundary() && !this.pendingSegmentSubmit && !state.inChoice) {
      // Check if we need to wait for retry delay (exponential backoff)
      const now = Date.now();
      const retryDelay = Game.BASE_RETRY_DELAY_MS * Math.pow(2, this.segmentSubmitRetryCount);
      const shouldRetry = this.segmentSubmitRetryCount === 0 ||
                          (now - this.segmentSubmitLastAttempt >= retryDelay);

      if (shouldRetry && this.segmentSubmitRetryCount < Game.MAX_SEGMENT_RETRIES) {
        this.pendingSegmentSubmit = true;
        this.segmentSubmitLastAttempt = now;
        this.submitCurrentSegment();
      }
    }

    // Check for game end
    if (state.ended) {
      this.phase = 'ended';
      this.onGameEnd().catch(err => console.error('Error during game end:', err));
    }

    // Periodically save session snapshot for page refresh recovery
    if (state.tick - this.lastSnapshotTick >= SESSION_SNAPSHOT_INTERVAL) {
      this.lastSnapshotTick = state.tick;
      this.saveSessionSnapshot();
    }

    this.callbacks.onStateChange();
  }

  private async submitCurrentSegment(): Promise<void> {
    if (!this.simulation || !this.sessionInfo) return;

    const segmentSummary = this.simulation.getSegmentSummary();

    this.phase = 'segment_submit';
    this.callbacks.onStateChange();

    try {
      const result = await submitSegment(this.sessionInfo.sessionId, {
        sessionToken: this.sessionInfo.sessionToken,
        startWave: segmentSummary.startWave,
        endWave: segmentSummary.endWave,
        events: this.events,
        checkpoints: this.checkpoints,
        finalHash: segmentSummary.finalHash,
      });

      if (result.verified) {
        // Update session with new audit ticks
        this.auditTickSet = new Set(result.nextSegmentAuditTicks);
        this.simulation.setAuditTicks(result.nextSegmentAuditTicks);

        // Reset segment tracking
        this.simulation.resetSegment();
        this.events = [];
        this.checkpoints = [];
        this.lastChainHash = segmentSummary.finalHash;

        // Reset retry state on success
        this.segmentSubmitRetryCount = 0;
        this.pendingSegmentSubmit = false;

        // Notify about rewards
        if (this.callbacks.onRewardsReceived) {
          this.callbacks.onRewardsReceived(
            result.goldEarned,
            result.dustEarned,
            result.xpEarned
          );
          
          // Play sounds for rewards/progress
          if (result.goldEarned > 0 || result.dustEarned > 0) {
            audioManager.playSfx('coin');
          }
        }
        
        audioManager.playSfx('wave_complete');

        // Analytics report available via analytics.generateReport() if needed for debugging

        if (this.callbacks.onSegmentComplete) {
          this.callbacks.onSegmentComplete(result);
        }

        // Save snapshot after successful segment submission
        this.saveSessionSnapshot();
      } else {
        console.error('Segment verification failed:', result.rejectReason);
        // End the session on verification failure to prevent further desync
        // Note: sessionInfo is guaranteed non-null by the guard at the start of this method
        const endResult = await endSession(this.sessionInfo.sessionId, 'verification_failed', undefined);
        this.phase = 'ended';
        this.callbacks.onGameEnd(false, endResult.newInventory, endResult.newProgression, endResult.finalWave);
        return;
      }
    } catch (error) {
      // Log detailed error info for debugging
      const errorData = (error as { data?: unknown })?.data;
      console.error('Failed to submit segment:', error, 'Server response:', errorData);
      // Increment retry counter and allow exponential backoff retry
      this.segmentSubmitRetryCount++;
      this.pendingSegmentSubmit = false; // Allow retry after delay
      if (this.segmentSubmitRetryCount >= Game.MAX_SEGMENT_RETRIES) {
        console.warn(`Segment submission failed after ${Game.MAX_SEGMENT_RETRIES} retries. Rewards will be saved at session end.`);
      }
    }

    this.phase = 'playing';
    this.callbacks.onStateChange();
  }

  /** End the current endless session manually */
  async endCurrentSession(): Promise<void> {
    if (!this.sessionInfo) return;

    // Clear saved session - user is ending manually
    clearActiveSession().catch(err => console.error('Failed to clear session:', err));

    let newInventory: { gold: number; dust: number } | undefined;
    let newProgression: { level: number; xp: number; totalXp: number; xpToNextLevel: number } | undefined;
    let finalWave: number | undefined;
    try {
      // Get partial rewards from current gameplay
      const partialRewards = this.getPartialRewards();
      const result = await endSession(this.sessionInfo.sessionId, 'manual', partialRewards);
      newInventory = result.newInventory;
      newProgression = result.newProgression;
      finalWave = result.finalWave;
    } catch (error) {
      console.error('Failed to end session:', error);
    }

    this.phase = 'ended';
    this.pendingSegmentSubmit = false;
    this.callbacks.onStateChange();
    this.callbacks.onGameEnd(false, newInventory, newProgression, finalWave); // Ended by player choice

  }

  private getPartialRewards(): PartialRewards | undefined {
    if (!this.simulation) return undefined;

    const state = this.simulation.state;
    // Get unsubmitted segment rewards (since last verified segment)
    // finalWave is the last COMPLETED wave, not the current wave
    // Because startNextWave() does wave++ before spawning enemies,
    // we need to save wave - 1 so the player resumes at the wave they died on
    return {
      gold: state.segmentGoldEarned,
      dust: state.segmentDustEarned,
      xp: state.segmentXpEarned,
      finalWave: state.wave - 1,
    };
  }

  /** Choose a relic from the pending choice options */
  chooseRelic(optionIndex: number): void {
    if (!this.simulation || this.phase !== 'choice') return;

    const state = this.simulation.state;
    if (!state.pendingChoice) return;

    // Validate optionIndex bounds
    if (optionIndex < 0 || optionIndex >= state.pendingChoice.options.length) {
      console.error(`Invalid optionIndex ${optionIndex} for ${state.pendingChoice.options.length} options`);
      return;
    }

    // Check if we're at a segment boundary BEFORE processing the choice
    // After step(), the wave will increment and we'll miss the boundary
    const wasAtSegmentBoundary = this.simulation.isSegmentBoundary() && !this.pendingSegmentSubmit;

    const event: GameEvent = {
      type: 'CHOOSE_RELIC',
      tick: state.tick,
      wave: state.pendingChoice.wave,
      optionIndex,
    };

    this.events.push(event);
    this.simulation.setEvents([...this.events]);

    // Process the event
    this.simulation.step();

    // Check state after step - game may have ended or triggered another choice
    const newState = this.simulation.state;
    if (newState.ended) {
      this.phase = 'ended';
      this.onGameEnd().catch(err => console.error('Error during game end:', err));
    } else if (newState.inChoice && newState.pendingChoice) {
      // Another choice was triggered - stay in choice phase
      this.callbacks.onChoiceRequired(newState.pendingChoice.options);
    } else {
      this.phase = 'playing';

      // Submit segment if we were at a boundary before the choice
      // The wave has now incremented, so we must use the saved boundary state
      if (wasAtSegmentBoundary) {
        this.pendingSegmentSubmit = true;
        this.submitCurrentSegment();
      }
    }
    this.callbacks.onStateChange();
  }

  /** Activate the Crystal Matrix Annihilation Wave ability */
  activateAnnihilation(): void {
    if (!this.simulation || this.phase !== 'playing') return;

    const state = this.simulation.state;

    // Check if matrix is assembled and ready
    if (!state.matrixState?.isAssembled) return;
    if (state.matrixState.annihilationCooldown > 0) return;
    if (state.enemies.length === 0) return;

    const event: GameEvent = {
      type: 'ACTIVATE_SNAP',
      tick: state.tick,
    };

    audioManager.playSfx('skill_activate');
    this.events.push(event);
    this.simulation.setEvents([...this.events]);
  }

  /** Issue a tactical movement command to a specific hero */
  issueHeroCommand(heroId: string, targetX: number, targetY: number): void {
    if (!this.simulation || this.phase !== 'playing') return;

    const state = this.simulation.state;

    // Verify hero exists and can be commanded
    const hero = state.heroes.find(h => h.definitionId === heroId);
    if (!hero) return;
    if (hero.state === 'dead' || hero.state === 'cooldown') return;

    const event: GameEvent = {
      type: 'HERO_COMMAND',
      tick: state.tick,
      heroId,
      targetX,
      targetY,
    };

    this.events.push(event);
    this.simulation.setEvents([...this.events]);
  }

  /** Activate a fortress skill at a target location */
  activateFortressSkill(skillId: string, targetX: number, targetY: number): void {
    if (!this.simulation || this.phase !== 'playing') return;

    const state = this.simulation.state;

    // Verify skill is unlocked
    if (!state.activeSkills.includes(skillId)) return;

    // Verify skill is not on cooldown
    if ((state.skillCooldowns[skillId] || 0) > 0) return;

    const event: GameEvent = {
      type: 'ACTIVATE_SKILL',
      tick: state.tick,
      skillId,
      targetX,
      targetY,
    };

    audioManager.playSfx('skill_activate');
    this.events.push(event);
    this.simulation.setEvents([...this.events]);
  }

  /** Check if Annihilation Wave is ready to use */
  isAnnihilationReady(): boolean {
    if (!this.simulation) return false;
    const state = this.simulation.state;
    return (
      state.gauntletState?.isAssembled === true &&
      state.gauntletState.annihilationCooldown === 0 &&
      state.enemies.length > 0
    );
  }

  private async onGameEnd(): Promise<void> {
    // Clear saved session - game is over
    clearActiveSession().catch(err => console.error('Failed to clear session:', err));

    // Session auto-ends when player dies
    let newInventory: { gold: number; dust: number } | undefined;
    let newProgression: { level: number; xp: number; totalXp: number; xpToNextLevel: number } | undefined;
    let finalWave: number | undefined;
    if (this.sessionInfo) {
      try {
        const partialRewards = this.getPartialRewards();
        const result = await endSession(this.sessionInfo.sessionId, 'death', partialRewards);
        newInventory = result.newInventory;
        newProgression = result.newProgression;
        finalWave = result.finalWave;
      } catch (error) {
        console.error('Failed to end session on death:', error);
      }
    }
    this.callbacks.onGameEnd(false, newInventory, newProgression, finalWave);
  }

  /** Reset the game to initial state */
  reset(): void {
    // Clear saved session on reset
    clearActiveSession().catch(err => console.error('Failed to clear session:', err));

    this.simulation = null;
    this.sessionInfo = null;
    this.events = [];
    this.checkpoints = [];
    this.lastChainHash = 0;
    this.lastCheckpointTick = 0;
    this.lastSnapshotTick = 0;
    this.auditTickSet.clear();
    this.pendingSegmentSubmit = false;
    this.segmentSubmitRetryCount = 0;
    this.segmentSubmitLastAttempt = 0;
    this.sessionOptions = {};
    this.phase = 'idle';
    this.callbacks.onStateChange();
  }

  /** Save session snapshot to IndexedDB for page refresh recovery */
  private saveSessionSnapshot(): void {
    if (!this.sessionInfo || !this.simulation) return;

    const snapshot: ActiveSessionSnapshot = {
      sessionId: this.sessionInfo.sessionId,
      sessionToken: this.sessionInfo.sessionToken,
      seed: this.sessionInfo.seed,
      simVersion: this.sessionInfo.simVersion,
      tickHz: this.sessionInfo.tickHz,
      startingWave: this.sessionInfo.startingWave,
      commanderLevel: this.sessionInfo.commanderLevel,
      progressionBonuses: this.sessionInfo.progressionBonuses,
      inventory: this.sessionInfo.inventory,
      segmentAuditTicks: Array.from(this.auditTickSet),
      fortressClass: this.sessionOptions.fortressClass || 'natural',
      startingHeroes: this.sessionOptions.startingHeroes || [],
      startingTurrets: this.sessionOptions.startingTurrets || [],
      fortressBaseHp: this.sessionInfo.fortressBaseHp,
      fortressBaseDamage: this.sessionInfo.fortressBaseDamage,
      waveIntervalTicks: this.sessionInfo.waveIntervalTicks,
      powerData: this.sessionInfo.powerData,
      simulationState: this.simulation.state,
      events: this.events,
      checkpoints: this.checkpoints,
      lastChainHash: this.lastChainHash,
      lastCheckpointTick: this.lastCheckpointTick,
      pendingSegmentSubmit: this.pendingSegmentSubmit,
      phase: this.phase,
      lastSnapshotTick: this.lastSnapshotTick,
      savedAt: Date.now(),
    };

    // Defer session save to idle time to avoid blocking gameplay
    deferTask(() => {
      saveActiveSession(snapshot).catch(err =>
        console.error('Failed to save session snapshot:', err)
      );
    });
  }

  // ============================================================================
  // BOSS RUSH MODE
  // ============================================================================

  /** Check if currently in Boss Rush mode */
  isBossRush(): boolean {
    return this.phase === 'boss_rush' && bossRushActive.value;
  }

  /** Get Boss Rush state */
  getBossRushState(): BossRushState | null {
    return this.bossRushState;
  }

  /** Start a new Boss Rush session */
  async startBossRushSession(options: SessionStartOptions = {}): Promise<BossRushStartResponse | null> {
    const {
      fortressClass = 'natural',
      startingHeroes = [],
      startingTurrets = [],
    } = options;

    this.sessionOptions = { fortressClass, startingHeroes, startingTurrets };

    try {
      // Request new Boss Rush session from server
      const sessionInfo = await apiStartBossRush({
        fortressClass,
        heroIds: startingHeroes,
        turretTypes: startingTurrets,
      });

      this.bossRushSessionInfo = sessionInfo;

      // Initialize Boss Rush state
      this.bossRushState = createBossRushState();
      this.events = [];
      this.checkpoints = [];
      this.lastChainHash = 0;
      this.lastCheckpointTick = 0;

      // Create simulation with Boss Rush config
      const config = getDefaultConfig();
      config.tickHz = 30;
      config.fortressClass = fortressClass;
      config.startingHeroes = startingHeroes;
      config.startingTurrets = startingTurrets.map((turretId, index) => ({
        definitionId: turretId,
        slotIndex: index + 1,
        class: fortressClass,
      }));

      // Boss Rush uses a special config - no waves, just boss spawning
      config.startingWave = 0;

      this.simulation = new Simulation(sessionInfo.seed, config);

      // Initialize signals
      initBossRushSession(
        sessionInfo.sessionId,
        sessionInfo.sessionToken,
        sessionInfo.seed
      );

      // Spawn the first boss
      this.spawnNextBoss();

      this.phase = 'boss_rush';
      this.callbacks.onStateChange();

      return sessionInfo;
    } catch (error) {
      console.error('Failed to start Boss Rush session:', error);
      return null;
    }
  }

  /** Spawn the next boss in the Boss Rush sequence */
  private spawnNextBoss(): void {
    if (!this.simulation || !this.bossRushState) return;

    const bossStats = getBossRushBossStats(
      this.bossRushState.currentBossIndex,
      DEFAULT_BOSS_RUSH_CONFIG
    );
    this.currentBossStats = bossStats;

    // Update Boss Rush state
    this.bossRushState.currentBossMaxHp = bossStats.hp;
    this.bossRushState.currentBossDamage = 0;

    // Spawn boss as an enemy entity in the simulation
    const state = this.simulation.state;

    // Get spawn position (right side of field)
    const spawnX = FP.fromInt(35); // Near right edge
    const laneY = FP.fromInt(6);   // Center lane (lane 1)

    const bossEnemy: Enemy = {
      id: state.nextEnemyId++,
      type: bossStats.type,
      hp: bossStats.hp,
      maxHp: bossStats.hp,

      // Position (fixed-point)
      x: spawnX,
      y: laneY,

      // Physics (fixed-point)
      vx: FP.mul(bossStats.speed, FP.fromInt(-1)), // Moving left toward fortress
      vy: 0,
      speed: bossStats.speed,
      baseSpeed: bossStats.speed, // Store original speed for effect recovery
      radius: ENEMY_PHYSICS.defaultRadius,
      mass: ENEMY_PHYSICS.defaultMass,

      damage: bossStats.damage,
      isElite: false, // Bosses are treated as special, not elite
      hitFlashTicks: 0,
      lastAttackTick: 0,

      // Lane info
      lane: 1, // Center lane
      targetLane: 1,
      canSwitchLane: false, // Bosses don't switch lanes
      laneSwitchCooldown: 0,

      // Status effects
      activeEffects: [],
    };

    state.enemies.push(bossEnemy);
    this.bossEntityId = bossEnemy.id;
    this.lastBossDamageCheck = bossStats.hp;
    
    // Play boss spawn sound
    audioManager.playSfx('boss_spawn');

    // Update signals for UI
    updateBossState(
      bossStats.bossIndex,
      bossStats.type,
      bossStats.name,
      bossStats.pillarId,
      bossStats.hp,
      bossStats.hp,
      bossStats.cycle
    );

    // End intermission if active
    signalEndIntermission();

    console.log(`Boss Rush: Spawned ${bossStats.name} (Cycle ${bossStats.cycle + 1}, Boss ${(bossStats.bossIndex % 7) + 1}/7)`);
  }

  /** Advance the Boss Rush simulation by one tick */
  stepBossRush(): void {
    if (!this.simulation || !this.bossRushState || this.phase !== 'boss_rush') return;

    const state = this.simulation.state;

    // Handle intermission countdown
    if (this.bossRushState.inIntermission) {
      const ticksRemaining = this.bossRushState.intermissionEndTick - state.tick;
      if (ticksRemaining <= 0) {
        endBossRushIntermission(this.bossRushState, state.tick);
        this.spawnNextBoss();
      } else {
        // Update countdown signal (convert ticks to seconds)
        const secondsRemaining = Math.ceil(ticksRemaining / 30);
        updateIntermissionCountdown(secondsRemaining);
      }
      this.simulation.step();
      this.callbacks.onStateChange();
      return;
    }

    // Step simulation
    this.simulation.step();

    // Track damage dealt to boss
    if (this.bossEntityId !== null) {
      const bossEnemy = state.enemies.find(e => e.id === this.bossEntityId);

      if (bossEnemy) {
        // Calculate damage dealt this tick
        const damageDealt = this.lastBossDamageCheck - bossEnemy.hp;
        if (damageDealt > 0) {
          recordBossRushDamage(this.bossRushState, damageDealt);
          updateDamageDealt(damageDealt);
          this.lastBossDamageCheck = bossEnemy.hp;

          // Update boss HP in UI
          updateBossState(
            this.bossRushState.currentBossIndex,
            this.currentBossStats!.type,
            this.currentBossStats!.name,
            this.currentBossStats!.pillarId,
            bossEnemy.hp,
            bossEnemy.maxHp,
            this.bossRushState.currentCycle
          );
        }

        // Check if boss is dead
        if (bossEnemy.hp <= 0) {
          this.onBossKilled();
        }
      } else {
        // Boss entity not found - it was killed
        this.onBossKilled();
      }
    }

    // Check for fortress destruction (player death)
    if (state.fortressHp <= 0 || state.ended) {
      this.onBossRushDeath();
      return;
    }

    this.callbacks.onStateChange();
  }

  /** Handle boss being killed */
  private onBossKilled(): void {
    if (!this.simulation || !this.bossRushState) return;

    const state = this.simulation.state;
    const startTime = bossRushStartTime.value || Date.now();
    const killTimeMs = Date.now() - startTime;

    // Record the kill in state
    processBossKill(this.bossRushState, state.tick, DEFAULT_BOSS_RUSH_CONFIG);

    // Update signals
    signalRecordBossKill(killTimeMs);

    // Update rewards in signals
    updateBossRushRewards(
      this.bossRushState.goldEarned,
      this.bossRushState.dustEarned,
      this.bossRushState.materialsEarned
    );

    // Start intermission before next boss
    startBossRushIntermission(this.bossRushState, state.tick, DEFAULT_BOSS_RUSH_CONFIG);
    signalStartIntermission(DEFAULT_BOSS_RUSH_CONFIG.intermissionTicks / 30);

    // Clear boss entity reference
    this.bossEntityId = null;
    this.currentBossStats = null;

    console.log(`Boss Rush: Boss killed! Total damage: ${this.bossRushState.totalDamageDealt}, Bosses killed: ${this.bossRushState.bossesKilled}`);
  }

  /** Handle player death in Boss Rush */
  private async onBossRushDeath(): Promise<void> {
    if (!this.bossRushState || !this.bossRushSessionInfo || !this.simulation) return;

    const startTime = bossRushStartTime.value || Date.now();
    const deathTimeMs = Date.now() - startTime;

    // Record partial damage to current boss
    recordBossDeath(deathTimeMs);

    // Generate summary
    const summary = generateBossRushSummary(this.bossRushState);
    const timeSurvived = this.simulation.state.tick;

    try {
      // Submit results to server
      const result = await apiFinishBossRush(this.bossRushSessionInfo.sessionId, {
        sessionToken: this.bossRushSessionInfo.sessionToken,
        events: this.events,
        checkpoints: this.checkpoints,
        finalHash: this.lastChainHash,
        summary: {
          totalDamageDealt: summary.totalDamageDealt,
          bossesKilled: summary.bossesKilled,
          cyclesCompleted: summary.cyclesCompleted,
          goldEarned: summary.goldEarned,
          dustEarned: summary.dustEarned,
          materialsEarned: summary.materialsEarned,
          timeSurvived,
        },
      });

      // Show end screen
      showBossRushEnd({
        verified: result.verified,
        rewards: result.rewards,
        rejectReason: result.rejectReason,
        leaderboardRank: result.leaderboardRank,
      });

      // Notify callback
      if (this.callbacks.onBossRushEnd) {
        this.callbacks.onBossRushEnd(result);
      }
    } catch (error) {
      console.error('Failed to submit Boss Rush results:', error);
      // Still show end screen with local data
      showBossRushEnd({
        verified: false,
        rejectReason: 'Failed to submit results',
      });
    }

    this.phase = 'ended';
    this.callbacks.onStateChange();
  }

  /** Manually end Boss Rush session */
  async endBossRushSession(): Promise<void> {
    if (this.phase === 'boss_rush') {
      await this.onBossRushDeath();
    }
  }

  /** Reset Boss Rush state */
  resetBossRush(): void {
    this.bossRushState = null;
    this.bossRushSessionInfo = null;
    this.currentBossStats = null;
    this.bossEntityId = null;
    this.lastBossDamageCheck = 0;
    resetBossRushState();
  }
}
