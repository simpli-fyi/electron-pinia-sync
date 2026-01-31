import type {StateTree} from "pinia";

/**
 * Convert Pinia state to plain serializable object
 * This removes reactive proxies and makes it safe for IPC transfer
 */
export function toRawState(state: StateTree): StateTree {
  return JSON.parse(JSON.stringify(state));
}
