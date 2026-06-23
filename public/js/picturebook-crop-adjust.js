/**
 * 絵本タイル余白調整モード
 */
(function (global) {
  let active = false;
  let selectedId = 'pb_grass';
  let panelEl = null;
  let gridEl = null;
  let previewCanvas = null;
  let previewCtx = null;

  const SLIDER_IDS = ['left', 'top', 'right', 'bottom'];

  function $(id) {
    return document.getElementById(id);
  }

  function isActive() {
    return active;
  }

  function readSliders() {
    const crop = {};
    SLIDER_IDS.forEach((key) => {
      const el = $(`pb-crop-${key}`);
      crop[key] = el ? Number(el.value) / 100 : 0;
    });
    return crop;
  }

  function syncSlidersFromCrop(crop) {
    SLIDER_IDS.forEach((key) => {
      const el = $(`pb-crop-${key}`);
      const val = $(`pb-crop-${key}-val`);
      const pct = Math.round((crop[key] || 0) * 100);
      if (el) el.value = String(pct);
      if (val) val.textContent = `${pct}%`;
    });
  }

  function refreshPreview() {
    if (!previewCanvas || !previewCtx || !global.PictureBookAssets) return;
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    PictureBookAssets.drawAdjustPreview(previewCtx, selectedId, previewCanvas.width, previewCanvas.height);
    const nameEl = $('pb-crop-selected-name');
    if (nameEl) {
      nameEl.textContent = PictureBookAssets.getDefaultLabel(selectedId);
    }
  }

  function refreshGrid() {
    if (!gridEl || !global.PictureBookAssets || !PictureBookAssets.isReady()) return;
    gridEl.querySelectorAll('.pb-crop-grid-item').forEach((btn) => {
      const id = btn.dataset.tileId;
      const canvas = btn.querySelector('.pb-crop-thumb');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        PictureBookAssets.drawThumb(ctx, id, canvas.width);
      }
      btn.classList.toggle('is-selected', id === selectedId);
    });
  }

  function selectTile(id) {
    selectedId = id;
    syncSlidersFromCrop(PictureBookAssets.getCrop(id));
    refreshGrid();
    refreshPreview();
  }

  function onSliderInput() {
    SLIDER_IDS.forEach((key) => {
      const el = $(`pb-crop-${key}`);
      const val = $(`pb-crop-${key}-val`);
      if (el && val) val.textContent = `${el.value}%`;
    });
    PictureBookAssets.setCrop(selectedId, readSliders());
    refreshGrid();
    refreshPreview();
  }

  function buildGrid() {
    if (!gridEl || !global.PictureBookAssets) return;
    gridEl.innerHTML = '';
    PictureBookAssets.CATALOG.forEach((entry) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pb-crop-grid-item';
      btn.dataset.tileId = entry.id;
      btn.title = entry.label;
      const canvas = document.createElement('canvas');
      canvas.className = 'pb-crop-thumb';
      canvas.dataset.tileId = entry.id;
      canvas.width = 48;
      canvas.height = 48;
      const label = document.createElement('span');
      label.className = 'pb-crop-grid-label';
      label.textContent = entry.label;
      btn.appendChild(canvas);
      btn.appendChild(label);
      btn.addEventListener('click', () => selectTile(entry.id));
      gridEl.appendChild(btn);
    });
    refreshGrid();
  }

  function setActive(next) {
    active = !!next;
    const mapPanel = $('create-map-panel');
    const adjustPanel = $('create-tile-adjust-panel');
    const toggleBtn = $('btn-toggle-tile-adjust');
    if (mapPanel) mapPanel.classList.toggle('hidden-view', active);
    if (adjustPanel) adjustPanel.classList.toggle('hidden-view', !active);
    if (toggleBtn) {
      toggleBtn.textContent = active ? '🗺️ マップ編集に戻る' : '📐 タイル余白調整';
      toggleBtn.classList.toggle('is-active', active);
    }
    if (active) {
      buildGrid();
      selectTile(selectedId);
    }
  }

  function init() {
    panelEl = $('create-tile-adjust-panel');
    gridEl = $('pb-crop-grid');
    previewCanvas = $('pb-crop-preview');
    if (!panelEl || !gridEl || !previewCanvas) return false;
    previewCtx = previewCanvas.getContext('2d');

    $('btn-toggle-tile-adjust')?.addEventListener('click', () => setActive(!active));
    SLIDER_IDS.forEach((key) => {
      $(`pb-crop-${key}`)?.addEventListener('input', onSliderInput);
    });
    $('pb-crop-reset-tile')?.addEventListener('click', () => {
      PictureBookAssets.resetCrop(selectedId);
      syncSlidersFromCrop(PictureBookAssets.getCrop(selectedId));
      refreshGrid();
      refreshPreview();
    });
    $('pb-crop-reset-all')?.addEventListener('click', () => {
      PictureBookAssets.resetAllCrops();
      syncSlidersFromCrop(PictureBookAssets.getCrop(selectedId));
      refreshGrid();
      refreshPreview();
    });

    global.addEventListener('picturebook:crops-updated', () => {
      if (!active) return;
      refreshGrid();
      refreshPreview();
    });
    global.addEventListener('picturebook:sheet-ready', () => {
      if (!active) return;
      buildGrid();
      refreshPreview();
    });

    return true;
  }

  global.PictureBookCropAdjust = {
    init,
    isActive,
    setActive,
    refreshThumbnails: refreshGrid,
  };
})(window);
