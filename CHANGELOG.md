# [1.4.0](https://github.com/simpli-fyi/electron-pinia-sync/compare/v1.3.0...v1.4.0) (2026-02-12)

### Fixed

- **Critical**: Fixed nested property deletion not syncing correctly between processes
  - Previously, when a nested property was deleted (e.g., `delete store.user.profile.city`), the deletion was not propagated correctly due to Pinia's `$patch()` performing a shallow merge
  - Introduced `applyPatch()` utility that replaces top-level keys instead of merging, ensuring deleted nested properties are properly removed on the receiving end
  - This fix applies to both Main → Renderer and Renderer → Main synchronization

### Changed

- Main process now uses `microdiff` for efficient change detection (only sends changed top-level keys)
- Simplified renderer patch calculation by removing mutation-based fallback
- Both Main and Renderer now use `applyPatch()` for consistent state application

### Added

- New `applyPatch()` utility in `src/utils/applyPatch.ts` for replacing top-level keys without merging
- Added `previousState` tracking to Main process for efficient diffing
- New unit tests for nested deletion scenarios in both Main and Renderer

# [1.3.0](https://github.com/simpli-fyi/electron-pinia-sync/compare/v1.2.0...v1.3.0) (2026-02-03)

### Added

- `exposeElectronPiniaSync(options?)` function for configurable preload initialization
- Debug configuration support in preload script with levels: `false`, `true`, `'verbose'`, `'minimal'`
- Custom logger support in preload script via `logger` option
- `PreloadSyncOptions` interface for type-safe configuration
- New "Debugging" section in README.md with comprehensive examples

### Changed

- Preload script now uses shared `debug.ts` logger with configurable debug levels
- Improved debugging experience with consistent logger across all modules
- Side-effect import `import 'electron-pinia-sync/preload'` still works but is not the recommended approach

## [1.0.0] - 2026-01-30

### Added

- Initial release of electron-pinia-sync
- Main process synchronization manager with `MainSync` class
- Renderer process Pinia plugin with `createRendererSync`
- Preload script for secure IPC communication via contextBridge
- Selective persistence using electron-store v11 (ESM)
- Custom `persist` option for Pinia stores
- Echo-loop prevention using transaction IDs
- Pull-on-Mount strategy for initial state hydration
- Full TypeScript support with strict mode
- Efficient state diffing with `microdiff`
- Support for multiple renderer processes
- Comprehensive unit tests with Vitest 4
- Complete documentation in README.md
- Contributing guidelines in CONTRIBUTING.md
- MIT License
- Basic counter example application

### Technical Details

- **Pinia 3.0**: Full support for Pinia v3
- **Node.js 20+**: Requires Node.js 20 or higher
- **TypeScript 5.7**: Built with latest TypeScript
- **microdiff**: Efficient state change detection

[1.0.0]: https://github.com/simpli-fyi/electron-pinia-sync/releases/tag/v1.0.0
