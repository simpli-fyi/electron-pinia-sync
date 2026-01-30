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
    const request: StatePullRequest = { storeId };
    const response = await ipcRenderer.invoke(
      IPC_CHANNELS.STATE_PULL,
      request
    ) as StatePullResponse;

    return response.state;
  },

  /**
   * Send state patch to Main process
   */
  async patchState(storeId: string, patch: Partial<StateTree>, transactionId: string) {
    const message: StatePatchMessage = {
      storeId,
      patch,
      transactionId,
    };

    await ipcRenderer.invoke(IPC_CHANNELS.STATE_PATCH, message);
  },

  /**
   * Subscribe to state updates from Main process
   */
  onStateUpdate(callback) {
    const listener = (_event: IpcRendererEvent, message: StateUpdateMessage) => {
      callback(message);
    };

    ipcRenderer.on(IPC_CHANNELS.STATE_UPDATED, listener);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.STATE_UPDATED, listener);
    };
  },
};

/**
 * Expose API to renderer process
 */
contextBridge.exposeInMainWorld('piniaSync', piniaSyncAPI);

// TypeScript type augmentation is in types.ts

