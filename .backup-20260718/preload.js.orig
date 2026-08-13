const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File I/O
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),

  // Dialog
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  showOpenFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),

  // Directory
  readDir: (dirPath) => ipcRenderer.invoke('read-dir', dirPath),
  statPath: (targetPath) => ipcRenderer.invoke('stat-path', targetPath),

  // Paths
  getAppPaths: () => ipcRenderer.invoke('get-app-paths'),
  getRecentFiles: () => ipcRenderer.invoke('get-recent-files'),
  getRecentFolders: () => ipcRenderer.invoke('get-recent-folders'),
  addRecentFile: (filePath) => ipcRenderer.invoke('add-recent-file', filePath),
  addRecentFolder: (folderPath) => ipcRenderer.invoke('add-recent-folder', folderPath),

  // Image paste
  saveImageToAssets: (filePath, imageData, suggestedName) =>
    ipcRenderer.invoke('save-image-to-assets', filePath, imageData, suggestedName),

  // Path helpers
  pathDirname: (filePath) => ipcRenderer.invoke('path-dirname', filePath),
  pathBasename: (filePath) => ipcRenderer.invoke('path-basename', filePath),
  pathJoin: (...segments) => ipcRenderer.invoke('path-join', ...segments),
  pathResolve: (...segments) => ipcRenderer.invoke('path-resolve', ...segments),
  gitGetContext: (targetPath) => ipcRenderer.invoke('git:get-context', targetPath),
  gitInitRepo: (targetPath) => ipcRenderer.invoke('git:init-repo', targetPath),
  gitCommit: (repoRoot, message) => ipcRenderer.invoke('git:commit', repoRoot, message),
  gitPush: (repoRoot) => ipcRenderer.invoke('git:push', repoRoot),
  gitRestorePath: (repoRoot, targetPath) => ipcRenderer.invoke('git:restore-path', repoRoot, targetPath),
  gitRestoreAll: (repoRoot) => ipcRenderer.invoke('git:restore-all', repoRoot),

  // Binary I/O
  readFileBinary: (filePath) => ipcRenderer.invoke('read-file-binary', filePath),
  saveExportFile: (filePath, base64Data) => ipcRenderer.invoke('save-export-file', filePath, base64Data),

  // Clipboard
  readClipboardImage: () => ipcRenderer.invoke('read-clipboard-image'),
  watchCurrentFile: (filePath) => ipcRenderer.invoke('watch-current-file', filePath),
  unwatchCurrentFile: (filePath) => ipcRenderer.invoke('unwatch-current-file', filePath),

  // Terminal
  terminalCreate: (options) => ipcRenderer.invoke('terminal:create', options),
  terminalWrite: (data) => ipcRenderer.invoke('terminal:write', data),
  terminalResize: (cols, rows) => ipcRenderer.invoke('terminal:resize', cols, rows),
  terminalKill: () => ipcRenderer.invoke('terminal:kill'),
  terminalRestart: (options) => ipcRenderer.invoke('terminal:restart', options),
  terminalSendCommand: (text, options) => ipcRenderer.invoke('terminal:send-command', text, options),
  terminalUpdateContext: (context) => ipcRenderer.invoke('terminal:update-context', context),

  // Events from main
  onOpenFile: (callback) => ipcRenderer.on('open-file', (event, filePath) => callback(filePath)),
  onOpenFolder: (callback) => ipcRenderer.on('open-folder', (event, folderPath) => callback(folderPath)),
  onMenuNewFile: (callback) => ipcRenderer.on('menu-new-file', () => callback()),
  onMenuSave: (callback) => ipcRenderer.on('menu-save', () => callback()),
  onMenuSaveAs: (callback) => ipcRenderer.on('menu-save-as', () => callback()),
  onMenuPasteImage: (callback) => ipcRenderer.on('menu-paste-image', () => callback()),
  onMenuFind: (callback) => ipcRenderer.on('menu-find', () => callback()),
  onMenuReplace: (callback) => ipcRenderer.on('menu-replace', () => callback()),
  onMenuExportPdf: (callback) => ipcRenderer.on('menu-export-pdf', () => callback()),
  onMenuExportWord: (callback) => ipcRenderer.on('menu-export-word', () => callback()),
  onMenuExportExcel: (callback) => ipcRenderer.on('menu-export-excel', () => callback()),
  onSetViewMode: (callback) => ipcRenderer.on('set-view-mode', (event, mode) => callback(mode)),
  onFontSizeChange: (callback) => ipcRenderer.on('font-size-change', (event, delta) => callback(delta)),
  onRecentFilesUpdated: (callback) => ipcRenderer.on('recent-files-updated', (event, files) => callback(files)),
  onRecentFoldersUpdated: (callback) => ipcRenderer.on('recent-folders-updated', (event, folders) => callback(folders)),
  onWatchedFileChanged: (callback) => ipcRenderer.on('watched-file-changed', (event, payload) => callback(payload)),
  onTerminalData: (callback) => ipcRenderer.on('terminal:data', (event, payload) => callback(payload)),
  onTerminalExit: (callback) => ipcRenderer.on('terminal:exit', (event, payload) => callback(payload)),
  onTerminalStatus: (callback) => ipcRenderer.on('terminal:status', (event, payload) => callback(payload)),
  onTerminalError: (callback) => ipcRenderer.on('terminal:error', (event, payload) => callback(payload)),

  // Remove listeners (cleanup)
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
