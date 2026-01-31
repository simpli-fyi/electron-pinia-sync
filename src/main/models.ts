import Store from "electron-store";
import type {Pinia, StateTree, Store as PiniaStore} from "pinia";
import type {DebugLevel, PersistOptions} from "../types";
import type {DebugLogger} from "../debug";

export interface MainSyncOptions {
  /**
   * electron-store configuration options
   */
  storeOptions?: ConstructorParameters<typeof Store<Record<string, StateTree>>>[0];

  /**
   * Custom Pinia instance (optional, will create one if not provided)
   */
  pinia?: Pinia;

  /**
   * Enable debug logging
   * - true: enable debug logging
   * - 'verbose': enable verbose logging with state diffs
   * - 'minimal': only log errors and warnings
   * - false: disable debug logging (default)
   */
  debug?: DebugLevel;

  /**
   * Custom logger (for testing or custom logging)
   */
  logger?: Partial<DebugLogger>;
}

/**
 * Type for accessing Pinia's internal store map
 * This is necessary because Pinia doesn't expose a public API to get stores by ID
 */
export interface PiniaWithStores extends Pinia {
  _s: Map<string, PiniaStore>;
}

/**
 * Store metadata for tracking persistence settings
 */
export interface StoreMetadata {
  persist: PersistOptions | false;
}
