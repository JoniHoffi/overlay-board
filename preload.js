const { contextBridge, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { ipcRenderer } = require('electron');

const dataPath = path.join(os.homedir(), '.overlay-board.json');

const DEFAULT_SETTINGS = {
  openHotkey: 'Cmd+Shift+T',
  deleteHotkey: 'Cmd+Delete',
  columns: ["To-Do", "PRIO", "In Progress", "Waiting", "Done"]
};

let _settingsPathCache = null;
async function getSettingsPath() {
  if (_settingsPathCache) return _settingsPathCache;
  const userDataDir = await ipcRenderer.invoke('settings:userDataPath');
  _settingsPathCache = path.join(userDataDir, 'settings.json');
  return _settingsPathCache;
}

async function readSettingsFile() {
  const settingsPath = await getSettingsPath();
  try {
    if (!fs.existsSync(settingsPath)) {
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
      fs.writeFileSync(settingsPath, JSON.stringify(DEFAULT_SETTINGS, null, 2));
    }
    const raw = fs.readFileSync(settingsPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (e) {
    console.error('Settings lesen fehlgeschlagen:', e);
    return { ...DEFAULT_SETTINGS };
  }
}

async function writeSettingsFile(next) {
  const settingsPath = await getSettingsPath();
  try {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(next, null, 2));
    return true;
  } catch (e) {
    console.error('Settings speichern fehlgeschlagen:', e);
    return false;
  }
}

contextBridge.exposeInMainWorld('todoAPI', {
  load: () => {
    try {
      if (!fs.existsSync(dataPath)) {
        fs.writeFileSync(dataPath, '{}');
      }
      return JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    } catch (err) {
      console.error('Laden fehlgeschlagen:', err);
      return {};
    }
  },
  loadSetting: async () => {
    return await readSettingsFile();
  },
  save: (data) => {
    try {
      fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('Speichern fehlgeschlagen:', err);
    }
  },
  openExternal: (url) => {
    shell.openExternal(url);
  },
  hideWindow: () => ipcRenderer.send('hide-window'),
  fetchTitle: (url) => ipcRenderer.invoke('fetch-title', url),
  openBasecampLogin: () => ipcRenderer.send('open-basecamp-login')
});

contextBridge.exposeInMainWorld('settings', {
  get: async () => {
    return await readSettingsFile();
  },
  set: async (patch) => {
    const current = await readSettingsFile();
    const next = { ...current, ...patch };
    await writeSettingsFile(next);
    ipcRenderer.send('settings:updated-from-preload', next);
    return next;
  }
});
// Convenience-API: einzelne Keys lesen/schreiben + auf Updates hören
contextBridge.exposeInMainWorld('settingsKey', {
  get: async (key) => {
    const all = await readSettingsFile();
    return all?.[key];
  },
  set: async (key, value) => {
    const all = await readSettingsFile();
    const next = { ...all, [key]: value };
    await writeSettingsFile(next);
    ipcRenderer.send('settings:updated-from-preload', next);
    return next[key];
  }
});

contextBridge.exposeInMainWorld('settingsEvents', {
  onUpdated: (cb) => {
    // cb erhält das vollständige Settings-Objekt
    const handler = (_e, next) => cb(next);
    ipcRenderer.on('settings:updated', handler);
    return () => ipcRenderer.removeListener('settings:updated', handler);
  }
});