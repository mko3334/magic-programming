/**
 * クリエイトビュー — 配置 / シート取込 / 余白調整 のタブ切替
 */
(function (global) {
  let mode = 'place';

  function $(id) {
    return document.getElementById(id);
  }

  function updateTabButtons() {
    document.querySelectorAll('[data-create-mode]').forEach((btn) => {
      const active = btn.dataset.createMode === mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  function updateLeftPanel() {
    const placePanel = $('create-place-tools-panel');
    const adjustPanel = $('create-adjust-left-panel');
    const actions = $('create-left-actions');
    const title = $('create-left-title');
    const hint = $('create-left-hint');

    if (placePanel) placePanel.classList.toggle('hidden-view', mode !== 'place');
    if (adjustPanel) adjustPanel.classList.toggle('hidden-view', mode !== 'adjust');
    if (actions) actions.classList.toggle('hidden-view', mode !== 'place');

    if (title) {
      if (mode === 'adjust') {
        title.textContent = '📐 タイル調整';
        title.className = 'text-sm font-bold text-amber-600 mb-1 text-center md:text-left';
      } else {
        title.textContent = '🛠️ 配置ツール';
        title.className = 'text-sm font-bold text-emerald-500 mb-1 text-center md:text-left';
      }
    }
    if (hint) {
      if (mode === 'adjust') {
        hint.textContent = '一覧からタイルを選んで、右で余白を調整';
      } else if (mode === 'import') {
        hint.textContent = 'シート取込は右パネル。採用後は配置タブへ';
      } else {
        hint.textContent = 'タイル名をクリックして編集（自動保存）';
      }
    }
  }

  function setMode(next, options = {}) {
    const prev = mode;
    if (!['place', 'import', 'adjust'].includes(next)) return;
    mode = next;

    const mapPanel = $('create-map-panel');
    const importPanel = $('create-sheet-import-panel');
    const adjustPanel = $('create-tile-adjust-panel');

    if (mapPanel) mapPanel.classList.toggle('hidden-view', mode !== 'place');
    if (importPanel) importPanel.classList.toggle('hidden-view', mode !== 'import');
    if (adjustPanel) adjustPanel.classList.toggle('hidden-view', mode !== 'adjust');

    updateTabButtons();
    updateLeftPanel();

    if (prev === 'import' && mode !== 'import') {
      global.SheetGridImporter?.onLeaveImport?.();
    }
    if (mode === 'import') {
      global.SheetGridImporter?.onEnterImport?.();
    }

    if (prev === 'adjust' && mode !== 'adjust') {
      global.PictureBookCropAdjust?.onLeaveAdjust?.();
    }
    if (mode === 'adjust') {
      global.PictureBookCropAdjust?.onEnterAdjust?.();
      if (!options.silent && typeof global.showMessage === 'function') {
        global.showMessage('📐 左の一覧からタイルを選び、右のスライダーで余白を調整');
      }
    }

    if (mode === 'place' && !options.silent && prev !== 'place') {
      const CSA = global.CustomSheetAssets;
      const adopted = CSA?.CATALOG?.length || 0;
      if (adopted > 0 && typeof global.showMessage === 'function') {
        global.showMessage('🗺️ 配置モード：左のタイルを選んで、右のマップをクリック！');
      }
      if (typeof global.startCreateCanvasAnim === 'function') {
        global.startCreateCanvasAnim();
      }
    }

    global.dispatchEvent(new CustomEvent('createmode:changed', { detail: { mode, prev } }));
  }

  function getMode() {
    return mode;
  }

  function init() {
    document.querySelectorAll('[data-create-mode]').forEach((btn) => {
      btn.addEventListener('click', () => setMode(btn.dataset.createMode));
    });
    $('btn-go-place-mode')?.addEventListener('click', () => setMode('place'));
    $('btn-go-place-mode-inline')?.addEventListener('click', () => setMode('place'));
    setMode('place', { silent: true });
    return true;
  }

  global.CreateModeTabs = {
    init,
    setMode,
    getMode,
  };
})(window);
