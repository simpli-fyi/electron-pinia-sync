import { defineConfig } from 'tsup';

export default defineConfig({
  // ESM-only output
  format: ['esm'],
  // Mark all peer dependencies and dependencies as external
  external: [
    'electron',
    'pinia',
    'vue',
    'electron-store',
    'microdiff',
  ],
  // Ensure node modules are not bundled
  noExternal: [],
  // Platform-specific settings
  platform: 'node',
  // Additional settings
  splitting: false,
  treeshake: true,
  clean: false, // Managed by individual build commands
});

