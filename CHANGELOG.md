# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

