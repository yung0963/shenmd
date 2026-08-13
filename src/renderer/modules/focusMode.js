/**
 * 專注模式 — 隱藏所有 UI 只留 editor
 */
import { bus } from './util.js';

let active = false;

function apply() {
  document.body.classList.toggle('focus-mode', active);
  bus.emit('focus:changed', active);
}

export function toggle() {
  active = !active;
  apply();
}

export function set(on) {
  active = Boolean(on);
  apply();
}

export function isActive() { return active; }

export function initFocusMode() {
  // Cmd+Shift+. 切換專注模式
  window.addEventListener('keydown', (e) => {
    const isMac = /mac/i.test(navigator.platform);
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (mod && e.shiftKey && e.key === '.') {
      e.preventDefault();
      toggle();
    }
    // Esc 退出
    if (active && e.key === 'Escape') {
      set(false);
    }
  });

  bus.on('focus:toggle', toggle);
  console.log('[focus-mode] initialized');
}
