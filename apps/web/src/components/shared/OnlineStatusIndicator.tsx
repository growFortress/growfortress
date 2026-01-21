interface OnlineStatusIndicatorProps {
  isOnline?: boolean;
  className?: string;
}

export function OnlineStatusIndicator({ isOnline, className }: OnlineStatusIndicatorProps) {
  if (!isOnline) return null;
  
  return (
    <span 
      class={`online-dot ${className || ''}`} 
      title="Online"
      style={{
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: '#4ade80',
        boxShadow: '0 0 6px rgba(74, 222, 128, 0.6)',
        marginLeft: '4px',
        verticalAlign: 'middle',
      }}
    />
  );
}
