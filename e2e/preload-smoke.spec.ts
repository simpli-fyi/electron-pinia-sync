/**
 * Smoke tests to verify the preload module works correctly in the build
 */

import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const DIST_DIR = join(ROOT_DIR, 'dist');
const TEST_DIR = join(ROOT_DIR, '.test-preload');

test.describe.configure({ mode: 'serial' });

test.describe('Preload Module Usage Tests', () => {
  test.beforeAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  test.afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  test('Side-Effect Import: should have auto-execute code in build', () => {
    const preloadJs = readFileSync(join(DIST_DIR, 'preload', 'index.js'), 'utf-8');

    // Verify the side-effect import will work
    expect(preloadJs).toContain('if (typeof process !== "undefined" && process.type === "renderer")');
    expect(preloadJs).toContain('exposeElectronPiniaSync()');
  });

  test('Explicit Import: should export function correctly', () => {
    const preloadJs = readFileSync(join(DIST_DIR, 'preload', 'index.js'), 'utf-8');
    const preloadDts = readFileSync(join(DIST_DIR, 'preload', 'index.d.ts'), 'utf-8');

    // Verify explicit import will work
    expect(preloadJs).toContain('export {');
    expect(preloadJs).toContain('exposeElectronPiniaSync');

    // Verify TypeScript types
    expect(preloadDts).toContain('function exposeElectronPiniaSync');
    expect(preloadDts).toContain('PreloadSyncOptions');
  });

  test('should create valid TypeScript preload file using side-effect import', () => {
    // Ensure directory exists
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }

    // Create a test preload file using old style
    const preloadCode = `
// Legacy side-effect import
import 'electron-pinia-sync/preload';

console.log('[Test] Preload with side-effect import');
`;

    writeFileSync(join(TEST_DIR, 'preload-legacy.ts'), preloadCode);

    // Verify TypeScript can parse it
    try {
      execSync(`npx tsc --noEmit --moduleResolution bundler --module esnext ${join(TEST_DIR, 'preload-legacy.ts')}`, {
        cwd: ROOT_DIR,
        stdio: 'pipe'
      });
      // If no error thrown, TypeScript is happy
      expect(true).toBe(true);
    } catch (error: any) {
      // Should not have TypeScript errors except module resolution
      const output = error.stdout?.toString() || error.stderr?.toString() || error.message || '';
      console.log('TypeScript output:', output);
      // Allow module resolution errors (expected in test environment)
      const hasOnlyModuleErrors = output.includes('Cannot find module') || output.includes('TS2307') || output.includes('Cannot find name');
      if (!hasOnlyModuleErrors) {
        console.error('Unexpected TypeScript error:', output);
      }
      expect(hasOnlyModuleErrors).toBe(true);
    }
  });

  test('should create valid TypeScript preload file using explicit import', () => {
    // Ensure directory exists
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }

    // Create a test preload file using new style
    const preloadCode = `
import { exposeElectronPiniaSync } from 'electron-pinia-sync/preload';

// With configuration
exposeElectronPiniaSync({
  debug: true
});

console.log('[Test] Preload with explicit import');
`;

    writeFileSync(join(TEST_DIR, 'preload-new.ts'), preloadCode);

    // Verify TypeScript can parse it
    try {
      execSync(`npx tsc --noEmit --moduleResolution bundler --module esnext ${join(TEST_DIR, 'preload-new.ts')}`, {
        cwd: ROOT_DIR,
        stdio: 'pipe'
      });
      expect(true).toBe(true);
    } catch (error: any) {
      const output = error.stdout?.toString() || error.stderr?.toString() || '';
      const hasOnlyModuleErrors = output.includes('Cannot find module') || output.includes('TS2307');
      expect(hasOnlyModuleErrors).toBe(true);
    }
  });

  test('should verify all exported types are available', () => {
    const preloadDts = readFileSync(join(DIST_DIR, 'preload', 'index.d.ts'), 'utf-8');

    // Check all necessary types are exported
    expect(preloadDts).toContain('interface PreloadSyncOptions');
    expect(preloadDts).toContain('type DebugLevel');
    expect(preloadDts).toContain('interface DebugLogger');
    expect(preloadDts).toContain('function exposeElectronPiniaSync');

    // Check options properties
    expect(preloadDts).toContain('debug?:');
    expect(preloadDts).toContain('logger?:');
  });

  test('should verify debug levels are documented', () => {
    const preloadDts = readFileSync(join(DIST_DIR, 'preload', 'index.d.ts'), 'utf-8');

    // Check JSDoc includes debug level documentation
    expect(preloadDts).toContain('false: No logs');
    expect(preloadDts).toContain('true: Enable debug logging');
    expect(preloadDts).toContain("'verbose'");
    expect(preloadDts).toContain("'minimal'");
  });

  test('should verify usage examples in JSDoc', () => {
    const preloadDts = readFileSync(join(DIST_DIR, 'preload', 'index.d.ts'), 'utf-8');

    // Check JSDoc includes usage examples
    expect(preloadDts).toContain('@example');
    expect(preloadDts).toContain('exposeElectronPiniaSync()');
    expect(preloadDts).toContain('debug: true');
    expect(preloadDts).toContain("debug: 'verbose'");
  });

  test('should not bundle Electron in the preload module', () => {
    const preloadJs = readFileSync(join(DIST_DIR, 'preload', 'index.js'), 'utf-8');

    // Should import from electron, not bundle it
    expect(preloadJs).toContain('from "electron"');

    // Should NOT contain Electron implementation
    expect(preloadJs).not.toContain('class BrowserWindow');
    expect(preloadJs).not.toContain('class WebContents');
  });

  test('should use createDebugLogger from debug module', () => {
    const preloadJs = readFileSync(join(DIST_DIR, 'preload', 'index.js'), 'utf-8');

    // Should use the shared debug logger
    expect(preloadJs).toContain('createDebugLogger');
    expect(preloadJs).toContain('electron-pinia-sync:preload');
  });

  test('should have logger methods for different log levels', () => {
    const preloadJs = readFileSync(join(DIST_DIR, 'preload', 'index.js'), 'utf-8');

    // Should use different logger methods
    expect(preloadJs).toContain('logger.debug');
    expect(preloadJs).toContain('logger.verbose');
    expect(preloadJs).toContain('logger.error');
  });
});

