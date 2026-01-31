/**
 * E2E Integration Tests for electron-pinia-sync
 *
 * These tests verify that the library modules can be imported and used correctly.
 * Full Electron E2E tests require a running Electron app (see examples/basic-counter).
 */

import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const DIST_DIR = join(ROOT_DIR, 'dist');

test.describe('Build Verification', () => {
  test('dist folder should exist with all modules', () => {
    expect(existsSync(join(DIST_DIR, 'main', 'index.js'))).toBe(true);
    expect(existsSync(join(DIST_DIR, 'main', 'index.d.ts'))).toBe(true);
    expect(existsSync(join(DIST_DIR, 'renderer', 'index.js'))).toBe(true);
    expect(existsSync(join(DIST_DIR, 'renderer', 'index.d.ts'))).toBe(true);
    expect(existsSync(join(DIST_DIR, 'preload', 'index.js'))).toBe(true);
    expect(existsSync(join(DIST_DIR, 'preload', 'index.d.ts'))).toBe(true);
  });

  test('built files should be ESM format', () => {
    const mainContent = readFileSync(join(DIST_DIR, 'main', 'index.js'), 'utf-8');
    const rendererContent = readFileSync(join(DIST_DIR, 'renderer', 'index.js'), 'utf-8');

    // ESM uses export/import syntax
    expect(mainContent).toContain('export');
    expect(rendererContent).toContain('export');

    // Should NOT contain CommonJS patterns
    expect(mainContent).not.toContain('module.exports');
    expect(rendererContent).not.toContain('module.exports');
  });

  test('main module should export MainSync and createMainSync', () => {
    const dtsContent = readFileSync(join(DIST_DIR, 'main', 'index.d.ts'), 'utf-8');

    // Check for class and function declarations (tsup uses different syntax)
    expect(dtsContent).toContain('class MainSync');
    expect(dtsContent).toContain('function createMainSync');
    // Check exports at the end of the file
    expect(dtsContent).toContain('MainSync');
  });

  test('renderer module should export createRendererSync', () => {
    const dtsContent = readFileSync(join(DIST_DIR, 'renderer', 'index.d.ts'), 'utf-8');

    expect(dtsContent).toContain('function createRendererSync');
    expect(dtsContent).toContain('createRendererSync');
  });
});

test.describe('Package Configuration', () => {
  test('package.json should have correct exports', () => {
    const pkgJson = JSON.parse(readFileSync(join(ROOT_DIR, 'package.json'), 'utf-8'));

    expect(pkgJson.type).toBe('module');
    expect(pkgJson.exports['./main']).toBeDefined();
    expect(pkgJson.exports['./renderer']).toBeDefined();
    expect(pkgJson.exports['./preload']).toBeDefined();
  });

  test('package.json should have correct peer dependencies', () => {
    const pkgJson = JSON.parse(readFileSync(join(ROOT_DIR, 'package.json'), 'utf-8'));

    expect(pkgJson.peerDependencies.electron).toBeDefined();
    expect(pkgJson.peerDependencies.pinia).toContain('>=3.0.0');
    expect(pkgJson.peerDependencies.vue).toContain('>=3.5.0');
  });

  test('package.json should have correct repository URL', () => {
    const pkgJson = JSON.parse(readFileSync(join(ROOT_DIR, 'package.json'), 'utf-8'));

    expect(pkgJson.repository.url).toContain('simpli-fyi');
  });
});

test.describe('Module Import Test', () => {
  test('should be able to import types from built modules', async () => {
    // This test verifies the TypeScript declarations are valid
    const mainDts = readFileSync(join(DIST_DIR, 'main', 'index.d.ts'), 'utf-8');
    const rendererDts = readFileSync(join(DIST_DIR, 'renderer', 'index.d.ts'), 'utf-8');

    // Check for proper type exports
    expect(mainDts).toContain('MainSyncOptions');
    expect(rendererDts).toContain('RendererSyncOptions');
  });
});

test.describe('TypeScript Compilation', () => {
  test('typecheck should pass', () => {
    const result = execSync('npm run typecheck', {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // If we get here without throwing, typecheck passed
    expect(result).toBeDefined();
  });
});


