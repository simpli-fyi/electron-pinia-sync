# Basic Counter Example

A simple counter application demonstrating electron-pinia-sync basic functionality.

## Features

- Counter state synchronized between Main and Renderer
- Persistent state (survives app restarts)
- Real-time updates

## Running the Example

```bash
# Install dependencies
pnpm install

# Run the app
pnpm start
```
## File Structure

```
basic-counter/
├── src/
│   ├── main.ts       # Main process with Pinia store
│   ├── preload.ts    # Preload script for IPC bridge
│   ├── renderer.ts   # Renderer setup with Vue
│   ├── App.vue       # Main Vue component
│   └── stores/
│       └── counter.ts # Pinia store definition
├── index.html
└── package.json
```

## How It Works

1. **Main Process** (`main.ts`):
   - Creates MainSync instance
   - Registers counter store with persistence
   - Manages BrowserWindow

2. **Preload** (`preload.ts`):
   - Exposes IPC API via contextBridge

3. **Renderer** (`renderer.ts`):
   - Creates Pinia with sync plugin
   - Mounts Vue application

4. **Component** (`App.vue`):
   - Uses counter store
   - Updates are automatically synced

## Testing

1. Click "Increment" button
2. Close and reopen the app
3. Counter value persists
4. Open multiple windows to see sync in action

