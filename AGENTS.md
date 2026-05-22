# AGENTS.md — shenMD

> Compact context for OpenCode sessions. If a fact is obvious from filenames or README, it's omitted.

## Critical: No NPM UI Dependencies

All renderer-side libraries are loaded via **CDN in `src/renderer/index.html`**, not `package.json`:

- `marked`, `dompurify`, `highlight.js`, `mermaid`, `html2pdf.js`, `html-docx-js`, `xlsx`, `docx`, `tailwindcss`

**Do NOT** `npm install` these or `require()` them in renderer code. Check `index.html` `<script>` tags first.

## Dev Commands

```bash
npm install       # only electron + electron-builder are devDeps
npm start         # dev mode (electron .)
npm run dist      # build macOS DMG (arm64 + x64) → output in dist/
```

- **No tests**, **no linter**, **no typechecker** in this repo.
- **No CI workflows**; builds are manual.

## Process Reload Behavior

| File | Change requires |
|---|---|
| `src/main.js` | Restart `npm start` |
| `src/preload.js` | Restart `npm start` |
| `src/renderer/*` | Window reload (`Cmd+R`) |

## Platform & Build Constraints

- **macOS only**. `npm run dist` targets `dmg` with `arm64` + `x64` via `electron-builder`.
- **Not Apple-notarized**. First launch on a new Mac requires manual approval in System Settings.
- `titleBarStyle: 'hiddenInset'` is set in `main.js`; the UI reserves space for native window controls in the top-left.

## Architecture Quirks

- **IPC bridge** lives in `src/preload.js`. Renderer accesses Node APIs exclusively through `window.electronAPI`.
- **File I/O** is done in `main.js` via `fs/promises`; renderer never touches `fs` directly.
- **Image paste** (`Cmd+Shift+V`): main process saves clipboard image to an `assets/` folder **next to the current `.md` file**, then inserts a standard relative Markdown path. This is a core feature; maintain compatibility with VSCode/GitHub relative paths.
- **CSV mode**: the app also edits `.csv` files with auto-encoding detection (Big5 / UTF-8 / UTF-16 / GB18030). CSV-to-Excel export uses `xlsx.js`.
- Recent files and window bounds are persisted to `app.getPath('userData')` (`~/Library/Application Support/shenMD/` on macOS).
