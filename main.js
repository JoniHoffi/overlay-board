const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const AutoLaunch = require('auto-launch');
const { screen } = require('electron');
const { Menu } = require('electron');

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

function repositionWindowToCursor() {
  const mousePosition = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(mousePosition);
  const x = display.bounds.x + (display.bounds.width - 1920) / 2;
  const y = display.bounds.y + (display.bounds.height - 1080) / 2;
  if (mainWindow) {
    mainWindow.setBounds({ x, y, width: 1920, height: 1080 });
  }
}

function createWindow() {
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

  globalShortcut.register('CommandOrControl+Shift+T', () => {
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

app.whenReady().then(() => {
  createWindow();
});

const menuTemplate = [
  {
    label: 'Overlay Board',
    submenu: [
      {
        label: 'Basecamp Login',
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
              // Optional: loginWin.close();
            }
          });
        }
      },
      { type: 'separator' },
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
  }
];

const menu = Menu.buildFromTemplate(menuTemplate);
Menu.setApplicationMenu(menu);

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});