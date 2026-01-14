import {
  getTelemetryQueue,
  deleteTelemetryBatch,
} from './idb.js';

type SyncStatus = 'online' | 'offline' | 'syncing';

class SyncManager {
  private isOnline = navigator.onLine;
  private isSyncing = false;
  private listeners: Set<(status: SyncStatus) => void> = new Set();
  private syncInterval: number | null = null;

  constructor() {
    window.addEventListener('online', () => this.onOnline());
    window.addEventListener('offline', () => this.onOffline());

    // Initial sync if online
    if (this.isOnline) {
      this.scheduleSync();
    }
  }

  getStatus(): SyncStatus {
    if (this.isSyncing) return 'syncing';
    return this.isOnline ? 'online' : 'offline';
  }

  addListener(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach(l => l(status));
  }

  private onOnline(): void {
    this.isOnline = true;
    this.notifyListeners();
    this.scheduleSync();
  }

  private onOffline(): void {
    this.isOnline = false;
    this.notifyListeners();

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  private scheduleSync(): void {
    // Sync immediately
    this.sync();

    // Then every 30 seconds
    if (!this.syncInterval) {
      this.syncInterval = window.setInterval(() => this.sync(), 30000);
    }
  }

  async sync(): Promise<void> {
    if (!this.isOnline || this.isSyncing) return;

    this.isSyncing = true;
    this.notifyListeners();

    try {
      await this.syncTelemetry();
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  private async syncTelemetry(): Promise<void> {
    const batches = await getTelemetryQueue();

    for (const batch of batches) {
      try {
        await fetch('/api/v1/telemetry/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: batch.events }),
        });
        await deleteTelemetryBatch(batch.id);
      } catch (error) {
        console.error('Failed to sync telemetry:', error);
        // Don't retry telemetry, just skip for now
      }
    }
  }
}

export const syncManager = new SyncManager();
