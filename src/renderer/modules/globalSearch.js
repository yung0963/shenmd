/**
 * 全域搜尋 — 跨資料夾搜尋檔名 + 內容
 */
import { $, bus, escapeHtml, ctx } from './util.js';

let rootEl, inputEl, listEl, statusEl;
let visible = false;
let searchToken = 0;

function buildDom() {
  rootEl = document.createElement('div');
  rootEl.id = 'global-search';
  rootEl.className = 'global-search hidden';
  rootEl.innerHTML = `
    <div class="gs-overlay"></div>
    <div class="gs-panel" role="dialog" aria-label="全域搜尋">
      <div class="gs-input-wrap">
        <svg class="cmdk-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>
        <input id="gs-input" class="cmdk-input" placeholder="搜尋工作區檔案內容… (Esc 關閉)" autocomplete="off"/>
        <span id="gs-status" class="gs-status"></span>
      </div>
      <div id="gs-list" class="gs-list"></div>
    </div>
  `;
  document.body.appendChild(rootEl);

  inputEl = $('#gs-input', rootEl);
  listEl = $('#gs-list', rootEl);
  statusEl = $('#gs-status', rootEl);

  $('.gs-overlay', rootEl).addEventListener('click', close);
  inputEl.addEventListener('input', () => doSearch(inputEl.value));
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
}

async function doSearch(query) {
  const q = query.trim();
  if (q.length < 2) {
    listEl.innerHTML = `<div class="gs-empty">輸入至少 2 個字</div>`;
    statusEl.textContent = '';
    return;
  }

  const c = ctx();
  const rootFolder = c.getCurrentFolder?.() || c.getActiveTab?.()?.dirPath;
  if (!rootFolder) {
    listEl.innerHTML = `<div class="gs-empty">請先開啟資料夾（用左上的資料夾按鈕）</div>`;
    statusEl.textContent = '';
    return;
  }

  const myToken = ++searchToken;
  statusEl.textContent = '搜尋中…';
  listEl.innerHTML = '';

  try {
    const result = await window.electronAPI.globalSearch?.({
      root: rootFolder,
      query: q,
      maxResults: 200,
    });

    if (myToken !== searchToken) return; // 已被更新的查詢取代

    if (!result?.success) {
      listEl.innerHTML = `<div class="gs-empty">搜尋失敗：${escapeHtml(result?.error || '未知錯誤')}</div>`;
      statusEl.textContent = '';
      return;
    }

    const hits = result.hits || [];
    statusEl.textContent = `${hits.length} 筆結果`;

    if (!hits.length) {
      listEl.innerHTML = `<div class="gs-empty">沒有符合的內容</div>`;
      return;
    }

    listEl.innerHTML = hits.map((h, i) => `
      <button class="gs-item" data-idx="${i}">
        <div class="gs-item-path">${escapeHtml(h.relPath)}</div>
        <div class="gs-item-line">
          <span class="gs-line-num">${h.line}</span>
          <span class="gs-line-text">${highlightMatch(h.preview, q)}</span>
        </div>
      </button>
    `).join('');

    listEl.querySelectorAll('.gs-item').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = Number(el.dataset.idx);
        const hit = hits[idx];
        if (hit) {
          bus.emit('globalSearch:jump', hit);
          close();
        }
      });
    });
  } catch (e) {
    statusEl.textContent = '';
    listEl.innerHTML = `<div class="gs-empty">錯誤：${escapeHtml(e.message)}</div>`;
  }
}

function highlightMatch(text = '', q = '') {
  const esc = escapeHtml(text);
  const qEsc = escapeHtml(q);
  const re = new RegExp(`(${qEsc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return esc.replace(re, '<mark>$1</mark>');
}

export function open() {
  if (visible) return;
  visible = true;
  rootEl.classList.remove('hidden');
  inputEl.value = '';
  listEl.innerHTML = `<div class="gs-empty">輸入關鍵字開始搜尋</div>`;
  statusEl.textContent = '';
  setTimeout(() => inputEl.focus(), 0);
  bus.emit('globalSearch:opened');
}

export function close() {
  if (!visible) return;
  visible = false;
  rootEl.classList.add('hidden');
  bus.emit('globalSearch:closed');
}

export function toggle() { visible ? close() : open(); }

export function initGlobalSearch() {
  buildDom();

  window.addEventListener('keydown', (e) => {
    const isMac = /mac/i.test(navigator.platform);
    const mod = isMac ? e.metaKey : e.ctrlKey;
    // Cmd+Shift+F — 但 palette 也綁了，所以全域搜尋用 Cmd+Alt+F
    if (mod && e.altKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    }
  }, true);

  bus.on('globalSearch:open', open);
  bus.on('globalSearch:toggle', toggle);
  console.log('[global-search] initialized');
}
