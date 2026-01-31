import { app, BrowserWindow } from 'electron';
import path from 'path';
import { createMainSync } from 'electron-pinia-sync/main';
import { useCounterStore } from './stores/counter';

let mainWindow: BrowserWindow | null = null;
let mainSync: ReturnType<typeof createMainSync> | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function initializePiniaSync() {
  // Create the Main sync manager
  mainSync = createMainSync({
    // Enable debug mode during development
    debug: process.env.DEBUG ? 'verbose' : false,
    storeOptions: {
      name: 'counter-example-store',
    },
  });

  // Get the Pinia instance
  const pinia = mainSync.getPinia();

  // Create the counter store
  const counterStore = useCounterStore(pinia);

  // Register with persistence enabled
  mainSync.registerStore('counter', counterStore, {
    persist: true,
  });

  console.log('[Main] Pinia sync initialized');
}

app.whenReady().then(() => {
  initializePiniaSync();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  if (mainSync) {
    mainSync.destroy();
  }
});

