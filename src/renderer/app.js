/**
 * shenMD Renderer Process
 * Adapted from markdown.html for Electron with native file I/O
 */

const defaultMarkdown = `# 歡迎使用 shenMD

本工具特別針對 **Vue.js 官方文件風格** 進行了樣式客製化。

## 主要功能

* **Vue 經典配色**：採用 \`#42b883\` 作為主色調。
* **即時預覽**：左側輸入，右側即時渲染。
* **PDF / Word / Excel 匯出**：完美保留排版，一鍵下載。
* **本地檔案瀏覽**：開啟本地資料夾，直接編輯儲存。
* **圖片貼上支援**：貼上的圖片會自動存入 \`assets/\` 資料夾，並使用相對路徑，VSCode 也可正確顯示。

> **提示：** 使用 **Cmd+S** 儲存，**Cmd+B** 粗體，**Cmd+I** 斜體，**Cmd+K** 插入連結。

### 程式碼高亮示範

\`\`\`javascript
import { ref, computed } from 'vue'
export default {
  setup() {
    const count = ref(0)
    const double = computed(() => count.value * 2)
    return { count, double }
  }
}
\`\`\`

### 功能表格

| 功能 | 支援 | 說明 |
| :--- | :---: | :--- |
| Markdown 渲染 | ✅ | 使用 marked.js |
| 語法高亮 | ✅ | 使用 highlight.js |
| PDF 匯出 | ✅ | 使用 html2pdf.js |
| Word 匯出 | ✅ | 使用 docx.js |
| Excel 匯出 | ✅ | 使用 xlsx.js |
| Mermaid 圖表 | ✅ | 使用 mermaid.js |
| 本地檔案 | ✅ | Electron Node fs |
| 圖片貼上 | ✅ | 自動存入 assets/ |
`;

// ========== DOM 元素 ==========
const editor         = document.getElementById('editor');
const previewContent = document.getElementById('preview-content');
const previewWrapper = document.getElementById('preview-wrapper');
const exportPdfBtn   = document.getElementById('exportPdfBtn');
const openPdfPanelBtn= document.getElementById('openPdfPanelBtn');
const pdfPanel       = document.getElementById('pdf-panel');
const closePdfPanel  = document.getElementById('closePdfPanel');
const pdfOverlay     = document.getElementById('pdf-overlay');
const statusText     = document.getElementById('status');
const statWords      = document.getElementById('stat-words');
const statLines      = document.getElementById('stat-lines');
const statChars      = document.getElementById('stat-chars');
const statFile       = document.getElementById('stat-file');
const fontIncBtn     = document.getElementById('fontIncBtn');
const fontDecBtn     = document.getElementById('fontDecBtn');
const fontSizeLabel  = document.getElementById('fontSizeLabel');
const csvEncodingWrap = document.getElementById('csvEncodingWrap');
const csvEncodingSelect = document.getElementById('csvEncodingSelect');
const saveBtn        = document.getElementById('saveBtn');
const exportExcelBtn = document.getElementById('exportExcelBtn');
const editorPanel    = document.getElementById('editor-panel');
const previewPanel   = document.getElementById('preview-panel');
const dragOverlay    = document.getElementById('drag-overlay');
const tabsList       = document.getElementById('tabs-list');
const newTabBtn      = document.getElementById('newTabBtn');

// ========== 狀態 ==========
let currentFilePath = null;   // 目前開啟的檔案絕對路徑
let currentDirPath  = null;   // 目前檔案所在目錄
let currentFileType = 'markdown';
let currentFileExt  = '';
let isModified = false;
let suppressWatchReloadUntil = 0;
let activeTabId = null;
let nextTabId = 1;
const tabs = [];

function scheduleAutoSave() {}

function createTabState(overrides = {}) {
    return {
        id: `tab-${nextTabId++}`,
        filePath: null,
        dirPath: null,
        fileType: 'markdown',
        fileExt: '',
        isModified: false,
        content: '',
        title: '未命名',
        csvEncoding: csvEncodingSelect.value || 'auto',
        externalChanged: false,
        ...overrides,
    };
}

function getActiveTab() {
    return tabs.find(tab => tab.id === activeTabId) || null;
}

function updateTabTitle(tab) {
    tab.title = tab.filePath ? pathBasename(tab.filePath) : '未命名';
}

function renderTabs() {
    tabsList.innerHTML = '';
    tabs.forEach(tab => {
        const tabEl = document.createElement('button');
        tabEl.className = 'tab-item' + (tab.id === activeTabId ? ' active' : '');
        tabEl.dataset.tabId = tab.id;
        tabEl.innerHTML = `
            ${tab.isModified ? '<span class="tab-dot"></span>' : '<span class="w-2 h-2 flex-shrink-0"></span>'}
            <span class="tab-title" title="${escapeHtml(tab.title)}">${escapeHtml(tab.title)}</span>
            <span class="tab-close-btn" data-close-tab="${tab.id}" title="關閉分頁">×</span>
        `;
        tabsList.appendChild(tabEl);
    });
}

function syncEditorToActiveTab() {
    const tab = getActiveTab();
    if (!tab) return;
    tab.content = editor.value;
    tab.csvEncoding = csvEncodingSelect.value;
}

function applyTabToEditor(tab) {
    if (!tab) return;
    currentFilePath = tab.filePath;
    currentDirPath = tab.dirPath;
    currentFileType = tab.fileType;
    currentFileExt = tab.fileExt;
    isModified = tab.isModified;
    editor.value = tab.content;
    csvEncodingSelect.value = tab.csvEncoding || 'auto';
    statFile.textContent = tab.title;
    updateExportButtons();
    setModified(tab.isModified, { skipTabSync: true, silentTitle: true });
}

async function refreshActiveTabView() {
    const tab = getActiveTab();
    if (!tab) return;
    applyTabToEditor(tab);
    await updatePreview();
    setModified(tab.isModified, { skipTabSync: true });
    renderTabs();
}

async function activateTab(tabId) {
    if (activeTabId === tabId) return;
    syncEditorToActiveTab();
    activeTabId = tabId;
    const tab = getActiveTab();
    if (!tab) return;
    if (tab.externalChanged && !tab.isModified && tab.filePath) {
        await reloadTabFromDisk(tab, { notify: false });
        tab.externalChanged = false;
    }
    await refreshActiveTabView();
}

function ensureAtLeastOneTab() {
    if (tabs.length > 0) return;
    const tab = createTabState({ content: defaultMarkdown });
    updateTabTitle(tab);
    tabs.push(tab);
    activeTabId = tab.id;
}

async function createUntitledTab() {
    syncEditorToActiveTab();
    const tab = createTabState({ content: '' });
    updateTabTitle(tab);
    tabs.push(tab);
    activeTabId = tab.id;
    await refreshActiveTabView();
}

async function closeTab(tabId) {
    const idx = tabs.findIndex(tab => tab.id === tabId);
    if (idx === -1) return;
    const tab = tabs[idx];
    if (tab.isModified && !confirm(`分頁「${tab.title}」尚未儲存，確定要關閉？`)) return;
    if (tab.filePath) await window.electronAPI.unwatchCurrentFile(tab.filePath);
    tabs.splice(idx, 1);
    if (!tabs.length) {
        const freshTab = createTabState({ content: '' });
        updateTabTitle(freshTab);
        tabs.push(freshTab);
    }
    if (activeTabId === tabId) {
        const nextTab = tabs[Math.max(0, idx - 1)] || tabs[0];
        await activateTab(nextTab.id);
    } else {
        renderTabs();
    }
}

tabsList.addEventListener('click', async (e) => {
    const closeId = e.target.closest('[data-close-tab]')?.dataset.closeTab;
    if (closeId) {
        e.stopPropagation();
        await closeTab(closeId);
        return;
    }
    const tabId = e.target.closest('[data-tab-id]')?.dataset.tabId;
    if (tabId) await activateTab(tabId);
});
newTabBtn.addEventListener('click', async () => {
    await createUntitledTab();
});

// ========== 字型大小 ==========
const LS_FONT_SIZE = 'md_font_size';
let fontSize = parseInt(localStorage.getItem(LS_FONT_SIZE) || '15', 10);
function applyFontSize() {
    previewContent.style.fontSize = fontSize + 'px';
    fontSizeLabel.textContent = fontSize + 'px';
    localStorage.setItem(LS_FONT_SIZE, fontSize);
}
fontIncBtn.addEventListener('click', () => { if (fontSize < 22) { fontSize++; applyFontSize(); } });
fontDecBtn.addEventListener('click', () => { if (fontSize > 10) { fontSize--; applyFontSize(); } });
applyFontSize();

// ========== 檢視模式 ==========
const LS_VIEW = 'md_view_mode';
const viewBtns = {
    edit:    document.getElementById('viewEdit'),
    split:   document.getElementById('viewSplit'),
    preview: document.getElementById('viewPreview'),
};
function setViewMode(mode) {
    Object.values(viewBtns).forEach(b => b.classList.remove('active'));
    viewBtns[mode]?.classList.add('active');
    localStorage.setItem(LS_VIEW, mode);
    const rh = document.getElementById('resize-handle');
    if (mode === 'edit') {
        editorPanel.style.display = 'flex'; editorPanel.style.width = '100%';
        previewPanel.style.display = 'none';
        if (rh) rh.style.display = 'none';
    } else if (mode === 'preview') {
        editorPanel.style.display = 'none';
        previewPanel.style.display = 'flex'; previewPanel.style.width = '100%';
        if (rh) rh.style.display = 'none';
    } else {
        editorPanel.style.display = 'flex'; editorPanel.style.width = '50%';
        previewPanel.style.display = 'flex'; previewPanel.style.width = '50%';
        if (rh) rh.style.display = 'block';
    }
}
viewBtns.edit.addEventListener('click',    () => setViewMode('edit'));
viewBtns.split.addEventListener('click',   () => setViewMode('split'));
viewBtns.preview.addEventListener('click', () => setViewMode('preview'));

// ========== Markdown 工具列 ==========
function wrapSelection(before, after='', placeholder='文字') {
    const start = editor.selectionStart, end = editor.selectionEnd;
    const sel   = editor.value.substring(start, end) || placeholder;
    const newText = before + sel + after;
    editor.setRangeText(newText, start, end, 'select');
    editor.focus();
    editor.selectionStart = start + before.length;
    editor.selectionEnd   = start + before.length + sel.length;
    updatePreview(); scheduleAutoSave();
}
function insertLine(prefix, placeholder='文字') {
    const start = editor.selectionStart;
    const lineStart = editor.value.lastIndexOf('\n', start - 1) + 1;
    const lineEnd   = editor.value.indexOf('\n', start);
    const line      = editor.value.substring(lineStart, lineEnd === -1 ? undefined : lineEnd) || placeholder;
    const already   = line.startsWith(prefix);
    const newLine   = already ? line.slice(prefix.length) : prefix + line;
    editor.setRangeText(newLine, lineStart, lineEnd === -1 ? editor.value.length : lineEnd, 'end');
    editor.focus(); updatePreview(); scheduleAutoSave();
}
const TOOLBAR_ACTIONS = {
    h1:        () => insertLine('# '),
    h2:        () => insertLine('## '),
    h3:        () => insertLine('### '),
    bold:      () => wrapSelection('**', '**', '粗體文字'),
    italic:    () => wrapSelection('*', '*', '斜體文字'),
    strike:    () => wrapSelection('~~', '~~', '刪除文字'),
    ul:        () => insertLine('- '),
    ol:        () => insertLine('1. '),
    quote:     () => insertLine('> '),
    link:      () => wrapSelection('[', '](https://)', '連結文字'),
    image:     () => wrapSelection('![', '](image.png)', '圖片說明'),
    inlinecode:() => wrapSelection('`', '`', 'code'),
    codeblock: () => {
        const s = editor.selectionStart, e = editor.selectionEnd;
        const sel = editor.value.substring(s, e) || 'code';
        const block = '\n```\n' + sel + '\n```\n';
        editor.setRangeText(block, s, e, 'end');
        editor.focus(); updatePreview(); scheduleAutoSave();
    },
    table: () => {
        const tbl = '\n| 欄位1 | 欄位2 | 欄位3 |\n| :--- | :---: | ---: |\n| 內容 | 內容 | 內容 |\n';
        const pos = editor.selectionEnd;
        editor.setRangeText(tbl, pos, pos, 'end');
        editor.focus(); updatePreview(); scheduleAutoSave();
    },
    hr: () => {
        const pos = editor.selectionEnd;
        editor.setRangeText('\n\n---\n\n', pos, pos, 'end');
        editor.focus(); updatePreview(); scheduleAutoSave();
    },
};
document.getElementById('md-toolbar').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (btn) TOOLBAR_ACTIONS[btn.dataset.action]?.();
});

// ========== 鍵盤快捷鍵 ==========
editor.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey) {
        if (e.key === 'b') { e.preventDefault(); TOOLBAR_ACTIONS.bold(); }
        if (e.key === 'i') { e.preventDefault(); TOOLBAR_ACTIONS.italic(); }
        if (e.key === 'k') { e.preventDefault(); TOOLBAR_ACTIONS.link(); }
    }
    if (e.key === 'Tab') {
        e.preventDefault();
        const s = editor.selectionStart, en = editor.selectionEnd;
        editor.setRangeText('    ', s, en, 'end');
        updatePreview();
    }
});
document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault(); saveCurrentFile();
    }
});

// ========== 字數統計 ==========
function updateStats() {
    const txt   = editor.value;
    const words = txt.trim() === '' ? 0 : txt.trim().split(/\s+/).length;
    const lines = txt === '' ? 1 : txt.split('\n').length;
    const chars = txt.length;
    statWords.textContent = words + ' 字';
    statLines.textContent = lines + ' 行';
    statChars.textContent = chars + ' 字元';
}

// ========== 程式碼區塊複製 ==========
function copyCode(btn) {
    const code = btn.closest('.code-block-wrapper').querySelector('code').innerText;
    navigator.clipboard.writeText(code).then(() => {
        btn.classList.add('copied');
        btn.innerHTML = `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> 已複製`;
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg> 複製`;
        }, 2000);
    });
}

// ========== Marked.js 渲染器 ==========
const mdRenderer = new marked.Renderer();
mdRenderer.image = function(hrefOrToken, titleArg, textArg) {
    let href, alt, title;
    if (hrefOrToken && typeof hrefOrToken === 'object') {
        href = hrefOrToken.href || ''; alt = hrefOrToken.text || ''; title = hrefOrToken.title || '';
    } else {
        href = hrefOrToken || ''; alt = textArg || ''; title = titleArg || '';
    }
    const esc = s => s.replace(/"/g, '&quot;');
    return `<img src="${esc(href)}" data-src="${esc(href)}" alt="${esc(alt)}"${title ? ` title="${esc(title)}"` : ''}>`;
};
mdRenderer.code = function(codeOrToken, langArg) {
    let code, language;
    if (codeOrToken && typeof codeOrToken === 'object') {
        code = codeOrToken.text || ''; language = (codeOrToken.lang || langArg || 'text').toLowerCase();
    } else {
        code = codeOrToken || ''; language = (langArg || 'text').toLowerCase();
    }
    if (language === 'mermaid') {
        const escaped = code.replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const encoded = encodeURIComponent(code);
        return `<div class="mermaid-wrapper" data-mermaid-source="${encoded}"><pre class="mermaid">${escaped}</pre></div>`;
    }
    let highlighted;
    try {
        highlighted = (language !== 'text' && hljs.getLanguage(language))
            ? hljs.highlight(code, { language }).value
            : hljs.highlightAuto(code).value;
    } catch(e) {
        highlighted = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
    return `<div class="code-block-wrapper"><div class="code-block-header"><span class="code-lang-label">${language}</span><button class="copy-btn" onclick="copyCode(this)"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg> 複製</button></div><pre><code class="hljs language-${language}">${highlighted}</code></pre></div>`;
};
marked.setOptions({ renderer: mdRenderer, breaks: true, gfm: true });

// ========== 圖片路徑解析 (Electron file://) ==========
async function resolveImages(container) {
    if (!currentDirPath) return;
    for (const img of container.querySelectorAll('img')) {
        const rawSrc = img.getAttribute('data-src') || img.getAttribute('src') || '';
        if (!rawSrc) continue;
        if (/^(https?:|data:|blob:)/i.test(rawSrc)) continue;
        // 相對路徑轉絕對路徑
        let absPath = rawSrc;
        if (!rawSrc.startsWith('/')) {
            absPath = await window.electronAPI.pathResolve(currentDirPath, rawSrc);
        }
        // 改用 file:// 協議
        img.src = 'file://' + absPath;
    }
}

// ========== CSV 處理 ==========
function stripBom(text) {
    return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}
function hasUtfBom(bytes) {
    return (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF)
        || (bytes[0] === 0xFF && bytes[1] === 0xFE)
        || (bytes[0] === 0xFE && bytes[1] === 0xFF);
}
function scoreDecodedText(text) {
    const replacementCount = (text.match(/\uFFFD/g) || []).length;
    const mojibakeCount = (text.match(/[ÃÂÐÑ][^\s]{0,2}/g) || []).length;
    const weirdSymbolCount = (text.match(/[�¤�𢒑]/g) || []).length;
    const privateUseCount = (text.match(/[\uE000-\uF8FF]/g) || []).length;
    const cjkCount = (text.match(/[\u4E00-\u9FFF\u3400-\u4DBF]/g) || []).length;
    return cjkCount * 4 - replacementCount * 10 - mojibakeCount * 5 - weirdSymbolCount * 6 - privateUseCount * 3;
}
async function readTextWithEncoding(buffer, preferredEncodings = ['utf-8', 'big5']) {
    const bytes = new Uint8Array(buffer);
    if (hasUtfBom(bytes)) {
        if (bytes[0] === 0xEF) return stripBom(new TextDecoder('utf-8').decode(buffer));
        if (bytes[0] === 0xFF) return stripBom(new TextDecoder('utf-16le').decode(buffer));
        if (bytes[0] === 0xFE) return stripBom(new TextDecoder('utf-16be').decode(buffer));
    }
    let best = '';
    let bestScore = -Infinity;
    for (const encoding of preferredEncodings) {
        try {
            const decoder = new TextDecoder(encoding, { fatal: ['utf-8', 'utf-16le', 'utf-16be'].includes(encoding) });
            const text = stripBom(decoder.decode(buffer));
            const score = scoreDecodedText(text);
            if (score > bestScore) { best = text; bestScore = score; }
        } catch (e) {}
    }
    return best || stripBom(new TextDecoder('utf-8').decode(buffer));
}
async function readFileText(filePath, ext, encodingOverride = 'auto') {
    const result = await window.electronAPI.readFileBinary(filePath);
    if (!result.success) throw new Error(result.error);
    const buffer = Uint8Array.from(atob(result.data), c => c.charCodeAt(0)).buffer;
    if (ext === 'csv') {
        const encodings = encodingOverride === 'auto'
            ? ['big5', 'utf-8', 'utf-16le', 'utf-16be', 'gb18030']
            : [encodingOverride];
        return await readTextWithEncoding(buffer, encodings);
    }
    return stripBom(new TextDecoder('utf-8').decode(buffer));
}

// ========== 開啟檔案 ==========
async function reloadTabFromDisk(tab, options = {}) {
    const { notify = true } = options;
    if (!tab?.filePath) return false;
    try {
        const ext = tab.filePath.split('.').pop().toLowerCase();
        const text = await readFileText(tab.filePath, ext, tab.csvEncoding || csvEncodingSelect.value);
        tab.filePath = tab.filePath;
        tab.dirPath = await window.electronAPI.pathDirname(tab.filePath);
        tab.fileExt = ext;
        tab.fileType = ext === 'csv' ? 'csv' : 'markdown';
        tab.content = text;
        tab.isModified = false;
        tab.externalChanged = false;
        updateTabTitle(tab);
        const watchResult = await window.electronAPI.watchCurrentFile(tab.filePath);
        if (!watchResult?.success) {
            console.warn('監聽檔案失敗:', watchResult?.error);
        }
        if (tab.id === activeTabId) {
            await refreshActiveTabView();
            if (notify) showSaveToast('目前檔案已重新整理');
        } else {
            renderTabs();
        }
        return true;
    } catch (e) {
        console.error('重新載入檔案失敗:', e);
        if (notify) showSaveToast('重新整理失敗');
        return false;
    }
}

async function openFile(filePath, options = {}) {
    try {
        const { silent = false } = options;
        syncEditorToActiveTab();
        const existingTab = tabs.find(tab => tab.filePath === filePath);
        if (existingTab) {
            activeTabId = existingTab.id;
            if (existingTab.externalChanged && !existingTab.isModified) {
                await reloadTabFromDisk(existingTab, { notify: false });
            } else {
                await refreshActiveTabView();
            }
            if (!silent) showSaveToast('已切換到 ' + pathBasename(filePath));
            return;
        }

        const ext = filePath.split('.').pop().toLowerCase();
        const encoding = ext === 'csv' ? (csvEncodingSelect.value || 'auto') : 'auto';
        const text = await readFileText(filePath, ext, encoding);
        const tab = createTabState({
            filePath,
            dirPath: await window.electronAPI.pathDirname(filePath),
            fileExt: ext,
            fileType: ext === 'csv' ? 'csv' : 'markdown',
            content: text,
            csvEncoding: encoding,
        });
        updateTabTitle(tab);
        tabs.push(tab);
        activeTabId = tab.id;
        const watchResult = await window.electronAPI.watchCurrentFile(filePath);
        if (!watchResult?.success) {
            console.warn('監聽檔案失敗:', watchResult?.error);
        }
        await refreshActiveTabView();
        if (!silent) showSaveToast('已開啟 ' + pathBasename(filePath));
    } catch (e) {
        console.error('開啟檔案失敗:', e);
        showSaveToast('開啟失敗');
    }
}

function pathBasename(fp) {
    return fp.split(/[\\/]/).pop();
}

function updateExportButtons() {
    const isCsv = currentFileType === 'csv';
    exportExcelBtn.classList.toggle('hidden', !isCsv);
    openPdfPanelBtn.classList.toggle('hidden', isCsv);
    document.getElementById('exportWordBtn').classList.toggle('hidden', isCsv);
    csvEncodingWrap.classList.toggle('hidden', !isCsv);
    csvEncodingWrap.classList.toggle('flex', isCsv);
}

function setModified(modified, options = {}) {
    const { skipTabSync = false, silentTitle = false } = options;
    isModified = modified;
    const tab = getActiveTab();
    if (tab && !skipTabSync) {
        tab.isModified = modified;
        tab.content = editor.value;
        updateTabTitle(tab);
    }
    saveBtn.disabled = !modified && !currentFilePath;
    if (saveBtn.disabled) {
        saveBtn.classList.add('text-gray-400','border-gray-300','bg-gray-50','cursor-not-allowed');
        saveBtn.classList.remove('text-gray-700','border-gray-400','hover:border-[#42b883]','hover:text-[#42b883]','hover:bg-green-50','bg-white');
    } else {
        saveBtn.classList.remove('text-gray-400','border-gray-300','bg-gray-50','cursor-not-allowed');
        saveBtn.classList.add('text-gray-700','border-gray-400','hover:border-[#42b883]','hover:text-[#42b883]','hover:bg-green-50','bg-white');
    }
    // 視窗標題
    const name = currentFilePath ? pathBasename(currentFilePath) : '未命名';
    if (!silentTitle) document.title = (modified ? '● ' : '') + name + ' - shenMD';
    renderTabs();
}

// ========== 儲存功能 ==========
async function saveCurrentFile() {
    syncEditorToActiveTab();
    if (!currentFilePath) {
        await saveAsNewFile();
        return;
    }
    try {
        suppressWatchReloadUntil = Date.now() + 1500;
        const result = await window.electronAPI.writeFile(currentFilePath, editor.value);
        if (result.success) {
            await window.electronAPI.watchCurrentFile(currentFilePath);
            showSaveToast('已儲存');
            setModified(false);
        } else {
            showSaveToast('儲存失敗: ' + result.error);
        }
    } catch (e) {
        showSaveToast('儲存失敗');
    }
}

async function saveAsNewFile() {
    const result = await window.electronAPI.showSaveDialog({
        defaultPath: 'untitled.md',
        filters: [
            { name: 'Markdown', extensions: ['md'] },
            { name: '所有檔案', extensions: ['*'] }
        ]
    });
    if (!result.canceled && result.filePath) {
        const tab = getActiveTab();
        if (!tab) return;
        if (tab.filePath && tab.filePath !== result.filePath) {
            await window.electronAPI.unwatchCurrentFile(tab.filePath);
        }
        tab.filePath = result.filePath;
        tab.dirPath  = await window.electronAPI.pathDirname(tab.filePath);
        tab.fileExt  = tab.filePath.split('.').pop().toLowerCase();
        tab.fileType = tab.fileExt === 'csv' ? 'csv' : 'markdown';
        updateTabTitle(tab);
        currentFilePath = tab.filePath;
        currentDirPath = tab.dirPath;
        currentFileExt = tab.fileExt;
        currentFileType = tab.fileType;
        statFile.textContent = tab.title;
        renderTabs();
        updateExportButtons();
        await saveCurrentFile();
    }
}

saveBtn.addEventListener('click', saveCurrentFile);

// ========== 新建檔案 ==========
function newFile() {
    return createUntitledTab();
}

async function reloadCurrentFileFromDisk(options = {}) {
    const { force = false, notify = true } = options;
    const tab = getActiveTab();
    if (!tab?.filePath) return false;
    if (tab.isModified && !force) {
        if (notify) showSaveToast('目前檔案有未儲存修改，未自動重載');
        return false;
    }
    return await reloadTabFromDisk(tab, { notify });
}

csvEncodingSelect.addEventListener('change', async () => {
    if (currentFileType !== 'csv' || !currentFilePath) return;
    try {
        const tab = getActiveTab();
        if (tab) tab.csvEncoding = csvEncodingSelect.value;
        const ext = currentFilePath.split('.').pop().toLowerCase();
        const text = await readFileText(currentFilePath, ext, csvEncodingSelect.value);
        editor.value = text;
        if (tab) tab.content = text;
        await updatePreview();
        setModified(false);
        showSaveToast(`CSV 重新解碼: ${csvEncodingSelect.value === 'auto' ? '自動' : csvEncodingSelect.value}`);
    } catch (e) {
        console.error('CSV 重新解碼失敗:', e);
        showSaveToast('重新解碼失敗');
    }
});

// ========== 預覽更新 ==========
mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });

async function updatePreview() {
    if (currentFileType === 'csv') {
        renderCsvPreview(editor.value);
        updateStats();
        return;
    }
    const cleanHtml = DOMPurify.sanitize(marked.parse(editor.value), { ADD_ATTR: ['onclick', 'data-src', 'data-mermaid-source'], FORCE_BODY: true });
    previewContent.innerHTML = cleanHtml;
    const mermaidEls = previewContent.querySelectorAll('.mermaid');
    if (mermaidEls.length > 0) {
        try { await mermaid.run({ nodes: mermaidEls }); } catch(e) { console.warn('Mermaid 渲染失敗:', e); }
    }
    await resolveImages(previewContent);
    updateStats();
}

// ========== CSV 預覽 ==========
function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    for (let i = 0; i < normalized.length; i++) {
        const ch = normalized[i];
        if (ch === '"') {
            if (inQuotes && normalized[i + 1] === '"') { field += '"'; i++; }
            else { inQuotes = !inQuotes; }
        } else if (ch === ',' && !inQuotes) { row.push(field); field = ''; }
        else if (ch === '\n' && !inQuotes) { row.push(field); rows.push(row); row = []; field = ''; }
        else { field += ch; }
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
    return rows;
}
function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function renderCsvPreview(text) {
    const rows = parseCsv(text);
    if (!rows.length) { previewContent.innerHTML = '<p class="text-slate-400">CSV 內容為空</p>'; return; }
    const header = rows[0];
    const bodyRows = rows.slice(1);
    const thead = `<thead><tr>${header.map(cell => `<th>${escapeHtml(cell)}</th>`).join('')}</tr></thead>`;
    const tbody = bodyRows.length
        ? `<tbody>${bodyRows.map(row => `<tr>${header.map((_, idx) => `<td>${escapeHtml(row[idx] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody>`
        : '';
    previewContent.innerHTML = `<table>${thead}${tbody}</table>`;
}

// ========== Excel 匯出 ==========
function exportCsvAsExcel() {
    if (typeof XLSX === 'undefined') { alert('xlsx 尚未載入'); return; }
    const defaultName = (statFile.textContent && statFile.textContent !== '未開啟檔案')
        ? statFile.textContent.replace(/\.[^.]+$/, '') : 'Document';
    const filename = (prompt('請輸入 Excel 檔案名稱', defaultName) || defaultName).trim();
    if (!filename) return;
    exportExcelBtn.disabled = true;
    exportExcelBtn.textContent = '轉換中...';
    statusText.textContent = '正在產生 Excel...';
    try {
        const rows = parseCsv(editor.value);
        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        for (let row = range.s.r; row <= range.e.r; row++) {
            for (let col = range.s.c; col <= range.e.c; col++) {
                const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
                if (!worksheet[cellRef]) continue;
                worksheet[cellRef].t = 's';
            }
        }
        worksheet['!cols'] = rows.reduce((cols, currentRow) => {
            currentRow.forEach((value, idx) => {
                const width = Math.min(Math.max((value || '').length + 2, 10), 40);
                cols[idx] = { wch: Math.max(cols[idx]?.wch || 0, width) };
            });
            return cols;
        }, []);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '資料');
        const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', compression: true });
        const blob = new Blob([wbout], { type: 'application/octet-stream' });
        downloadBlob(blob, filename + '.xlsx');
        showSaveToast('Excel 匯出完成');
    } catch (err) {
        console.error('Excel 匯出失敗:', err);
        showSaveToast('Excel 匯出失敗');
    } finally {
        exportExcelBtn.disabled = false;
        exportExcelBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> CSV 轉 Excel`;
    }
}
exportExcelBtn.addEventListener('click', exportCsvAsExcel);

// ========== 拖曳分隔線 ==========
const resizeHandle = document.getElementById('resize-handle');
const mainEl = document.querySelector('main');
let isResizing = false;
resizeHandle.addEventListener('mousedown', e => {
    isResizing = true;
    resizeHandle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
});
document.addEventListener('mousemove', e => {
    if (!isResizing) return;
    const mainRect = mainEl.getBoundingClientRect();
    const available = mainRect.width - resizeHandle.offsetWidth;
    let editorPct = (e.clientX - mainRect.left) / available * 100;
    editorPct = Math.max(15, Math.min(85, editorPct));
    editorPanel.style.width = editorPct + '%';
    previewPanel.style.width = (100 - editorPct) + '%';
});
document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = false;
    resizeHandle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
});

// ========== 編輯器事件 ==========
editor.addEventListener('input', () => {
    syncEditorToActiveTab();
    updatePreview();
    setModified(true);
});
editor.addEventListener('scroll', () => {
    const pct = editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
    previewWrapper.scrollTop = pct * (previewWrapper.scrollHeight - previewWrapper.clientHeight);
});

// ========== PDF 面板 ==========
openPdfPanelBtn.addEventListener('click', () => {
    const currentFile = statFile.textContent;
    if (currentFile && currentFile !== '未開啟檔案' && currentFile !== '未命名') {
        document.getElementById('pdf-filename').value = currentFile.replace(/\.[^.]+$/, '');
    }
    pdfPanel.classList.add('open');
});
closePdfPanel.addEventListener('click',   () => pdfPanel.classList.remove('open'));
pdfOverlay.addEventListener('click',      () => pdfPanel.classList.remove('open'));

// ========== 通用下載輔助 ==========
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
async function downloadBlob(blob, filename) {
    const result = await window.electronAPI.showSaveDialog({ defaultPath: filename });
    if (result.canceled) return;
    const base64 = await blobToBase64(blob);
    await window.electronAPI.saveExportFile(result.filePath, base64);
}

// ========== SVG / 圖片處理 (PDF / Word 匯出用) ==========
function numericSvgLength(value, fallback) {
    const raw = String(value || '').trim();
    if (!raw || raw.endsWith('%')) return fallback;
    const parsed = parseFloat(raw.replace('px', ''));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function getSvgPixelSize(svgEl, fallbackWidth = 800, fallbackHeight = 450) {
    const rect = svgEl.getBoundingClientRect();
    const viewBox = (svgEl.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
    const viewBoxWidth = viewBox.length === 4 && Number.isFinite(viewBox[2]) ? viewBox[2] : 0;
    const viewBoxHeight = viewBox.length === 4 && Number.isFinite(viewBox[3]) ? viewBox[3] : 0;
    const width = numericSvgLength(svgEl.getAttribute('width'), rect.width || viewBoxWidth || fallbackWidth);
    const height = numericSvgLength(svgEl.getAttribute('height'), rect.height || viewBoxHeight || fallbackHeight);
    return {
        width: Math.max(Math.round(width), 1),
        height: Math.max(Math.round(height), 1),
    };
}
function getSvgContentBox(svgEl, padding = 16) {
    try {
        const box = svgEl.getBBox();
        if (!box || box.width <= 0 || box.height <= 0) return null;
        return {
            x: box.x - padding,
            y: box.y - padding,
            width: box.width + padding * 2,
            height: box.height + padding * 2,
        };
    } catch (e) {
        return null;
    }
}
function svgToDataUrl(svgEl) {
    const contentBox = getSvgContentBox(svgEl);
    const size = getSvgPixelSize(svgEl);
    const w = contentBox ? Math.ceil(contentBox.width) : size.width;
    const h = contentBox ? Math.ceil(contentBox.height) : size.height;
    const clone = svgEl.cloneNode(true);
    clone.setAttribute('width',  w);
    clone.setAttribute('height', h);
    if (contentBox) {
        clone.setAttribute('viewBox', `${contentBox.x} ${contentBox.y} ${contentBox.width} ${contentBox.height}`);
    }
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', contentBox ? contentBox.x : '0');
    bg.setAttribute('y', contentBox ? contentBox.y : '0');
    bg.setAttribute('width', contentBox ? contentBox.width : '100%');
    bg.setAttribute('height', contentBox ? contentBox.height : '100%');
    bg.setAttribute('fill',   'white');
    clone.insertBefore(bg, clone.firstChild);
    const svgStr  = new XMLSerializer().serializeToString(clone);
    const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
    return { dataUrl, w, h };
}
function decodeMermaidSource(encoded) {
    if (!encoded) return '';
    try {
        return decodeURIComponent(encoded);
    } catch (e) {
        console.warn('Mermaid source decode 失敗:', e);
        return encoded;
    }
}
async function renderMermaidSourceToPngDataUrl(source, scale = 2.5) {
    const renderId = `mermaid-export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { svg } = await mermaid.render(renderId, source);
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:-20000px;top:0;background:#ffffff;padding:16px;';
    host.innerHTML = svg;
    document.body.appendChild(host);
    try {
        const svgEl = host.querySelector('svg');
        if (!svgEl) throw new Error('Mermaid SVG 未產生');
        const { dataUrl, w, h } = svgToDataUrl(svgEl);
        const pngDataUrl = await svgDataUrlToPngDataUrl(dataUrl, w, h, scale);
        return { dataUrl: pngDataUrl, width: w, height: h };
    } finally {
        if (host.parentNode) host.parentNode.removeChild(host);
    }
}
async function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
async function srcToDataUrl(src) {
    if (!src || /^data:/i.test(src)) return src;
    // 對於 file:// 路徑，改用 Electron API 讀取
    if (src.startsWith('file://')) {
        const fp = src.replace('file://', '');
        const result = await window.electronAPI.readFileBinary(fp);
        if (result.success) {
            const mime = fp.endsWith('.svg') ? 'image/svg+xml' : (fp.endsWith('.png') ? 'image/png' : 'image/jpeg');
            return `data:${mime};base64,${result.data}`;
        }
        throw new Error(`圖片讀取失敗: ${fp}`);
    }
    const res = await fetch(src);
    if (!res.ok) throw new Error(`圖片讀取失敗: ${src}`);
    return await blobToDataUrl(await res.blob());
}
function shouldRasterizeForWord(dataUrl) {
    return /^data:image\/(svg\+xml|webp)/i.test(dataUrl || '');
}
function getRasterSize(imgEl) {
    const rect = imgEl.getBoundingClientRect();
    const width = Math.round(rect.width) || imgEl.naturalWidth || parseInt(imgEl.getAttribute('width') || '', 10) || 800;
    const height = Math.round(rect.height) || imgEl.naturalHeight || parseInt(imgEl.getAttribute('height') || '', 10) || 450;
    return { width: Math.max(width, 1), height: Math.max(height, 1) };
}
async function svgDataUrlToPngDataUrl(dataUrl, width, height, scale = 2) {
    return await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const safeWidth = Number.isFinite(width) && width > 0 ? width : 800;
                const safeHeight = Number.isFinite(height) && height > 0 ? height : 450;
                canvas.width = Math.max(Math.round(safeWidth * scale), 1);
                canvas.height = Math.max(Math.round(safeHeight * scale), 1);
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/png'));
            } catch (e) { reject(e); }
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
}
async function rasterizeDataUrlForWord(dataUrl, imgEl, scale = 2) {
    const { width, height } = getRasterSize(imgEl);
    return await svgDataUrlToPngDataUrl(dataUrl, width, height, scale);
}

async function createExportSnapshot(widthPx) {
    const exportWrapper = document.createElement('div');
    exportWrapper.style.cssText = 'position:absolute;left:-20000px;top:0;background:#ffffff;';
    const exportEl = document.createElement('div');
    exportEl.className = 'vue-markdown';
    exportEl.style.cssText = [
        widthPx ? `width:${widthPx}px;` : 'width:900px;',
        'background:#ffffff;',
        'padding:0 0 40px 0;',
        'word-break:break-word;',
        'overflow-wrap:break-word;',
        `font-size:${fontSize}px;`
    ].join('');
    exportWrapper.appendChild(exportEl);
    document.body.appendChild(exportWrapper);
    exportEl.innerHTML = previewContent.innerHTML;
    exportEl.querySelectorAll('.copy-btn').forEach(btn => btn.remove());
    exportEl.querySelectorAll('[onclick]').forEach(el => el.removeAttribute('onclick'));
    exportEl.querySelectorAll('.code-block-wrapper pre').forEach(pre => {
        pre.style.overflowX = 'visible';
        pre.style.whiteSpace = 'pre-wrap';
        pre.style.wordBreak = 'break-all';
    });
    exportEl.querySelectorAll('table').forEach(tbl => {
        tbl.style.tableLayout = 'auto';
        tbl.style.width = '100%';
        tbl.style.wordBreak = 'break-word';
        tbl.style.fontSize = '0.88em';
    });
    exportEl.querySelectorAll('td, th').forEach(cell => {
        cell.style.wordBreak = 'break-word';
        cell.style.overflowWrap = 'break-word';
        cell.style.maxWidth = '300px';
    });
    for (const wrapper of exportEl.querySelectorAll('.mermaid-wrapper')) {
        try {
            const source = decodeMermaidSource(wrapper.dataset.mermaidSource || '');
            let pngDataUrl = null;
            let targetWidth = 800;
            const svgEl = wrapper.querySelector('svg');
            if (source) {
                const renderedMermaid = await renderMermaidSourceToPngDataUrl(source, 2.5);
                pngDataUrl = renderedMermaid.dataUrl;
                targetWidth = Math.min(Math.max(renderedMermaid.width, 520), 900);
            } else if (svgEl) {
                const { dataUrl, w, h } = svgToDataUrl(svgEl);
                targetWidth = w || targetWidth;
                pngDataUrl = await svgDataUrlToPngDataUrl(dataUrl, w, h, 2.5);
            }
            if (!pngDataUrl) continue;
            if (svgEl) {
                targetWidth = getSvgPixelSize(svgEl).width || targetWidth;
            }
            wrapper.innerHTML = `<img src="${pngDataUrl}" class="export-mermaid-img" style="max-width:100%;width:${targetWidth}px;height:auto;display:block;margin:0 auto;" />`;
        } catch(e) { console.warn('Mermaid SVG 轉換失敗:', e); }
    }
    for (const img of exportEl.querySelectorAll('img')) {
        const src = img.getAttribute('src') || '';
        if (!src) continue;
        try {
            let dataUrl = await srcToDataUrl(src);
            if (shouldRasterizeForWord(dataUrl)) {
                dataUrl = await rasterizeDataUrlForWord(dataUrl, img, 2.5);
            }
            img.src = dataUrl;
            img.removeAttribute('data-src');
        } catch(e) { console.warn('圖片轉換失敗:', src, e); }
    }
    await new Promise(resolve => setTimeout(resolve, 200));
    return { exportWrapper, exportEl };
}

function normalizeWordText(text) {
    return (text || '').replace(/\u00A0/g, ' ');
}
function getWordImageSize(imgEl) {
    const maxWidth = 520;
    const naturalWidth = imgEl.naturalWidth || parseInt(imgEl.getAttribute('width') || '', 10) || 0;
    const naturalHeight = imgEl.naturalHeight || parseInt(imgEl.getAttribute('height') || '', 10) || 0;
    const rect = imgEl.getBoundingClientRect();
    const renderedWidth = Math.round(rect.width) || parseInt(imgEl.style.width || '', 10) || 0;
    let width = renderedWidth || naturalWidth || 480;
    width = Math.min(width, maxWidth);
    if (naturalWidth > 0 && naturalHeight > 0) {
        return { width, height: Math.max(Math.round(width * naturalHeight / naturalWidth), 24) };
    }
    return { width, height: Math.max(Math.round((parseInt(imgEl.style.height || '', 10) || imgEl.clientHeight || width * 0.6)), 24) };
}
function headingLevelFromTag(tagName) {
    const { HeadingLevel } = docx;
    return ({ H1: HeadingLevel.HEADING_1, H2: HeadingLevel.HEADING_2, H3: HeadingLevel.HEADING_3,
              H4: HeadingLevel.HEADING_4, H5: HeadingLevel.HEADING_5, H6: HeadingLevel.HEADING_6, })[tagName] || HeadingLevel.HEADING_1;
}
function parseInlineChildren(node, inherited = {}) {
    const { TextRun, ImageRun } = docx;
    const runs = [];
    for (const child of Array.from(node.childNodes || [])) {
        if (child.nodeType === Node.TEXT_NODE) {
            const value = normalizeWordText(child.textContent);
            if (value) runs.push(new TextRun({ text: value, ...inherited }));
            continue;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) continue;
        const tag = child.tagName.toUpperCase();
        if (tag === 'BR') { runs.push(new TextRun({ text: '', break: 1, ...inherited })); continue; }
        if (tag === 'IMG') {
            const src = child.getAttribute('src') || '';
            if (src.startsWith('data:image/')) {
                try {
                    const [meta, base64] = src.split(',', 2);
                    const mime = (meta.match(/^data:(image\/[^;]+)/i) || [])[1] || 'image/png';
                    const binary = atob(base64);
                    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
                    const { width, height } = getWordImageSize(child);
                    const imageType = mime.split('/')[1].replace('jpeg', 'jpg');
                    runs.push(new ImageRun({ data: bytes, transformation: { width, height }, type: imageType }));
                } catch (e) { console.warn('Word 圖片轉換失敗:', e); }
            }
            continue;
        }
        const nextStyle = { ...inherited };
        if (['STRONG', 'B'].includes(tag)) nextStyle.bold = true;
        if (['EM', 'I'].includes(tag)) nextStyle.italics = true;
        if (['S', 'DEL', 'STRIKE'].includes(tag)) nextStyle.strike = true;
        if (tag === 'CODE') { nextStyle.font = 'Consolas'; nextStyle.shading = { fill: 'F1F5F9' }; nextStyle.size = 20; }
        if (tag === 'A') { nextStyle.color = '0563C1'; nextStyle.underline = {}; }
        runs.push(...parseInlineChildren(child, nextStyle));
    }
    return runs;
}
function paragraphFromElement(el, options = {}) {
    const { Paragraph, BorderStyle, AlignmentType } = docx;
    const runs = parseInlineChildren(el);
    if (!runs.length) runs.push(new docx.TextRun(''));
    const paragraphOptions = {
        children: runs,
        spacing: options.spacing || { after: 180, line: 360 },
        style: options.style,
        heading: options.heading,
        bullet: options.bullet,
        numbering: options.numbering,
        thematicBreak: options.thematicBreak,
        pageBreakBefore: options.pageBreakBefore,
    };
    if (options.codeBlock) {
        paragraphOptions.shading = { fill: 'F6F8FA' };
        paragraphOptions.border = {
            top: { style: BorderStyle.SINGLE, color: 'D0D7DE', size: 4 },
            bottom: { style: BorderStyle.SINGLE, color: 'D0D7DE', size: 4 },
            left: { style: BorderStyle.SINGLE, color: 'D0D7DE', size: 4 },
            right: { style: BorderStyle.SINGLE, color: 'D0D7DE', size: 4 },
        };
    }
    if (options.blockquote) {
        paragraphOptions.border = { left: { style: BorderStyle.SINGLE, color: '42B883', size: 12 } };
        paragraphOptions.indent = { left: 320 };
        paragraphOptions.spacing = { after: 160, before: 80, line: 320 };
    }
    if (options.center) paragraphOptions.alignment = AlignmentType.CENTER;
    return new Paragraph(paragraphOptions);
}
function buildWordTable(tableEl) {
    const { Table, TableRow, TableCell, WidthType, Paragraph, BorderStyle } = docx;
    const rows = [];
    const trEls = tableEl.querySelectorAll('tr');
    for (const tr of trEls) {
        const cells = [];
        for (const cellEl of Array.from(tr.children)) {
            const isHeader = cellEl.tagName.toUpperCase() === 'TH';
            const paragraphs = Array.from(cellEl.childNodes).length
                ? buildWordContent(Array.from(cellEl.childNodes), { insideTable: true })
                : [new Paragraph('')];
            cells.push(new TableCell({
                children: paragraphs.length ? paragraphs : [new Paragraph('')],
                shading: isHeader ? { fill: 'F8FAFC' } : undefined,
                margins: { top: 100, bottom: 100, left: 120, right: 120 },
            }));
        }
        rows.push(new TableRow({ children: cells }));
    }
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows,
        borders: {
            top: { style: BorderStyle.SINGLE, color: 'D0D7DE', size: 4 },
            bottom: { style: BorderStyle.SINGLE, color: 'D0D7DE', size: 4 },
            left: { style: BorderStyle.SINGLE, color: 'D0D7DE', size: 4 },
            right: { style: BorderStyle.SINGLE, color: 'D0D7DE', size: 4 },
            insideHorizontal: { style: BorderStyle.SINGLE, color: 'D0D7DE', size: 4 },
            insideVertical: { style: BorderStyle.SINGLE, color: 'D0D7DE', size: 4 },
        },
    });
}
function buildWordList(listEl, ordered = false, level = 0) {
    const children = [];
    const liEls = Array.from(listEl.children).filter(el => el.tagName && el.tagName.toUpperCase() === 'LI');
    liEls.forEach(li => {
        const contentNodes = [];
        const nestedLists = [];
        Array.from(li.childNodes).forEach(child => {
            if (child.nodeType === Node.ELEMENT_NODE && ['UL', 'OL'].includes(child.tagName.toUpperCase())) nestedLists.push(child);
            else contentNodes.push(child);
        });
        const wrapper = document.createElement('div');
        contentNodes.forEach(node => wrapper.appendChild(node.cloneNode(true)));
        children.push(paragraphFromElement(wrapper, ordered
            ? { numbering: { reference: 'md-numbering', level } }
            : { bullet: { level } }
        ));
        nestedLists.forEach(nested => children.push(...buildWordList(nested, nested.tagName.toUpperCase() === 'OL', level + 1)));
    });
    return children;
}
function buildWordContent(nodes, context = {}) {
    const { Paragraph, PageBreak } = docx;
    const children = [];
    nodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = normalizeWordText(node.textContent).trim();
            if (text) children.push(new Paragraph({ children: [new docx.TextRun(text)] }));
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const tag = node.tagName.toUpperCase();
        if (/^H[1-6]$/.test(tag)) {
            children.push(paragraphFromElement(node, { heading: headingLevelFromTag(tag), spacing: { before: 240, after: 120, line: 360 } }));
            return;
        }
        if (tag === 'P') { children.push(paragraphFromElement(node)); return; }
        if (tag === 'BLOCKQUOTE') {
            Array.from(node.querySelectorAll('p')).forEach(p => children.push(paragraphFromElement(p, { blockquote: true })));
            if (!node.querySelector('p')) children.push(paragraphFromElement(node, { blockquote: true }));
            return;
        }
        if (tag === 'PRE') { children.push(paragraphFromElement(node, { codeBlock: true })); return; }
        if (tag === 'DIV' && node.classList.contains('code-block-wrapper')) {
            const pre = node.querySelector('pre');
            if (pre) children.push(paragraphFromElement(pre, { codeBlock: true }));
            return;
        }
        if (tag === 'UL' || tag === 'OL') { children.push(...buildWordList(node, tag === 'OL')); return; }
        if (tag === 'TABLE') { children.push(buildWordTable(node)); return; }
        if (tag === 'HR') { children.push(new Paragraph({ thematicBreak: true, spacing: { before: 200, after: 200 } })); return; }
        if (tag === 'DIV' && /page-break-after\s*:\s*always/i.test(node.getAttribute('style') || '')) {
            children.push(new Paragraph({ children: [new PageBreak()] }));
            return;
        }
        if (tag === 'IMG') {
            const wrapper = document.createElement('p');
            wrapper.appendChild(node.cloneNode(true));
            children.push(paragraphFromElement(wrapper, { center: true }));
            return;
        }
        children.push(...buildWordContent(Array.from(node.childNodes), context));
    });
    return children;
}
async function exportWordDocument(filename) {
    if (typeof docx === 'undefined') throw new Error('docx library not loaded');
    const { Document, Packer } = docx;
    const snapshot = await createExportSnapshot();
    const exportWrapper = snapshot.exportWrapper;
    try {
        const bodyChildren = buildWordContent(Array.from(snapshot.exportEl.childNodes));
        const document = new Document({
            numbering: {
                config: [{
                    reference: 'md-numbering',
                    levels: Array.from({ length: 6 }, (_, level) => ({
                        level,
                        format: 'decimal',
                        text: `%${level + 1}.`,
                        alignment: 'start',
                        style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
                    })),
                }],
            },
            sections: [{
                properties: {},
                children: bodyChildren.length ? bodyChildren : [new docx.Paragraph('')],
            }],
        });
        return await Packer.toBlob(document);
    } finally {
        if (exportWrapper && exportWrapper.parentNode) document.body.removeChild(exportWrapper);
    }
}

// ========== PDF 匯出 ==========
exportPdfBtn.addEventListener('click', async () => {
    const filename    = (document.getElementById('pdf-filename').value.trim() || 'Document') + '.pdf';
    const orientation = document.querySelector('input[name="pdf-orient"]:checked')?.value || 'portrait';
    const marginVal   = parseInt(document.querySelector('input[name="pdf-margin"]:checked')?.value || '15');
    const format      = document.querySelector('input[name="pdf-size"]:checked')?.value || 'a4';
    exportPdfBtn.disabled = true;
    exportPdfBtn.textContent = '匯出中...';
    statusText.textContent = '正在產生 PDF...';
    const pdfBtnHtml = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> 匯出 PDF`;
    const fmtW = { a4: 210, letter: 215.9, a3: 297 };
    const fmtH = { a4: 297, letter: 279.4, a3: 420 };
    const pageWidthMM   = orientation === 'landscape' ? (fmtH[format] || 297) : (fmtW[format] || 210);
    const contentWidthPx = Math.floor((pageWidthMM - marginVal * 2) * 96 / 25.4);
    let exportWrapper = null;
    try {
        const snapshot = await createExportSnapshot(contentWidthPx);
        exportWrapper = snapshot.exportWrapper;
        const exportEl = snapshot.exportEl;
        exportEl.querySelectorAll('h1, h2, h3, h4, h5, h6, blockquote, .code-block-wrapper, table, .mermaid-wrapper').forEach(el => {
            el.style.pageBreakInside = 'avoid';
            el.style.breakInside = 'avoid';
        });
        exportEl.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(el => {
            el.style.pageBreakAfter = 'avoid';
            el.style.breakAfter = 'avoid';
        });
        const opt = {
            margin:      [marginVal, marginVal, marginVal, marginVal],
            filename,
            image:       { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, letterRendering: true, backgroundColor: '#ffffff', logging: false },
            jsPDF:       { unit: 'mm', format, orientation },
            pagebreak:   { mode: ['css', 'legacy'], avoid: ['.code-block-wrapper', 'table', '.mermaid-wrapper', 'blockquote'] }
        };
        const pdfBlob = await html2pdf().set(opt).from(exportEl).outputPdf('blob');
        await downloadBlob(pdfBlob, filename);
        pdfPanel.classList.remove('open');
        showSaveToast('PDF 匯出完成');
    } catch(err) {
        console.error('PDF 匯出失敗:', err);
        showSaveToast('匯出失敗');
    } finally {
        if (exportWrapper && exportWrapper.parentNode) document.body.removeChild(exportWrapper);
        exportPdfBtn.disabled = false;
        exportPdfBtn.innerHTML = pdfBtnHtml;
    }
});

// ========== Word 匯出 ==========
document.getElementById('exportWordBtn').addEventListener('click', async () => {
    if (typeof docx === 'undefined') { alert('docx 尚未載入'); return; }
    const defaultName = (statFile.textContent && statFile.textContent !== '未開啟檔案')
        ? statFile.textContent.replace(/\.[^.]+$/, '') : 'Document';
    const filename = defaultName.trim() || 'Document';
    const wordBtn = document.getElementById('exportWordBtn');
    wordBtn.disabled = true;
    wordBtn.textContent = '匯出中...';
    statusText.textContent = '正在產生 Word...';
    try {
        const docxBlob = await exportWordDocument(filename);
        await downloadBlob(docxBlob, filename + '.docx');
        showSaveToast('Word 匯出完成');
    } catch(err) {
        console.error('Word 匯出失敗:', err);
        showSaveToast('Word 匯出失敗');
    } finally {
        wordBtn.disabled = false;
        wordBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> 匯出 Word`;
    }
});

// ========== 圖片貼上 ==========
async function handlePasteImage() {
    if (!currentFilePath) {
        alert('請先儲存檔案（Cmd+S），才能貼上圖片到 assets 資料夾。');
        return;
    }
    let base64 = null;
    let ext = 'png';
    // 嘗試 navigator.clipboard.read() (Clipboard API)
    try {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
            const imageType = item.types.find(t => t.startsWith('image/'));
            if (!imageType) continue;
            const blob = await item.getType(imageType);
            ext = imageType === 'image/png' ? 'png' : (imageType === 'image/jpeg' ? 'jpg' : 'png');
            const reader = new FileReader();
            base64 = await new Promise((resolve, reject) => {
                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            break;
        }
    } catch (e) {
        console.log('Clipboard API 失敗，改用 Electron clipboard:', e.message);
    }
    // Fallback: Electron clipboard.readImage
    if (!base64) {
        try {
            const result = await window.electronAPI.readClipboardImage();
            if (result.hasImage) {
                base64 = result.base64;
                ext = 'png';
            }
        } catch (e) {
            console.error('Electron clipboard 讀取失敗:', e);
        }
    }
    if (!base64) {
        alert('剪貼簿中沒有圖片。');
        return;
    }
    try {
        const suggestedName = `paste-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.${ext}`;
        const result = await window.electronAPI.saveImageToAssets(currentFilePath, base64, suggestedName);
        if (result.success) {
            const mdText = `![${suggestedName.replace(/\.[^.]+$/, '')}](${result.relativePath})`;
            const pos = editor.selectionEnd;
            editor.setRangeText('\n' + mdText + '\n', pos, pos, 'end');
            editor.focus();
            updatePreview();
            setModified(true);
            showSaveToast('圖片已貼上至 assets/');
        } else {
            alert('圖片儲存失敗: ' + result.error);
        }
    } catch (e) {
        console.error('貼上圖片失敗:', e);
        alert('貼上圖片失敗: ' + e.message);
    }
}

editor.addEventListener('paste', async (e) => {
    // 檢查是否有純圖片貼上（沒有文字）
    const items = e.clipboardData?.items;
    if (!items) return;
    let hasImage = false;
    let hasText = false;
    for (const item of items) {
        if (item.type.startsWith('image/')) hasImage = true;
        if (item.type === 'text/plain' || item.type === 'text/html') hasText = true;
    }
    // 如果有文字也有圖片，或只有文字，不做攔截，讓瀏覽器正常貼上
    // 如果只有圖片，自動存到 assets
    if (hasImage && !hasText) {
        e.preventDefault();
        await handlePasteImage();
    }
});

// ========== 拖放開啟檔案 ==========
document.addEventListener('dragover', e => {
    e.preventDefault();
    dragOverlay.classList.add('active');
});
document.addEventListener('dragleave', e => {
    if (e.target === dragOverlay) dragOverlay.classList.remove('active');
});
document.addEventListener('drop', async e => {
    e.preventDefault();
    dragOverlay.classList.remove('active');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const fp = files[0].path;
        if (fp) await openFile(fp);
    }
});

// ========== 儲存提示 ==========
function showSaveToast(msg = '已儲存') {
    statusText.textContent = msg;
    statusText.classList.add('save-toast');
    statusText.addEventListener('animationend', () => {
        statusText.classList.remove('save-toast');
        statusText.textContent = '就緒';
    }, { once: true });
}

// ========== 初始化 ==========
setViewMode(localStorage.getItem(LS_VIEW) || 'split');
ensureAtLeastOneTab();
refreshActiveTabView();

// ========== IPC 事件綁定 ==========
window.electronAPI.onOpenFile(async (filePath) => {
    await openFile(filePath);
});
window.electronAPI.onMenuNewFile(() => newFile());
window.electronAPI.onMenuSave(() => saveCurrentFile());
window.electronAPI.onMenuSaveAs(() => saveAsNewFile());
window.electronAPI.onMenuPasteImage(() => handlePasteImage());
window.electronAPI.onMenuExportPdf(() => openPdfPanelBtn.click());
window.electronAPI.onMenuExportWord(() => document.getElementById('exportWordBtn').click());
window.electronAPI.onMenuExportExcel(() => exportExcelBtn.click());
window.electronAPI.onSetViewMode(mode => setViewMode(mode));
window.electronAPI.onFontSizeChange(delta => {
    const newSize = fontSize + delta;
    if (newSize >= 10 && newSize <= 22) { fontSize = newSize; applyFontSize(); }
});
window.electronAPI.onWatchedFileChanged(async ({ filePath }) => {
    const tab = tabs.find(item => item.filePath === filePath);
    if (!tab) return;
    if (Date.now() < suppressWatchReloadUntil) return;
    tab.externalChanged = true;
    if (tab.id === activeTabId) {
        await reloadCurrentFileFromDisk({ notify: true });
    } else {
        renderTabs();
        showSaveToast(`${tab.title} 已在外部更新`);
    }
});

// 嘗試載入最近檔案列表（側邊欄提示用，可擴展）
(async () => {
    const recent = await window.electronAPI.getRecentFiles();
    if (recent && recent.length > 0) {
        // 可選：顯示在最近開啟選單中
    }
})();
