import type {DebugLevel, PiniaSyncAPI} from "../types";
import type {DebugLogger} from "../debug";

/**
 * Options for the renderer sync plugin
 */
export interface RendererSyncOptions {
  /**
   * Enable debug logging
   * - true: enable debug logging
   * - 'verbose': enable verbose logging with state diffs
   * - 'minimal': only log errors and warnings
   * - false: disable debug logging (default)
   */
  debug?: DebugLevel;

  /**
   * Custom logger (default: console)
   */
  logger?: Partial<DebugLogger>;

  /**
   * Custom API implementation (for testing)
   * @internal
   */
  customApi?: PiniaSyncAPI;
}
