/**
 * Debug utilities for electron-pinia-sync
 *
 * Enable debug logging programmatically:
 * - { debug: true } - enable debug logging
 * - { debug: 'verbose' } - enable verbose logging with state diffs
 * - { debug: 'minimal' } - only log errors and warnings
 */

export type DebugLevel = boolean | 'verbose' | 'minimal';

export interface DebugLogger {
  log: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
  verbose: (message: string, ...args: unknown[]) => void;
}

/**
 * Create a debug logger for a specific namespace
 */
export function createDebugLogger(
  namespace: string,
  debugLevel: DebugLevel = false,
  customLogger?: Partial<DebugLogger>
): DebugLogger {
  const isEnabled = debugLevel !== false;
  const isVerbose = debugLevel === 'verbose' || debugLevel === true;

  const prefix = `[${namespace}]`;

  const noop = () => { /* no-op */
  };

  const logger = customLogger || console;

  return {
    log: logger.log?.bind(logger, prefix) || console.log.bind(console, prefix),
    warn: logger.warn?.bind(logger, prefix) || console.warn.bind(console, prefix),
    error: logger.error?.bind(logger, prefix) || console.error.bind(console, prefix),

    debug: isEnabled
      ? (logger.log?.bind(logger, prefix) || console.log.bind(console, prefix))
      : noop,

    verbose: isVerbose
      ? (logger.log?.bind(logger, `${prefix}[VERBOSE]`) || console.log.bind(console, `${prefix}[VERBOSE]`))
      : noop,
  };
}

/**
 * Format state for debug output (truncate large objects)
 */
export function formatStateForDebug(state: unknown, maxLength = 200): string {
  try {
    const json = JSON.stringify(state);
    if (json.length > maxLength) {
      return json.substring(0, maxLength) + `... (${json.length} chars total)`;
    }
    return json;
  } catch {
    return '[Circular or non-serializable]';
  }
}

/**
 * Format patch for debug output
 */
export function formatPatchForDebug(patch: unknown): string {
  try {
    const keys = Object.keys(patch as object);
    if (keys.length === 0) {
      return '{}';
    }
    if (keys.length > 5) {
      return `{ ${keys.slice(0, 5).join(', ')}, ... (${keys.length} keys) }`;
    }
    return JSON.stringify(patch, null, 2);
  } catch {
    return '[Invalid patch]';
  }
}

