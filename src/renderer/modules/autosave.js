/**
 * 自動儲存 + 本機歷史快照
 */
import { $, bus, ctx, notify } from './util.js';

const LS_KEY = 'shenmd_autosave_enabled';
const HISTORY_KEY_PREFIX = 'shenmd_history_';
const MAX_HISTORY = 20;
const AUTOSAVE_DELAY = 1500;

let autosaveEnabled = localStorage.getItem(LS_KEY) === '1';
let autosaveTimer = null;

function scheduleAutosave() {
  if (!autosaveEnabled) return;
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(doAutosave, AUTOSAVE_DELAY);
}

async function doAutosave() {
  const c = ctx();
  const tab = c.getActiveTab?.();
  const editor = c.getEditor?.();
  if (!tab?.filePath || !editor) return;
  if (!tab.isModified) return;

  try {
    await window.electronAPI.writeFile(tab.filePath, editor.value);
    tab.isModified = false;
    c.updateTabModifiedUI?.();
    notify('已自動儲存', 'ok');
    bus.emit('file:saved', { path: tab.filePath, auto: true });
  } catch (e) {
    console.error('[autosave]', e);
  }
}

function snapshot() {
  const c = ctx();
  const tab = c.getActiveTab?.();
  const editor = c.getEditor?.();
  if (!tab?.filePath || !editor) return;

  const key = HISTORY_KEY_PREFIX + tab.filePath;
  let history = [];
  try { history = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) {}

  const content = editor.value;
  const last = history[history.length - 1];
  if (last?.content === content) return; // 無變化

  history.push({ ts: Date.now(), content, size: content.length });
  if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
  try {
    localStorage.setItem(key, JSON.stringify(history));
  } catch (e) {
    // localStorage 滿了 → 砍最舊的一半
    history = history.slice(-Math.floor(MAX_HISTORY / 2));
    try { localStorage.setItem(key, JSON.stringify(history)); } catch (_) {}
  }
}

export function getHistory(filePath) {
  const key = HISTORY_KEY_PREFIX + filePath;
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; }
}

export function restoreSnapshot(filePath, ts) {
  const history = getHistory(filePath);
  const snap = history.find(h => h.ts === ts);
  if (!snap) return false;
  const c = ctx();
  const editor = c.getEditor?.();
  if (!editor) return false;
  editor.value = snap.content;
  bus.emit('editor:changed');
  return true;
}

export function setEnabled(on) {
  autosaveEnabled = Boolean(on);
  localStorage.setItem(LS_KEY, autosaveEnabled ? '1' : '0');
  bus.emit('autosave:changed', autosaveEnabled);
  notify(autosaveEnabled ? '自動儲存已開啟' : '自動儲存已關閉');
}

export function isEnabled() { return autosaveEnabled; }

export function initAutosave() {
  // 編輯內容改變時 → 觸發 autosave + snapshot
  bus.on('editor:changed', () => {
    scheduleAutosave();
    snapshot();
  });

  // 定期 snapshot（每 30 秒）
  setInterval(() => {
    const c = ctx();
    if (c.getActiveTab?.()?.isModified) snapshot();
  }, 30 * 1000);

  console.log('[autosave] initialized, enabled =', autosaveEnabled);
}
