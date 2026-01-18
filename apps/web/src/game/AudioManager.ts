import { effect } from '@preact/signals';
import { audioSettings } from '../state/settings.signals.js';

/**
 * Audio Manager - Handles all game audio using Web Audio API
 *
 * Uses procedural sound synthesis for SFX (no audio files needed)
 * Ready to load audio files when available
 */
class AudioManager {
  private static instance: AudioManager;

  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private isInitialized = false;
  private isResumed = false;

  // Music state
  private currentMusic: OscillatorNode | AudioBufferSourceNode | null = null;

  private constructor() {
    this.setupSettingsListener();
    this.setupUserGestureHandler();
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  /**
   * Initialize AudioContext (called on user gesture)
   */
  private async initContext(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Create gain nodes
      this.masterGain = this.context.createGain();
      this.sfxGain = this.context.createGain();
      this.musicGain = this.context.createGain();

      // Connect: sfx/music -> master -> destination
      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(this.context.destination);

      this.isInitialized = true;
      this.updateVolumes();

      console.log('[AudioManager] Initialized successfully');
    } catch (error) {
      console.error('[AudioManager] Failed to initialize:', error);
    }
  }

  /**
   * Resume context if suspended (required for Chrome autoplay policy)
   */
  private async resumeContext(): Promise<void> {
    if (!this.context || this.isResumed) return;

    if (this.context.state === 'suspended') {
      try {
        await this.context.resume();
        this.isResumed = true;
        console.log('[AudioManager] Context resumed');
      } catch (error) {
        console.error('[AudioManager] Failed to resume context:', error);
      }
    } else {
      this.isResumed = true;
    }
  }

  /**
   * Setup listener for first user interaction
   */
  private setupUserGestureHandler(): void {
    const handler = async () => {
      await this.initContext();
      await this.resumeContext();

      // Remove listeners after first interaction
      document.removeEventListener('click', handler);
      document.removeEventListener('keydown', handler);
      document.removeEventListener('touchstart', handler);
    };

    document.addEventListener('click', handler, { once: true });
    document.addEventListener('keydown', handler, { once: true });
    document.addEventListener('touchstart', handler, { once: true });
  }

  /**
   * Listen to settings changes
   */
  private setupSettingsListener(): void {
    effect(() => {
      const settings = audioSettings.value;
      this.updateVolumes();

      if (settings.muted) {
        this.mute();
      } else {
        this.unmute();
      }
    });
  }

  /**
   * Update gain nodes based on settings
   */
  private updateVolumes(): void {
    if (!this.masterGain || !this.sfxGain || !this.musicGain) return;

    const settings = audioSettings.value;
    const currentTime = this.context?.currentTime ?? 0;

    // Smooth volume transitions
    this.masterGain.gain.setTargetAtTime(settings.masterVolume, currentTime, 0.1);
    this.sfxGain.gain.setTargetAtTime(settings.sfxVolume, currentTime, 0.1);
    this.musicGain.gain.setTargetAtTime(settings.musicVolume, currentTime, 0.1);
  }

  private mute(): void {
    if (this.masterGain && this.context) {
      this.masterGain.gain.setTargetAtTime(0, this.context.currentTime, 0.1);
    }
  }

  private unmute(): void {
    if (this.masterGain && this.context) {
      this.masterGain.gain.setTargetAtTime(
        audioSettings.value.masterVolume,
        this.context.currentTime,
        0.1
      );
    }
  }

  // ============================================================================
  // SFX - Procedural Sound Synthesis
  // ============================================================================

  /**
   * Play a sound effect
   */
  public playSfx(id: string): void {
    if (!this.context || !this.sfxGain || audioSettings.value.muted) return;
    if (this.context.state === 'suspended') return;

    switch (id) {
      case 'hit':
        this.playHitSound();
        break;
      case 'explosion':
        this.playExplosionSound();
        break;
      case 'ui_click':
        this.playClickSound();
        break;
      case 'skill_activate':
        this.playSkillSound();
        break;
      case 'wave_complete':
        this.playWaveCompleteSound();
        break;
      case 'level_up':
        this.playLevelUpSound();
        break;
      case 'coin':
        this.playCoinSound();
        break;
      case 'error':
        this.playErrorSound();
        break;
      case 'fortress_damage':
        this.playFortressDamageSound();
        break;
      case 'purchase':
        this.playPurchaseSound();
        break;
      case 'boss_spawn':
        this.playBossSpawnSound();
        break;
      case 'combo':
        this.playComboSound();
        break;
      case 'duo_attack':
        this.playDuoAttackSound();
        break;
      case 'duo_thunder_guard':
        this.playDuoThunderGuardSound();
        break;
      case 'duo_void_storm':
        this.playDuoVoidStormSound();
        break;
      case 'duo_frozen_inferno':
        this.playDuoFrozenInfernoSound();
        break;
      case 'duo_phase_strike':
        this.playDuoPhaseStrikeSound();
        break;
      case 'duo_cryo_artillery':
        this.playDuoCryoArtillerySound();
        break;
      case 'duo_reality_tear':
        this.playDuoRealityTearSound();
        break;
      case 'duo_inferno_storm':
        this.playDuoInfernoStormSound();
        break;
      case 'duo_glacier_shield':
        this.playDuoGlacierShieldSound();
        break;
      case 'duo_phantom_frost':
        this.playDuoPhantomFrostSound();
        break;
      case 'duo_tech_void':
        this.playDuoTechVoidSound();
        break;
      case 'duo_nature_fire':
        this.playDuoNatureFireSound();
        break;
      case 'duo_plasma_phase':
        this.playDuoPlasmaPhaseSound();
        break;
      default:
        // Default blip for unknown sounds
        this.playBlip(440, 0.1);
    }
  }

  /**
   * Hit sound - short high-pitched noise
   */
  private playHitSound(): void {
    if (!this.context || !this.sfxGain) return;

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(200 + Math.random() * 100, this.context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.context.currentTime + 0.1);

    gain.gain.setValueAtTime(0.3, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.context.currentTime + 0.1);
  }

  /**
   * Explosion sound - low rumble with noise
   */
  private playExplosionSound(): void {
    if (!this.context || !this.sfxGain) return;

    // Create noise
    const bufferSize = this.context.sampleRate * 0.3;
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
    }

    const noise = this.context.createBufferSource();
    noise.buffer = buffer;

    // Low-pass filter for rumble
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, this.context.currentTime);
    filter.frequency.exponentialRampToValueAtTime(50, this.context.currentTime + 0.3);

    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.5, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.3);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start();
  }

  /**
   * UI Click - short high beep
   */
  private playClickSound(): void {
    this.playBlip(800, 0.05, 'sine');
  }

  /**
   * Skill activation - ascending tones
   */
  private playSkillSound(): void {
    if (!this.context || !this.sfxGain) return;

    const frequencies = [400, 600, 800];
    const now = this.context.currentTime;

    frequencies.forEach((freq, i) => {
      const osc = this.context!.createOscillator();
      const gain = this.context!.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, now + i * 0.05);
      gain.gain.linearRampToValueAtTime(0.2, now + i * 0.05 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.1);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.1);
    });
  }

  /**
   * Wave complete - triumphant fanfare
   */
  private playWaveCompleteSound(): void {
    if (!this.context || !this.sfxGain) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const now = this.context.currentTime;

    notes.forEach((freq, i) => {
      const osc = this.context!.createOscillator();
      const gain = this.context!.createGain();

      osc.type = 'triangle';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.25, now + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.3);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.3);
    });
  }

  /**
   * Level up - epic ascending scale
   */
  private playLevelUpSound(): void {
    if (!this.context || !this.sfxGain) return;

    const scale = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]; // C4 major up to G5
    const now = this.context.currentTime;

    scale.forEach((freq, i) => {
      const osc = this.context!.createOscillator();
      const gain = this.context!.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      const start = now + i * 0.06;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.3, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(start);
      osc.stop(start + 0.2);
    });
  }

  /**
   * Coin pickup sound
   */
  private playCoinSound(): void {
    if (!this.context || !this.sfxGain) return;

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, this.context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1800, this.context.currentTime + 0.05);

    gain.gain.setValueAtTime(0.2, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.context.currentTime + 0.15);
  }

  /**
   * Error sound - descending dissonant tones
   */
  private playErrorSound(): void {
    if (!this.context || !this.sfxGain) return;

    const osc1 = this.context.createOscillator();
    const osc2 = this.context.createOscillator();
    const gain = this.context.createGain();

    osc1.type = 'square';
    osc2.type = 'square';
    osc1.frequency.value = 200;
    osc2.frequency.value = 250; // Dissonant interval

    gain.gain.setValueAtTime(0.15, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.2);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start();
    osc2.start();
    osc1.stop(this.context.currentTime + 0.2);
    osc2.stop(this.context.currentTime + 0.2);
  }
  
  /**
   * Fortress damage - heavy metallic thud
   */
  private playFortressDamageSound(): void {
    if (!this.context || !this.sfxGain) return;
    
    // Low rumble
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, this.context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.context.currentTime + 0.2);
    
    gain.gain.setValueAtTime(0.4, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.3);
    
    osc.connect(gain);
    gain.connect(this.sfxGain);
    
    osc.start();
    osc.stop(this.context.currentTime + 0.3);
    
    // Sharp metal impact
    const clickOsc = this.context.createOscillator();
    const clickGain = this.context.createGain();
    
    clickOsc.type = 'square';
    clickOsc.frequency.setValueAtTime(400, this.context.currentTime);
    clickOsc.frequency.exponentialRampToValueAtTime(100, this.context.currentTime + 0.05);
    
    clickGain.gain.setValueAtTime(0.2, this.context.currentTime);
    clickGain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.05);
    
    clickOsc.connect(clickGain);
    clickGain.connect(this.sfxGain);
    
    clickOsc.start();
    clickOsc.stop(this.context.currentTime + 0.05);
  }
  
  /**
   * Purchase sound - "cha-ching" digital style
   */
  private playPurchaseSound(): void {
    if (!this.context || !this.sfxGain) return;
    
    const now = this.context.currentTime;
    
    // First high beep
    const osc1 = this.context.createOscillator();
    const gain1 = this.context.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(900, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.2, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc1.connect(gain1);
    gain1.connect(this.sfxGain);
    osc1.start(now);
    osc1.stop(now + 0.1);
    
    // Second higher beep
    const osc2 = this.context.createOscillator();
    const gain2 = this.context.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1500, now + 0.08);
    gain2.gain.setValueAtTime(0, now + 0.08);
    gain2.gain.linearRampToValueAtTime(0.2, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc2.connect(gain2);
    gain2.connect(this.sfxGain);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.25);
  }
  
  /**
   * Boss spawn - ominous rising swell
   */
  private playBossSpawnSound(): void {
    if (!this.context || !this.sfxGain) return;
    
    const now = this.context.currentTime;
    const duration = 1.5;
    
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(40, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + duration);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(100, now);
    filter.frequency.exponentialRampToValueAtTime(1000, now + duration);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + duration * 0.8);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    
    osc.start(now);
    osc.stop(now + duration);
  }

  /**
   * Combo activation sound - energetic dual tones
   */
  private playComboSound(): void {
    if (!this.context || !this.sfxGain) return;

    const now = this.context.currentTime;

    // Rising sweep
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.2);

    // Impact
    const impactOsc = this.context.createOscillator();
    const impactGain = this.context.createGain();

    impactOsc.type = 'triangle';
    impactOsc.frequency.setValueAtTime(600, now + 0.1);

    impactGain.gain.setValueAtTime(0, now + 0.1);
    impactGain.gain.linearRampToValueAtTime(0.3, now + 0.12);
    impactGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    impactOsc.connect(impactGain);
    impactGain.connect(this.sfxGain);

    impactOsc.start(now + 0.1);
    impactOsc.stop(now + 0.25);
  }

  /**
   * Generic duo-attack sound - powerful harmonic burst
   */
  private playDuoAttackSound(): void {
    if (!this.context || !this.sfxGain) return;

    const now = this.context.currentTime;

    // Dual harmonics for "duo" effect
    [1, 1.5].forEach((mult) => {
      const osc = this.context!.createOscillator();
      const gain = this.context!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(200 * mult, now);
      osc.frequency.exponentialRampToValueAtTime(600 * mult, now + 0.2);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(now);
      osc.stop(now + 0.4);
    });

    // Impact burst
    this.playExplosionSound();
  }

  /**
   * Thunder Guard - electric crackle with shield resonance
   */
  private playDuoThunderGuardSound(): void {
    if (!this.context || !this.sfxGain) return;

    const now = this.context.currentTime;

    // Lightning crackle (noise burst)
    const bufferSize = this.context.sampleRate * 0.3;
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 5) * (Math.random() > 0.7 ? 1 : 0.3);
    }

    const noise = this.context.createBufferSource();
    noise.buffer = buffer;

    const filter = this.context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;

    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(now);

    // Shield resonance (low hum)
    const shieldOsc = this.context.createOscillator();
    const shieldGain = this.context.createGain();

    shieldOsc.type = 'sine';
    shieldOsc.frequency.setValueAtTime(100, now);

    shieldGain.gain.setValueAtTime(0.3, now);
    shieldGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    shieldOsc.connect(shieldGain);
    shieldGain.connect(this.sfxGain);

    shieldOsc.start(now);
    shieldOsc.stop(now + 0.5);
  }

  /**
   * Void Storm - deep rumble with swirling effect
   */
  private playDuoVoidStormSound(): void {
    if (!this.context || !this.sfxGain) return;

    const now = this.context.currentTime;

    // Deep void rumble
    const osc1 = this.context.createOscillator();
    const osc2 = this.context.createOscillator();
    const gain = this.context.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(50, now);
    osc2.frequency.setValueAtTime(75, now);

    // Modulate for swirl effect
    const lfo = this.context.createOscillator();
    const lfoGain = this.context.createGain();
    lfo.frequency.value = 8;
    lfoGain.gain.value = 20;
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfo.start(now);
    lfo.stop(now + 0.6);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.6);
    osc2.stop(now + 0.6);
  }

  /**
   * Frozen Inferno - ice crack followed by fire whoosh
   */
  private playDuoFrozenInfernoSound(): void {
    if (!this.context || !this.sfxGain) return;

    const now = this.context.currentTime;

    // Ice crack
    const crackOsc = this.context.createOscillator();
    const crackGain = this.context.createGain();

    crackOsc.type = 'square';
    crackOsc.frequency.setValueAtTime(2000, now);
    crackOsc.frequency.exponentialRampToValueAtTime(100, now + 0.1);

    crackGain.gain.setValueAtTime(0.3, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    crackOsc.connect(crackGain);
    crackGain.connect(this.sfxGain);

    crackOsc.start(now);
    crackOsc.stop(now + 0.1);

    // Fire whoosh (filtered noise)
    const bufferSize = this.context.sampleRate * 0.4;
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      data[i] = (Math.random() * 2 - 1) * (1 - t);
    }

    const noise = this.context.createBufferSource();
    noise.buffer = buffer;

    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(300, now + 0.1);
    filter.frequency.exponentialRampToValueAtTime(1500, now + 0.3);

    const noiseGain = this.context.createGain();
    noiseGain.gain.setValueAtTime(0, now + 0.1);
    noiseGain.gain.linearRampToValueAtTime(0.4, now + 0.2);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);

    noise.start(now + 0.1);
  }

  /**
   * Phase Strike - quick phase shift with sharp impact
   */
  private playDuoPhaseStrikeSound(): void {
    if (!this.context || !this.sfxGain) return;

    const now = this.context.currentTime;

    // Phase shift whoosh (descending)
    const phaseOsc = this.context.createOscillator();
    const phaseGain = this.context.createGain();

    phaseOsc.type = 'sine';
    phaseOsc.frequency.setValueAtTime(1500, now);
    phaseOsc.frequency.exponentialRampToValueAtTime(100, now + 0.15);

    phaseGain.gain.setValueAtTime(0.25, now);
    phaseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    phaseOsc.connect(phaseGain);
    phaseGain.connect(this.sfxGain);

    phaseOsc.start(now);
    phaseOsc.stop(now + 0.15);

    // Sharp impact
    const impactOsc = this.context.createOscillator();
    const impactGain = this.context.createGain();

    impactOsc.type = 'triangle';
    impactOsc.frequency.setValueAtTime(800, now + 0.12);
    impactOsc.frequency.exponentialRampToValueAtTime(200, now + 0.2);

    impactGain.gain.setValueAtTime(0, now + 0.12);
    impactGain.gain.linearRampToValueAtTime(0.4, now + 0.13);
    impactGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    impactOsc.connect(impactGain);
    impactGain.connect(this.sfxGain);

    impactOsc.start(now + 0.12);
    impactOsc.stop(now + 0.25);
  }

  /**
   * Cryo Artillery - orbital descent with ice impact
   */
  private playDuoCryoArtillerySound(): void {
    if (!this.context || !this.sfxGain) return;

    const now = this.context.currentTime;

    // Incoming whistle
    const whistleOsc = this.context.createOscillator();
    const whistleGain = this.context.createGain();

    whistleOsc.type = 'sine';
    whistleOsc.frequency.setValueAtTime(2000, now);
    whistleOsc.frequency.exponentialRampToValueAtTime(200, now + 0.3);

    whistleGain.gain.setValueAtTime(0.1, now);
    whistleGain.gain.linearRampToValueAtTime(0.3, now + 0.25);
    whistleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    whistleOsc.connect(whistleGain);
    whistleGain.connect(this.sfxGain);

    whistleOsc.start(now);
    whistleOsc.stop(now + 0.35);

    // Ice explosion impact
    const impactOsc = this.context.createOscillator();
    const impactGain = this.context.createGain();

    impactOsc.type = 'sawtooth';
    impactOsc.frequency.setValueAtTime(150, now + 0.3);
    impactOsc.frequency.exponentialRampToValueAtTime(50, now + 0.5);

    impactGain.gain.setValueAtTime(0, now + 0.3);
    impactGain.gain.linearRampToValueAtTime(0.4, now + 0.32);
    impactGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    impactOsc.connect(impactGain);
    impactGain.connect(this.sfxGain);

    impactOsc.start(now + 0.3);
    impactOsc.stop(now + 0.6);
  }

  /**
   * Reality Tear - dimensional rip with echoing void
   */
  private playDuoRealityTearSound(): void {
    if (!this.context || !this.sfxGain) return;

    const now = this.context.currentTime;

    // Tearing sound (noise with envelope)
    const bufferSize = this.context.sampleRate * 0.5;
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      // Tearing pattern
      data[i] = (Math.random() * 2 - 1) * Math.sin(t * Math.PI) * (Math.random() > 0.5 ? 1 : 0.5);
    }

    const noise = this.context.createBufferSource();
    noise.buffer = buffer;

    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 2;

    const noiseGain = this.context.createGain();
    noiseGain.gain.setValueAtTime(0.35, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);

    noise.start(now);

    // Void echo (low reverberating tone)
    const voidOsc = this.context.createOscillator();
    const voidGain = this.context.createGain();

    voidOsc.type = 'sine';
    voidOsc.frequency.setValueAtTime(60, now);

    voidGain.gain.setValueAtTime(0.3, now);
    voidGain.gain.setValueAtTime(0.15, now + 0.3);
    voidGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    voidOsc.connect(voidGain);
    voidGain.connect(this.sfxGain);

    voidOsc.start(now);
    voidOsc.stop(now + 0.8);
  }

  /**
   * Inferno Storm - Fire and lightning combined
   */
  private playDuoInfernoStormSound(): void {
    if (!this.context || !this.sfxGain) return;

    const now = this.context.currentTime;

    // Fire crackle noise
    const bufferSize = this.context.sampleRate * 0.4;
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      // Crackling fire pattern with lightning spikes
      const spike = Math.random() > 0.95 ? Math.random() * 2 : 1;
      data[i] = (Math.random() * 2 - 1) * spike * Math.pow(1 - t, 0.5);
    }

    const noise = this.context.createBufferSource();
    noise.buffer = buffer;

    const filter = this.context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;

    const noiseGain = this.context.createGain();
    noiseGain.gain.setValueAtTime(0.35, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);

    noise.start(now);

    // Lightning zap
    const lightning = this.context.createOscillator();
    const lightningGain = this.context.createGain();

    lightning.type = 'sawtooth';
    lightning.frequency.setValueAtTime(1200, now);
    lightning.frequency.exponentialRampToValueAtTime(200, now + 0.15);

    lightningGain.gain.setValueAtTime(0.3, now);
    lightningGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    lightning.connect(lightningGain);
    lightningGain.connect(this.sfxGain);

    lightning.start(now);
    lightning.stop(now + 0.2);
  }

  /**
   * Glacier Shield - Ice fortress forming
   */
  private playDuoGlacierShieldSound(): void {
    if (!this.context || !this.sfxGain) return;

    const now = this.context.currentTime;

    // Ice crystal forming sounds
    for (let i = 0; i < 4; i++) {
      const delay = i * 0.08;
      const freq = 800 + Math.random() * 400;

      const osc = this.context.createOscillator();
      const gain = this.context.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + delay);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + delay + 0.15);

      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(0.2, now + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.15);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now + delay);
      osc.stop(now + delay + 0.2);
    }

    // Deep shield activation
    const shield = this.context.createOscillator();
    const shieldGain = this.context.createGain();

    shield.type = 'sine';
    shield.frequency.setValueAtTime(120, now + 0.2);

    shieldGain.gain.setValueAtTime(0.25, now + 0.2);
    shieldGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    shield.connect(shieldGain);
    shieldGain.connect(this.sfxGain);

    shield.start(now + 0.2);
    shield.stop(now + 0.6);
  }

  /**
   * Phantom Frost - Ghostly ice shards
   */
  private playDuoPhantomFrostSound(): void {
    if (!this.context || !this.sfxGain) return;

    const now = this.context.currentTime;

    // Ghost whoosh
    const bufferSize = this.context.sampleRate * 0.35;
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      // Ethereal swirl
      data[i] = (Math.random() * 2 - 1) * Math.sin(t * Math.PI * 3) * 0.5;
    }

    const noise = this.context.createBufferSource();
    noise.buffer = buffer;

    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1500;
    filter.Q.value = 3;

    const noiseGain = this.context.createGain();
    noiseGain.gain.setValueAtTime(0.25, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);

    noise.start(now);

    // Ice shard tinkle
    const iceFreqs = [1400, 1700, 2000];
    iceFreqs.forEach((freq, idx) => {
      const osc = this.context!.createOscillator();
      const gain = this.context!.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      const delay = idx * 0.05;
      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(0.15, now + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.15);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(now + delay);
      osc.stop(now + delay + 0.2);
    });
  }

  /**
   * Tech Void - Heavy orbital bombardment
   */
  private playDuoTechVoidSound(): void {
    if (!this.context || !this.sfxGain) return;

    const now = this.context.currentTime;

    // Orbital beam charging
    const charge = this.context.createOscillator();
    const chargeGain = this.context.createGain();

    charge.type = 'sawtooth';
    charge.frequency.setValueAtTime(100, now);
    charge.frequency.exponentialRampToValueAtTime(600, now + 0.3);

    chargeGain.gain.setValueAtTime(0.15, now);
    chargeGain.gain.linearRampToValueAtTime(0.35, now + 0.3);
    chargeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    charge.connect(chargeGain);
    chargeGain.connect(this.sfxGain);

    charge.start(now);
    charge.stop(now + 0.4);

    // Heavy impact
    const impact = this.context.createOscillator();
    const impactGain = this.context.createGain();

    impact.type = 'sine';
    impact.frequency.setValueAtTime(80, now + 0.3);
    impact.frequency.exponentialRampToValueAtTime(30, now + 0.6);

    impactGain.gain.setValueAtTime(0, now + 0.3);
    impactGain.gain.linearRampToValueAtTime(0.45, now + 0.32);
    impactGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    impact.connect(impactGain);
    impactGain.connect(this.sfxGain);

    impact.start(now + 0.3);
    impact.stop(now + 0.7);
  }

  /**
   * Nature Fire (Thermal Paradox) - Extreme temperature differential
   */
  private playDuoNatureFireSound(): void {
    if (!this.context || !this.sfxGain) return;

    const now = this.context.currentTime;

    // Temperature clash sound (ice crack meets fire whoosh)
    const bufferSize = this.context.sampleRate * 0.5;
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      // Thermal shock wave
      const shockwave = Math.sin(t * Math.PI * 20) * Math.exp(-t * 5);
      const noise = (Math.random() * 2 - 1) * 0.5;
      data[i] = (shockwave + noise) * Math.sin(t * Math.PI);
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;

    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 600;
    filter.Q.value = 1.5;

    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    source.start(now);

    // Explosion bass
    const bass = this.context.createOscillator();
    const bassGain = this.context.createGain();

    bass.type = 'sine';
    bass.frequency.setValueAtTime(100, now);
    bass.frequency.exponentialRampToValueAtTime(40, now + 0.3);

    bassGain.gain.setValueAtTime(0.35, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    bass.connect(bassGain);
    bassGain.connect(this.sfxGain);

    bass.start(now);
    bass.stop(now + 0.4);
  }

  /**
   * Plasma Phase - Cloaked drone plasma strikes
   */
  private playDuoPlasmaPhaseSound(): void {
    if (!this.context || !this.sfxGain) return;

    const now = this.context.currentTime;

    // Phase shift sound (subtle whoosh)
    const phase = this.context.createOscillator();
    const phaseGain = this.context.createGain();

    phase.type = 'sine';
    phase.frequency.setValueAtTime(300, now);
    phase.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
    phase.frequency.exponentialRampToValueAtTime(400, now + 0.3);

    phaseGain.gain.setValueAtTime(0.15, now);
    phaseGain.gain.linearRampToValueAtTime(0.25, now + 0.15);
    phaseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    phase.connect(phaseGain);
    phaseGain.connect(this.sfxGain);

    phase.start(now);
    phase.stop(now + 0.35);

    // Plasma strike bursts
    for (let i = 0; i < 3; i++) {
      const delay = 0.1 + i * 0.1;

      const plasma = this.context.createOscillator();
      const plasmaGain = this.context.createGain();

      plasma.type = 'sawtooth';
      plasma.frequency.setValueAtTime(800 + i * 200, now + delay);
      plasma.frequency.exponentialRampToValueAtTime(200, now + delay + 0.1);

      plasmaGain.gain.setValueAtTime(0.2, now + delay);
      plasmaGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.1);

      plasma.connect(plasmaGain);
      plasmaGain.connect(this.sfxGain);

      plasma.start(now + delay);
      plasma.stop(now + delay + 0.15);
    }
  }

  /**
   * Generic blip sound
   */
  private playBlip(frequency: number, duration: number, type: OscillatorType = 'square'): void {
    if (!this.context || !this.sfxGain) return;

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = type;
    osc.frequency.value = frequency;

    gain.gain.setValueAtTime(0.2, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.context.currentTime + duration);
  }

  // ============================================================================
  // Music
  // ============================================================================

  /**
   * Play background music (placeholder - ready for audio files)
   */
  public playMusic(id: string): void {
    if (!this.context || !this.musicGain || audioSettings.value.muted) return;

    // TODO: Load actual music files when available
    // For now, play a simple ambient drone
    this.playAmbientDrone();

    console.log(`[AudioManager] Playing music: ${id}`);
  }

  /**
   * Stop music
   */
  public stopMusic(): void {
    if (this.currentMusic) {
      try {
        this.currentMusic.stop();
      } catch {
        // Already stopped
      }
      this.currentMusic = null;
    }
  }

  /**
   * Simple ambient drone for background
   */
  private playAmbientDrone(): void {
    if (!this.context || !this.musicGain) return;

    // Stop existing music
    this.stopMusic();

    // 1. Low tonal drone
    const osc1 = this.context.createOscillator();
    const osc2 = this.context.createOscillator();
    const tonGain = this.context.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.value = 55; // A1
    osc2.frequency.value = 82.41; // E2 (perfect fifth)

    tonGain.gain.value = 0.03;

    osc1.connect(tonGain);
    osc2.connect(tonGain);
    tonGain.connect(this.musicGain);

    osc1.start();
    osc2.start();

    // 2. High ethereal atmospheric noise
    const bufferSize = this.context.sampleRate * 2;
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.context.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, this.context.currentTime);
    
    // Animate filter for "breathing" effect
    const lfo = this.context.createOscillator();
    const lfoGain = this.context.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.15; // Very slow
    lfoGain.gain.value = 200;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    const noiseGain = this.context.createGain();
    noiseGain.gain.value = 0.01; // Very subtle

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.musicGain);
    noise.start();

    // Store references to stop later
    const nodeWrapper = {
      stop: () => {
        osc1.stop();
        osc2.stop();
        noise.stop();
        lfo.stop();
      }
    };
    
    this.currentMusic = nodeWrapper as any;
  }
}

export const audioManager = AudioManager.getInstance();
