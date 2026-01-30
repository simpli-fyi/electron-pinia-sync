/**
 * Unit tests for Main process sync functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPinia, defineStore } from 'pinia';
import { MainSync } from '../main/index.js';
import { IPC_CHANNELS } from '../types.js';

// Store registered IPC handlers for testing
const ipcHandlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>();

// Mock electron modules
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (event: unknown, ...args: unknown[]) => unknown) => {
      ipcHandlers.set(channel, handler);
    }),
    removeHandler: vi.fn((channel: string) => {
      ipcHandlers.delete(channel);
    }),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

// Mock electron-store with shared data
const mockStoreData = new Map<string, unknown>();

vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      get(key: string) {
        return mockStoreData.get(key);
      }

      set(key: string, value: unknown) {
        mockStoreData.set(key, value);
      }

      has(key: string) {
        return mockStoreData.has(key);
      }

      delete(key: string) {
        mockStoreData.delete(key);
      }
    },
  };
});

describe('MainSync', () => {
  let mainSync: MainSync;
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    ipcHandlers.clear();
    mockStoreData.clear();
    pinia = createPinia();
    mainSync = new MainSync({ pinia });
  });

  afterEach(() => {
    mainSync.destroy();
  });

  describe('Store Registration', () => {
    it('should register a store without persistence', () => {
      const useTestStore = defineStore('test', {
        state: () => ({
          count: 0,
        }),
      });

      const store = useTestStore(pinia);
      mainSync.registerStore('test', store, { persist: false });

      expect(store.$state.count).toBe(0);
    });

    it('should register a store with persistence', () => {
      const useTestStore = defineStore('test', {
        state: () => ({
          count: 0,
        }),
      });

      const store = useTestStore(pinia);
      mainSync.registerStore('test', store, { persist: true });

      expect(store.$state.count).toBe(0);
    });

    it('should load persisted state when registering', () => {
      // Pre-populate mock store with persisted data
      mockStoreData.set('test', { count: 42 });

      const useTestStore = defineStore('test', {
        state: () => ({
          count: 0,
        }),
      });

      const store = useTestStore(pinia);
      mainSync.registerStore('test', store, { persist: true });

      // Should load persisted state
      expect(store.$state.count).toBe(42);
    });

    it('should load persisted state with custom key', () => {
      // Pre-populate mock store with custom key
      mockStoreData.set('custom-key', { count: 99 });

      const useTestStore = defineStore('test', {
        state: () => ({
          count: 0,
        }),
      });

      const store = useTestStore(pinia);
      mainSync.registerStore('test', store, {
        persist: { enabled: true, key: 'custom-key' },
      });

      expect(store.$state.count).toBe(99);
    });
  });

  describe('State Synchronization', () => {
    it('should update state when patch is applied', () => {
      const useTestStore = defineStore('test', {
        state: () => ({
          count: 0,
          name: 'test',
        }),
      });

      const store = useTestStore(pinia);
      mainSync.registerStore('test', store);

      store.$patch({ count: 10 });
      expect(store.$state.count).toBe(10);
      expect(store.$state.name).toBe('test');
    });

    it('should handle multiple stores independently', () => {
      const useStore1 = defineStore('store1', {
        state: () => ({ value: 1 }),
      });

      const useStore2 = defineStore('store2', {
        state: () => ({ value: 2 }),
      });

      const store1 = useStore1(pinia);
      const store2 = useStore2(pinia);

      mainSync.registerStore('store1', store1);
      mainSync.registerStore('store2', store2);

      store1.$patch({ value: 10 });
      store2.$patch({ value: 20 });

      expect(store1.$state.value).toBe(10);
      expect(store2.$state.value).toBe(20);
    });
  });

  describe('Persistence', () => {
    it('should persist state when persist option is true', async () => {
      const useTestStore = defineStore('test', {
        state: () => ({
          count: 0,
        }),
      });

      const store = useTestStore(pinia);
      mainSync.registerStore('test', store, { persist: true });

      store.$patch({ count: 42 });

      // Wait for async persistence
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(store.$state.count).toBe(42);
      expect(mockStoreData.get('test')).toEqual({ count: 42 });
    });

    it('should not persist state when persist option is false', async () => {
      const useTestStore = defineStore('test', {
        state: () => ({
          count: 0,
        }),
      });

      const store = useTestStore(pinia);
      mainSync.registerStore('test', store, { persist: false });

      store.$patch({ count: 42 });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(store.$state.count).toBe(42);
      expect(mockStoreData.has('test')).toBe(false);
    });

    it('should support custom persistence key', async () => {
      const useTestStore = defineStore('test', {
        state: () => ({
          count: 0,
        }),
      });

      const store = useTestStore(pinia);
      mainSync.registerStore('test', store, {
        persist: { enabled: true, key: 'custom-key' },
      });

      store.$patch({ count: 99 });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(store.$state.count).toBe(99);
      expect(mockStoreData.get('custom-key')).toEqual({ count: 99 });
    });
  });

  describe('IPC Handlers', () => {
    it('should register IPC handlers on creation', () => {
      expect(ipcHandlers.has(IPC_CHANNELS.STATE_PULL)).toBe(true);
      expect(ipcHandlers.has(IPC_CHANNELS.STATE_PATCH)).toBe(true);
    });

    it('should handle STATE_PULL requests', async () => {
      const useTestStore = defineStore('test', {
        state: () => ({
          count: 42,
        }),
      });

      const store = useTestStore(pinia);
      mainSync.registerStore('test', store);

      const handler = ipcHandlers.get(IPC_CHANNELS.STATE_PULL);
      expect(handler).toBeDefined();

      const response = await handler!({}, { storeId: 'test' });
      expect(response).toEqual({
        storeId: 'test',
        state: { count: 42 },
      });
    });

    it('should return null for non-existent stores', async () => {
      const handler = ipcHandlers.get(IPC_CHANNELS.STATE_PULL);
      expect(handler).toBeDefined();

      const response = await handler!({}, { storeId: 'nonexistent' });
      expect(response).toEqual({
        storeId: 'nonexistent',
        state: null,
      });
    });

    it('should handle STATE_PATCH requests', async () => {
      const useTestStore = defineStore('test', {
        state: () => ({
          count: 0,
        }),
      });

      const store = useTestStore(pinia);
      mainSync.registerStore('test', store);

      const handler = ipcHandlers.get(IPC_CHANNELS.STATE_PATCH);
      expect(handler).toBeDefined();

      await handler!({}, {
        storeId: 'test',
        patch: { count: 100 },
        transactionId: 'test-tx-123',
      });

      expect(store.$state.count).toBe(100);
    });

    it('should warn when patching non-existent store', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const handler = ipcHandlers.get(IPC_CHANNELS.STATE_PATCH);
      expect(handler).toBeDefined();

      await handler!({}, {
        storeId: 'nonexistent',
        patch: { count: 100 },
        transactionId: 'test-tx-123',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Store "nonexistent" not found')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Broadcasting', () => {
    it('should broadcast state updates to all windows', async () => {
      const electron = await import('electron');
      const mockWindow = {
        isDestroyed: vi.fn(() => false),
        webContents: {
          send: vi.fn(),
        },
      };

      vi.mocked(electron.BrowserWindow.getAllWindows).mockReturnValue([mockWindow as unknown as Electron.BrowserWindow]);

      const useTestStore = defineStore('test', {
        state: () => ({
          count: 0,
        }),
      });

      const store = useTestStore(pinia);
      mainSync.registerStore('test', store);

      store.$patch({ count: 50 });

      // Wait for broadcast
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        IPC_CHANNELS.STATE_UPDATED,
        expect.objectContaining({
          storeId: 'test',
          state: { count: 50 },
        })
      );
    });

    it('should not broadcast to destroyed windows', async () => {
      const electron = await import('electron');
      const mockWindow = {
        isDestroyed: vi.fn(() => true),
        webContents: {
          send: vi.fn(),
        },
      };

      vi.mocked(electron.BrowserWindow.getAllWindows).mockReturnValue([mockWindow as unknown as Electron.BrowserWindow]);

      const useTestStore = defineStore('test', {
        state: () => ({
          count: 0,
        }),
      });

      const store = useTestStore(pinia);
      mainSync.registerStore('test', store);

      store.$patch({ count: 50 });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });
  });

  describe('getPinia', () => {
    it('should return the managed Pinia instance', () => {
      expect(mainSync.getPinia()).toBe(pinia);
    });
  });

  describe('destroy', () => {
    it('should cleanup IPC handlers', async () => {
      const electron = await import('electron');
      mainSync.destroy();
      expect(electron.ipcMain.removeHandler).toHaveBeenCalledWith(IPC_CHANNELS.STATE_PULL);
      expect(electron.ipcMain.removeHandler).toHaveBeenCalledWith(IPC_CHANNELS.STATE_PATCH);
    });
  });

  describe('Transaction ID Handling', () => {
    it('should not trigger local $subscribe when processing IPC patch', async () => {
      const electron = await import('electron');
      const mockWindow = {
        isDestroyed: vi.fn(() => false),
        webContents: {
          send: vi.fn(),
        },
      };

      vi.mocked(electron.BrowserWindow.getAllWindows).mockReturnValue([mockWindow as unknown as Electron.BrowserWindow]);

      const useTestStore = defineStore('test', {
        state: () => ({
          count: 0,
        }),
      });

      const store = useTestStore(pinia);
      mainSync.registerStore('test', store);

      // Clear any initial broadcasts
      mockWindow.webContents.send.mockClear();

      // Send a patch with a transaction ID (simulating renderer)
      const handler = ipcHandlers.get(IPC_CHANNELS.STATE_PATCH);
      await handler!({}, {
        storeId: 'test',
        patch: { count: 100 },
        transactionId: 'renderer-tx-123',
      });

      // Wait for subscription to trigger
      await new Promise(resolve => setTimeout(resolve, 10));

      // The state should be updated
      expect(store.$state.count).toBe(100);

      // A broadcast should still happen (to sync other renderers)
      // but the original sender will filter it out via transactionId
      expect(mockWindow.webContents.send).toHaveBeenCalled();
    });
  });

  describe('Default Pinia Creation', () => {
    it('should create default Pinia instance if not provided', () => {
      const sync = new MainSync();
      expect(sync.getPinia()).toBeDefined();
      sync.destroy();
    });
  });

  describe('Complex Data Structures', () => {
    describe('Nested Objects', () => {
      it('should persist and restore nested objects correctly', async () => {
        interface UserState {
          user: {
            name: string;
            profile: {
              age: number;
              address: {
                city: string;
                country: string;
              };
            };
          };
        }

        const useTestStore = defineStore('nested-test', {
          state: (): UserState => ({
            user: {
              name: 'John',
              profile: {
                age: 30,
                address: {
                  city: 'Berlin',
                  country: 'Germany',
                },
              },
            },
          }),
        });

        const store = useTestStore(pinia);
        mainSync.registerStore('nested-test', store, { persist: true });

        // Update nested value
        store.$patch({
          user: {
            ...store.user,
            profile: {
              ...store.user.profile,
              address: {
                ...store.user.profile.address,
                city: 'Munich',
              },
            },
          },
        });

        await new Promise(resolve => setTimeout(resolve, 20));

        // Verify persistence
        const persisted = mockStoreData.get('nested-test') as UserState;
        expect(persisted.user.profile.address.city).toBe('Munich');
        expect(persisted.user.profile.address.country).toBe('Germany'); // Preserved
        expect(persisted.user.name).toBe('John'); // Preserved
      });
    });

    describe('Arrays', () => {
      it('should persist and restore arrays correctly', async () => {
        const useTestStore = defineStore('array-test', {
          state: () => ({
            items: ['apple', 'banana'],
          }),
        });

        const store = useTestStore(pinia);
        mainSync.registerStore('array-test', store, { persist: true });

        // Add item
        store.$patch({ items: [...store.items, 'cherry'] });
        await new Promise(resolve => setTimeout(resolve, 20));

        const persisted = mockStoreData.get('array-test') as { items: string[] };
        expect(persisted.items).toEqual(['apple', 'banana', 'cherry']);

        // Remove item
        store.$patch({ items: store.items.filter(i => i !== 'banana') });
        await new Promise(resolve => setTimeout(resolve, 20));

        const persisted2 = mockStoreData.get('array-test') as { items: string[] };
        expect(persisted2.items).toEqual(['apple', 'cherry']);
      });
    });

    describe('Arrays with Objects', () => {
      interface Todo {
        id: number;
        text: string;
        completed: boolean;
      }

      it('should persist array of objects correctly', async () => {
        const useTestStore = defineStore('todos-test', {
          state: () => ({
            todos: [
              { id: 1, text: 'Buy milk', completed: false },
            ] as Todo[],
          }),
        });

        const store = useTestStore(pinia);
        mainSync.registerStore('todos-test', store, { persist: true });

        // Add todoItem
        store.$patch({
          todos: [...store.todos, { id: 2, text: 'Walk dog', completed: false }],
        });
        await new Promise(resolve => setTimeout(resolve, 20));

        const persisted = mockStoreData.get('todos-test') as { todos: Todo[] };
        expect(persisted.todos).toHaveLength(2);
        expect(persisted.todos[1].text).toBe('Walk dog');
      });

      it('should handle object modifications in array', async () => {
        const useTestStore = defineStore('todos-modify-test', {
          state: () => ({
            todos: [
              { id: 1, text: 'Buy milk', completed: false },
              { id: 2, text: 'Walk dog', completed: false },
            ] as Todo[],
          }),
        });

        const store = useTestStore(pinia);
        mainSync.registerStore('todos-modify-test', store, { persist: true });

        // Toggle completed
        store.$patch({
          todos: store.todos.map(t =>
            t.id === 1 ? { ...t, completed: true } : t
          ),
        });
        await new Promise(resolve => setTimeout(resolve, 20));

        const persisted = mockStoreData.get('todos-modify-test') as { todos: Todo[] };
        expect(persisted.todos[0].completed).toBe(true);
        expect(persisted.todos[0].text).toBe('Buy milk'); // Preserved
        expect(persisted.todos[1].completed).toBe(false); // Unchanged
      });

      it('should handle object deletion from array', async () => {
        const useTestStore = defineStore('todos-delete-test', {
          state: () => ({
            todos: [
              { id: 1, text: 'Buy milk', completed: false },
              { id: 2, text: 'Walk dog', completed: true },
              { id: 3, text: 'Clean house', completed: false },
            ] as Todo[],
          }),
        });

        const store = useTestStore(pinia);
        mainSync.registerStore('todos-delete-test', store, { persist: true });

        // Remove by id
        store.$patch({
          todos: store.todos.filter(t => t.id !== 2),
        });
        await new Promise(resolve => setTimeout(resolve, 20));

        const persisted = mockStoreData.get('todos-delete-test') as { todos: Todo[] };
        expect(persisted.todos).toHaveLength(2);
        expect(persisted.todos.find(t => t.id === 2)).toBeUndefined();
      });
    });

    describe('IPC with Complex Data', () => {
      it('should handle STATE_PATCH with nested object changes', async () => {
        interface SettingsState {
          settings: {
            theme: string;
            notifications: {
              email: boolean;
              push: boolean;
            };
          };
        }

        const useTestStore = defineStore('settings-ipc-test', {
          state: (): SettingsState => ({
            settings: {
              theme: 'light',
              notifications: {
                email: true,
                push: false,
              },
            },
          }),
        });

        const store = useTestStore(pinia);
        mainSync.registerStore('settings-ipc-test', store);

        const handler = ipcHandlers.get(IPC_CHANNELS.STATE_PATCH);
        expect(handler).toBeDefined();

        // Simulate renderer sending partial patch
        await handler!({}, {
          storeId: 'settings-ipc-test',
          patch: {
            settings: {
              theme: 'dark',
              notifications: {
                email: true,
                push: true,
              },
            },
          },
          transactionId: 'tx-123',
        });

        expect(store.$state.settings.theme).toBe('dark');
        expect(store.$state.settings.notifications.push).toBe(true);
      });

      it('should handle STATE_PATCH with array modifications', async () => {
        interface ItemsState {
          items: Array<{ id: number; name: string }>;
        }

        const useTestStore = defineStore('items-ipc-test', {
          state: (): ItemsState => ({
            items: [
              { id: 1, name: 'Item 1' },
            ],
          }),
        });

        const store = useTestStore(pinia);
        mainSync.registerStore('items-ipc-test', store);

        const handler = ipcHandlers.get(IPC_CHANNELS.STATE_PATCH);

        // Simulate adding item via IPC
        await handler!({}, {
          storeId: 'items-ipc-test',
          patch: {
            items: [
              { id: 1, name: 'Item 1' },
              { id: 2, name: 'Item 2' },
            ],
          },
          transactionId: 'tx-456',
        });

        expect(store.$state.items).toHaveLength(2);
        expect(store.$state.items[1].name).toBe('Item 2');
      });

      it('should broadcast complex state changes to all windows', async () => {
        const electron = await import('electron');
        const mockWindow = {
          isDestroyed: vi.fn(() => false),
          webContents: {
            send: vi.fn(),
          },
        };

        vi.mocked(electron.BrowserWindow.getAllWindows).mockReturnValue([mockWindow as unknown as Electron.BrowserWindow]);

        interface ComplexState {
          data: {
            users: Array<{ id: number; name: string }>;
            config: Record<string, unknown>;
          };
        }

        const useTestStore = defineStore('complex-broadcast-test', {
          state: (): ComplexState => ({
            data: {
              users: [],
              config: {},
            },
          }),
        });

        const store = useTestStore(pinia);
        mainSync.registerStore('complex-broadcast-test', store);

        mockWindow.webContents.send.mockClear();

        // Update complex state
        store.$patch({
          data: {
            users: [{ id: 1, name: 'John' }],
            config: { maxUsers: 100 },
          },
        });

        await new Promise(resolve => setTimeout(resolve, 20));

        expect(mockWindow.webContents.send).toHaveBeenCalled();
        const sentData = mockWindow.webContents.send.mock.calls[0][1];
        expect(sentData.state.data.users).toHaveLength(1);
        expect(sentData.state.data.config.maxUsers).toBe(100);
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

      it('should persist array of objects containing arrays of objects', async () => {
        const useTestStore = defineStore('nested-array-test', {
          state: () => ({
            categories: [] as Category[],
          }),
        });

        const store = useTestStore(pinia);
        mainSync.registerStore('nested-array-test', store, { persist: true });

        // Trigger persistence with complex data
        store.$patch({
          categories: [
            {
              id: 1,
              name: 'Shopping',
              items: [
                { id: 1, title: 'Buy milk' },
                { id: 2, title: 'Buy eggs' },
              ],
            },
            {
              id: 2,
              name: 'Work',
              items: [
                { id: 3, title: 'Review PR' },
              ],
            },
          ],
        });

        // Wait longer for initial persistence to complete
        await new Promise(resolve => setTimeout(resolve, 50));

        const persisted = mockStoreData.get('nested-array-test') as { categories: Category[] };
        expect(persisted).toBeDefined();
        expect(persisted.categories).toHaveLength(2);
        expect(persisted.categories[0].items).toHaveLength(2);
        expect(persisted.categories[1].items).toHaveLength(1);
      });

      it('should handle adding item to nested array', async () => {
        const useTestStore = defineStore('nested-array-add-test', {
          state: () => ({
            categories: [
              {
                id: 1,
                name: 'Shopping',
                items: [
                  { id: 1, title: 'Buy milk' },
                ],
              },
            ] as Category[],
          }),
        });

        const store = useTestStore(pinia);
        mainSync.registerStore('nested-array-add-test', store, { persist: true });

        // Add item to nested array
        store.$patch({
          categories: store.categories.map(cat =>
            cat.id === 1
              ? { ...cat, items: [...cat.items, { id: 2, title: 'Buy bread' }] }
              : cat
          ),
        });

        await new Promise(resolve => setTimeout(resolve, 20));

        const persisted = mockStoreData.get('nested-array-add-test') as { categories: Category[] };
        expect(persisted.categories[0].items).toHaveLength(2);
        expect(persisted.categories[0].items[1].title).toBe('Buy bread');
      });

      it('should handle removing item from nested array', async () => {
        const useTestStore = defineStore('nested-array-remove-test', {
          state: () => ({
            categories: [
              {
                id: 1,
                name: 'Shopping',
                items: [
                  { id: 1, title: 'Buy milk' },
                  { id: 2, title: 'Buy eggs' },
                  { id: 3, title: 'Buy bread' },
                ],
              },
            ] as Category[],
          }),
        });

        const store = useTestStore(pinia);
        mainSync.registerStore('nested-array-remove-test', store, { persist: true });

        // Remove item from nested array
        store.$patch({
          categories: store.categories.map(cat =>
            cat.id === 1
              ? { ...cat, items: cat.items.filter(item => item.id !== 2) }
              : cat
          ),
        });

        await new Promise(resolve => setTimeout(resolve, 20));

        const persisted = mockStoreData.get('nested-array-remove-test') as { categories: Category[] };
        expect(persisted.categories[0].items).toHaveLength(2);
        expect(persisted.categories[0].items.find(i => i.id === 2)).toBeUndefined();
        expect(persisted.categories[0].items.find(i => i.id === 1)).toBeDefined();
        expect(persisted.categories[0].items.find(i => i.id === 3)).toBeDefined();
      });

      it('should handle modifying nested object in nested array', async () => {
        const useTestStore = defineStore('nested-array-modify-test', {
          state: () => ({
            categories: [
              {
                id: 1,
                name: 'Shopping',
                items: [
                  { id: 1, title: 'Buy milk', metadata: { priority: 'low' } },
                  { id: 2, title: 'Buy eggs' },
                ],
              },
            ] as Category[],
          }),
        });

        const store = useTestStore(pinia);
        mainSync.registerStore('nested-array-modify-test', store, { persist: true });

        // Modify nested object property
        store.$patch({
          categories: store.categories.map(cat =>
            cat.id === 1
              ? {
                  ...cat,
                  items: cat.items.map(item =>
                    item.id === 1
                      ? { ...item, metadata: { priority: 'high', urgent: true } }
                      : item
                  ),
                }
              : cat
          ),
        });

        await new Promise(resolve => setTimeout(resolve, 20));

        const persisted = mockStoreData.get('nested-array-modify-test') as { categories: Category[] };
        expect(persisted.categories[0].items[0].metadata).toEqual({
          priority: 'high',
          urgent: true,
        });
        // Second item should remain unchanged
        expect(persisted.categories[0].items[1].title).toBe('Buy eggs');
      });

      it('should handle adding new category with items', async () => {
        const useTestStore = defineStore('nested-array-add-category-test', {
          state: () => ({
            categories: [
              {
                id: 1,
                name: 'Shopping',
                items: [{ id: 1, title: 'Buy milk' }],
              },
            ] as Category[],
          }),
        });

        const store = useTestStore(pinia);
        mainSync.registerStore('nested-array-add-category-test', store, { persist: true });

        // Add new category with items
        store.$patch({
          categories: [
            ...store.categories,
            {
              id: 2,
              name: 'Home',
              items: [
                { id: 2, title: 'Clean kitchen' },
                { id: 3, title: 'Do laundry' },
              ],
            },
          ],
        });

        await new Promise(resolve => setTimeout(resolve, 20));

        const persisted = mockStoreData.get('nested-array-add-category-test') as { categories: Category[] };
        expect(persisted.categories).toHaveLength(2);
        expect(persisted.categories[1].name).toBe('Home');
        expect(persisted.categories[1].items).toHaveLength(2);
        // Verify original category preserved
        expect(persisted.categories[0].name).toBe('Shopping');
        expect(persisted.categories[0].items).toHaveLength(1);
      });

      it('should handle removing entire category', async () => {
        const useTestStore = defineStore('nested-array-remove-category-test', {
          state: () => ({
            categories: [
              {
                id: 1,
                name: 'Shopping',
                items: [{ id: 1, title: 'Buy milk' }],
              },
              {
                id: 2,
                name: 'Work',
                items: [{ id: 2, title: 'Review PR' }],
              },
              {
                id: 3,
                name: 'Home',
                items: [{ id: 3, title: 'Clean' }],
              },
            ] as Category[],
          }),
        });

        const store = useTestStore(pinia);
        mainSync.registerStore('nested-array-remove-category-test', store, { persist: true });

        // Remove middle category
        store.$patch({
          categories: store.categories.filter(cat => cat.id !== 2),
        });

        await new Promise(resolve => setTimeout(resolve, 20));

        const persisted = mockStoreData.get('nested-array-remove-category-test') as { categories: Category[] };
        expect(persisted.categories).toHaveLength(2);
        expect(persisted.categories.find(c => c.id === 2)).toBeUndefined();
        expect(persisted.categories[0].id).toBe(1);
        expect(persisted.categories[1].id).toBe(3);
      });

      it('should broadcast deeply nested array changes to all windows', async () => {
        const electron = await import('electron');
        const mockWindow = {
          isDestroyed: vi.fn(() => false),
          webContents: {
            send: vi.fn(),
          },
        };

        vi.mocked(electron.BrowserWindow.getAllWindows).mockReturnValue([mockWindow as unknown as Electron.BrowserWindow]);

        const useTestStore = defineStore('nested-array-broadcast-test', {
          state: () => ({
            categories: [
              {
                id: 1,
                name: 'Tasks',
                items: [{ id: 1, title: 'Task 1' }],
              },
            ] as Category[],
          }),
        });

        const store = useTestStore(pinia);
        mainSync.registerStore('nested-array-broadcast-test', store);

        mockWindow.webContents.send.mockClear();

        // Add nested item
        store.$patch({
          categories: store.categories.map(cat =>
            cat.id === 1
              ? { ...cat, items: [...cat.items, { id: 2, title: 'Task 2' }] }
              : cat
          ),
        });

        await new Promise(resolve => setTimeout(resolve, 20));

        expect(mockWindow.webContents.send).toHaveBeenCalled();
        const sentData = mockWindow.webContents.send.mock.calls[0][1];
        expect(sentData.state.categories[0].items).toHaveLength(2);
      });
    });

    describe('Extreme Deep Nesting', () => {
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

      it('should handle three-level nested arrays', async () => {
        const useTestStore = defineStore('extreme-nesting-test', {
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
                          tags: ['urgent', 'frontend'],
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
        mainSync.registerStore('extreme-nesting-test', store, { persist: true });

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
                                    metadata: { reviewed: true, reviewer: 'John' },
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

        await new Promise(resolve => setTimeout(resolve, 20));

        const persisted = mockStoreData.get('extreme-nesting-test') as { data: DeepStructure };
        expect(persisted.data.sections[0].groups[0].tasks[0].tags).toContain('reviewed');
        expect(persisted.data.sections[0].groups[0].tasks[0].metadata?.reviewed).toBe(true);
      });

      it('should handle adding to three-level nested array', async () => {
        const useTestStore = defineStore('extreme-nesting-add-test', {
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
        mainSync.registerStore('extreme-nesting-add-test', store, { persist: true });

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

        await new Promise(resolve => setTimeout(resolve, 20));

        const persisted = mockStoreData.get('extreme-nesting-add-test') as { data: DeepStructure };
        expect(persisted.data.sections[0].groups[0].tasks).toHaveLength(1);
        expect(persisted.data.sections[0].groups[0].tasks[0].description).toBe('New task');
      });

      it('should handle IPC patches with deeply nested arrays', async () => {
        const useTestStore = defineStore('extreme-nesting-ipc-test', {
          state: (): { data: DeepStructure } => ({
            data: {
              sections: [
                {
                  id: 1,
                  title: 'Project A',
                  groups: [
                    {
                      id: 1,
                      name: 'Dev',
                      tasks: [
                        {
                          id: 1,
                          description: 'Task 1',
                          tags: ['tag1'],
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
        mainSync.registerStore('extreme-nesting-ipc-test', store);

        const handler = ipcHandlers.get(IPC_CHANNELS.STATE_PATCH);

        // Simulate renderer sending deeply nested patch
        await handler!({}, {
          storeId: 'extreme-nesting-ipc-test',
          patch: {
            data: {
              sections: [
                {
                  id: 1,
                  title: 'Project A',
                  groups: [
                    {
                      id: 1,
                      name: 'Dev',
                      tasks: [
                        {
                          id: 1,
                          description: 'Task 1 Updated',
                          tags: ['tag1', 'updated'],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
          transactionId: 'tx-deep-123',
        });

        expect(store.data.sections[0].groups[0].tasks[0].description).toBe('Task 1 Updated');
        expect(store.data.sections[0].groups[0].tasks[0].tags).toContain('updated');
      });
    });
  });
});
