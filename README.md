# electron-pinia-sync

> Synchronize Pinia stores between Electron Main and Renderer processes with persistence support

[![npm version](https://img.shields.io/npm/v/electron-pinia-sync.svg)](https://www.npmjs.com/package/electron-pinia-sync)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🔄 **Bidirectional Sync**: Synchronize Pinia stores between Main and multiple Renderer processes
- 🎯 **Single Source of Truth**: Main process maintains the authoritative state
- 💾 **Persistent Storage**: Selective persistence to disk using `electron-store`
- 🔒 **Type-Safe**: Full TypeScript support with strict mode
- 🚀 **Zero Config**: Works out of the box with sensible defaults
- 🔁 **Echo Prevention**: Intelligent transaction tracking prevents infinite loops
- 📦 **Dual Package**: ESM and CommonJS builds (~4 KB per module)
- ⚡ **Performance**: Efficient diffing with `microdiff` minimizes data transfer

## Installation

```bash
npm install electron-pinia-sync
# or
yarn add electron-pinia-sync
# or
pnpm add electron-pinia-sync
```

### Peer Dependencies

**Important**: This library does **not** bundle Electron, Pinia, or Vue. You must install them separately:

```bash
npm install electron pinia vue
```

**Required versions**:
- Electron >= 40
- Pinia >= 3.0
- Vue >= 3.5
- Node.js >= 20

**Why?** This keeps the bundle size small and prevents dependency conflicts. You use your own versions of Electron and Pinia.

## Quick Start

### 1. Preload Script

Set up the secure IPC bridge in your preload script:

```typescript
// preload.ts
import 'electron-pinia-sync/preload';
```

### 2. Main Process

Initialize the sync manager in your main process:

```typescript
// main.ts
import { app } from 'electron';
import { createMainSync } from 'electron-pinia-sync/main';
import { defineStore } from 'pinia';

const mainSync = createMainSync({
  storeOptions: {
    // Optional: electron-store configuration
    name: 'my-app-store',
  },
});

// Get the Pinia instance
const store = mainSync.getPinia();

// Define your store
const useCounterStore = defineStore('counter', {
  state: () => ({
    count: 0,
    name: 'Counter',
  }),
  actions: {
    increment() {
      this.count++;
    },
  },
});

// Create and register the store
const counterStore = useCounterStore(store);
mainSync.registerStore('counter', counterStore, {
  persist: true, // Enable persistence for this store
});

app.on('quit', () => {
  mainSync.destroy();
});
```

### 3. Renderer Process

Set up the Pinia plugin in your renderer process:

```typescript
// renderer.ts (or main.ts in your Vue app)
import { createApp } from 'vue';
import { createPinia, defineStore } from 'pinia';
import { createRendererSync } from 'electron-pinia-sync/renderer';
import App from './App.vue';

const pinia = createPinia();

// Add the sync plugin
pinia.use(createRendererSync());

const app = createApp(App);
app.use(pinia);
app.mount('#app');

// Define the same store (structure must match Main process)
export const useCounterStore = defineStore('counter', {
  state: () => ({
    count: 0,
    name: 'Counter',
  }),
  actions: {
    increment() {
      this.count++;
    },
  },
});
```

### 4. Use in Vue Components

```vue
<template>
  <div>
    <h1>{{ counter.name }}</h1>
    <p>Count: {{ counter.count }}</p>
    <button @click="counter.increment()">Increment</button>
  </div>
</template>

<script setup lang="ts">
import { useCounterStore } from './stores/counter';

const counter = useCounterStore();
</script>
```

## API Reference

### Main Process

#### `createMainSync(options?)`

Creates and initializes the Main process sync manager.

**Options:**

```typescript
interface MainSyncOptions {
  // Custom Pinia instance (optional, will create one if not provided)
  pinia?: Pinia;
  
  // electron-store configuration
  storeOptions?: {
    name?: string;
    cwd?: string;
    encryptionKey?: string;
    // ... other electron-store options
  };
}
```

**Returns:** `MainSync` instance

#### `mainSync.registerStore(storeId, store, options?)`

Registers a Pinia store with the sync manager.

**Parameters:**

- `storeId` (string): Unique identifier for the store
- `store` (Store): Pinia store instance
- `options` (object, optional):
  - `persist` (boolean | PersistOptions): Persistence configuration

**Persistence Options:**

```typescript
// Simple boolean
{ persist: true }

// Advanced configuration
{
  persist: {
    enabled: true,
    key: 'custom-storage-key', // Optional custom key
  }
}
```

#### `mainSync.getPinia()`

Returns the managed Pinia instance.

#### `mainSync.destroy()`

Cleanup IPC handlers. Call this when your app is shutting down.

### Renderer Process

#### `createRendererSync(options?)`

Creates the Pinia plugin for renderer process synchronization.

**Options:**

```typescript
interface RendererSyncOptions {
  // Custom logger (default: console)
  logger?: {
    warn: (message: string, ...args: any[]) => void;
    error: (message: string, ...args: any[]) => void;
  };
}
```

**Returns:** Pinia plugin function

## Advanced Usage

### Multiple Windows

The library automatically synchronizes state across all renderer processes:

```typescript
// main.ts
import { BrowserWindow } from 'electron';

const window1 = new BrowserWindow({
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
  },
});

const window2 = new BrowserWindow({
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
  },
});

// Both windows will stay in sync automatically
```

### Selective Persistence

Choose which stores to persist:

```typescript
// Persist user settings
mainSync.registerStore('settings', settingsStore, { persist: true });

// Don't persist temporary UI state
mainSync.registerStore('ui', uiStore, { persist: false });
```

### Custom Storage Keys

Use custom keys for electron-store:

```typescript
mainSync.registerStore('user', userStore, {
  persist: {
    enabled: true,
    key: 'app-user-data', // Custom key
  },
});
```

### Error Handling

Provide a custom logger to handle errors:

```typescript
const pinia = createPinia();

pinia.use(createRendererSync({
  logger: {
    warn: (msg, ...args) => {
      // Custom warning handler
      console.warn('[MyApp]', msg, ...args);
    },
    error: (msg, ...args) => {
      // Custom error handler
      Sentry.captureException(new Error(msg));
    },
  },
}));
```

## How It Works

### Synchronization Flow

1. **Initialization**: When a renderer process starts, it pulls the current state from the Main process
2. **Renderer → Main**: When state changes in a renderer, a patch is sent to the Main process
3. **Main Processing**: Main process applies the patch and optionally persists to disk
4. **Main → Renderers**: Main process broadcasts the updated state to all renderer processes
5. **Echo Prevention**: Transaction IDs prevent the originating renderer from applying its own update

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Main Process                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Pinia Store (Single Source of Truth)                  │ │
│  │  - Receives patches from renderers                     │ │
│  │  - Persists to electron-store                          │ │
│  │  - Broadcasts updates to all renderers                 │ │
│  └────────────────────────────────────────────────────────┘ │
└───────────────┬──────────────────────────┬──────────────────┘
                │                          │
         IPC    │                          │    IPC
     (patches)  │                          │  (updates)
                │                          │
    ┌───────────▼──────────┐   ┌──────────▼───────────┐
    │   Renderer 1         │   │   Renderer 2         │
    │  ┌────────────────┐  │   │  ┌────────────────┐  │
    │  │  Pinia Store   │  │   │  │  Pinia Store   │  │
    │  │  (Local Copy)  │  │   │  │  (Local Copy)  │  │
    │  └────────────────┘  │   │  └────────────────┘  │
    └─────────────────────┘   └──────────────────────┘
```

## TypeScript Support

Full TypeScript support with type inference:

```typescript
import { defineStore } from 'pinia';

interface CounterState {
  count: number;
  name: string;
}

export const useCounterStore = defineStore('counter', {
  state: (): CounterState => ({
    count: 0,
    name: 'Counter',
  }),
  getters: {
    doubleCount: (state) => state.count * 2,
  },
  actions: {
    increment() {
      this.count++;
    },
  },
});

// Full type inference in components
const counter = useCounterStore();
counter.count; // number
counter.name; // string
counter.doubleCount; // number
counter.increment(); // void
```

## Best Practices

1. **Store Definition**: Define stores with the same structure in both Main and Renderer processes
2. **Persistence**: Only persist stores that need to survive app restarts
3. **State Size**: Keep state size reasonable for IPC transfer performance
4. **Actions**: Actions can be defined only in Renderer (they're not synced, only state is)
5. **Initialization**: Wait for store initialization before using in components

## Debugging

Enable debug logging to see synchronization details:

**Main Process:**
```typescript
const mainSync = createMainSync({
  debug: true, // or 'verbose' for detailed logs
});
```

**Renderer Process:**
```typescript
pinia.use(createRendererSync({
  debug: 'verbose', // Shows state diffs and patches
}));
```

**Debug Levels:**
- `false` (default): Only errors/warnings
- `true`: Important operations
- `'verbose'`: Detailed logs with state diffs

## Troubleshooting

### Store not syncing

**Problem**: Changes in one process don't reflect in others

**Solution**: 
- Ensure the preload script is loaded correctly
- Check that store IDs match between Main and Renderer
- Verify `registerStore` is called in Main process

### State not persisting

**Problem**: State resets on app restart

**Solution**:
- Confirm `persist: true` is set when registering the store
- Check electron-store permissions and storage location
- Verify the Main process has write permissions

### Type errors with window.piniaSync

**Problem**: TypeScript doesn't recognize `window.piniaSync`

**Solution**:
- Import types: `import 'electron-pinia-sync/preload'`
- The types are automatically augmented to the global `Window` interface

## Examples

Check the `examples/` directory for complete working examples:

- **Basic Counter**: Simple counter app with persistence
- **Multi-Window**: Todo app synchronized across multiple windows
- **Complex State**: E-commerce app with nested state

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

## License

MIT © simpli.fyi GbR

## Credits

Built with:
- [Electron](https://www.electronjs.org/)
- [Vue 3](https://vuejs.org/)
- [Pinia](https://pinia.vuejs.org/)
- [electron-store](https://github.com/sindresorhus/electron-store)

