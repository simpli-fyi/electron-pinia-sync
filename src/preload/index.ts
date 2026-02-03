/**
 * Preload script for exposing Pinia sync API to renderer process
 * Uses contextBridge for secure IPC communication
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';
import type { StateTree } from 'pinia';
import type {
  PiniaSyncAPI,
  StatePatchMessage,
  StateUpdateMessage,
  StatePullRequest,
  StatePullResponse,
} from '../types.js';
import { IPC_CHANNELS } from '../types.js';
import { createDebugLogger, type DebugLevel, type DebugLogger } from '../debug.js';

// Track if API has already been exposed
let _isExposed = false;

/**
 * Options for configuring the preload script
 */
export interface PreloadSyncOptions {
  /**
   * Debug level:
   * - false: No logs (default)
   * - true: Enable debug logging
   * - 'verbose': Enable verbose logging with detailed payloads
   * - 'minimal': Only log errors and warnings
   * @default false
   */
  debug?: DebugLevel;

  /**
   * Custom logger implementation
   * @default console
   */
  logger?: Partial<DebugLogger>;
}

/**
 * Exposes the piniaSync API to the renderer process via contextBridge.
 * Must be called in the preload script.
 *
 * @param options Configuration options
 *
 * @example
 * ```typescript
 * // Basic usage (no logs)
 * exposeElectronPiniaSync();
 *
 * // With debug logging
 * exposeElectronPiniaSync({ debug: true });
 *
 * // With verbose logging
 * exposeElectronPiniaSync({ debug: 'verbose' });
 * ```
 */
export function exposeElectronPiniaSync(options: PreloadSyncOptions = {}) {
  // Prevent double exposure
  if (_isExposed) {
    console.warn('[electron-pinia-sync:preload] API already exposed. Skipping duplicate call.');
    return;
  }

  const { debug = false, logger: customLogger } = options;

  const logger = createDebugLogger('electron-pinia-sync:preload', debug, customLogger);

  /**
   * API exposed to renderer process via window.piniaSync
   */
  const piniaSyncAPI: PiniaSyncAPI = {
    /**
     * Pull initial state from Main process
     */
    async pullState(storeId: string) {
      logger.debug(`IPC invoke: ${IPC_CHANNELS.STATE_PULL} for store "${storeId}"`);
      const request: StatePullRequest = { storeId };
      const response = (await ipcRenderer.invoke(
        IPC_CHANNELS.STATE_PULL,
        request
      )) as StatePullResponse;

      logger.verbose(
        `IPC response: STATE_PULL for "${storeId}" - state:`,
        response.state ? 'received' : 'null'
      );
      return response.state;
    },

    /**
     * Send state patch to Main process
     */
    async patchState(
      storeId: string,
      patch: Partial<StateTree>,
      transactionId: string
    ) {
      logger.verbose(
        `IPC invoke: ${IPC_CHANNELS.STATE_PATCH} for store "${storeId}", transaction: ${transactionId}`
      );
      const message: StatePatchMessage = {
        storeId,
        patch,
        transactionId,
      };

      await ipcRenderer.invoke(IPC_CHANNELS.STATE_PATCH, message);
      logger.verbose(`IPC response: STATE_PATCH for "${storeId}" completed`);
    },

    /**
     * Subscribe to state updates from Main process
     */
    onStateUpdate(callback) {
      logger.debug(`IPC listener registered: ${IPC_CHANNELS.STATE_UPDATED}`);
      const listener = (
        _event: IpcRendererEvent,
        message: StateUpdateMessage
      ) => {
        logger.verbose(
          `IPC event received: ${IPC_CHANNELS.STATE_UPDATED} for store "${message.storeId}", transaction: ${
            message.transactionId || 'none'
          }`
        );
        callback(message);
      };

      ipcRenderer.on(IPC_CHANNELS.STATE_UPDATED, listener);

      // Return unsubscribe function
      return () => {
        logger.debug(`IPC listener removed: ${IPC_CHANNELS.STATE_UPDATED}`);
        ipcRenderer.removeListener(IPC_CHANNELS.STATE_UPDATED, listener);
      };
    },
  };

  /**
   * Expose API to renderer process
   */
  try {
    contextBridge.exposeInMainWorld('piniaSync', piniaSyncAPI);
    _isExposed = true;
    logger.debug('API exposed to window.piniaSync');
  } catch (error) {
    logger.error('Failed to expose API via contextBridge:', error);
  }
}

// Auto-expose with default options for backward compatibility
// Allows using: import 'electron-pinia-sync/preload'
// This is NOT the recommended approach - prefer explicit function call with config
if (typeof process !== 'undefined' && process.type === 'renderer') {
  exposeElectronPiniaSync();
}

// Export debug types for consumers
export type { DebugLevel, DebugLogger } from '../debug.js';
