/**
 * Main process synchronization manager
 * Manages Pinia stores in the Main process and handles IPC communication
 */

import { ipcMain, BrowserWindow } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { createPinia, type Pinia, type StateTree, type Store as PiniaStore } from 'pinia';
import Store from 'electron-store';
import type {
  StatePatchMessage,
  StateUpdateMessage,
  StatePullRequest,
  StatePullResponse,
  PersistOptions,
} from '../types.js';
import { IPC_CHANNELS } from '../types.js';

/**
 * Type for accessing Pinia's internal store map
 * This is necessary because Pinia doesn't expose a public API to get stores by ID
 */
interface PiniaWithStores extends Pinia {
  _s: Map<string, PiniaStore>;
}

export interface MainSyncOptions {
  /**
   * electron-store configuration options
   */
  storeOptions?: ConstructorParameters<typeof Store<Record<string, StateTree>>>[0];

  /**
   * Custom Pinia instance (optional, will create one if not provided)
   */
  pinia?: Pinia;
}

/**
 * Store metadata for tracking persistence settings
 */
interface StoreMetadata {
  persist: PersistOptions | false;
}

export class MainSync {
  private pinia: Pinia;
  private electronStore: Store<Record<string, StateTree>>;
  private storeMetadata = new Map<string, StoreMetadata>();
  private processingTransactions = new Set<string>();
  private readonly MAX_TRANSACTION_HISTORY = 100;

  constructor(options: MainSyncOptions = {}) {
    this.pinia = options.pinia ?? createPinia();
    this.electronStore = new Store<Record<string, StateTree>>({
      name: 'pinia-sync-store',
      ...options.storeOptions,
    });

    this.setupIpcHandlers();
  }

  /**
   * Get the Pinia instance managed by this sync manager
   */
  public getPinia(): Pinia {
    return this.pinia;
  }

  /**
   * Register a store with the sync manager
   */
  public registerStore(
    storeId: string,
    store: PiniaStore,
    options: { persist?: boolean | PersistOptions } = {}
  ): void {
    const persistConfig = this.normalizePersistOptions(options.persist);

    this.storeMetadata.set(storeId, {
      persist: persistConfig,
    });

    // Load persisted state if enabled
    if (persistConfig) {
      const key = persistConfig.key ?? storeId;
      const persistedState = this.electronStore.get(key);

      if (persistedState) {
        store.$patch(persistedState);
      }
    }

    // Subscribe to store changes
    store.$subscribe((_mutation, state) => {
      // Persist if enabled
      if (persistConfig) {
        const key = persistConfig.key ?? storeId;
        this.electronStore.set(key, state);
      }

      // Broadcast to all renderer processes
      this.broadcastStateUpdate(storeId, state);
    }, { detached: true });
  }

  /**
   * Normalize persist options to standard format
   */
  private normalizePersistOptions(
    persist?: boolean | PersistOptions
  ): PersistOptions | false {
    if (persist === true) {
      return { enabled: true };
    } else if (persist === false || persist === undefined) {
      return false;
    } else {
      return persist;
    }
  }

  /**
   * Setup IPC handlers for communication with renderers
   */
  private setupIpcHandlers(): void {
    // Handle state pull requests
    ipcMain.handle(
      IPC_CHANNELS.STATE_PULL,
      async (_event: IpcMainInvokeEvent, request: StatePullRequest): Promise<StatePullResponse> => {
        const store = (this.pinia as PiniaWithStores)._s.get(request.storeId);

        return {
          storeId: request.storeId,
          state: store ? store.$state : null,
        };
      }
    );

    // Handle state patches from renderers
    ipcMain.handle(
      IPC_CHANNELS.STATE_PATCH,
      async (_event: IpcMainInvokeEvent, message: StatePatchMessage): Promise<void> => {
        const store = (this.pinia as PiniaWithStores)._s.get(message.storeId);

        if (!store) {
          console.warn(`[electron-pinia-sync] Store "${message.storeId}" not found in Main process`);
          return;
        }

        // Mark transaction as being processed to prevent echo
        this.addTransaction(message.transactionId);

        try {
          // Apply patch to main store
          store.$patch(message.patch);
        } catch (error) {
          console.error(`[electron-pinia-sync] Failed to patch store "${message.storeId}":`, error);
        }
      }
    );
  }

  private addTransaction(id: string) {
    this.processingTransactions.add(id);
    // Rotating buffer Logic
    if (this.processingTransactions.size > this.MAX_TRANSACTION_HISTORY) {
      const first = this.processingTransactions.values().next().value;
      if (first) this.processingTransactions.delete(first);
    }
    // Long fallback timeout
    setTimeout(() => this.processingTransactions.delete(id), 5000);
  }

  /**
   * Broadcast state update to all renderer processes
   */
  private broadcastStateUpdate(
    storeId: string,
    state: StateTree,
    transactionId?: string
  ): void {
    const message: StateUpdateMessage = {
      storeId,
      state,
      transactionId,
    };

    // Send to all browser windows
    BrowserWindow.getAllWindows().forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send(IPC_CHANNELS.STATE_UPDATED, message);
      }
    });
  }

  /**
   * Cleanup IPC handlers
   */
  public destroy(): void {
    ipcMain.removeHandler(IPC_CHANNELS.STATE_PULL);
    ipcMain.removeHandler(IPC_CHANNELS.STATE_PATCH);
  }
}

/**
 * Create and initialize the Main process sync manager
 */
export function createMainSync(options?: MainSyncOptions): MainSync {
  return new MainSync(options);
}

