/**
 * 文件大綱 — heading tree 可跳轉
 */
import { $, bus, ctx, debounce } from './util.js';

let rootEl, listEl;
let visible = false;

function buildDom() {
  rootEl = document.createElement('aside');
  rootEl.id = 'outline-panel';
  rootEl.className = 'outline-panel hidden';
  rootEl.innerHTML = `
    <div class="outline-header">
      <span class="outline-title">☰ 大綱</span>
      <button id="outline-close" class="ai-icon-btn" title="關閉">×</button>
    </div>
    <div id="outline-list" class="outline-list"></div>
  `;
  document.body.appendChild(rootEl);
  listEl = $('#outline-list', rootEl);
  $('#outline-close', rootEl).addEventListener('click', close);

  // 內容改變時刷新（debounce）
  const refresh = debounce(() => { if (visible) render(); }, 250);
  bus.on('editor:changed', refresh);
  bus.on('file:opened', refresh);
}

function parseHeadings(text = '') {
  const lines = text.split('\n');
  const out = [];
  let inCode = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) inCode = !inCode;
    if (inCode) continue;
    const m = line.match(/^(#{1,6})\s+(.+)$/);
    if (m) {
      out.push({ level: m[1].length, text: m[2].trim(), line: i });
    }
  }
  return out;
}

function render() {
  const c = ctx();
  const editor = c.getEditor?.();
  const text = editor?.value || '';
  const headings = parseHeadings(text);

  if (!headings.length) {
    listEl.innerHTML = `<div class="outline-empty">本文件沒有標題</div>`;
    return;
  }

  listEl.innerHTML = headings.map((h, i) => `
    <button class="outline-item outline-level-${h.level}" data-line="${h.line}">
      <span class="outline-bullet"></span>
      <span class="outline-text">${h.text.replace(/</g, '&lt;')}</span>
    </button>
  `).join('');

  listEl.querySelectorAll('.outline-item').forEach(el => {
    el.addEventListener('click', () => {
      const line = Number(el.dataset.line);
      jumpToLine(line);
    });
  });
}

function jumpToLine(lineNum) {
  const c = ctx();
  const editor = c.getEditor?.();
  if (!editor) return;
  const lines = editor.value.split('\n');
  let pos = 0;
  for (let i = 0; i < Math.min(lineNum, lines.length); i++) {
    pos += lines[i].length + 1;
  }
  editor.focus();
  editor.setSelectionRange(pos, pos + (lines[lineNum]?.length || 0));
  // 捲動到該行
  const lineHeight = parseFloat(getComputedStyle(editor).lineHeight) || 22;
  editor.scrollTop = Math.max(0, (lineNum - 5) * lineHeight);
}

export function open() {
  if (visible) return;
  visible = true;
  rootEl.classList.remove('hidden');
  render();
  bus.emit('outline:opened');
}

export function close() {
  if (!visible) return;
  visible = false;
  rootEl.classList.add('hidden');
  bus.emit('outline:closed');
}

export function toggle() { visible ? close() : open(); }
export function isOpen() { return visible; }

export function initOutline() {
  buildDom();
  bus.on('outline:toggle', toggle);
  console.log('[outline] initialized');
}
