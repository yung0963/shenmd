/**
 * AI 助理 Panel — 透過本機 CLI (pi agent / codex) 提供智慧功能
 * 不接 API、不存 key，所有請求透過 terminal 執行
 */
import { $, $$, bus, escapeHtml, notify, ctx } from './util.js';

const state = {
  open: false,
  messages: [], // { role: 'user'|'assistant', content, ts, streaming? }
  busy: false,
  cli: 'pi', // 'pi' | 'codex'
  includeFile: true,
};

let rootEl, listEl, inputEl, sendBtn, cliSelect, includeFileToggle;

function buildDom() {
  rootEl = document.createElement('aside');
  rootEl.id = 'ai-panel';
  rootEl.className = 'ai-panel hidden';
  rootEl.innerHTML = `
    <div class="ai-header">
      <div class="ai-title">
        <span class="ai-spark">✨</span>
        <span>AI 助理</span>
        <span class="ai-sub">via 本機 CLI</span>
      </div>
      <div class="ai-header-actions">
        <select id="ai-cli" class="ai-cli-select" title="選擇 CLI">
          <option value="pi">pi agent</option>
          <option value="codex">codex</option>
        </select>
        <button id="ai-clear" class="ai-icon-btn" title="清空對話">⌫</button>
        <button id="ai-close" class="ai-icon-btn" title="關閉 (⌘.)">×</button>
      </div>
    </div>

    <div class="ai-context-bar">
      <label class="ai-context-toggle">
        <input type="checkbox" id="ai-include-file" checked>
        <span>包含目前檔案內容</span>
      </label>
      <span id="ai-context-info" class="ai-context-info"></span>
    </div>

    <div id="ai-messages" class="ai-messages"></div>

    <div class="ai-quick-actions">
      <button class="ai-quick-btn" data-action="polish">潤稿</button>
      <button class="ai-quick-btn" data-action="translate-en">翻英文</button>
      <button class="ai-quick-btn" data-action="translate-zh">翻中文</button>
      <button class="ai-quick-btn" data-action="summary">摘要</button>
      <button class="ai-quick-btn" data-action="todo">列待辦</button>
      <button class="ai-quick-btn" data-action="fix-grammar">修文法</button>
    </div>

    <div class="ai-input-wrap">
      <textarea id="ai-input" class="ai-input" placeholder="問 AI… (⌘⏎ 送出)" rows="2"></textarea>
      <button id="ai-send" class="ai-send-btn" title="送出">↑</button>
    </div>
  `;
  document.body.appendChild(rootEl);

  listEl = $('#ai-messages', rootEl);
  inputEl = $('#ai-input', rootEl);
  sendBtn = $('#ai-send', rootEl);
  cliSelect = $('#ai-cli', rootEl);
  includeFileToggle = $('#ai-include-file', rootEl);

  $('#ai-close', rootEl).addEventListener('click', close);
  $('#ai-clear', rootEl).addEventListener('click', clearMessages);
  sendBtn.addEventListener('click', () => send());
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send();
    }
  });

  $$('.ai-quick-btn', rootEl).forEach(btn => {
    btn.addEventListener('click', () => quickAction(btn.dataset.action));
  });

  cliSelect.addEventListener('change', () => { state.cli = cliSelect.value; });
  includeFileToggle.addEventListener('change', () => { state.includeFile = includeFileToggle.checked; });

  bus.on('file:opened', updateContextInfo);
  bus.on('file:saved', updateContextInfo);
}

function updateContextInfo() {
  const c = ctx();
  const tab = c.getActiveTab?.();
  const info = $('#ai-context-info', rootEl);
  if (!info) return;
  if (tab?.filePath) {
    info.textContent = `📄 ${tab.title || tab.filePath.split('/').pop()}`;
  } else {
    info.textContent = '';
  }
}

function clearMessages() {
  state.messages = [];
  renderMessages();
}

function renderMessages() {
  if (!state.messages.length) {
    listEl.innerHTML = `
      <div class="ai-empty">
        <div class="ai-empty-icon">✨</div>
        <div class="ai-empty-title">AI 助理</div>
        <div class="ai-empty-desc">選取文字或輸入問題，AI 會透過本機 CLI 協助你</div>
      </div>
    `;
    return;
  }

  listEl.innerHTML = state.messages.map((m, i) => `
    <div class="ai-message ai-message-${m.role}">
      <div class="ai-message-avatar">${m.role === 'user' ? '👤' : '✨'}</div>
      <div class="ai-message-body">
        <div class="ai-message-content ${m.streaming ? 'streaming' : ''}">${escapeHtml(m.content)}</div>
        ${m.streaming ? '<div class="ai-typing"><span></span><span></span><span></span></div>' : ''}
      </div>
    </div>
  `).join('');

  listEl.scrollTop = listEl.scrollHeight;
}

function addMessage(role, content, streaming = false) {
  state.messages.push({ role, content, ts: Date.now(), streaming });
  renderMessages();
  return state.messages.length - 1;
}

function updateMessage(idx, content, streaming = false) {
  if (state.messages[idx]) {
    state.messages[idx].content = content;
    state.messages[idx].streaming = streaming;
    renderMessages();
  }
}

function getCurrentContext() {
  const c = ctx();
  const tab = c.getActiveTab?.();
  const editor = c.getEditor?.();
  if (!editor) return { text: '', filePath: null, fileType: null };

  const selection = editor.value.substring(editor.selectionStart, editor.selectionEnd);
  const hasSelection = selection.length > 0;

  return {
    text: hasSelection ? selection : (state.includeFile ? editor.value : ''),
    filePath: tab?.filePath || null,
    fileType: tab?.fileType || 'markdown',
    hasSelection,
  };
}

function buildCliCommand(action, userText = '') {
  const { text, filePath, fileType } = getCurrentContext();
  const fileRef = filePath ? `"${filePath}"` : '';

  const prompts = {
    polish: `請潤稿以下 Markdown 文字，保持原意但讓語句更流暢專業。直接輸出潤稿後內容，不要解釋：\n\n${text}`,
    'translate-en': `將以下文字翻譯成自然流暢的英文。直接輸出譯文，不要解釋：\n\n${text}`,
    'translate-zh': `將以下文字翻譯成自然流暢的繁體中文。直接輸出譯文，不要解釋：\n\n${text}`,
    summary: `為以下 Markdown 文件產生一段簡潔的 TL;DR 摘要（3-5 句）。直接輸出摘要，不要解釋：\n\n${text}`,
    todo: `從以下文件中提取所有待辦事項、行動項目、需要跟進的事，整理成 checkbox list。直接輸出清單：\n\n${text}`,
    'fix-grammar': `修正以下文字的文法、拼字、標點錯誤。直接輸出修正後內容，不要解釋：\n\n${text}`,
    chat: userText,
  };

  const prompt = prompts[action] || userText;
  const escaped = prompt.replace(/'/g, `'\\''`);

  // pi agent 與 codex 的 CLI 用法
  // pi: echo 'prompt' | pi agent --stdin
  // codex: echo 'prompt' | codex - 或 codex exec 'prompt'
  if (state.cli === 'pi') {
    return `echo '${escaped}' | pi agent --stdin`;
  }
  return `echo '${escaped}' | codex exec --skip-git-repo-check -`;
}

async function send() {
  const userText = inputEl.value.trim();
  if (!userText || state.busy) return;

  inputEl.value = '';
  addMessage('user', userText);
  await runCli('chat', userText);
}

async function quickAction(action) {
  if (state.busy) return;
  const { text } = getCurrentContext();
  if (!text.trim()) {
    notify('請先選取文字或開啟檔案', 'warn');
    return;
  }
  addMessage('user', `[${action}] ${text.slice(0, 80)}${text.length > 80 ? '…' : ''}`);
  await runCli(action);
}

async function runCli(action, userText = '') {
  state.busy = true;
  const msgIdx = addMessage('assistant', '', true);

  const cmd = buildCliCommand(action, userText);

  try {
    // 透過 terminal 執行 CLI，並擷取輸出
    const result = await window.electronAPI.terminalRunCommand?.(cmd);
    if (result?.success) {
      updateMessage(msgIdx, result.stdout || '(無輸出)', false);
    } else {
      updateMessage(msgIdx, `⚠️ CLI 執行失敗: ${result?.error || '未知錯誤'}`, false);
    }
  } catch (e) {
    updateMessage(msgIdx, `⚠️ 執行錯誤: ${e.message}`, false);
  } finally {
    state.busy = false;
  }
}

export function open() {
  if (state.open) return;
  state.open = true;
  rootEl.classList.remove('hidden');
  document.body.classList.add('ai-open');
  updateContextInfo();
  bus.emit('ai:opened');
}

export function close() {
  if (!state.open) return;
  state.open = false;
  rootEl.classList.add('hidden');
  document.body.classList.remove('ai-open');
  bus.emit('ai:closed');
}

export function toggle() {
  state.open ? close() : open();
}

export function isOpen() { return state.open; }

export function initAiPanel() {
  buildDom();

  // Cmd+. 切換 AI panel
  window.addEventListener('keydown', (e) => {
    const isMac = /mac/i.test(navigator.platform);
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (mod && e.key === '.') {
      e.preventDefault();
      toggle();
    }
  });

  bus.on('ai:toggle', toggle);
  console.log('[ai-panel] initialized');
}
