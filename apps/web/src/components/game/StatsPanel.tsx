
import { useEffect, useState } from 'preact/hooks';
import { analytics } from '@arcade/sim-core';
import styles from './StatsPanel.module.css';

interface StatsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StatsPanel({ isOpen, onClose }: StatsPanelProps) {
  const [stats, setStats] = useState<any>(null); // Using any for flexibility with analytics internals

  useEffect(() => {
    if (!isOpen) return;

    // Initial load
    updateStats();

    // Subscribe to updates
    const unsubscribe = analytics.onUpdate(updateStats);
    return unsubscribe;
  }, [isOpen]);

  const updateStats = () => {
    // Access internal state of analytics system via type casting or public getter if available
    // For now we access the current wave stats directly or history
    const current = analytics.getCurrentWaveStats();
    const history = analytics.getSessionHistory();
    
    // Aggregate all history + current
    const aggregated = {
      totalDamage: 0,
      damageBySource: { hero: 0, turret: 0, fortress: 0, skill: 0, dot: 0, projectile: 0 },
      damageByHero: {} as Record<string, number>,
      damageByTurret: {} as Record<string, number>,
      damageTakenByHero: {} as Record<string, number>,
      healingBySource: {} as Record<string, number>,
      economy: { goldEarned: 0, goldSpent: 0, dustEarned: 0, dustSpent: 0 }
    };

    const allStats = [...history];
    if (current) allStats.push(current);

    for (const wave of allStats) {
      aggregated.totalDamage += wave.totalDamageDealt;
      
      for (const [key, val] of Object.entries(wave.damageBySource)) {
        aggregated.damageBySource[key as keyof typeof aggregated.damageBySource] += val;
      }
      
      for (const [key, val] of Object.entries(wave.damageByHero)) {
        aggregated.damageByHero[key] = (aggregated.damageByHero[key] || 0) + val;
      }
      
      for (const [key, val] of Object.entries(wave.damageByTurret)) {
        aggregated.damageByTurret[key] = (aggregated.damageByTurret[key] || 0) + val;
      }

      for (const [key, val] of Object.entries(wave.damageTakenByHero || {})) {
        aggregated.damageTakenByHero[key] = (aggregated.damageTakenByHero[key] || 0) + val;
      }
      
      for (const [key, val] of Object.entries(wave.healingBySource || {})) {
        aggregated.healingBySource[key] = (aggregated.healingBySource[key] || 0) + val;
      }

      aggregated.economy.goldEarned += wave.economy.goldEarned;
      aggregated.economy.goldSpent += wave.economy.goldSpent;
      aggregated.economy.dustEarned += wave.economy.dustEarned;
      aggregated.economy.dustSpent += wave.economy.dustSpent;
    }

    setStats(aggregated);
  };

  if (!isOpen || !stats) return null;

  const getPercent = (val: number, total: number) => {
    if (total === 0) return 0;
    return ((val / total) * 100).toFixed(1);
  };

  // Prepare chart data
  const damageSources = [
    { label: 'Heroes', value: stats.damageBySource.hero + stats.damageBySource.skill, className: styles.barHero },
    { label: 'Turrets', value: stats.damageBySource.turret, className: styles.barTurret },
    { label: 'Fortress', value: stats.damageBySource.fortress, className: styles.barFortress },
  ].sort((a, b) => b.value - a.value);

  const topHeroes = Object.entries(stats.damageByHero)
    .map(([name, value]) => ({ label: name, value: value as number, className: styles.barHero }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return (
    <div class={styles.overlay} onClick={onClose}>
      <div class={styles.panel} onClick={e => e.stopPropagation()}>
        <div class={styles.header}>
          <h2>Battle Statistics</h2>
          <button class={styles.closeButton} onClick={onClose}>✕</button>
        </div>

        <div class={styles.content}>
          <div class={styles.section}>
            <div class={styles.sectionTitle}>
              <span>Damage Distribution</span>
              <span>Total: {Math.floor(stats.totalDamage).toLocaleString()}</span>
            </div>
            <div class={styles.chartContainer}>
              {damageSources.map(item => (
                <div class={styles.chartRow} key={item.label}>
                  <div class={styles.label}>{item.label}</div>
                  <div class={styles.barContainer}>
                    <div 
                      class={`${styles.bar} ${item.className}`} 
                      style={{ width: `${getPercent(item.value, stats.totalDamage)}%` }}
                    ></div>
                    <span class={styles.barValue}>
                      {Math.floor(item.value).toLocaleString()} ({getPercent(item.value, stats.totalDamage)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div class={styles.section}>
            <div class={styles.sectionTitle}>
              <span>Top Heroes (MVP)</span>
            </div>
            <div class={styles.chartContainer}>
              {topHeroes.length > 0 ? topHeroes.map(item => (
                <div class={styles.chartRow} key={item.label}>
                  <div class={styles.label}>{item.label}</div>
                  <div class={styles.barContainer}>
                    <div 
                      class={`${styles.bar} ${item.className}`} 
                      style={{ width: `${getPercent(item.value, stats.totalDamage)}%` }}
                    ></div>
                    <span class={styles.barValue}>
                      {Math.floor(item.value).toLocaleString()}
                    </span>
                  </div>
                </div>
              )) : <div style={{textAlign: 'center', color: '#666'}}>No hero damage recorded</div>}
            </div>
          </div>

          <div class={styles.section}>
            <div class={styles.sectionTitle}>
              <span>Support & Tanking</span>
            </div>
            <div class={styles.chartContainer}>
              {Object.entries(stats.damageTakenByHero || {}).length > 0 && (
                 <div style={{marginBottom: '0.5rem', opacity: 0.8, fontSize: '0.8rem'}}>Damage Taken (Tanking)</div>
              )}
              {Object.entries(stats.damageTakenByHero || {})
                .map(([name, value]) => ({ label: name, value: value as number, className: styles.barFortress }))
                .sort((a, b) => b.value - a.value)
                .map(item => (
                <div class={styles.chartRow} key={`taken-${item.label}`}>
                  <div class={styles.label}>{item.label}</div>
                  <div class={styles.barContainer}>
                    <div 
                      class={`${styles.bar} ${item.className}`} 
                      style={{ width: `${getPercent(item.value, Object.values(stats.damageTakenByHero || {}).reduce((a:any,b:any)=>a+b,0) as number)}%` }}
                    ></div>
                    <span class={styles.barValue}>{Math.floor(item.value).toLocaleString()}</span>
                  </div>
                </div>
              ))}
              
              {Object.entries(stats.healingBySource || {}).length > 0 && (
                 <div style={{marginTop: '1rem', marginBottom: '0.5rem', opacity: 0.8, fontSize: '0.8rem'}}>Healing Done</div>
              )}
              {Object.entries(stats.healingBySource || {})
                .map(([name, value]) => ({ label: name, value: value as number, className: styles.barSkill }))
                .sort((a, b) => b.value - a.value)
                .map(item => (
                <div class={styles.chartRow} key={`heal-${item.label}`}>
                  <div class={styles.label}>{item.label}</div>
                  <div class={styles.barContainer}>
                    <div 
                      class={`${styles.bar} ${item.className}`} 
                      style={{ width: `${getPercent(item.value, Object.values(stats.healingBySource || {}).reduce((a:any,b:any)=>a+b,0) as number)}%` }}
                    ></div>
                    <span class={styles.barValue}>{Math.floor(item.value).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div class={styles.section}>
            <div class={styles.sectionTitle}>Economy</div>
            <div class={styles.economyGrid}>
              <div class={styles.economyItem}>
                <span class={styles.economyLabel}>Gold Earned</span>
                <span class={`${styles.economyValue} ${styles.gold}`}>+{stats.economy.goldEarned}</span>
              </div>
              <div class={styles.economyItem}>
                <span class={styles.economyLabel}>Gold Spent</span>
                <span class={`${styles.economyValue} ${styles.gold}`}>-{stats.economy.goldSpent}</span>
              </div>
              <div class={styles.economyItem}>
                <span class={styles.economyLabel}>Dust Earned</span>
                <span class={`${styles.economyValue} ${styles.dust}`}>+{stats.economy.dustEarned}</span>
              </div>
              <div class={styles.economyItem}>
                <span class={styles.economyLabel}>Dust Spent</span>
                <span class={`${styles.economyValue} ${styles.dust}`}>-{stats.economy.dustSpent}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
