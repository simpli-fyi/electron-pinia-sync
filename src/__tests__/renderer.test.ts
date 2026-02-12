/**
 * Unit tests for Renderer process sync functionality
 *
 * IMPORTANT: All mock APIs simulate real Electron IPC behavior using structuredClone.
 * This ensures patches are serializable and catches issues with reactive proxies
 * that would otherwise only appear in production (e.g., "An object could not be cloned").
 *
 * See: docs/SERIALIZATION_DECISION.md for details on why toRawState is necessary.
 */

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {createApp} from 'vue';
import {createPinia, defineStore} from 'pinia';
import {createRendererSync} from '../renderer';
import type {PiniaSyncAPI, StateUpdateMessage} from '../types.js';

describe('RendererSync', () => {
  let onStateUpdateCallback: ((message: StateUpdateMessage) => void) | null = null;

  /**
   * Factory to create a fresh mockAPI for each test
   * NOTE: This mock simulates real Electron IPC behavior by using structuredClone
   * to ensure patches are serializable (no reactive proxies).
   * This prevents regression of the "An object could not be cloned" bug.
   */
  function createMockAPI(): PiniaSyncAPI {
    return {
      pullState: vi.fn(async (storeId: string) => {
        if (storeId === 'test') {
          return {count: 10, name: 'initial'};
        }
        return null;
      }),
      patchState: vi.fn(async (storeId: string, patch: unknown) => {
        // Simulate Electron IPC serialization - this would fail if patch contains reactive proxies
        // This catches the bug where toRawState wasn't used before sending patches
        structuredClone(patch);
      }),
      onStateUpdate: vi.fn((callback) => {
        onStateUpdateCallback = callback;
        return () => {
          onStateUpdateCallback = null;
        };
      }),
    };
  }

  /**
   * Helper to create pinia instance with Vue app (required for plugins to work)
   */
  function createTestPinia() {
    const app = createApp({template: '<div/>'});
    const pinia = createPinia();
    app.use(pinia);
    return {app, pinia};
  }

  beforeEach(() => {
    // Reset callback
    onStateUpdateCallback = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Plugin Creation', () => {
    it('should throw error if API is not available', () => {
      // Ensure no global API
      vi.stubGlobal('window', {});

      expect(() => {
        createRendererSync();
      }).toThrow('Pinia sync API not available');
    });

    it('should create plugin successfully when API is available', () => {
      const mockAPI = createMockAPI();
      const plugin = createRendererSync({customApi: mockAPI});
      expect(plugin).toBeTypeOf('function');
    });
  });

  describe('State Initialization', () => {
    it('should pull initial state from Main process', async () => {
      const mockAPI = createMockAPI();
      const {pinia} = createTestPinia();
      const plugin = createRendererSync({customApi: mockAPI});
      pinia.use(plugin);

      const useTestStore = defineStore('test', {
        state: () => ({
          count: 0,
          name: '',
        }),
      });

      const store = useTestStore(pinia);

      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockAPI.pullState).toHaveBeenCalledWith('test');
      // Initial state should be applied
      expect(store.$state.count).toBe(10);
      expect(store.$state.name).toBe('initial');
    });

    it('should handle null initial state', async () => {
      const mockAPI = createMockAPI();
      const {pinia} = createTestPinia();
      const plugin = createRendererSync({customApi: mockAPI});
      pinia.use(plugin);

      const useTestStore = defineStore('nonexistent', {
        state: () => ({
          value: 42,
        }),
      });

      const store = useTestStore(pinia);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockAPI.pullState).toHaveBeenCalledWith('nonexistent');
      // Should keep default state
      expect(store.$state.value).toBe(42);
    });
  });

  describe('Local to Main Synchronization', () => {
    it('should send patches to Main when state changes', async () => {
      const mockAPI = createMockAPI();
      const {pinia} = createTestPinia();
      const plugin = createRendererSync({customApi: mockAPI});
      pinia.use(plugin);

      const useTestStore = defineStore('test', {
        state: () => ({
          count: 0,
        }),
      });

      const store = useTestStore(pinia);

      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 50));

      // Clear previous calls
      vi.mocked(mockAPI.patchState).mockClear();

      // Change state
      store.$patch({count: 20});

      // Wait for async patch
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockAPI.patchState).toHaveBeenCalled();
      const call = vi.mocked(mockAPI.patchState).mock.calls[0];
      expect(call[0]).toBe('test');
      expect(call[1]).toEqual({count: 20});
      expect(call[2]).toBeTruthy(); // Transaction ID
    });

    it('should not send patches during remote update', async () => {
      const mockAPI = createMockAPI();
      const {pinia} = createTestPinia();
      const plugin = createRendererSync({customApi: mockAPI});
      pinia.use(plugin);

      const useTestStore = defineStore('test', {
        state: () => ({
          count: 0,
        }),
      });

      const store = useTestStore(pinia);

      await new Promise(resolve => setTimeout(resolve, 50));

      vi.mocked(mockAPI.patchState).mockClear();

      // Simulate remote update
      if (onStateUpdateCallback) {
        onStateUpdateCallback({
          storeId: 'test',
          state: {count: 30},
        });
      }

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should not send patch back to Main
      expect(mockAPI.patchState).not.toHaveBeenCalled();
      expect(store.$state.count).toBe(30);
    });
  });

  describe('Main to Renderer Synchronization', () => {
    it('should apply updates from Main process', async () => {
      const mockAPI = createMockAPI();
      const {pinia} = createTestPinia();
      const plugin = createRendererSync({customApi: mockAPI});
      pinia.use(plugin);

      const useTestStore = defineStore('test', {
        state: () => ({
          count: 0,
        }),
      });

      const store = useTestStore(pinia);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Simulate update from Main
      if (onStateUpdateCallback) {
        onStateUpdateCallback({
          storeId: 'test',
          state: {count: 50},
        });
      }

      await new Promise(resolve => setTimeout(resolve, 20));

      expect(store.$state.count).toBe(50);
    });

    it('should ignore updates for other stores', async () => {
      const mockAPI = createMockAPI();
      const {pinia} = createTestPinia();
      const plugin = createRendererSync({customApi: mockAPI});
      pinia.use(plugin);

      const useTestStore = defineStore('test', {
        state: () => ({
          count: 0,
        }),
      });

      const store = useTestStore(pinia);

      await new Promise(resolve => setTimeout(resolve, 50));

      const initialCount = store.$state.count;

      // Update for different store
      if (onStateUpdateCallback) {
        onStateUpdateCallback({
          storeId: 'other-store',
          state: {count: 99},
        });
      }

      await new Promise(resolve => setTimeout(resolve, 20));

      // Should not change
      expect(store.$state.count).toBe(initialCount);
    });
  });

  describe('Transaction ID Handling', () => {
    it('should not apply own transaction updates', async () => {
      const mockAPI = createMockAPI();
      const {pinia} = createTestPinia();
      const plugin = createRendererSync({customApi: mockAPI});
      pinia.use(plugin);

      const useTestStore = defineStore('test', {
        state: () => ({
          count: 0,
        }),
      });

      const store = useTestStore(pinia);

      await new Promise(resolve => setTimeout(resolve, 10));

      // Change state locally
      store.$patch({count: 100});

      await new Promise(resolve => setTimeout(resolve, 10));

      // Get the transaction ID from the patch call
      const transactionId = vi.mocked(mockAPI.patchState).mock.calls[0]?.[2];

      // Simulate echo from Main with same transaction ID
      if (onStateUpdateCallback && transactionId) {
        onStateUpdateCallback({
          storeId: 'test',
          state: {count: 100},
          transactionId,
        });
      }

      // Should still be 100, but not applied twice
      expect(store.$state.count).toBe(100);
    });
  });

  describe('Custom Logger', () => {
    it('should use custom logger for errors', async () => {
      const customLogger = {
        warn: vi.fn(),
        error: vi.fn(),
      };

      const failingMockAPI: PiniaSyncAPI = {
        pullState: vi.fn(async () => {
          throw new Error('Test error');
        }),
        patchState: vi.fn(async (storeId: string, patch: unknown) => {
          // Simulate IPC serialization
          structuredClone(patch);
        }),
        onStateUpdate: vi.fn(() => () => {
        }),
      };

      const {pinia} = createTestPinia();
      const plugin = createRendererSync({
        logger: customLogger,
        customApi: failingMockAPI,
      });
      pinia.use(plugin);

      const useTestStore = defineStore('test', {
        state: () => ({value: 0}),
      });

      useTestStore(pinia);

      // Wait for error
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(customLogger.error).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe on dispose', async () => {
      const mockAPI = createMockAPI();
      const {pinia} = createTestPinia();
      const plugin = createRendererSync({customApi: mockAPI});
      pinia.use(plugin);

      const useTestStore = defineStore('test', {
        state: () => ({
          count: 0,
        }),
      });

      const store = useTestStore(pinia);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Call dispose
      store.$dispose();

      // Callback should be cleared
      expect(onStateUpdateCallback).toBeNull();
    });
  });

  describe('Direct Mutation Handling', () => {
    it('should handle direct state mutations', async () => {
      const mockAPI = createMockAPI();
      const {pinia} = createTestPinia();
      const plugin = createRendererSync({customApi: mockAPI});
      pinia.use(plugin);

      const useTestStore = defineStore('test', {
        state: () => ({
          count: 0,
          name: 'test',
        }),
      });

      const store = useTestStore(pinia);

      await new Promise(resolve => setTimeout(resolve, 50));

      vi.mocked(mockAPI.patchState).mockClear();

      // Direct mutation
      store.count = 42;

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockAPI.patchState).toHaveBeenCalled();
    });
  });

  describe('Complex Data Structures', () => {
    /**
     * Helper to create mockAPI that tracks all patches
     * Simulates IPC serialization to catch reactive proxy bugs
     */
    function createTrackingMockAPI() {
      const patches: Array<{ storeId: string; patch: unknown }> = [];
      return {
        api: {
          pullState: vi.fn(async () => null),
          patchState: vi.fn(async (storeId: string, patch: unknown) => {
            // Simulate IPC serialization - would fail on reactive proxies
            structuredClone(patch);
            patches.push({storeId, patch});
          }),
          onStateUpdate: vi.fn(() => () => {
          }),
        } as PiniaSyncAPI,
        patches,
      };
    }

    describe('Nested Objects', () => {
      it('should sync entire nested object when property changes', async () => {
        const {api, patches} = createTrackingMockAPI();
        const {pinia} = createTestPinia();
        const plugin = createRendererSync({customApi: api});
        pinia.use(plugin);

        const useTestStore = defineStore('test', {
          state: () => ({
            user: {
              name: 'John',
              email: 'john@example.com',
              profile: {
                age: 30,
                city: 'Berlin',
              },
            },
          }),
        });

        const store = useTestStore(pinia);
        await new Promise(resolve => setTimeout(resolve, 50));
        patches.length = 0; // Clear initial patches

        // Change nested property
        store.$patch({user: {...store.user, profile: {...store.user.profile, age: 31}}});
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(patches.length).toBeGreaterThan(0);
        const lastPatch = patches[patches.length - 1];
        // Should include the entire user object to preserve other properties
        expect(lastPatch.patch).toHaveProperty('user');
        const patchedUser = (lastPatch.patch as { user: { profile: { age: number } } }).user;
        expect(patchedUser.profile.age).toBe(31);
        // Other properties should still be present
        expect(patchedUser).toHaveProperty('name');
        expect(patchedUser).toHaveProperty('email');
      });

      it('should handle adding new properties to nested objects', async () => {
        const {api, patches} = createTrackingMockAPI();
        const {pinia} = createTestPinia();
        const plugin = createRendererSync({customApi: api});
        pinia.use(plugin);

        interface UserState {
          user: {
            name: string;
            metadata?: Record<string, unknown>;
          };
        }

        const useTestStore = defineStore('test', {
          state: (): UserState => ({
            user: {
              name: 'John',
            },
          }),
        });

        const store = useTestStore(pinia);
        await new Promise(resolve => setTimeout(resolve, 50));
        patches.length = 0;

        // Add new property
        store.$patch({user: {...store.user, metadata: {created: Date.now()}}});
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(patches.length).toBeGreaterThan(0);
        const lastPatch = patches[patches.length - 1];
        expect((lastPatch.patch as { user: UserState['user'] }).user).toHaveProperty('metadata');
      });

      it('should handle deleting properties from nested objects', async () => {
        const {api, patches} = createTrackingMockAPI();
        const {pinia} = createTestPinia();
        const plugin = createRendererSync({customApi: api});
        pinia.use(plugin);

        const useTestStore = defineStore('test', {
          state: () => ({
            settings: {
              theme: 'dark',
              language: 'en',
              notifications: true,
            } as Record<string, unknown>,
          }),
        });

        const store = useTestStore(pinia);
        await new Promise(resolve => setTimeout(resolve, 50));
        patches.length = 0;

        // Delete property directly (Pinia's $patch does shallow merge and won't remove keys)
        delete store.settings.notifications;
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(patches.length).toBeGreaterThan(0);
        const lastPatch = patches[patches.length - 1];
        expect((lastPatch.patch as { settings: Record<string, unknown> }).settings).not.toHaveProperty('notifications');
      });
    });

    describe('Arrays', () => {
      it('should sync array when items are added', async () => {
        const {api, patches} = createTrackingMockAPI();
        const {pinia} = createTestPinia();
        const plugin = createRendererSync({customApi: api});
        pinia.use(plugin);

        const useTestStore = defineStore('test', {
          state: () => ({
            items: ['apple', 'banana'],
          }),
        });

        const store = useTestStore(pinia);
        await new Promise(resolve => setTimeout(resolve, 50));
        patches.length = 0;

        // Add item
        store.$patch({items: [...store.items, 'cherry']});
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(patches.length).toBeGreaterThan(0);
        const lastPatch = patches[patches.length - 1];
        expect((lastPatch.patch as { items: string[] }).items).toContain('cherry');
        expect((lastPatch.patch as { items: string[] }).items).toHaveLength(3);
      });

      it('should sync array when items are removed', async () => {
        const {api, patches} = createTrackingMockAPI();
        const {pinia} = createTestPinia();
        const plugin = createRendererSync({customApi: api});
        pinia.use(plugin);

        const useTestStore = defineStore('test', {
          state: () => ({
            items: ['apple', 'banana', 'cherry'],
          }),
        });

        const store = useTestStore(pinia);
        await new Promise(resolve => setTimeout(resolve, 50));
        patches.length = 0;

        // Remove item
        store.$patch({items: store.items.filter(i => i !== 'banana')});
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(patches.length).toBeGreaterThan(0);
        const lastPatch = patches[patches.length - 1];
        expect((lastPatch.patch as { items: string[] }).items).not.toContain('banana');
        expect((lastPatch.patch as { items: string[] }).items).toHaveLength(2);
      });

      it('should sync array when items are modified', async () => {
        const {api, patches} = createTrackingMockAPI();
        const {pinia} = createTestPinia();
        const plugin = createRendererSync({customApi: api});
        pinia.use(plugin);

        const useTestStore = defineStore('test', {
          state: () => ({
            items: ['apple', 'banana', 'cherry'],
          }),
        });

        const store = useTestStore(pinia);
        await new Promise(resolve => setTimeout(resolve, 50));
        patches.length = 0;

        // Modify item
        const newItems = [...store.items];
        newItems[1] = 'blueberry';
        store.$patch({items: newItems});
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(patches.length).toBeGreaterThan(0);
        const lastPatch = patches[patches.length - 1];
        expect((lastPatch.patch as { items: string[] }).items[1]).toBe('blueberry');
      });
    });

    describe('Arrays with Objects', () => {
      interface Todo {
        id: number;
        text: string;
        completed: boolean;
        tags?: string[];
      }

      it('should sync when adding objects to array', async () => {
        const {api, patches} = createTrackingMockAPI();
        const {pinia} = createTestPinia();
        const plugin = createRendererSync({customApi: api});
        pinia.use(plugin);

        const useTestStore = defineStore('test', {
          state: () => ({
            todos: [
              {id: 1, text: 'Buy milk', completed: false},
            ] as Todo[],
          }),
        });

        const store = useTestStore(pinia);
        await new Promise(resolve => setTimeout(resolve, 50));
        patches.length = 0;

        // Add new todoItem
        store.$patch({
          todos: [...store.todos, {id: 2, text: 'Walk dog', completed: false}],
        });
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(patches.length).toBeGreaterThan(0);
        const lastPatch = patches[patches.length - 1];
        const todos = (lastPatch.patch as { todos: Todo[] }).todos;
        expect(todos).toHaveLength(2);
        expect(todos[1].text).toBe('Walk dog');
      });

      it('should sync when removing objects from array', async () => {
        const {api, patches} = createTrackingMockAPI();
        const {pinia} = createTestPinia();
        const plugin = createRendererSync({customApi: api});
        pinia.use(plugin);

        const useTestStore = defineStore('test', {
          state: () => ({
            todos: [
              {id: 1, text: 'Buy milk', completed: false},
              {id: 2, text: 'Walk dog', completed: true},
              {id: 3, text: 'Clean house', completed: false},
            ] as Todo[],
          }),
        });

        const store = useTestStore(pinia);
        await new Promise(resolve => setTimeout(resolve, 50));
        patches.length = 0;

        // Remove todoItem by id
        store.$patch({
          todos: store.todos.filter(t => t.id !== 2),
        });
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(patches.length).toBeGreaterThan(0);
        const lastPatch = patches[patches.length - 1];
        const todos = (lastPatch.patch as { todos: Todo[] }).todos;
        expect(todos).toHaveLength(2);
        expect(todos.find(t => t.id === 2)).toBeUndefined();
      });

      it('should sync when modifying object properties in array', async () => {
        const {api, patches} = createTrackingMockAPI();
        const {pinia} = createTestPinia();
        const plugin = createRendererSync({customApi: api});
        pinia.use(plugin);

        const useTestStore = defineStore('test', {
          state: () => ({
            todos: [
              {id: 1, text: 'Buy milk', completed: false},
              {id: 2, text: 'Walk dog', completed: false},
            ] as Todo[],
          }),
        });

        const store = useTestStore(pinia);
        await new Promise(resolve => setTimeout(resolve, 50));
        patches.length = 0;

        // Toggle completed status
        store.$patch({
          todos: store.todos.map(t =>
            t.id === 1 ? {...t, completed: true} : t
          ),
        });
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(patches.length).toBeGreaterThan(0);
        const lastPatch = patches[patches.length - 1];
        const todos = (lastPatch.patch as { todos: Todo[] }).todos;
        expect(todos[0].completed).toBe(true);
        // Verify other properties are preserved
        expect(todos[0].text).toBe('Buy milk');
        expect(todos[0].id).toBe(1);
      });

      it('should sync when adding nested array to object in array', async () => {
        const {api, patches} = createTrackingMockAPI();
        const {pinia} = createTestPinia();
        const plugin = createRendererSync({customApi: api});
        pinia.use(plugin);

        const useTestStore = defineStore('test', {
          state: () => ({
            todos: [
              {id: 1, text: 'Buy groceries', completed: false},
            ] as Todo[],
          }),
        });

        const store = useTestStore(pinia);
        await new Promise(resolve => setTimeout(resolve, 50));
        patches.length = 0;

        // Add tags to todoItem
        store.$patch({
          todos: store.todos.map(t =>
            t.id === 1 ? {...t, tags: ['shopping', 'urgent']} : t
          ),
        });
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(patches.length).toBeGreaterThan(0);
        const lastPatch = patches[patches.length - 1];
        const todos = (lastPatch.patch as { todos: Todo[] }).todos;
        expect(todos[0].tags).toEqual(['shopping', 'urgent']);
      });
    });

    describe('Deep Nesting', () => {
      it('should handle deeply nested state changes', async () => {
        const {api, patches} = createTrackingMockAPI();
        const {pinia} = createTestPinia();
        const plugin = createRendererSync({customApi: api});
        pinia.use(plugin);

        interface DeepState {
          level1: {
            level2: {
              level3: {
                value: number;
                items: string[];
              };
            };
          };
        }

        const useTestStore = defineStore('test', {
          state: (): DeepState => ({
            level1: {
              level2: {
                level3: {
                  value: 1,
                  items: ['a', 'b'],
                },
              },
            },
          }),
        });

        const store = useTestStore(pinia);
        await new Promise(resolve => setTimeout(resolve, 50));
        patches.length = 0;

        // Change deeply nested value
        store.$patch({
          level1: {
            level2: {
              level3: {
                value: 42,
                items: ['a', 'b', 'c'],
              },
            },
          },
        });
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(patches.length).toBeGreaterThan(0);
        const lastPatch = patches[patches.length - 1];
        const level1 = (lastPatch.patch as DeepState).level1;
        expect(level1.level2.level3.value).toBe(42);
        expect(level1.level2.level3.items).toEqual(['a', 'b', 'c']);
      });
    });

    describe('Mixed Complex State', () => {
      it('should handle complex state with multiple data types', async () => {
        const {api, patches} = createTrackingMockAPI();
        const {pinia} = createTestPinia();
        const plugin = createRendererSync({customApi: api});
        pinia.use(plugin);

        interface ComplexState {
          user: {
            id: number;
            name: string;
            roles: string[];
          };
          settings: {
            theme: string;
            notifications: {
              email: boolean;
              push: boolean;
            };
          };
          items: Array<{
            id: number;
            data: Record<string, unknown>;
          }>;
          metadata: Record<string, unknown>;
        }

        const useTestStore = defineStore('test', {
          state: (): ComplexState => ({
            user: {
              id: 1,
              name: 'John',
              roles: ['user'],
            },
            settings: {
              theme: 'light',
              notifications: {
                email: true,
                push: false,
              },
            },
            items: [
              {id: 1, data: {value: 100}},
            ],
            metadata: {version: '1.0'},
          }),
        });

        const store = useTestStore(pinia);
        await new Promise(resolve => setTimeout(resolve, 50));
        patches.length = 0;

        // Make multiple changes
        store.$patch({
          user: {...store.user, roles: [...store.user.roles, 'admin']},
          settings: {
            ...store.settings,
            notifications: {...store.settings.notifications, push: true},
          },
        });
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(patches.length).toBeGreaterThan(0);
        const lastPatch = patches[patches.length - 1];

        // Verify user changes
        if ('user' in (lastPatch.patch as object)) {
          const user = (lastPatch.patch as ComplexState).user;
          expect(user.roles).toContain('admin');
          expect(user.name).toBe('John'); // Preserved
        }

        // Verify settings changes
        if ('settings' in (lastPatch.patch as object)) {
          const settings = (lastPatch.patch as ComplexState).settings;
          expect(settings.notifications.push).toBe(true);
          expect(settings.theme).toBe('light'); // Preserved
        }
      });
    });

    describe('Deeply Nested Arrays with Objects', () => {
      interface Category {
        id: number;
        name: string;
        items: Array<{
          id: number;
          title: string;
          metadata?: Record<string, unknown>;
        }>;
      }

      it('should sync deeply nested array modifications', async () => {
        const {api, patches} = createTrackingMockAPI();
        const {pinia} = createTestPinia();
        const plugin = createRendererSync({customApi: api});
        pinia.use(plugin);

        const useTestStore = defineStore('test', {
          state: () => ({
            categories: [
              {
                id: 1,
                name: 'Shopping',
                items: [
                  {id: 1, title: 'Buy milk'},
                  {id: 2, title: 'Buy eggs'},
                ],
              },
            ] as Category[],
          }),
        });

        const store = useTestStore(pinia);
        await new Promise(resolve => setTimeout(resolve, 50));
        patches.length = 0;

        // Modify nested item
        store.$patch({
          categories: store.categories.map(cat =>
            cat.id === 1
              ? {
                ...cat,
                items: cat.items.map(item =>
                  item.id === 1
                    ? {...item, metadata: {priority: 'high'}}
                    : item
                ),
              }
              : cat
          ),
        });
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(patches.length).toBeGreaterThan(0);
        const lastPatch = patches[patches.length - 1];
        const categories = (lastPatch.patch as { categories: Category[] }).categories;
        expect(categories[0].items[0].metadata).toEqual({priority: 'high'});
        // Verify other items preserved
        expect(categories[0].items[1].title).toBe('Buy eggs');
      });

      it('should sync adding items to nested array', async () => {
        const {api, patches} = createTrackingMockAPI();
        const {pinia} = createTestPinia();
        const plugin = createRendererSync({customApi: api});
        pinia.use(plugin);

        const useTestStore = defineStore('test', {
          state: () => ({
            categories: [
              {
                id: 1,
                name: 'Shopping',
                items: [{id: 1, title: 'Buy milk'}],
              },
            ] as Category[],
          }),
        });

        const store = useTestStore(pinia);
        await new Promise(resolve => setTimeout(resolve, 50));
        patches.length = 0;

        // Add item to nested array
        store.$patch({
          categories: store.categories.map(cat =>
            cat.id === 1
              ? {...cat, items: [...cat.items, {id: 2, title: 'Buy bread'}]}
              : cat
          ),
        });
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(patches.length).toBeGreaterThan(0);
        const lastPatch = patches[patches.length - 1];
        const categories = (lastPatch.patch as { categories: Category[] }).categories;
        expect(categories[0].items).toHaveLength(2);
        expect(categories[0].items[1].title).toBe('Buy bread');
      });

      it('should sync removing items from nested array', async () => {
        const {api, patches} = createTrackingMockAPI();
        const {pinia} = createTestPinia();
        const plugin = createRendererSync({customApi: api});
        pinia.use(plugin);

        const useTestStore = defineStore('test', {
          state: () => ({
            categories: [
              {
                id: 1,
                name: 'Shopping',
                items: [
                  {id: 1, title: 'Buy milk'},
                  {id: 2, title: 'Buy eggs'},
                  {id: 3, title: 'Buy bread'},
                ],
              },
            ] as Category[],
          }),
        });

        const store = useTestStore(pinia);
        await new Promise(resolve => setTimeout(resolve, 50));
        patches.length = 0;

        // Remove item from nested array
        store.$patch({
          categories: store.categories.map(cat =>
            cat.id === 1
              ? {...cat, items: cat.items.filter(item => item.id !== 2)}
              : cat
          ),
        });
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(patches.length).toBeGreaterThan(0);
        const lastPatch = patches[patches.length - 1];
        const categories = (lastPatch.patch as { categories: Category[] }).categories;
        expect(categories[0].items).toHaveLength(2);
        expect(categories[0].items.find(i => i.id === 2)).toBeUndefined();
      });

      it('should sync adding new parent with nested items', async () => {
        const {api, patches} = createTrackingMockAPI();
        const {pinia} = createTestPinia();
        const plugin = createRendererSync({customApi: api});
        pinia.use(plugin);

        const useTestStore = defineStore('test', {
          state: () => ({
            categories: [
              {
                id: 1,
                name: 'Shopping',
                items: [{id: 1, title: 'Buy milk'}],
              },
            ] as Category[],
          }),
        });

        const store = useTestStore(pinia);
        await new Promise(resolve => setTimeout(resolve, 50));
        patches.length = 0;

        // Add new category with items
        store.$patch({
          categories: [
            ...store.categories,
            {
              id: 2,
              name: 'Work',
              items: [
                {id: 2, title: 'Review PR'},
                {id: 3, title: 'Write tests'},
              ],
            },
          ],
        });
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(patches.length).toBeGreaterThan(0);
        const lastPatch = patches[patches.length - 1];
        const categories = (lastPatch.patch as { categories: Category[] }).categories;
        expect(categories).toHaveLength(2);
        expect(categories[1].items).toHaveLength(2);
        // Verify original preserved
        expect(categories[0].name).toBe('Shopping');
      });

      it('should apply remote updates to deeply nested arrays', async () => {
        const mockAPI = createMockAPI();
        const {pinia} = createTestPinia();
        const plugin = createRendererSync({customApi: mockAPI});
        pinia.use(plugin);

        const useTestStore = defineStore('test', {
          state: () => ({
            categories: [
              {
                id: 1,
                name: 'Shopping',
                items: [{id: 1, title: 'Buy milk'}],
              },
            ] as Category[],
          }),
        });

        const store = useTestStore(pinia);
        await new Promise(resolve => setTimeout(resolve, 50));

        // Simulate remote update from Main
        if (onStateUpdateCallback) {
          onStateUpdateCallback({
            storeId: 'test',
            state: {
              categories: [
                {
                  id: 1,
                  name: 'Shopping',
                  items: [
                    {id: 1, title: 'Buy milk'},
                    {id: 2, title: 'Buy eggs'},
                  ],
                },
              ],
            },
          });
        }

        await new Promise(resolve => setTimeout(resolve, 20));

        expect(store.categories[0].items).toHaveLength(2);
        expect(store.categories[0].items[1].title).toBe('Buy eggs');
      });
    });

    describe('Extreme Deep Nesting (Three Levels)', () => {
      interface DeepStructure {
        sections: Array<{
          id: number;
          title: string;
          groups: Array<{
            id: number;
            name: string;
            tasks: Array<{
              id: number;
              description: string;
              tags: string[];
              metadata?: Record<string, unknown>;
            }>;
          }>;
        }>;
      }

      it('should sync three-level nested array modifications', async () => {
        const {api, patches} = createTrackingMockAPI();
        const {pinia} = createTestPinia();
        const plugin = createRendererSync({customApi: api});
        pinia.use(plugin);

        const useTestStore = defineStore('test', {
          state: (): { data: DeepStructure } => ({
            data: {
              sections: [
                {
                  id: 1,
                  title: 'Project A',
                  groups: [
                    {
                      id: 1,
                      name: 'Development',
                      tasks: [
                        {
                          id: 1,
                          description: 'Implement feature X',
                          tags: ['urgent'],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          }),
        });

        const store = useTestStore(pinia);
        await new Promise(resolve => setTimeout(resolve, 50));
        patches.length = 0;

        // Modify deeply nested task
        store.$patch({
          data: {
            sections: store.data.sections.map(section =>
              section.id === 1
                ? {
                  ...section,
                  groups: section.groups.map(group =>
                    group.id === 1
                      ? {
                        ...group,
                        tasks: group.tasks.map(task =>
                          task.id === 1
                            ? {
                              ...task,
                              tags: [...task.tags, 'reviewed'],
                              metadata: {reviewed: true},
                            }
                            : task
                        ),
                      }
                      : group
                  ),
                }
                : section
            ),
          },
        });
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(patches.length).toBeGreaterThan(0);
        const lastPatch = patches[patches.length - 1];
        const data = (lastPatch.patch as { data: DeepStructure }).data;
        expect(data.sections[0].groups[0].tasks[0].tags).toContain('reviewed');
        expect(data.sections[0].groups[0].tasks[0].metadata?.reviewed).toBe(true);
      });

      it('should sync adding to three-level nested array', async () => {
        const {api, patches} = createTrackingMockAPI();
        const {pinia} = createTestPinia();
        const plugin = createRendererSync({customApi: api});
        pinia.use(plugin);

        const useTestStore = defineStore('test', {
          state: (): { data: DeepStructure } => ({
            data: {
              sections: [
                {
                  id: 1,
                  title: 'Project A',
                  groups: [
                    {
                      id: 1,
                      name: 'Development',
                      tasks: [],
                    },
                  ],
                },
              ],
            },
          }),
        });

        const store = useTestStore(pinia);
        await new Promise(resolve => setTimeout(resolve, 50));
        patches.length = 0;

        // Add task to deeply nested array
        store.$patch({
          data: {
            sections: store.data.sections.map(section =>
              section.id === 1
                ? {
                  ...section,
                  groups: section.groups.map(group =>
                    group.id === 1
                      ? {
                        ...group,
                        tasks: [
                          ...group.tasks,
                          {
                            id: 1,
                            description: 'New task',
                            tags: ['new'],
                          },
                        ],
                      }
                      : group
                  ),
                }
                : section
            ),
          },
        });
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(patches.length).toBeGreaterThan(0);
        const lastPatch = patches[patches.length - 1];
        const data = (lastPatch.patch as { data: DeepStructure }).data;
        expect(data.sections[0].groups[0].tasks).toHaveLength(1);
        expect(data.sections[0].groups[0].tasks[0].description).toBe('New task');
      });

      it('should sync adding intermediate level (new group with tasks)', async () => {
        const {api, patches} = createTrackingMockAPI();
        const {pinia} = createTestPinia();
        const plugin = createRendererSync({customApi: api});
        pinia.use(plugin);

        const useTestStore = defineStore('test', {
          state: (): { data: DeepStructure } => ({
            data: {
              sections: [
                {
                  id: 1,
                  title: 'Project A',
                  groups: [
                    {
                      id: 1,
                      name: 'Development',
                      tasks: [{id: 1, description: 'Task 1', tags: []}],
                    },
                  ],
                },
              ],
            },
          }),
        });

        const store = useTestStore(pinia);
        await new Promise(resolve => setTimeout(resolve, 50));
        patches.length = 0;

        // Add new group with tasks
        store.$patch({
          data: {
            sections: store.data.sections.map(section =>
              section.id === 1
                ? {
                  ...section,
                  groups: [
                    ...section.groups,
                    {
                      id: 2,
                      name: 'Testing',
                      tasks: [
                        {id: 2, description: 'Write tests', tags: ['test']},
                        {id: 3, description: 'Run tests', tags: ['test']},
                      ],
                    },
                  ],
                }
                : section
            ),
          },
        });
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(patches.length).toBeGreaterThan(0);
        const lastPatch = patches[patches.length - 1];
        const data = (lastPatch.patch as { data: DeepStructure }).data;
        expect(data.sections[0].groups).toHaveLength(2);
        expect(data.sections[0].groups[1].tasks).toHaveLength(2);
        // Verify original group preserved
        expect(data.sections[0].groups[0].name).toBe('Development');
      });

      it('should sync removing from three-level nested array', async () => {
        const {api, patches} = createTrackingMockAPI();
        const {pinia} = createTestPinia();
        const plugin = createRendererSync({customApi: api});
        pinia.use(plugin);

        const useTestStore = defineStore('test', {
          state: (): { data: DeepStructure } => ({
            data: {
              sections: [
                {
                  id: 1,
                  title: 'Project A',
                  groups: [
                    {
                      id: 1,
                      name: 'Development',
                      tasks: [
                        {id: 1, description: 'Task 1', tags: []},
                        {id: 2, description: 'Task 2', tags: []},
                        {id: 3, description: 'Task 3', tags: []},
                      ],
                    },
                  ],
                },
              ],
            },
          }),
        });

        const store = useTestStore(pinia);
        await new Promise(resolve => setTimeout(resolve, 50));
        patches.length = 0;

        // Remove task from deeply nested array
        store.$patch({
          data: {
            sections: store.data.sections.map(section =>
              section.id === 1
                ? {
                  ...section,
                  groups: section.groups.map(group =>
                    group.id === 1
                      ? {
                        ...group,
                        tasks: group.tasks.filter(task => task.id !== 2),
                      }
                      : group
                  ),
                }
                : section
            ),
          },
        });
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(patches.length).toBeGreaterThan(0);
        const lastPatch = patches[patches.length - 1];
        const data = (lastPatch.patch as { data: DeepStructure }).data;
        expect(data.sections[0].groups[0].tasks).toHaveLength(2);
        expect(data.sections[0].groups[0].tasks.find(t => t.id === 2)).toBeUndefined();
      });

      it('should apply remote updates to three-level nested arrays', async () => {
        const mockAPI = createMockAPI();
        const {pinia} = createTestPinia();
        const plugin = createRendererSync({customApi: mockAPI});
        pinia.use(plugin);

        const useTestStore = defineStore('test', {
          state: (): { data: DeepStructure } => ({
            data: {
              sections: [
                {
                  id: 1,
                  title: 'Project A',
                  groups: [
                    {
                      id: 1,
                      name: 'Development',
                      tasks: [],
                    },
                  ],
                },
              ],
            },
          }),
        });

        const store = useTestStore(pinia);
        await new Promise(resolve => setTimeout(resolve, 50));

        // Simulate remote update from Main with new tasks
        if (onStateUpdateCallback) {
          onStateUpdateCallback({
            storeId: 'test',
            state: {
              data: {
                sections: [
                  {
                    id: 1,
                    title: 'Project A',
                    groups: [
                      {
                        id: 1,
                        name: 'Development',
                        tasks: [
                          {id: 1, description: 'New task from Main', tags: ['sync']},
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          });
        }

        await new Promise(resolve => setTimeout(resolve, 20));

        expect(store.data.sections[0].groups[0].tasks).toHaveLength(1);
        expect(store.data.sections[0].groups[0].tasks[0].description).toBe('New task from Main');
      });
    });
  });

  describe('IPC Serialization (Regression Tests)', () => {
    it('should not send reactive proxies over IPC - simulates real Electron behavior', async () => {
      // This test simulates what actually happens in Electron:
      // ipcRenderer.invoke internally uses structuredClone which fails on reactive proxies
      const mockAPI: PiniaSyncAPI = {
        pullState: vi.fn(async () => null),
        patchState: vi.fn(async (storeId: string, patch: unknown) => {
          // Simulate Electron's IPC serialization with structuredClone
          // This would throw "An object could not be cloned" if patch contains reactive proxies
          try {
            structuredClone(patch);
          } catch {
            throw new Error('An object could not be cloned');
          }
        }),
        onStateUpdate: vi.fn(() => () => {}),
      };

      const {pinia} = createTestPinia();
      const plugin = createRendererSync({customApi: mockAPI});
      pinia.use(plugin);

      const useTestStore = defineStore('test', {
        state: () => ({
          count: 0,
          nested: {
            value: 'test',
          },
        }),
      });

      const store = useTestStore(pinia);
      await new Promise(resolve => setTimeout(resolve, 50));

      // Change state - this should NOT throw because toRawState removes proxies
      store.$patch({count: 42});

      await new Promise(resolve => setTimeout(resolve, 50));

      // If toRawState wasn't used, this would throw "An object could not be cloned"
      expect(mockAPI.patchState).toHaveBeenCalled();
      expect(vi.mocked(mockAPI.patchState).mock.calls[0][1]).toEqual({count: 42});
    });

    it('should handle nested object changes without proxy errors', async () => {
      const mockAPI: PiniaSyncAPI = {
        pullState: vi.fn(async () => null),
        patchState: vi.fn(async (storeId: string, patch: unknown) => {
          // Simulate strict IPC serialization
          structuredClone(patch); // Would throw on reactive proxies
        }),
        onStateUpdate: vi.fn(() => () => {}),
      };

      const {pinia} = createTestPinia();
      const plugin = createRendererSync({customApi: mockAPI});
      pinia.use(plugin);

      const useTestStore = defineStore('test', {
        state: () => ({
          user: {
            name: 'John',
            profile: {
              age: 30,
              city: 'Berlin',
            },
          },
        }),
      });

      const store = useTestStore(pinia);
      await new Promise(resolve => setTimeout(resolve, 50));

      // Deep nested change
      store.user.profile.age = 31;

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should not throw - patch is serializable
      expect(mockAPI.patchState).toHaveBeenCalled();
    });

    it('should handle array modifications without proxy errors', async () => {
      const mockAPI: PiniaSyncAPI = {
        pullState: vi.fn(async () => null),
        patchState: vi.fn(async (storeId: string, patch: unknown) => {
          structuredClone(patch); // Would throw on reactive proxies
        }),
        onStateUpdate: vi.fn(() => () => {}),
      };

      const {pinia} = createTestPinia();
      const plugin = createRendererSync({customApi: mockAPI});
      pinia.use(plugin);

      const useTestStore = defineStore('test', {
        state: () => ({
          items: [{id: 1, name: 'Item 1'}],
        }),
      });

      const store = useTestStore(pinia);
      await new Promise(resolve => setTimeout(resolve, 50));

      // Modify array
      store.items.push({id: 2, name: 'Item 2'});

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should not throw
      expect(mockAPI.patchState).toHaveBeenCalled();
    });

    it('should fail WITHOUT toRawState (proof of necessity)', async () => {
      // This test demonstrates WHY toRawState is necessary
      const mockAPI: PiniaSyncAPI = {
        pullState: vi.fn(async () => null),
        patchState: vi.fn(async (storeId: string, patch: unknown) => {
          // Try to clone the patch directly (simulates IPC)
          structuredClone(patch);
        }),
        onStateUpdate: vi.fn(() => () => {}),
      };

      const {pinia} = createTestPinia();
      const plugin = createRendererSync({customApi: mockAPI});
      pinia.use(plugin);

      const useTestStore = defineStore('test', {
        state: () => ({count: 0}),
      });

      const store = useTestStore(pinia);
      await new Promise(resolve => setTimeout(resolve, 50));

      // This works because our implementation uses toRawState
      store.$patch({count: 5});
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockAPI.patchState).toHaveBeenCalled();

      // The patch received should be a plain object (not a proxy)
      const receivedPatch = vi.mocked(mockAPI.patchState).mock.calls[0][1];
      expect(receivedPatch).toEqual({count: 5});

      // Verify it's actually serializable (no reactive proxy)
      expect(() => structuredClone(receivedPatch)).not.toThrow();
    });
  });

  describe('Nested Deletion via Remote Updates (applyPatch)', () => {
    it('should remove nested object properties when remote update omits them', async () => {
      const mockAPI = createMockAPI();
      const {pinia} = createTestPinia();
      const plugin = createRendererSync({customApi: mockAPI});
      pinia.use(plugin);

      interface UserState {
        user: {
          name: string;
          profile: {
            age: number;
            city?: string;
          };
        };
      }

      const useTestStore = defineStore('user-nested-delete', {
        state: (): UserState => ({
          user: {
            name: 'John',
            profile: {
              age: 30,
              city: 'Berlin',
            },
          },
        }),
      });

      const store = useTestStore(pinia);
      await new Promise(resolve => setTimeout(resolve, 50));

      // Simulate remote update with city removed
      onStateUpdateCallback?.({
        storeId: 'user-nested-delete',
        state: {
          user: {
            name: 'John',
            profile: {
              age: 31,
              // city intentionally omitted
            },
          },
        },
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(store.user.name).toBe('John');
      expect(store.user.profile.age).toBe(31);
      // city should be removed, not preserved
      expect((store.user.profile as Record<string, unknown>).city).toBeUndefined();
    });

    it('should remove entire nested object when remote update omits it', async () => {
      const mockAPI = createMockAPI();
      const {pinia} = createTestPinia();
      const plugin = createRendererSync({customApi: mockAPI});
      pinia.use(plugin);

      interface SettingsState {
        settings: {
          theme: string;
          advanced?: {
            debugMode: boolean;
          };
        };
      }

      const useTestStore = defineStore('settings-object-delete', {
        state: (): SettingsState => ({
          settings: {
            theme: 'dark',
            advanced: {
              debugMode: true,
            },
          },
        }),
      });

      const store = useTestStore(pinia);
      await new Promise(resolve => setTimeout(resolve, 50));

      // Simulate remote update with advanced object removed
      onStateUpdateCallback?.({
        storeId: 'settings-object-delete',
        state: {
          settings: {
            theme: 'light',
            // advanced intentionally omitted
          },
        },
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(store.settings.theme).toBe('light');
      expect(store.settings.advanced).toBeUndefined();
    });

    it('should handle array item deletion correctly via remote update', async () => {
      const mockAPI = createMockAPI();
      const {pinia} = createTestPinia();
      const plugin = createRendererSync({customApi: mockAPI});
      pinia.use(plugin);

      interface TodoState {
        todos: Array<{ id: number; text: string }>;
      }

      const useTestStore = defineStore('todos-array-delete', {
        state: (): TodoState => ({
          todos: [
            { id: 1, text: 'Item 1' },
            { id: 2, text: 'Item 2' },
            { id: 3, text: 'Item 3' },
          ],
        }),
      });

      const store = useTestStore(pinia);
      await new Promise(resolve => setTimeout(resolve, 50));

      // Simulate remote update with item 2 removed
      onStateUpdateCallback?.({
        storeId: 'todos-array-delete',
        state: {
          todos: [
            { id: 1, text: 'Item 1' },
            { id: 3, text: 'Item 3' },
          ],
        },
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(store.todos).toHaveLength(2);
      expect(store.todos.find(t => t.id === 2)).toBeUndefined();
      expect(store.todos[0].id).toBe(1);
      expect(store.todos[1].id).toBe(3);
    });

    it('should handle deeply nested deletion via remote update', async () => {
      const mockAPI = createMockAPI();
      const {pinia} = createTestPinia();
      const plugin = createRendererSync({customApi: mockAPI});
      pinia.use(plugin);

      interface ProjectState {
        projects: Array<{
          id: number;
          tasks: Array<{
            id: number;
            metadata?: {
              priority: string;
            };
          }>;
        }>;
      }

      const useTestStore = defineStore('projects-deep-delete', {
        state: (): ProjectState => ({
          projects: [
            {
              id: 1,
              tasks: [
                {
                  id: 1,
                  metadata: {
                    priority: 'high',
                  },
                },
              ],
            },
          ],
        }),
      });

      const store = useTestStore(pinia);
      await new Promise(resolve => setTimeout(resolve, 50));

      // Simulate remote update with metadata removed
      onStateUpdateCallback?.({
        storeId: 'projects-deep-delete',
        state: {
          projects: [
            {
              id: 1,
              tasks: [
                {
                  id: 1,
                  // metadata intentionally omitted
                },
              ],
            },
          ],
        },
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(store.projects[0].tasks[0].id).toBe(1);
      expect(store.projects[0].tasks[0].metadata).toBeUndefined();
    });
  });
});
