/**
 * ユーザー定義グリッドシート（等間隔スクエア切り抜き）+ マスセット
 */
(function (global) {
  const STORAGE_KEY = 'pop-magic-custom-sheet-v1';
  const SHEET_DATA_KEY = 'pop-magic-custom-sheet-image-v1';
  const SHEET_BLOB_KEY = 'sheet-image';
  const SHEET_DB_NAME = 'pop-magic-sheet-db';
  const SHEET_DB_STORE = 'blobs';
  const ID_PREFIX = 'gs_';
  const SET_PREFIX = 'gset_';

  const EMPTY_GRID = {
    offsetX: 0,
    offsetY: 0,
    cellSize: 64,
    gap: 8,
    cols: 4,
    rows: 4,
    keyBlack: true,
  };

  const EMPTY_CROP = { left: 0, top: 0, right: 0, bottom: 0 };

  let sheet = null;
  let grid = { ...EMPTY_GRID };
  let cells = [];
  let sets = [];
  let ready = false;
  let nextSetId = 1;

  /** 黒透過処理済みタイルのキャッシュ（毎フレーム getImageData しない） */
  const cellCache = new Map();
  let sheetObjectUrl = null;

  function revokeSheetObjectUrl() {
    if (sheetObjectUrl) {
      URL.revokeObjectURL(sheetObjectUrl);
      sheetObjectUrl = null;
    }
  }

  function openSheetDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(SHEET_DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(SHEET_DB_STORE)) {
          req.result.createObjectStore(SHEET_DB_STORE);
        }
      };
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });
  }

  function idbGetBlob(key) {
    return openSheetDb().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(SHEET_DB_STORE, 'readonly');
      const req = tx.objectStore(SHEET_DB_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    }));
  }

  function idbSetBlob(key, blob) {
    return openSheetDb().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(SHEET_DB_STORE, 'readwrite');
      tx.objectStore(SHEET_DB_STORE).put(blob, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    }));
  }

  function loadSheetImageFromBlob(blob) {
    return new Promise((resolve, reject) => {
      revokeSheetObjectUrl();
      sheetObjectUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        sheet = img;
        resolve(img);
      };
      img.onerror = reject;
      img.src = sheetObjectUrl;
    });
  }

  function loadSheetImageFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
      revokeSheetObjectUrl();
      const img = new Image();
      img.onload = () => {
        sheet = img;
        resolve(img);
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  function finalizeSheetLoad(options = {}) {
    if (options.regenerateGrid && !cells.length) {
      autoFitGridFromImage();
    }
    if (options.regenerateGrid) {
      generateCellsFromGrid();
    }
    prewarmCellCache();
    saveToStorage();
    return true;
  }

  function cacheKey(x, y, w, h) {
    return `${x}|${y}|${w}|${h}|${grid.keyBlack ? 1 : 0}`;
  }

  function invalidateCellCache() {
    cellCache.clear();
  }

  function getCachedCellCanvas(x, y, w, h) {
    const key = cacheKey(x, y, w, h);
    if (cellCache.has(key)) return cellCache.get(key);

    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    const tctx = tmp.getContext('2d');
    global.PopArt?.setupCrisp?.(tctx);
    tctx.drawImage(sheet, x, y, w, h, 0, 0, w, h);

    if (grid.keyBlack) {
      const img = tctx.getImageData(0, 0, w, h);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] < 48 && d[i + 1] < 48 && d[i + 2] < 48) d[i + 3] = 0;
      }
      tctx.putImageData(img, 0, 0);
    }

    cellCache.set(key, tmp);
    return tmp;
  }

  function prewarmCellCache() {
    if (!sheet || !sheet.complete || !grid.keyBlack) return;
    invalidateCellCache();
    cells.forEach((cell) => {
      const rect = squareSourceRect(cell, getCellCrop(cell));
      getCachedCellCanvas(rect.x, rect.y, rect.w, rect.h);
    });
  }

  const byId = {};
  const CATALOG = [];
  const TERRAIN_IDS = new Set();
  const PROP_IDS = new Set();
  const SOLID_IDS = new Set();

  function isSheetType(type) {
    return typeof type === 'string' && type.startsWith(ID_PREFIX);
  }

  function isSetType(type) {
    return typeof type === 'string' && type.startsWith(SET_PREFIX);
  }

  function isCustomType(type) {
    return isSheetType(type) || isSetType(type);
  }

  function cellId(col, row) {
    return `${ID_PREFIX}${col}_${row}`;
  }

  function cellRect(col, row) {
    const x = grid.offsetX + col * (grid.cellSize + grid.gap);
    const y = grid.offsetY + row * (grid.cellSize + grid.gap);
    return { x, y, w: grid.cellSize, h: grid.cellSize };
  }

  function clampCrop(crop) {
    const left = Math.max(0, Math.min(0.45, Number(crop?.left) || 0));
    const top = Math.max(0, Math.min(0.45, Number(crop?.top) || 0));
    const right = Math.max(0, Math.min(0.45, Number(crop?.right) || 0));
    const bottom = Math.max(0, Math.min(0.45, Number(crop?.bottom) || 0));
    return { left, top, right, bottom };
  }

  function getCellCrop(cell) {
    return clampCrop(cell?.crop || EMPTY_CROP);
  }

  function squareSourceRect(cell, crop) {
    const base = cellRect(cell.col, cell.row);
    const cellW = base.w;
    const cellH = base.h;
    const c = crop || EMPTY_CROP;
    const l = c.left * cellW;
    const t = c.top * cellH;
    const r = c.right * cellW;
    const b = c.bottom * cellH;
    const innerW = cellW - l - r;
    const innerH = cellH - t - b;
    if (innerW <= 2 || innerH <= 2) {
      const side = Math.min(cellW, cellH);
      const ox = (cellW - side) / 2;
      const oy = (cellH - side) / 2;
      return { x: base.x + ox, y: base.y + oy, w: side, h: side };
    }
    const side = Math.min(innerW, innerH);
    const cx = l + innerW / 2;
    const cy = t + innerH / 2;
    return {
      x: base.x + cx - side / 2,
      y: base.y + cy - side / 2,
      w: side,
      h: side,
    };
  }

  function allocSetId() {
    while (sets.some((s) => s.id === `${SET_PREFIX}${nextSetId}`)) nextSetId++;
    return `${SET_PREFIX}${nextSetId++}`;
  }

  function normalizeSetMembers(memberCells) {
    const minCol = Math.min(...memberCells.map((c) => c.col));
    const minRow = Math.min(...memberCells.map((c) => c.row));
    const maxCol = Math.max(...memberCells.map((c) => c.col));
    const maxRow = Math.max(...memberCells.map((c) => c.row));
    return {
      anchorCol: minCol,
      anchorRow: minRow,
      widthCells: maxCol - minCol + 1,
      heightCells: maxRow - minRow + 1,
      members: memberCells.map((c) => ({
        cellId: c.id,
        col: c.col,
        row: c.row,
        dx: c.col - minCol,
        dy: c.row - minRow,
      })),
    };
  }

  function rebuildCatalog() {
    CATALOG.length = 0;
    Object.keys(byId).forEach((k) => delete byId[k]);
    TERRAIN_IDS.clear();
    PROP_IDS.clear();
    SOLID_IDS.clear();

    const cellsInEnabledSets = new Set();
    sets.filter((s) => s.enabled).forEach((s) => {
      s.members.forEach((m) => cellsInEnabledSets.add(m.cellId));
    });

    cells.filter((c) => c.enabled && !cellsInEnabledSets.has(c.id)).forEach((c) => {
      const entry = { ...c, isSet: false };
      CATALOG.push(entry);
      byId[entry.id] = entry;
      if (entry.kind === 'terrain') TERRAIN_IDS.add(entry.id);
      else PROP_IDS.add(entry.id);
      if (entry.solid) SOLID_IDS.add(entry.id);
    });

    sets.filter((s) => s.enabled).forEach((s) => {
      const entry = { ...s, isSet: true };
      CATALOG.push(entry);
      byId[entry.id] = entry;
      if (entry.kind === 'terrain') TERRAIN_IDS.add(entry.id);
      else PROP_IDS.add(entry.id);
      if (entry.solid) SOLID_IDS.add(entry.id);
    });

    ready = !!(sheet && sheet.complete && sheet.naturalWidth && CATALOG.length);
    global.dispatchEvent(new Event('customsheet:updated'));
  }

  function getConfig() {
    return {
      grid: { ...grid },
      cells: cells.map((c) => ({ ...c })),
      sets: sets.map((s) => ({ ...s, members: s.members.map((m) => ({ ...m })) })),
      nextSetId,
    };
  }

  function setConfig(config) {
    grid = { ...EMPTY_GRID, ...(config.grid || {}) };
    cells = (config.cells || []).map((c) => ({ ...c }));
    sets = (config.sets || []).map((s) => ({ ...s, members: (s.members || []).map((m) => ({ ...m })) }));
    nextSetId = config.nextSetId || 1;
    rebuildCatalog();
  }

  function generateCellsFromGrid() {
    const prev = Object.fromEntries(cells.map((c) => [`${c.col},${c.row}`, c]));
    const next = [];
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        const key = `${col},${row}`;
        const old = prev[key];
        next.push({
          id: cellId(col, row),
          col,
          row,
          label: old?.label || `タイル ${col + 1}-${row + 1}`,
          enabled: old?.enabled ?? false,
          kind: old?.kind || 'prop',
          solid: old?.solid ?? false,
          setId: old?.setId || null,
          crop: old?.crop ? { ...old.crop } : { ...EMPTY_CROP },
        });
      }
    }
    cells = next;
    pruneSetsAfterGridChange();
    rebuildCatalog();
  }

  function pruneSetsAfterGridChange() {
    const cellIds = new Set(cells.map((c) => c.id));
    sets = sets.filter((set) => {
      const validMembers = set.members.filter((m) => cellIds.has(m.cellId));
      if (validMembers.length < 2) {
        validMembers.forEach((m) => {
          const c = cells.find((t) => t.id === m.cellId);
          if (c) c.setId = null;
        });
        return false;
      }
      if (validMembers.length !== set.members.length) {
        const memberCells = validMembers.map((m) => cells.find((c) => c.id === m.cellId)).filter(Boolean);
        Object.assign(set, normalizeSetMembers(memberCells));
      }
      return true;
    });
    cells.forEach((c) => {
      if (c.setId && !sets.some((s) => s.id === c.setId)) c.setId = null;
    });
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        grid = { ...EMPTY_GRID, ...(data.grid || {}) };
        cells = data.cells || [];
        sets = data.sets || [];
        nextSetId = data.nextSetId || 1;
      }
    } catch (_) {
      grid = { ...EMPTY_GRID };
      cells = [];
      sets = [];
    }

    rebuildCatalog();

    return idbGetBlob(SHEET_BLOB_KEY).then((blob) => {
      if (blob) {
        return loadSheetImageFromBlob(blob).then(() => {
          prewarmCellCache();
          rebuildCatalog();
          return true;
        }).catch(() => {
          sheet = null;
          rebuildCatalog();
          return false;
        });
      }

      const dataUrl = localStorage.getItem(SHEET_DATA_KEY);
      if (!dataUrl) {
        rebuildCatalog();
        return false;
      }

      return loadSheetImageFromDataUrl(dataUrl).then(() => {
        prewarmCellCache();
        rebuildCatalog();
        return fetch(dataUrl)
          .then((r) => r.blob())
          .then((migrated) => idbSetBlob(SHEET_BLOB_KEY, migrated))
          .then(() => localStorage.removeItem(SHEET_DATA_KEY))
          .catch(() => {})
          .then(() => true);
      }).catch(() => {
        sheet = null;
        rebuildCatalog();
        return false;
      });
    }).catch(() => {
      rebuildCatalog();
      return false;
    });
  }

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ grid, cells, sets, nextSetId }));
    } catch (_) { /* ignore */ }
  }

  function setSheetDataUrl(dataUrl) {
    return fetch(dataUrl)
      .then((r) => r.blob())
      .then((blob) => setSheetBlob(blob))
      .catch(() => loadSheetImageFromDataUrl(dataUrl).then(() => {
        finalizeSheetLoad({ regenerateGrid: true });
        try {
          localStorage.setItem(SHEET_DATA_KEY, dataUrl);
        } catch (e) {
          console.warn('CustomSheet: image too large for localStorage', e);
        }
        return true;
      }));
  }

  function setSheetBlob(blob) {
    if (!blob) return Promise.reject(new Error('empty blob'));
    return idbSetBlob(SHEET_BLOB_KEY, blob)
      .then(() => loadSheetImageFromBlob(blob))
      .then(() => {
        localStorage.removeItem(SHEET_DATA_KEY);
        finalizeSheetLoad({ regenerateGrid: true });
        return true;
      });
  }

  function setSheetFile(file) {
    if (!file) return Promise.reject(new Error('empty file'));
    return setSheetBlob(file);
  }

  function findBestGrid(w, h) {
    let best = null;
    let bestScore = Infinity;
    const sizes = [128, 96, 64, 48, 32, 24, 16];
    const gaps = [0, 1, 2, 4, 8];

    sizes.forEach((size) => {
      gaps.forEach((gap) => {
        for (let cols = 1; cols <= 64; cols++) {
          const usedW = cols * size + Math.max(0, cols - 1) * gap;
          const dw = Math.abs(usedW - w);
          if (dw > Math.max(4, gap * 2 + 2)) continue;

          for (let rows = 1; rows <= 64; rows++) {
            const usedH = rows * size + Math.max(0, rows - 1) * gap;
            const dh = Math.abs(usedH - h);
            if (dh > Math.max(4, gap * 2 + 2)) continue;

            const sizeBonus = size === 32 ? 0 : size === 64 ? 1 : 2;
            const score = dw + dh + sizeBonus;
            if (score < bestScore) {
              bestScore = score;
              best = { cellSize: size, gap, cols, rows };
            }
          }
        }
      });
    });

    if (best) return best;
    const size = 32;
    return {
      cellSize: size,
      gap: 0,
      cols: Math.max(1, Math.floor(w / size)),
      rows: Math.max(1, Math.floor(h / size)),
    };
  }

  function autoFitGridFromImage() {
    if (!sheet) return;
    const w = sheet.naturalWidth;
    const h = sheet.naturalHeight;
    grid.offsetX = 0;
    grid.offsetY = 0;
    const fit = findBestGrid(w, h);
    grid.cellSize = fit.cellSize;
    grid.gap = fit.gap;
    grid.cols = fit.cols;
    grid.rows = fit.rows;
  }

  function hasAdoptedTiles() {
    return CATALOG.length > 0;
  }

  function getNativeTileSize() {
    const size = Math.round(Number(grid.cellSize) || 32);
    return Math.max(16, Math.min(128, size));
  }

  function updateGrid(partial) {
    const keyBlackChanged = partial.keyBlack !== undefined && partial.keyBlack !== grid.keyBlack;
    grid = { ...grid, ...partial };
    if (keyBlackChanged || partial.cellSize !== undefined || partial.offsetX !== undefined
      || partial.offsetY !== undefined || partial.gap !== undefined) {
      invalidateCellCache();
    }
    generateCellsFromGrid();
    prewarmCellCache();
    saveToStorage();
  }

  function updateCell(id, partial) {
    const c = cells.find((t) => t.id === id);
    if (!c) return;
    if (c.setId && (partial.enabled === true || partial.enabled === false)) {
      return;
    }
    if (partial.crop) partial.crop = clampCrop(partial.crop);
    Object.assign(c, partial);
    if (partial.crop) {
      invalidateCellCache();
      prewarmCellCache();
    }
    rebuildCatalog();
    saveToStorage();
  }

  function getCrop(id) {
    const c = cells.find((t) => t.id === id);
    return c ? getCellCrop(c) : { ...EMPTY_CROP };
  }

  function setCrop(id, crop) {
    updateCell(id, { crop: clampCrop(crop) });
    global.dispatchEvent(new Event('customsheet:crops-updated'));
  }

  function resetCrop(id) {
    updateCell(id, { crop: { ...EMPTY_CROP } });
    global.dispatchEvent(new Event('customsheet:crops-updated'));
  }

  function resetAllCrops() {
    cells.forEach((c) => { c.crop = { ...EMPTY_CROP }; });
    invalidateCellCache();
    prewarmCellCache();
    rebuildCatalog();
    saveToStorage();
    global.dispatchEvent(new Event('customsheet:crops-updated'));
  }

  function getSet(id) {
    return sets.find((s) => s.id === id) || byId[id] || null;
  }

  function createSet(memberIds, label, options = {}) {
    const uniqueIds = [...new Set(memberIds)];
    const memberCells = uniqueIds.map((id) => cells.find((c) => c.id === id)).filter(Boolean);
    if (memberCells.length < 2) return null;
    if (memberCells.some((c) => c.setId)) return null;

    const id = allocSetId();
    const set = {
      id,
      label: (label || `セット ${sets.length + 1}`).trim(),
      enabled: true,
      kind: options.kind || 'prop',
      solid: !!options.solid,
      ...normalizeSetMembers(memberCells),
    };
    sets.push(set);
    memberCells.forEach((c) => {
      c.setId = id;
      c.enabled = true;
    });
    rebuildCatalog();
    saveToStorage();
    return set;
  }

  function updateSet(id, partial) {
    const set = sets.find((s) => s.id === id);
    if (!set) return;
    Object.assign(set, partial);
    rebuildCatalog();
    saveToStorage();
  }

  function deleteSet(id) {
    const set = sets.find((s) => s.id === id);
    if (!set) return;
    set.members.forEach((m) => {
      const c = cells.find((t) => t.id === m.cellId);
      if (c) {
        c.setId = null;
        c.enabled = false;
      }
    });
    sets = sets.filter((s) => s.id !== id);
    rebuildCatalog();
    saveToStorage();
  }

  function specOfCell(entry) {
    if (!entry || !sheet) return null;
    const rect = squareSourceRect(entry, getCellCrop(entry));
    return {
      ...rect,
      anchor: entry.kind === 'terrain' ? [0, 0] : [0.5, 0.92],
      keyBlack: grid.keyBlack,
    };
  }

  function specOf(type) {
    if (isSetType(type)) return setSpecOf(type);
    const entry = byId[type] || cells.find((c) => c.id === type);
    return specOfCell(entry);
  }

  function setSpecOf(type) {
    const set = getSet(type);
    if (!set || !sheet) return null;
    return {
      isSet: true,
      kind: set.kind,
      anchor: set.kind === 'terrain' ? [0, 0] : [0.5, 0.92],
      keyBlack: grid.keyBlack,
      widthCells: set.widthCells,
      heightCells: set.heightCells,
      members: set.members.map((m) => {
        const cell = cells.find((c) => c.id === m.cellId);
        const spec = cell ? specOfCell(cell) : cellRect(m.col, m.row);
        return { ...spec, dx: m.dx, dy: m.dy, cellId: m.cellId, kind: cell?.kind || set.kind };
      }),
    };
  }

  function blitCell(ctx, spec, dx, dy, dw, dh) {
    if (!sheet || !sheet.complete) return false;

    if (!spec.keyBlack) {
      ctx.drawImage(sheet, spec.x, spec.y, spec.w, spec.h, dx, dy, dw, dh);
      return true;
    }

    const cached = getCachedCellCanvas(spec.x, spec.y, spec.w, spec.h);
    ctx.drawImage(cached, dx, dy, dw, dh);
    return true;
  }

  function drawAnchored(ctx, spec, cx, cy, scale) {
    const side = spec.w * scale;
    const ax = spec.anchor[0];
    const ay = spec.anchor[1];
    const dx = Math.round(cx - side * ax);
    const dy = Math.round(cy - side * ay);
    return blitCell(ctx, spec, dx, dy, side, side);
  }

  function drawSetTerrain(ctx, type, tx, ty, tileSize) {
    const spec = setSpecOf(type);
    if (!spec) return false;
    let ok = false;
    spec.members.forEach((m) => {
      const memberSpec = { x: m.x, y: m.y, w: m.w, h: m.h, keyBlack: spec.keyBlack };
      if (blitCell(ctx, memberSpec, tx + m.dx * tileSize, ty + m.dy * tileSize, tileSize, tileSize)) ok = true;
    });
    return ok;
  }

  function drawSetProp(ctx, type, block) {
    const spec = setSpecOf(type);
    if (!spec) return false;
    let ok = false;
    spec.members.forEach((m) => {
      const cx = block.x + m.dx * block.width + block.width / 2;
      const cy = block.y + m.dy * block.height + block.height - 2;
      const memberSpec = { ...m, anchor: spec.anchor, keyBlack: spec.keyBlack };
      if (drawAnchored(ctx, memberSpec, cx, cy, block.width / m.w)) ok = true;
    });
    return ok;
  }

  function drawTerrainTile(ctx, type, tx, ty, tileSize) {
    if (isSetType(type)) return drawSetTerrain(ctx, type, tx, ty, tileSize);
    const spec = specOf(type);
    if (!spec) return false;
    return blitCell(ctx, spec, tx, ty, tileSize, tileSize);
  }

  function drawProp(ctx, type, cx, cy, tileSize) {
    const spec = specOf(type);
    if (!spec || spec.isSet) return false;
    return drawAnchored(ctx, spec, cx, cy, tileSize / spec.w);
  }

  function drawPropBlock(ctx, type, block) {
    if (isSetType(type)) return drawSetProp(ctx, type, block);
    const cx = block.x + block.width / 2;
    const cy = block.y + block.height - 2;
    return drawProp(ctx, type, cx, cy, block.width);
  }

  function drawThumb(ctx, type, size) {
    if (isSetType(type)) {
      const spec = setSpecOf(type);
      if (!spec) return false;
      const scale = size / Math.max(spec.widthCells, spec.heightCells) / spec.members[0].w;
      let ok = false;
      spec.members.forEach((m) => {
        const side = m.w * scale;
        const dx = (m.dx + 0.5) * size / spec.widthCells - side / 2;
        const dy = (m.dy + 0.5) * size / spec.heightCells - side / 2;
        const memberSpec = { ...m, keyBlack: spec.keyBlack };
        if (blitCell(ctx, memberSpec, dx, dy, side, side)) ok = true;
      });
      return ok;
    }
    const spec = specOf(type);
    if (!spec) return false;
    const scale = size / spec.w;
    const side = spec.w * scale;
    const dx = (size - side) / 2;
    const dy = (size - side) / 2;
    return blitCell(ctx, spec, dx, dy, side, side);
  }

  function gridContentSize() {
    const w = grid.offsetX + grid.cols * grid.cellSize + Math.max(0, grid.cols - 1) * grid.gap;
    const h = grid.offsetY + grid.rows * grid.cellSize + Math.max(0, grid.rows - 1) * grid.gap;
    return { w: Math.max(w, grid.cellSize), h: Math.max(h, grid.cellSize) };
  }

  function drawGridOverlay(ctx, scale, ox, oy, highlightCol, highlightRow, pickCellKeys) {
    const picked = pickCellKeys instanceof Set ? pickCellKeys : new Set();

    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        const rect = cellRect(col, row);
        const sx = ox + rect.x * scale;
        const sy = oy + rect.y * scale;
        const sw = rect.w * scale;
        const sh = rect.h * scale;
        const cell = cells.find((c) => c.col === col && c.row === row);
        const enabled = cell?.enabled;
        const inSet = !!cell?.setId;
        const pickedCell = picked.has(`${col},${row}`);

        ctx.strokeStyle = (col === highlightCol && row === highlightRow)
          ? '#f97316'
          : pickedCell ? '#a855f7'
            : inSet ? '#6366f1'
              : enabled ? '#22c55e' : '#64748b';
        ctx.lineWidth = (col === highlightCol && row === highlightRow) ? 3 : 1.5;
        ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);

        if (enabled || inSet) {
          ctx.fillStyle = inSet ? 'rgba(99,102,241,0.18)' : 'rgba(34,197,94,0.15)';
          ctx.fillRect(sx, sy, sw, sh);
        }
      }
    }

    sets.forEach((set) => {
      const x = ox + cellRect(set.anchorCol, set.anchorRow).x * scale;
      const y = oy + cellRect(set.anchorCol, set.anchorRow).y * scale;
      const w = set.widthCells * grid.cellSize * scale + Math.max(0, set.widthCells - 1) * grid.gap * scale;
      const h = set.heightCells * grid.cellSize * scale + Math.max(0, set.heightCells - 1) * grid.gap * scale;
      ctx.strokeStyle = set.enabled ? '#6366f1' : '#94a3b8';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      ctx.setLineDash([]);
    });
  }

  function drawGridPreview(ctx, canvasW, canvasH, highlightCol, highlightRow, pickCellKeys) {
    global.PopArt?.setupCrisp?.(ctx);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const hasSheet = !!(sheet && sheet.complete && sheet.naturalWidth);
    const content = hasSheet
      ? { w: sheet.naturalWidth, h: sheet.naturalHeight }
      : gridContentSize();
    const scale = Math.min(canvasW / content.w, canvasH / content.h) * (hasSheet ? 1 : 0.92);
    const dw = content.w * scale;
    const dh = content.h * scale;
    const ox = (canvasW - dw) / 2;
    const oy = (canvasH - dh) / 2;

    if (hasSheet) {
      ctx.drawImage(sheet, ox, oy, dw, dh);
    } else {
      ctx.fillStyle = '#334155';
      ctx.fillRect(ox, oy, dw, dh);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.strokeRect(ox + 0.5, oy + 0.5, dw - 1, dh - 1);
    }

    drawGridOverlay(ctx, scale, ox, oy, highlightCol, highlightRow, pickCellKeys);

    if (!hasSheet) {
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 11px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PNGを選択するとシート画像が表示されます', canvasW / 2, Math.min(canvasH - 12, oy + dh + 18));
    }

    return hasSheet;
  }

  function drawAdjustPreview(ctx, id, canvasW, canvasH) {
    global.PopArt?.setupCrisp?.(ctx);
    const cell = cells.find((c) => c.id === id);
    if (!cell || !sheet || !sheet.complete) return false;
    const crop = getCellCrop(cell);
    const base = cellRect(cell.col, cell.row);
    const rect = squareSourceRect(cell, crop);

    ctx.fillStyle = '#faf6ee';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const pad = 10;
    const availW = canvasW - pad * 2;
    const availH = canvasH - pad * 2;
    const cellScale = Math.min(availW / base.w, availH / base.h);
    const drawCellW = base.w * cellScale;
    const drawCellH = base.h * cellScale;
    const ox = (canvasW - drawCellW) / 2;
    const oy = (canvasH - drawCellH) / 2;

    ctx.drawImage(sheet, base.x, base.y, base.w, base.h, ox, oy, drawCellW, drawCellH);

    const innerL = crop.left * drawCellW;
    const innerT = crop.top * drawCellH;
    const innerW = drawCellW - (crop.left + crop.right) * drawCellW;
    const innerH = drawCellH - (crop.top + crop.bottom) * drawCellH;
    const side = Math.min(innerW, innerH);
    const cx = ox + innerL + innerW / 2;
    const cy = oy + innerT + innerH / 2;
    const sqX = cx - side / 2;
    const sqY = cy - side / 2;

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(ox, oy, drawCellW, drawCellH);
    const sqSrc = squareSourceRect(cell, crop);
    const sqDrawSide = side;
    ctx.drawImage(sheet, sqSrc.x, sqSrc.y, sqSrc.w, sqSrc.h, sqX, sqY, sqDrawSide, sqDrawSide);

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(ox, oy, drawCellW, drawCellH);
    ctx.setLineDash([]);
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(sqX, sqY, sqDrawSide, sqDrawSide);
    return true;
  }

  function getSetFootprint(setId) {
    const set = getSet(setId);
    if (!set) return [];
    return set.members.map((m) => ({ dx: m.dx, dy: m.dy }));
  }

  loadFromStorage();

  global.CustomSheetAssets = {
    ID_PREFIX,
    SET_PREFIX,
    get CATALOG() { return CATALOG; },
    TERRAIN_IDS,
    PROP_IDS,
    SOLID_IDS,
    isSheetType,
    isSetType,
    isCustomType,
    isReady: () => ready,
    getConfig,
    setConfig,
    getGrid: () => ({ ...grid }),
    getCells: () => cells.map((c) => ({ ...c })),
    getSets: () => sets.map((s) => ({ ...s, members: s.members.map((m) => ({ ...m })) })),
    getSet,
    getSetFootprint,
    hasSheetImage: () => !!(sheet && sheet.complete && sheet.naturalWidth),
    getSheetImage: () => (sheet && sheet.complete ? sheet : null),
    updateGrid,
    updateCell,
    getCrop,
    setCrop,
    resetCrop,
    resetAllCrops,
    createSet,
    updateSet,
    deleteSet,
    generateCellsFromGrid,
    setSheetDataUrl,
    setSheetBlob,
    setSheetFile,
    autoFitGridFromImage,
    hasAdoptedTiles,
    getNativeTileSize,
    saveToStorage,
    loadFromStorage,
    drawTerrainTile,
    drawProp,
    drawPropBlock,
    drawThumb,
    drawAdjustPreview,
    drawGridPreview,
    getDefaultLabel: (id) => byId[id]?.label || cells.find((c) => c.id === id)?.label || id,
    cellRect,
  };
})(window);
