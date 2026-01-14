
// ===========================================
// DATA STRUCTURES
// ===========================================

export type DamageSourceType = 'hero' | 'turret' | 'projectile' | 'fortress' | 'dot' | 'skill';

export interface DamageReport {
  sourceType: DamageSourceType;
  sourceId: string; // e.g., 'storm', 'arrow_tower', 'fire_dot'
  targetId: string; // enemy id
  amount: number;
  tick: number;
}

export interface EconomyTransaction {
  type: 'earn' | 'spend';
  resource: 'gold' | 'dust' | 'xp';
  amount: number;
  source: string; // e.g., 'kill_reward', 'wave_clear', 'buy_turret', 'upgrade_hero'
  tick: number;
}

export interface WaveStats {
  waveNumber: number;
  durationTicks: number;
  enemiesSpawned: number;
  enemiesKilled: number;
  enemiesLeaked: number; // reached fortress
  fortressDamageTaken: number;
  fortressHealthEnd: number;
  totalDamageDealt: number;
  
  // Agregaty
  damageBySource: Record<DamageSourceType, number>;
  damageByHero: Record<string, number>;    // Damage by hero definition ID
  damageByTurret: Record<string, number>;  // Damage by turret ID/type
  damageTakenByHero: Record<string, number>; // Damage taken by hero
  healingBySource: Record<string, number>; // Healing done by source
  
  economy: {
    goldEarned: number;
    goldSpent: number;
    dustEarned: number;
    dustSpent: number;
  };
}

// ===========================================
// MAIN ANALYTICS SYSTEM
// ===========================================

export class AnalyticsSystem {
  private currentWaveStats: WaveStats | null = null;
  private sessionHistory: WaveStats[] = [];
  
  // Temporary storage for current tick/calculation

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.sessionHistory = [];
    this.currentWaveStats = null;
    this.resetPending();
  }

  private resetPending(): void {
  }

  // --- Wave Management ---

  public startWave(waveNumber: number, currentFortressHp: number): void {
    this.currentWaveStats = {
      waveNumber,
      durationTicks: 0,
      enemiesSpawned: 0,
      enemiesKilled: 0,
      enemiesLeaked: 0,
      fortressDamageTaken: 0,
      fortressHealthEnd: currentFortressHp,
      totalDamageDealt: 0,
      damageBySource: {
        hero: 0,
        turret: 0,
        projectile: 0,
        fortress: 0,
        dot: 0,
        skill: 0,
      },
      damageByHero: {},
      damageByTurret: {},
      damageTakenByHero: {},
      healingBySource: {},
      economy: {
        goldEarned: 0,
        goldSpent: 0,
        dustEarned: 0,
        dustSpent: 0,
      },
    };
  }

  public endWave(currentFortressHp: number): WaveStats | null {
    if (!this.currentWaveStats) return null;
    
    this.currentWaveStats.fortressHealthEnd = currentFortressHp;
    this.sessionHistory.push(this.currentWaveStats);
    
    // Return copy to avoid mutation reference issues if stored elsewhere
    const finalStats = { ...this.currentWaveStats };
    this.currentWaveStats = null;
    return finalStats;
  }

  public updateTick(): void {
    if (this.currentWaveStats) {
      this.currentWaveStats.durationTicks++;
      this.notifyListeners();
    }
  }

  // --- Tracking Methods ---

  public trackSpawn(): void {
    if (this.currentWaveStats) {
      this.currentWaveStats.enemiesSpawned++;
    }
  }

  public trackKill(): void {
    if (this.currentWaveStats) {
      this.currentWaveStats.enemiesKilled++;
    }
  }

  public trackLeak(): void {
    if (this.currentWaveStats) {
      this.currentWaveStats.enemiesLeaked++;
    }
  }

  public trackFortressDamage(amount: number): void {
    if (this.currentWaveStats) {
      this.currentWaveStats.fortressDamageTaken += amount;
    }
  }

  /**
   * Track damage dealt to enemies
   * @param sourceType - General source category
   * @param sourceId - Specific ID (e.g. 'storm')
   * @param amount - Damage amount
   */
  public trackDamage(sourceType: DamageSourceType, sourceId: string, amount: number): void {
    if (!this.currentWaveStats) return;

    // Update aggregate totals
    this.currentWaveStats.totalDamageDealt += amount;
    this.currentWaveStats.damageBySource[sourceType] = 
      (this.currentWaveStats.damageBySource[sourceType] || 0) + amount;

    // Update specific breakdowns
    if (sourceType === 'hero' || sourceType === 'skill') {
      this.currentWaveStats.damageByHero[sourceId] = 
        (this.currentWaveStats.damageByHero[sourceId] || 0) + amount;
    } else if (sourceType === 'turret') {
      this.currentWaveStats.damageByTurret[sourceId] = 
        (this.currentWaveStats.damageByTurret[sourceId] || 0) + amount;
    }
  }

  public trackDamageTaken(heroId: string, amount: number): void {
    if (!this.currentWaveStats) return;
    this.currentWaveStats.damageTakenByHero[heroId] = 
      (this.currentWaveStats.damageTakenByHero[heroId] || 0) + amount;
  }

  public trackHealing(sourceId: string, amount: number): void {
    if (!this.currentWaveStats) return;
    this.currentWaveStats.healingBySource[sourceId] = 
      (this.currentWaveStats.healingBySource[sourceId] || 0) + amount;
  }

  public trackEconomy(type: 'earn' | 'spend', resource: 'gold' | 'dust', amount: number): void {
    if (!this.currentWaveStats) return;

    if (type === 'earn') {
      if (resource === 'gold') this.currentWaveStats.economy.goldEarned += amount;
      if (resource === 'dust') this.currentWaveStats.economy.dustEarned += amount;
    } else {
      if (resource === 'gold') this.currentWaveStats.economy.goldSpent += amount;
      if (resource === 'dust') this.currentWaveStats.economy.dustSpent += amount;
    }
  }

  // --- Event Handling ---
  
  private listeners: (() => void)[] = [];

  public onUpdate(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  // --- Retrieval ---

  public getCurrentWaveStats(): WaveStats | null {
    return this.currentWaveStats;
  }

  public getSessionHistory(): WaveStats[] {
    return this.sessionHistory;
  }

  /**
   * Generates a summary text report for the current/last wave
   */
  public generateReport(): string {
    const stats = this.currentWaveStats || this.sessionHistory[this.sessionHistory.length - 1];
    if (!stats) return "No data available.";

    const totalDmg = Math.max(1, stats.totalDamageDealt);
    const heroDmgPct = ((stats.damageBySource.hero + stats.damageBySource.skill) / totalDmg * 100).toFixed(1);
    const turretDmgPct = (stats.damageBySource.turret / totalDmg * 100).toFixed(1);
    
    // Find MVP Hero
    let mvpHero = 'None';
    let maxHeroDmg = 0;
    for (const [hero, dmg] of Object.entries(stats.damageByHero)) {
      if (dmg > maxHeroDmg) {
        maxHeroDmg = dmg;
        mvpHero = hero;
      }
    }

    return `
=== Wave ${stats.waveNumber} Report ===
Enemies: ${stats.enemiesKilled}/${stats.enemiesSpawned} (Leaked: ${stats.enemiesLeaked})
Fortress: -${stats.fortressDamageTaken} HP
Total Damage: ${stats.totalDamageDealt}
  - Heroes: ${heroDmgPct}% (MVP: ${mvpHero})
  - Turrets: ${turretDmgPct}%
Economy: +${stats.economy.goldEarned} Gold / -${stats.economy.goldSpent} Spent
========================
    `.trim();
  }
}

// Global instance (singleton-like for simulation usage)
export const analytics = new AnalyticsSystem();
