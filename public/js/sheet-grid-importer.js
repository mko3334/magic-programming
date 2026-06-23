/**
 * シート取込 UI — 等間隔グリッド・採用トグル・命名
 */
(function (global) {
  let active = false;
  let selectedCol = 0;
  let selectedRow = 0;

  function $(id) {
    return document.getElementById(id);
  }

  function syncGridInputs() {
    const CSA = global.CustomSheetAssets;
    if (!CSA) return;
    const g = CSA.getGrid();
    const map = {
      'sgi-offset-x': g.offsetX,
      'sgi-offset-y': g.offsetY,
      'sgi-cell-size': g.cellSize,
      'sgi-gap': g.gap,
      'sgi-cols': g.cols,
      'sgi-rows': g.rows,
    };
    Object.entries(map).forEach(([id, val]) => {
      const el = $(id);
      if (el) el.value = String(val);
    });
    const keyBlack = $('sgi-key-black');
    if (keyBlack) keyBlack.checked = !!g.keyBlack;
  }

  function readGridInputs() {
    return {
      offsetX: Number($('sgi-offset-x')?.value) || 0,
      offsetY: Number($('sgi-offset-y')?.value) || 0,
      cellSize: Math.max(8, Number($('sgi-cell-size')?.value) || 64),
      gap: Math.max(0, Number($('sgi-gap')?.value) || 0),
      cols: Math.max(1, Number($('sgi-cols')?.value) || 1),
      rows: Math.max(1, Number($('sgi-rows')?.value) || 1),
      keyBlack: !!$('sgi-key-black')?.checked,
    };
  }

  function refreshPreview() {
    const canvas = $('sgi-preview');
    const CSA = global.CustomSheetAssets;
    if (!canvas || !CSA) return;
    const ctx = canvas.getContext('2d');
    CSA.drawGridPreview(ctx, canvas.width, canvas.height, selectedCol, selectedRow);
  }

  function renderCellList() {
    const list = $('sgi-cell-list');
    const CSA = global.CustomSheetAssets;
    if (!list || !CSA) return;

    const cells = CSA.getCells();
    list.innerHTML = '';

    cells.forEach((cell) => {
      const row = document.createElement('div');
      row.className = 'sgi-cell-row' + (cell.enabled ? ' is-enabled' : '');
      row.dataset.col = String(cell.col);
      row.dataset.row = String(cell.row);

      const thumb = document.createElement('canvas');
      thumb.width = 40;
      thumb.height = 40;
      thumb.className = 'sgi-cell-thumb';

      const meta = document.createElement('div');
      meta.className = 'sgi-cell-meta';

      const coord = document.createElement('div');
      coord.className = 'sgi-cell-coord';
      coord.textContent = `${cell.col + 1}, ${cell.row + 1}`;

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'sgi-cell-name';
      nameInput.value = cell.label;
      nameInput.placeholder = 'タイル名';
      nameInput.spellcheck = false;

      const opts = document.createElement('div');
      opts.className = 'sgi-cell-opts';

      const kindSelect = document.createElement('select');
      kindSelect.className = 'sgi-cell-kind';
      kindSelect.innerHTML = '<option value="terrain">地形</option><option value="prop">オブジェクト</option>';
      kindSelect.value = cell.kind;

      const solidLabel = document.createElement('label');
      solidLabel.className = 'sgi-cell-solid-label';
      solidLabel.innerHTML = `<input type="checkbox" class="sgi-cell-solid"${cell.solid ? ' checked' : ''}> 壁`;

      const adoptBtn = document.createElement('button');
      adoptBtn.type = 'button';
      adoptBtn.className = 'sgi-adopt-btn' + (cell.enabled ? ' is-on' : '');
      adoptBtn.textContent = cell.enabled ? '✓ 採用中' : '＋ 採用';

      nameInput.addEventListener('change', () => {
        CSA.updateCell(cell.id, { label: nameInput.value.trim() || cell.label });
        if (typeof global.registerCustomSheetCreateTools === 'function') {
          global.registerCustomSheetCreateTools(true);
        }
      });

      kindSelect.addEventListener('change', () => {
        CSA.updateCell(cell.id, { kind: kindSelect.value });
        if (typeof global.registerCustomSheetCreateTools === 'function') {
          global.registerCustomSheetCreateTools(true);
        }
      });

      solidLabel.querySelector('input').addEventListener('change', (e) => {
        CSA.updateCell(cell.id, { solid: e.target.checked });
      });

      adoptBtn.addEventListener('click', () => {
        const next = !cell.enabled;
        CSA.updateCell(cell.id, { enabled: next });
        adoptBtn.classList.toggle('is-on', next);
        adoptBtn.textContent = next ? '✓ 採用中' : '＋ 採用';
        row.classList.toggle('is-enabled', next);
        if (typeof global.registerCustomSheetCreateTools === 'function') {
          global.registerCustomSheetCreateTools(true);
        }
        refreshThumbs();
        refreshPreview();
      });

      row.addEventListener('click', (e) => {
        if (e.target.closest('input, select, button')) return;
        selectedCol = cell.col;
        selectedRow = cell.row;
        refreshPreview();
        list.querySelectorAll('.sgi-cell-row').forEach((el) => {
          el.classList.toggle('is-selected', el.dataset.col === String(cell.col) && el.dataset.row === String(cell.row));
        });
      });

      if (cell.col === selectedCol && cell.row === selectedRow) {
        row.classList.add('is-selected');
      }

      opts.appendChild(kindSelect);
      opts.appendChild(solidLabel);
      meta.appendChild(coord);
      meta.appendChild(nameInput);
      meta.appendChild(opts);
      row.appendChild(thumb);
      row.appendChild(meta);
      row.appendChild(adoptBtn);
      list.appendChild(row);

      if (CSA.isReady() || global.CustomSheetAssets.getGrid()) {
        const tctx = thumb.getContext('2d');
        tctx.fillStyle = '#faf6ee';
        tctx.fillRect(0, 0, 40, 40);
        const tmpEnabled = { ...cell, enabled: true };
        const saved = CSA.getCells().find((c) => c.id === cell.id);
        if (saved && CSA.drawThumb) {
          CSA.drawThumb(tctx, cell.id, 40);
        }
      }
    });
  }

  function refreshThumbs() {
    const CSA = global.CustomSheetAssets;
    if (!CSA) return;
    document.querySelectorAll('.sgi-cell-thumb').forEach((canvas) => {
      const row = canvas.closest('.sgi-cell-row');
      if (!row) return;
      const col = Number(row.dataset.col);
      const r = Number(row.dataset.row);
      const id = `${CSA.ID_PREFIX}${col}_${r}`;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#faf6ee';
      ctx.fillRect(0, 0, 40, 40);
      CSA.drawThumb(ctx, id, 40);
    });
  }

  function applyGridSettings() {
    const CSA = global.CustomSheetAssets;
    if (!CSA) return;
    CSA.updateGrid(readGridInputs());
    renderCellList();
    refreshPreview();
    refreshThumbs();
    if (typeof global.registerCustomSheetCreateTools === 'function') {
      global.registerCustomSheetCreateTools(true);
    }
  }

  function setActive(next) {
    active = !!next;
    const mapPanel = $('create-map-panel');
    const adjustPanel = $('create-tile-adjust-panel');
    const importPanel = $('create-sheet-import-panel');
    const toggleBtn = $('btn-toggle-sheet-import');
    const cropBtn = $('btn-toggle-tile-adjust');

    if (active) {
      if (global.PictureBookCropAdjust?.isActive?.()) {
        global.PictureBookCropAdjust.setActive(false);
      }
    }

    if (mapPanel) mapPanel.classList.toggle('hidden-view', active);
    if (adjustPanel && active) adjustPanel.classList.add('hidden-view');
    if (importPanel) importPanel.classList.toggle('hidden-view', !active);
    if (toggleBtn) {
      toggleBtn.textContent = active ? '🗺️ マップ編集に戻る' : '📋 シート取込';
      toggleBtn.classList.toggle('is-active', active);
    }
    if (cropBtn && active) cropBtn.classList.remove('is-active');

    if (active) {
      syncGridInputs();
      renderCellList();
      refreshPreview();
      refreshThumbs();
    }
  }

  function init() {
    const CSA = global.CustomSheetAssets;
    if (!CSA) return false;

    $('btn-toggle-sheet-import')?.addEventListener('click', () => setActive(!active));

    ['sgi-offset-x', 'sgi-offset-y', 'sgi-cell-size', 'sgi-gap', 'sgi-cols', 'sgi-rows'].forEach((id) => {
      $(id)?.addEventListener('change', applyGridSettings);
    });
    $('sgi-key-black')?.addEventListener('change', applyGridSettings);

    $('sgi-auto-fit')?.addEventListener('click', () => {
      CSA.autoFitGridFromImage();
      syncGridInputs();
      CSA.generateCellsFromGrid();
      CSA.saveToStorage();
      renderCellList();
      refreshPreview();
      refreshThumbs();
    });

    $('sgi-regenerate-grid')?.addEventListener('click', () => {
      applyGridSettings();
    });

    $('sgi-file')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        CSA.setSheetDataUrl(reader.result).then(() => {
          syncGridInputs();
          renderCellList();
          refreshPreview();
          refreshThumbs();
          if (typeof global.registerCustomSheetCreateTools === 'function') {
            global.registerCustomSheetCreateTools(true);
          }
        }).catch(() => alert('画像の読み込みに失敗しました'));
      };
      reader.readAsDataURL(file);
    });

    global.addEventListener('customsheet:updated', () => {
      if (!active) return;
      refreshThumbs();
      refreshPreview();
    });

    CSA.loadFromStorage().then(() => {
      if (typeof global.registerCustomSheetCreateTools === 'function') {
        global.registerCustomSheetCreateTools(true);
      }
    });

    return true;
  }

  global.SheetGridImporter = {
    init,
    isActive: () => active,
    setActive,
    refreshThumbs,
  };
})(window);
