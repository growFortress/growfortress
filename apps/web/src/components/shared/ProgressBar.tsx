interface ProgressBarProps {
  percent: number;
  class?: string;
  fillClass?: string;
}

export function ProgressBar({ percent, class: className, fillClass }: ProgressBarProps) {
  return (
    <div class={className || 'wave-progress-bar'}>
      <div
        class={fillClass || 'wave-progress-fill'}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}
