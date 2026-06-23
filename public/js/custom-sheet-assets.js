/**
 * ユーザー定義グリッドシート（等間隔スクエア切り抜き）
 */
(function (global) {
  const STORAGE_KEY = 'pop-magic-custom-sheet-v1';
  const SHEET_DATA_KEY = 'pop-magic-custom-sheet-image-v1';
  const ID_PREFIX = 'gs_';

  const EMPTY_GRID = {
    offsetX: 0,
    offsetY: 0,
    cellSize: 64,
    gap: 8,
    cols: 4,
    rows: 4,
    keyBlack: true,
  };

  let sheet = null;
  let grid = { ...EMPTY_GRID };
  let cells = [];
  let ready = false;

  const byId = {};
  const CATALOG = [];
  const TERRAIN_IDS = new Set();
  const PROP_IDS = new Set();
  const SOLID_IDS = new Set();

  function isSheetType(type) {
    return typeof type === 'string' && type.startsWith(ID_PREFIX);
  }

  function cellId(col, row) {
    return `${ID_PREFIX}${col}_${row}`;
  }

  function cellRect(col, row) {
    const x = grid.offsetX + col * (grid.cellSize + grid.gap);
    const y = grid.offsetY + row * (grid.cellSize + grid.gap);
    return { x, y, w: grid.cellSize, h: grid.cellSize };
  }

  function rebuildCatalog() {
    CATALOG.length = 0;
    Object.keys(byId).forEach((k) => delete byId[k]);
    TERRAIN_IDS.clear();
    PROP_IDS.clear();
    SOLID_IDS.clear();

    cells.filter((c) => c.enabled).forEach((c) => {
      const entry = { ...c };
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
    };
  }

  function setConfig(config) {
    grid = { ...EMPTY_GRID, ...(config.grid || {}) };
    cells = (config.cells || []).map((c) => ({ ...c }));
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
        });
      }
    }
    cells = next;
    rebuildCatalog();
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        grid = { ...EMPTY_GRID, ...(data.grid || {}) };
        cells = data.cells || [];
      }
    } catch (_) {
      grid = { ...EMPTY_GRID };
      cells = [];
    }

    const dataUrl = localStorage.getItem(SHEET_DATA_KEY);
    if (!dataUrl) {
      rebuildCatalog();
      return Promise.resolve(false);
    }

    sheet = new Image();
    return new Promise((resolve) => {
      sheet.onload = () => {
        rebuildCatalog();
        resolve(true);
      };
      sheet.onerror = () => {
        sheet = null;
        rebuildCatalog();
        resolve(false);
      };
      sheet.src = dataUrl;
    });
  }

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ grid, cells }));
    } catch (_) { /* ignore */ }
  }

  function setSheetDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        sheet = img;
        try {
          localStorage.setItem(SHEET_DATA_KEY, dataUrl);
        } catch (e) {
          console.warn('CustomSheet: image too large for localStorage', e);
        }
        if (!cells.length) {
          autoFitGridFromImage();
        }
        generateCellsFromGrid();
        saveToStorage();
        resolve(true);
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  function autoFitGridFromImage() {
    if (!sheet) return;
    const w = sheet.naturalWidth;
    const h = sheet.naturalHeight;
    grid.offsetX = 0;
    grid.offsetY = 0;
    if (w >= h) {
      grid.cellSize = Math.max(16, Math.floor(w / 9));
      grid.gap = Math.max(0, Math.floor(grid.cellSize * 0.05));
    } else {
      grid.cellSize = Math.max(16, Math.floor(w / 4));
      grid.gap = 4;
    }
    grid.cols = Math.max(1, Math.floor((w - grid.offsetX + grid.gap) / (grid.cellSize + grid.gap)));
    grid.rows = Math.max(1, Math.floor((h - grid.offsetY + grid.gap) / (grid.cellSize + grid.gap)));
  }

  function updateGrid(partial) {
    grid = { ...grid, ...partial };
    generateCellsFromGrid();
    saveToStorage();
  }

  function updateCell(id, partial) {
    const c = cells.find((t) => t.id === id);
    if (!c) return;
    Object.assign(c, partial);
    rebuildCatalog();
    saveToStorage();
  }

  function specOf(type) {
    const entry = byId[type] || cells.find((c) => c.id === type);
    if (!entry || !sheet) return null;
    const rect = cellRect(entry.col, entry.row);
    return {
      ...rect,
      anchor: entry.kind === 'terrain' ? [0, 0] : [0.5, 0.92],
      keyBlack: grid.keyBlack,
    };
  }

  function blitCell(ctx, spec, dx, dy, dw, dh) {
    if (!sheet || !sheet.complete) return false;

    if (!spec.keyBlack) {
      ctx.drawImage(sheet, spec.x, spec.y, spec.w, spec.h, dx, dy, dw, dh);
      return true;
    }

    const tmp = document.createElement('canvas');
    tmp.width = spec.w;
    tmp.height = spec.h;
    const tctx = tmp.getContext('2d');
    tctx.drawImage(sheet, spec.x, spec.y, spec.w, spec.h, 0, 0, spec.w, spec.h);
    const img = tctx.getImageData(0, 0, spec.w, spec.h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      if (r < 48 && g < 48 && b < 48) {
        d[i + 3] = 0;
      }
    }
    tctx.putImageData(img, 0, 0);
    ctx.drawImage(tmp, dx, dy, dw, dh);
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

  function drawTerrainTile(ctx, type, tx, ty, tileSize) {
    const spec = specOf(type);
    if (!spec) return false;
    return blitCell(ctx, spec, tx, ty, tileSize, tileSize);
  }

  function drawProp(ctx, type, cx, cy, tileSize) {
    const spec = specOf(type);
    if (!spec) return false;
    return drawAnchored(ctx, spec, cx, cy, tileSize / spec.w);
  }

  function drawThumb(ctx, type, size) {
    const spec = specOf(type);
    if (!spec) return false;
    const scale = size / spec.w;
    const side = spec.w * scale;
    const dx = (size - side) / 2;
    const dy = (size - side) / 2;
    return blitCell(ctx, spec, dx, dy, side, side);
  }

  function drawGridPreview(ctx, canvasW, canvasH, highlightCol, highlightRow) {
    if (!sheet || !sheet.complete) return false;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const scale = Math.min(canvasW / sheet.naturalWidth, canvasH / sheet.naturalHeight);
    const dw = sheet.naturalWidth * scale;
    const dh = sheet.naturalHeight * scale;
    const ox = (canvasW - dw) / 2;
    const oy = (canvasH - dh) / 2;

    ctx.drawImage(sheet, ox, oy, dw, dh);

    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        const rect = cellRect(col, row);
        const sx = ox + rect.x * scale;
        const sy = oy + rect.y * scale;
        const sw = rect.w * scale;
        const sh = rect.h * scale;
        const cell = cells.find((c) => c.col === col && c.row === row);
        const enabled = cell?.enabled;

        ctx.strokeStyle = (col === highlightCol && row === highlightRow)
          ? '#f97316'
          : enabled ? '#22c55e' : '#64748b';
        ctx.lineWidth = (col === highlightCol && row === highlightRow) ? 3 : 1.5;
        ctx.strokeRect(sx, sy, sw, sh);

        if (enabled && cell) {
          ctx.fillStyle = 'rgba(34,197,94,0.15)';
          ctx.fillRect(sx, sy, sw, sh);
        }
      }
    }
    return true;
  }

  loadFromStorage();

  global.CustomSheetAssets = {
    ID_PREFIX,
    get CATALOG() { return CATALOG; },
    TERRAIN_IDS,
    PROP_IDS,
    SOLID_IDS,
    isSheetType,
    isReady: () => ready,
    getConfig,
    setConfig,
    getGrid: () => ({ ...grid }),
    getCells: () => cells.map((c) => ({ ...c })),
    updateGrid,
    updateCell,
    generateCellsFromGrid,
    setSheetDataUrl,
    autoFitGridFromImage,
    saveToStorage,
    loadFromStorage,
    drawTerrainTile,
    drawProp,
    drawThumb,
    drawGridPreview,
    getDefaultLabel: (id) => byId[id]?.label || cells.find((c) => c.id === id)?.label || id,
    cellRect,
  };
})(window);
