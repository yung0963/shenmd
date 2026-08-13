/**
 * shenmd 新功能共用小工具
 * 不依賴 app.js 內部變數，全部透過 window.shenmd API 溝通
 */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function debounce(fn, wait = 200) {
  let timer = null;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

export function basename(p = '') {
  const seg = String(p).split('/');
  return seg[seg.length - 1] || p;
}

export function extname(p = '') {
  const b = basename(p);
  const i = b.lastIndexOf('.');
  return i > 0 ? b.slice(i + 1).toLowerCase() : '';
}

/**
 * 簡易事件 bus，讓 modules 之間不直接相依
 * bus.emit('file:opened', { path, content, type })
 * bus.on('file:opened', ({path}) => ...)
 */
export const bus = (() => {
  const map = new Map();
  return {
    on(evt, fn) {
      if (!map.has(evt)) map.set(evt, new Set());
      map.get(evt).add(fn);
      return () => map.get(evt)?.delete(fn);
    },
    emit(evt, payload) {
      map.get(evt)?.forEach(fn => {
        try { fn(payload); } catch (e) { console.error(`[bus:${evt}]`, e); }
      });
    }
  };
})();

/**
 * 取得目前 editor 狀態（由 app.js 暴露）
 * app.js 必須設 window.shenmd = { getEditor, getActiveTab, ... }
 */
export function ctx() {
  return window.shenmd || {};
}

export function notify(msg, level = 'info') {
  bus.emit('notify', { msg, level });
  const status = $('#status');
  if (status) {
    status.textContent = msg;
    setTimeout(() => { status.textContent = '就緒'; }, 2500);
  }
}
