/**
 * 新功能模組統一入口
 * 在 index.html 用 <script type="module" src="modules/bootstrap.js"></script> 載入
 */
import { bus } from './util.js';
import { initPalette } from './palette.js';
import { initAiPanel } from './aiPanel.js';
import { initOutline } from './outline.js';
import { initGlobalSearch } from './globalSearch.js';
import { initAutosave } from './autosave.js';
import { initFocusMode } from './focusMode.js';
import { initThemes } from './themes.js';

// 把 bus 掛到 window 給 app.js legacy code 用
window.shenmdBus = bus;

function boot() {
  try {
    initThemes();
    initPalette();
    initOutline();
    initGlobalSearch();
    initAutosave();
    initFocusMode();
    initAiPanel();
    console.log('[shenmd] 新功能模組已啟動');
  } catch (e) {
    console.error('[shenmd] 模組啟動失敗', e);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
