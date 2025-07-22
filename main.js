const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const AutoLaunch = require('auto-launch');

const overlayAutoLauncher = new AutoLaunch({
  name: 'OverlayBoard'
});

overlayAutoLauncher.enable().catch(() => {});

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    show: false,
    width: 1920,
    height: 1080,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    fullscreen: false,
    fullscreenable: false,
    focusable: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile('index.html');

  ipcMain.on('hide-window', () => {
    if (mainWindow) mainWindow.hide();
  });

  globalShortcut.register('CommandOrControl+Shift+T', () => {
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
  });
  mainWindow.setIgnoreMouseEvents(false);
}

app.whenReady().then(() => {
  createWindow();

  globalShortcut.register('CommandOrControl+Shift+T', () => {
    const isVisible = mainWindow.isVisible();
    isVisible ? mainWindow.hide() : mainWindow.show();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});