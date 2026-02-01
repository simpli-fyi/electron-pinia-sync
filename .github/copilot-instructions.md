# Copilot Instructions for electron-pinia-sync

## Project Overview

This is **electron-pinia-sync** - a TypeScript library for synchronizing Pinia stores between Electron Main and Renderer processes.

### Requirements
- **Node.js**: >= 20 (see `engines` in package.json)
- **Pinia**: >= 3 (see `peerDependencies` in package.json)
- **Vue**: >= 3.5 (see `peerDependencies` in package.json)
- **Electron**: >= 40 (see `peerDependencies` in package.json)

### Key Features
- ESM-only (no CommonJS)
- Efficient diffing with `microdiff`
- Persistence via `electron-store`
- automatic state hydration

## Architecture

### Modules
- **src/main/** - Main process code (Node.js/Electron)
- **src/renderer/** - Renderer process code (Browser/Vue)
- **src/preload/** - Preload script (contextBridge)
- **src/types.ts** - Shared TypeScript types

### Build System
- **tsup** for ESM-only builds
- **vitest** for unit tests
- **playwright** for E2E tests
- **TypeScript** Strict Mode enabled

## Code Guidelines

### TypeScript
- **ALWAYS** use explicit types for public APIs
- Avoid `any` - use `unknown` or specific types instead
- Use Type Guards for runtime checks
- Export all relevant types for users
- Use `.js` extension for ESM imports (e.g., `from '../types.js'`)

### Imports
```typescript
// ✅ GOOD - External dependencies with .js extension for local imports
import { ipcMain } from 'electron';
import { createPinia } from 'pinia';
import { IPC_CHANNELS } from '../types.js';

// ❌ BAD - Never bundle these! They must remain external
// electron, pinia, vue, electron-store, microdiff
```

### Naming Conventions
- **Classes**: PascalCase (`MainSync`, `RendererSync`)
- **Functions**: camelCase (`createMainSync`, `pullState`)
- **Constants**: UPPER_SNAKE_CASE (`IPC_CHANNELS`)
- **Interfaces**: PascalCase with `Interface` suffix only when necessary (`MainSyncOptions`)
- **Types**: PascalCase (`StateTree`, `StatePatchMessage`)

### Error Handling
```typescript
// ✅ GOOD - Specific errors with context
try {
  await api.pullState(storeId);
} catch (error: unknown) {
  logger.error(
    `[electron-pinia-sync] Failed to pull state for "${storeId}":`,
    error
  );
}

// ❌ BAD - Generic errors
catch (e) { console.log(e); }
```

### JSDoc Comments
All public APIs MUST have JSDoc:
```typescript
/**
 * Creates and initializes the Main process sync manager
 *
 * @param options - Configuration options
 * @returns MainSync instance
 *
 * @example
 * ```typescript
 * const mainSync = createMainSync({
 *   storeOptions: { name: 'my-store' }
 * });
 * ```
 */
export function createMainSync(options?: MainSyncOptions): MainSync {
  return new MainSync(options);
}
```

## Key Concepts

### 1. Main as Single Source of Truth
The Main process holds the authoritative state copy. Renderer processes synchronize with Main.

### 2. Transaction IDs
Prevents echo loops:
```typescript
const transactionId = generateTransactionId();
processingTransactions.add(transactionId);
// ... send to Main ...
// Main sends back with same transactionId
// Original Renderer ignores update
```

### 3. Efficient Patching with microdiff
Uses `microdiff` for efficient change detection. On nested changes, the **entire top-level property** is sent to preserve sibling data:

```typescript
// When state.user.profile.age changes:
// microdiff detects: { path: ['user', 'profile', 'age'], ... }
// Patch sent: { user: { ...entire user object } }
// This ensures nested siblings (name, email) are not lost
```

### 4. Async Initialization
Renderer pulls initial state on mount:
```typescript
const state = await api.pullState(store.$id);
if (state !== null) {
  store.$patch(state);
}
```

## Testing

### Unit Tests
```typescript
// Use vitest
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Electron APIs
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn(),
  },
}));
```

**Test Coverage:**
- Store registration & persistence
- IPC handlers (STATE_PULL, STATE_PATCH)
- Broadcasting to BrowserWindows
- Complex data structures (nested objects, arrays, arrays with objects)
- Deep nesting (3+ levels)
- Transaction ID handling

### E2E Tests
For integration testing use Playwright in `e2e/`:
- Build verification
- Package configuration
- microdiff sync logic verification
- Patch calculation verification

Run tests:
```bash
npm test          # Unit tests
npm run test:e2e  # E2E tests
```

## Performance

### Dos
- ✅ Use granular patches
- ✅ Don't debounce - send state changes immediately
- ✅ Use `detached: true` with $subscribe
- ✅ Cleanup in $dispose

### Don'ts
- ❌ Don't send entire state on every change
- ❌ No timeouts without cleanup
- ❌ No memory leaks (unsubscribe!)

## Debugging

### Logging
```typescript
// Use Logger with prefix
logger.error('[electron-pinia-sync] Message', context);

// User can provide custom logger:
createRendererSync({
  logger: customLogger
});
```

## Dependencies

### NEVER bundle (external in tsup.config.ts)
- ❌ electron
- ❌ pinia
- ❌ vue
- ❌ electron-store
- ❌ microdiff

### Dependencies
See `package.json` for current versions:

### Peer Dependencies
See `package.json` for minimum versions:
- `electron`
- `pinia`
- `vue`

## Build & Deployment

### Before every commit
```bash
npm run typecheck  # TypeScript errors?
npm run lint       # Code quality OK?
npm test           # Unit tests passing?
```

### Before every release
```bash
npm run build      # build successful?
npm test           # Unit tests passing?
npm run test:e2e   # E2E tests passing?
npm outdated       # Dependencies up to date?
# Update CHANGELOG.md!
```

## Adding New Features

### Checklist
1. [ ] Define TypeScript types
2. [ ] Write JSDoc comments
3. [ ] Write unit tests
4. [ ] Update README.md
5. [ ] Add CHANGELOG.md entry
6. [ ] Add example in examples/ (optional)

### API Design
```typescript
// ✅ GOOD - Extensible with options object
function newFeature(required: string, options?: FeatureOptions) {}

// ❌ BAD - Too many parameters
function newFeature(a: string, b: number, c: boolean, d?: string) {}
```

## Common Mistakes to Avoid

### 1. Internal Pinia APIs
```typescript
// ❌ AVOID if possible
this.pinia._s.get(storeId)

// ✅ BETTER - But sometimes necessary, then:
(this.pinia as PiniaWithStores)._s.get(storeId)
// With comment explaining why
```

### 2. Window in Non-Browser Code
```typescript
// ✅ GOOD - Runtime check
if (typeof window !== 'undefined' && window.piniaSync) {
  // ...
}

// ❌ BAD
window.piniaSync // Crash in Main/Preload
```

### 3. Memory Leaks
```typescript
// ✅ GOOD - Cleanup
const unsubscribe = api.onStateUpdate(callback);
// Later:
unsubscribe();

// ❌ BAD - Never cleaned up
api.onStateUpdate(callback);
```

## Complex Data Structure Handling

When working with nested objects or arrays, remember:

### Nested Objects
```typescript
// Changing state.user.profile.age sends the ENTIRE user object
store.$patch({
  user: {
    ...store.user,
    profile: { ...store.user.profile, age: 31 }
  }
});
// Patch: { user: { name, email, profile: { age: 31, city } } }
```

### Arrays with Objects
```typescript
// Modifying an item in an array sends the ENTIRE array
store.$patch({
  todos: store.todos.map(t =>
    t.id === 1 ? { ...t, completed: true } : t
  )
});
// Patch: { todos: [...all todos] }
```

This ensures data integrity when syncing between processes.

## Code Review Checklist

Before proposing code:
- [ ] TypeScript compiles without errors
- [ ] No ESLint warnings (unless explicitly accepted)
- [ ] Tests written and passing
- [ ] JSDoc for public APIs
- [ ] No `any` types without reason
- [ ] No external dependencies bundled
- [ ] README updated if API changed

## Resources

- Pinia Docs: https://pinia.vuejs.org/
- Electron IPC: https://www.electronjs.org/docs/latest/tutorial/ipc
- electron-store: https://github.com/sindresorhus/electron-store
- TypeScript Handbook: https://www.typescriptlang.org/docs/

## Questions?

- Check CONTRIBUTING.md for development setup
- Look at examples/ for usage examples
- Read existing code for consistency

## Important Notes
- Do not create new doc files
- If you have any questions, ask a maintainer before proceeding
- NEVER bundle externals (tsup.config.ts)
