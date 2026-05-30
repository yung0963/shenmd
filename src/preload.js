const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File I/O
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),

  // Dialog
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),

  // Directory
  readDir: (dirPath) => ipcRenderer.invoke('read-dir', dirPath),

  // Paths
  getAppPaths: () => ipcRenderer.invoke('get-app-paths'),
  getRecentFiles: () => ipcRenderer.invoke('get-recent-files'),

  // Image paste
  saveImageToAssets: (filePath, imageData, suggestedName) =>
    ipcRenderer.invoke('save-image-to-assets', filePath, imageData, suggestedName),

  // Path helpers
  pathDirname: (filePath) => ipcRenderer.invoke('path-dirname', filePath),
  pathBasename: (filePath) => ipcRenderer.invoke('path-basename', filePath),
  pathJoin: (...segments) => ipcRenderer.invoke('path-join', ...segments),
  pathResolve: (...segments) => ipcRenderer.invoke('path-resolve', ...segments),

  // Binary I/O
  readFileBinary: (filePath) => ipcRenderer.invoke('read-file-binary', filePath),
  saveExportFile: (filePath, base64Data) => ipcRenderer.invoke('save-export-file', filePath, base64Data),

  // Clipboard
  readClipboardImage: () => ipcRenderer.invoke('read-clipboard-image'),
  watchCurrentFile: (filePath) => ipcRenderer.invoke('watch-current-file', filePath),
  unwatchCurrentFile: (filePath) => ipcRenderer.invoke('unwatch-current-file', filePath),

  // Events from main
  onOpenFile: (callback) => ipcRenderer.on('open-file', (event, filePath) => callback(filePath)),
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
  onWatchedFileChanged: (callback) => ipcRenderer.on('watched-file-changed', (event, payload) => callback(payload)),

  // Remove listeners (cleanup)
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
