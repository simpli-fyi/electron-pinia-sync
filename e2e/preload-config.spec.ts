/**
 * E2E Tests for Preload Configuration
 *
 * These tests verify both the legacy side-effect import and the new
 * explicit function call approach work correctly in the built output.
 */

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const DIST_DIR = join(ROOT_DIR, 'dist');

test.describe('Preload Build - Backward Compatibility (Side-Effect Import)', () => {
  test('should include auto-execute code for side-effect import', () => {
    const preloadJs = readFileSync(join(DIST_DIR, 'preload', 'index.js'), 'utf-8');

    // Should contain the auto-execute check
    expect(preloadJs).toContain('process.type === "renderer"');
    expect(preloadJs).toContain('exposeElectronPiniaSync()');
  });

  test('should check for process.type before auto-executing', () => {
    const preloadJs = readFileSync(join(DIST_DIR, 'preload', 'index.js'), 'utf-8');

    // Should have proper guard
    expect(preloadJs).toContain('typeof process !== "undefined"');
    expect(preloadJs).toContain('process.type === "renderer"');
  });

  test('auto-execute should call function without arguments (default config)', () => {
    const preloadJs = readFileSync(join(DIST_DIR, 'preload', 'index.js'), 'utf-8');

    // Should call with no arguments for default behavior
    const autoExecuteMatch = preloadJs.match(/if\s*\([^)]+\)\s*{\s*exposeElectronPiniaSync\((.*?)\)/s);
    expect(autoExecuteMatch).toBeTruthy();

    // Arguments should be empty (default config)
    if (autoExecuteMatch) {
      const args = autoExecuteMatch[1].trim();
      expect(args).toBe('');
    }
  });
});

test.describe('Preload Build - New Explicit Function Call', () => {
  test('should export exposeElectronPiniaSync function', () => {
    const preloadJs = readFileSync(join(DIST_DIR, 'preload', 'index.js'), 'utf-8');
    const preloadDts = readFileSync(join(DIST_DIR, 'preload', 'index.d.ts'), 'utf-8');

    // Check JavaScript export
    expect(preloadJs).toContain('exposeElectronPiniaSync');
    expect(preloadJs).toContain('export');

    // Check TypeScript declaration
    expect(preloadDts).toContain('function exposeElectronPiniaSync');
  });

  test('should export PreloadSyncOptions interface', () => {
    const preloadDts = readFileSync(join(DIST_DIR, 'preload', 'index.d.ts'), 'utf-8');

    expect(preloadDts).toContain('interface PreloadSyncOptions');
    expect(preloadDts).toContain('debug?:');
    expect(preloadDts).toContain('logger?:');
  });

  test('should have optional options parameter', () => {
    const preloadDts = readFileSync(join(DIST_DIR, 'preload', 'index.d.ts'), 'utf-8');

    // Function should accept optional options
    expect(preloadDts).toContain('exposeElectronPiniaSync(options?:');
  });

  test('should include DebugLevel type with all levels', () => {
    const preloadDts = readFileSync(join(DIST_DIR, 'preload', 'index.d.ts'), 'utf-8');

    expect(preloadDts).toContain('DebugLevel');
    expect(preloadDts).toContain("'verbose'");
    expect(preloadDts).toContain("'minimal'");
  });
});

test.describe('Preload Build - Debug Logger Integration', () => {
  test('should use createDebugLogger from debug.ts', () => {
    const preloadJs = readFileSync(join(DIST_DIR, 'preload', 'index.js'), 'utf-8');

    // Should use createDebugLogger
    expect(preloadJs).toContain('createDebugLogger');
  });

  test('should create logger with correct namespace', () => {
    const preloadJs = readFileSync(join(DIST_DIR, 'preload', 'index.js'), 'utf-8');

    // Should use electron-pinia-sync:preload namespace
    expect(preloadJs).toContain('electron-pinia-sync:preload');
  });

  test('should use logger methods for IPC operations', () => {
    const preloadJs = readFileSync(join(DIST_DIR, 'preload', 'index.js'), 'utf-8');

    // Should use logger.debug for IPC operations
    expect(preloadJs).toContain('logger.debug');

    // Should use logger.verbose for detailed logs
    expect(preloadJs).toContain('logger.verbose');

    // Should use logger.error for error handling
    expect(preloadJs).toContain('logger.error');
  });

  test('should pass debug option to createDebugLogger', () => {
    const preloadJs = readFileSync(join(DIST_DIR, 'preload', 'index.js'), 'utf-8');

    // Should extract debug option and pass to logger
    expect(preloadJs).toMatch(/debug\s*[=:]\s*false/);
    expect(preloadJs).toContain('createDebugLogger');
  });
});

