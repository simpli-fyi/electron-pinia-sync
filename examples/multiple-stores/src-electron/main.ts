import {app, BrowserWindow} from 'electron';
import path from 'path';
import {createMainSync} from 'electron-pinia-sync/main';
import {initCounterStore} from './stores/counter-store';
import {initLicenseStore} from './stores/license-store';

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

app.whenReady().then(() => {
  initCounterStore();
  initLicenseStore();
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

