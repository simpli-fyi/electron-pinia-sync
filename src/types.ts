/**
 * Common types shared across Main, Renderer, and Preload processes
 */

import type { StateTree } from 'pinia';

/**
 * Debug level configuration
 */
export type DebugLevel = boolean | 'verbose' | 'minimal';

/**
 * IPC Channel names for communication between processes
 */
export const IPC_CHANNELS = {
  /** Renderer requests initial state from Main */
  STATE_PULL: 'pinia-sync:state-pull',
  /** Renderer sends patch to Main */
  STATE_PATCH: 'pinia-sync:state-patch',
  /** Main broadcasts state update to all Renderers */
  STATE_UPDATED: 'pinia-sync:state-updated',
  /** Renderer requests full state sync */
  STATE_SYNC: 'pinia-sync:state-sync',
} as const;

/**
 * Message sent from Renderer to Main when state changes
 */
export interface StatePatchMessage {
  /** Store ID */
  storeId: string;
  /** Patch data (partial state) */
  patch: Partial<StateTree>;
  /** Unique transaction ID to prevent echo loops */
  transactionId: string;
}

/**
 * Message sent from Main to Renderer when state is updated
 */
export interface StateUpdateMessage {
  /** Store ID */
  storeId: string;
  /** New state */
  state: StateTree;
  /** Transaction ID that caused this update (if any) */
  transactionId?: string;
}

/**
 * Request for initial state from Main
 */
export interface StatePullRequest {
  /** Store ID */
  storeId: string;
}

/**
 * Response with initial state from Main
 */
export interface StatePullResponse {
  /** Store ID */
  storeId: string;
  /** Current state */
  state: StateTree | null;
}

/**
 * Options for configuring store persistence
 */
export interface PersistOptions {
  /** Whether to persist this store to disk */
  enabled: boolean;
  /** Optional custom key for electron-store (defaults to storeId) */
  key?: string;
}

/**
 * Extended Pinia store options with persistence support
 */
export interface SyncStoreOptions {
  /** Persistence configuration */
  persist?: boolean | PersistOptions;
}

/**
 * API exposed to Renderer via contextBridge
 */
export interface PiniaSyncAPI {
  /**
   * Pull initial state from Main process
   */
  pullState: (storeId: string) => Promise<StateTree | null>;

  /**
   * Send state patch to Main process
   */
  patchState: (storeId: string, patch: Partial<StateTree>, transactionId: string) => Promise<void>;

  /**
   * Subscribe to state updates from Main process
   */
  onStateUpdate: (callback: (message: StateUpdateMessage) => void) => () => void;
}

declare global {
  interface Window {
    piniaSync?: PiniaSyncAPI;
  }
}

