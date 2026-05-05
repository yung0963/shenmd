# shenMD

> 專為 macOS 打造的桌面級 Markdown 編輯器 —— 基於 Electron 開發。<br>
> A powerful native Markdown editor for macOS, built with Electron.

---

## 功能特色 / Features

- **即時雙欄預覽** — 左側編輯、右側即時渲染，支援編輯 / 分割 / 預覽三種模式<br>
  **Live dual-pane preview** — edit on the left, render on the right; switch between edit, split, and preview modes

- **原生檔案操作** — 直接讀寫本地 `.md` / `.csv`，Cmd+S 秒速儲存<br>
  **Native file I/O** — read/write local `.md` / `.csv` files directly with instant Cmd+S save

- **圖片貼上自動儲存** — 貼上的圖片自動存入 `assets/` 資料夾，並使用相對路徑，VSCode 也能正確顯示<br>
  **Paste-to-save images** — pasted images are auto-saved to the `assets/` folder with relative paths, fully compatible with VSCode

- **Mermaid 圖表支援** — 流程圖、序列圖、甘特圖等即時渲染<br>
  **Mermaid diagrams** — flowcharts, sequence diagrams, gantt charts rendered in real time

- **程式碼高亮** — 基於 highlight.js，支援一鍵複製程式碼區塊<br>
  **Syntax highlighting** — powered by highlight.js with one-click code block copy

- **PDF 匯出** — 可調整紙張大小、邊距、方向，完美保留排版<br>
  **PDF export** — customizable page size, margins, and orientation with perfect layout preservation

- **Word (.docx) 匯出** — 完整保留表格、圖片、標題層級與樣式<br>
  **Word (.docx) export** — fully preserves tables, images, heading levels, and styles

- **Excel (.xlsx) 匯出** — CSV 模式下一鍵轉換，自動調整欄寬<br>
  **Excel (.xlsx) export** — one-click CSV-to-Excel conversion with auto column widths

- **側邊欄資料夾瀏覽** — 樹狀結構瀏覽本地專案，點擊即開啟<br>
  **Sidebar file browser** — tree-view folder navigation with click-to-open

- **Mac 原生體驗** — Menu Bar、Dock 拖放、最近開啟檔案、視窗狀態記憶<br>
  **Native macOS experience** — Menu Bar, Dock drag-and-drop, recent files, window state persistence

- **多編碼 CSV 支援** — 自動偵測 Big5 / UTF-8 / UTF-16 / GB18030<br>
  **Multi-encoding CSV support** — auto-detects Big5 / UTF-8 / UTF-16 / GB18030

---

## 安裝 / Installation

### 方式一：下載 DMG（推薦）/ Method 1: Download DMG (Recommended)

1. 前往 [Releases](https://github.com/yung0963/shenmd/releases) 頁面<br>
   Go to the [Releases](https://github.com/yung0963/shenmd/releases) page
2. 根據你的 Mac 晶片選擇版本：<br>
   Choose the version for your Mac chip:
   - **Apple Silicon (M1/M2/M3)** → `shenMD-x.x.x-arm64.dmg`
   - **Intel Mac** → `shenMD-x.x.x.dmg`
3. 雙擊掛載 DMG，將 **shenMD** 拖入 **Applications** 資料夾<br>
   Double-click to mount the DMG and drag **shenMD** into **Applications**

> ⚠️ **首次開啟注意 / First-time launch note**：因未做 Apple 開發者簽名，首次開啟時 macOS 會阻擋。請到「系統設定 → 隱私權與安全性」點擊「仍要開啟」。<br>
> Because the app is not Apple-notarized, macOS may block it on first launch. Go to **System Settings → Privacy & Security** and click **Open Anyway**.

### 方式二：自行編譯 / Method 2: Build from Source

```bash
git clone https://github.com/yung0963/shenmd.git
cd shenmd
npm install
npm run dist
```

編譯完成後，安裝檔位於 `dist/` 目錄。<br>
After building, the installer will be in the `dist/` directory.

---

## 使用指南 / Usage Guide

### 基本操作 / Basic Shortcuts

| 快捷鍵 / Shortcut | 功能 / Function |
|---|---|
| `Cmd + N` | 新建檔案 / New file |
| `Cmd + O` | 開啟檔案 / Open file |
| `Cmd + Shift + O` | 開啟資料夾 / Open folder |
| `Cmd + S` | 儲存 / Save |
| `Cmd + Shift + S` | 另存新檔 / Save as |
| `Cmd + 1 / 2 / 3` | 切換編輯/分割/預覽 / Toggle edit/split/preview |
| `Cmd + +/-` | 放大/縮小預覽字型 / Zoom preview font |
| `Cmd + Shift + V` | 貼上圖片至 assets / Paste image to assets |
| `Cmd + Shift + P` | 匯出 PDF / Export PDF |
| `Cmd + Shift + W` | 匯出 Word / Export Word |
| `Cmd + Shift + E` | CSV 轉 Excel / CSV to Excel |

### 圖片貼上（核心功能）/ Paste Image (Core Feature)

shenMD 的圖片貼上功能專為「與 VSCode 協作」設計：<br>
shenMD's image paste feature is designed for seamless collaboration with VSCode:

1. 在任意地方（截圖工具、瀏覽器、Figma 等）複製圖片<br>
   Copy an image from anywhere (screenshot tool, browser, Figma, etc.)
2. 在 shenMD 編輯器中按 `Cmd + Shift + V` 或直接貼上（純圖片時會自動觸發）<br>
   Press `Cmd + Shift + V` in the editor, or paste directly (auto-triggers for pure images)
3. shenMD 會在該 `.md` 檔案的**同層目錄**自動建立 `assets/` 資料夾<br>
   shenMD auto-creates an `assets/` folder in the same directory as the `.md` file
4. 圖片命名為 `paste-YYYY-MM-DD-HH-MM-SS.png`<br>
   Images are named `paste-YYYY-MM-DD-HH-MM-SS.png`
5. Markdown 中自動插入相對路徑：<br>
   A relative path is automatically inserted into Markdown:
   ```markdown
   ![paste-2026-05-05-10-30-22](assets/paste-2026-05-05-10-30-22.png)
   ```
6. 此為**標準 Markdown 相對路徑**，VSCode、GitHub、GitLab、任何預覽器都能正確顯示<br>
   This is a **standard Markdown relative path**, compatible with VSCode, GitHub, GitLab, and any previewer

專案目錄結構範例 / Project structure example:

```
my-project/
├── README.md
├── assets/
│   ├── paste-2026-05-05-103022.png
│   └── paste-2026-05-05-104512.jpg
└── docs/
    ├── guide.md
    └── assets/
        └── screenshot.png
```

---

## 技術架構 / Tech Stack

| 層級 / Layer | 技術 / Technology |
|---|---|
| 框架 / Framework | Electron 30 + Node.js |
| UI | Tailwind CSS + 原生 HTML / Native HTML |
| Markdown 渲染 / Renderer | marked.js + DOMPurify |
| 程式碼高亮 / Highlighting | highlight.js |
| 圖表 / Diagrams | Mermaid.js |
| PDF 匯出 / PDF Export | html2pdf.js |
| Word 匯出 / Word Export | docx.js |
| Excel 匯出 / Excel Export | xlsx.js |
| 檔案 I/O / File I/O | Node.js `fs/promises` |
| IPC 通訊 / IPC | Electron `contextBridge` + `ipcRenderer` |

---

## 專案結構 / Project Structure

```
shenmd/
├── package.json              # 專案設定與 electron-builder 配置 / Project & builder config
├── src/
│   ├── main.js               # Electron 主行程（視窗、選單、Dock、IPC）/ Main process
│   ├── preload.js            # 安全橋接腳本（contextIsolation）/ Secure bridge script
│   └── renderer/
│       ├── index.html        # UI 結構 / UI structure
│       ├── app.js            # 渲染層核心邏輯 / Renderer core logic
│       └── style.css         # 樣式表 / Stylesheet
├── dist/                     # 打包產物（由 electron-builder 產生）/ Build output
└── README.md                 # 本文件 / This file
```

---

## 開發指南 / Development Guide

### 前置需求 / Prerequisites

- macOS 12+ (Monterey 或更新版本 / or newer)
- Node.js 18+
- npm 或 yarn

### 開發模式 / Dev Mode

```bash
# 1. 安裝依賴 / Install dependencies
npm install

# 2. 開發模式啟動 / Start in dev mode
npm start

# 3. 打包成 .app + .dmg（ARM64 + Intel 雙架構）/ Build for both architectures
npm run dist
```

### 開發提示 / Dev Tips

- **主行程 (Main Process)**：`src/main.js` — 負責視窗管理、原生選單、檔案對話框、系統整合<br>
  Handles window management, native menu, file dialogs, system integration
- **預載腳本 (Preload)**：`src/preload.js` — 在渲染層與主行程之間建立安全的 IPC 橋接<br>
  Establishes a secure IPC bridge between renderer and main process
- **渲染層 (Renderer)**：`src/renderer/app.js` — Markdown 編輯、預覽、匯出邏輯<br>
  Markdown editing, preview, and export logic
- 修改主行程後需重新啟動 `npm start`<br>
  Restart `npm start` after modifying the main process
- 修改渲染層檔案後重新整理視窗即可（Cmd+R）<br>
  Refresh the window (Cmd+R) after modifying renderer files

---

## 打包說明 / Build Notes

本專案使用 **electron-builder** 進行打包，設定位於 `package.json` 的 `build` 欄位。<br>
This project uses **electron-builder** for packaging. Config is in the `build` field of `package.json`.

### 輸出產物 / Output Artifacts

執行 `npm run dist` 後會在 `dist/` 目錄產生：<br>
Running `npm run dist` generates the following in `dist/`:

| 檔案 / File | 說明 / Description |
|---|---|
| `shenMD-x.x.x-arm64.dmg` | Apple Silicon (M1/M2/M3) 安裝檔 / Installer for Apple Silicon |
| `shenMD-x.x.x.dmg` | Intel Mac 安裝檔 / Installer for Intel Mac |
| `mac-arm64/shenMD.app` | ARM64 未封裝 .app / Unpackaged ARM64 .app |
| `mac/shenMD.app` | Intel 未封裝 .app / Unpackaged Intel .app |

### 自訂 App Icon / Custom App Icon

1. 準備一張 **1024×1024** 的 PNG 圖片<br>
   Prepare a **1024×1024** PNG image
2. 執行以下指令轉換為 `.icns`：<br>
   Run the following to convert to `.icns`:
   ```bash
   mkdir -p icon.iconset
   sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
   sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
   sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
   sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
   sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
   sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
   sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
   sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
   sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
   cp icon.png icon.iconset/icon_512x512@2x.png
   iconutil -c icns icon.iconset -o assets/icon.icns
   ```
3. 重新執行 `npm run dist`<br>
   Re-run `npm run dist`

---

## 已知限制 / Known Limitations

1. **未做 Apple 開發者簽名 / Not Apple-notarized**
   - 首次開啟需手動允許（系統設定 → 隱私權與安全性）<br>
     First launch requires manual approval (System Settings → Privacy & Security)
   - 不影響功能使用 / Does not affect functionality

2. **部分函式庫使用 CDN / Some libraries loaded via CDN**
   - marked.js、highlight.js、mermaid.js、docx.js、xlsx.js、html2pdf.js 均透過 CDN 載入<br>
     marked.js, highlight.js, mermaid.js, docx.js, xlsx.js, html2pdf.js are loaded via CDN
   - 首次開啟時需短暫連網下載，之後由瀏覽器快取<br>
     Brief internet connection needed on first launch; cached by browser afterwards
   - 若需在完全離線環境使用，可改為本地 npm 依賴並於 `index.html` 引入<br>
     For fully offline use, switch to local npm dependencies and import in `index.html`

3. **視窗標題列為 hiddenInset / Window uses hiddenInset title bar**
   - 使用 macOS 原生無邊框標題列，外觀更簡潔<br>
     Uses macOS native borderless title bar for a cleaner look
   - 視窗控制按鈕（紅黃綠）位於左上角<br>
     Window control buttons (red/yellow/green) are in the top-left corner

---

## 授權 / License

本專案採用 [MIT License](LICENSE)。<br>
This project is licensed under the [MIT License](LICENSE).

---

## 作者 / Author

**shenmb**

- 本專案為個人工具開發，歡迎 Fork 與修改<br>
  This is a personal tool project. Feel free to fork and modify.
- 如有問題或建議，歡迎開 Issue 討論<br>
  Questions or suggestions? Open an issue and let's discuss.

---

> Made with ❤️ for Markdown lovers on macOS.
