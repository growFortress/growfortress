
import { describe, it, expect, beforeEach } from 'vitest';
import { AnalyticsSystem } from '../../analytics.js';

describe('AnalyticsSystem', () => {
  let analytics: AnalyticsSystem;

  beforeEach(() => {
    analytics = new AnalyticsSystem();
    // Start a wave so stats are initialized
    analytics.startWave(1, 100);
  });

  it('should initialize with default values', () => {
    const stats = analytics.getCurrentWaveStats();
    expect(stats).not.toBeNull();
    expect(stats?.waveNumber).toBe(1);
    expect(stats?.enemiesKilled).toBe(0);
    expect(stats?.totalDamageDealt).toBe(0);
  });

  it('should track kills', () => {
    analytics.trackKill();
    analytics.trackKill();
    const stats = analytics.getCurrentWaveStats();
    expect(stats?.enemiesKilled).toBe(2);
  });

  it('should track damage by source', () => {
    analytics.trackDamage('hero', 'hero_1', 10);
    analytics.trackDamage('turret', 'turret_1', 20);
    analytics.trackDamage('fortress', 'fortress', 5);

    const stats = analytics.getCurrentWaveStats();
    expect(stats?.totalDamageDealt).toBe(35);
    expect(stats?.damageBySource.hero).toBe(10);
    expect(stats?.damageBySource.turret).toBe(20);
    expect(stats?.damageBySource.fortress).toBe(5);
  });

  it('should track damage by specific hero/turret', () => {
    analytics.trackDamage('hero', 'hero_A', 15);
    analytics.trackDamage('hero', 'hero_A', 5);
    analytics.trackDamage('hero', 'hero_B', 10);
    analytics.trackDamage('turret', 'turret_X', 50);

    const stats = analytics.getCurrentWaveStats();
    expect(stats?.damageByHero['hero_A']).toBe(20);
    expect(stats?.damageByHero['hero_B']).toBe(10);
    expect(stats?.damageByTurret['turret_X']).toBe(50);
  });

  it('should track damage taken by heroes', () => {
    analytics.trackDamageTaken('hero_tank', 100);
    analytics.trackDamageTaken('hero_tank', 50);
    analytics.trackDamageTaken('hero_dps', 20);

    const stats = analytics.getCurrentWaveStats();
    expect(stats?.damageTakenByHero['hero_tank']).toBe(150);
    expect(stats?.damageTakenByHero['hero_dps']).toBe(20);
  });

  it('should track healing done', () => {
    analytics.trackHealing('healer_staff', 50);
    analytics.trackHealing('lifesteal_orb', 25);

    const stats = analytics.getCurrentWaveStats();
    expect(stats?.healingBySource['healer_staff']).toBe(50);
    expect(stats?.healingBySource['lifesteal_orb']).toBe(25);
  });

  it('should track economy', () => {
    analytics.trackEconomy('earn', 'gold', 100);
    analytics.trackEconomy('spend', 'gold', 50);
    analytics.trackEconomy('earn', 'dust', 20);

    const stats = analytics.getCurrentWaveStats();
    expect(stats?.economy.goldEarned).toBe(100);
    expect(stats?.economy.goldSpent).toBe(50);
    expect(stats?.economy.dustEarned).toBe(20);
    expect(stats?.economy.dustSpent).toBe(0);
  });

  it('should aggregate history on endWave', () => {
    analytics.trackKill();
    const finalStats = analytics.endWave(90); // Fortress HP left
    
    expect(finalStats).not.toBeNull();
    expect(finalStats?.fortressHealthEnd).toBe(90);
    expect(analytics.getCurrentWaveStats()).toBeNull();
    
    const history = analytics.getSessionHistory();
    expect(history.length).toBe(1);
    expect(history[0]).toEqual(finalStats);
  });

  it('should generate report string', () => {
    analytics.trackDamage('hero', 'thor', 100);
    const report = analytics.generateReport();
    expect(report).toContain('Wave 1 Report');
    expect(report).toContain('Heroes: 100.0%');
  });
});
