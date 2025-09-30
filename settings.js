

// settings.js — gemeinsame Settings-Logik für Main & Preload/Renderer
// Nutzbar im Main- und im Renderer-Kontext (über Preload). Persistiert nach app.getPath('userData').

const fs = require('fs');
const path = require('path');

const DEFAULT_SETTINGS = {
  openHotkey: 'Cmd+Shift+T',
  deleteHotkey: 'Cmd+Delete',
  columns: ["To-Do", "PRIO", "In Progress", "Waiting", "Done"],
};

/**
 * Liefert den Pfad zu settings.json – funktioniert in Main und Renderer.
 * In Main: synchron via app.getPath('userData')
 * In Renderer/Preload: via ipcRenderer.invoke('settings:userDataPath')
 */
async function getSettingsPath() {
  // Renderer/Preload
  if (process && process.type === 'renderer') {
    const { ipcRenderer } = require('electron');
    const userData = await ipcRenderer.invoke('settings:userDataPath');
    return path.join(userData, 'settings.json');
  }
  // Main
  const { app } = require('electron');
  return path.join(app.getPath('userData'), 'settings.json');
}

/**
 * Stellt sicher, dass die Datei existiert und gibt den Pfad zurück.
 */
async function ensureFile() {
  const settingsPath = await getSettingsPath();
  const dir = path.dirname(settingsPath);
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, JSON.stringify(DEFAULT_SETTINGS, null, 2));
  }
  return settingsPath;
}

/**
 * Liest Settings (merged mit Defaults).
 */
async function readSettings() {
  const settingsPath = await ensureFile();
  try {
    const raw = fs.readFileSync(settingsPath, 'utf8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (e) {
    console.warn('[settings] read failed, using defaults:', e);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Schreibt Settings. Wenn merge=true, wird patch mit bestehenden Settings gemerged.
 * Gibt das final gespeicherte Objekt zurück.
 */
async function writeSettings(nextOrPatch, { merge = true } = {}) {
  const settingsPath = await ensureFile();
  const prev = await readSettings();
  const next = merge ? { ...prev, ...nextOrPatch } : nextOrPatch;
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(next, null, 2));
    return next;
  } catch (e) {
    console.error('[settings] write failed:', e);
    return prev; // best-effort
  }
}

/**
 * Hilfsfunktionen für Einzel-Keys
 */
async function getKey(key) {
  const all = await readSettings();
  return all?.[key];
}

async function setKey(key, value) {
  const all = await readSettings();
  all[key] = value;
  return await writeSettings(all, { merge: false });
}

module.exports = {
  DEFAULT_SETTINGS,
  getSettingsPath,
  ensureFile,
  readSettings,
  writeSettings,
  getKey,
  setKey,
};