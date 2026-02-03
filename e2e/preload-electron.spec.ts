/**
 * Real E2E Tests - Start Electron App and verify both preload approaches work
 */

import { test, expect, _electron as electron } from '@playwright/test';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const TEST_APPS_DIR = join(ROOT_DIR, '.test-electron-apps');

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

// Helper to create a test app
function createTestApp(name: string, preloadCode: string) {
  const appDir = join(TEST_APPS_DIR, name);

  if (existsSync(appDir)) {
    rmSync(appDir, { recursive: true, force: true });
  }
  mkdirSync(appDir, { recursive: true });
  mkdirSync(join(appDir, 'src'), { recursive: true });

  // package.json
  const packageJson = {
    name: `test-app-${name}`,
    version: '1.0.0',
    main: 'src/main.js',
    type: 'module',
  };
  writeFileSync(join(appDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  // Copy preload
  writeFileSync(join(appDir, 'src', 'preload.js'), preloadCode);

  // Create main process
  const mainCode = `
import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createMainSync } from '${ROOT_DIR}/dist/main/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 300,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  mainWindow.loadURL('data:text/html,<h1>Test App</h1>');

  // Expose test method
  mainWindow.webContents.executeJavaScript(\`
    window.testReady = true;
    console.log('[Test] Window ready');
  \`);
}

// Initialize Pinia sync
const mainSync = createMainSync({
  debug: true,
  storeOptions: { name: 'test-store' },
});

const pinia = mainSync.getPinia();

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  mainSync.destroy();
  app.quit();
});
`;

  writeFileSync(join(appDir, 'src', 'main.js'), mainCode);

  // Create renderer
  const rendererCode = `
import { createApp } from '${ROOT_DIR}/node_modules/vue/dist/vue.esm-browser.js';
import { createPinia } from '${ROOT_DIR}/node_modules/pinia/dist/pinia.esm-browser.js';
import { createRendererSync } from '${ROOT_DIR}/dist/renderer/index.js';

const pinia = createPinia();
pinia.use(createRendererSync({ debug: true }));

const app = createApp({
  template: '<div>Test</div>'
});

app.use(pinia);
app.mount('#app');

console.log('[Renderer] App initialized');
`;

  writeFileSync(join(appDir, 'src', 'renderer.js'), rendererCode);

  return appDir;
}

test.describe('E2E: Preload in Real Electron App', () => {
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

  test('should work with side-effect import (legacy) - NO function call', async () => {
    const preloadCode = `
// Legacy side-effect import WITHOUT explicit function call
// This tests backward compatibility
import '${ROOT_DIR}/dist/preload/index.js';

console.log('[Preload] Side-effect import executed (no function call)');
`;

    const appDir = createTestApp('legacy-app', preloadCode);
    const launchConfig = getElectronLaunchArgs(join(appDir, 'src', 'main.js'));

    const electronApp = await electron.launch(launchConfig);

    // Collect console messages and errors
    const consoleMessages: string[] = [];
    const consoleErrors: string[] = [];

    const page = await electronApp.firstWindow();

    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push(text);
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    page.on('pageerror', error => {
      consoleErrors.push(error.message);
    });

    await page.waitForTimeout(1000);

    // Verify NO errors occurred
    expect(consoleErrors.length).toBe(0);
    if (consoleErrors.length > 0) {
      console.error('Console errors found:', consoleErrors);
    }

    // Check if window.piniaSync is available
    const hasPiniaSync = await page.evaluate(() => {
      return typeof window.piniaSync !== 'undefined';
    });

    expect(hasPiniaSync).toBe(true);

    // Check if methods are available
    const methods = await page.evaluate(() => {
      return {
        hasPullState: typeof window.piniaSync.pullState === 'function',
        hasPatchState: typeof window.piniaSync.patchState === 'function',
        hasOnStateUpdate: typeof window.piniaSync.onStateUpdate === 'function',
      };
    });

    expect(methods.hasPullState).toBe(true);
    expect(methods.hasPatchState).toBe(true);
    expect(methods.hasOnStateUpdate).toBe(true);

    // Verify preload log appeared
    const hasPreloadLog = consoleMessages.some(msg => msg.includes('[Preload] Side-effect import executed'));
    expect(hasPreloadLog).toBe(true);

    await electronApp.close();
  });

  test('should work with explicit function call (new) - WITH function call', async () => {
    const preloadCode = `
import { exposeElectronPiniaSync } from '${ROOT_DIR}/dist/preload/index.js';

console.log('[Preload] Calling exposeElectronPiniaSync explicitly WITH function call');

// Explicit function call with config
exposeElectronPiniaSync({
  debug: true
});

console.log('[Preload] Explicit call completed');
`;

    const appDir = createTestApp('new-app', preloadCode);
    const launchConfig = getElectronLaunchArgs(join(appDir, 'src', 'main.js'));

    const electronApp = await electron.launch(launchConfig);

    // Collect console messages and errors
    const consoleMessages: string[] = [];
    const consoleErrors: string[] = [];

    const page = await electronApp.firstWindow();

    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push(text);
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    page.on('pageerror', error => {
      consoleErrors.push(error.message);
    });

    await page.waitForTimeout(1000);

    // Debug output before assertion
    if (consoleErrors.length > 0) {
      console.log('\n=== CONSOLE ERRORS FOUND ===');
      consoleErrors.forEach((err, idx) => console.log(`Error ${idx + 1}:`, err));
      console.log('\n=== ALL CONSOLE MESSAGES ===');
      consoleMessages.forEach((msg, idx) => console.log(`Msg ${idx + 1}:`, msg));
      console.log('========================\n');
    }

    // Verify NO errors occurred
    expect(consoleErrors.length).toBe(0);

    // Check if window.piniaSync is available
    const hasPiniaSync = await page.evaluate(() => {
      return typeof window.piniaSync !== 'undefined';
    });

    expect(hasPiniaSync).toBe(true);

    // Check if methods are available
    const methods = await page.evaluate(() => {
      return {
        hasPullState: typeof window.piniaSync.pullState === 'function',
        hasPatchState: typeof window.piniaSync.patchState === 'function',
        hasOnStateUpdate: typeof window.piniaSync.onStateUpdate === 'function',
      };
    });

    expect(methods.hasPullState).toBe(true);
    expect(methods.hasPatchState).toBe(true);
    expect(methods.hasOnStateUpdate).toBe(true);

    // Verify both preload logs appeared
    const hasPreloadLog = consoleMessages.some(msg => msg.includes('[Preload] Calling exposeElectronPiniaSync'));
    const hasCompletedLog = consoleMessages.some(msg => msg.includes('[Preload] Explicit call completed'));
    expect(hasPreloadLog).toBe(true);
    expect(hasCompletedLog).toBe(true);

    await electronApp.close();
  });

  test('should work with verbose debug logging', async () => {
    const preloadCode = `
import { exposeElectronPiniaSync } from '${ROOT_DIR}/dist/preload/index.js';

exposeElectronPiniaSync({
  debug: 'verbose'
});

console.log('[Preload] Verbose debug enabled');
`;

    const appDir = createTestApp('verbose-app', preloadCode);
    const launchConfig = getElectronLaunchArgs(join(appDir, 'src', 'main.js'));

    const electronApp = await electron.launch(launchConfig);

    const page = await electronApp.firstWindow();

    // Collect console logs and errors
    const logs: string[] = [];
    const errors: string[] = [];

    page.on('console', msg => {
      const text = msg.text();
      logs.push(text);
      if (msg.type() === 'error') {
        errors.push(text);
      }
    });

    page.on('pageerror', error => {
      errors.push(error.message);
    });

    await page.waitForTimeout(1000);

    // Verify NO errors occurred
    expect(errors.length).toBe(0);
    if (errors.length > 0) {
      console.error('Console errors found:', errors);
    }

    // Check if window.piniaSync is available
    const hasPiniaSync = await page.evaluate(() => {
      return typeof window.piniaSync !== 'undefined';
    });

    expect(hasPiniaSync).toBe(true);

    // Verify debug logs were produced
    const hasDebugLogs = logs.some(log => log.includes('[electron-pinia-sync:preload]'));
    expect(hasDebugLogs).toBe(true);

    await electronApp.close();
  });

  test('should show warning when trying to expose twice', async () => {
    // This test explicitly calls exposeElectronPiniaSync twice to verify the warning
    const preloadCode = `
import { exposeElectronPiniaSync } from '${ROOT_DIR}/dist/preload/index.js';

console.log('[Preload] Auto-expose happened on import');

// Try calling explicitly - should show warning
exposeElectronPiniaSync({
  debug: true
});

console.log('[Preload] Second call completed');
`;

    const appDir = createTestApp('double-expose-warning-app', preloadCode);
    const launchConfig = getElectronLaunchArgs(join(appDir, 'src', 'main.js'));

    const electronApp = await electron.launch(launchConfig);

    const page = await electronApp.firstWindow();

    // Collect console logs
    const warnings: string[] = [];

    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'warning') {
        warnings.push(text);
      }
    });

    await page.waitForTimeout(1000);

    // Check if warning appeared
    const hasWarning = warnings.some(warning =>
      warning.includes('API already exposed') ||
      warning.includes('Skipping duplicate call')
    );

    expect(hasWarning).toBe(true);

    // Verify window.piniaSync still works
    const hasPiniaSync = await page.evaluate(() => {
      return typeof window.piniaSync !== 'undefined';
    });

    expect(hasPiniaSync).toBe(true);

    await electronApp.close();
  });

  test('should NOT double-expose when using explicit call after side-effect import', async () => {
    // This tests that calling the function explicitly doesn't break if auto-execute already ran
    const preloadCode = `
import { exposeElectronPiniaSync } from '${ROOT_DIR}/dist/preload/index.js';

console.log('[Preload] Import executed (auto-expose should have happened)');

// Try calling explicitly - should not cause errors or double-expose
try {
  exposeElectronPiniaSync({
    debug: true
  });
  console.log('[Preload] Explicit call succeeded without error');
} catch (error) {
  console.error('[Preload] ERROR: Explicit call failed:', error.message);
}
`;

    const appDir = createTestApp('double-expose-test-app', preloadCode);
    const launchConfig = getElectronLaunchArgs(join(appDir, 'src', 'main.js'));

    const electronApp = await electron.launch(launchConfig);

    const consoleMessages: string[] = [];
    const consoleErrors: string[] = [];

    const page = await electronApp.firstWindow();

    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push(text);
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    page.on('pageerror', error => {
      consoleErrors.push(error.message);
    });

    await page.waitForTimeout(1000);

    // Verify NO errors occurred
    expect(consoleErrors.length).toBe(0);
    if (consoleErrors.length > 0) {
      console.error('Console errors found:', consoleErrors);
    }

    // Verify window.piniaSync is still available
    const hasPiniaSync = await page.evaluate(() => {
      return typeof window.piniaSync !== 'undefined';
    });

    expect(hasPiniaSync).toBe(true);

    // Verify explicit call succeeded
    const hasSuccessLog = consoleMessages.some(msg => msg.includes('[Preload] Explicit call succeeded'));
    expect(hasSuccessLog).toBe(true);

    await electronApp.close();
  });
});
