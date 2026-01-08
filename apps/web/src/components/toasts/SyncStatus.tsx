import { syncStatus } from '../../state/index.js';

const statusLabels: Record<string, string> = {
  online: 'Online',
  offline: 'Offline',
  syncing: 'Syncing...',
};

export function SyncStatus() {
  return (
    <div class={`sync-status ${syncStatus.value}`}>
      {statusLabels[syncStatus.value] || syncStatus.value}
    </div>
  );
}
