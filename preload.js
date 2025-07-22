const { contextBridge, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { ipcRenderer } = require('electron');

const dataPath = path.join(os.homedir(), '.overlay-board.json');
const settingPath = path.join(os.homedir(), 'overlay-board-setting.json');

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
  loadSetting: () => {
    try {
      if (!fs.existsSync(settingPath)) {
        fs.writeFileSync(settingPath, JSON.stringify({
          columns: ["To-Do", "PRIO", "In Progress", "Waiting", "Done"],
          showDetails: true
        }, null, 2));
      }
      return JSON.parse(fs.readFileSync(settingPath, 'utf-8'));
    } catch (err) {
      console.error('Laden fehlgeschlagen:', err);
      return {};
    }
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
  hideWindow: () => ipcRenderer.send('hide-window')
});