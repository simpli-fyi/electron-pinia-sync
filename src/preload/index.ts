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

/**
 * API exposed to renderer process via window.piniaSync
 */
const piniaSyncAPI: PiniaSyncAPI = {
  /**
   * Pull initial state from Main process
   */
  async pullState(storeId: string) {
    console.log(`[preload] IPC invoke: ${IPC_CHANNELS.STATE_PULL} for store "${storeId}"`);
    const request: StatePullRequest = { storeId };
    const response = await ipcRenderer.invoke(
      IPC_CHANNELS.STATE_PULL,
      request
    ) as StatePullResponse;

    console.log(`[preload] IPC response: STATE_PULL for "${storeId}" - state:`, response.state ? 'received' : 'null');
    return response.state;
  },

  /**
   * Send state patch to Main process
   */
  async patchState(storeId: string, patch: Partial<StateTree>, transactionId: string) {
    console.log(`[preload] IPC invoke: ${IPC_CHANNELS.STATE_PATCH} for store "${storeId}", transaction: ${transactionId}`);
    const message: StatePatchMessage = {
      storeId,
      patch,
      transactionId,
    };

    await ipcRenderer.invoke(IPC_CHANNELS.STATE_PATCH, message);
    console.log(`[preload] IPC response: STATE_PATCH for "${storeId}" completed`);
  },

  /**
   * Subscribe to state updates from Main process
   */
  onStateUpdate(callback) {
    console.log(`[preload] IPC listener registered: ${IPC_CHANNELS.STATE_UPDATED}`);
    const listener = (_event: IpcRendererEvent, message: StateUpdateMessage) => {
      console.log(`[preload] IPC event received: ${IPC_CHANNELS.STATE_UPDATED} for store "${message.storeId}", transaction: ${message.transactionId || 'none'}`);
      callback(message);
    };

    ipcRenderer.on(IPC_CHANNELS.STATE_UPDATED, listener);

    // Return unsubscribe function
    return () => {
      console.log(`[preload] IPC listener removed: ${IPC_CHANNELS.STATE_UPDATED}`);
      ipcRenderer.removeListener(IPC_CHANNELS.STATE_UPDATED, listener);
    };
  },
};

/**
 * Expose API to renderer process
 */
contextBridge.exposeInMainWorld('piniaSync', piniaSyncAPI);
console.log('[preload] piniaSync API exposed to window');

// TypeScript type augmentation is in types.ts

console.log('[preload] electron-pinia-sync preload script initialized');

