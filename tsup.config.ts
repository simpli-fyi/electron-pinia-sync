import { defineConfig } from 'tsup';

export default defineConfig([
  // 1. MAIN PROCESS
  {
    entry: { index: 'src/main/index.ts' },
    format: ['cjs', 'esm'],
    outDir: 'dist/main',
    platform: 'node',
    external: ['electron', 'pinia', 'electron-store'],
    noExternal: ['microdiff'],
    dts: true,
    clean: true,
  },
  // 2. PRELOAD SCRIPT (Standalone-Build für Electron Sandbox)
  {
    entry: { index: 'src/preload/index.ts' },
    format: ['cjs', 'esm'],
    outDir: 'dist/preload',
    platform: 'node',
    external: ['electron'],
    noExternal: ['microdiff'],
    dts: true,
    clean: true,
  },
  // 3. RENDERER PROCESS
  {
    entry: { index: 'src/renderer/index.ts' },
    format: ['cjs', 'esm'],
    outDir: 'dist/renderer',
    platform: 'browser',
    external: ['pinia', 'vue', 'electron'],
    noExternal: ['microdiff'],
    dts: true,
    clean: true,
  }
]);
