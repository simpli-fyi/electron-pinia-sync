/**
 * Main process synchronization manager
 * Manages Pinia stores in the Main process and handles IPC communication
 */

import type {IpcMainInvokeEvent} from 'electron';
import {BrowserWindow, ipcMain} from 'electron';
import {createPinia, type Pinia, type StateTree, type Store as PiniaStore} from 'pinia';
import Store from 'electron-store';
import type {
  PersistOptions,
  StatePatchMessage,
  StatePullRequest,
  StatePullResponse,
  StateUpdateMessage,
} from '../types';
import {IPC_CHANNELS} from '../types';
import {createDebugLogger, type DebugLogger, formatPatchForDebug, formatStateForDebug} from '../debug';
import {toRawState} from "../utils/toRawState";
import type {MainSyncOptions, PiniaWithStores, StoreMetadata} from "./models";

export class MainSync {
  private pinia: Pinia;
  private electronStore: Store<Record<string, StateTree>>;
  private storeMetadata = new Map<string, StoreMetadata>();
  private processingTransactions = new Set<string>();
  private readonly MAX_TRANSACTION_HISTORY = 100;
  private debug: DebugLogger;

  constructor(options: MainSyncOptions = {}) {
    this.debug = createDebugLogger('electron-pinia-sync:main', options.debug ?? false, options.logger);
    this.debug.debug('Initializing MainSync');

    this.pinia = options.pinia ?? createPinia();
    this.electronStore = new Store<Record<string, StateTree>>({
      name: 'pinia-sync-store',
      ...options.storeOptions,
    });

    this.debug.verbose('electron-store initialized with options:', options.storeOptions);
    this.setupIpcHandlers();
    this.debug.debug('MainSync initialized successfully');
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
    this.debug.debug(`Registering store: ${storeId}`);
    const persistConfig = this.normalizePersistOptions(options.persist);

    this.storeMetadata.set(storeId, {
      persist: persistConfig,
    });

    // Load persisted state if enabled
    if (persistConfig) {
      const key = persistConfig.key ?? storeId;
      const persistedState = this.electronStore.get(key);

      if (persistedState) {
        this.debug.verbose(`Loading persisted state for ${storeId}:`, formatStateForDebug(persistedState));
        store.$patch(persistedState);
      } else {
        this.debug.verbose(`No persisted state found for ${storeId}`);
      }
    }

    // Subscribe to store changes
    store.$subscribe((_mutation, state) => {
      this.debug.verbose(`Store ${storeId} changed:`, formatStateForDebug(state));

      // Serialize state to plain object
      const serializedState = toRawState(state);

      // Persist if enabled
      if (persistConfig) {
        const key = persistConfig.key ?? storeId;
        this.electronStore.set(key, serializedState);
        this.debug.verbose(`Persisted state for ${storeId} to key: ${key}`);
      }

      // Broadcast to all renderer processes
      this.broadcastStateUpdate(storeId, serializedState);
    }, {detached: true});

    this.debug.debug(`Store ${storeId} registered successfully (persist: ${!!persistConfig})`);
  }

  /**
   * Normalize persist options to standard format
   */
  private normalizePersistOptions(
    persist?: boolean | PersistOptions
  ): PersistOptions | false {
    if (persist === true) {
      return {enabled: true};
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
    this.debug.debug('Setting up IPC handlers');

    // Handle state pull requests
    ipcMain.handle(
      IPC_CHANNELS.STATE_PULL,
      async (_event: IpcMainInvokeEvent, request: StatePullRequest): Promise<StatePullResponse> => {
        this.debug.debug(`IPC handler called: STATE_PULL for store: ${request.storeId}`);
        const store = (this.pinia as PiniaWithStores)._s.get(request.storeId);

        if (store) {
          this.debug.verbose(`Sending state for ${request.storeId}:`, formatStateForDebug(store.$state));
        } else {
          this.debug.warn(`Store "${request.storeId}" not found in Main process`);
        }

        return {
          storeId: request.storeId,
          state: store ? toRawState(store.$state) : null,
        };
      }
    );
    this.debug.debug(`IPC handler registered: ${IPC_CHANNELS.STATE_PULL}`);

    // Handle state patches from renderers
    ipcMain.handle(
      IPC_CHANNELS.STATE_PATCH,
      async (_event: IpcMainInvokeEvent, message: StatePatchMessage): Promise<void> => {
        this.debug.debug(`IPC handler called: STATE_PATCH for store: ${message.storeId}, transaction: ${message.transactionId}`);
        this.debug.verbose(`Patch data:`, formatPatchForDebug(message.patch));

        const store = (this.pinia as PiniaWithStores)._s.get(message.storeId);

        if (!store) {
          this.debug.warn(`Store "${message.storeId}" not found in Main process`);
          return;
        }

        // Mark transaction as being processed to prevent echo
        this.addTransaction(message.transactionId);

        try {
          // Apply patch to main store
          store.$patch(message.patch);
          this.debug.debug(`Successfully applied patch to store: ${message.storeId}`);
        } catch (error) {
          this.debug.error(`Failed to patch store "${message.storeId}":`, error);
        }
      }
    );
    this.debug.debug(`IPC handler registered: ${IPC_CHANNELS.STATE_PATCH}`);

    this.debug.debug('IPC handlers setup complete');
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
    this.debug.verbose(`Broadcasting state update for store: ${storeId}`, transactionId ? `(transaction: ${transactionId})` : '');

    const message: StateUpdateMessage = {
      storeId,
      state,
      transactionId,
    };

    // Send to all browser windows
    const windows = BrowserWindow.getAllWindows();
    this.debug.verbose(`Broadcasting to ${windows.length} window(s)`);

    windows.forEach((window, index) => {
      if (!window.isDestroyed()) {
        this.debug.verbose(`Sending ${IPC_CHANNELS.STATE_UPDATED} to window ${index + 1}`);
        window.webContents.send(IPC_CHANNELS.STATE_UPDATED, message);
      } else {
        this.debug.verbose(`Skipping destroyed window ${index + 1}`);
      }
    });

    this.debug.debug(`Broadcast complete for store: ${storeId}`);
  }

  /**
   * Cleanup IPC handlers
   */
  public destroy(): void {
    this.debug.debug('Destroying MainSync, cleaning up IPC handlers');
    ipcMain.removeHandler(IPC_CHANNELS.STATE_PULL);
    ipcMain.removeHandler(IPC_CHANNELS.STATE_PATCH);
    this.debug.debug('MainSync destroyed');
  }
}

/**
 * Create and initialize the Main process sync manager
 */
export function createMainSync(options?: MainSyncOptions): MainSync {
  return new MainSync(options);
}

// Export debug utilities for advanced users
export {createDebugLogger, formatStateForDebug, formatPatchForDebug} from '../debug.js';
export type {DebugLevel, DebugLogger} from '../debug.js';
