/**
 * Renderer process Pinia plugin
 * Synchronizes local store changes with Main process and receives updates
 */

import type {PiniaPluginContext, StateTree} from 'pinia';
import diff from 'microdiff';
import type {PiniaSyncAPI, StateUpdateMessage, SyncStoreOptions} from '../types';
import {createDebugLogger, formatPatchForDebug, formatStateForDebug} from '../debug';
import {toRawState} from "../utils/toRawState";
import {applyPatch} from "../utils/applyPatch";
import type {RendererSyncOptions} from "./models";

/**
 * Generate a unique transaction ID
 */
function generateTransactionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Build patch using microdiff to detect which top-level keys changed.
 * Returns complete top-level values for changed keys (not merged, but replaced on receiver side).
 */
function buildPatch(
  oldState: StateTree,
  newState: StateTree
): Partial<StateTree> {
  const differences = diff(oldState, newState);

  if (differences.length === 0) {
    return {};
  }

  const patch: Partial<StateTree> = {};

  for (const change of differences) {
    if (change.path.length === 0) {
      // Root-level change - return entire state
      return newState;
    }

    // Get the top-level key that changed
    const topLevelKey = change.path[0];
    if (typeof topLevelKey === 'string' || typeof topLevelKey === 'number') {
      // Include the entire top-level property (will be replaced, not merged)
      patch[topLevelKey] = newState[topLevelKey];
    }
  }

  return patch;
}

/**
 * Create the Pinia plugin for renderer process synchronization
 */
export function createRendererSync(options: RendererSyncOptions = {}) {
  const debug = createDebugLogger('electron-pinia-sync:renderer', options.debug ?? false, options.logger);
  debug.debug('Initializing RendererSync');

  let api: PiniaSyncAPI | undefined = options.customApi;

  if (!api) {
    if (typeof window !== 'undefined' && window.piniaSync) {
      api = window.piniaSync;
    } else if (typeof globalThis !== 'undefined' && (globalThis as unknown as {
      window?: { piniaSync?: PiniaSyncAPI }
    }).window?.piniaSync) {
      api = (globalThis as unknown as { window: { piniaSync: PiniaSyncAPI } }).window.piniaSync;
    }
  }

  // Check if API is available
  if (!api) {
    debug.error('window.piniaSync is not available. Make sure the preload script is loaded correctly.');
    throw new Error('Pinia sync API not available');
  }

  debug.debug('Pinia sync API found');

  const processingTransactions = new Set<string>();

  return function rendererSyncPlugin(context: PiniaPluginContext) {
    const {store} = context;
    debug.debug(`Initializing sync for store: ${store.$id}`);

    // Track if we're currently applying a remote update
    let isApplyingRemoteUpdate = false;

    // Track previous state for efficient diffing
    let previousState: StateTree = toRawState(store.$state);

    /**
     * Pull initial state from Main process
     */
    const initializeState = async () => {
      debug.debug(`Pulling initial state for store: ${store.$id}`);
      try {
        const state = await api.pullState(store.$id);

        if (state !== null) {
          debug.verbose(`Received initial state for ${store.$id}:`, formatStateForDebug(state));
          // Apply state without triggering sync back to Main
          // Use applyPatch to replace top-level keys (handles deletions correctly)
          isApplyingRemoteUpdate = true;
          applyPatch(store, state);
          previousState = toRawState(store.$state);
          isApplyingRemoteUpdate = false;
          debug.debug(`Successfully initialized state for store: ${store.$id}`);
        } else {
          debug.debug(`No initial state available for store: ${store.$id}`);
        }
      } catch (error) {
        debug.error(`Failed to pull initial state for store "${store.$id}":`, error);
      }
    };

    /**
     * Subscribe to local state changes and sync to Main
     */
    const subscribeToLocalChanges = () => {
      debug.debug(`Subscribing to local changes for store: ${store.$id}`);
      store.$subscribe((_mutation, state) => {
        // Skip if we're applying a remote update
        if (isApplyingRemoteUpdate) {
          debug.verbose(`Skipping sync for ${store.$id} (applying remote update)`);
          return;
        }

        debug.verbose(`Local state changed for ${store.$id}`);

        // Serialize current state
        const serializedState = toRawState(state);

        // Build patch using microdiff (only send changed top-level keys)
        const patch = buildPatch(previousState, serializedState);

        // Update previous state for next diff
        previousState = serializedState;

        // Skip if no changes detected
        if (Object.keys(patch).length === 0) {
          debug.verbose(`No changes detected for ${store.$id}, skipping sync`);
          return;
        }

        debug.verbose(`Calculated patch for ${store.$id}:`, formatPatchForDebug(patch));

        const transactionId = generateTransactionId();
        debug.debug(`Syncing patch to Main (transaction: ${transactionId})`);

        // Track this transaction to prevent echo
        processingTransactions.add(transactionId);

        // Send patch to Main
        api.patchState(store.$id, patch, transactionId).catch((error: unknown) => {
          debug.error(`Failed to sync state for store "${store.$id}":`, error);
        }).finally(() => {
          // Clean up after a delay
          setTimeout(() => {
            processingTransactions.delete(transactionId);
          }, 100);
        });
      }, {detached: true});
    };

    /**
     * Subscribe to state updates from Main process
     */
    const subscribeToRemoteUpdates = () => {
      debug.debug(`Subscribing to remote updates for store: ${store.$id}`);
      // Store unsubscribe function for cleanup
      (store as unknown as { _piniaSync_unsubscribe: () => void })._piniaSync_unsubscribe = api.onStateUpdate((message: StateUpdateMessage) => {
        // Only process updates for this store
        if (message.storeId !== store.$id) {
          return;
        }

        debug.verbose(`Received remote update for ${store.$id}`, message.transactionId ? `(transaction: ${message.transactionId})` : '');

        // Skip if this update was triggered by our own transaction
        if (message.transactionId && processingTransactions.has(message.transactionId)) {
          debug.verbose(`Skipping echo update for ${store.$id} (transaction: ${message.transactionId})`);
          return;
        }

        debug.verbose(`Applying remote state to ${store.$id}:`, formatStateForDebug(message.state));

        // Apply remote state using applyPatch to replace top-level keys (handles deletions correctly)
        isApplyingRemoteUpdate = true;
        applyPatch(store, message.state);
        previousState = toRawState(store.$state);
        isApplyingRemoteUpdate = false;

        debug.debug(`Successfully applied remote update to store: ${store.$id}`);
      });
    };

    // Initialize the store
    debug.debug(`Initializing store synchronization for: ${store.$id}`);
    initializeState();
    subscribeToLocalChanges();
    subscribeToRemoteUpdates();
    debug.debug(`Store ${store.$id} sync setup complete`);

    // Cleanup on store disposal
    const originalDispose = store.$dispose.bind(store);
    store.$dispose = () => {
      debug.debug(`Disposing store: ${store.$id}`);
      const unsubscribe = (store as unknown as { _piniaSync_unsubscribe?: () => void })._piniaSync_unsubscribe;
      if (unsubscribe) {
        unsubscribe();
      }
      originalDispose();
    };
  };
}

// Export types
export type {SyncStoreOptions};

// Export debug utilities for advanced users
export {createDebugLogger, formatStateForDebug, formatPatchForDebug} from '../debug.js';
export type {DebugLevel, DebugLogger} from '../debug.js';
