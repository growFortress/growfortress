interface StatDisplayProps {
  value: number | string;
  label?: string;
  class?: string;
}

export function StatDisplay({ value, label, class: className }: StatDisplayProps) {
  return (
    <div class={`stat ${className || ''}`}>
      <span>{value}</span>
      {label && <span> {label}</span>}
    </div>
  );
}

interface LevelStatProps {
  level: number;
  xpPercent: number;
}

export function LevelStat({ level, xpPercent }: LevelStatProps) {
  return (
    <div class="stat level-stat">
      <span>Level <span>{level}</span></span>
      <div class="xp-bar">
        <div class="xp-fill" style={{ width: `${xpPercent}%` }} />
      </div>
    </div>
  );
}
