# shenMD

> A powerful, native Markdown editor for macOS — built with Electron.

shenMD 是專為 macOS 設計的桌面級 Markdown 編輯器，基於 Electron 開發。它保留了網頁版編輯器的即時預覽體驗，同時透過原生 Node.js 檔案 I/O 實現了真正的本地檔案操作、圖片貼上自動儲存、以及完整的 PDF / Word / Excel 匯出功能。

---

## ✨ 功能特色

- **即時雙欄預覽** — 左側編輯、右側即時渲染，支援編輯 / 分割 / 預覽三種模式
- **原生檔案操作** — 直接讀寫本地 `.md` / `.csv`，Cmd+S 秒速儲存
- **圖片貼上自動儲存** — 貼上的圖片自動存入 `assets/` 資料夾，並使用相對路徑，VSCode 也能正確顯示
- **Mermaid 圖表支援** — 流程圖、序列圖、甘特圖等即時渲染
- **程式碼高亮** — 基於 highlight.js，支援一鍵複製程式碼區塊
- **PDF 匯出** — 可調整紙張大小、邊距、方向，完美保留排版
- **Word (.docx) 匯出** — 完整保留表格、圖片、標題層級與樣式
- **Excel (.xlsx) 匯出** — CSV 模式下一鍵轉換，自動調整欄寬
- **側邊欄資料夾瀏覽** — 樹狀結構瀏覽本地專案，點擊即開啟
- **Mac 原生體驗** — Menu Bar、Dock 拖放、最近開啟檔案、視窗狀態記憶
- **多編碼 CSV 支援** — 自動偵測 Big5 / UTF-8 / UTF-16 / GB18030

---

## 📸 介面預覽

```
┌─────────────────────────────────────────────────────────────┐
│  shenMD  │ [編輯][分割][預覽]          A+ A-  💾 📄 📑      │
├──────────┴──────────────────────────────────────────────────┤
│ 📁 檔案瀏覽 │                                              │
│   ├─ docs/                                                │
│   │   └─ readme.md  ◄── active                            │
│   └─ assets/                                              │
│           └─ paste-2026-05-05-103022.png                  │
│                                                            │
│ # Welcome to shenMD          │  # Welcome to shenMD        │
│                              │                              │
│ This is **bold** text.       │  This is **bold** text.     │
│                              │                              │
│ ```js                        │  ┌──────────────────────┐   │
│ console.log('hello');        │  │ console.log('hello'); │   │
│ ```                          │  └──────────────────────┘   │
│                              │                              │
│ ![img](assets/paste-xxx.png) │  [rendered image]           │
├──────────────────────────────┴──────────────────────────────┤
│ 就緒  │  128 字  │  12 行  │  384 字元  │  readme.md        │
└─────────────────────────────────────────────────────────────┘
```

---

## 💾 安裝

### 方式一：下載 DMG（推薦）

1. 前往 [Releases](https://github.com/shenmb/shenmd/releases) 頁面
2. 根據你的 Mac 晶片選擇版本：
   - **Apple Silicon (M1/M2/M3)** → `shenMD-x.x.x-arm64.dmg`
   - **Intel Mac** → `shenMD-x.x.x.dmg`
3. 雙擊掛載 DMG，將 **shenMD** 拖入 **Applications**

> ⚠️ **首次開啟注意**：因未做 Apple 開發者簽名，首次開啟時 macOS 會阻擋。請到「系統設定 → 隱私權與安全性」點擊「仍要開啟」。

### 方式二：自行編譯

```bash
git clone https://github.com/shenmb/shenmd.git
cd shenmd
npm install
npm run dist
```

編譯完成後，安裝檔位於 `dist/` 目錄。

---

## 🚀 使用指南

### 基本操作

| 快捷鍵 | 功能 |
|--------|------|
| `Cmd + N` | 新建檔案 |
| `Cmd + O` | 開啟檔案 |
| `Cmd + Shift + O` | 開啟資料夾 |
| `Cmd + S` | 儲存 |
| `Cmd + Shift + S` | 另存新檔 |
| `Cmd + 1/2/3` | 切換編輯/分割/預覽模式 |
| `Cmd + +/-` | 放大/縮小預覽字型 |
| `Cmd + Shift + V` | 貼上圖片至 assets |
| `Cmd + Shift + P` | 匯出 PDF |
| `Cmd + Shift + W` | 匯出 Word |
| `Cmd + Shift + E` | CSV 轉 Excel |

### 圖片貼上（核心功能）

shenMD 的圖片貼上功能專為「與 VSCode 協作」設計：

1. 在任意地方（截圖工具、瀏覽器、Figma 等）複製圖片
2. 在 shenMD 編輯器中按 `Cmd + Shift + V` 或直接貼上（純圖片時會自動觸發）
3. shenMD 會在該 `.md` 檔案的**同層目錄**自動建立 `assets/` 資料夾
4. 圖片命名為 `paste-YYYY-MM-DD-HH-MM-SS.png`
5. Markdown 中自動插入相對路徑：
   ```markdown
   ![paste-2026-05-05-10-30-22](assets/paste-2026-05-05-10-30-22.png)
   ```
6. 此為**標準 Markdown 相對路徑**，VSCode、GitHub、GitLab、任何預覽器都能正確顯示

專案目錄結構範例：

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

## 🛠 技術架構

| 層級 | 技術 |
|------|------|
| **框架** | Electron 30 + Node.js |
| **UI** | Tailwind CSS + 原生 HTML |
| **Markdown 渲染** | marked.js + DOMPurify |
| **程式碼高亮** | highlight.js |
| **圖表** | Mermaid.js |
| **PDF 匯出** | html2pdf.js |
| **Word 匯出** | docx.js |
| **Excel 匯出** | xlsx.js |
| **檔案 I/O** | Node.js `fs/promises` |
| **IPC 通訊** | Electron `contextBridge` + `ipcRenderer` |

---

## 📁 專案結構

```
shenmd/
├── package.json              # 專案設定與 electron-builder 配置
├── src/
│   ├── main.js               # Electron 主行程（視窗、選單、Dock、IPC）
│   ├── preload.js            # 安全橋接腳本（contextIsolation）
│   └── renderer/
│       ├── index.html        # UI 結構
│       ├── app.js            # 渲染層核心邏輯
│       └── style.css         # 樣式表
├── dist/                     # 打包產物（由 electron-builder 產生）
└── README.md                 # 本文件
```

---

## 🔧 開發指南

### 前置需求

- macOS 12+ (Monterey 或更新版本)
- Node.js 18+
- npm 或 yarn

### 開發模式

```bash
# 1. 安裝依賴
npm install

# 2. 開發模式啟動（含 hot-reload 建議搭配 nodemon）
npm start

# 3. 打包成 .app + .dmg（ARM64 + Intel 雙架構）
npm run dist
```

### 開發提示

- **主行程 (Main Process)**：`src/main.js` — 負責視窗管理、原生選單、檔案對話框、系統整合
- **預載腳本 (Preload)**：`src/preload.js` — 在渲染層與主行程之間建立安全的 IPC 橋接
- **渲染層 (Renderer)**：`src/renderer/app.js` — Markdown 編輯、預覽、匯出邏輯
- 修改主行程後需重新啟動 `npm start`
- 修改渲染層檔案後重新整理視窗即可（Cmd+R）

---

## 📦 打包說明

本專案使用 **electron-builder** 進行打包，設定位於 `package.json` 的 `build` 欄位。

### 輸出產物

執行 `npm run dist` 後會在 `dist/` 目錄產生：

| 檔案 | 說明 |
|------|------|
| `shenMD-x.x.x-arm64.dmg` | Apple Silicon (M1/M2/M3) 安裝檔 |
| `shenMD-x.x.x.dmg` | Intel Mac 安裝檔 |
| `mac-arm64/shenMD.app` | ARM64 未封裝 .app |
| `mac/shenMD.app` | Intel 未封裝 .app |

### 自訂 App Icon

1. 準備一張 **1024×1024** 的 PNG 圖片
2. 執行以下指令轉換為 `.icns`：
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
3. 重新執行 `npm run dist`

---

## ⚠️ 已知限制

1. **未做 Apple 開發者簽名**
   - 首次開啟需手動允許（系統設定 → 隱私權與安全性）
   - 不影響功能使用

2. **部分函式庫使用 CDN**
   - marked.js、highlight.js、mermaid.js、docx.js、xlsx.js、html2pdf.js 均透過 CDN 載入
   - 首次開啟時需短暫連網下載，之後由瀏覽器快取
   - 若需在完全離線環境使用，可改為本地 npm 依賴並於 `index.html` 引入

3. **視窗標題列為 hiddenInset**
   - 使用 macOS 原生無邊框標題列，外觀更簡潔
   - 視窗控制按鈕（紅黃綠）位於左上角

---

## 📝 授權

本專案採用 [MIT License](LICENSE)。

---

## 🙋‍♂️ 作者

**shenmb**

- 本專案為個人工具開發，歡迎 Fork 與修改
- 如有問題或建議，歡迎開 Issue 討論

---

> Made with ❤️ for Markdown lovers on macOS.
