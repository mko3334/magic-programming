/**
 * シート取込 UI — 等間隔グリッド・採用トグル・命名
 */
(function (global) {
  let active = false;
  let selectedCol = 0;
  let selectedRow = 0;
  const setPickIds = new Set();

  function renderGroupSelector() {
    const CSA = global.CustomSheetAssets;
    const select = $('sgi-group-select');
    const nameInput = $('sgi-group-name');
    if (!CSA || !select) return;

    const groups = CSA.getGroups();
    const activeId = CSA.getActiveGroupId();
    select.innerHTML = '';

    if (!groups.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '（新規グループ）';
      select.appendChild(opt);
      select.disabled = true;
      if (nameInput) {
        nameInput.disabled = false;
        if (!nameInput.value.trim()) nameInput.placeholder = 'グループ名（例: 森のタイル）';
      }
      return;
    }

    select.disabled = false;
    groups.forEach((g) => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = `${g.name}${g.adoptedCount ? ` (${g.adoptedCount})` : ''}`;
      if (g.id === activeId) opt.selected = true;
      select.appendChild(opt);
    });

    const active = groups.find((g) => g.id === activeId) || groups[0];
    if (nameInput && active) {
      nameInput.value = active.name;
      nameInput.placeholder = 'グループ名';
    }
  }

  function syncActiveGroupNameFromInput() {
    const CSA = global.CustomSheetAssets;
    const nameInput = $('sgi-group-name');
    const activeId = CSA?.getActiveGroupId();
    if (!CSA || !nameInput || !activeId) return;
    const trimmed = nameInput.value.trim();
    if (trimmed) CSA.updateGroup(activeId, { name: trimmed });
    renderGroupSelector();
  }

  function pickCellKeys() {
    const CSA = global.CustomSheetAssets;
    if (!CSA) return new Set();
    const keys = new Set();
    setPickIds.forEach((id) => {
      const cell = CSA.getCells().find((c) => c.id === id);
      if (cell) keys.add(`${cell.col},${cell.row}`);
    });
    return keys;
  }

  function updateSetPickCount() {
    const el = $('sgi-set-pick-count');
    if (!el) return;
    const n = setPickIds.size;
    el.textContent = n >= 2
      ? `${n}マス選択中 → セット名を付けて「セット作成」`
      : 'マス一覧の☑で2マス以上選んで「セット作成」';
  }

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
    const cssW = canvas.clientWidth || 480;
    const cssH = Math.round(cssW * (3 / 4));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const backingW = Math.round(cssW * dpr);
    const backingH = Math.round(cssH * dpr);
    if (canvas.width !== backingW || canvas.height !== backingH) {
      canvas.width = backingW;
      canvas.height = backingH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    CSA.drawGridPreview(ctx, cssW, cssH, selectedCol, selectedRow, pickCellKeys());
  }

  function renderSetList() {
    const list = $('sgi-set-list');
    const CSA = global.CustomSheetAssets;
    if (!list || !CSA) return;
    const sets = CSA.getSets();
    list.innerHTML = '';
    if (!sets.length) {
      list.innerHTML = '<div class="text-[10px] text-slate-400">セットはまだありません</div>';
      return;
    }

    sets.forEach((set) => {
      const row = document.createElement('div');
      row.className = 'sgi-set-row' + (set.enabled ? ' is-enabled' : '');

      const thumb = document.createElement('canvas');
      thumb.width = 40;
      thumb.height = 40;
      thumb.className = 'sgi-cell-thumb';

      const meta = document.createElement('div');
      meta.className = 'sgi-cell-meta';
      meta.innerHTML = `
        <div class="sgi-cell-coord">${set.widthCells}×${set.heightCells} / ${set.members.length}マス</div>
        <input type="text" class="sgi-cell-name sgi-set-name-input" value="${set.label}" spellcheck="false">
      `;

      const adoptBtn = document.createElement('button');
      adoptBtn.type = 'button';
      adoptBtn.className = 'sgi-adopt-btn' + (set.enabled ? ' is-on' : '');
      adoptBtn.textContent = set.enabled ? '✓ 採用中' : '＋ 採用';

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'sgi-set-delete-btn';
      deleteBtn.textContent = '解除';

      meta.querySelector('.sgi-set-name-input').addEventListener('change', (e) => {
        CSA.updateSet(set.id, { label: e.target.value.trim() || set.label });
        if (typeof global.registerCustomSheetCreateTools === 'function') {
          global.registerCustomSheetCreateTools(true);
        }
      });

      adoptBtn.addEventListener('click', () => {
        const next = !set.enabled;
        CSA.updateSet(set.id, { enabled: next });
        adoptBtn.classList.toggle('is-on', next);
        adoptBtn.textContent = next ? '✓ 採用中' : '＋ 採用';
        row.classList.toggle('is-enabled', next);
        if (typeof global.registerCustomSheetCreateTools === 'function') {
          global.registerCustomSheetCreateTools(true);
        }
        renderCellList();
        refreshPreview();
        showStatus(next ? `セット「${set.label}」を採用しました` : `セット「${set.label}」の採用を解除`, 'ok');
      });

      deleteBtn.addEventListener('click', () => {
        if (!confirm(`セット「${set.label}」を解除しますか？`)) return;
        CSA.deleteSet(set.id);
        renderSetList();
        renderCellList();
        refreshPreview();
        refreshThumbs();
        if (typeof global.registerCustomSheetCreateTools === 'function') {
          global.registerCustomSheetCreateTools(true);
        }
        showStatus('セットを解除しました', 'ok');
      });

      row.appendChild(thumb);
      row.appendChild(meta);
      row.appendChild(adoptBtn);
      row.appendChild(deleteBtn);
      list.appendChild(row);

      const tctx = thumb.getContext('2d');
      tctx.fillStyle = '#faf6ee';
      tctx.fillRect(0, 0, 40, 40);
      CSA.drawThumb(tctx, set.id, 40);
    });
  }

  function renderCellList() {
    const list = $('sgi-cell-list');
    const CSA = global.CustomSheetAssets;
    if (!list || !CSA) return;

    const cells = CSA.getCells();
    list.innerHTML = '';

    cells.forEach((cell) => {
      const row = document.createElement('div');
      const picked = setPickIds.has(cell.id);
      const inSet = !!cell.setId;
      row.className = 'sgi-cell-row'
        + (cell.enabled && !inSet ? ' is-enabled' : '')
        + (picked ? ' is-picked' : '')
        + (inSet ? ' is-in-set' : '');
      row.dataset.col = String(cell.col);
      row.dataset.row = String(cell.row);
      row.dataset.cellId = cell.id;

      const pickLabel = document.createElement('label');
      pickLabel.className = 'flex items-center justify-center';
      pickLabel.title = inSet ? 'セット済み' : 'セット用に選択';
      pickLabel.innerHTML = `<input type="checkbox" class="sgi-cell-pick"${picked ? ' checked' : ''}${inSet ? ' disabled' : ''}>`;

      pickLabel.querySelector('input').addEventListener('change', (e) => {
        if (inSet) return;
        if (e.target.checked) setPickIds.add(cell.id);
        else setPickIds.delete(cell.id);
        row.classList.toggle('is-picked', e.target.checked);
        updateSetPickCount();
        refreshPreview();
      });

      const thumb = document.createElement('canvas');
      thumb.width = 40;
      thumb.height = 40;
      thumb.className = 'sgi-cell-thumb';

      const meta = document.createElement('div');
      meta.className = 'sgi-cell-meta';

      const coord = document.createElement('div');
      coord.className = 'sgi-cell-coord';
      coord.textContent = inSet ? `${cell.col + 1}, ${cell.row + 1}（セット内）` : `${cell.col + 1}, ${cell.row + 1}`;

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
      adoptBtn.textContent = inSet ? 'セット内' : (cell.enabled ? '✓ 採用中' : '＋ 採用');
      if (inSet) {
        adoptBtn.disabled = true;
        adoptBtn.classList.add('opacity-60');
      }

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
        if (inSet) return;
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
        const adopted = CSA.getCells().filter((c) => c.enabled).length;
        showStatus(
          next
            ? `採用しました（${adopted}個）。上の「🗺️ 配置」タブまたは緑ボタンでマップへ`
            : `採用を解除しました（${adopted}個）`,
          'ok'
        );
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
      row.appendChild(pickLabel);
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
    updateCellListHeading();
    updateSetPickCount();
    renderSetList();
  }

  function refreshThumbs() {
    const CSA = global.CustomSheetAssets;
    if (!CSA) return;
    document.querySelectorAll('.sgi-cell-thumb').forEach((canvas) => {
      const row = canvas.closest('.sgi-cell-row');
      if (!row) return;
      const cellId = row.dataset.cellId;
      if (!cellId) return;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#faf6ee';
      ctx.fillRect(0, 0, 40, 40);
      CSA.drawThumb(ctx, cellId, 40);
    });
  }

  function showStatus(message, tone = 'info') {
    const el = $('sgi-status');
    if (!el) return;
    el.textContent = message;
    el.className = 'text-[10px] font-bold min-h-[1.25rem] ' + (
      tone === 'warn' ? 'text-amber-600' : tone === 'ok' ? 'text-emerald-600' : 'text-slate-500'
    );
  }

  function commitPanelInputs() {
    const panel = $('create-sheet-import-panel');
    const activeEl = document.activeElement;
    if (panel && activeEl && panel.contains(activeEl) && typeof activeEl.blur === 'function') {
      activeEl.blur();
    }
  }

  function ensureCellsFromGrid() {
    const CSA = global.CustomSheetAssets;
    if (!CSA || CSA.getCells().length) return;
    CSA.updateGrid(readGridInputs());
  }

  function updateCellListHeading() {
    const CSA = global.CustomSheetAssets;
    const heading = $('sgi-cell-list-heading');
    if (!heading || !CSA) return;
    const g = CSA.getGrid();
    const count = g.cols * g.rows;
    heading.textContent = count
      ? `▼ マス一覧（${count}マス）— 下にスクロールして「＋ 採用」`
      : '▼ マス一覧 — 名前を付けて「＋ 採用」';
  }

  function createSetFromPick() {
    const CSA = global.CustomSheetAssets;
    if (!CSA) return;
    if (setPickIds.size < 2) {
      showStatus('セットには2マス以上選択してください', 'warn');
      return;
    }
    const name = ($('sgi-set-name')?.value || '').trim();
    const kind = $('sgi-set-kind')?.value || 'prop';
    const solid = !!$('sgi-set-solid')?.checked;
    const set = CSA.createSet([...setPickIds], name, { kind, solid });
    if (!set) {
      showStatus('セットを作成できません（既にセット内のマスが含まれています）', 'warn');
      return;
    }
    setPickIds.clear();
    if ($('sgi-set-name')) $('sgi-set-name').value = '';
    renderCellList();
    renderSetList();
    refreshPreview();
    refreshThumbs();
    if (typeof global.registerCustomSheetCreateTools === 'function') {
      global.registerCustomSheetCreateTools(true);
    }
    showStatus(`セット「${set.label}」を作成しました。「🗺️ 配置」タブでマップに置けます`, 'ok');
    requestAnimationFrame(() => {
      $('sgi-set-list')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  function applyGridSettings() {
    const CSA = global.CustomSheetAssets;
    if (!CSA) return;
    commitPanelInputs();
    CSA.updateGrid(readGridInputs());
    syncGridInputs();
    renderCellList();
    refreshPreview();
    refreshThumbs();
    if (typeof global.registerCustomSheetCreateTools === 'function') {
      global.registerCustomSheetCreateTools(true);
    }
    const g = CSA.getGrid();
    const count = g.cols * g.rows;
    const hasSheet = CSA.hasSheetImage?.() ?? CSA.isReady?.();
    showStatus(
      hasSheet
        ? `グリッドを更新しました（${g.cols}×${g.rows}＝${count}マス）`
        : `グリッドを更新しました（${g.cols}×${g.rows}＝${count}マス）。PNGを選択するとプレビューに画像が表示されます`,
      'ok'
    );
    $('sgi-preview')?.classList.add('sgi-preview-flash');
    setTimeout(() => $('sgi-preview')?.classList.remove('sgi-preview-flash'), 450);
    requestAnimationFrame(() => {
      $('sgi-cell-list-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function onEnterImport() {
    active = true;
    renderGroupSelector();
    syncGridInputs();
    ensureCellsFromGrid();
    renderCellList();
    updateCellListHeading();
    refreshPreview();
    refreshThumbs();
    const CSA = global.CustomSheetAssets;
    if (CSA && !CSA.getCells().length && !CSA.getGroups().length) {
      showStatus('グループ名を付けてPNGを追加すると取込を始められます', 'info');
    } else if (CSA && !CSA.getCells().length) {
      showStatus('列・行を設定して「グリッド更新」を押すとマス一覧が表示されます', 'info');
    }
  }

  function onLeaveImport() {
    active = false;
    showStatus('');
  }

  function setActive(next) {
    if (global.CreateModeTabs) {
      global.CreateModeTabs.setMode(next ? 'import' : 'place');
      return;
    }
    onEnterImport();
  }

  function init() {
    const CSA = global.CustomSheetAssets;
    if (!CSA) return false;

    ['sgi-offset-x', 'sgi-offset-y', 'sgi-cell-size', 'sgi-gap', 'sgi-cols', 'sgi-rows'].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener('change', applyGridSettings);
      el.addEventListener('input', () => {
        if (active) refreshPreview();
      });
    });
    $('sgi-key-black')?.addEventListener('change', applyGridSettings);

    $('sgi-auto-fit')?.addEventListener('click', () => {
      commitPanelInputs();
      if (!CSA.hasSheetImage?.()) {
        showStatus('先にPNG画像を選択してください', 'warn');
        return;
      }
      CSA.autoFitGridFromImage();
      syncGridInputs();
      CSA.generateCellsFromGrid();
      CSA.saveToStorage();
      renderCellList();
      refreshPreview();
      refreshThumbs();
      const g = CSA.getGrid();
      showStatus(`自動フィットしました（${g.cols}×${g.rows}）`, 'ok');
    });

    $('sgi-regenerate-grid')?.addEventListener('click', () => {
      applyGridSettings();
    });

    $('sgi-group-select')?.addEventListener('change', (e) => {
      const groupId = e.target.value;
      if (!groupId || !CSA.setActiveGroup(groupId)) return;
      setPickIds.clear();
      syncGridInputs();
      renderGroupSelector();
      renderCellList();
      refreshPreview();
      refreshThumbs();
      showStatus(`編集中: ${CSA.getGroups().find((g) => g.id === groupId)?.name || groupId}`, 'info');
    });

    $('sgi-group-name')?.addEventListener('change', () => {
      syncActiveGroupNameFromInput();
      if (typeof global.registerCustomSheetCreateTools === 'function') {
        global.registerCustomSheetCreateTools(true);
      }
    });

    $('sgi-set-create')?.addEventListener('click', createSetFromPick);
    $('sgi-set-clear-pick')?.addEventListener('click', () => {
      setPickIds.clear();
      updateSetPickCount();
      renderCellList();
      refreshPreview();
    });

    $('sgi-file')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const groupName = ($('sgi-group-name')?.value || '').trim() || `シート ${CSA.getGroups().length + 1}`;
      CSA.appendSheetFile(file, groupName).then(() => {
        syncGridInputs();
        renderGroupSelector();
        if (!CSA.getCells().length) CSA.generateCellsFromGrid();
        renderCellList();
        refreshPreview();
        refreshThumbs();
        const g = CSA.getGrid();
        const img = CSA.getSheetImage();
        const px = img ? `${img.naturalWidth}×${img.naturalHeight}px` : '';
        const group = CSA.getGroups().find((gr) => gr.id === CSA.getActiveGroupId());
        showStatus(`「${group?.name || groupName}」を追加しました（${px} / マス${g.cellSize}px・${g.cols}×${g.rows}列）。位置を調整して「グリッド更新」`, 'ok');
        if ($('sgi-group-name')) $('sgi-group-name').value = group?.name || groupName;
        e.target.value = '';
        if (typeof global.registerCustomSheetCreateTools === 'function') {
          global.registerCustomSheetCreateTools(true);
        }
      }).catch(() => alert('画像の読み込みに失敗しました'));
    });

    global.addEventListener('customsheet:active-changed', () => {
      if (!active) return;
      renderGroupSelector();
      syncGridInputs();
      renderCellList();
      refreshPreview();
      refreshThumbs();
    });

    global.addEventListener('customsheet:updated', () => {
      if (!active) return;
      refreshThumbs();
      refreshPreview();
    });

    CSA.loadFromStorage().then((loaded) => {
      if (typeof global.registerCustomSheetCreateTools === 'function') {
        global.registerCustomSheetCreateTools(true);
      }
      renderGroupSelector();
      if (active && loaded) {
        syncGridInputs();
        ensureCellsFromGrid();
        renderCellList();
        refreshPreview();
        refreshThumbs();
      }
    });

    return true;
  }

  global.SheetGridImporter = {
    init,
    isActive: () => active,
    setActive,
    onEnterImport,
    onLeaveImport,
    refreshThumbs,
  };
})(window);
