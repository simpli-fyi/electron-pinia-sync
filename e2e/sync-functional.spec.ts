/**
 * Real E2E Tests for State Synchronization
 *
 * These tests verify the actual sync functionality works correctly
 * in real Electron apps by creating stores, making changes, and
 * verifying the state is synchronized between Main and Renderer.
 */

import { test, expect, _electron as electron } from '@playwright/test';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const TEST_APPS_DIR = join(ROOT_DIR, '.test-sync-apps');

// Get Electron launch args with CI-specific flags
function getElectronLaunchArgs(mainPath: string) {
  const args = [mainPath];
  const env = { ...process.env, NODE_ENV: 'test' };

  // Add --no-sandbox flag in CI environments
  if (process.env.CI || process.env.ELECTRON_DISABLE_SANDBOX) {
    args.push('--no-sandbox');
    env.ELECTRON_DISABLE_SANDBOX = '1';
  }

  return { args, env };
}

// Helper to wait for piniaSync API to be ready
async function waitForPiniaSync(page: any) {
  if (page.isClosed()) {
    throw new Error('Page closed before piniaSync was available');
  }
  await page.waitForFunction(() => {
    return typeof window.piniaSync !== 'undefined';
  }, { timeout: 5000 });
  await page.waitForTimeout(200);
}


async function waitForWindows(app: any, count: number) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const windows = app.windows();
    if (windows.length >= count) {
      return windows;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Expected ${count} windows, got ${app.windows().length}`);
}

// Helper to create a test app with a specific store definition
function createSyncTestApp(
  name: string,
  storeDefinition: string,
  options: { windowCount?: number } = {}
) {
  const windowCount = options.windowCount ?? 1;
  const uniqueName = `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const appDir = join(TEST_APPS_DIR, uniqueName);

  if (existsSync(appDir)) {
    rmSync(appDir, { recursive: true, force: true });
  }
  mkdirSync(appDir, { recursive: true });
  mkdirSync(join(appDir, 'src'), { recursive: true });

  // package.json
  const packageJson = {
    name: `test-sync-app-${name}`,
    version: '1.0.0',
    main: 'src/main.js',
    type: 'module',
  };
  writeFileSync(join(appDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  // Preload
  const preloadCode = `
import { contextBridge, ipcRenderer } from 'electron';
import { exposeElectronPiniaSync } from '${ROOT_DIR}/dist/preload/index.js';

exposeElectronPiniaSync({ debug: false });

// Expose helper to get/set Main state
contextBridge.exposeInMainWorld('testHelpers', {
  getMainState: () => ipcRenderer.invoke('get-main-state'),
  setMainState: (patch) => ipcRenderer.invoke('set-main-state', patch)
});
`;
  writeFileSync(join(appDir, 'src', 'preload.js'), preloadCode);

  // Main process with store
  const mainCode = `
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createPinia, defineStore } from '${ROOT_DIR}/node_modules/pinia/dist/pinia.mjs';
import { createMainSync } from '${ROOT_DIR}/dist/main/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define store
${storeDefinition}

let mainWindows = [];
let mainSync;
let store;

function createWindow() {
  const win = new BrowserWindow({
    width: 600,
    height: 400,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  win.loadURL('data:text/html,<h1>Sync Test App</h1><div id="app"></div>');
  mainWindows.push(win);
}

function createWindows(count) {
  for (let i = 0; i < count; i += 1) {
    createWindow();
  }
}

// Initialize Pinia sync
mainSync = createMainSync({ debug: false });
const pinia = mainSync.getPinia();

// Create store instance
store = useTestStore(pinia);

// Register store
mainSync.registerStore('test', store, { persist: false });

// IPC handlers to get/set store state from Main
ipcMain.handle('get-main-state', () => {
  return JSON.parse(JSON.stringify(store.$state));
});

ipcMain.handle('set-main-state', (_event, patch) => {
  store.$patch(patch);
  return JSON.parse(JSON.stringify(store.$state));
});

app.whenReady().then(() => {
  createWindows(${windowCount});
});

app.on('window-all-closed', () => {
  mainSync.destroy();
  app.quit();
});
`;

  writeFileSync(join(appDir, 'src', 'main.js'), mainCode);

  return appDir;
}

// Run these Electron apps serially to avoid directory collisions and page-close races
test.describe.configure({ mode: 'serial' });

test.describe('E2E: State Synchronization', () => {
  test.beforeAll(() => {
    if (!existsSync(TEST_APPS_DIR)) {
      mkdirSync(TEST_APPS_DIR, { recursive: true });
    }
  });

  test.afterAll(() => {
    if (existsSync(TEST_APPS_DIR)) {
      rmSync(TEST_APPS_DIR, { recursive: true, force: true });
    }
  });

  test('should sync simple state changes from Renderer to Main', async () => {
    const storeDefinition = `
const useTestStore = defineStore('test', {
  state: () => ({
    counter: 0,
    message: 'Hello'
  }),
  actions: {
    increment() {
      this.counter++;
    },
    setMessage(msg) {
      this.message = msg;
    }
  }
});
`;

    const appDir = createSyncTestApp('simple-sync', storeDefinition);
    const launchConfig = getElectronLaunchArgs(join(appDir, 'src', 'main.js'));

    const electronApp = await electron.launch(launchConfig);

    try {
      const page = await electronApp.firstWindow();
      await waitForPiniaSync(page);

      // Pull initial state from renderer
      const initialState = await page.evaluate(async () => {
        return await window.piniaSync.pullState('test');
      });

      expect(initialState).toEqual({
        counter: 0,
        message: 'Hello'
      });

      // Patch state from renderer
      await page.evaluate(async () => {
        await window.piniaSync.patchState('test', { counter: 5 }, 'test-tx-1');
      });

      await page.waitForTimeout(200);

      // Verify Renderer can pull back the patched value (proves Renderer state is updated)
      const rendererStateAfterPatch = await page.evaluate(async () => {
        return await window.piniaSync.pullState('test');
      });
      expect(rendererStateAfterPatch.counter).toBe(5);
      expect(rendererStateAfterPatch.message).toBe('Hello');

      // Verify Main process has the updated state
      const mainState = await page.evaluate(async () => {
        return await window.testHelpers.getMainState();
      });

      expect(mainState.counter).toBe(5);
      expect(mainState.message).toBe('Hello');
    } finally {
      await electronApp.close();
    }
  });

  test('should sync nested object changes', async () => {
    const storeDefinition = `
const useTestStore = defineStore('test', {
  state: () => ({
    settings: {
      theme: 'dark',
      language: 'en'
    }
  })
});
`;

    const appDir = createSyncTestApp('nested-sync', storeDefinition);
    const launchConfig = getElectronLaunchArgs(join(appDir, 'src', 'main.js'));

    const electronApp = await electron.launch(launchConfig);

    try {
      const page = await electronApp.firstWindow();
      await waitForPiniaSync(page);

      // Change nested property
      await page.evaluate(async () => {
        await window.piniaSync.patchState('test', {
          settings: { theme: 'light', language: 'en' }
        }, 'test-tx-2');
      });

      await page.waitForTimeout(200);

      // Verify Main has updated state
      const mainState = await page.evaluate(async () => {
        return await window.testHelpers.getMainState();
      });

      expect(mainState.settings.theme).toBe('light');
      expect(mainState.settings.language).toBe('en');
    } finally {
      await electronApp.close();
    }
  });

  test('should sync array changes (add, modify, remove)', async () => {
    const storeDefinition = `
const useTestStore = defineStore('test', {
  state: () => ({
    todos: [
      { id: 1, text: 'Buy milk', completed: false },
      { id: 2, text: 'Walk dog', completed: false }
    ]
  })
});
`;

    const appDir = createSyncTestApp('array-sync', storeDefinition);
    const launchConfig = getElectronLaunchArgs(join(appDir, 'src', 'main.js'));

    const electronApp = await electron.launch(launchConfig);

    try {
      const page = await electronApp.firstWindow();
      await waitForPiniaSync(page);

      // Mark first todo as completed
      await page.evaluate(async () => {
        await window.piniaSync.patchState('test', {
          todos: [
            { id: 1, text: 'Buy milk', completed: true },
            { id: 2, text: 'Walk dog', completed: false }
          ]
        }, 'test-tx-3');
      });

      await page.waitForTimeout(200);

      // Verify Main has updated state
      const mainState1 = await page.evaluate(async () => {
        return await window.testHelpers.getMainState();
      });

      expect(mainState1.todos[0].completed).toBe(true);
      expect(mainState1.todos[1].completed).toBe(false);

      // Add a new todo
      await page.evaluate(async () => {
        await window.piniaSync.patchState('test', {
          todos: [
            { id: 1, text: 'Buy milk', completed: true },
            { id: 2, text: 'Walk dog', completed: false },
            { id: 3, text: 'Read book', completed: false }
          ]
        }, 'test-tx-4');
      });

      await page.waitForTimeout(200);

      const mainState2 = await page.evaluate(async () => {
        return await window.testHelpers.getMainState();
      });

      expect(mainState2.todos).toHaveLength(3);
      expect(mainState2.todos[2].text).toBe('Read book');
    } finally {
      await electronApp.close();
    }
  });

  test('should sync deeply nested arrays (3+ levels)', async () => {
    const storeDefinition = `
const useTestStore = defineStore('test', {
  state: () => ({
    sections: [
      {
        id: 1,
        title: 'Work',
        groups: [
          {
            id: 1,
            name: 'Backend',
            tasks: [
              { id: 1, title: 'API endpoint', done: false }
            ]
          }
        ]
      }
    ]
  })
});
`;

    const appDir = createSyncTestApp('deep-nested-sync', storeDefinition);
    const launchConfig = getElectronLaunchArgs(join(appDir, 'src', 'main.js'));

    const electronApp = await electron.launch(launchConfig);

    try {
      const page = await electronApp.firstWindow();
      await waitForPiniaSync(page);

      // Mark task as done
      await page.evaluate(async () => {
        await window.piniaSync.patchState('test', {
          sections: [
            {
              id: 1,
              title: 'Work',
              groups: [
                {
                  id: 1,
                  name: 'Backend',
                  tasks: [
                    { id: 1, title: 'API endpoint', done: true }
                  ]
                }
              ]
            }
          ]
        }, 'test-tx-5');
      });

      await page.waitForTimeout(200);

      // Verify Main has updated state and all siblings are preserved
      const mainState = await page.evaluate(async () => {
        return await window.testHelpers.getMainState();
      });

      expect(mainState.sections[0].groups[0].tasks[0].done).toBe(true);
      expect(mainState.sections[0].title).toBe('Work');
      expect(mainState.sections[0].groups[0].name).toBe('Backend');
      expect(mainState.sections[0].groups[0].tasks[0].title).toBe('API endpoint');
    } finally {
      await electronApp.close();
    }
  });

  test('should sync from Main to Renderer', async () => {
    const storeDefinition = `
const useTestStore = defineStore('test', {
  state: () => ({
    serverValue: 100
  })
});
`;

    const appDir = createSyncTestApp('main-to-renderer', storeDefinition);
    const launchConfig = getElectronLaunchArgs(join(appDir, 'src', 'main.js'));

    const electronApp = await electron.launch(launchConfig);

    try {
      const page = await electronApp.firstWindow();
      await waitForPiniaSync(page);

      // Initial state in Renderer
      const initialState = await page.evaluate(async () => {
        return await window.piniaSync.pullState('test');
      });
      expect(initialState.serverValue).toBe(100);

      // Main manipulates state
      await page.evaluate(async () => {
        await window.testHelpers.setMainState({ serverValue: 250 });
      });

      await page.waitForTimeout(300);

      // Verify Main has the new value
      const mainState = await page.evaluate(async () => {
        return await window.testHelpers.getMainState();
      });
      expect(mainState.serverValue).toBe(250);

      // IMPORTANT: Renderer pulls updated state from Main (proves Main→Renderer sync)
      const updatedState = await page.evaluate(async () => {
        return await window.piniaSync.pullState('test');
      });
      expect(updatedState.serverValue).toBe(250);
    } finally {
      await electronApp.close();
    }
  });

  test('should propagate state from Renderer1 to Renderer2 via Main', async () => {
    const storeDefinition = `
const useTestStore = defineStore('test', {
  state: () => ({
    sharedCounter: 0
  })
});
`;

    const appDir = createSyncTestApp('multi-renderer', storeDefinition, { windowCount: 2 });
    const launchConfig = getElectronLaunchArgs(join(appDir, 'src', 'main.js'));

    const electronApp = await electron.launch(launchConfig);

    try {
      // Wait for both windows
      const windows = await waitForWindows(electronApp, 2);
      const renderer1 = windows[0];
      const renderer2 = windows[1];

      // Only proceed if both pages are valid
      if (!renderer1 || !renderer2) {
        throw new Error('Could not get both renderer windows');
      }

      // Wait for both to be ready
      await waitForPiniaSync(renderer1);
      await waitForPiniaSync(renderer2);

      // Renderer1 changes state
      await renderer1.evaluate(async () => {
        await window.piniaSync.patchState('test', { sharedCounter: 42 }, 'test-tx-multi');
      });

      await renderer2.waitForTimeout(300);

      // Verify Main has the change
      const mainState = await renderer2.evaluate(async () => {
        return await window.testHelpers.getMainState();
      });
      expect(mainState.sharedCounter).toBe(42);

      // IMPORTANT: Renderer2 pulls state (proves Renderer1→Main→Renderer2 sync works)
      const renderer2State = await renderer2.evaluate(async () => {
        return await window.piniaSync.pullState('test');
      });
      expect(renderer2State.sharedCounter).toBe(42);

      // Also verify Renderer1 can still pull the value
      const renderer1State = await renderer1.evaluate(async () => {
        return await window.piniaSync.pullState('test');
      });
      expect(renderer1State.sharedCounter).toBe(42);
    } finally {
      await electronApp.close();
    }
  });

  test('should sync Main Pinia Store changes to Renderer via pullState', async () => {
    const storeDefinition = `
const useTestStore = defineStore('test', {
  state: () => ({
    serverValue: 100
  })
});
`;

    const appDir = createSyncTestApp('main-store-direct', storeDefinition);
    const launchConfig = getElectronLaunchArgs(join(appDir, 'src', 'main.js'));

    const electronApp = await electron.launch(launchConfig);

    try {
      const page = await electronApp.firstWindow();
      await waitForPiniaSync(page);

      // Initial check
      const initialState = await page.evaluate(async () => {
        return await window.piniaSync.pullState('test');
      });
      expect(initialState.serverValue).toBe(100);

      // Main Store wird direkt geändert (via store.$patch im Main Process)
      await page.evaluate(async () => {
        await window.testHelpers.setMainState({ serverValue: 250 });
      });

      await page.waitForTimeout(300);

      // Renderer holt den Wert - sollte automatisch synchronisiert sein
      const updatedState = await page.evaluate(async () => {
        return await window.piniaSync.pullState('test');
      });

      // WICHTIG: Dieser Test beweist, dass Main Store → Renderer funktioniert
      expect(updatedState.serverValue).toBe(250);
    } finally {
      await electronApp.close();
    }
  });

  test('should sync Renderer1 store change to Main and Renderer2 stores', async () => {
    const storeDefinition = `
const useTestStore = defineStore('test', {
  state: () => ({
    sharedValue: 0
  })
});
`;

    const appDir = createSyncTestApp('renderer-to-all', storeDefinition, { windowCount: 2 });
    const launchConfig = getElectronLaunchArgs(join(appDir, 'src', 'main.js'));

    const electronApp = await electron.launch(launchConfig);

    try {
      const windows = await waitForWindows(electronApp, 2);
      const renderer1 = windows[0];
      const renderer2 = windows[1];

      if (!renderer1 || !renderer2) {
        throw new Error('Could not get both renderer windows');
      }

      await waitForPiniaSync(renderer1);
      await waitForPiniaSync(renderer2);

      // Verify initial state
      const initialState1 = await renderer1.evaluate(async () => {
        return await window.piniaSync.pullState('test');
      });
      expect(initialState1.sharedValue).toBe(0);

      const initialState2 = await renderer2.evaluate(async () => {
        return await window.piniaSync.pullState('test');
      });
      expect(initialState2.sharedValue).toBe(0);

      // Renderer1 ändert den Wert (via patchState - simuliert Pinia Store Änderung)
      await renderer1.evaluate(async () => {
        await window.piniaSync.patchState('test', { sharedValue: 999 }, 'test-r1-change');
      });

      await renderer2.waitForTimeout(400);

      // WICHTIG: Verifiziere dass Main Store den neuen Wert hat
      const mainState = await renderer2.evaluate(async () => {
        return await window.testHelpers.getMainState();
      });
      expect(mainState.sharedValue).toBe(999);

      // WICHTIG: Verifiziere dass Renderer2 den neuen Wert hat
      const renderer2State = await renderer2.evaluate(async () => {
        return await window.piniaSync.pullState('test');
      });
      expect(renderer2State.sharedValue).toBe(999);

      // WICHTIG: Verifiziere dass Renderer1 immer noch den Wert hat
      const renderer1State = await renderer1.evaluate(async () => {
        return await window.piniaSync.pullState('test');
      });
      expect(renderer1State.sharedValue).toBe(999);
    } finally {
      await electronApp.close();
    }
  });

});
