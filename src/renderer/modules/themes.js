/**
 * 主題擴充 + 字體管理
 */
import { bus } from './util.js';

export const THEMES = {
  vue: { label: 'Vue 綠', accent: '#42b883' },
  notion: { label: 'Notion 風', accent: '#2383e2' },
  'github-dark': { label: 'GitHub Dark', accent: '#58a6ff' },
  'catppuccin-mocha': { label: 'Catppuccin 摩卡', accent: '#cba6f7' },
  'tokyo-night': { label: 'Tokyo Night', accent: '#7aa2f7' },
  'solarized-light': { label: 'Solarized 米白', accent: '#268bd2' },
};

const LS_KEY = 'shenmd_theme';

export function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'vue';
}

export function setTheme(name) {
  if (!THEMES[name]) return;
  document.documentElement.setAttribute('data-theme', name);
  localStorage.setItem(LS_KEY, name);
  bus.emit('theme:changed', name);
}

export function nextTheme() {
  const keys = Object.keys(THEMES);
  const cur = getCurrentTheme();
  const idx = keys.indexOf(cur);
  const next = keys[(idx + 1) % keys.length];
  setTheme(next);
}

export function initThemes() {
  // 啟動時還原
  const saved = localStorage.getItem(LS_KEY);
  if (saved && THEMES[saved]) {
    document.documentElement.setAttribute('data-theme', saved);
  }
  bus.on('theme:next', nextTheme);
  console.log('[themes] initialized');
}
