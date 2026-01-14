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
