import type {StateTree, Store as PiniaStore} from 'pinia';

/**
 * Apply a patch to a Pinia store by replacing top-level keys instead of merging.
 * This ensures that deleted nested properties are properly removed.
 *
 * Unlike `store.$patch(patch)` which does a shallow merge (preserving existing nested keys),
 * this function completely replaces each top-level key in the patch.
 *
 * @param store - The Pinia store to patch
 * @param patch - Object containing top-level keys to replace
 *
 * @example
 * ```typescript
 * // If store state is: { user: { name: "John", age: 30 } }
 * // And patch is: { user: { name: "John" } }
 *
 * // store.$patch(patch) would result in: { user: { name: "John", age: 30 } } (age preserved!)
 * // applyPatch(store, patch) results in: { user: { name: "John" } } (age removed!)
 * ```
 */
export function applyPatch(store: PiniaStore, patch: Partial<StateTree>): void {
  store.$patch((state: StateTree) => {
    for (const key of Object.keys(patch)) {
      state[key] = patch[key];
    }
  });
}
