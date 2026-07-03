const { app, BrowserWindow, Menu, dialog, ipcMain, shell, clipboard } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const util = require('util');
let pty;
try {
  pty = require('@lydell/node-pty');
} catch (e) {
  pty = null;
}

let mainWindow;
let recentFiles = [];
let recentFilesLoaded = false;
let recentFolders = [];
let recentFoldersLoaded = false;
let pendingOpenFilePath = null;
const fileWatchers = new Map();
const MAX_RECENT = 15;
const RECENT_FILE = path.join(app.getPath('userData'), 'recent.json');
const RECENT_FOLDER_FILE = path.join(app.getPath('userData'), 'recent-folders.json');
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
const DEFAULT_TERMINAL_COLS = 100;
const DEFAULT_TERMINAL_ROWS = 28;
const execFileAsync = util.promisify(execFile);
let gitAvailablePromise = null;

const terminalState = {
  process: null,
  sessionId: 0,
  context: {
    filePath: null,
    dirPath: app.getPath('documents'),
    fileType: null
  },
  cwd: app.getPath('documents'),
  cols: DEFAULT_TERMINAL_COLS,
  rows: DEFAULT_TERMINAL_ROWS,
  shell: null,
  startError: null,
  closing: false
};

function stopWatchingCurrentFile(filePath) {
  if (!filePath) {
    for (const watchedFilePath of [...fileWatchers.keys()]) {
      stopWatchingCurrentFile(watchedFilePath);
    }
    return;
  }
  const watcherState = fileWatchers.get(filePath);
  if (!watcherState) return;
  if (watcherState.timer) clearTimeout(watcherState.timer);
  if (watcherState.watcher) watcherState.watcher.close();
  if (watcherState.dirWatcher) watcherState.dirWatcher.close();
  fsSync.unwatchFile(filePath, watcherState.pollListener);
  fileWatchers.delete(filePath);
}

function getPreferredTerminalCwd(explicitCwd) {
  if (explicitCwd && fsSync.existsSync(explicitCwd)) return explicitCwd;
  if (terminalState.context.dirPath && fsSync.existsSync(terminalState.context.dirPath)) return terminalState.context.dirPath;
  return app.getPath('documents');
}

function sendTerminalEvent(channel, payload = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel, payload);
}

function emitTerminalStatus(extra = {}) {
  sendTerminalEvent('terminal:status', {
    running: Boolean(terminalState.process),
    shell: terminalState.shell,
    cwd: terminalState.cwd,
    context: terminalState.context,
    error: terminalState.startError,
    ...extra
  });
}

function clearTerminalProcess() {
  if (!terminalState.process) return;
  terminalState.closing = true;
  try {
    terminalState.process.kill();
  } catch (e) {}
  terminalState.process = null;
}

function resolveTerminalShell() {
  const envShell = process.env.SHELL;
  if (envShell && fsSync.existsSync(envShell)) return envShell;
  return '/bin/zsh';
}

function handleTerminalOutput(sessionId, data) {
  if (terminalState.sessionId !== sessionId) return;
  sendTerminalEvent('terminal:data', { data });
}

function handleTerminalExit(sessionId, exitCode, signal) {
  if (terminalState.sessionId !== sessionId) return;
  const wasClosing = terminalState.closing;
  terminalState.closing = false;
  terminalState.process = null;
  sendTerminalEvent('terminal:exit', { exitCode, signal });
  emitTerminalStatus({ reason: wasClosing ? 'closed' : 'exit' });
}

function startPtySession(shellPath, cwd, options, sessionId) {
  const spawnedProcess = pty.spawn(shellPath, ['-l'], {
    name: 'xterm-256color',
    cols: Math.max(20, Number(options.cols) || terminalState.cols || DEFAULT_TERMINAL_COLS),
    rows: Math.max(10, Number(options.rows) || terminalState.rows || DEFAULT_TERMINAL_ROWS),
    cwd,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor'
    }
  });

  terminalState.process = spawnedProcess;
  spawnedProcess.onData((data) => {
    if (terminalState.process !== spawnedProcess) return;
    handleTerminalOutput(sessionId, data);
  });
  spawnedProcess.onExit(({ exitCode, signal }) => {
    handleTerminalExit(sessionId, exitCode, signal);
  });
  return { success: true, cwd, shell: shellPath };
}

function startTerminalSession(options = {}) {
  if (!pty) {
    terminalState.startError = '@lydell/node-pty 尚未載入，無法啟動 terminal';
    emitTerminalStatus({ reason: 'missing-pty-package' });
    sendTerminalEvent('terminal:error', { message: terminalState.startError });
    return { success: false, error: terminalState.startError };
  }

  if (terminalState.process) {
    terminalState.cwd = getPreferredTerminalCwd(options.cwd);
    emitTerminalStatus({ reason: 'already-running' });
    return { success: true, reused: true, cwd: terminalState.cwd };
  }

  const shellPath = resolveTerminalShell();
  const cwd = getPreferredTerminalCwd(options.cwd);

  try {
    terminalState.shell = shellPath;
    terminalState.cwd = cwd;
    terminalState.startError = null;
    terminalState.closing = false;
    const sessionId = terminalState.sessionId + 1;
    terminalState.sessionId = sessionId;
    const result = startPtySession(shellPath, cwd, options, sessionId);
    terminalState.startError = null;

    emitTerminalStatus({ reason: 'started' });
    return result;
  } catch (e) {
    terminalState.startError = e.message;
    terminalState.process = null;
    emitTerminalStatus({ reason: 'start-error' });
    sendTerminalEvent('terminal:error', { message: e.message });
    return { success: false, error: e.message };
  }
}

function ensureTerminalSession(options = {}) {
  if (terminalState.process) return { success: true, reused: true, cwd: terminalState.cwd };
  return startTerminalSession(options);
}

function writeTerminal(data) {
  if (!terminalState.process) {
    return { success: false, error: terminalState.startError || 'terminal 未啟動' };
  }
  terminalState.process.write(data);
  return { success: true };
}

function sendTerminalCommand(command, options = {}) {
  const { execute = true, cwd = null } = options;
  const commandText = String(command || '');
  const ensured = ensureTerminalSession({ cwd });
  if (!ensured.success || !terminalState.process) {
    return { success: false, error: ensured.error || 'terminal 未啟動' };
  }
  terminalState.process.write(commandText + (execute ? '\r' : ''));
  if (/^\s*cd(\s|$)/.test(commandText)) {
    const match = commandText.match(/^\s*cd\s+(.+)\s*$/);
    if (match) {
      const rawTarget = match[1].trim();
      const cleaned = rawTarget.replace(/^['"]|['"]$/g, '');
      if (cleaned) {
        terminalState.cwd = cleaned;
        emitTerminalStatus({ reason: 'cwd-updated' });
      }
    }
  }
  return { success: true };
}

function notifyWatchedFileChanged(filePath, reason = 'change') {
  if (!mainWindow || !filePath) return;
  mainWindow.webContents.send('watched-file-changed', { filePath, reason });
}

function startWatchingCurrentFile(filePath) {
  if (!filePath) return { success: true };
  if (fileWatchers.has(filePath)) return { success: true };

  try {
    const watcherState = { watcher: null, dirWatcher: null, timer: null, pollListener: null };
    const notify = (reason) => {
      if (watcherState.timer) clearTimeout(watcherState.timer);
      watcherState.timer = setTimeout(() => {
        if (!fileWatchers.has(filePath)) return;
        notifyWatchedFileChanged(filePath, reason || 'change');
      }, 120);
    };

    watcherState.pollListener = (curr, prev) => {
      const currExists = curr && curr.mtimeMs > 0;
      const prevExists = prev && prev.mtimeMs > 0;
      if (!currExists && !prevExists) return;
      if (!currExists && prevExists) {
        notify('delete');
        return;
      }
      if (currExists && !prevExists) {
        notify('create');
        return;
      }
      if (curr.mtimeMs !== prev.mtimeMs || curr.size !== prev.size) {
        notify('change');
      }
    };
    fsSync.watchFile(filePath, { interval: 250, persistent: false }, watcherState.pollListener);

    const dirPath = path.dirname(filePath);
    const baseName = path.basename(filePath);
    watcherState.dirWatcher = fsSync.watch(dirPath, { persistent: false }, (eventType, changedName) => {
      if (!changedName || changedName === baseName) {
        notify(eventType || 'rename');
      }
    });

    watcherState.watcher = { close() {} };
    fileWatchers.set(filePath, watcherState);
    return { success: true };
  } catch (e) {
    stopWatchingCurrentFile(filePath);
    return { success: false, error: e.message };
  }
}

async function ensureGitAvailable() {
  if (!gitAvailablePromise) {
    gitAvailablePromise = execFileAsync('git', ['--version'], { maxBuffer: 1024 * 1024 })
      .then(() => true)
      .catch(() => false);
  }
  return gitAvailablePromise;
}

function getGitWorkingDir(targetPath) {
  if (!targetPath) return null;
  try {
    const stat = fsSync.statSync(targetPath);
    return stat.isDirectory() ? targetPath : path.dirname(targetPath);
  } catch (e) {
    const fallback = path.extname(targetPath) ? path.dirname(targetPath) : targetPath;
    return fsSync.existsSync(fallback) ? fallback : null;
  }
}

async function runGit(args, cwd) {
  try {
    const { stdout, stderr } = await execFileAsync('git', args, {
      cwd,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true
    });
    return { success: true, stdout, stderr };
  } catch (e) {
    return {
      success: false,
      stdout: e.stdout || '',
      stderr: e.stderr || '',
      error: e.message,
      code: e.code
    };
  }
}

function parseGitBranch(line = '') {
  const raw = String(line || '').replace(/^##\s*/, '').trim();
  if (!raw) return { branch: 'HEAD', ahead: 0, behind: 0 };
  const noCommitMatch = raw.match(/^No commits yet on (.+)$/);
  if (noCommitMatch) {
    return { branch: noCommitMatch[1].trim() || 'HEAD', ahead: 0, behind: 0 };
  }
  const branchPart = raw.split('...')[0].split(' ')[0].trim() || 'HEAD';
  const aheadMatch = raw.match(/ahead (\d+)/);
  const behindMatch = raw.match(/behind (\d+)/);
  return {
    branch: branchPart,
    ahead: aheadMatch ? Number(aheadMatch[1]) : 0,
    behind: behindMatch ? Number(behindMatch[1]) : 0
  };
}

function parseGitStatusLines(lines = []) {
  const summary = {
    changedFiles: 0,
    stagedFiles: 0,
    unstagedFiles: 0,
    untrackedFiles: 0,
    files: []
  };
  for (const line of lines) {
    if (!line || line.startsWith('##')) continue;
    const x = line[0] || ' ';
    const y = line[1] || ' ';
    const file = line.slice(3).trim();
    if (!file) continue;
    summary.changedFiles += 1;
    if (x === '?' && y === '?') {
      summary.untrackedFiles += 1;
    } else {
      if (x !== ' ') summary.stagedFiles += 1;
      if (y !== ' ') summary.unstagedFiles += 1;
    }
    summary.files.push({
      path: file,
      x,
      y
    });
  }
  return summary;
}

function parseGitNumstat(stdout = '') {
  const stats = { insertions: 0, deletions: 0 };
  for (const line of String(stdout || '').split('\n')) {
    if (!line.trim()) continue;
    const [added, removed] = line.split('\t');
    const addValue = Number(added);
    const removeValue = Number(removed);
    if (Number.isFinite(addValue)) stats.insertions += addValue;
    if (Number.isFinite(removeValue)) stats.deletions += removeValue;
  }
  return stats;
}

async function getGitContext(targetPath) {
  const targetDir = getGitWorkingDir(targetPath);
  if (!targetDir) {
    return { success: true, available: true, isRepo: false, targetDir: null };
  }

  const available = await ensureGitAvailable();
  if (!available) {
    return {
      success: true,
      available: false,
      isRepo: false,
      targetDir,
      error: '系統找不到 Git'
    };
  }

  const topLevel = await runGit(['rev-parse', '--show-toplevel'], targetDir);
  if (!topLevel.success) {
    return {
      success: true,
      available: true,
      isRepo: false,
      targetDir
    };
  }

  const repoRoot = topLevel.stdout.trim();
  const statusResult = await runGit(['status', '--porcelain=1', '--branch'], repoRoot);
  if (!statusResult.success) {
    return {
      success: false,
      available: true,
      isRepo: true,
      repoRoot,
      targetDir,
      error: statusResult.stderr || statusResult.error || 'Git 狀態讀取失敗'
    };
  }

  const statusLines = statusResult.stdout.split('\n').filter(Boolean);
  const branchMeta = parseGitBranch(statusLines[0] || '');
  const fileSummary = parseGitStatusLines(statusLines.slice(1));
  const diffResult = await runGit(['diff', 'HEAD', '--numstat'], repoRoot);
  const lineStats = diffResult.success ? parseGitNumstat(diffResult.stdout) : { insertions: 0, deletions: 0 };

  return {
    success: true,
    available: true,
    isRepo: true,
    targetDir,
    repoRoot,
    repoName: path.basename(repoRoot) || repoRoot,
    branch: branchMeta.branch,
    ahead: branchMeta.ahead,
    behind: branchMeta.behind,
    changedFiles: fileSummary.changedFiles,
    stagedFiles: fileSummary.stagedFiles,
    unstagedFiles: fileSummary.unstagedFiles,
    untrackedFiles: fileSummary.untrackedFiles,
    insertions: lineStats.insertions,
    deletions: lineStats.deletions,
    files: fileSummary.files.slice(0, 8)
  };
}

async function gitInitRepo(targetPath) {
  const targetDir = getGitWorkingDir(targetPath);
  if (!targetDir) return { success: false, error: '找不到資料夾' };
  const result = await runGit(['init'], targetDir);
  if (!result.success) {
    return { success: false, error: result.stderr || result.error || 'Git 初始化失敗' };
  }
  return { success: true };
}

async function gitCommit(repoRoot, message) {
  const addResult = await runGit(['add', '-A'], repoRoot);
  if (!addResult.success) {
    return { success: false, error: addResult.stderr || addResult.error || 'Git 暫存失敗' };
  }
  const commitResult = await runGit(['commit', '-m', message], repoRoot);
  if (!commitResult.success) {
    return { success: false, error: commitResult.stderr || commitResult.error || 'Git 提交失敗' };
  }
  return { success: true, output: commitResult.stdout };
}

async function gitPush(repoRoot) {
  const pushResult = await runGit(['push'], repoRoot);
  if (!pushResult.success) {
    return { success: false, error: pushResult.stderr || pushResult.error || 'Git 推送失敗' };
  }
  return { success: true, output: pushResult.stdout };
}

async function gitRestorePath(repoRoot, targetPath) {
  const relativePath = path.relative(repoRoot, targetPath);
  if (!relativePath || relativePath.startsWith('..')) {
    return { success: false, error: '檔案不在 Git 倉庫內' };
  }
  const statusResult = await runGit(['status', '--porcelain=1', '--', relativePath], repoRoot);
  if (!statusResult.success) {
    return { success: false, error: statusResult.stderr || statusResult.error || 'Git 狀態讀取失敗' };
  }
  const lines = statusResult.stdout.split('\n').filter(Boolean);
  const onlyUntracked = lines.length > 0 && lines.every(line => line.startsWith('??'));
  if (onlyUntracked) {
    try {
      await fs.rm(targetPath, { recursive: true, force: true });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  const restoreResult = await runGit(['restore', '--source=HEAD', '--staged', '--worktree', '--', relativePath], repoRoot);
  if (!restoreResult.success) {
    return { success: false, error: restoreResult.stderr || restoreResult.error || 'Git 還原失敗' };
  }
  return { success: true };
}

async function gitRestoreAll(repoRoot) {
  const hasHead = await runGit(['rev-parse', '--verify', 'HEAD'], repoRoot);
  if (hasHead.success) {
    const resetResult = await runGit(['reset', '--hard', 'HEAD'], repoRoot);
    if (!resetResult.success) {
      return { success: false, error: resetResult.stderr || resetResult.error || 'Git 還原失敗' };
    }
  }
  const cleanResult = await runGit(['clean', '-fd'], repoRoot);
  if (!cleanResult.success) {
    return { success: false, error: cleanResult.stderr || cleanResult.error || 'Git 清理未追蹤檔案失敗' };
  }
  return { success: true };
}

// 載入最近開啟
async function loadRecentFiles() {
  try {
    const data = await fs.readFile(RECENT_FILE, 'utf8');
    const parsed = JSON.parse(data);
    recentFiles = parsed.filter(f => typeof f === 'string' && f.length > 0).slice(0, MAX_RECENT);
  } catch (e) {
    recentFiles = [];
  }
  recentFilesLoaded = true;
}

async function saveRecentFiles() {
  try {
    await fs.writeFile(RECENT_FILE, JSON.stringify(recentFiles, null, 2), 'utf8');
  } catch (e) {}
}

async function loadRecentFolders() {
  try {
    const data = await fs.readFile(RECENT_FOLDER_FILE, 'utf8');
    const parsed = JSON.parse(data);
    recentFolders = parsed.filter(f => typeof f === 'string' && f.length > 0).slice(0, MAX_RECENT);
  } catch (e) {
    recentFolders = [];
  }
  recentFoldersLoaded = true;
}

async function saveRecentFolders() {
  try {
    await fs.writeFile(RECENT_FOLDER_FILE, JSON.stringify(recentFolders, null, 2), 'utf8');
  } catch (e) {}
}

async function addRecentFile(filePath) {
  if (!filePath) return;
  if (!recentFilesLoaded) await loadRecentFiles();
  recentFiles = recentFiles.filter(f => f !== filePath);
  recentFiles.unshift(filePath);
  if (recentFiles.length > MAX_RECENT) recentFiles = recentFiles.slice(0, MAX_RECENT);
  await saveRecentFiles();
  app.addRecentDocument(filePath);
  updateMenu();
  if (mainWindow) mainWindow.webContents.send('recent-files-updated', recentFiles);
}

async function addRecentFolder(folderPath) {
  if (!folderPath) return;
  if (!recentFoldersLoaded) await loadRecentFolders();
  recentFolders = recentFolders.filter(f => f !== folderPath);
  recentFolders.unshift(folderPath);
  if (recentFolders.length > MAX_RECENT) recentFolders = recentFolders.slice(0, MAX_RECENT);
  await saveRecentFolders();
  updateMenu();
  if (mainWindow) mainWindow.webContents.send('recent-folders-updated', recentFolders);
}

function flushPendingOpenFile() {
  if (!mainWindow || !pendingOpenFilePath) return;
  const filePath = pendingOpenFilePath;
  pendingOpenFilePath = null;
  mainWindow.webContents.send('open-file', filePath);
}

function bringMainWindowToFront() {
  if (!mainWindow) return;

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }

  app.focus({ steal: true });
  mainWindow.focus();
}

function queueOpenFile(filePath) {
  if (!filePath) return;
  pendingOpenFilePath = filePath;
  addRecentFile(filePath);
  bringMainWindowToFront();
  flushPendingOpenFile();
}

function createWindow() {
  const settings = loadSettingsSync();
  const bounds = settings.windowBounds || { width: 1400, height: 900 };

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
      allowRunningInsecureContent: true
    },
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.webContents.once('did-finish-load', flushPendingOpenFile);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (settings.maximized) mainWindow.maximize();
    if (pendingOpenFilePath) bringMainWindowToFront();
  });

  mainWindow.on('close', () => {
    const s = { ...loadSettingsSync(), windowBounds: mainWindow.getBounds(), maximized: mainWindow.isMaximized() };
    fsSync.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2), 'utf8');
  });

  mainWindow.on('closed', () => {
    stopWatchingCurrentFile();
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function loadSettingsSync() {
  try {
    return JSON.parse(fsSync.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}

function buildRecentMenuItems() {
  return recentFiles.map(filePath => ({
    label: path.basename(filePath),
    accelerator: '',
    click: () => {
      if (mainWindow) mainWindow.webContents.send('open-file', filePath);
    }
  }));
}

function buildRecentFolderMenuItems() {
  return recentFolders.map(folderPath => ({
    label: path.basename(folderPath) || folderPath,
    accelerator: '',
    click: async () => {
      await addRecentFolder(folderPath);
      if (mainWindow) mainWindow.webContents.send('open-folder', folderPath);
    }
  }));
}

function updateMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: '檔案',
      submenu: [
        {
          label: '新增檔案',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-new-file');
          }
        },
        {
          label: '開啟檔案…',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'mkdn'] },
                { name: 'CSV', extensions: ['csv'] },
                { name: '所有檔案', extensions: ['*'] }
              ]
            });
            if (!result.canceled && result.filePaths.length > 0) {
              const fp = result.filePaths[0];
              addRecentFile(fp);
              if (mainWindow) mainWindow.webContents.send('open-file', fp);
            }
          }
        },
        {
          label: '開啟資料夾…',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openDirectory']
            });
            if (!result.canceled && result.filePaths.length > 0) {
              const folderPath = result.filePaths[0];
              await addRecentFolder(folderPath);
              if (mainWindow) mainWindow.webContents.send('open-folder', folderPath);
            }
          }
        },
        { type: 'separator' },
        {
          label: '儲存',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-save');
          }
        },
        {
          label: '另存新檔…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-save-as');
          }
        },
        { type: 'separator' },
        {
          label: '最近開啟的檔案',
          submenu: [
            ...buildRecentMenuItems(),
            ...(recentFiles.length ? [{ type: 'separator' }] : []),
            {
              label: '清除最近開啟的檔案',
              enabled: recentFiles.length > 0,
              click: () => {
                recentFiles = [];
                saveRecentFiles();
                app.clearRecentDocuments();
                updateMenu();
                if (mainWindow) mainWindow.webContents.send('recent-files-updated', recentFiles);
              }
            }
          ]
        },
        {
          label: '最近開啟的資料夾',
          submenu: [
            ...buildRecentFolderMenuItems(),
            ...(recentFolders.length ? [{ type: 'separator' }] : []),
            {
              label: '清除最近開啟的資料夾',
              enabled: recentFolders.length > 0,
              click: () => {
                recentFolders = [];
                saveRecentFolders();
                updateMenu();
                if (mainWindow) mainWindow.webContents.send('recent-folders-updated', recentFolders);
              }
            }
          ]
        },
        { type: 'separator' },
        { role: 'close', label: '關閉視窗' }
      ]
    },
    {
      label: '編輯',
      submenu: [
        { role: 'undo', label: '復原' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪下' },
        { role: 'copy', label: '複製' },
        { role: 'paste', label: '貼上' },
        { role: 'selectAll', label: '全選' },
        { type: 'separator' },
        {
          label: '尋找',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-find');
          }
        },
        {
          label: '取代',
          accelerator: 'CmdOrCtrl+Alt+F',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-replace');
          }
        },
        { type: 'separator' },
        {
          label: '貼上圖片',
          accelerator: 'CmdOrCtrl+Shift+V',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-paste-image');
          }
        }
      ]
    },
    {
      label: '檢視',
      submenu: [
        {
          label: '編輯模式',
          accelerator: 'CmdOrCtrl+1',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('set-view-mode', 'edit');
          }
        },
        {
          label: '分割檢視',
          accelerator: 'CmdOrCtrl+2',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('set-view-mode', 'split');
          }
        },
        {
          label: '預覽模式',
          accelerator: 'CmdOrCtrl+3',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('set-view-mode', 'preview');
          }
        },
        { type: 'separator' },
        {
          label: '放大字型',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('font-size-change', 1);
          }
        },
        {
          label: '縮小字型',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('font-size-change', -1);
          }
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: '匯出',
      submenu: [
        {
          label: '匯出 PDF…',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-export-pdf');
          }
        },
        {
          label: '匯出 Word…',
          accelerator: 'CmdOrCtrl+Shift+W',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-export-word');
          }
        },
        {
          label: 'CSV 轉 Excel…',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-export-excel');
          }
        }
      ]
    },
    {
      label: '視窗',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: '縮放' },
        { type: 'separator' },
        { role: 'front', label: '全部置前' }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC handlers

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return { success: true, content };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    await fs.writeFile(filePath, content, 'utf8');
    addRecentFile(filePath);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('show-save-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

ipcMain.handle('show-open-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

ipcMain.handle('open-folder-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const folderPath = result.filePaths[0];
    await addRecentFolder(folderPath);
    return { success: true, filePath: folderPath };
  }
  return { success: false, canceled: true };
});

ipcMain.handle('read-dir', async (event, dirPath) => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const list = entries.map(e => ({
      name: e.name,
      isDirectory: e.isDirectory(),
      isFile: e.isFile()
    }));
    list.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name, 'zh-TW');
    });
    return { success: true, list };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('stat-path', async (event, targetPath) => {
  try {
    const stat = await fs.stat(targetPath);
    return {
      success: true,
      stat: {
        path: targetPath,
        isDirectory: stat.isDirectory(),
        isFile: stat.isFile(),
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        ext: path.extname(targetPath).replace(/^\./, '').toLowerCase(),
        name: path.basename(targetPath)
      }
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('get-app-paths', () => {
  return {
    home: app.getPath('home'),
    documents: app.getPath('documents'),
    downloads: app.getPath('downloads'),
    desktop: app.getPath('desktop')
  };
});

ipcMain.handle('get-recent-files', () => {
  return recentFiles;
});

ipcMain.handle('get-recent-folders', () => {
  return recentFolders;
});

ipcMain.handle('add-recent-file', async (event, filePath) => {
  await addRecentFile(filePath);
  return { success: true };
});

ipcMain.handle('add-recent-folder', async (event, folderPath) => {
  await addRecentFolder(folderPath);
  return { success: true };
});

ipcMain.handle('save-image-to-assets', async (event, filePath, imageData, suggestedName) => {
  try {
    const dir = path.dirname(filePath);
    const assetsDir = path.join(dir, 'assets');
    if (!fsSync.existsSync(assetsDir)) {
      fsSync.mkdirSync(assetsDir, { recursive: true });
    }
    const fileName = suggestedName || `paste-${Date.now()}.png`;
    const imagePath = path.join(assetsDir, fileName);
    const buffer = Buffer.from(imageData, 'base64');
    await fs.writeFile(imagePath, buffer);
    return { success: true, relativePath: path.join('assets', fileName).replace(/\\/g, '/') };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('path-dirname', (event, filePath) => path.dirname(filePath));
ipcMain.handle('path-basename', (event, filePath) => path.basename(filePath));
ipcMain.handle('path-join', (event, ...segments) => path.join(...segments));
ipcMain.handle('path-resolve', (event, ...segments) => path.resolve(...segments));
ipcMain.handle('git:get-context', async (event, targetPath) => {
  return await getGitContext(targetPath);
});
ipcMain.handle('git:init-repo', async (event, targetPath) => {
  return await gitInitRepo(targetPath);
});
ipcMain.handle('git:commit', async (event, repoRoot, message) => {
  return await gitCommit(repoRoot, message);
});
ipcMain.handle('git:push', async (event, repoRoot) => {
  return await gitPush(repoRoot);
});
ipcMain.handle('git:restore-path', async (event, repoRoot, targetPath) => {
  return await gitRestorePath(repoRoot, targetPath);
});
ipcMain.handle('git:restore-all', async (event, repoRoot) => {
  return await gitRestoreAll(repoRoot);
});

ipcMain.handle('read-file-binary', async (event, filePath) => {
  try {
    const buffer = await fs.readFile(filePath);
    return { success: true, data: buffer.toString('base64') };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('save-export-file', async (event, filePath, base64Data) => {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile(filePath, buffer);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('read-clipboard-image', () => {
  try {
    const image = clipboard.readImage('clipboard');
    if (image.isEmpty()) return { hasImage: false };
    const pngBuffer = image.toPNG();
    return { hasImage: true, base64: pngBuffer.toString('base64') };
  } catch (e) {
    return { hasImage: false, error: e.message };
  }
});

ipcMain.handle('watch-current-file', async (event, filePath) => {
  return startWatchingCurrentFile(filePath);
});

ipcMain.handle('unwatch-current-file', async (event, filePath) => {
  stopWatchingCurrentFile(filePath);
  return { success: true };
});

ipcMain.handle('terminal:create', async (event, options = {}) => {
  if (Number.isFinite(options.cols)) terminalState.cols = Math.max(20, Number(options.cols));
  if (Number.isFinite(options.rows)) terminalState.rows = Math.max(10, Number(options.rows));
  if (options.cwd) terminalState.cwd = getPreferredTerminalCwd(options.cwd);
  return startTerminalSession(options);
});

ipcMain.handle('terminal:write', async (event, data) => {
  return writeTerminal(String(data || ''));
});

ipcMain.handle('terminal:resize', async (event, cols, rows) => {
  if (Number.isFinite(cols)) terminalState.cols = Math.max(20, Number(cols));
  if (Number.isFinite(rows)) terminalState.rows = Math.max(10, Number(rows));
  if (terminalState.process) {
    try {
      terminalState.process.resize(terminalState.cols, terminalState.rows);
      emitTerminalStatus({ reason: 'resized' });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  return { success: true, deferred: true };
});

ipcMain.handle('terminal:kill', async () => {
  clearTerminalProcess();
  emitTerminalStatus({ reason: 'killed' });
  return { success: true };
});

ipcMain.handle('terminal:restart', async (event, options = {}) => {
  clearTerminalProcess();
  return startTerminalSession(options);
});

ipcMain.handle('terminal:send-command', async (event, text, options = {}) => {
  return sendTerminalCommand(text, options);
});

ipcMain.handle('terminal:update-context', async (event, context = {}) => {
  terminalState.context = {
    filePath: context.filePath || null,
    dirPath: getPreferredTerminalCwd(context.dirPath || null),
    fileType: context.fileType || null
  };
  if (!terminalState.process) {
    terminalState.cwd = terminalState.context.dirPath;
  }
  emitTerminalStatus({ reason: 'context-updated' });
  return { success: true, context: terminalState.context, cwd: terminalState.cwd };
});

// App events
app.whenReady().then(async () => {
  await loadRecentFiles();
  await loadRecentFolders();
  createWindow();
  updateMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else bringMainWindowToFront();
  });
});

app.on('window-all-closed', () => {
  clearTerminalProcess();
  if (process.platform !== 'darwin') app.quit();
});

// Dock open-file
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  queueOpenFile(filePath);
});

app.on('will-finish-launching', () => {});
