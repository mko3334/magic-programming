/**
 * タイル余白調整モード（絵本タイル + 取込シートをタイルごとに調整）
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

  function isCustomSheetTile(id) {
    return global.CustomSheetAssets?.isSheetType?.(id);
  }

  function getCropForTile(id) {
    if (isCustomSheetTile(id)) return global.CustomSheetAssets.getCrop(id);
    return global.PictureBookAssets?.getCrop(id) || { left: 0, top: 0, right: 0, bottom: 0 };
  }

  function setCropForTile(id, crop) {
    if (isCustomSheetTile(id)) global.CustomSheetAssets.setCrop(id, crop);
    else global.PictureBookAssets?.setCrop(id, crop);
  }

  function resetCropForTile(id) {
    if (isCustomSheetTile(id)) global.CustomSheetAssets.resetCrop(id);
    else global.PictureBookAssets?.resetCrop(id);
  }

  function drawThumbForTile(ctx, id, size) {
    if (isCustomSheetTile(id)) return global.CustomSheetAssets.drawThumb(ctx, id, size);
    return global.PictureBookAssets?.drawThumb(ctx, id, size);
  }

  function getLabelForTile(id) {
    if (isCustomSheetTile(id)) return global.CustomSheetAssets.getDefaultLabel(id);
    return global.PictureBookAssets?.getDefaultLabel(id) || id;
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
    if (!previewCanvas || !previewCtx) return;
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    if (isCustomSheetTile(selectedId)) {
      global.CustomSheetAssets?.drawAdjustPreview(previewCtx, selectedId, previewCanvas.width, previewCanvas.height);
    } else {
      global.PictureBookAssets?.drawAdjustPreview(previewCtx, selectedId, previewCanvas.width, previewCanvas.height);
    }
    const nameEl = $('pb-crop-selected-name');
    if (nameEl) nameEl.textContent = getLabelForTile(selectedId);
  }

  function refreshGrid() {
    if (!gridEl) return;
    gridEl.querySelectorAll('.pb-crop-list-item').forEach((btn) => {
      const id = btn.dataset.tileId;
      const canvas = btn.querySelector('.pb-crop-thumb');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#faf6ee';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawThumbForTile(ctx, id, canvas.width);
      }
      btn.classList.toggle('is-selected', id === selectedId);
    });
  }

  function selectTile(id) {
    selectedId = id;
    syncSlidersFromCrop(getCropForTile(id));
    refreshGrid();
    refreshPreview();
  }

  function onSliderInput() {
    SLIDER_IDS.forEach((key) => {
      const el = $(`pb-crop-${key}`);
      const val = $(`pb-crop-${key}-val`);
      if (el && val) val.textContent = `${el.value}%`;
    });
    setCropForTile(selectedId, readSliders());
    refreshGrid();
    refreshPreview();
  }

  function appendSection(title) {
    const h = document.createElement('div');
    h.className = 'pb-crop-section-title';
    h.textContent = title;
    gridEl.appendChild(h);
  }

  function appendTileButton(entry) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pb-crop-list-item';
    btn.dataset.tileId = entry.id;
    btn.title = entry.label;
    const canvas = document.createElement('canvas');
    canvas.className = 'pb-crop-thumb';
    canvas.width = 36;
    canvas.height = 36;
    const label = document.createElement('span');
    label.className = 'pb-crop-grid-label';
    label.textContent = entry.label;
    btn.appendChild(canvas);
    btn.appendChild(label);
    btn.addEventListener('click', () => selectTile(entry.id));
    gridEl.appendChild(btn);
  }

  function buildGrid() {
    if (!gridEl) return;
    gridEl.innerHTML = '';
    const tileIds = [];

    if (global.PictureBookAssets?.isReady?.()) {
      appendSection('📖 不思議な絵本');
      global.PictureBookAssets.CATALOG.forEach((entry) => {
        appendTileButton(entry);
        tileIds.push(entry.id);
      });
    }

    const CSA = global.CustomSheetAssets;
    if (CSA?.hasSheetImage?.()) {
      appendSection('📋 取込シート（マスごと）');
      CSA.getCells().forEach((cell) => {
        appendTileButton({ id: cell.id, label: cell.label || cell.id });
        tileIds.push(cell.id);
      });
    }

    if (!tileIds.includes(selectedId) && tileIds.length) {
      selectedId = tileIds[0];
    }
    refreshGrid();
  }

  function onEnterAdjust() {
    active = true;
    buildGrid();
    selectTile(selectedId);
  }

  function onLeaveAdjust() {
    active = false;
  }

  function setActive(next) {
    if (global.CreateModeTabs) {
      global.CreateModeTabs.setMode(next ? 'adjust' : 'place');
      return;
    }
    onEnterAdjust();
  }

  function init() {
    panelEl = $('create-tile-adjust-panel');
    gridEl = $('create-adjust-tile-list');
    previewCanvas = $('pb-crop-preview');
    if (!panelEl || !gridEl || !previewCanvas) return false;
    previewCtx = previewCanvas.getContext('2d');

    SLIDER_IDS.forEach((key) => {
      $(`pb-crop-${key}`)?.addEventListener('input', onSliderInput);
    });
    $('pb-crop-reset-tile')?.addEventListener('click', () => {
      resetCropForTile(selectedId);
      syncSlidersFromCrop(getCropForTile(selectedId));
      refreshGrid();
      refreshPreview();
    });
    $('pb-crop-reset-all')?.addEventListener('click', () => {
      global.PictureBookAssets?.resetAllCrops();
      global.CustomSheetAssets?.resetAllCrops();
      syncSlidersFromCrop(getCropForTile(selectedId));
      refreshGrid();
      refreshPreview();
    });

    global.addEventListener('picturebook:crops-updated', () => {
      if (!active) return;
      refreshGrid();
      refreshPreview();
    });
    global.addEventListener('customsheet:crops-updated', () => {
      if (!active) return;
      refreshGrid();
      refreshPreview();
    });
    global.addEventListener('customsheet:updated', () => {
      if (!active) return;
      buildGrid();
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
    onEnterAdjust,
    onLeaveAdjust,
    refreshThumbnails: refreshGrid,
  };
})(window);
