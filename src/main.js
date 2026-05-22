const { app, BrowserWindow, Menu, dialog, ipcMain, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const os = require('os');

let mainWindow;
let recentFiles = [];
let recentFilesLoaded = false;
let pendingOpenFilePath = null;
let currentFileWatcher = null;
let currentWatchedFilePath = null;
let currentWatcherTimer = null;
const MAX_RECENT = 15;
const RECENT_FILE = path.join(app.getPath('userData'), 'recent.json');
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

function stopWatchingCurrentFile() {
  if (currentWatcherTimer) {
    clearTimeout(currentWatcherTimer);
    currentWatcherTimer = null;
  }
  if (currentFileWatcher) {
    currentFileWatcher.close();
    currentFileWatcher = null;
  }
  currentWatchedFilePath = null;
}

function notifyWatchedFileChanged(filePath, reason = 'change') {
  if (!mainWindow || !filePath) return;
  mainWindow.webContents.send('watched-file-changed', { filePath, reason });
}

function startWatchingCurrentFile(filePath) {
  stopWatchingCurrentFile();
  if (!filePath) return { success: true };

  currentWatchedFilePath = filePath;

  try {
    currentFileWatcher = fsSync.watch(filePath, { persistent: false }, (eventType) => {
      if (currentWatcherTimer) clearTimeout(currentWatcherTimer);
      currentWatcherTimer = setTimeout(() => {
        if (!currentWatchedFilePath) return;
        notifyWatchedFileChanged(currentWatchedFilePath, eventType || 'change');
      }, 120);
    });
    return { success: true };
  } catch (e) {
    stopWatchingCurrentFile();
    return { success: false, error: e.message };
  }
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

function flushPendingOpenFile() {
  if (!mainWindow || !pendingOpenFilePath || mainWindow.webContents.isLoading()) return;
  const filePath = pendingOpenFilePath;
  pendingOpenFilePath = null;
  mainWindow.webContents.send('open-file', filePath);
}

function queueOpenFile(filePath) {
  if (!filePath) return;
  pendingOpenFilePath = filePath;
  addRecentFile(filePath);
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
              if (mainWindow) mainWindow.webContents.send('open-directory', result.filePaths[0]);
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

ipcMain.handle('unwatch-current-file', async () => {
  stopWatchingCurrentFile();
  return { success: true };
});

// App events
app.whenReady().then(async () => {
  await loadRecentFiles();
  createWindow();
  updateMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Dock open-file
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  queueOpenFile(filePath);
});

app.on('will-finish-launching', () => {});
