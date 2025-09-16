const { app, BrowserWindow, globalShortcut, ipcMain, Tray, nativeImage } = require('electron');
const path = require('path');
const AutoLaunch = require('auto-launch');
const { autoUpdater } = require('electron-updater');
const { screen } = require('electron');
const { Menu } = require('electron');
const { readSettings } = require('./settings');

ipcMain.handle('settings:userDataPath', () => {
  return app.getPath('userData');
});

ipcMain.handle('fetch-title', async (event, url) => {
  console.log("🌐 Hauptprozess ruft Titel & Infos ab für:", url);
  try {
    const win = new BrowserWindow({
      show: false,
      width: 800,
      height: 600,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        javascript: true,
        images: true,
        nodeIntegration: false,
        contextIsolation: true,
      }
    });

    let loadTimedOut = false;

    const timeout = setTimeout(() => {
      loadTimedOut = true;
      if (!win.isDestroyed()) win.destroy();
      console.error("⏱️ Timeout beim Laden von:", url);
    }, 10000); // 10 Sekunden Timeout

    win.webContents.on('did-fail-load', (e, errorCode, errorDesc) => {
      console.error("❌ Fehler beim Laden der Seite:", errorCode, errorDesc);
    });

    await win.loadURL(url);
    await new Promise(resolve => win.webContents.once('did-stop-loading', resolve));

    if (loadTimedOut) return { title: 'Link', meta: {}, notes: '' };

    let title = await win.webContents.getTitle();

    if (!title || title.trim() === '' || title.toLowerCase().includes('login')) {
      title = await win.webContents.executeJavaScript('document.title', true);
    }

    const pageMetaData = await win.webContents.executeJavaScript(`
      (() => {
        const getMeta = name => document.querySelector(\`meta[name="\${name}"]\`)?.content || '';
        const notesEl = document.querySelector('[data-controller~="bridge--page"] turbo-frame#card_content');
        return {
          pageTitle: getMeta('current-page-title'),
          pageSubtitle: getMeta('current-page-subtitle'),
          userName: getMeta('current-person-name'),
          userEmail: getMeta('current-person-email-address'),
          notes: notesEl ? notesEl.innerText.trim() : ''
        };
      })()
    `);

    clearTimeout(timeout);

    console.log("✅ Titel & Infos geladen:", { title, ...pageMetaData });
    if (!win.isDestroyed()) win.destroy();

    return {
      title: title || 'Link',
      meta: {
        pageTitle: pageMetaData.pageTitle,
        pageSubtitle: pageMetaData.pageSubtitle,
        userName: pageMetaData.userName,
        userEmail: pageMetaData.userEmail,
      },
      notes: pageMetaData.notes || ''
    };
  } catch (err) {
    console.error("❌ Fehler beim Abrufen der Seitendaten:", err);
    return { title: 'Link', meta: {}, notes: '' };
  }
});

const overlayAutoLauncher = new AutoLaunch({
  name: 'OverlayBoard'
});

overlayAutoLauncher.enable().catch(() => {});

let mainWindow;
let tray;
let settingsWindow;

function getAssetPath(...paths) {
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, 'build');
  return path.join(base, ...paths);
}

function repositionWindowToCursor() {
  const mousePosition = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(mousePosition);
  const x = display.bounds.x + (display.bounds.width - 1920) / 2;
  const y = display.bounds.y + (display.bounds.height - 1080) / 2;
  if (mainWindow) {
    mainWindow.setBounds({ x, y, width: 1920, height: 1080 });
  }
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 600,
    height: 700,
    resizable: true,
    minimizable: false,
    maximizable: false,
    show: true,
    title: 'Einstellungen',
    parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
    modal: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  settingsWindow.loadFile('setting.html');

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

async function createWindow() {
  const mousePosition = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(mousePosition);

  const x = display.bounds.x + (display.bounds.width - 1920) / 2;
  const y = display.bounds.y + (display.bounds.height - 1080) / 2;
  
  mainWindow = new BrowserWindow({
    x,
    y,
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

  settings = await readSettings();
  globalShortcut.register(settings.openHotkey, () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      repositionWindowToCursor();
      mainWindow.show();
      mainWindow.focus();
    }
  });
  mainWindow.setIgnoreMouseEvents(false);
}

function createTrayWindow() {
  const trayIconName = process.platform === 'darwin'
    ? 'icon.png'
    : (process.platform === 'win32' ? 'icon.ico' : 'icon.png');

  const trayIconPath = getAssetPath('tray', trayIconName);
  const trayImage = nativeImage.createFromPath(trayIconPath);
  tray = new Tray(trayImage);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Öffnen', click: () => mainWindow.show() },
    { label: 'Einstellungen…', click: () => createSettingsWindow() },
    { type: 'separator' },
    { label: 'Beenden', click: () => app.quit() }
  ]);
  tray.setToolTip('overlay-board');
  tray.setContextMenu(contextMenu);
}

app.dock.hide();

app.whenReady().then(() => {
  createWindow();
  createTrayWindow();

  autoUpdater.checkForUpdatesAndNotify();
});

const menuTemplate = [
  {
    label: 'Overlay Board',
    submenu: [
      {
        label: 'Einstellungen…',
        click: () => createSettingsWindow()
      },
      {
        label: 'Basecamp-Login',
        click: () => {
          // Starte Login-Fenster
          const loginWin = new BrowserWindow({
            width: 1000,
            height: 800,
            show: true,
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true
            }
          });

          loginWin.loadURL('https://launchpad.37signals.com/signin');

          loginWin.webContents.on('did-finish-load', async () => {
            const currentUrl = loginWin.webContents.getURL();
            if (currentUrl.includes('/my')) {
              console.log("✅ Basecamp erfolgreich geladen:", currentUrl);
              loginWin.close();
            }
          });
        }
      },
      {
        label: 'Redmine-Login',
        click: () => {
          // Starte Login-Fenster
          const loginWin = new BrowserWindow({
            width: 1000,
            height: 800,
            show: true,
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true
            }
          });

          loginWin.loadURL('https://ticket.dav-summit-club.de/login');

          loginWin.webContents.on('did-finish-load', async () => {
            const currentUrl = loginWin.webContents.getURL();
            if (currentUrl.includes('/my')) {
              console.log("✅ Redmine erfolgreich geladen:", currentUrl);
              loginWin.close();
            }
          });
        }
      },
      { type: 'separator' },
      {
        label: 'Nach Updates suchen',
        click: () => {
          autoUpdater.checkForUpdatesAndNotify();
        }
      },
      {
        role: 'quit',
        label: 'Beenden'
      }
    ]
  },
  {
    label: 'Bearbeiten',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'pasteAndMatchStyle' },
      { role: 'delete' },
      { role: 'selectAll' }
    ]
  },
  {
    label: 'Entwicklung',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { 
        role: 'toggleDevTools',
        accelerator: 'CmdOrCtrl+Shift+I',
      }
    ]
  }
];

const menu = Menu.buildFromTemplate(menuTemplate);
Menu.setApplicationMenu(menu);

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});