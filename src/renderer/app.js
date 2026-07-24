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
const lineNumbers    = document.getElementById('line-numbers');
const mdToolbar      = document.getElementById('md-toolbar');
const previewContent = document.getElementById('preview-content');
const previewWrapper = document.getElementById('preview-wrapper');
const vditorHost     = document.getElementById('vditor-host');
const exportPdfBtn   = document.getElementById('exportPdfBtn');
const openPdfPanelBtn= document.getElementById('openPdfPanelBtn');
const pdfPanel       = document.getElementById('pdf-panel');
const pdfDialog      = document.getElementById('pdf-dialog');
const pdfFilename    = document.getElementById('pdf-filename');
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
const exportWordBtn  = document.getElementById('exportWordBtn');
const editorPanel    = document.getElementById('editor-panel');
const previewPanel   = document.getElementById('preview-panel');
const dragOverlay    = document.getElementById('drag-overlay');
const tabsList       = document.getElementById('tabs-list');
const newTabBtn      = document.getElementById('newTabBtn');
const sidebarFolderName = document.getElementById('sidebarFolderName');
const sidebarFolderPath = document.getElementById('sidebarFolderPath');
const openFolderBtn  = document.getElementById('openFolderBtn');
const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
const recentFilesList = document.getElementById('recentFilesList');
const recentFoldersList = document.getElementById('recentFoldersList');
const gitPanel = document.getElementById('gitPanel');
const gitFloatingOverlay = document.getElementById('gitFloatingOverlay');
const gitFloatingPanel = document.getElementById('gitFloatingPanel');
const gitFloatingBody = document.getElementById('gitFloatingBody');
const gitFloatingSubtitle = document.getElementById('gitFloatingSubtitle');
const gitFloatingCloseBtn = document.getElementById('gitFloatingCloseBtn');
const folderTree     = document.getElementById('folderTree');
const editorModeLabel = document.getElementById('editorModeLabel');
const previewModeLabel = document.getElementById('previewModeLabel');
const readonlyOverlay = document.getElementById('readonlyOverlay');
const terminalDrawer = document.getElementById('terminal-drawer');
const terminalWidthHandle = document.getElementById('terminal-width-handle');
const terminalMount = document.getElementById('terminalMount');
const terminalFocusBtn = document.getElementById('terminalFocusBtn');
const terminalRestartBtn = document.getElementById('terminalRestartBtn');
const terminalClearBtn = document.getElementById('terminalClearBtn');
const terminalCloseBtn = document.getElementById('terminalCloseBtn');
const terminalStatusText = document.getElementById('terminalStatusText');
const terminalCwdText = document.getElementById('terminalCwdText');
const terminalErrorBanner = document.getElementById('terminalErrorBanner');
const terminalCdBtn = document.getElementById('terminalCdBtn');
const terminalInsertFileBtn = document.getElementById('terminalInsertFileBtn');
const terminalInsertDirBtn = document.getElementById('terminalInsertDirBtn');
const terminalCodexBtn = document.getElementById('terminalCodexBtn');
const terminalPiBtn = document.getElementById('terminalPiBtn');

// 搜尋與取代 DOM
const searchPanel        = document.getElementById('search-panel');
const searchInput        = document.getElementById('search-input');
const searchToggleReplace= document.getElementById('search-toggle-replace');
const searchReplaceArrow = document.getElementById('search-replace-arrow');
const searchCaseSensitive= document.getElementById('search-case-sensitive');
const searchWholeWord    = document.getElementById('search-whole-word');
const searchRegex        = document.getElementById('search-regex');
const searchResultsCount = document.getElementById('search-results-count');
const searchPrevBtn      = document.getElementById('search-prev');
const searchNextBtn      = document.getElementById('search-next');
const searchCloseBtn     = document.getElementById('search-close');
const replaceRow         = document.getElementById('replace-row');
const replaceInput       = document.getElementById('replace-input');
const replaceBtn         = document.getElementById('replace-btn');
const replaceAllBtn      = document.getElementById('replace-all-btn');
const highlightContent   = document.querySelector('.highlight-content');

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
let appPaths = null;
let terminal = null;
let terminalFitAddon = null;
let terminalReady = false;
let terminalStarting = false;
let terminalVisible = false;
let terminalStatus = { running: false, cwd: null, error: null };
let panelWidths = { editor: 50, preview: 25, terminal: 25 };
let isTerminalWidthResizing = false;
let vditorInstance = null;
let vditorInitPromise = null;
let suppressVditorInput = false;
let vditorPasteBound = false;
let vditorResolveTimer = null;
let markdownPreviewRenderSeq = 0;
let pdfPanelOpener = null;
let currentFolderPath = null;
let recentFilesState = [];
let recentFolders = [];
let gitState = {
    loading: false,
    available: true,
    isRepo: false,
    targetDir: null,
    repoRoot: null,
    repoName: null,
    branch: null,
    changedFiles: 0,
    stagedFiles: 0,
    unstagedFiles: 0,
    untrackedFiles: 0,
    insertions: 0,
    deletions: 0,
    ahead: 0,
    behind: 0,
    files: [],
    error: '',
};
let gitFloatingOpen = false;
let selectedSidebarPath = null;
let sidebarCollapsed = false;
const treeState = {
    expanded: new Set(),
    loaded: new Map(),
};
const LS_SIDEBAR_COLLAPSED = 'md_sidebar_collapsed';
const LS_SIDEBAR_SECTIONS = 'md_sidebar_sections';
let sidebarSections = {
    'recent-files': true,
    'recent-folders': true,
    'git-panel': true,
    'folder-tree': true,
};

const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown', 'mdown', 'mkd', 'mkdn']);
const TEXT_EXTENSIONS = new Set(['txt']);
const CSV_EXTENSIONS = new Set(['csv']);
const PDF_EXTENSIONS = new Set(['pdf']);
const SUPPORTED_FILE_EXTENSIONS = new Set([...MARKDOWN_EXTENSIONS, ...TEXT_EXTENSIONS, ...CSV_EXTENSIONS, ...PDF_EXTENSIONS]);
const VDITOR_CDN = 'https://cdn.jsdelivr.net/npm/vditor@3.11.2';
const VDITOR_TOOLBAR = ['bold', 'italic', 'strike', '|', 'quote', 'list', 'ordered-list', '|', 'inline-code', 'code', '|', 'link', 'table', '|', 'undo', 'redo'];

// 搜尋狀態
let searchMatches = [];
let activeSearchIndex = -1;

function scheduleAutoSave() {}

function shellEscape(value) {
    return `'${String(value || '').replace(/'/g, `'\\''`)}'`;
}

function getFileExt(filePath = '') {
    const base = pathBasename(String(filePath));
    const idx = base.lastIndexOf('.');
    if (idx <= 0 || idx === base.length - 1) return '';
    return base.slice(idx + 1).toLowerCase();
}

function getFileTypeFromExt(ext = '') {
    if (CSV_EXTENSIONS.has(ext)) return 'csv';
    if (PDF_EXTENSIONS.has(ext)) return 'pdf';
    if (TEXT_EXTENSIONS.has(ext)) return 'text';
    return 'markdown';
}

function supportsFileExtension(ext = '') {
    return SUPPORTED_FILE_EXTENSIONS.has(ext);
}

function isPdfTab(tab = getActiveTab()) {
    return tab?.fileType === 'pdf';
}

function isTextLikeTab(tab = getActiveTab()) {
    return ['markdown', 'text', 'csv'].includes(tab?.fileType || currentFileType);
}

function isTerminalFocused() {
    const active = document.activeElement;
    return Boolean(active && terminalMount.contains(active));
}

function isMarkdownTab(tab = getActiveTab()) {
    return (tab?.fileType || currentFileType) === 'markdown';
}

function shouldUseVditorPreview(tab = getActiveTab()) {
    // In split view, Vditor would create a second contenteditable editor in
    // the preview pane. Its asynchronous setup can take focus away from the
    // textarea, so reserve it for preview-only mode where it is intentional.
    return isMarkdownTab(tab) && visiblePanels.has('preview') && !visiblePanels.has('editor');
}

function isVditorActive() {
    return shouldUseVditorPreview() && !vditorHost.classList.contains('hidden');
}

function focusEditingSurface() {
    if (currentFileType === 'pdf' || pdfPanel.classList.contains('open')) return;
    requestAnimationFrame(() => {
        if (currentFileType === 'pdf' || pdfPanel.classList.contains('open')) return;
        if (visiblePanels.has('editor')) {
            editor.focus({ preventScroll: true });
        } else if (isVditorActive()) {
            vditorInstance?.focus();
        }
    });
}

function getVditorThemeName() {
    return document.documentElement.getAttribute('data-theme') === 'github-dark' ? 'dark' : 'classic';
}

function updatePreviewSurfaceVisibility(useVditor) {
    previewWrapper.classList.toggle('vditor-active', useVditor);
    previewContent.classList.toggle('hidden', useVditor);
    vditorHost.classList.toggle('hidden', !useVditor);
    vditorHost.classList.toggle('active', useVditor);
}

function scheduleResolveVditorImages() {
    clearTimeout(vditorResolveTimer);
    vditorResolveTimer = setTimeout(() => {
        if (!vditorInstance) return;
        resolveImages(vditorHost).catch(err => console.warn('Vditor 圖片解析失敗:', err));
    }, 60);
}

function getTerminalContextForTab(tab = getActiveTab()) {
    const fallbackDir = appPaths?.documents || null;
    return {
        filePath: tab?.filePath || null,
        dirPath: tab?.dirPath || fallbackDir,
        fileType: tab?.fileType || null,
    };
}

function getTerminalWorkingDir() {
    const context = getTerminalContextForTab();
    return context.dirPath || appPaths?.documents || null;
}

function setTerminalError(message = '') {
    if (!message) {
        terminalErrorBanner.textContent = '';
        terminalErrorBanner.classList.add('hidden');
        return;
    }
    terminalErrorBanner.textContent = message;
    terminalErrorBanner.classList.remove('hidden');
}

function updateTerminalActionButtons() {
    const tab = getActiveTab();
    const hasFile = Boolean(tab?.filePath);
    const hasDir = Boolean(tab?.dirPath || appPaths?.documents);
    terminalCdBtn.disabled = !hasDir;
    terminalInsertDirBtn.disabled = !hasDir;
    terminalInsertFileBtn.disabled = !hasFile;
    terminalCodexBtn.disabled = !hasFile;
    terminalPiBtn.disabled = !hasFile;
}

function renderTerminalStatus(meta = {}) {
    const { running = terminalStatus.running, cwd = terminalStatus.cwd, shell = terminalStatus.shell, error = terminalStatus.error } = meta;
    terminalStatus = { ...terminalStatus, running, cwd, shell, error };
    terminalStatusText.textContent = error
        ? `錯誤: ${error}`
        : running
            ? (shell ? `執行中 · ${shell}` : '執行中')
            : '未啟動';
    terminalCwdText.textContent = cwd || getTerminalWorkingDir() || '-';
}

function syncTerminalContext() {
    updateTerminalActionButtons();
    return window.electronAPI.terminalUpdateContext(getTerminalContextForTab());
}

function createTabState(overrides = {}) {
    return {
        id: `tab-${nextTabId++}`,
        filePath: null,
        dirPath: null,
        fileType: 'markdown',
        fileExt: '',
        isModified: false,
        content: '',
        previewMeta: null,
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

function normalizePath(value = '') {
    return String(value).replace(/\\/g, '/');
}

function isPathInsideFolder(targetPath, folderPath) {
    if (!targetPath || !folderPath) return false;
    const target = normalizePath(targetPath);
    const folder = normalizePath(folderPath).replace(/\/+$/, '');
    return target === folder || target.startsWith(folder + '/');
}

function setSidebarSelection(filePath) {
    selectedSidebarPath = filePath || null;
    renderSidebar();
}

function formatSidebarLabel(filePath) {
    return pathBasename(filePath || '') || filePath || '未命名';
}

function getSidebarItemClass(active) {
    return active ? 'sidebar-item active' : 'sidebar-item';
}

function getFileIconSvg(ext = '') {
    const tone = CSV_EXTENSIONS.has(ext)
        ? 'csv'
        : TEXT_EXTENSIONS.has(ext)
            ? 'text'
            : PDF_EXTENSIONS.has(ext)
                ? 'pdf'
                : 'markdown';
    return `
        <span class="file-icon file-icon-${tone}" aria-hidden="true">
            <svg viewBox="0 0 24 24" class="file-icon-svg">
                <path d="M7 3.5h7l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 20V5A1.5 1.5 0 0 1 7.5 3.5Z" class="file-icon-paper"></path>
                <path d="M14 3.5v5h5" class="file-icon-fold"></path>
                <path d="M8.6 15.3h6.8" class="file-icon-line"></path>
                <path d="M8.6 18h5.2" class="file-icon-line"></path>
            </svg>
        </span>
    `;
}

function getFolderIconSvg(isOpen = false) {
    return `
        <span class="folder-icon ${isOpen ? 'open' : ''}" aria-hidden="true">
            <svg viewBox="0 0 24 24" class="folder-icon-svg">
                <path d="M3.5 7.8A2.3 2.3 0 0 1 5.8 5.5h4l1.7 1.9h6.7a2.3 2.3 0 0 1 2.3 2.3v1.1H3.5Z" class="folder-icon-tab"></path>
                <path d="M3.5 10h17l-1.6 7.7a2.3 2.3 0 0 1-2.2 1.8H6.2A2.3 2.3 0 0 1 4 17.6Z" class="folder-icon-body"></path>
            </svg>
        </span>
    `;
}

function getRecentDisplayList(list) {
    return Array.isArray(list) ? list.slice(0, 5) : [];
}

function restoreSidebarState() {
    sidebarCollapsed = localStorage.getItem(LS_SIDEBAR_COLLAPSED) === '1';
    try {
        const parsed = JSON.parse(localStorage.getItem(LS_SIDEBAR_SECTIONS) || '{}');
        sidebarSections = {
            ...sidebarSections,
            ...parsed,
        };
    } catch (e) {}
}

function saveSidebarSectionState() {
    localStorage.setItem(LS_SIDEBAR_SECTIONS, JSON.stringify(sidebarSections));
}

function applySidebarChrome() {
    const sidebar = document.getElementById('sidebar');
    sidebar?.classList.toggle('collapsed', sidebarCollapsed);
    if (toggleSidebarBtn) toggleSidebarBtn.textContent = sidebarCollapsed ? '▸' : '◂';
    localStorage.setItem(LS_SIDEBAR_COLLAPSED, sidebarCollapsed ? '1' : '0');
    document.querySelectorAll('[data-section]').forEach(section => {
        const key = section.dataset.section;
        const open = sidebarSections[key] !== false;
        section.classList.toggle('collapsed', !open);
    });
}

function toggleSidebarSection(key) {
    sidebarSections[key] = sidebarSections[key] === false;
    saveSidebarSectionState();
    applySidebarChrome();
}

function enableDragScroll(container) {
    if (!container || container.dataset.dragScrollBound === '1') return;
    container.dataset.dragScrollBound = '1';
    let isDragging = false;
    let moved = false;
    let startY = 0;
    let startScroll = 0;
    let pointerId = null;
    container.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        isDragging = true;
        moved = false;
        pointerId = event.pointerId;
        startY = event.clientY;
        startScroll = container.scrollTop;
    });
    container.addEventListener('pointermove', (event) => {
        if (!isDragging || event.pointerId !== pointerId) return;
        const delta = event.clientY - startY;
        if (!moved && Math.abs(delta) < 6) return;
        if (!moved) {
            moved = true;
            container.classList.add('drag-scrolling');
            container.setPointerCapture?.(event.pointerId);
        }
        container.scrollTop = startScroll - delta;
    });
    const stopDrag = (event) => {
        if (!isDragging || event.pointerId !== pointerId) return;
        isDragging = false;
        moved = false;
        pointerId = null;
        container.classList.remove('drag-scrolling');
        container.releasePointerCapture?.(event.pointerId);
    };
    container.addEventListener('pointerup', stopDrag);
    container.addEventListener('pointercancel', stopDrag);
    container.addEventListener('mouseleave', () => {
        if (!isDragging) return;
        isDragging = false;
        container.classList.remove('drag-scrolling');
    });
}

async function ensureTreeLoaded(dirPath) {
    if (!dirPath || treeState.loaded.has(dirPath)) return treeState.loaded.get(dirPath) || [];
    const result = await window.electronAPI.readDir(dirPath);
    if (!result?.success) {
        treeState.loaded.set(dirPath, []);
        return [];
    }
    const nextEntries = result.list
        .filter(entry => entry.isDirectory || (entry.isFile && supportsFileExtension(getFileExt(entry.name))))
        .map(entry => ({
            ...entry,
            path: entry.path || null,
        }));
    treeState.loaded.set(dirPath, nextEntries);
    return nextEntries;
}

async function loadDirectoryEntries(dirPath) {
    const entries = await ensureTreeLoaded(dirPath);
    return entries.map(entry => ({
        ...entry,
        path: entry.path || `${dirPath.replace(/[\\/]$/, '')}/${entry.name}`.replace(/\\/g, '/'),
    }));
}

function renderRecentFileItems(list, container, emptyText, onClick) {
    if (!container) return;
    const visibleList = getRecentDisplayList(list);
    if (!visibleList.length) {
        container.innerHTML = `<div class="sidebar-empty">${emptyText}</div>`;
        return;
    }
    container.innerHTML = '';
    visibleList.forEach(filePath => {
        const button = document.createElement('button');
        const active = selectedSidebarPath === filePath || currentFilePath === filePath;
        button.className = getSidebarItemClass(active);
        button.type = 'button';
        button.innerHTML = `
            <span class="sidebar-item-icon">${getFileIconSvg(getFileExt(filePath))}</span>
            <span class="sidebar-item-text">${escapeHtml(formatSidebarLabel(filePath))}</span>
        `;
        button.title = filePath;
        button.addEventListener('click', () => onClick(filePath));
        container.appendChild(button);
    });
}

function getGitTargetPath() {
    const tab = getActiveTab();
    return currentFolderPath || tab?.filePath || tab?.dirPath || null;
}

function escapeGitPathLabel(filePath = '') {
    const normalized = String(filePath || '').trim();
    return normalized.length > 42 ? `…${normalized.slice(-42)}` : normalized;
}

function getGitBranchMeta() {
    return [
        gitState.ahead > 0 ? `↑${gitState.ahead}` : '',
        gitState.behind > 0 ? `↓${gitState.behind}` : '',
    ].filter(Boolean).join(' ');
}

function getGitActionFlags() {
    const currentTab = getActiveTab();
    return {
        canRestoreCurrent: Boolean(currentTab?.filePath && isPathInsideFolder(currentTab.filePath, gitState.repoRoot)),
        canCommit: gitState.changedFiles > 0,
        canPush: gitState.ahead > 0,
    };
}

function renderGitPanel() {
    if (!gitPanel) return;
    if (gitState.loading) {
        gitPanel.innerHTML = '<div class="sidebar-empty">讀取 Git 狀態中…</div>';
        renderGitFloatingPanel();
        return;
    }
    if (!gitState.targetDir) {
        gitPanel.innerHTML = '<button type="button" class="git-summary-btn" data-git-action="open">Git 尚未連結</button>';
        bindGitPanelActions(gitPanel);
        renderGitFloatingPanel();
        return;
    }
    if (!gitState.available) {
        gitPanel.innerHTML = `<button type="button" class="git-summary-btn" data-git-action="open">${escapeHtml(gitState.error || '系統找不到 Git')}</button>`;
        bindGitPanelActions(gitPanel);
        renderGitFloatingPanel();
        return;
    }
    if (!gitState.isRepo) {
        gitPanel.innerHTML = `
            <button type="button" class="git-summary-btn" data-git-action="open">
                <span>
                    <strong>尚未啟用 Git</strong>
                    <small>${escapeHtml(escapeGitPathLabel(gitState.targetDir))}</small>
                </span>
                <span class="git-summary-pill">初始化</span>
            </button>
        `;
        bindGitPanelActions(gitPanel);
        renderGitFloatingPanel();
        return;
    }

    const branchMeta = getGitBranchMeta();
    gitPanel.innerHTML = `
        <button type="button" class="git-summary-btn" data-git-action="open">
            <span>
                <strong>${escapeHtml(gitState.repoName || 'Git 倉庫')}</strong>
                <small>${escapeHtml(gitState.branch || 'HEAD')}${branchMeta ? ` · ${escapeHtml(branchMeta)}` : ''}</small>
            </span>
            <span class="git-summary-stats">
                <span class="add">+${gitState.insertions}</span>
                <span class="del">-${gitState.deletions}</span>
                <span>${gitState.changedFiles} 檔</span>
            </span>
        </button>
    `;
    bindGitPanelActions(gitPanel);
    renderGitFloatingPanel();
}

function renderGitFloatingPanel() {
    if (!gitFloatingBody || !gitFloatingSubtitle) return;
    const location = gitState.repoRoot || gitState.targetDir || '未選擇資料夾';
    gitFloatingSubtitle.textContent = location;

    if (gitState.loading) {
        gitFloatingBody.innerHTML = '<div class="sidebar-empty">讀取 Git 狀態中…</div>';
        return;
    }
    if (!gitState.targetDir) {
        gitFloatingBody.innerHTML = '<div class="sidebar-empty">開啟資料夾或檔案後，這裡會顯示 Git 狀態。</div>';
        return;
    }
    if (!gitState.available) {
        gitFloatingBody.innerHTML = `<div class="sidebar-empty">${escapeHtml(gitState.error || '系統找不到 Git')}</div>`;
        return;
    }
    if (!gitState.isRepo) {
        gitFloatingBody.innerHTML = `
            <div class="git-card git-card-floating">
                <div class="git-card-head">
                    <div class="git-card-title">尚未啟用 Git</div>
                </div>
                <div class="git-empty-copy">這個資料夾目前不是 Git 倉庫。若你想用 Git 管理回復，可以直接初始化。</div>
                <div class="git-card-row">
                    <span class="git-card-label">位置</span>
                    <span class="git-card-value" title="${escapeHtml(gitState.targetDir)}">${escapeHtml(escapeGitPathLabel(gitState.targetDir))}</span>
                </div>
                <div class="git-card-actions">
                    <button type="button" class="git-action-btn primary" data-git-action="init">初始化 Git</button>
                    <button type="button" class="git-action-btn" data-git-action="refresh">重新整理</button>
                </div>
            </div>
        `;
        bindGitPanelActions(gitFloatingBody);
        return;
    }

    const branchMeta = getGitBranchMeta();
    const fileItems = Array.isArray(gitState.files) && gitState.files.length
        ? `<ol class="git-file-list">${gitState.files.map(item => `<li>${escapeHtml(item.path)}</li>`).join('')}</ol>`
        : '<div class="git-empty-copy">目前工作樹乾淨。</div>';
    const { canRestoreCurrent, canCommit, canPush } = getGitActionFlags();

    gitFloatingBody.innerHTML = `
        <div class="git-card git-card-floating">
            <div class="git-card-head">
                <div>
                    <div class="git-card-title">${escapeHtml(gitState.repoName || 'Git 倉庫')}</div>
                    <div class="git-card-subtitle" title="${escapeHtml(gitState.repoRoot || '')}">${escapeHtml(escapeGitPathLabel(gitState.repoRoot || ''))}</div>
                </div>
                <div class="git-diff-total">
                    <span class="add">+${gitState.insertions}</span>
                    <span class="del">-${gitState.deletions}</span>
                </div>
            </div>
            <div class="git-branch-row">
                <span class="git-branch-pill">⑂ ${escapeHtml(gitState.branch || 'HEAD')}</span>
                <span class="git-card-value">${branchMeta || '本機'}</span>
            </div>
            <div class="git-card-row">
                <span class="git-card-label">變更</span>
                <span class="git-card-value">${gitState.changedFiles} 檔</span>
            </div>
            <div class="git-card-row">
                <span class="git-card-label">狀態</span>
                <span class="git-card-value">staged ${gitState.stagedFiles} / unstaged ${gitState.unstagedFiles} / untracked ${gitState.untrackedFiles}</span>
            </div>
            ${fileItems}
            <div class="git-card-actions">
                <button type="button" class="git-action-btn" data-git-action="refresh">重新整理</button>
                <button type="button" class="git-action-btn danger" data-git-action="restore-file" ${canRestoreCurrent ? '' : 'disabled'}>回復目前檔案</button>
                <button type="button" class="git-action-btn danger" data-git-action="restore-all" ${gitState.changedFiles ? '' : 'disabled'}>全部回復</button>
                <button type="button" class="git-action-btn primary" data-git-action="commit" ${canCommit ? '' : 'disabled'}>送交</button>
                <button type="button" class="git-action-btn" data-git-action="push" ${canPush ? '' : 'disabled'}>推送</button>
            </div>
        </div>
    `;
    bindGitPanelActions(gitFloatingBody);
}

function openGitFloatingPanel() {
    gitFloatingOpen = true;
    renderGitFloatingPanel();
    gitFloatingOverlay?.classList.remove('hidden');
}

function closeGitFloatingPanel() {
    gitFloatingOpen = false;
    gitFloatingOverlay?.classList.add('hidden');
}

async function refreshGitState(options = {}) {
    if (!gitPanel) return;
    const { quiet = false } = options;
    const targetPath = getGitTargetPath();
    gitState = {
        ...gitState,
        loading: true,
        targetDir: targetPath ? (currentFolderPath || getActiveTab()?.dirPath || targetPath) : null,
        error: '',
    };
    renderGitPanel();
    const result = targetPath
        ? await window.electronAPI.gitGetContext(targetPath)
        : { success: true, available: true, isRepo: false, targetDir: null };
    if (!result?.success && !quiet) {
        showSaveToast(result?.error || '讀取 Git 狀態失敗');
    }
    gitState = {
        loading: false,
        available: result?.available !== false,
        isRepo: Boolean(result?.isRepo),
        targetDir: result?.targetDir || getGitTargetPath(),
        repoRoot: result?.repoRoot || null,
        repoName: result?.repoName || null,
        branch: result?.branch || null,
        changedFiles: result?.changedFiles || 0,
        stagedFiles: result?.stagedFiles || 0,
        unstagedFiles: result?.unstagedFiles || 0,
        untrackedFiles: result?.untrackedFiles || 0,
        insertions: result?.insertions || 0,
        deletions: result?.deletions || 0,
        ahead: result?.ahead || 0,
        behind: result?.behind || 0,
        files: Array.isArray(result?.files) ? result.files : [],
        error: result?.error || '',
    };
    renderGitPanel();
}

async function gitInitCurrentTarget() {
    const targetPath = getGitTargetPath();
    if (!targetPath) return;
    if (!confirm('這個資料夾尚未啟用 Git，要現在初始化嗎？')) return;
    const result = await window.electronAPI.gitInitRepo(targetPath);
    if (!result?.success) {
        showSaveToast(result?.error || 'Git 初始化失敗');
        return;
    }
    showSaveToast('已初始化 Git 倉庫');
    await refreshGitState();
}

async function gitCommitCurrentRepo() {
    if (!gitState.isRepo || !gitState.repoRoot) return;
    const message = (prompt('輸入 commit 訊息', 'chore: update notes') || '').trim();
    if (!message) return;
    const result = await window.electronAPI.gitCommit(gitState.repoRoot, message);
    if (!result?.success) {
        showSaveToast(result?.error || 'Git 送交失敗');
        return;
    }
    showSaveToast('已送交變更');
    await refreshGitState();
}

async function gitPushCurrentRepo() {
    if (!gitState.isRepo || !gitState.repoRoot) return;
    const result = await window.electronAPI.gitPush(gitState.repoRoot);
    if (!result?.success) {
        showSaveToast(result?.error || 'Git 推送失敗');
        return;
    }
    showSaveToast('已推送');
    await refreshGitState();
}

async function gitRestoreCurrentFile() {
    const tab = getActiveTab();
    if (!gitState.isRepo || !gitState.repoRoot || !tab?.filePath) return;
    if (!confirm(`要把目前檔案回復到 HEAD 嗎？\n\n${tab.title}`)) return;
    const result = await window.electronAPI.gitRestorePath(gitState.repoRoot, tab.filePath);
    if (!result?.success) {
        showSaveToast(result?.error || 'Git 回復失敗');
        return;
    }
    await reloadTabFromDisk(tab, { notify: false });
    showSaveToast('已回復目前檔案');
    await refreshGitState();
}

async function gitRestoreAllFiles() {
    if (!gitState.isRepo || !gitState.repoRoot) return;
    const warning = '要把整個 Git 倉庫回復到 HEAD 嗎？\n\n這會丟棄尚未提交的已追蹤變更，並清掉未追蹤檔案。';
    if (!confirm(warning)) return;
    const result = await window.electronAPI.gitRestoreAll(gitState.repoRoot);
    if (!result?.success) {
        showSaveToast(result?.error || 'Git 全部回復失敗');
        return;
    }
    for (const tab of tabs) {
        if (!tab.filePath || !isPathInsideFolder(tab.filePath, gitState.repoRoot)) continue;
        await reloadTabFromDisk(tab, { notify: false });
    }
    showSaveToast('已回復整個倉庫');
    await refreshGitState();
}

function bindGitPanelActions(root) {
    if (!root) return;
    root.querySelectorAll('[data-git-action]').forEach(button => {
        button.addEventListener('click', async () => {
            const action = button.dataset.gitAction;
            if (action === 'open') openGitFloatingPanel();
            if (action === 'refresh') await refreshGitState({ quiet: true });
            if (action === 'init') await gitInitCurrentTarget();
            if (action === 'commit') await gitCommitCurrentRepo();
            if (action === 'push') await gitPushCurrentRepo();
            if (action === 'restore-file') await gitRestoreCurrentFile();
            if (action === 'restore-all') await gitRestoreAllFiles();
        });
    });
}

gitFloatingCloseBtn?.addEventListener('click', closeGitFloatingPanel);
gitFloatingOverlay?.addEventListener('click', (event) => {
    if (event.target === gitFloatingOverlay) closeGitFloatingPanel();
});

async function renderTreeNode(dirPath, depth = 0) {
    const entries = await loadDirectoryEntries(dirPath);
    const fragment = document.createDocumentFragment();
    entries.forEach(entry => {
        const row = document.createElement('div');
        row.className = 'tree-node';
        const isExpanded = entry.isDirectory && treeState.expanded.has(entry.path);
        const isActive = selectedSidebarPath === entry.path || currentFilePath === entry.path;
        row.innerHTML = `
            <button class="${getSidebarItemClass(isActive)} tree-item" data-path="${escapeHtml(entry.path)}" data-depth="${depth}" style="--tree-depth:${depth}">
                <span class="tree-caret">${entry.isDirectory ? (isExpanded ? '▾' : '▸') : '•'}</span>
                <span class="sidebar-item-icon">${entry.isDirectory ? getFolderIconSvg(isExpanded) : getFileIconSvg(getFileExt(entry.name))}</span>
                <span class="sidebar-item-text">${escapeHtml(entry.name)}</span>
            </button>
        `;
        fragment.appendChild(row);

        if (entry.isDirectory && isExpanded) {
            const children = document.createElement('div');
            children.className = 'tree-children';
            row.appendChild(children);
            children.appendChild(document.createElement('div'));
        }
    });
    return fragment;
}

async function hydrateExpandedTree() {
    if (!currentFolderPath) {
        folderTree.innerHTML = '<div class="sidebar-empty">尚未開啟資料夾</div>';
        return;
    }
    const entries = await loadDirectoryEntries(currentFolderPath);
    if (!entries.length) {
        folderTree.innerHTML = '<div class="sidebar-empty">資料夾內沒有支援的檔案</div>';
        return;
    }
    folderTree.innerHTML = '';
    const fragment = document.createDocumentFragment();
    for (const entry of entries) {
        const row = document.createElement('div');
        row.className = 'tree-node';
        const isExpanded = entry.isDirectory && treeState.expanded.has(entry.path);
        const isActive = selectedSidebarPath === entry.path || currentFilePath === entry.path;
        const button = document.createElement('button');
        button.className = `${getSidebarItemClass(isActive)} tree-item`;
        button.type = 'button';
        button.dataset.path = entry.path;
        button.style.setProperty('--tree-depth', '0');
        button.innerHTML = `
            <span class="tree-caret">${entry.isDirectory ? (isExpanded ? '▾' : '▸') : '•'}</span>
            <span class="sidebar-item-icon">${entry.isDirectory ? getFolderIconSvg(isExpanded) : getFileIconSvg(getFileExt(entry.name))}</span>
            <span class="sidebar-item-text">${escapeHtml(entry.name)}</span>
        `;
        row.appendChild(button);
        if (entry.isDirectory && isExpanded) {
            const childWrap = document.createElement('div');
            childWrap.className = 'tree-children';
            row.appendChild(childWrap);
            childWrap.appendChild(await buildTreeBranch(entry.path, 1));
        }
        fragment.appendChild(row);
    }
    folderTree.appendChild(fragment);
}

async function buildTreeBranch(dirPath, depth) {
    const wrapper = document.createDocumentFragment();
    const entries = await loadDirectoryEntries(dirPath);
    for (const entry of entries) {
        const row = document.createElement('div');
        row.className = 'tree-node';
        const isExpanded = entry.isDirectory && treeState.expanded.has(entry.path);
        const isActive = selectedSidebarPath === entry.path || currentFilePath === entry.path;
        const button = document.createElement('button');
        button.className = `${getSidebarItemClass(isActive)} tree-item`;
        button.type = 'button';
        button.dataset.path = entry.path;
        button.style.setProperty('--tree-depth', String(depth));
        button.innerHTML = `
            <span class="tree-caret">${entry.isDirectory ? (isExpanded ? '▾' : '▸') : '•'}</span>
            <span class="sidebar-item-icon">${entry.isDirectory ? getFolderIconSvg(isExpanded) : getFileIconSvg(getFileExt(entry.name))}</span>
            <span class="sidebar-item-text">${escapeHtml(entry.name)}</span>
        `;
        row.appendChild(button);
        if (entry.isDirectory && isExpanded) {
            const childWrap = document.createElement('div');
            childWrap.className = 'tree-children';
            row.appendChild(childWrap);
            childWrap.appendChild(await buildTreeBranch(entry.path, depth + 1));
        }
        wrapper.appendChild(row);
    }
    return wrapper;
}

async function renderSidebar() {
    if (sidebarFolderName) sidebarFolderName.textContent = currentFolderPath ? formatSidebarLabel(currentFolderPath) : '未開啟資料夾';
    if (sidebarFolderPath) sidebarFolderPath.textContent = currentFolderPath || '使用 Cmd+Shift+O 或按鈕開啟資料夾';
    renderGitPanel();
    renderRecentFileItems(recentFilesState, recentFilesList, '尚無最近檔案', async (filePath) => {
        await openFile(filePath);
    });
    renderRecentFileItems(recentFolders, recentFoldersList, '尚無最近資料夾', async (folderPath) => {
        await openFolder(folderPath);
    });
    await hydrateExpandedTree();
    applySidebarChrome();
    enableDragScroll(recentFilesList);
    enableDragScroll(recentFoldersList);
    enableDragScroll(folderTree);
}

async function openFolder(folderPath, options = {}) {
    if (!folderPath) return;
    await window.electronAPI.addRecentFolder(folderPath);
    currentFolderPath = folderPath;
    treeState.loaded.clear();
    treeState.expanded.clear();
    treeState.expanded.add(folderPath);
    if (!options.skipRecentRefresh) {
        recentFolders = await window.electronAPI.getRecentFolders();
    }
    recentFilesState = await window.electronAPI.getRecentFiles();
    await renderSidebar();
    await refreshGitState({ quiet: true });
    showSaveToast('已開啟資料夾 ' + formatSidebarLabel(folderPath));
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
    if (tab.fileType === 'pdf') return;
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
    setEditorValue(tab.content, { syncTab: false, syncVditor: false, refreshPreview: false });
    csvEncodingSelect.value = tab.csvEncoding || 'auto';
    statFile.textContent = tab.title;
    updateExportButtons();
    updateEditorModeUI(tab);
    setModified(tab.isModified, { skipTabSync: true, silentTitle: true });
}

function updateEditorModeUI(tab = getActiveTab()) {
    const fileType = tab?.fileType || currentFileType;
    const isPdf = fileType === 'pdf';
    editor.readOnly = isPdf;
    readonlyOverlay.classList.toggle('hidden', !isPdf);
    mdToolbar.classList.toggle('hidden', isPdf || fileType === 'csv' || fileType === 'text');
    lineNumbers.style.display = isPdf ? 'none' : 'block';
    highlightContent.parentElement.style.display = isPdf ? 'none' : 'block';
    editorModeLabel.textContent = fileType === 'pdf'
        ? 'PDF'
        : fileType === 'csv'
            ? 'CSV'
            : fileType === 'text'
                ? '純文字'
                : 'Markdown';
    previewModeLabel.textContent = fileType === 'pdf'
        ? 'PDF 預覽'
        : fileType === 'text'
            ? '文字預覽'
            : fileType === 'csv'
                ? 'CSV 預覽'
                : shouldUseVditorPreview(tab)
                    ? '預覽編輯'
                    : '預覽';
}

function updateEditorSearchMirror() {
    if (!highlightContent) return;
    updateLineNumbers();
    if (!searchPanel.classList.contains('hidden')) {
        scheduleSearch();
        return;
    }
    highlightContent.innerHTML = escapeForHighlight(editor.value) + '\n';
    syncHighlightScroll();
}

function commitEditorContentChange(options = {}) {
    const {
        syncTab = true,
        syncVditor = false,
        refreshPreview = true,
        markModified = false,
        updateStatsOnly = false,
    } = options;
    if (syncTab) syncEditorToActiveTab();
    updateEditorSearchMirror();
    if (syncVditor && shouldUseVditorPreview()) {
        syncVditorFromEditor();
    }
    if (refreshPreview) {
        void updatePreview();
    } else if (updateStatsOnly) {
        updateStats();
    }
    if (markModified) setModified(true);
}

function setEditorValue(nextValue, options = {}) {
    editor.value = nextValue;
    commitEditorContentChange(options);
}

function updateVditorAppearance() {
    vditorHost.style.setProperty('--vditor-font-size', `${fontSize}px`);
    if (!vditorInstance) return;
    try {
        vditorInstance.setTheme(getVditorThemeName());
    } catch (err) {
        console.warn('Vditor 主題更新失敗:', err);
    }
    scheduleResolveVditorImages();
}

async function syncEditorFromVditor(value = null, options = {}) {
    if (!vditorInstance) return;
    const { force = false, markModified = false, refreshStaticPreview = true } = options;
    const nextValue = value ?? vditorInstance.getValue();
    const changed = force || editor.value !== nextValue;
    if (changed) {
        setEditorValue(nextValue, {
            syncTab: true,
            syncVditor: false,
            refreshPreview: false,
            updateStatsOnly: !refreshStaticPreview,
        });
    }
    if (refreshStaticPreview) {
        await renderStaticMarkdownPreview(nextValue);
    }
    if (markModified) setModified(true);
}

function syncVditorFromEditor(options = {}) {
    if (!vditorInstance || !isMarkdownTab()) return;
    const { force = false, clearUndo = false } = options;
    const nextValue = editor.value;
    if (!force && vditorInstance.getValue() === nextValue) {
        scheduleResolveVditorImages();
        return;
    }
    suppressVditorInput = true;
    try {
        vditorInstance.setValue(nextValue, clearUndo);
    } finally {
        suppressVditorInput = false;
    }
    scheduleResolveVditorImages();
}

function bindVditorPasteHandler() {
    if (vditorPasteBound) return;
    vditorHost.addEventListener('paste', async (e) => {
        if (!isVditorActive() || !isPureImagePaste(e)) return;
        e.preventDefault();
        await handlePasteImage('vditor');
    });
    vditorPasteBound = true;
}

async function ensureVditor() {
    if (vditorInstance) return vditorInstance;
    if (vditorInitPromise) return vditorInitPromise;
    if (!window.Vditor) throw new Error('Vditor 尚未載入');
    vditorInitPromise = new Promise((resolve, reject) => {
        try {
            let instance;
            instance = new window.Vditor(vditorHost, {
                cdn: VDITOR_CDN,
                cache: { enable: false },
                mode: 'ir',
                lang: 'zh_TW',
                theme: getVditorThemeName(),
                value: editor.value,
                height: '100%',
                minHeight: 0,
                placeholder: '在此輸入 Markdown...',
                toolbar: VDITOR_TOOLBAR,
                toolbarConfig: { pin: true },
                input(value) {
                    if (suppressVditorInput) return;
                    void syncEditorFromVditor(value, { markModified: true, refreshStaticPreview: true })
                        .catch(err => console.error('Vditor 同步失敗:', err));
                },
                after() {
                    vditorInstance = instance;
                    bindVditorPasteHandler();
                    updateVditorAppearance();
                    syncVditorFromEditor({ force: true, clearUndo: true });
                    resolve(instance);
                },
            });
        } catch (err) {
            vditorInitPromise = null;
            reject(err);
        }
    });
    try {
        return await vditorInitPromise;
    } catch (err) {
        vditorInitPromise = null;
        throw err;
    }
}

async function refreshActiveTabView() {
    const tab = getActiveTab();
    if (!tab) return;
    applyTabToEditor(tab);
    await updatePreview();
    setModified(tab.isModified, { skipTabSync: true });
    renderTabs();
    setSidebarSelection(tab.filePath);
    updateTerminalActionButtons();
    syncTerminalContext();
    if (highlightContent) {
        if (!searchPanel.classList.contains('hidden')) {
            runSearch();
        } else {
            updateEditorSearchMirror();
        }
    }
}

function ensureTerminalClient() {
    if (terminal) return true;
    if (!window.Terminal || !window.FitAddon?.FitAddon) {
        setTerminalError('xterm.js 載入失敗');
        return false;
    }
    terminal = new window.Terminal({
        cursorBlink: true,
        fontFamily: '"JetBrains Mono", "Fira Code", Menlo, Monaco, Consolas, monospace',
        fontSize: 13,
        theme: {
            background: '#0b1220',
            foreground: '#dbeafe',
            cursor: '#42b883',
            selectionBackground: 'rgba(66, 184, 131, 0.25)'
        },
        scrollback: 5000,
        allowTransparency: false,
        macOptionIsMeta: true,
        convertEol: false
    });
    terminalFitAddon = new window.FitAddon.FitAddon();
    terminal.loadAddon(terminalFitAddon);
    terminal.open(terminalMount);
    terminal.onData((data) => {
        if (!terminalStatus.running) return;
        window.electronAPI.terminalWrite(data);
    });
    terminalReady = true;
    return true;
}

function fitTerminal() {
    if (!terminalReady || !terminalVisible) return;
    requestAnimationFrame(async () => {
        try {
            terminalFitAddon.fit();
            const cols = Math.max(20, terminal.cols || 80);
            const rows = Math.max(10, terminal.rows || 24);
            await window.electronAPI.terminalResize(cols, rows);
        } catch (e) {
            console.warn('terminal fit 失敗:', e);
        }
    });
}

async function startTerminalIfNeeded(options = {}) {
    if (terminalStarting) return;
    if (!ensureTerminalClient()) return;
    terminalStarting = true;
    try {
        await syncTerminalContext();
        fitTerminal();
        const result = await window.electronAPI.terminalCreate({
            cwd: getTerminalWorkingDir(),
            cols: terminal.cols || 100,
            rows: terminal.rows || 28,
            ...options,
        });
        if (!result?.success) {
            setTerminalError(result?.error || 'terminal 啟動失敗');
            renderTerminalStatus({ running: false, error: result?.error || 'terminal 啟動失敗' });
        } else {
            setTerminalError('');
            renderTerminalStatus({ running: true, cwd: result.cwd || getTerminalWorkingDir(), shell: result.shell, error: null });
        }
    } finally {
        terminalStarting = false;
    }
}

function setTerminalVisible(visible) {
    terminalVisible = visible;
    if (visible) {
        startTerminalIfNeeded();
        fitTerminal();
    }
}

async function focusTerminal() {
    if (!terminalVisible) setViewMode('terminal');
    await startTerminalIfNeeded();
    terminal?.focus();
}

async function sendTerminalShortcutCommand(command, options = {}) {
    await focusTerminal();
    const result = await window.electronAPI.terminalSendCommand(command, options);
    if (!result?.success) {
        setTerminalError(result?.error || 'terminal 指令送出失敗');
        showSaveToast('Terminal 指令送出失敗');
        return;
    }
    setTerminalError('');
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
    await refreshGitState({ quiet: true });
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

toggleSidebarBtn?.addEventListener('click', () => {
    sidebarCollapsed = !sidebarCollapsed;
    applySidebarChrome();
});

document.querySelectorAll('[data-section-toggle]').forEach(button => {
    button.addEventListener('click', () => {
        toggleSidebarSection(button.dataset.sectionToggle);
    });
});

openFolderBtn?.addEventListener('click', async () => {
    if (sidebarCollapsed) {
        sidebarCollapsed = false;
        applySidebarChrome();
        return;
    }
    const result = await window.electronAPI.showOpenFolderDialog();
    if (result?.success && result.filePath) {
        recentFolders = await window.electronAPI.getRecentFolders();
        await openFolder(result.filePath, { skipRecentRefresh: true });
    }
});

folderTree?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-path]');
    if (!button) return;
    const targetPath = button.dataset.path;
    const statResult = await window.electronAPI.statPath(targetPath);
    if (!statResult?.success) {
        showSaveToast('讀取資料夾樹失敗');
        return;
    }
    if (statResult.stat.isDirectory) {
        if (treeState.expanded.has(targetPath)) treeState.expanded.delete(targetPath);
        else treeState.expanded.add(targetPath);
        await renderSidebar();
        return;
    }
    await openFile(targetPath);
});

// ========== 字型大小 ==========
const LS_FONT_SIZE = 'md_font_size';
let fontSize = parseInt(localStorage.getItem(LS_FONT_SIZE) || '15', 10);
function applyFontSize() {
    previewContent.style.fontSize = fontSize + 'px';
    fontSizeLabel.textContent = fontSize + 'px';
    localStorage.setItem(LS_FONT_SIZE, fontSize);
    updateVditorAppearance();
}
fontIncBtn.addEventListener('click', () => { if (fontSize < 22) { fontSize++; applyFontSize(); } });
fontDecBtn.addEventListener('click', () => { if (fontSize > 10) { fontSize--; applyFontSize(); } });
applyFontSize();

// ========== 檢視模式 ==========
const LS_VIEW = 'md_view_mode';
const LS_PANELS = 'md_visible_panels';
let visiblePanels = new Set(['editor', 'preview']);
const viewBtns = {
    edit:    document.getElementById('viewEdit'),
    split:   document.getElementById('viewSplit'),
    preview: document.getElementById('viewPreview'),
    terminal: document.getElementById('viewTerminal'),
};

function getVisibleContentPanels() {
    return [
        { id: 'editor', el: editorPanel },
        { id: 'preview', el: previewPanel },
        { id: 'terminal', el: terminalDrawer },
    ].filter(panel => visiblePanels.has(panel.id));
}

function saveVisiblePanels() {
    localStorage.setItem(LS_PANELS, JSON.stringify([...visiblePanels]));
}

function normalizePanelWidths() {
    const activeIds = [...visiblePanels];
    if (activeIds.length === 0) return;
    const currentTotal = activeIds.reduce((sum, id) => sum + (panelWidths[id] || 0), 0);
    if (currentTotal <= 0) {
        const evenWidth = 100 / activeIds.length;
        activeIds.forEach(id => { panelWidths[id] = evenWidth; });
        return;
    }
    activeIds.forEach(id => {
        panelWidths[id] = (panelWidths[id] || 0) / currentTotal * 100;
    });
}

function setPanelWidthStyles() {
    const panels = {
        editor: editorPanel,
        preview: previewPanel,
        terminal: terminalDrawer,
    };
    Object.entries(panels).forEach(([id, el]) => {
        if (visiblePanels.has(id)) {
            el.style.width = `${panelWidths[id]}%`;
        }
    });
}

function applyVisiblePanels(options = {}) {
    const { persist = true } = options;
    if (visiblePanels.size === 0) visiblePanels.add('editor');

    const activePanels = getVisibleContentPanels();
    const rh = document.getElementById('resize-handle');
    normalizePanelWidths();

    editorPanel.style.display = visiblePanels.has('editor') ? 'flex' : 'none';
    previewPanel.style.display = visiblePanels.has('preview') ? 'flex' : 'none';
    terminalDrawer.style.display = visiblePanels.has('terminal') ? 'flex' : 'none';
    terminalWidthHandle.style.display = visiblePanels.has('preview') && visiblePanels.has('terminal') ? 'block' : 'none';
    setPanelWidthStyles();

    terminalVisible = visiblePanels.has('terminal');
    Object.values(viewBtns).forEach(b => b.classList.remove('active'));
    viewBtns.edit.classList.toggle('active', visiblePanels.has('editor'));
    viewBtns.preview.classList.toggle('active', visiblePanels.has('preview'));
    viewBtns.terminal.classList.toggle('active', visiblePanels.has('terminal'));
    viewBtns.split.classList.toggle('active', visiblePanels.has('editor') && visiblePanels.has('preview'));
    if (rh) rh.style.display = visiblePanels.has('editor') && activePanels.length > 1 ? 'block' : 'none';
    if (persist) saveVisiblePanels();
    updateEditorModeUI();
    if (terminalVisible) {
        startTerminalIfNeeded();
        fitTerminal();
    }
    void updatePreview();
}

function togglePanel(panelId) {
    if (visiblePanels.has(panelId)) visiblePanels.delete(panelId);
    else visiblePanels.add(panelId);
    applyVisiblePanels();
}

function setViewMode(mode) {
    if (mode === 'split') {
        visiblePanels = new Set(['editor', 'preview']);
        panelWidths.editor = 50;
        panelWidths.preview = 50;
    } else if (mode === 'edit') {
        togglePanel('editor');
        if (visiblePanels.has('editor')) focusEditingSurface();
        return;
    } else if (mode === 'preview') {
        togglePanel('preview');
        return;
    } else if (mode === 'terminal') {
        togglePanel('terminal');
        return;
    } else {
        visiblePanels = new Set(['editor', 'preview']);
    }
    localStorage.setItem(LS_VIEW, mode);
    applyVisiblePanels();
    if (mode === 'edit' || mode === 'split') focusEditingSurface();
}

function restoreVisiblePanels() {
    try {
        const parsed = JSON.parse(localStorage.getItem(LS_PANELS) || 'null');
        if (Array.isArray(parsed)) {
            const allowed = parsed.filter(panel => ['editor', 'preview', 'terminal'].includes(panel));
            if (allowed.length > 0) visiblePanels = new Set(allowed);
        } else {
            const legacyMode = localStorage.getItem(LS_VIEW) || 'split';
            visiblePanels = legacyMode === 'edit'
                ? new Set(['editor'])
                : legacyMode === 'preview'
                    ? new Set(['preview'])
                    : new Set(['editor', 'preview']);
        }
    } catch (e) {
        visiblePanels = new Set(['editor', 'preview']);
    }
    applyVisiblePanels({ persist: false });
}

viewBtns.edit.addEventListener('click',    () => setViewMode('edit'));
viewBtns.split.addEventListener('click',   () => setViewMode('split'));
viewBtns.preview.addEventListener('click', () => setViewMode('preview'));
viewBtns.terminal.addEventListener('click', () => setViewMode('terminal'));

// ========== 主題切換 ==========
const THEME_LABELS = { vue: 'Vue 綠', notion: 'Notion 風', 'github-dark': 'GitHub Dark' };
const LS_THEME = 'md_theme';
const themeSelectBtn = document.getElementById('themeSelectBtn');
const themeLabel = document.getElementById('themeLabel');
const themeDropdown = document.getElementById('themeDropdown');

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(LS_THEME, theme);
    if (themeLabel) themeLabel.textContent = THEME_LABELS[theme] || 'Vue 綠';
    if (themeDropdown) {
        themeDropdown.querySelectorAll('.theme-opt').forEach(btn => {
            btn.classList.toggle('font-semibold', btn.dataset.theme === theme);
            btn.classList.toggle('text-emerald-700', btn.dataset.theme === theme);
        });
    }
    const mermaidTheme = theme === 'github-dark' ? 'dark' : theme === 'notion' ? 'neutral' : 'default';
    mermaid.initialize({ startOnLoad: false, theme: mermaidTheme, securityLevel: 'loose' });
    updateVditorAppearance();
}

themeSelectBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    themeDropdown.classList.toggle('hidden');
});
themeDropdown?.querySelectorAll('.theme-opt').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        applyTheme(btn.dataset.theme);
        themeDropdown.classList.add('hidden');
    });
});
document.addEventListener('click', () => {
    themeDropdown?.classList.add('hidden');
    fontDropdown?.classList.add('hidden');
});

applyTheme(localStorage.getItem(LS_THEME) || 'vue');

// ========== 文件字型 ==========
const FONT_OPTIONS = [
    { id: 'system',   label: '系統預設',                       cssFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang TC", "蘋方-繁", "Heiti TC", "黑體-繁", "Microsoft JhengHei", "微軟正黑體", "BiauKai", "DFKai-SB", "標楷體", "PMingLiU", "新細明體", "Noto Sans TC", "思源黑體", "Hiragino Sans GB", sans-serif', wordFont: '微軟正黑體' },
    { id: 'pingfang', label: '蘋方 (PingFang TC)',              cssFamily: '"PingFang TC", "蘋方-繁", -apple-system, sans-serif', wordFont: 'PingFang TC' },
    { id: 'heiti',    label: '黑體-繁 (Heiti TC)',              cssFamily: '"Heiti TC", "黑體-繁", sans-serif', wordFont: 'Heiti TC' },
    { id: 'jhenghei', label: '微軟正黑體 (Microsoft JhengHei)', cssFamily: '"Microsoft JhengHei", "微軟正黑體", "Heiti TC", "黑體-繁", sans-serif', wordFont: '微軟正黑體' },
    { id: 'kaiti',    label: '標楷體',                          cssFamily: '"BiauKai", "DFKai-SB", "標楷體", "標楷體-繁", KaiTi, "Apple LiSung", cursive', wordFont: '標楷體' },
    { id: 'pmingliu', label: '新細明體 (PMingLiU)',             cssFamily: '"PMingLiU", "新細明體", "Times New Roman", serif', wordFont: '新細明體' },
    { id: 'mingliu',  label: '細明體 (MingLiU)',                cssFamily: '"MingLiU", "細明體", "Times New Roman", serif', wordFont: '細明體' },
    { id: 'simhei',   label: '黑體簡 (SimHei)',                 cssFamily: '"SimHei", "黑体", "Heiti TC", sans-serif', wordFont: 'SimHei' },
    { id: 'simsun',   label: '宋體 (SimSun)',                   cssFamily: '"SimSun", "宋体", "PMingLiU", "新細明體", serif', wordFont: 'SimSun' },
    { id: 'noto-tc',  label: '思源黑體 (Noto Sans TC)',         cssFamily: '"Noto Sans TC", "Noto Sans CJK TC", "思源黑體", "Noto Sans", sans-serif', wordFont: 'Noto Sans TC' },
    { id: 'noto-serif', label: '思源宋體 (Noto Serif TC)',      cssFamily: '"Noto Serif TC", "Noto Serif CJK TC", "思源宋體", "Noto Serif", serif', wordFont: 'Noto Serif TC' },
    { id: 'inter',    label: 'Inter (英文)',                    cssFamily: '"Inter", "Noto Sans TC", -apple-system, sans-serif', wordFont: 'Inter' },
    { id: 'serif',    label: '襯線 (Serif + 新細明體)',         cssFamily: 'Georgia, "Times New Roman", "新細明體", "PMingLiU", serif', wordFont: '新細明體' },
    { id: 'mono',     label: '等寬 (Consolas + 微軟正黑體)',    cssFamily: '"JetBrains Mono", Consolas, "微軟正黑體", monospace', wordFont: 'Consolas' },
];
const LS_FONT = 'md_font';
const fontSelectBtn = document.getElementById('fontSelectBtn');
const fontLabel     = document.getElementById('fontLabel');
const fontDropdown  = document.getElementById('fontDropdown');
let currentFontId   = localStorage.getItem(LS_FONT) || 'system';

function getFontOption(id) {
    return FONT_OPTIONS.find(f => f.id === id) || FONT_OPTIONS[0];
}
function getActiveWordFont() {
    return (getFontOption(currentFontId).wordFont || '微軟正黑體').trim();
}

function applyFont() {
    const opt = getFontOption(currentFontId);
    document.documentElement.style.setProperty('--md-font', opt.cssFamily);
    document.documentElement.style.setProperty('--md-heading-font', 'var(--md-font)');
    if (fontLabel) fontLabel.textContent = opt.label;
    if (fontDropdown) {
        fontDropdown.querySelectorAll('.font-opt').forEach(btn => {
            const active = btn.dataset.fontId === currentFontId;
            btn.classList.toggle('active', active);
            btn.classList.toggle('font-semibold', active);
        });
    }
    localStorage.setItem(LS_FONT, currentFontId);
    updateVditorAppearance();
}

function buildFontDropdown() {
    if (!fontDropdown) return;
    fontDropdown.innerHTML = FONT_OPTIONS.map(opt => {
        const styleAttr = opt.id === 'system' ? '' : ` style="font-family:${opt.cssFamily};"`;
        return `<button data-font-id="${opt.id}" class="font-opt w-full text-left px-3.5 py-2 text-xs hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 transition-colors"${styleAttr}>${escapeHtml(opt.label)}</button>`;
    }).join('');
    fontDropdown.querySelectorAll('.font-opt').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentFontId = btn.dataset.fontId;
            applyFont();
            fontDropdown.classList.add('hidden');
        });
    });
}

fontSelectBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    themeDropdown?.classList.add('hidden');
    fontDropdown.classList.toggle('hidden');
});

buildFontDropdown();
applyFont();

// ========== Markdown 工具列 ==========
function wrapSelection(before, after='', placeholder='文字') {
    const start = editor.selectionStart, end = editor.selectionEnd;
    const sel   = editor.value.substring(start, end) || placeholder;
    const newText = before + sel + after;
    editor.setRangeText(newText, start, end, 'select');
    editor.focus();
    editor.selectionStart = start + before.length;
    editor.selectionEnd   = start + before.length + sel.length;
    commitEditorContentChange({ syncTab: true, syncVditor: true, refreshPreview: true, markModified: true });
    scheduleAutoSave();
}
function insertLine(prefix, placeholder='文字') {
    const start = editor.selectionStart;
    const lineStart = editor.value.lastIndexOf('\n', start - 1) + 1;
    const lineEnd   = editor.value.indexOf('\n', start);
    const line      = editor.value.substring(lineStart, lineEnd === -1 ? undefined : lineEnd) || placeholder;
    const already   = line.startsWith(prefix);
    const newLine   = already ? line.slice(prefix.length) : prefix + line;
    editor.setRangeText(newLine, lineStart, lineEnd === -1 ? editor.value.length : lineEnd, 'end');
    editor.focus();
    commitEditorContentChange({ syncTab: true, syncVditor: true, refreshPreview: true, markModified: true });
    scheduleAutoSave();
}
const TOOLBAR_ACTIONS = {
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
        editor.focus();
        commitEditorContentChange({ syncTab: true, syncVditor: true, refreshPreview: true, markModified: true });
        scheduleAutoSave();
    },
    table: () => {
        const tbl = '\n| 欄位1 | 欄位2 | 欄位3 |\n| :--- | :---: | ---: |\n| 內容 | 內容 | 內容 |\n';
        const pos = editor.selectionEnd;
        editor.setRangeText(tbl, pos, pos, 'end');
        editor.focus();
        commitEditorContentChange({ syncTab: true, syncVditor: true, refreshPreview: true, markModified: true });
        scheduleAutoSave();
    },
    hr: () => {
        const pos = editor.selectionEnd;
        editor.setRangeText('\n\n---\n\n', pos, pos, 'end');
        editor.focus();
        commitEditorContentChange({ syncTab: true, syncVditor: true, refreshPreview: true, markModified: true });
        scheduleAutoSave();
    },
};
mdToolbar.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (btn) TOOLBAR_ACTIONS[btn.dataset.action]?.();
});

function prepareEditorSearch() {
    if (visiblePanels.has('preview') && !visiblePanels.has('editor')) {
        setViewMode('split');
    }
    focusEditingSurface();
}

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
        commitEditorContentChange({ syncTab: true, syncVditor: true, refreshPreview: true, markModified: true });
    }
    if (e.key === 'Escape') {
        if (!searchPanel.classList.contains('hidden')) {
            e.preventDefault();
            closeSearchPanel();
        }
    }
});
document.addEventListener('keydown', e => {
    if (pdfPanel.classList.contains('open')) {
        if (e.key === 'Escape') {
            e.preventDefault();
            closePdfPanelAndRestoreFocus();
        } else if (e.key === 'Tab') {
            const focusable = getPdfDialogFocusableElements();
            if (focusable.length) {
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        }
        return;
    }
    if (isTerminalFocused() && !((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'j' || (e.shiftKey && e.key.toLowerCase() === 'c')))) {
        return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault(); saveCurrentFile();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setViewMode('terminal');
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        focusTerminal();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        prepareEditorSearch();
        openSearchPanel({ showReplace: false });
    }
    if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'f') {
        e.preventDefault();
        prepareEditorSearch();
        openSearchPanel({ showReplace: true });
    }
    if (e.key === 'Escape' && gitFloatingOpen) {
        e.preventDefault();
        closeGitFloatingPanel();
    }
});

// ========== 字數統計 ==========
function updateStats() {
    if (currentFileType === 'pdf') {
        const pages = getActiveTab()?.previewMeta?.pdf?.numPages || 0;
        statWords.textContent = `${pages} 頁`;
        statLines.textContent = '唯讀';
        statChars.textContent = 'PDF';
        return;
    }
    const txt   = editor.value;
    const words = txt.trim() === '' ? 0 : txt.trim().split(/\s+/).length;
    const lines = txt === '' ? 1 : txt.split('\n').length;
    const chars = txt.length;
    statWords.textContent = words + ' 字';
    statLines.textContent = lines + ' 行';
    statChars.textContent = chars + ' 字元';
    updateLineNumbers();
}

function updateLineNumbers() {
    const lineCount = editor.value === '' ? 1 : editor.value.split('\n').length;
    let html = '<div class="line-numbers-inner">';
    for (let i = 1; i <= lineCount; i++) {
        html += `<div class="line-number">${i}</div>`;
    }
    html += '</div>';
    lineNumbers.innerHTML = html;
    syncLineNumberScroll();
}

function syncLineNumberScroll() {
    const inner = lineNumbers.querySelector('.line-numbers-inner');
    if (!inner) return;
    inner.style.transform = `translateY(${-editor.scrollTop}px)`;
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

async function readPdfDocument(filePath) {
    const binary = await window.electronAPI.readFileBinary(filePath);
    if (!binary.success) throw new Error(binary.error);
    if (!window.pdfjsLib) throw new Error('pdf.js 尚未載入');
    if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.js';
    }
    const data = Uint8Array.from(atob(binary.data), c => c.charCodeAt(0));
    const loadingTask = window.pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;
    return { pdf, base64: binary.data };
}

// ========== 開啟檔案 ==========
async function reloadTabFromDisk(tab, options = {}) {
    const { notify = true } = options;
    if (!tab?.filePath) return false;
    try {
        const ext = getFileExt(tab.filePath);
        const fileType = getFileTypeFromExt(ext);
        tab.dirPath = await window.electronAPI.pathDirname(tab.filePath);
        tab.fileExt = ext;
        tab.fileType = fileType;
        if (fileType === 'pdf') {
            tab.content = '';
            tab.previewMeta = await readPdfDocument(tab.filePath);
        } else {
            tab.content = await readFileText(tab.filePath, ext, tab.csvEncoding || csvEncodingSelect.value);
            tab.previewMeta = null;
        }
        tab.isModified = false;
        tab.externalChanged = false;
        updateTabTitle(tab);
        if (fileType !== 'pdf') {
            const watchResult = await window.electronAPI.watchCurrentFile(tab.filePath);
            if (!watchResult?.success) {
                console.warn('監聽檔案失敗:', watchResult?.error);
            }
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
        setSidebarSelection(filePath);
        const ext = getFileExt(filePath);
        if (!supportsFileExtension(ext)) {
            showSaveToast('此檔案類型尚不支援');
            return;
        }
        await window.electronAPI.addRecentFile(filePath);
        recentFilesState = await window.electronAPI.getRecentFiles();
        const existingTab = tabs.find(tab => tab.filePath === filePath);
        if (existingTab) {
            activeTabId = existingTab.id;
            if (existingTab.externalChanged && !existingTab.isModified) {
                await reloadTabFromDisk(existingTab, { notify: false });
            } else {
                await refreshActiveTabView();
            }
            await refreshGitState({ quiet: true });
            if (!silent) showSaveToast('已切換到 ' + pathBasename(filePath));
            return;
        }

        const fileType = getFileTypeFromExt(ext);
        const encoding = ext === 'csv' ? (csvEncodingSelect.value || 'auto') : 'auto';
        const text = fileType === 'pdf' ? '' : await readFileText(filePath, ext, encoding);
        const tab = createTabState({
            filePath,
            dirPath: await window.electronAPI.pathDirname(filePath),
            fileExt: ext,
            fileType,
            content: text,
            csvEncoding: encoding,
            previewMeta: fileType === 'pdf' ? await readPdfDocument(filePath) : null,
        });
        updateTabTitle(tab);
        tabs.push(tab);
        activeTabId = tab.id;
        if (fileType !== 'pdf') {
            const watchResult = await window.electronAPI.watchCurrentFile(filePath);
            if (!watchResult?.success) {
                console.warn('監聽檔案失敗:', watchResult?.error);
            }
        }
        if (!currentFolderPath || !isPathInsideFolder(filePath, currentFolderPath)) {
            currentFolderPath = await window.electronAPI.pathDirname(filePath);
            treeState.loaded.clear();
            treeState.expanded.clear();
            treeState.expanded.add(currentFolderPath);
        }
        await refreshActiveTabView();
        await refreshGitState({ quiet: true });
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
    const isPdf = currentFileType === 'pdf';
    const isText = currentFileType === 'text';
    exportExcelBtn.classList.toggle('hidden', !isCsv);
    openPdfPanelBtn.classList.toggle('hidden', isCsv || isPdf);
    exportWordBtn.classList.toggle('hidden', isCsv || isPdf);
    csvEncodingWrap.classList.toggle('hidden', !isCsv);
    csvEncodingWrap.classList.toggle('flex', isCsv);
    saveBtn.classList.toggle('hidden', isPdf);
    if (isText) {
        openPdfPanelBtn.classList.remove('hidden');
        exportWordBtn.classList.remove('hidden');
    }
}

function setModified(modified, options = {}) {
    const { skipTabSync = false, silentTitle = false } = options;
    if (currentFileType === 'pdf') modified = false;
    isModified = modified;
    const tab = getActiveTab();
    if (tab && !skipTabSync) {
        tab.isModified = modified;
        if (tab.fileType !== 'pdf') tab.content = editor.value;
        updateTabTitle(tab);
    }
    saveBtn.disabled = currentFileType === 'pdf' || (!modified && !currentFilePath);
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
    if (isVditorActive()) {
        await syncEditorFromVditor(null, { refreshStaticPreview: true });
    }
    syncEditorToActiveTab();
    if (currentFileType === 'pdf') {
        showSaveToast('PDF 為唯讀檢視');
        return;
    }
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
            await refreshGitState({ quiet: true });
        } else {
            showSaveToast('儲存失敗: ' + result.error);
        }
    } catch (e) {
        showSaveToast('儲存失敗');
    }
}

async function saveAsNewFile() {
    if (currentFileType === 'pdf') {
        showSaveToast('PDF 不支援另存編輯內容');
        return;
    }
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
        tab.fileExt  = getFileExt(tab.filePath);
        tab.fileType = getFileTypeFromExt(tab.fileExt);
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
        setEditorValue(text, { syncTab: true, syncVditor: false, refreshPreview: false });
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

async function renderPdfPreview(tab = getActiveTab()) {
    const pdf = tab?.previewMeta?.pdf;
    if (!pdf) {
        previewContent.innerHTML = '<div class="pdf-empty-state">PDF 載入失敗</div>';
        return;
    }
    previewContent.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'pdf-preview';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.2 });
        const pageEl = document.createElement('div');
        pageEl.className = 'pdf-page';
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d');
        await page.render({ canvasContext: context, viewport }).promise;
        const meta = document.createElement('div');
        meta.className = 'pdf-page-meta';
        meta.textContent = `Page ${pageNum}`;
        pageEl.appendChild(canvas);
        pageEl.appendChild(meta);
        wrapper.appendChild(pageEl);
    }
    previewContent.appendChild(wrapper);
}

async function renderStaticMarkdownPreview(markdown = editor.value) {
    const renderSeq = ++markdownPreviewRenderSeq;
    const cleanHtml = DOMPurify.sanitize(marked.parse(markdown), { ADD_ATTR: ['onclick', 'data-src', 'data-mermaid-source'], FORCE_BODY: true });
    previewContent.innerHTML = cleanHtml;
    const mermaidEls = previewContent.querySelectorAll('.mermaid');
    if (mermaidEls.length > 0) {
        try { await mermaid.run({ nodes: mermaidEls }); } catch(e) { console.warn('Mermaid 渲染失敗:', e); }
    }
    if (renderSeq !== markdownPreviewRenderSeq) return;
    await resolveImages(previewContent);
    if (renderSeq !== markdownPreviewRenderSeq) return;
    updateStats();
}

async function activateVditorPreview() {
    updatePreviewSurfaceVisibility(true);
    try {
        await ensureVditor();
        syncVditorFromEditor();
        updateVditorAppearance();
        if (!visiblePanels.has('editor')) {
            requestAnimationFrame(() => vditorInstance?.focus());
        }
    } catch (err) {
        console.error('Vditor 初始化失敗:', err);
        updatePreviewSurfaceVisibility(false);
        showSaveToast('Vditor 載入失敗，已改用靜態預覽');
    }
}

async function updatePreview() {
    updateEditorModeUI();
    if (currentFileType === 'csv') {
        updatePreviewSurfaceVisibility(false);
        renderCsvPreview(editor.value);
        updateStats();
        return;
    }
    if (currentFileType === 'text') {
        updatePreviewSurfaceVisibility(false);
        previewContent.innerHTML = `<pre class="plain-text-preview">${escapeHtml(editor.value)}</pre>`;
        updateStats();
        return;
    }
    if (currentFileType === 'pdf') {
        updatePreviewSurfaceVisibility(false);
        await renderPdfPreview();
        updateStats();
        return;
    }
    await renderStaticMarkdownPreview(editor.value);
    if (shouldUseVditorPreview()) {
        await activateVditorPreview();
        return;
    }
    updatePreviewSurfaceVisibility(false);
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
    if (!visiblePanels.has('editor')) return;
    const mainRect = mainEl.getBoundingClientRect();
    const available = mainRect.width - resizeHandle.offsetWidth;
    const rightPanels = [
        visiblePanels.has('preview') ? 'preview' : null,
        visiblePanels.has('terminal') ? 'terminal' : null,
    ].filter(Boolean);
    if (rightPanels.length === 0) return;
    const maxEditorPct = 100 - rightPanels.length * 15;
    let editorPct = (e.clientX - mainRect.left) / available * 100;
    editorPct = Math.max(15, Math.min(maxEditorPct, editorPct));
    panelWidths.editor = editorPct;
    const rightWidth = (100 - editorPct) / rightPanels.length;
    rightPanels.forEach(id => {
        panelWidths[id] = rightWidth;
    });
    setPanelWidthStyles();
    fitTerminal();
});
document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = false;
    resizeHandle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    fitTerminal();
});

window.addEventListener('resize', () => {
    fitTerminal();
});

terminalWidthHandle.addEventListener('mousedown', e => {
    isTerminalWidthResizing = true;
    terminalWidthHandle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
});

document.addEventListener('mousemove', e => {
    if (!isTerminalWidthResizing) return;
    if (!visiblePanels.has('preview') || !visiblePanels.has('terminal')) return;
    const mainRect = mainEl.getBoundingClientRect();
    const mousePct = (e.clientX - mainRect.left) / mainRect.width * 100;
    const leftPct = visiblePanels.has('editor') ? panelWidths.editor : 0;
    const combined = 100 - leftPct;
    let previewPct = mousePct - leftPct;
    previewPct = Math.max(15, Math.min(combined - 15, previewPct));
    panelWidths.preview = previewPct;
    panelWidths.terminal = combined - previewPct;
    setPanelWidthStyles();
    fitTerminal();
});

document.addEventListener('mouseup', () => {
    if (!isTerminalWidthResizing) return;
    isTerminalWidthResizing = false;
    terminalWidthHandle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    fitTerminal();
});

// ========== 編輯器事件 ==========
editor.addEventListener('input', () => {
    commitEditorContentChange({ syncTab: true, syncVditor: true, refreshPreview: true, markModified: true });
});
editor.addEventListener('scroll', () => {
    syncHighlightScroll();
    syncLineNumberScroll();
    if (isVditorActive()) return;
    const pct = editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
    previewWrapper.scrollTop = pct * (previewWrapper.scrollHeight - previewWrapper.clientHeight);
});

// ========== PDF 面板 ==========
function getPdfDialogFocusableElements() {
    return [...pdfDialog.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter(element => !element.hidden && element.getClientRects().length > 0);
}

function closePdfPanelAndRestoreFocus() {
    if (!pdfPanel.classList.contains('open')) return;
    pdfPanel.classList.remove('open');
    pdfPanel.setAttribute('aria-hidden', 'true');
    const opener = pdfPanelOpener;
    pdfPanelOpener = null;
    if (visiblePanels.has('editor')) {
        focusEditingSurface();
    } else if (opener?.isConnected) {
        opener.focus({ preventScroll: true });
    }
}

function openPdfPanel() {
    pdfPanelOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const currentFile = statFile.textContent;
    if (currentFile && currentFile !== '未開啟檔案' && currentFile !== '未命名') {
        pdfFilename.value = currentFile.replace(/\.[^.]+$/, '');
    }
    pdfPanel.classList.add('open');
    pdfPanel.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
        pdfFilename.focus({ preventScroll: true });
        pdfFilename.select();
    });
}

openPdfPanelBtn.addEventListener('click', openPdfPanel);
closePdfPanel.addEventListener('click', closePdfPanelAndRestoreFocus);
pdfOverlay.addEventListener('click', closePdfPanelAndRestoreFocus);

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
    if (!inherited.font) inherited = { ...inherited, font: getActiveWordFont() };
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
    const wordFont = getActiveWordFont();
    const children = [];
    nodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = normalizeWordText(node.textContent).trim();
            if (text) children.push(new Paragraph({ children: [new docx.TextRun({ text, font: wordFont })] }));
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
        const wordFont = getActiveWordFont();
        const headingLevels = [
            { key: 'heading1', size: 44, bold: true },
            { key: 'heading2', size: 34, bold: true },
            { key: 'heading3', size: 28, bold: true },
            { key: 'heading4', size: 24, bold: true },
            { key: 'heading5', size: 22, bold: true },
            { key: 'heading6', size: 20, bold: true },
        ];
        const defaultStyles = {
            document: {
                run: { font: wordFont, size: 22 },
                paragraph: { spacing: { line: 360, after: 120 } },
            },
        };
        headingLevels.forEach(({ key, size, bold }) => {
            defaultStyles[key] = {
                run: { font: wordFont, size, bold },
                paragraph: { spacing: { before: 240, after: 120, line: 360 } },
            };
        });
        const document = new Document({
            creator: 'shenMD',
            title: filename || 'Document',
            styles: { default: defaultStyles },
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
        closePdfPanelAndRestoreFocus();
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
function isPureImagePaste(event) {
    const items = event.clipboardData?.items;
    if (!items) return false;
    let hasImage = false;
    let hasText = false;
    for (const item of items) {
        if (item.type.startsWith('image/')) hasImage = true;
        if (item.type === 'text/plain' || item.type === 'text/html') hasText = true;
    }
    return hasImage && !hasText;
}

async function insertMarkdownSnippet(mdText, target = 'editor') {
    if (target === 'vditor' && isVditorActive()) {
        await ensureVditor();
        vditorInstance.focus();
        vditorInstance.insertMD('\n' + mdText + '\n');
        await syncEditorFromVditor(null, { force: true, markModified: true, refreshStaticPreview: true });
        return;
    }
    const pos = editor.selectionEnd;
    editor.setRangeText('\n' + mdText + '\n', pos, pos, 'end');
    editor.focus();
    commitEditorContentChange({ syncTab: true, syncVditor: true, refreshPreview: false, markModified: true });
    await updatePreview();
}

async function handlePasteImage(target = isVditorActive() ? 'vditor' : 'editor') {
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
            await insertMarkdownSnippet(mdText, target);
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
    if (!isPureImagePaste(e)) return;
    e.preventDefault();
    await handlePasteImage('editor');
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
        if (!fp) return;
        const statResult = await window.electronAPI.statPath(fp);
        if (statResult?.success && statResult.stat.isDirectory) {
            recentFolders = await window.electronAPI.getRecentFolders();
            await openFolder(fp, { skipRecentRefresh: true });
            return;
        }
        await openFile(fp);
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

async function handleWatchedFileChange(filePath, reason = 'change') {
    const tab = tabs.find(item => item.filePath === filePath);
    if (!tab) return;
    if (Date.now() < suppressWatchReloadUntil) return;
    tab.externalChanged = true;

    if (reason === 'delete') {
        renderTabs();
        showSaveToast(`${tab.title} 已在外部刪除`);
        await refreshGitState({ quiet: true });
        return;
    }

    if (tab.id !== activeTabId) {
        renderTabs();
        showSaveToast(`${tab.title} 已在外部更新`);
        await refreshGitState({ quiet: true });
        return;
    }

    if (!isTextLikeTab(tab)) {
        await reloadCurrentFileFromDisk({ notify: true });
        await refreshGitState({ quiet: true });
        return;
    }
    await reloadCurrentFileFromDisk({ notify: true });
    await refreshGitState({ quiet: true });
}

terminalCloseBtn.addEventListener('click', () => {
    if (terminalVisible) setViewMode('terminal');
});

terminalFocusBtn.addEventListener('click', () => {
    focusTerminal();
});

terminalRestartBtn.addEventListener('click', async () => {
    await focusTerminal();
    const result = await window.electronAPI.terminalRestart({
        cwd: getTerminalWorkingDir(),
        cols: terminal?.cols || 100,
        rows: terminal?.rows || 28,
    });
    if (!result?.success) {
        setTerminalError(result?.error || 'terminal 重啟失敗');
        return;
    }
    terminal?.clear();
    setTerminalError('');
    renderTerminalStatus({ running: true, cwd: result.cwd || getTerminalWorkingDir(), shell: result.shell, error: null });
});

terminalClearBtn.addEventListener('click', () => {
    terminal?.clear();
});

terminalCdBtn.addEventListener('click', async () => {
    const dir = getTerminalWorkingDir();
    if (!dir) return;
    await sendTerminalShortcutCommand(`cd ${shellEscape(dir)}`, { execute: true, cwd: dir });
    renderTerminalStatus({ running: true, cwd: dir, error: null });
});

terminalInsertFileBtn.addEventListener('click', async () => {
    const filePath = getActiveTab()?.filePath;
    if (!filePath) return;
    await focusTerminal();
    await window.electronAPI.terminalSendCommand(shellEscape(filePath), { execute: false });
});

terminalInsertDirBtn.addEventListener('click', async () => {
    const dir = getTerminalWorkingDir();
    if (!dir) return;
    await focusTerminal();
    await window.electronAPI.terminalSendCommand(shellEscape(dir), { execute: false });
});

terminalCodexBtn.addEventListener('click', async () => {
    const filePath = getActiveTab()?.filePath;
    if (!filePath) return;
    await focusTerminal();
    await window.electronAPI.terminalSendCommand(`codex ${shellEscape(filePath)}`, { execute: false });
});

terminalPiBtn.addEventListener('click', async () => {
    const filePath = getActiveTab()?.filePath;
    if (!filePath) return;
    await focusTerminal();
    await window.electronAPI.terminalSendCommand(`pi agent ${shellEscape(filePath)}`, { execute: false });
});

// ========== 初始化 ==========
async function initializeApp() {
    appPaths = await window.electronAPI.getAppPaths();
    recentFilesState = await window.electronAPI.getRecentFiles();
    recentFolders = await window.electronAPI.getRecentFolders();
    restoreSidebarState();
    restoreVisiblePanels();
    ensureAtLeastOneTab();
    await refreshActiveTabView();
    await renderSidebar();
    await refreshGitState({ quiet: true });
    renderTerminalStatus({ running: false, cwd: getTerminalWorkingDir(), error: null });
    updateTerminalActionButtons();
}

initializeApp();

// ========== IPC 事件綁定 ==========
window.electronAPI.onOpenFile(async (filePath) => {
    await openFile(filePath);
});
window.electronAPI.onOpenFolder(async (folderPath) => {
    recentFolders = await window.electronAPI.getRecentFolders();
    await openFolder(folderPath, { skipRecentRefresh: true });
});
window.electronAPI.onMenuNewFile(() => newFile());
window.electronAPI.onMenuSave(() => saveCurrentFile());
window.electronAPI.onMenuSaveAs(() => saveAsNewFile());
window.electronAPI.onMenuPasteImage(() => handlePasteImage());
window.electronAPI.onMenuExportPdf(() => openPdfPanel());
window.electronAPI.onMenuExportWord(() => document.getElementById('exportWordBtn').click());
window.electronAPI.onMenuExportExcel(() => exportExcelBtn.click());
window.electronAPI.onSetViewMode(mode => setViewMode(mode));
window.electronAPI.onFontSizeChange(delta => {
    const newSize = fontSize + delta;
    if (newSize >= 10 && newSize <= 22) { fontSize = newSize; applyFontSize(); }
});
window.electronAPI.onTerminalData(({ data }) => {
    if (!ensureTerminalClient()) return;
    terminal.write(data);
});
window.electronAPI.onTerminalExit(({ exitCode, signal }) => {
    renderTerminalStatus({ running: false, error: null });
    showSaveToast(`Terminal 已結束 (${exitCode ?? signal ?? 0})`);
});
window.electronAPI.onTerminalStatus((payload) => {
    const nextCwd = payload.cwd || getTerminalWorkingDir();
    renderTerminalStatus({
        running: Boolean(payload.running),
        cwd: nextCwd,
        shell: payload.shell || terminalStatus.shell,
        error: payload.error || null,
    });
    setTerminalError(payload.error || '');
});
window.electronAPI.onTerminalError(({ message }) => {
    setTerminalError(message || 'terminal 發生錯誤');
});
window.electronAPI.onRecentFilesUpdated(async (files) => {
    recentFilesState = Array.isArray(files) ? files : [];
    await renderSidebar();
});
window.electronAPI.onRecentFoldersUpdated(async (folders) => {
    recentFolders = Array.isArray(folders) ? folders : [];
    await renderSidebar();
});
window.electronAPI.onWatchedFileChanged(async ({ filePath, reason }) => {
    await handleWatchedFileChange(filePath, reason);
});

// ==================== 搜尋與取代功能實作 ====================

function escapeForHighlight(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function syncHighlightScroll() {
    if (!highlightContent) return;
    highlightContent.style.transform = `translate(${-editor.scrollLeft}px, ${-editor.scrollTop}px)`;
}

function renderHighlight(matches, currentIdx) {
    if (!highlightContent) return;
    const text = editor.value;
    if (!matches || matches.length === 0) {
        highlightContent.innerHTML = escapeForHighlight(text) + '\n';
        syncHighlightScroll();
        return;
    }
    let html = '';
    let cursor = 0;
    for (let i = 0; i < matches.length; i++) {
        const m = matches[i];
        html += escapeForHighlight(text.substring(cursor, m.start));
        const cls = i === currentIdx ? ' class="current"' : '';
        html += `<mark data-idx="${i}"${cls}>${escapeForHighlight(text.substring(m.start, m.end))}</mark>`;
        cursor = m.end;
    }
    html += escapeForHighlight(text.substring(cursor));
    highlightContent.innerHTML = html + '\n';
    syncHighlightScroll();
}

function flashCurrentMark() {
    if (!highlightContent) return;
    const current = highlightContent.querySelector('mark.current');
    if (!current) return;
    current.classList.remove('flash');
    void current.offsetWidth;
    current.classList.add('flash');
    clearTimeout(flashCurrentMark._t);
    flashCurrentMark._t = setTimeout(() => current.classList.remove('flash'), 600);
}

function scrollEditorToMarkIndex(idx) {
    if (idx < 0 || !highlightContent) return;
    const marks = highlightContent.querySelectorAll('mark');
    const mark = marks[idx];
    if (!mark) return;
    const lineHeight = parseFloat(getComputedStyle(editor).lineHeight) || 22;
    const markTop = mark.offsetTop;
    const target = markTop - editor.clientHeight / 2 + lineHeight / 2;
    const max = Math.max(0, editor.scrollHeight - editor.clientHeight);
    editor.scrollTop = Math.max(0, Math.min(target, max));
    syncHighlightScroll();
}

function openSearchPanel(options = {}) {
    const { showReplace = false } = options;

    const selection = editor.value.substring(editor.selectionStart, editor.selectionEnd);
    if (selection && selection.indexOf('\n') === -1 && !searchInput.value) {
        searchInput.value = selection;
    }

    searchPanel.classList.remove('hidden');
    searchPanel.classList.add('flex');

    if (showReplace) {
        replaceRow.classList.remove('hidden');
        replaceRow.classList.add('flex');
        searchReplaceArrow.classList.add('rotate-90');
    } else {
        replaceRow.classList.add('hidden');
        replaceRow.classList.remove('flex');
        searchReplaceArrow.classList.remove('rotate-90');
    }

    editor.classList.add('search-active');
    renderHighlight([], -1);

    searchInput.focus();
    searchInput.select();

    runSearch();
}

function closeSearchPanel() {
    searchPanel.classList.add('hidden');
    searchPanel.classList.remove('flex');
    searchMatches = [];
    activeSearchIndex = -1;
    editor.classList.remove('search-active');
    updateEditorSearchMirror();
    editor.focus();
}

function buildSearchRegex(query, caseSensitive, isRegex, wholeWord) {
    try {
        let pattern = query;
        if (!isRegex) {
            pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
        if (wholeWord) {
            pattern = `(?<![\\p{L}\\p{N}_])${pattern}(?![\\p{L}\\p{N}_])`;
            return { regex: new RegExp(pattern, caseSensitive ? 'gu' : 'giu'), error: null };
        }
        return { regex: new RegExp(pattern, caseSensitive ? 'g' : 'gi'), error: null };
    } catch (e) {
        return { regex: null, error: e.message };
    }
}

function collectMatches(regex, text) {
    const matches = [];
    let m;
    while ((m = regex.exec(text)) !== null) {
        matches.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
        if (m.index === regex.lastIndex) regex.lastIndex++;
    }
    return matches;
}

function runSearch() {
    const query = searchInput.value;
    syncHighlightScroll();

    if (!query) {
        searchMatches = [];
        activeSearchIndex = -1;
        searchResultsCount.textContent = '0 / 0';
        searchResultsCount.classList.remove('no-results');
        renderHighlight([], -1);
        return;
    }

    const caseSensitive = searchCaseSensitive.classList.contains('active');
    const isRegex = searchRegex.classList.contains('active');
    const wholeWord = searchWholeWord.classList.contains('active');
    const { regex, error } = buildSearchRegex(query, caseSensitive, isRegex, wholeWord);

    if (error) {
        searchMatches = [];
        activeSearchIndex = -1;
        searchResultsCount.textContent = '正則錯誤';
        searchResultsCount.classList.add('no-results');
        renderHighlight([], -1);
        return;
    }

    searchMatches = collectMatches(regex, editor.value);

    if (searchMatches.length === 0) {
        activeSearchIndex = -1;
        searchResultsCount.textContent = '無結果';
        searchResultsCount.classList.add('no-results');
        renderHighlight([], -1);
        return;
    }

    searchResultsCount.classList.remove('no-results');

    const pos = editor.selectionStart;
    let idx = searchMatches.findIndex(m => m.start >= pos);
    if (idx === -1) idx = searchMatches.length - 1;
    if (activeSearchIndex < 0 || activeSearchIndex >= searchMatches.length) {
        activeSearchIndex = idx;
    }

    applyMatchToEditor(activeSearchIndex);
    searchResultsCount.textContent = `${activeSearchIndex + 1} / ${searchMatches.length}`;
}

function applyMatchToEditor(idx) {
    if (idx < 0 || idx >= searchMatches.length) return;
    const match = searchMatches[idx];
    editor.selectionStart = match.start;
    editor.selectionEnd = match.end;
    renderHighlight(searchMatches, idx);
    scrollEditorToMarkIndex(idx);
    flashCurrentMark();
}

function navigateSearch(direction) {
    if (searchMatches.length === 0) {
        showSaveToast('沒有可導覽的結果');
        return;
    }
    const prevIndex = activeSearchIndex;
    let next = activeSearchIndex + direction;
    let wrapped = false;
    if (next < 0) {
        next = searchMatches.length - 1;
        wrapped = true;
    } else if (next >= searchMatches.length) {
        next = 0;
        wrapped = true;
    }
    activeSearchIndex = next;
    applyMatchToEditor(next);
    searchResultsCount.textContent = `${activeSearchIndex + 1} / ${searchMatches.length}`;
    if (wrapped) {
        showSaveToast(direction === 1 ? '已從頭循環' : '已從尾循環');
    }
}

function replaceActive() {
    if (searchMatches.length === 0 || activeSearchIndex < 0) {
        showSaveToast('沒有可取代的結果');
        return;
    }
    const match = searchMatches[activeSearchIndex];
    const replacement = replaceInput.value;
    const val = editor.value;
    const lengthDiff = replacement.length - (match.end - match.start);

    const before = val.substring(0, match.start);
    const after = val.substring(match.end);
    setEditorValue(before + replacement + after, {
        syncTab: true,
        syncVditor: true,
        refreshPreview: false,
        markModified: true,
    });

    const newCursor = match.start + replacement.length;
    editor.selectionStart = newCursor;
    editor.selectionEnd = newCursor;

    runSearch();
    void updatePreview();

    if (searchMatches.length > 0) {
        if (lengthDiff > 0) {
            let nextIdx = searchMatches.findIndex(m => m.start >= newCursor);
            if (nextIdx === -1) nextIdx = searchMatches.length - 1;
            activeSearchIndex = nextIdx;
        } else if (activeSearchIndex >= searchMatches.length) {
            activeSearchIndex = searchMatches.length - 1;
        }
        applyMatchToEditor(activeSearchIndex);
        searchResultsCount.textContent = `${activeSearchIndex + 1} / ${searchMatches.length}`;
    }
    replaceInput.focus();
}

function replaceAll() {
    const query = searchInput.value;
    if (!query) {
        showSaveToast('請先輸入搜尋內容');
        return;
    }
    const caseSensitive = searchCaseSensitive.classList.contains('active');
    const isRegex = searchRegex.classList.contains('active');
    const wholeWord = searchWholeWord.classList.contains('active');
    const { regex, error } = buildSearchRegex(query, caseSensitive, isRegex, wholeWord);
    if (error) {
        showSaveToast('正則錯誤: ' + error);
        return;
    }
    const count = searchMatches.length;
    if (count === 0) {
        showSaveToast('沒有可取代的結果');
        return;
    }

    const replacement = replaceInput.value;
    const before = editor.value;
    const replacedText = before.replace(regex, replacement);

    setEditorValue(replacedText, {
        syncTab: true,
        syncVditor: true,
        refreshPreview: false,
        markModified: true,
    });
    editor.selectionStart = 0;
    editor.selectionEnd = 0;
    runSearch();
    void updatePreview();
    showSaveToast(`已取代 ${count} 處符合項目`);
    searchInput.focus();
}

let searchDebounceTimer = null;
function scheduleSearch() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(runSearch, 80);
}

searchInput.addEventListener('input', scheduleSearch);
searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        navigateSearch(e.shiftKey ? -1 : 1);
    } else if (e.key === 'Escape') {
        e.preventDefault();
        closeSearchPanel();
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateSearch(1);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateSearch(-1);
    }
});

replaceInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) replaceAll();
        else replaceActive();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        closeSearchPanel();
    }
});

searchToggleReplace.addEventListener('click', () => {
    const isShowing = !replaceRow.classList.contains('hidden');
    if (isShowing) {
        replaceRow.classList.add('hidden');
        replaceRow.classList.remove('flex');
        searchReplaceArrow.classList.remove('rotate-90');
    } else {
        replaceRow.classList.remove('hidden');
        replaceRow.classList.add('flex');
        searchReplaceArrow.classList.add('rotate-90');
    }
});

searchCaseSensitive.addEventListener('click', () => {
    searchCaseSensitive.classList.toggle('active');
    runSearch();
});

searchWholeWord.addEventListener('click', () => {
    searchWholeWord.classList.toggle('active');
    runSearch();
});

searchRegex.addEventListener('click', () => {
    searchRegex.classList.toggle('active');
    runSearch();
});

searchNextBtn.addEventListener('click', () => navigateSearch(1));
searchPrevBtn.addEventListener('click', () => navigateSearch(-1));
searchCloseBtn.addEventListener('click', closeSearchPanel);
replaceBtn.addEventListener('click', replaceActive);
replaceAllBtn.addEventListener('click', replaceAll);

// 綁定 IPC 選單事件
window.electronAPI.onMenuFind(() => openSearchPanel({ showReplace: false }));
window.electronAPI.onMenuReplace(() => openSearchPanel({ showReplace: true }));
