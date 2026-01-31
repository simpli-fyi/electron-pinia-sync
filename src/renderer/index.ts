/**
 * Renderer process Pinia plugin
 * Synchronizes local store changes with Main process and receives updates
 */

import type {PiniaPluginContext, StateTree, SubscriptionCallbackMutation} from 'pinia';
import diff, {type Difference} from 'microdiff';
import type {PiniaSyncAPI, StateUpdateMessage, SyncStoreOptions} from '../types.js';
import {createDebugLogger, formatPatchForDebug, formatStateForDebug} from '../debug.js';
import {toRawState} from "../utils/toRawState";
import type {RendererSyncOptions} from "./models";

/**
 * Generate a unique transaction ID
 */
function generateTransactionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Calculate efficient patch using microdiff
 * Falls back to mutation-based extraction if diff is empty but mutation indicates changes
 */
function calculatePatch(
  oldState: StateTree,
  newState: StateTree,
  mutation: SubscriptionCallbackMutation<StateTree>
): Partial<StateTree> {
  // Use microdiff to detect changes
  const differences: Difference[] = diff(oldState, newState);

  if (differences.length === 0) {
    // No differences detected, use mutation-based fallback
    return extractPatchFromMutation(mutation, newState);
  }

  // Build patch object from differences
  const patch: Partial<StateTree> = {};

  for (const change of differences) {
    if (change.path.length === 0) {
      // Root-level change - return entire state
      return newState;
    }

    // Get the top-level key that changed
    const topLevelKey = change.path[0];
    if (typeof topLevelKey === 'string' || typeof topLevelKey === 'number') {
      // Include the entire top-level property to ensure deep changes are captured
      patch[topLevelKey] = newState[topLevelKey];
    }
  }

  return Object.keys(patch).length > 0 ? patch : extractPatchFromMutation(mutation, newState);
}

/**
 * Extract patch data from mutation (fallback method)
 */
function extractPatchFromMutation(
  mutation: SubscriptionCallbackMutation<StateTree>,
  state: StateTree
): Partial<StateTree> {
  if (mutation.type === 'patch object') {
    return mutation.payload as Partial<StateTree>;
  } else if (mutation.type === 'patch function') {
    // For patch functions, we send the entire state
    return state;
  } else if (mutation.type === 'direct') {
    // For direct mutations, try to extract the changed key
    const patch: Partial<StateTree> = {};
    // Direct mutations have events as an array, try to get key from first event
    const events = mutation.events;
    if (events && Array.isArray(events) && events.length > 0) {
      const firstEvent = events[0];
      const key = firstEvent?.key;
      if (typeof key === 'string' && key in state) {
        patch[key] = state[key];
        return patch;
      }
    }
    // Fallback to entire state if we can't determine the key
    return state;
  } else {
    // Fallback: send entire state
    return state;
  }
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
          isApplyingRemoteUpdate = true;
          store.$patch(state);
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
      store.$subscribe((mutation, state) => {
        // Skip if we're applying a remote update
        if (isApplyingRemoteUpdate) {
          debug.verbose(`Skipping sync for ${store.$id} (applying remote update)`);
          return;
        }

        debug.verbose(`Local state changed for ${store.$id}, mutation type: ${mutation.type}`);

        // Calculate efficient patch using microdiff
        const patch = calculatePatch(previousState, state, mutation);

        // Update previous state for next diff
        previousState = toRawState(state);

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

        // Convert patch to raw serializable object for IPC transfer
        const rawPatch = toRawState(patch);

        // Send patch to Main
        api.patchState(store.$id, rawPatch, transactionId).catch((error: unknown) => {
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
      const unsubscribe = api.onStateUpdate((message: StateUpdateMessage) => {
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

        // Apply remote state
        isApplyingRemoteUpdate = true;
        store.$patch(message.state);
        previousState = toRawState(store.$state);
        isApplyingRemoteUpdate = false;

        debug.debug(`Successfully applied remote update to store: ${store.$id}`);
      });

      // Store unsubscribe function for cleanup
      (store as unknown as { _piniaSync_unsubscribe: () => void })._piniaSync_unsubscribe = unsubscribe;
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
